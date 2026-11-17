package com.thangit.boardinghouse.service;

import static org.assertj.core.api.Assertions.*;
import com.thangit.boardinghouse.common.exception.AuthException;
import com.thangit.boardinghouse.dto.request.lifecycle.RentalLifecycleRequests.*;
import com.thangit.boardinghouse.dto.request.invoice.AdminInvoiceRequests.*;
import com.thangit.boardinghouse.repository.AdminInvoiceRepository;
import com.thangit.boardinghouse.service.DirectContractService.Request;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.concurrent.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named="services.mysql",matches="true")
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class PropertyServiceCatalogMysqlTest {
    final DirectContractMysqlTest d=new DirectContractMysqlTest();
    PropertyServiceCatalogService catalog;
    @BeforeAll void setup()throws Exception{d.setup();catalog=new PropertyServiceCatalogService(d.f.db);}
    AgreedService item(String code,String method,String price,String quantity,Long source){return new AgreedService(code,code,"".equals(method)?"FIXED":method,new BigDecimal(price),source,"Mô tả tiếng Việt\nĐoạn thứ hai","đơn vị",new BigDecimal(quantity),method.equals("ONCE")?"ONCE":method.equals("USAGE")?"ON_USAGE":"MONTHLY",null,null,"ACTIVE","Ghi chú\nDòng hai",false);}
    PropertyServiceCatalogService.Save config(AgreedService s,long version){return new PropertyServiceCatalogService.Save(s,"OTHER",true,false,version,"Cấu hình đã được chủ nhà duyệt");}
    long save(long property,AgreedService s){return d.f.inTx(()->catalog.save(d.f.owner,property,null,config(s,0)));}
    CreateContract terms(List<AgreedService> services){var t=d.terms();return new CreateContract(t.startDate(),t.endDate(),t.depositAmount(),t.paymentDueDay(),t.noticePeriodDays(),BigDecimal.ZERO,new BigDecimal("1000"),t.utilityRates(),services,t.terms(),true);}
    long create(DirectContractMysqlTest.Case a,List<AgreedService> services,boolean submit){return d.f.inTx(()->d.service.create(d.f.owner,d.f.key(),new Request(a.room(),a.profile(),null,terms(services),LocalDate.now(),"Service agreement",submit))).id();}
    @Test @SuppressWarnings("unchecked") void multipleServicesSurviveDraftAndCatalogPriceChanges(){var a=d.fixture();long source=save(a.property(),item("WIFI","FIXED","50","1",null));
        var services=List.of(item("WIFI","FIXED","50","1",source),item("PARK","QUANTITY","20","2",null),item("WASH","USAGE","10","1",null),item("CARD","ONCE","30","2",null),item("FREE","FIXED","0","1",null));
        long c=create(a,services,false);
        var draft=d.service.draft(d.manager,c);var request=(Request)draft.get("request");
        assertThat(request.terms().services()).hasSize(5);assertThat(request.terms().services().getFirst().description()).isEqualTo("Mô tả tiếng Việt\nĐoạn thứ hai");
        d.f.run(()->catalog.save(d.f.owner,a.property(),source,config(item("WIFI","FIXED","999","1",null),0)));
        assertThat(d.f.db.sql("SELECT unit_price FROM contract_services WHERE contract_id=:id AND code='WIFI'").param("id",c).query(BigDecimal.class).single()).isEqualByComparingTo("50");
        d.f.run(()->d.service.updateDraft(d.f.owner,c,((Number)draft.get("version")).longValue(),request));
        assertThat(((Request)d.service.draft(d.f.owner,c).get("request")).terms().services().getFirst().unitPrice()).isEqualByComparingTo("50");
        assertThat(catalog.estimate(c).get("recurringEstimate")).isEqualTo(new BigDecimal("90.00"));
        assertThat(catalog.estimate(c).get("onceEstimate")).isEqualTo(new BigDecimal("60.00"));
    }
    @Test void invalidScopePriceDuplicatesAndQuantityRollback(){var a=d.fixture();var b=d.fixture();long source=save(a.property(),item("WIFI","FIXED","50","1",null));
        assertThatThrownBy(()->create(b,List.of(item("WIFI","FIXED","50","1",source)),false)).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->create(a,List.of(item("WIFI","FIXED","1","1",source)),false)).isInstanceOf(AuthException.class);
        var row=item("PARK","QUANTITY","20","2",null);
        assertThatThrownBy(()->create(a,List.of(row,row),false)).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->create(a,List.of(item("BAD","QUANTITY","20","-1",null)),false)).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->catalog.list(d.f.tenant,a.property())).isInstanceOf(AuthException.class);
        assertThatThrownBy(()->d.f.run(()->catalog.save(d.manager,a.property(),null,config(row,0)))).isInstanceOf(AuthException.class);
        assertThat(d.f.db.sql("SELECT COUNT(*) FROM contracts WHERE room_id=:id").param("id",a.room()).query(Long.class).single()).isZero();
    }
    SaveInvoice invoice(long c,long room,LocalDate period){return new SaveInvoice(room,c,period.toString().substring(0,7),period,period.plusMonths(1).minusDays(1),LocalDate.now(),LocalDate.now().plusDays(5),List.of(),BigDecimal.ZERO,false,null,"SAVE_DRAFT",null);}
    @Test void feesUseAgreementUsageEvidenceAndOncePeriodWithoutPayments(){var a=d.fixture();long c=create(a,List.of(item("NET","FIXED","50","1",null),item("PARK","QUANTITY","20","2",null),item("WASH","USAGE","10","1",null),item("CARD","ONCE","30","2",null)),true);
        var billing=new MonthlyBillingService(d.f.db);var repo=new AdminInvoiceRepository(d.f.db);var period=LocalDate.now().withDayOfMonth(1);
        var first=d.f.inTx(()->repo.calculate(invoice(c,a.room(),period),repo.contractForRoom(a.room(),c).orElseThrow()));
        assertThat(first.items().stream().filter(i->i.type().equals("SERVICE")).map(MonthlyBillingService.Charge::amount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("150");
        long usage=d.f.db.sql("SELECT id FROM contract_services WHERE contract_id=:id AND code='WASH'").param("id",c).query(Long.class).single();
        d.f.run(()->billing.usage(d.f.owner,c,usage,new MonthlyBillingService.Usage(period,new BigDecimal("3"),"Phiếu giặt thực tế 3 lượt")));
        var used=d.f.inTx(()->repo.calculate(invoice(c,a.room(),period),repo.contractForRoom(a.room(),c).orElseThrow()));
        assertThat(used.items().stream().filter(i->i.type().equals("SERVICE")).map(MonthlyBillingService.Charge::amount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("180");
        assertThat(d.f.db.sql("SELECT COUNT(*) FROM payments p JOIN invoices i ON i.id=p.invoice_id WHERE i.contract_id=:id").param("id",c).query(Long.class).single()).isZero();
        assertThatThrownBy(()->d.f.run(()->billing.usage(d.f.owner,c,usage,new MonthlyBillingService.Usage(period,BigDecimal.ONE,"Duplicate")))).isInstanceOf(org.springframework.dao.DuplicateKeyException.class);
        // Advance the contract's synthetic fixture into its second billing month.
        d.f.db.sql("UPDATE contracts SET start_date=:date,status='ACTIVE' WHERE id=:id").param("date",period.minusMonths(1)).param("id",c).update();
        d.f.db.sql("UPDATE contract_services SET effective_date=:date WHERE contract_id=:id").param("date",period.minusMonths(1)).param("id",c).update();
        var later=d.f.inTx(()->repo.calculate(invoice(c,a.room(),period),repo.contractForRoom(a.room(),c).orElseThrow()));
        assertThat(later.items().stream().filter(i->i.type().equals("SERVICE")).map(MonthlyBillingService.Charge::amount).reduce(BigDecimal.ZERO,BigDecimal::add)).isEqualByComparingTo("120");
        var invoices=new com.thangit.boardinghouse.service.impl.AdminInvoiceServiceImpl(repo);
        d.f.run(()->invoices.create(d.f.owner,invoice(c,a.room(),period)));
        assertThatThrownBy(()->d.f.run(()->invoices.create(d.f.owner,invoice(c,a.room(),period)))).isInstanceOf(AuthException.class);
    }
    @Test void concurrentCatalogUpdatesHaveOneWinner()throws Exception{var a=d.fixture();long source=save(a.property(),item("WIFI","FIXED","50","1",null));var pool=Executors.newFixedThreadPool(2);var gate=new CountDownLatch(1);
        try{Callable<Boolean> task=()->{gate.await();try{d.f.run(()->catalog.save(d.f.owner,a.property(),source,config(item("WIFI","FIXED","60","1",null),0)));return true;}catch(AuthException e){return false;}};var x=pool.submit(task);var y=pool.submit(task);gate.countDown();assertThat(List.of(x.get(20,TimeUnit.SECONDS),y.get(20,TimeUnit.SECONDS))).containsExactlyInAnyOrder(true,false);}finally{pool.shutdownNow();}
    }
    @Test void personFeesUseActualResidentsAndIgnoreInactiveOrFutureRules(){var a=d.fixture();var off=item("OFF","FIXED","999","1",null);var future=item("FUTURE","ONCE","999","1",null);
        off=new AgreedService(off.code(),off.name(),off.calculationMethod(),off.unitPrice(),null,off.description(),off.unit(),off.quantity(),off.billingCycle(),null,null,"INACTIVE",off.note(),false);
        future=new AgreedService(future.code(),future.name(),future.calculationMethod(),future.unitPrice(),null,future.description(),future.unit(),future.quantity(),future.billingCycle(),LocalDate.now().withDayOfMonth(1).plusMonths(1),null,"ACTIVE",future.note(),false);
        long c=create(a,List.of(item("PEOPLE","PER_PERSON","10","99",null),off,future,item("FREE","FIXED","0","1",null)),true);
        d.f.db.sql("UPDATE contracts SET status='ACTIVE' WHERE id=:id").param("id",c).update();
        d.f.db.sql("UPDATE tenant_residences SET contract_id=:c,room_id=:room WHERE tenant_profile_id=:profile").param("c",c).param("room",a.room()).param("profile",a.profile()).update();
        long person=d.f.insert("INSERT INTO tenant_profiles(tenant_code,full_name,phone) VALUES('"+d.f.key().substring(0,20)+"','Actual roommate','0900000001')");
        d.f.db.sql("INSERT INTO tenant_residences(tenant_profile_id,property_id,room_id,contract_id,status,move_in_date) VALUES(:person,:property,:room,:contract,'ACTIVE',CURRENT_DATE)").param("person",person).param("property",a.property()).param("room",a.room()).param("contract",c).update();
        var repo=new AdminInvoiceRepository(d.f.db);var plan=d.f.inTx(()->repo.calculate(invoice(c,a.room(),LocalDate.now().withDayOfMonth(1)),repo.contractForRoom(a.room(),c).orElseThrow()));
        var fees=plan.items().stream().filter(i->i.type().equals("SERVICE")).toList();
        assertThat(fees).extracting(MonthlyBillingService.Charge::name).containsExactly("PEOPLE","FREE");
        assertThat(fees.getFirst().amount()).isEqualByComparingTo("20");
        assertThat(fees.getLast().amount()).isZero();
        assertThatThrownBy(()->d.f.run(()->new MonthlyBillingService(d.f.db).stop(d.f.owner,c,d.f.db.sql("SELECT id FROM contract_services WHERE contract_id=:id AND code='PEOPLE'").param("id",c).query(Long.class).single(),new MonthlyBillingService.ServiceStop(LocalDate.now().plusDays(1),"Unconfirmed alteration")))).isInstanceOf(AuthException.class);
    }
    @Test void omittedServicesDoNotEraseDraftSnapshot(){var a=d.fixture();long c=create(a,List.of(item("NET","FIXED","50","1",null)),false);
        var draft=d.service.draft(d.f.owner,c);var original=(Request)draft.get("request");var t=original.terms();
        var omitted=new CreateContract(t.startDate(),t.endDate(),t.depositAmount(),t.paymentDueDay(),t.noticePeriodDays(),t.reservationTransferAmount(),t.monthlyRent(),t.utilityRates(),null,t.terms(),t.initialPaymentRequired());
        d.f.run(()->d.service.updateDraft(d.f.owner,c,((Number)draft.get("version")).longValue(),new Request(original.roomId(),original.tenantProfileId(),null,omitted,original.expectedCheckinDate(),original.note(),false)));
        assertThat(((Request)d.service.draft(d.f.owner,c).get("request")).terms().services()).hasSize(1);
    }
    @Test @SuppressWarnings("unchecked") void editingServicesInvalidatesBothConfirmationsButNotOtherContracts(){var a=d.fixture();var services=List.of(item("NET","FIXED","50","1",null));long c=create(a,services,true);
        var detail=d.f.onboarding.detail(d.f.owner,c);var v=(Map<String,Object>)detail.get("contractVersion");var r=new ContractOnboardingService.Confirmation(((Number)v.get("version")).longValue(),v.get("content_hash").toString());
        var tenant=new com.thangit.boardinghouse.security.AuthenticatedUser(a.user(),"test",com.thangit.boardinghouse.domain.auth.RoleCode.TENANT);
        d.f.run(()->d.f.onboarding.confirmContract(d.f.owner,c,r));d.f.run(()->d.f.onboarding.confirmContract(tenant,c,r));
        d.f.run(()->d.f.onboarding.changeTerms(d.f.owner,c,new ContractOnboardingService.TermsChange(terms(List.of(item("NET","FIXED","75","1",null))),"Thỏa thuận giá mới")));
        assertThat(d.f.onboarding.detail(tenant,c).get("contractConfirmed")).isEqualTo(false);
        assertThatThrownBy(()->d.f.run(()->d.f.onboarding.confirmContract(tenant,c,r))).isInstanceOf(AuthException.class);
    }
}
