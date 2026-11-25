package com.thangit.boardinghouse.repository;
import org.springframework.jdbc.core.simple.JdbcClient;
public final class FinancialPeriodLocks {
 private FinancialPeriodLocks(){}
 public static void lock(JdbcClient db,long property){
  db.sql("INSERT INTO financial_property_locks(property_id) VALUES(:id) ON DUPLICATE KEY UPDATE property_id=VALUES(property_id)").param("id",property).update();
  db.sql("SELECT property_id FROM financial_property_locks WHERE property_id=:id FOR UPDATE").param("id",property).query(Long.class).single();
 }
}
