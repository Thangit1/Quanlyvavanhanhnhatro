package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.*;
import java.util.List;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Creates a separate UUID schema; never writes to the application database. */
@EnabledIfSystemProperty(named="sync.mysql", matches="true")
class OwnerManagerSyncMysqlTest {
    @Test void sharedDataFollowsAssignmentAndActualResidence() throws Exception {
        var f = new DepositLedgerMysqlTest();
        f.setup("owner_manager_sync_test_", null);
        var tenants = new AdminTenantRepository(f.db, new RoomLifecycleGuard(f.db));
        var dashboard = new DashboardRepository(f.db);
        var reports = new AdminReportRepository(f.db);
        long assigned = f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'SYNC-A','Assigned','Test')");
        long unassigned = f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'SYNC-B','Unassigned','Test')");
        f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",assigned).update();
        long room = f.insert("INSERT INTO rooms(property_id,code,monthly_rent,status) VALUES("+assigned+",'SYNC',1000,'OCCUPIED')");
        assertThat(dashboard.properties(2L,RoleCode.MANAGER)).extracting(x->x.id()).containsExactly(assigned);
        assertThat(dashboard.properties(1L,RoleCode.OWNER)).extracting(x->x.id()).contains(assigned,unassigned);
        assertThat(tenants.canAccessProperty(4,RoleCode.OWNER,assigned)).isFalse();
        assertThat(tenants.canAccessProperty(2,RoleCode.MANAGER,unassigned)).isFalse();

        f.db.sql("UPDATE users SET status='INACTIVE' WHERE id=5").update();
        long profile = f.insert("INSERT INTO tenant_profiles(tenant_code,user_id,full_name,phone,status,created_by) VALUES('SYNC',5,'Shared resident','0987654321','INACTIVE',2)");
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,status,move_in_date,created_by) VALUES(:t,:p,:r,'ACTIVE',CURRENT_DATE,2)").param("t",profile).param("p",assigned).param("r",room).update();
        assertThat(tenants.canAccessTenant(1,RoleCode.OWNER,profile)).isTrue();
        assertThat(tenants.summary(1,RoleCode.OWNER,assigned).active()).isEqualTo(1);
        assertThat(((Number)reports.periodSummary(1,RoleCode.OWNER,List.of(assigned),java.time.LocalDate.now().withDayOfMonth(1),java.time.LocalDate.now()).get("activeTenants")).longValue()).isEqualTo(1);
        assertThat(tenants.summary(2,RoleCode.MANAGER,assigned).active()).isEqualTo(1);
        assertThat(tenants.profile(profile).orElseThrow().get("resident_status")).isEqualTo("ACTIVE");
        assertThat(tenants.list(2,RoleCode.MANAGER,assigned,null,"INACTIVE",null,null,null,null,null,null,null,0,20).items()).isEmpty();
        assertThat(tenants.list(2,RoleCode.MANAGER,assigned,null,"ACTIVE",null,null,null,null,null,null,null,0,20).items()).extracting(x->x.id()).containsExactly(profile);
        f.db.sql("UPDATE rooms SET code='OWNER-UPDATED' WHERE id=:r").param("r",room).update();
        assertThat(tenants.rooms(2,RoleCode.MANAGER,assigned)).extracting(x->x.code()).containsExactly("OWNER-UPDATED");

        // Neither a profile placeholder nor a future arrival is a current resident.
        var service = new com.thangit.boardinghouse.service.impl.AdminTenantServiceImpl(tenants,new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder());
        var manager = new com.thangit.boardinghouse.security.AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        var request = new com.fasterxml.jackson.databind.ObjectMapper().convertValue(java.util.Map.of(
                "fullName","Manager-created placeholder","phone","0987654322","propertyId",assigned,
                "identityType","CCCD","identityNumber","012345678901"),
                com.thangit.boardinghouse.dto.request.tenant.AdminTenantRequests.SaveTenant.class);
        long placeholder = f.inTx(()->service.create(manager,request)).id();
        assertThat(service.detail(f.owner,placeholder).fullName()).isEqualTo("Manager-created placeholder");
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,status,move_in_date) VALUES(:t,:p,:r,'ACTIVE',DATE_ADD(CURRENT_DATE,INTERVAL 1 DAY))").param("t",placeholder).param("p",assigned).param("r",room).update();
        assertThat(tenants.summary(1,RoleCode.OWNER,assigned).total()).isEqualTo(2);
        assertThat(tenants.summary(1,RoleCode.OWNER,assigned).active()).isEqualTo(1);
        f.db.sql("UPDATE tenant_residences SET status='MOVED_OUT',move_out_date=CURRENT_DATE WHERE tenant_profile_id=:t").param("t",profile).update();
        assertThat(tenants.summary(1,RoleCode.OWNER,assigned).active()).isZero();
        var report = reports.tenants(1,RoleCode.OWNER,List.of(assigned),java.time.LocalDate.now().withDayOfMonth(1),java.time.LocalDate.now());
        assertThat(report.summary().get("activeResidents")).isEqualByComparingTo("0");
        assertThat(report.summary().get("movedOut")).isEqualByComparingTo("1");
        assertThat(tenants.list(1,RoleCode.OWNER,assigned,null,"INACTIVE",null,null,null,null,null,null,null,0,20).items()).extracting(x->x.id()).containsExactly(placeholder);
        assertThat(tenants.list(1,RoleCode.OWNER,assigned,null,"ACTIVE",null,null,null,null,null,null,null,0,20).totalElements()).isZero();
        assertThat(tenants.exportRows(4,RoleCode.OWNER,assigned,null)).isEmpty();
        f.db.sql("DELETE FROM property_managers WHERE property_id=:p AND manager_id=2").param("p",assigned).update();
        assertThat(dashboard.properties(2L,RoleCode.MANAGER)).isEmpty();
        assertThat(tenants.canAccessTenant(2,RoleCode.MANAGER,profile)).isFalse();
        assertThat(tenants.exportRows(2,RoleCode.MANAGER,assigned,null)).isEmpty();
        assertThat(tenants.summary(2,RoleCode.MANAGER,assigned).total()).isZero();
        assertThatThrownBy(()->service.detail(manager,placeholder)).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
}
