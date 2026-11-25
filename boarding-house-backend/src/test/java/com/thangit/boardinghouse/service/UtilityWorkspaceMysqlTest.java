package com.thangit.boardinghouse.service;
import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.domain.auth.RoleCode;
import com.thangit.boardinghouse.security.AuthenticatedUser;
import com.thangit.boardinghouse.service.UtilityWorkspaceService.*;
import com.thangit.boardinghouse.service.MonthlyBillingService.Reading;
import java.math.BigDecimal;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="utilities.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class UtilityWorkspaceMysqlTest {
    final MonthlyBillingMysqlTest b=new MonthlyBillingMysqlTest();
    UtilityWorkspaceService service;
    jakarta.validation.ValidatorFactory validation;
    @BeforeAll void setup()throws Exception{
        b.setup();validation=jakarta.validation.Validation.buildDefaultValidatorFactory();
        // Explicit transaction boundaries reproduce the injected Spring billing proxy without an application context.
        var billing=new MonthlyBillingService(b.f.db){
            @Override public Map<String,Object> record(AuthenticatedUser p,long c,Reading r){return b.f.inTx(()->super.record(p,c,r));}
            @Override public Map<String,Object> detail(AuthenticatedUser p,long c,java.time.LocalDate period){return b.f.inTx(()->super.detail(p,c,period));}
        };
        service=new UtilityWorkspaceService(b.f.db,billing,validation.getValidator());
    }
    @AfterAll void close(){validation.close();}
    Reading reading(long version,String electricity,String water){return new Reading(b.period,version,new BigDecimal(electricity),new BigDecimal(water),"ACTUAL-PHOTO","Đối chiếu thực tế",true);}
    List<Map<String,Object>> save(Line... rows){return service.bulk(b.f.owner,new Bulk(List.of(rows)));}
    @SuppressWarnings("unchecked") List<Map<String,Object>> rows(long property){return (List<Map<String,Object>>)service.workspace(b.f.owner,property,b.period).get("rows");}
    @Test void obligationsExcludeVacantAndFixedFeeRooms(){
        var metered=b.active(true);var fixed=b.active(false);
        assertThat(rows(metered.property())).hasSize(1);assertThat(rows(fixed.property())).isEmpty();
        assertThat(b.count("utility_readings","contract_id="+metered.contract())).isZero();
    }
    @Test @SuppressWarnings("unchecked") void baselineAndEffectivePriceAreActualStoredValues(){
        var a=b.active(true);var row=rows(a.property()).getFirst();
        var detail=(Map<String,Object>)row.get("detail");var previous=(Map<String,Object>)detail.get("previous");
        assertThat(new BigDecimal(previous.get("ELECTRICITY").toString())).isEqualByComparingTo("1250");
        assertThat((List<Map<String,Object>>)row.get("policies")).anySatisfy(p->{assertThat(p.get("code")).isEqualTo("ELECTRICITY");assertThat(new BigDecimal(p.get("effectivePrice").toString())).isEqualByComparingTo("3500");});
    }
    @Test void partialSuccessCommitsValidRoomAndKeepsInvalidRoomUnchanged(){
        var a=b.active(true);var invalid=b.active(true);
        var result=save(new Line(a.contract(),reading(0,"1260","260")),new Line(invalid.contract(),reading(0,"-1","260")));
        assertThat(result.getFirst()).containsEntry("success",true);assertThat(result.get(1)).containsEntry("success",false).containsEntry("code","READING_INVALID");
        assertThat(b.count("utility_readings","contract_id="+a.contract())).isEqualTo(1);assertThat(b.count("utility_readings","contract_id="+invalid.contract())).isZero();
    }
    @Test void loweredReadingFailsWithoutChangingAnotherRow(){
        var a=b.active(true);var invalid=b.active(true);
        var result=save(new Line(invalid.contract(),reading(0,"1200","260")),new Line(a.contract(),reading(0,"1260","260")));
        assertThat(result.getFirst()).containsEntry("success",false).containsEntry("code","METER_READING_INVALID");assertThat(result.get(1)).containsEntry("success",true);
    }
    @Test void duplicateRowsAndRetryDoNotInsertTwice(){
        var a=b.active(true);var line=new Line(a.contract(),reading(0,"1260","260"));
        var result=save(line,line);assertThat(result.getFirst()).containsEntry("success",true);assertThat(result.get(1)).containsEntry("success",false).containsEntry("code","BULK_DUPLICATE_CONTRACT");
        assertThat(save(line).getFirst()).containsEntry("success",false).containsEntry("code","READING_VERSION_CONFLICT");
        assertThat(b.count("utility_readings","contract_id="+a.contract())).isOne();
    }
    @Test void excessivePrecisionAndMissingEvidenceFailPerRow(){
        var a=b.active(true);
        assertThat(save(new Line(a.contract(),reading(0,"1260.123","260"))).getFirst()).containsEntry("success",false).containsEntry("code","READING_INVALID");
        var r=new Reading(b.period,0L,new BigDecimal("1260"),new BigDecimal("260"),"","",false);
        assertThat(save(new Line(a.contract(),r)).getFirst()).containsEntry("success",false);
    }
    @Test void managerCannotReadOrWriteOutsideAssignedProperty(){
        var a=b.active(true);var manager=new AuthenticatedUser(2L,"manager@test.invalid",RoleCode.MANAGER);
        assertThatThrownBy(()->service.workspace(manager,a.property(),b.period)).isInstanceOf(AuthException.class);
        assertThat(service.bulk(manager,new Bulk(List.of(new Line(a.contract(),reading(0,"1260","260"))))).getFirst()).containsEntry("success",false);
        assertThat(b.count("utility_readings","contract_id="+a.contract())).isZero();
    }
    @Test void accountantReadsButCannotWrite(){
        var a=b.active(true);assertThat(service.workspace(b.f.accountant,a.property(),b.period)).containsEntry("canWrite",false);
        assertThatThrownBy(()->service.bulk(b.f.accountant,new Bulk(List.of(new Line(a.contract(),reading(0,"1260","260")))))).isInstanceOf(AuthException.class);
    }
    @Test void issuedInvoiceLocksSourceAndKeepsSnapshot(){
        var a=b.active(true);save(new Line(a.contract(),reading(0,"1260","260")));long invoice=b.invoice(a,"ISSUE");
        var before=b.row(invoice).get("calculation_snapshot");assertThat(rows(a.property()).getFirst()).containsEntry("locked",true).containsEntry("canWrite",false);
        assertThat(save(new Line(a.contract(),reading(1,"1270","270"))).getFirst()).containsEntry("success",false).containsEntry("code","BILLING_SOURCE_LOCKED");
        assertThat(b.row(invoice).get("calculation_snapshot")).isEqualTo(before);
    }
    @Test void concurrentWritersHaveExactlyOneSuccess()throws Exception{
        var a=b.active(true);var line=new Line(a.contract(),reading(0,"1260","260"));var gate=new CountDownLatch(1);
        try(var pool=Executors.newFixedThreadPool(2)){
            Callable<Boolean> task=()->{gate.await();return Boolean.TRUE.equals(save(line).getFirst().get("success"));};
            var first=pool.submit(task);var second=pool.submit(task);gate.countDown();
            assertThat(List.of(first.get(20,TimeUnit.SECONDS),second.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);
        }
        assertThat(b.count("utility_reading_revisions","reading_id IN (SELECT id FROM utility_readings WHERE contract_id="+a.contract()+")")).isOne();
    }
    @Test @SuppressWarnings("unchecked") void catalogChangeKeepsBeforeAfterEvidence(){
        var a=b.active(false);var catalog=new PropertyServiceCatalogService(b.f.db);
        var oldService=new com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.AgreedService("WIFI","Wi-Fi","FIXED",new BigDecimal("50000"));
        long id=b.f.inTx(()->catalog.save(b.f.owner,a.property(),null,new PropertyServiceCatalogService.Save(oldService,"OTHER",true,false,0L,"Initial agreed price")));
        var changed=new com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.AgreedService("WIFI","Wi-Fi","FIXED",new BigDecimal("60000"));
        b.f.run(()->catalog.save(b.f.owner,a.property(),id,new PropertyServiceCatalogService.Save(changed,"OTHER",true,false,0L,"New price for future agreements")));
        var history=(List<Map<String,Object>>)catalog.list(b.f.owner,a.property()).get("history");
        assertThat(history).hasSize(2);assertThat(history.getFirst().get("content").toString()).contains("50000","60000","before=","after=");
        assertThat(history.getFirst().get("actor_name")).isEqualTo("Test");
    }
    @Test void formulaPreviewUsesInvoiceEngineWithoutCreatingObligations(){
        var a=b.active(true);save(new Line(a.contract(),reading(0,"1260","260")));
        long invoices=b.count("invoices","contract_id="+a.contract());long revisions=b.count("utility_reading_revisions","reading_id IN (SELECT id FROM utility_readings WHERE contract_id="+a.contract()+")");
        var preview=b.f.inTx(()->b.billing.preview(b.f.accountant,a.contract(),b.period));
        assertThat(preview.items()).anySatisfy(item->{assertThat(item.type()).isEqualTo("ELECTRICITY");assertThat(item.amount()).isEqualByComparingTo("35000");});
        assertThat(preview.hash()).hasSize(64);assertThat(b.count("invoices","contract_id="+a.contract())).isEqualTo(invoices);
        assertThat(b.count("utility_reading_revisions","reading_id IN (SELECT id FROM utility_readings WHERE contract_id="+a.contract()+")")).isEqualTo(revisions);
        long invoice=b.invoice(a,"SAVE_DRAFT");assertThat(b.row(invoice).get("calculation_hash")).isEqualTo(preview.hash());
    }
    @Test void warningPolicyIsScopedVersionedAndUsedByBilling(){
        var a=b.active(true);save(new Line(a.contract(),reading(0,"1260","260")));
        var request=new WarningPolicy(a.property(),0,new BigDecimal("2"),false,"Reviewed property consumption policy");
        b.f.run(()->service.warningPolicy(b.f.owner,request));
        assertThatThrownBy(()->b.f.run(()->service.warningPolicy(b.f.owner,request))).isInstanceOf(AuthException.class);
        b.f.db.sql("UPDATE utility_readings SET billing_period=:p WHERE contract_id=:id").param("p",b.period.minusMonths(1)).param("id",a.contract()).update();
        b.f.db.sql("UPDATE contract_meter_baselines SET recorded_at=:at WHERE contract_id=:id").param("at",b.period.minusMonths(1).atStartOfDay()).param("id",a.contract()).update();
        // Preserve confirmed history and its actual end: 25 exceeds the new 2x threshold (previous use 10).
        var warning=new Reading(b.period,0L,new BigDecimal("1285"),new BigDecimal("270"),"PHOTO","Verify against changed threshold",false);
        assertThat(save(new Line(a.contract(),warning)).getFirst()).containsEntry("success",false).containsEntry("code","READING_WARNING_REVIEW");
        assertThatThrownBy(()->b.f.run(()->service.warningPolicy(b.f.accountant,new WarningPolicy(a.property(),1,new BigDecimal("3"),true,"No permission")))).isInstanceOf(AuthException.class);
    }
    @Test @SuppressWarnings("unchecked") void multipleMeterReplacementsSumAllSegments(){
        var a=b.active(true);
        b.f.run(()->b.billing.replace(b.f.owner,a.contract(),new MonthlyBillingService.Replacement(b.period,0L,"ELECTRICITY","FIRST-"+a.contract(),new BigDecimal("1300"),new BigDecimal("10"),"REPLACE-ONE","Physical meter replacement")));
        b.f.run(()->b.billing.replace(b.f.owner,a.contract(),new MonthlyBillingService.Replacement(b.period,0L,"ELECTRICITY","SECOND-"+a.contract(),new BigDecimal("50"),new BigDecimal("20"),"REPLACE-TWO","Second physical replacement")));
        var result=save(new Line(a.contract(),reading(0,"40","260"))).getFirst();assertThat(result).containsEntry("success",true);
        var reading=(Map<String,Object>)result.get("reading");assertThat(new BigDecimal(reading.get("electricity_consumption").toString())).isEqualByComparingTo("110");
        assertThat((List<?>)rows(a.property()).getFirst().get("replacements")).hasSize(2);
    }
    @Test @SuppressWarnings("unchecked") void missingPriorPeriodIsNotReplacedByZero(){
        var a=b.active(true);b.f.db.sql("UPDATE contract_meter_baselines SET recorded_at=:at WHERE contract_id=:id").param("at",b.period.minusMonths(1).atStartOfDay()).param("id",a.contract()).update();
        var detail=(Map<String,Object>)rows(a.property()).getFirst().get("detail");var previous=(Map<String,Object>)detail.get("previous");
        assertThat(previous.get("ELECTRICITY")).isInstanceOf(String.class);
        assertThat(save(new Line(a.contract(),reading(0,"1260","260"))).getFirst()).containsEntry("success",false).containsEntry("code","PREVIOUS_READING_REQUIRED");
    }
    @Test void databaseFailureRollsBackOnlyItsOwnContract(){
        var invalid=b.active(true);var valid=b.active(true);
        b.f.db.sql("CREATE TRIGGER utility_test_rollback BEFORE UPDATE ON utility_readings FOR EACH ROW BEGIN IF NEW.contract_id="+invalid.contract()+" THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Isolated rollback verification'; END IF; END").update();
        try{
            var result=save(new Line(invalid.contract(),reading(0,"1260","260")),new Line(valid.contract(),reading(0,"1260","260")));
            assertThat(result.getFirst()).containsEntry("success",false);assertThat(result.get(1)).containsEntry("success",true);
            assertThat(b.count("utility_readings","contract_id="+invalid.contract())).isZero();assertThat(b.count("utility_readings","contract_id="+valid.contract())).isOne();
        }finally{b.f.db.sql("DROP TRIGGER utility_test_rollback").update();}
    }
    @Test void endedContractHistoryIsReadableButCannotBecomeWritable(){
        var a=b.active(true);save(new Line(a.contract(),reading(0,"1260","260")));
        b.f.db.sql("UPDATE contracts SET status='TERMINATED' WHERE id=:id").param("id",a.contract()).update();
        assertThat(rows(a.property()).getFirst()).containsEntry("canWrite",false);
        assertThat(save(new Line(a.contract(),reading(1,"1270","270"))).getFirst()).containsEntry("success",false);
    }
}
