package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.SaveInvoice;
import com.thangit.boardinghouse.repository.*;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.service.impl.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.datasource.init.ScriptUtils;

@EnabledIfSystemProperty(named="assignment.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OwnerManagerAssignmentMysqlTest {
    final DirectContractMysqlTest d=new DirectContractMysqlTest();
    PropertyAuthorization access;AdminPropertyRepository properties;AdminPropertyServiceImpl service;
    @BeforeAll void setup()throws Exception{d.setup();access=new PropertyAuthorization(d.f.db,new SecurityAudit(d.f.db));properties=new AdminPropertyRepository(d.f.db);service=new AdminPropertyServiceImpl(properties,new RoomLifecycleGuard(d.f.db));}
    @SuppressWarnings("unchecked") ContractOnboardingService.Confirmation confirmation(long c,String key){var row=(Map<String,Object>)d.f.onboarding.detail(d.f.owner,c).get(key);return new ContractOnboardingService.Confirmation(((Number)row.get("version")).longValue(),row.get("content_hash").toString());}
    @Test void threePropertiesAreSharedByAssignmentAndRevocationAcrossModules(){
        // Legacy fixture belongs to Owner B, outside Owner A's three properties.
        d.f.db.sql("UPDATE properties SET owner_id=4").update();
        var a=d.fixture();var b=d.fixture();var c=d.fixture();
        for(long id:List.of(a.property(),b.property(),c.property()))d.f.run(()->access.revokeManager(d.f.owner,id,2,"Initially unassigned"));
        var dashboard=new DashboardRepository(d.f.db);var reports=new AdminReportRepository(d.f.db);var tenants=new AdminTenantRepository(d.f.db,new RoomLifecycleGuard(d.f.db));var contracts=new AdminContractRepository(d.f.db);
        assertThat(properties.countProperties(1,RoleCode.OWNER,null,null)).isEqualTo(3);
        assertThat(dashboard.properties(2L,RoleCode.MANAGER)).isEmpty();
        d.f.run(()->access.assignManagerBatch(d.f.owner,new PropertyAuthorization.ManagerBatchAssignment(List.of(a.property(),b.property()),2L,EnumSet.allOf(PropertyAuthorization.Capability.class),"Two properties explicitly selected")));
        assertThat(properties.countProperties(1,RoleCode.OWNER,null,null)).isEqualTo(3);
        assertThat(properties.countProperties(2,RoleCode.MANAGER,null,null)).isEqualTo(2);
        assertThat(reports.properties(2,RoleCode.MANAGER)).extracting(x->x.id()).containsExactlyInAnyOrder(a.property(),b.property());
        assertThatThrownBy(()->access.detail(d.manager,a.property())).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->d.f.run(()->access.assignManagerBatch(d.manager,new PropertyAuthorization.ManagerBatchAssignment(List.of(c.property()),2L,Set.of(),"Self grant attempt")))).isInstanceOf(AuthException.class);
        var ownerB=new AuthenticatedUser(4L,"owner-b",RoleCode.OWNER);long foreign=dashboard.properties(4L,RoleCode.OWNER).getFirst().id();
        assertThatThrownBy(()->access.detail(ownerB,a.property())).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->d.f.run(()->access.assignManagerBatch(d.f.owner,new PropertyAuthorization.ManagerBatchAssignment(List.of(c.property(),foreign),2L,Set.of(),"Mixed-owner batch")))).isInstanceOf(AuthException.class);
        assertThat(properties.canAccess(2,RoleCode.MANAGER,c.property())).isFalse();
        d.f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 6,id FROM roles WHERE code='MANAGER'").update();
        d.f.run(()->access.assignManager(ownerB,foreign,new PropertyAuthorization.ManagerAssignment(6L,Set.of(),"Owner B manager")));
        assertThat(dashboard.properties(6L,RoleCode.MANAGER)).extracting(x->x.id()).doesNotContain(a.property(),b.property(),c.property());
        long building=d.f.inTx(()->service.createBuilding(d.manager,a.property(),new SaveBuilding("A","Block A",0)).id());
        long floor=d.f.inTx(()->service.createFloor(d.manager,building,new SaveFloor("F1","Floor 1",1,0)).id());
        long room=d.f.inTx(()->service.createRoom(d.manager,new SaveRoom(a.property(),building,floor,"NEW","Shared new room","Studio",null,null,new BigDecimal("1000"),BigDecimal.ZERO,2,null,List.of(),List.of(),null)).id());
        assertThat(service.room(d.f.owner,room).room().id()).isEqualTo(room);
        assertThat(service.listRooms(d.f.owner,a.property(),null,null,null,null,0,20).page().items()).extracting(x->x.id()).contains(room);
        assertThat(service.listRooms(d.manager,a.property(),null,null,null,null,0,20).page().items()).extracting(x->x.id()).contains(room);
        long contract=d.create(a,true),otherContract=d.create(b,true);
        assertThat(contracts.detail(2,RoleCode.MANAGER,contract)).isPresent();
        assertThat(contracts.detail(6,RoleCode.MANAGER,contract)).isEmpty();
        var tenant=new AuthenticatedUser(a.user(),"tenant-test",RoleCode.TENANT);
        long checkin=d.f.inTx(()->d.f.lifecycle.prepareCheckin(d.f.owner,new PrepareCheckin(contract,null,LocalDate.now(),null,null)).id());
        d.f.run(()->d.f.onboarding.verifyIdentity(d.f.owner,contract,new ContractOnboardingService.Evidence("Verified identity")));
        var version=confirmation(contract,"contractVersion");d.f.run(()->d.f.onboarding.confirmContract(d.f.owner,contract,version));d.f.run(()->d.f.onboarding.confirmContract(tenant,contract,version));
        d.f.run(()->d.f.onboarding.saveHandover(d.f.owner,contract,new ContractOnboardingService.Handover(0L,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual handover")));
        d.f.run(()->d.f.onboarding.confirmHandover(tenant,contract,confirmation(contract,"handoverVersion")));
        d.f.run(()->d.f.lifecycle.completeCheckin(d.f.owner,checkin,new CompleteCheckin(true,true,true,BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual arrival",1L)));
        assertThat(service.room(d.manager,a.room()).room().status()).isEqualTo(service.room(d.f.owner,a.room()).room().status()).isEqualTo("OCCUPIED");
        assertThat(service.room(d.manager,a.room()).room().currentOccupants()).isEqualTo(1);
        assertThat(service.room(d.manager,a.room()).occupants()).hasSize(1);
        assertThat(tenants.summary(1,RoleCode.OWNER,a.property()).active()).isEqualTo(tenants.summary(2,RoleCode.MANAGER,a.property()).active()).isEqualTo(1);
        assertThat(reports.tenants(2,RoleCode.MANAGER,List.of(a.property()),LocalDate.now().withDayOfMonth(1),LocalDate.now()).summary().get("activeResidents")).isEqualByComparingTo("1");
        var invoices=new AdminInvoiceServiceImpl(new AdminInvoiceRepository(d.f.db));var period=LocalDate.now().withDayOfMonth(1);
        long invoice=d.f.inTx(()->invoices.create(d.f.owner,new SaveInvoice(a.room(),contract,period.toString().substring(0,7),period,period.plusMonths(1).minusDays(1),LocalDate.now(),LocalDate.now().plusDays(5),List.of(),BigDecimal.ZERO,false,null,"ISSUE",null)).id());
        assertThat(invoices.detail(d.manager,invoice).remainingAmount()).isEqualByComparingTo(invoices.detail(d.f.owner,invoice).remainingAmount());
        d.f.run(()->access.revokeManager(d.f.owner,b.property(),2,"One property revoked"));
        assertThat(dashboard.properties(2L,RoleCode.MANAGER)).extracting(x->x.id()).containsExactly(a.property());
        assertThatThrownBy(()->service.property(d.manager,b.property())).isInstanceOf(AuthException.class);
        assertThat(tenants.canAccessTenant(2,RoleCode.MANAGER,b.profile())).isFalse();
        assertThat(contracts.detail(2,RoleCode.MANAGER,otherContract)).isEmpty();
        assertThat(reports.properties(2,RoleCode.MANAGER)).extracting(x->x.id()).containsExactly(a.property());
        d.f.run(()->access.revokeManager(d.f.owner,a.property(),2,"All access revoked"));
        assertThatThrownBy(()->invoices.detail(d.manager,invoice)).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->service.room(d.manager,a.room())).isInstanceOf(AuthException.class);
        assertThat(properties.countProperties(1,RoleCode.OWNER,null,null)).isEqualTo(3);
        assertThat(d.f.db.sql("SELECT COUNT(*) FROM security_audit_logs WHERE actor_id=1 AND action IN ('MANAGER_ASSIGNED','MANAGER_REVOKED')").query(Long.class).single()).isPositive();
    }
    @Test void demoSeedRequiresExplicitOwnerAndManagerAndIsIdempotent()throws Exception{
        d.f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 1,id FROM roles WHERE code='OWNER'").update();
        long before=d.f.db.sql("SELECT COUNT(*) FROM properties").query(Long.class).single();
        try(var connection=d.f.dataSource.getConnection()){
            connection.createStatement().execute("SET @demo_owner_email=NULL,@demo_manager_email=NULL,@demo_tenant_email=NULL");
            var script=new org.springframework.core.io.support.EncodedResource(new FileSystemResource("../database/seed-admin-tenants.sql"),java.nio.charset.StandardCharsets.UTF_8);ScriptUtils.executeSqlScript(connection,script);
            assertThat(d.f.db.sql("SELECT COUNT(*) FROM properties").query(Long.class).single()).isEqualTo(before);
            connection.createStatement().execute("SET @demo_owner_email='p03-1@test.invalid',@demo_manager_email='p03-2@test.invalid'");
            ScriptUtils.executeSqlScript(connection,script);
            connection.createStatement().execute("UPDATE temporary_residence_records SET note='KEEP-REVIEWED' WHERE tenant_profile_id=@demo_profile_id AND property_id=@property_id");
            ScriptUtils.executeSqlScript(connection,script);
            try(var statement=connection.createStatement();var result=statement.executeQuery("SELECT note FROM temporary_residence_records WHERE tenant_profile_id=@demo_profile_id AND property_id=@property_id")){assertThat(result.next()).isTrue();assertThat(result.getString(1)).isEqualTo("KEEP-REVIEWED");}
        }
        assertThat(d.f.db.sql("SELECT COUNT(*) FROM properties WHERE owner_id=1 AND name='Nhà trọ SmartHome Demo'").query(Long.class).single()).isEqualTo(1);
    }
}
