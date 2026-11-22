package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.impl.AdminPropertyServiceImpl;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Creates and retains its own schema. Never opens or resets the application schema. */
@EnabledIfSystemProperty(named="rooms.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PropertyWorkspaceMysqlTest {
    DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    AdminPropertyRepository repo;
    AdminPropertyServiceImpl service;
    @BeforeAll void setup()throws Exception{
        f.setup("property_workspace_test_",null);
        repo=new AdminPropertyRepository(f.db);
        service=new AdminPropertyServiceImpl(repo,new RoomLifecycleGuard(f.db));
    }
    long property(){return f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES(1,'"+UUID.randomUUID().toString().substring(0,20)+"','Workspace test','Test address')");}
    SaveRoom room(long p,String code,Long building,Long floor){return new SaveRoom(p,building,floor,code,"Room "+code,null,null,new BigDecimal("18"),new BigDecimal("1200000"),BigDecimal.ZERO,2,null,List.of(),List.of(),null);}
    @Test void optionalHierarchyCreatesAndUpdatesPhysicalRoomWithoutInventingMeters(){
        long p=property();
        var created=f.inTx(()->service.createRoom(f.owner,room(p,"P101",null,null)));
        var detail=service.room(f.owner,created.id());
        assertThat(detail.room().buildingId()).isNull();assertThat(detail.room().floorId()).isNull();
        assertThat(detail.room().status()).isEqualTo("VACANT");assertThat(detail.meters()).isEmpty();assertThat(detail.assets()).isEmpty();
        var request=room(p,"P101",null,null);
        f.inTx(()->service.updateRoom(f.owner,created.id(),request));
        assertThat(service.room(f.owner,created.id()).room().roomCode()).isEqualTo("P101");
        assertThatThrownBy(()->f.inTx(()->service.createRoom(f.owner,request))).isInstanceOf(AuthException.class).extracting(e->((AuthException)e).code()).isEqualTo("ROOM_CODE_EXISTS");
        assertThatThrownBy(()->f.inTx(()->service.createRoom(f.owner,room(p,"P102",null,99999L)))).isInstanceOf(AuthException.class);
    }
    @Test void bulkIsAtomicOnDuplicateAndRecordsOneSuccessfulAudit(){
        long p=property();
        f.inTx(()->service.createRoom(f.owner,room(p,"P102",null,null)));
        var request=new BulkCreateRooms(p,null,null,"P",101,103,3,null,null,new BigDecimal("1500000"),BigDecimal.ZERO,2);
        assertThatThrownBy(()->f.inTx(()->service.bulkCreate(f.owner,request))).isInstanceOf(AuthException.class);
        assertThat(repo.roomCodeExists(p,"P101",null)).isFalse();assertThat(repo.roomCodeExists(p,"P103",null)).isFalse();
        assertThat(f.inTx(()->service.bulkCreate(f.owner,new BulkCreateRooms(p,null,null,"B",901,903,3,null,null,new BigDecimal("1500000"),BigDecimal.ZERO,2)))).hasSize(3);
        assertThat(f.db.sql("SELECT COUNT(*) FROM operational_activities WHERE property_id=:p AND activity_type='ROOMS_BULK_CREATED'").param("p",p).query(Long.class).single()).isEqualTo(1);
    }
    @Test void priceFiltersAndPermissionScopeApplyBeforePagination(){
        long p=property();f.inTx(()->service.createRoom(f.owner,room(p,"P101",null,null)));
        var result=service.listRooms(f.owner,p,null,null,null,null,0,20,new BigDecimal("1100000"),new BigDecimal("1300000"));
        assertThat(result.page().items()).hasSize(1);assertThat(result.page().totalElements()).isEqualTo(1);
        assertThat(service.listRooms(f.owner,p,null,null,null,null,0,20,new BigDecimal("1300001"),null).page().items()).isEmpty();
        assertThatThrownBy(()->service.listRooms(f.owner,p,null,null,null,null,0,20,new BigDecimal("9"),new BigDecimal("1"))).isInstanceOf(AuthException.class);
        var manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        assertThatThrownBy(()->service.listRooms(manager,p,null,null,null,null,0,20)).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->f.inTx(()->service.createRoom(f.accountant,room(p,"DENIED",null,null)))).isInstanceOf(AuthException.class);
        f.db.sql("INSERT INTO accountant_property_assignments(accountant_id,property_id,granted_by) VALUES(3,:p,1)").param("p",p).update();
        assertThat(service.listRooms(f.accountant,p,null,null,null,null,0,20).page().items()).hasSize(1);
        assertThat(service.room(f.accountant,result.page().items().getFirst().id()).canEdit()).isFalse();
        f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2)").param("p",p).update();
        assertThat(service.listRooms(manager,null,null,null,null,null,0,100).page().items()).allMatch(r->r.propertyId()==p);
        assertThat(service.options(manager).contexts()).extracting(c->c.propertyId()).containsExactly(p);
        assertThat(service.options(manager).contexts().getFirst().canReadFinance()).isFalse();
        assertThat(service.options(manager).contexts().getFirst().canExport()).isFalse();
        f.db.sql("INSERT INTO manager_property_capabilities(manager_id,property_id,capability,granted_by) VALUES(2,:p,'EXPORT',1)").param("p",p).update();
        assertThat(service.options(manager).contexts().getFirst().canExport()).isTrue();
    }
    @Test void overdueIsAnIndependentWarningAndReadinessStillUsesLifecycleGuard(){
        var booking=f.booking("0");long contract=f.contract(booking,"0");
        f.db.sql("UPDATE contracts SET status='ACTIVE' WHERE id=:id").param("id",contract).update();
        f.db.sql("UPDATE rooms SET status='OCCUPIED' WHERE id=:id").param("id",booking.room()).update();
        f.insert("INSERT INTO invoices(contract_id,property_id,room_id,tenant_id,code,billing_period,issue_date,due_date,status,total_amount,subtotal_amount,paid_amount,remaining_amount) VALUES("+contract+","+booking.property()+","+booking.room()+",5,'OVERDUE-WORKSPACE',CURRENT_DATE,CURRENT_DATE,DATE_SUB(CURRENT_DATE,INTERVAL 2 DAY),'ISSUED',1000,1000,0,1000)");
        var r=service.room(f.owner,booking.room()).room();
        assertThat(r.status()).isEqualTo("OCCUPIED");assertThat(r.overdueInvoiceCount()).isEqualTo(1);
        assertThatThrownBy(()->f.inTx(()->service.changeStatus(f.owner,r.id(),new ChangeStatus("VACANT","Cannot bypass checkout",r.version(),true)))).isInstanceOf(AuthException.class);
        long p=property();long vacant=f.inTx(()->service.createRoom(f.owner,room(p,"M1",null,null))).id();
        f.inTx(()->service.changeStatus(f.owner,vacant,new ChangeStatus("MAINTENANCE","Inspection",0L,false)));
        assertThatThrownBy(()->f.inTx(()->service.changeStatus(f.owner,vacant,new ChangeStatus("READY","No acceptance",1L,false)))).isInstanceOf(AuthException.class);
        assertThat(service.room(f.owner,vacant).room().status()).isEqualTo("MAINTENANCE");
    }
    @Test void directHttpRoomMutationIsForbiddenForAccountant()throws Exception{
        long p=property();
        var mvc=org.springframework.test.web.servlet.setup.MockMvcBuilders.standaloneSetup(new com.thangit.boardinghouse.controller.AdminPropertyController(service))
            .setControllerAdvice(new com.thangit.boardinghouse.common.exception.GlobalExceptionHandler())
            .setCustomArgumentResolvers(new org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver()).build();
        org.springframework.security.core.context.SecurityContextHolder.getContext().setAuthentication(new org.springframework.security.authentication.UsernamePasswordAuthenticationToken(f.accountant,"test-only",List.of()));
        try {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/rooms").contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .content("{\"propertyId\":"+p+",\"code\":\"FORBIDDEN\",\"name\":\"Denied\",\"monthlyRent\":1000,\"capacity\":1}"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
            assertThat(repo.roomCodeExists(p,"FORBIDDEN",null)).isFalse();
        }finally{org.springframework.security.core.context.SecurityContextHolder.clearContext();}
    }
    @Test void hierarchyAndIntermediateStatusesRemainDistinctInFilters(){
        long p=property();
        long building=f.insert("INSERT INTO buildings(property_id,code,name,display_order) VALUES("+p+",'A','Block A',1)");
        long floor=f.insert("INSERT INTO floors(building_id,code,name,display_order) VALUES("+building+",'F1','Floor 1',1)");
        long id=f.inTx(()->service.createRoom(f.owner,room(p,"A101",building,floor))).id();
        f.db.sql("UPDATE rooms SET status='CLEANING' WHERE id=:id").param("id",id).update();
        assertThat(service.listRooms(f.owner,p,building,floor,"CLEANING",null,0,20).page().items()).extracting(r->r.id()).containsExactly(id);
        assertThat(service.listRooms(f.owner,p,building,floor,"VACANT",null,0,20).page().items()).isEmpty();
        long other=property();
        assertThatThrownBy(()->f.inTx(()->service.createRoom(f.owner,room(other,"WRONG",building,floor)))).isInstanceOf(AuthException.class);
    }
}
