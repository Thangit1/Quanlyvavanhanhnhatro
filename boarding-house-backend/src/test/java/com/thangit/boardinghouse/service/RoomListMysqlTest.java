package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="rooms.mysql",matches="true")
class RoomListMysqlTest {
    @Test void roomListBindsFinanceScopeAndPreservesPropertyAccess() throws Exception {
        var f=new DepositLedgerMysqlTest();f.setup("room_list_test_",null);
        var repo=new AdminPropertyRepository(f.db);
        var booking=f.booking("0");long contract=f.contract(booking,"0");
        f.db.sql("UPDATE contracts SET status='ACTIVE' WHERE id=:id").param("id",contract).update();
        f.db.sql("INSERT INTO property_managers(property_id,manager_id) VALUES(:id,2)").param("id",booking.property()).update();
        long invoice=f.insert("INSERT INTO invoices(contract_id,property_id,room_id,tenant_id,code,billing_period,issue_date,due_date,status,total_amount,subtotal_amount,paid_amount,remaining_amount) VALUES("+contract+","+booking.property()+","+booking.room()+",5,'ROOM-DEBT',CURRENT_DATE,CURRENT_DATE,CURRENT_DATE,'ISSUED',1000,1000,0,1000)");
        assertThat(invoice).isPositive();
        var owner=repo.rooms(1,RoleCode.OWNER,booking.property(),null,null,null,null,0,20);
        assertThat(owner).hasSize(1);
        assertThat(owner.getFirst().outstandingDebt()).isEqualByComparingTo("1000");
        var manager=repo.rooms(2,RoleCode.MANAGER,null,null,null,null,null,0,20);
        assertThat(manager).extracting(r->r.id()).containsExactly(booking.room());
        assertThat(manager.getFirst().outstandingDebt()).isEqualByComparingTo("0");
        f.db.sql("INSERT INTO manager_property_capabilities(manager_id,property_id,capability,granted_by) VALUES(2,:id,'FINANCE_READ',1)").param("id",booking.property()).update();
        assertThat(repo.rooms(2,RoleCode.MANAGER,booking.property(),null,null,null,null,0,20).getFirst().outstandingDebt()).isEqualByComparingTo("1000");
        assertThat(repo.rooms(6,RoleCode.OWNER,null,null,null,null,null,0,20)).isEmpty();
        assertThat(repo.rooms(6,RoleCode.MANAGER,booking.property(),null,null,null,null,0,20)).isEmpty();
        assertThat(repo.rooms(1,RoleCode.OWNER,booking.property(),null,null,null,"no-matching-room",0,20)).isEmpty();
        assertThat(repo.rooms(1,RoleCode.OWNER,booking.property(),null,null,null,null,20,20)).isEmpty();
    }
}
