package com.thangit.boardinghouse.security;
import jakarta.servlet.*;import jakarta.servlet.http.*;
import java.io.IOException;import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.core.annotation.Order;
import org.springframework.core.Ordered;
import org.springframework.web.filter.OncePerRequestFilter;
@Component @Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestPrivacyFilter extends OncePerRequestFilter {
 @Override protected void doFilterInternal(HttpServletRequest request,HttpServletResponse response,FilterChain chain)throws ServletException,IOException{
  String id=UUID.randomUUID().toString();MDC.put("requestId",id);response.setHeader("X-Request-ID",id);
  if(request.getRequestURI().startsWith("/api/")){response.setHeader("Cache-Control","no-store");response.setHeader("Pragma","no-cache");}
  try{chain.doFilter(request,response);}finally{MDC.remove("requestId");}
 }
}
