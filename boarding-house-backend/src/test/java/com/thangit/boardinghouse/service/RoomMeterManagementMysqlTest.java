package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.request.property.AdminPropertyRequests.*;
import com.thangit.boardinghouse.repository.AdminPropertyRepository;
import com.thangit.boardinghouse.security.*;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="meters.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class RoomMeterManagementMysqlTest {
    final DepositLedgerMysqlTest f=new DepositLedgerMysqlTest();
    RoomMeterService meters;
    @BeforeAll void setup()throws Exception{f.setup("room_meters_test_",null);meters=new RoomMeterService(f.db,new RoomLifecycleGuard(f.db));}
    RoomMeterService.Install request(String type,String code,String reading){return new RoomMeterService.Install(type,code,new BigDecimal(reading),"Actual installation record","Initial physical installation");}
    long count(long room,String table){return f.db.sql("SELECT COUNT(*) FROM "+table+" WHERE room_id=:id").param("id",room).query(Long.class).single();}
    @Test void installsBothTypesReturnsHistoryAndDoesNotCreatePayments(){var b=f.booking("0");
        assertThat(meters.management(f.owner,b.room()).get("installableTypes")).isEqualTo(List.of("ELECTRICITY","WATER"));
        var e=request("ELECTRICITY",f.key(),"1250.25");var first=f.inTx(()->meters.install(f.owner,b.room(),e));
        var second=f.inTx(()->meters.install(f.owner,b.room(),e));assertThat(((Number)second.get("id")).longValue()).isEqualTo(((Number)first.get("id")).longValue());
        f.run(()->meters.install(f.owner,b.room(),request("WATER",f.key(),"50")));
        assertThat(count(b.room(),"utility_meters")).isEqualTo(2);
        var detail=meters.management(f.owner,b.room());assertThat(detail).containsEntry("canInstall",false);
        assertThat((List<?>)detail.get("events")).hasSize(2);
        assertThat(f.db.sql("SELECT COUNT(*) FROM utility_meters WHERE room_id=:id AND status='ACTIVE' AND reading_date=CURRENT_DATE").param("id",b.room()).query(Long.class).single()).isEqualTo(2);
        assertThat(f.db.sql("SELECT COUNT(*) FROM utility_meter_events e JOIN utility_meters m ON m.id=e.meter_id WHERE m.room_id=:id").param("id",b.room()).query(Long.class).single()).isEqualTo(2);
    }
    @Test void duplicateAndInactiveMetersCannotBeReinstalled(){var b=f.booking("0");String code=f.key();f.run(()->meters.install(f.owner,b.room(),request("ELECTRICITY",code,"10")));
        f.error("METER_ALREADY_INSTALLED",()->f.run(()->meters.install(f.owner,b.room(),request("ELECTRICITY",f.key(),"0"))));
        f.db.sql("UPDATE utility_meters SET status='INACTIVE' WHERE room_id=:id").param("id",b.room()).update();
        f.error("METER_ALREADY_INSTALLED",()->f.run(()->meters.install(f.owner,b.room(),request("ELECTRICITY",code,"10"))));
        assertThat(count(b.room(),"utility_meters")).isOne();
        var other=f.booking("0");f.error("METER_CODE_EXISTS",()->f.run(()->meters.install(f.owner,other.room(),request("WATER",code,"0"))));
        assertThat(count(other.room(),"utility_meters")).isZero();
    }
    @Test void occupiedAndActiveResidenceCannotUseInitialInstallation(){var b=f.booking("0");
        f.db.sql("UPDATE rooms SET status='OCCUPIED' WHERE id=:id").param("id",b.room()).update();
        f.error("METER_INITIAL_INSTALL_NOT_ALLOWED",()->f.run(()->meters.install(f.owner,b.room(),request("WATER",f.key(),"0"))));
        f.db.sql("UPDATE rooms SET status='VACANT' WHERE id=:id").param("id",b.room()).update();
        f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,residence_role,status,move_in_date) VALUES(:profile,:property,:room,'OCCUPANT','ACTIVE',CURRENT_DATE)").param("profile",b.profile()).param("property",b.property()).param("room",b.room()).update();
        assertThat(meters.management(f.owner,b.room())).containsEntry("canInstall",false);
        f.error("METER_INITIAL_INSTALL_NOT_ALLOWED",()->f.run(()->meters.install(f.owner,b.room(),request("WATER",f.key(),"0"))));
    }
    @Test void managerNeedsAssignmentAndApprovalAndTenantCannotInstall(){var b=f.booking("0");var m=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        assertThatThrownBy(()->f.run(()->meters.install(m,b.room(),request("WATER",f.key(),"1")))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        f.db.sql("INSERT IGNORE INTO user_roles(user_id,role_id) SELECT 2,id FROM roles WHERE code='MANAGER'").update();
        var permissions=new PropertyAuthorization(f.db,new SecurityAudit(f.db));
        f.run(()->permissions.assignManager(f.owner,b.property(),new PropertyAuthorization.ManagerAssignment(2L,Set.of(),"Operational access only")));
        assertThat(meters.management(m,b.room())).containsEntry("canInstall",false);
        f.error("PROPERTY_CAPABILITY_DENIED",()->f.run(()->meters.install(m,b.room(),request("WATER",f.key(),"1"))));
        f.run(()->permissions.assignManager(f.owner,b.property(),new PropertyAuthorization.ManagerAssignment(2L,Set.of(PropertyAuthorization.Capability.CONTRACT_APPROVE),"Approve physical meter installation")));
        f.run(()->meters.install(m,b.room(),request("WATER",f.key(),"1")));
        f.error("METER_ACCESS_DENIED",()->f.run(()->meters.install(f.tenant,b.room(),request("ELECTRICITY",f.key(),"0"))));
        assertThatThrownBy(()->meters.management(new AuthenticatedUser(6L,"other@test.invalid",RoleCode.OWNER),b.room())).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
    }
    @Test void actualMeterBaselineRequiresNewHandoverConfirmationAndFeedsBilling(){var b=f.booking("0");long contract=f.contract(b,"0");
        f.db.sql("UPDATE contract_utility_rates SET calculation_method='METER',unit_price=3000 WHERE contract_id=:id").param("id",contract).update();
        long ci=f.inTx(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(contract,b.booking(),LocalDate.now(),null,null)).id());
        f.error("ROOM_METER_REQUIRED",()->f.run(()->f.onboarding.saveHandover(f.owner,contract,new ContractOnboardingService.Handover(0L,LocalDate.now(),new BigDecimal("1250"),new BigDecimal("50"),1,"Actual handover"))));
        f.run(()->meters.install(f.owner,b.room(),request("ELECTRICITY",f.key(),"1250")));f.run(()->meters.install(f.owner,b.room(),request("WATER",f.key(),"50")));
        assertThat(f.db.sql("SELECT COUNT(*) FROM handover_versions WHERE checkin_id=:id").param("id",ci).query(Long.class).single()).isZero();
        assertThat(f.db.sql("SELECT electricity_reading FROM rental_checkins WHERE id=:id").param("id",ci).query(BigDecimal.class).optional()).isEmpty();
        f.ready(contract,ci,new BigDecimal("1250"),new BigDecimal("50"));
        f.run(()->f.lifecycle.completeCheckin(f.owner,ci,new CompleteCheckin(true,true,true,new BigDecimal("1250"),new BigDecimal("50"),1,"Actual handover",1L,true)));
        assertThat(f.db.sql("SELECT status FROM contracts WHERE id=:id").param("id",contract).query(String.class).single()).isEqualTo("ACTIVE");
        assertThat(f.db.sql("SELECT COUNT(*) FROM contract_meter_baselines WHERE contract_id=:id").param("id",contract).query(Long.class).single()).isEqualTo(2);
        f.db.sql("INSERT INTO utility_readings(contract_id,billing_period,electricity_previous,electricity_current,electricity_unit_price,electricity_amount,water_previous,water_current,water_unit_price,water_amount) VALUES(:id,:period,0,1300,999,999,0,60,999,999)").param("id",contract).param("period",LocalDate.now().withDayOfMonth(1)).update();
        var bill=f.inTx(()->new com.thangit.boardinghouse.repository.AdminInvoiceRepository(f.db).utility(contract,LocalDate.now().withDayOfMonth(1)).orElseThrow());
        assertThat(new BigDecimal(bill.get("electricity_amount").toString())).isEqualByComparingTo("150000");assertThat(new BigDecimal(bill.get("water_amount").toString())).isEqualByComparingTo("30000");
    }
    @Test void assetEditsRetainIdentifiersAndDoNotRewriteSnapshot(){var b=f.booking("0");var repo=new AdminPropertyRepository(f.db);
        long building=f.insert("INSERT INTO buildings(property_id,code,name) VALUES("+b.property()+",'B','Building')");long floor=f.insert("INSERT INTO floors(building_id,code,name,floor_number) VALUES("+building+",'F1','Floor',1)");
        long asset=f.insert("INSERT INTO room_assets(room_id,name,quantity,condition_status,note) VALUES("+b.room()+",'Desk',1,'GOOD','Original')");long contract=f.contract(b,"0");long ci=f.inTx(()->f.lifecycle.prepareCheckin(f.owner,new PrepareCheckin(contract,b.booking(),LocalDate.now(),null,null)).id());
        f.run(()->repo.updateRoom(b.room(),new SaveRoom(b.property(),building,floor,"T","Room",null,null,null,new BigDecimal("1000"),BigDecimal.ZERO,2,null,List.of(),List.of(new SaveAsset("Renamed desk",2,"FAIR","Actual condition",asset),new SaveAsset("Chair",1,"GOOD","New")),null)));
        assertThat(repo.roomAssets(b.room())).hasSize(2).anySatisfy(a->{assertThat(a.id()).isEqualTo(asset);assertThat(a.name()).isEqualTo("Renamed desk");assertThat(a.note()).isEqualTo("Actual condition");});
        var snapshot=f.db.sql("SELECT room_asset_id,asset_name,quantity FROM rental_checkin_assets WHERE checkin_id=:id").param("id",ci).query().singleRow();assertThat(((Number)snapshot.get("room_asset_id")).longValue()).isEqualTo(asset);assertThat(snapshot.get("asset_name")).isEqualTo("Desk");assertThat(((Number)snapshot.get("quantity")).intValue()).isEqualTo(1);
        assertThatThrownBy(()->f.run(()->repo.updateRoom(b.room(),new SaveRoom(b.property(),building,floor,"T","Room",null,null,null,new BigDecimal("1000"),BigDecimal.ZERO,2,null,List.of(),List.of(new SaveAsset("Foreign",1,"GOOD",null,999999L)),null)))).isInstanceOf(com.thangit.boardinghouse.common.exception.AuthException.class);
        assertThat(repo.roomAssets(b.room())).hasSize(2);
        f.run(()->repo.updateRoom(b.room(),new SaveRoom(b.property(),building,floor,"T","Room",null,null,null,new BigDecimal("1000"),BigDecimal.ZERO,2,null,List.of(),List.of(new SaveAsset("Renamed desk",2,"FAIR","Actual condition",asset)),null)));
        assertThat(repo.roomAssets(b.room())).hasSize(1);
        f.run(()->f.onboarding.refreshInventory(f.owner,contract));
        long version=f.db.sql("SELECT version FROM rental_checkins WHERE id=:id").param("id",ci).query(Long.class).single();
        f.run(()->f.onboarding.saveHandover(f.owner,contract,new ContractOnboardingService.Handover(version,LocalDate.now(),BigDecimal.ZERO,BigDecimal.ZERO,1,"Actual inventory proof")));
        f.error("ROOM_ASSET_IN_USE",()->f.run(()->repo.updateRoom(b.room(),new SaveRoom(b.property(),building,floor,"T","Room",null,null,null,new BigDecimal("1000"),BigDecimal.ZERO,2,null,List.of(),List.of(),null))));
        assertThat(repo.roomAssets(b.room())).hasSize(1);
    }
}
