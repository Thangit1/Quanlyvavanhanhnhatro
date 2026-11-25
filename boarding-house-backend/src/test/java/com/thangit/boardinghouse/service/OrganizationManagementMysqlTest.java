package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.security.*;
import com.thangit.boardinghouse.service.OrganizationManagementService.*;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Creates its own random schema on the explicitly selected localhost test server. */
@EnabledIfSystemProperty(named="organization.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class OrganizationManagementMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    final AuthenticatedUser other=new AuthenticatedUser(4L,"other@test.invalid",RoleCode.OWNER);
    final AuthenticatedUser manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
    OrganizationManagementService service;
    long beforeProperties,beforeContracts;
    @BeforeAll void setup() throws Exception {
        f.setup("organization_test_","31");
        beforeProperties=count("properties");beforeContracts=count("contracts");
        Flyway.configure().dataSource(f.dataSource).load().migrate();
        assertThat(count("properties")).isEqualTo(beforeProperties);
        assertThat(count("contracts")).isEqualTo(beforeContracts);
        assertThat(count("organizations")).isZero();
        assertThat(count("organization_property_relationships")).isZero();
        service=new OrganizationManagementService(f.db,new SecurityAudit(f.db));
    }
    long count(String table){return f.db.sql("SELECT COUNT(*) FROM "+table).query(Long.class).single();}
    long organization(AuthenticatedUser actor){return f.inTx(()->service.create(actor,new SaveOrganization(f.key(),"Company",null)));}
    long property(AuthenticatedUser actor){return f.insert("INSERT INTO properties(owner_id,code,name,address) VALUES("+actor.id()+",'"+f.key().substring(0,20)+"','Property','Test')");}
    long area(long org){return f.inTx(()->service.createArea(f.owner,org,new SaveArea(f.key(),"Area",null,"ACTIVE",0L,"Test setup")));}
    long link(long org,long property,Long area){return f.inTx(()->service.link(f.owner,org,new LinkProperty(property,area,"Test agreement",LocalDate.now(),"Explicit link")));}
    void denied(Runnable action){assertThatThrownBy(action::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(403));}
    void conflict(Runnable action){assertThatThrownBy(action::run).isInstanceOfSatisfying(AuthException.class,e->assertThat(e.status().value()).isEqualTo(409));}

    @Test void companyHasMultipleAreasAndPropertiesWithOptionalArea(){
        long org=organization(f.owner),a=area(org),b=area(org);
        long p1=property(f.owner),p2=property(f.owner),p3=property(f.owner);
        link(org,p1,a);link(org,p2,a);link(org,p3,null);
        var detail=service.detail(f.owner,org);
        assertThat((List<?>)detail.get("areas")).hasSize(2);
        assertThat((List<?>)detail.get("relationships")).hasSize(3);
        assertThat(f.db.sql("SELECT COUNT(*) FROM organization_members WHERE organization_id=:org AND user_id=1 AND member_role='ADMIN'").param("org",org).query(Long.class).single()).isEqualTo(1);
        assertThat(f.db.sql("SELECT organization_id FROM management_areas WHERE id=:id").param("id",b).query(Long.class).single()).isEqualTo(org);
    }
    @Test void foreignCompanyAreaAndPropertyCannotBeUsed(){
        long org=organization(f.owner),foreignOrg=organization(other),own=property(f.owner),foreign=property(other);
        long foreignArea=f.inTx(()->service.createArea(other,foreignOrg,new SaveArea("B","B",null,"ACTIVE",0L,"Test")));
        denied(()->service.detail(other,org));denied(()->service.history(other,org,0));
        denied(()->f.run(()->service.link(f.owner,org,new LinkProperty(foreign,null,"Test",LocalDate.now(),"Foreign asset"))));
        denied(()->link(org,own,foreignArea));
        denied(()->f.run(()->service.createArea(f.owner,foreignOrg,new SaveArea("X","X",null,"ACTIVE",0L,"Foreign company"))));
        assertThat(service.organizations(other)).allSatisfy(row->assertThat(((Number)row.get("id")).longValue()).isNotEqualTo(org));
    }
    @Test void moveDoesNotGrantOrRevokeManagersAndPreservesRoomsContractsAndOwner(){
        long org=organization(f.owner),a=area(org),b=area(org),p=property(f.owner);
        f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:p,2),(:p,6)").param("p",p).update();
        long room=f.insert("INSERT INTO rooms(property_id,code,monthly_rent) VALUES("+p+",'R',1000)");
        long contract=f.insert("INSERT INTO contracts(room_id,tenant_id,code,start_date,end_date) VALUES("+room+",5,'"+f.key()+"',CURRENT_DATE,DATE_ADD(CURRENT_DATE,INTERVAL 1 YEAR))");
        long id=link(org,p,a);
        f.run(()->service.move(f.owner,org,id,new MoveArea(b,0L,"Move to B")));
        var properties=new AdminPropertyRepository(f.db);
        assertThat(properties.canAccess(2,RoleCode.MANAGER,p)).isTrue();
        assertThat(properties.canAccess(6,RoleCode.MANAGER,p)).isTrue();
        assertThat(properties.canAccess(3,RoleCode.MANAGER,p)).isFalse();
        assertThat(f.db.sql("SELECT owner_id FROM properties WHERE id=:id").param("id",p).query(Long.class).single()).isEqualTo(1);
        assertThat(f.db.sql("SELECT room_id FROM contracts WHERE id=:id").param("id",contract).query(Long.class).single()).isEqualTo(room);
        assertThat(f.db.sql("SELECT COUNT(*) FROM manager_property_capabilities WHERE property_id=:id").param("id",p).query(Long.class).single()).isZero();
        conflict(()->f.run(()->service.move(f.owner,org,id,new MoveArea(a,0L,"Stale version"))));
        f.run(()->service.move(f.owner,org,id,new MoveArea(null,1L,"Manage directly")));
        assertThat(service.history(f.owner,org,0)).anySatisfy(row->assertThat(row.get("action")).isEqualTo("PROPERTY_AREA_CHANGED"));
    }
    @Test void endedRelationshipRemainsAndCannotBeEditedOrOverlapAnotherPeriod(){
        long org=organization(f.owner),p=property(f.owner),id=link(org,p,null);
        conflict(()->link(org,p,null));
        f.run(()->service.end(f.owner,org,id,new EndRelationship(0L,"End management grouping")));
        assertThat(f.db.sql("SELECT ended_at FROM organization_property_relationships WHERE id=:id").param("id",id).query().singleRow().get("ended_at")).isNotNull();
        conflict(()->f.run(()->service.move(f.owner,org,id,new MoveArea(null,1L,"Ended period"))));
        conflict(()->f.run(()->service.end(f.owner,org,id,new EndRelationship(1L,"Already ended"))));
        conflict(()->link(org,p,null));
        assertThat((List<?>)service.detail(f.owner,org).get("relationships")).hasSize(1);
    }
    @Test void inactiveAreaAndDuplicateCodesAreRejected(){
        long org=organization(f.owner),a=area(org),p=property(f.owner);link(org,p,a);
        conflict(()->f.run(()->service.updateArea(f.owner,org,a,new SaveArea("A","A",null,"INACTIVE",0L,"Still has property"))));
        f.run(()->service.updateArea(f.owner,org,a,new SaveArea("A","Renamed",null,"ACTIVE",0L,"Rename area")));
        conflict(()->f.run(()->service.updateArea(f.owner,org,a,new SaveArea("A","Stale",null,"ACTIVE",0L,"Stale update"))));
        conflict(()->f.run(()->service.createArea(f.owner,org,new SaveArea("A","Duplicate",null,"ACTIVE",0L,"Duplicate code"))));
        long b=f.inTx(()->service.createArea(f.owner,org,new SaveArea("B","Inactive",null,"INACTIVE",0L,"Inactive area")));
        denied(()->link(org,property(f.owner),b));
    }
    @Test void concurrentUpdatesHaveOneWinner() throws Exception {
        long org=organization(f.owner),a=area(org),b=area(org),id=link(org,property(f.owner),null);
        var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)) {
            List<Future<Boolean>> futures=new ArrayList<>();
            for(long target:List.of(a,b))futures.add(pool.submit(()->{gate.await();try{f.run(()->service.move(f.owner,org,id,new MoveArea(target,0L,"Concurrent move")));return true;}catch(AuthException e){assertThat(e.status().value()).isEqualTo(409);return false;}}));
            gate.countDown();int success=0;for(var result:futures)if(result.get(30,TimeUnit.SECONDS))success++;
            assertThat(success).isEqualTo(1);
        }
    }
    @Test void rollbackDoesNotLeavePartialOrganizationOrAudit(){
        long before=count("organizations"),audit=count("security_audit_logs");
        assertThatThrownBy(()->f.run(()->{service.create(f.owner,new SaveOrganization(f.key(),"Rollback",null));throw new IllegalStateException("Rollback test");})).isInstanceOf(IllegalStateException.class);
        assertThat(count("organizations")).isEqualTo(before);assertThat(count("security_audit_logs")).isEqualTo(audit);
    }
    @Test void managerTenantAndOtherRolesCannotAdministerOrganizations(){
        for(RoleCode role:RoleCode.values())if(role!=RoleCode.OWNER){
            var actor=new AuthenticatedUser(2L,"test@test.invalid",role);
            denied(()->service.organizations(actor));denied(()->service.create(actor,new SaveOrganization("X","X",null)));
        }
        denied(()->service.organizations(null));
    }
}
