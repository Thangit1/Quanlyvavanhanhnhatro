package com.thangit.boardinghouse.service.integration;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** AES-256-GCM; key stays in server environment. AAD binds each credential to its owner/name. */
@Service
public class IntegrationVault {
    final JdbcClient db;final Environment environment;final byte[] key;
    public IntegrationVault(JdbcClient db,Environment environment){this.db=db;this.environment=environment;String value=environment.getProperty("INTEGRATION_MASTER_KEY","");try{key=value.isBlank()?null:Base64.getDecoder().decode(value);}catch(IllegalArgumentException e){throw new IllegalStateException("INTEGRATION_MASTER_KEY must be base64");}if(key!=null&&key.length!=32)throw new IllegalStateException("INTEGRATION_MASTER_KEY must decode to 32 bytes");}
    public boolean writable(){return key!=null;}
    public boolean present(long owner,String kind,String name){if(kind.equals("PAYMENT"))return !environment.getProperty(envName(owner,kind,name),"").isBlank();return db.sql("SELECT COUNT(*) FROM integration_credentials WHERE owner_id=:owner AND kind=:kind AND secret_name=:name").param("owner",owner).param("kind",kind).param("name",name).query(Long.class).single()>0||!environment.getProperty(envName(owner,kind,name),"").isBlank();}
    public String encrypt(String context,String value){if(key==null)throw IntegrationCenter.invalid("SECRET_STORE_NOT_CONFIGURED");try{byte[] iv=new byte[12];new SecureRandom().nextBytes(iv);var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.ENCRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));byte[] ciphertext=cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));byte[] result=new byte[iv.length+ciphertext.length];System.arraycopy(iv,0,result,0,iv.length);System.arraycopy(ciphertext,0,result,iv.length,ciphertext.length);return Base64.getEncoder().encodeToString(result);}catch(Exception e){throw new IllegalStateException("Credential encryption failed");}}
    public String decrypt(String context,String value){if(key==null)throw IntegrationCenter.invalid("SECRET_STORE_NOT_CONFIGURED");try{byte[] encrypted=Base64.getDecoder().decode(value);var cipher=Cipher.getInstance("AES/GCM/NoPadding");cipher.init(Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,Arrays.copyOf(encrypted,12)));cipher.updateAAD(context.getBytes(StandardCharsets.UTF_8));return new String(cipher.doFinal(Arrays.copyOfRange(encrypted,12,encrypted.length)),StandardCharsets.UTF_8);}catch(Exception e){throw IntegrationCenter.invalid("CREDENTIAL_UNREADABLE");}}
    public String read(long owner,String kind,String name){if(kind.equals("PAYMENT"))return environment.getProperty(envName(owner,kind,name),"");String encrypted=db.sql("SELECT ciphertext FROM integration_credentials WHERE owner_id=:owner AND kind=:kind AND secret_name=:name").param("owner",owner).param("kind",kind).param("name",name).query(String.class).optional().orElse(null);return encrypted==null?environment.getProperty(envName(owner,kind,name),""):decrypt(owner+":"+kind+":"+name,encrypted);}
    public static String envName(long owner,String kind,String name){return "INTEGRATION_"+owner+"_"+kind+"_"+name.toUpperCase(Locale.ROOT).replaceAll("([a-z])([A-Z])","$1_$2");}
    public void write(long owner,String kind,String name,String value){if(value==null||value.isBlank())return;if(value.length()>12000)throw IntegrationCenter.invalid("CREDENTIAL_TOO_LONG");String encrypted=encrypt(owner+":"+kind+":"+name,value);db.sql("INSERT INTO integration_credentials(owner_id,kind,secret_name,ciphertext) VALUES(:owner,:kind,:name,:cipher) ON DUPLICATE KEY UPDATE ciphertext=:cipher,updated_at=CURRENT_TIMESTAMP(6)").param("owner",owner).param("kind",kind).param("name",name).param("cipher",encrypted).update();}
}
