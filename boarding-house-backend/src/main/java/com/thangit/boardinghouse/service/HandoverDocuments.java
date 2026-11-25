package com.thangit.boardinghouse.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Immutable document payloads in the existing version content column; legacy text is read without rewriting it. */
final class HandoverDocuments {
    private final JdbcClient db;
    private final ObjectMapper json=new ObjectMapper();
    HandoverDocuments(JdbcClient db){this.db=db;}
    Map<String,Object> snapshot(Map<String,Object> c,Map<String,Object> ci,String condition,String note){
        var general=new LinkedHashMap<String,Object>();
        for(var entry:Map.of("contractId","id","contractCode","code","propertyName","property_name","roomCode","room_code","landlordName","landlord_name","tenantName","tenant_name").entrySet())general.put(entry.getKey(),c.get(entry.getValue()));
        general.put("roomId",c.get("room_id"));general.put("propertyId",c.get("property_id"));general.put("tenantId",c.get("tenant_id"));general.put("tenantProfileId",c.get("tenant_profile_id"));general.put("landlordId",c.get("landlord_user_id"));
        general.put("checkinId",ci.get("id"));general.put("scheduledDate",Objects.toString(ci.get("scheduled_date"),null));general.put("reference",ci.get("handover_reference"));general.put("roomCondition",condition);general.put("note",note);
        var readings=new LinkedHashMap<String,Object>();readings.put("ELECTRICITY",ci.get("electricity_reading"));readings.put("WATER",ci.get("water_reading"));
        var out=new LinkedHashMap<String,Object>();out.put("schemaVersion",2);out.put("general",general);out.put("readings",readings);out.put("keysCardsCount",ci.get("keys_cards_count"));
        out.put("assets",db.sql("SELECT room_asset_id,asset_name,quantity,condition_status,note FROM rental_checkin_assets WHERE checkin_id=:id ORDER BY room_asset_id,id").param("id",ci.get("id")).query().listOfRows());
        out.put("meters",db.sql("SELECT m.id,m.meter_type,m.meter_code,m.status,COALESCE((SELECT MAX(e.id) FROM utility_meter_events e WHERE e.meter_id=m.id),0) last_event_id FROM utility_meters m WHERE m.room_id=:id ORDER BY m.meter_type,m.id").param("id",c.get("room_id")).query().listOfRows());
        out.put("utilities",db.sql("SELECT code,name,calculation_method,unit FROM contract_utility_rates WHERE contract_id=:id ORDER BY code").param("id",c.get("id")).query().listOfRows());
        out.put("catalog",db.sql("SELECT id,name,quantity,condition_status,note FROM room_assets WHERE room_id=:id ORDER BY id").param("id",c.get("room_id")).query().listOfRows());
        return out;
    }
    String encode(Object value){try{return json.writeValueAsString(canonical(value));}catch(Exception e){throw new IllegalStateException("Cannot encode handover snapshot",e);}}
    private Object canonical(Object value){
        if(value instanceof Number n)return new BigDecimal(n.toString()).stripTrailingZeros().toPlainString();
        if(value instanceof Map<?,?> m){var sorted=new TreeMap<String,Object>();m.forEach((k,v)->sorted.put(k.toString(),canonical(v)));return sorted;}
        if(value instanceof List<?> list)return list.stream().map(this::canonical).toList();
        return value;
    }
    boolean structured(String content){return content.stripLeading().startsWith("{");}
    Map<String,Object> decode(String content){
        if(structured(content))try{return json.readValue(content,new TypeReference<LinkedHashMap<String,Object>>(){});}catch(Exception e){throw new IllegalStateException("Cannot read immutable handover snapshot",e);}
        return legacy(content);
    }
    @SuppressWarnings("unchecked") String extra(Map<String,Object> snapshot,String name){return Objects.toString(((Map<String,Object>)snapshot.get("general")).get(name),null);}
    List<Map<String,String>> changes(Map<String,Object> saved,Map<String,Object> current){
        var labels=new LinkedHashMap<String,String>();labels.put("meters","Công tơ hoặc lịch sử thay/reset công tơ");labels.put("readings","Chỉ số bàn giao");labels.put("assets","Nội dung kiểm kê tài sản");labels.put("catalog","Danh mục tài sản của phòng");labels.put("keysCardsCount","Số chìa khóa/thẻ");labels.put("general","Thông tin các bên, ngày hoặc thông tin bàn giao");labels.put("utilities","Chính sách tính điện nước");
        var result=new ArrayList<Map<String,String>>();labels.forEach((key,label)->{if(saved.containsKey(key)&&!encode(saved.get(key)).equals(encode(current.get(key))))result.add(Map.of("key",key,"label",label));});return result;
    }
    private Map<String,Object> legacy(String text){
        var header=new LinkedHashMap<String,Object>();var assets=new ArrayList<Map<String,Object>>();var meters=new ArrayList<Map<String,Object>>();
        List<Map<String,Object>> section=null;Map<String,Object> row=null;
        for(String line:text.split("\n")){
            if(line.equals("Tài sản")){section=assets;row=null;continue;}if(line.equals("Đồng hồ")){section=meters;row=null;continue;}
            int at=line.indexOf(": ");if(at<0)continue;String key=line.substring(0,at),value=unescape(line.substring(at+2));
            if(section==null)header.put(key,value.isEmpty()?null:value);
            else {if(row==null||row.containsKey(key)){row=new LinkedHashMap<>();section.add(row);}row.put(key,value.isEmpty()?null:value);}
        }
        var general=new LinkedHashMap<String,Object>();general.put("contractId",header.get("contract_id"));general.put("checkinId",header.get("id"));general.put("scheduledDate",header.get("scheduled_date"));general.put("reference",header.get("handover_reference"));
        var readings=new LinkedHashMap<String,Object>();readings.put("ELECTRICITY",header.get("electricity_reading"));readings.put("WATER",header.get("water_reading"));
        var out=new LinkedHashMap<String,Object>();out.put("schemaVersion",1);out.put("general",general);out.put("readings",readings);out.put("keysCardsCount",header.get("keys_cards_count"));out.put("assets",assets);out.put("meters",meters);out.put("utilities",List.of());return out;
    }
    private String unescape(String input){var out=new StringBuilder();for(int i=0;i<input.length();i++){char c=input.charAt(i);if(c=='\\'&&i+1<input.length()){char next=input.charAt(++i);out.append(next=='n'?'\n':next=='r'?'\r':next);}else out.append(c);}return out.toString();}
}
