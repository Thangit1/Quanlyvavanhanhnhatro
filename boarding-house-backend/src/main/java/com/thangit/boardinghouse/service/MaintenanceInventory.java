package com.thangit.boardinghouse.service;

import com.thangit.boardinghouse.common.exception.AuthException;
import java.math.BigDecimal;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.support.GeneratedKeyHolder;

/** Called inside the task transaction, after locking its version. */
public final class MaintenanceInventory {
 private final JdbcClient db;
 public MaintenanceInventory(JdbcClient db){this.db=db;}
 public void use(long task,Long material,String name,BigDecimal quantity,String unit,BigDecimal price,long actor,Long item){
  if(quantity==null||quantity.signum()<=0||quantity.stripTrailingZeros().scale()>2||price==null||price.signum()<0)throw fail("MATERIAL_QUANTITY_INVALID");
  if(material!=null){
   var stock=db.sql("SELECT mm.* FROM maintenance_materials mm JOIN maintenance_requests m ON m.property_id=mm.property_id WHERE mm.id=:material AND m.id=:task AND mm.status='ACTIVE' FOR UPDATE").param("material",material).param("task",task).query().listOfRows();
   if(stock.isEmpty())throw fail("MATERIAL_SCOPE_INVALID");
   var row=stock.getFirst();if(((BigDecimal)row.get("stock_quantity")).compareTo(quantity)<0)throw fail("MATERIAL_STOCK_INSUFFICIENT");
   // Stock catalog is authoritative for recorded issue prices and units.
   price=(BigDecimal)row.get("unit_price");name=row.get("name").toString();unit=row.get("unit").toString();
   db.sql("UPDATE maintenance_materials SET stock_quantity=stock_quantity-:quantity WHERE id=:id").param("quantity",quantity).param("id",material).update();
  }
  var keys=new GeneratedKeyHolder();
  db.sql("INSERT INTO maintenance_material_usages(maintenance_request_id,material_id,material_name,quantity,unit,unit_price,amount,created_by,request_item_id) VALUES(:task,:material,:name,:quantity,:unit,:price,:amount,:actor,:item)").param("task",task).param("material",material).param("name",name).param("quantity",quantity).param("unit",unit).param("price",price).param("amount",quantity.multiply(price)).param("actor",actor).param("item",item).update(keys,"id");
  if(material!=null)db.sql("INSERT INTO maintenance_stock_movements(material_id,request_id,usage_id,quantity_delta,reason,performed_by) VALUES(:material,:task,:usage,:delta,'Xuất dùng cho công việc',:actor)").param("material",material).param("task",task).param("usage",keys.getKey()).param("delta",quantity.negate()).param("actor",actor).update();
  db.sql("UPDATE maintenance_requests SET actual_cost=actual_cost+:amount WHERE id=:id").param("amount",quantity.multiply(price)).param("id",task).update();
 }
 public static AuthException fail(String code){return new AuthException(HttpStatus.CONFLICT,code,"Vật tư không thuộc nhà trọ, không đủ tồn hoặc đã được ghi nhận. Vui lòng tải lại công việc.");}
}
