package com.thangit.boardinghouse.security;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.slf4j.MDC;
@Service
public class SecurityAudit {
 private final JdbcClient db;public SecurityAudit(JdbcClient db){this.db=db;}
 @Transactional public void record(Long actor,String action,String resource,Long id,String outcome,String reason){db.sql("INSERT INTO security_audit_logs(actor_id,action,resource_type,resource_id,outcome,reason,request_id) VALUES(:actor,:action,:resource,:id,:outcome,:reason,:request)").param("actor",actor).param("action",action).param("resource",resource).param("id",id).param("outcome",outcome).param("reason",reason).param("request",MDC.get("requestId")).update();}
}
