package com.thangit.boardinghouse.service;

import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.jdbc.core.simple.JdbcClient;

/** Loopback-only SMTP receiver. Captured .eml is evidence of SMTP acceptance, never delivery. */
final class DemoSmtpSandbox implements AutoCloseable {
    final ServerSocket smtp;
    final HttpServer inbox;
    final ExecutorService executor=Executors.newCachedThreadPool();
    final Path messages;
    DemoSmtpSandbox(Path directory)throws IOException{
        messages=directory.resolve("mail");Files.createDirectories(messages);
        smtp=new ServerSocket();smtp.bind(new InetSocketAddress("127.0.0.1",11025));
        inbox=HttpServer.create(new InetSocketAddress("127.0.0.1",18025),0);
        inbox.createContext("/",exchange->{
            StringBuilder text=new StringBuilder("SmartHome AI TEST SMTP inbox — ACCEPTED, not DELIVERED\n\n");
            try(var files=Files.list(messages)){for(Path file:files.sorted().toList())text.append(file.getFileName()).append('\n').append(Files.readString(file)).append("\n\n");}
            byte[] bytes=text.toString().getBytes(StandardCharsets.UTF_8);exchange.getResponseHeaders().set("Content-Type","text/plain; charset=utf-8");exchange.sendResponseHeaders(200,bytes.length);try(var out=exchange.getResponseBody()){out.write(bytes);}
        });inbox.setExecutor(executor);inbox.start();
        executor.submit(()->{while(!smtp.isClosed())try{Socket socket=smtp.accept();executor.submit(()->receive(socket));}catch(IOException e){if(!smtp.isClosed())throw new UncheckedIOException(e);}});
    }
    void receive(Socket socket){try(socket;var reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));var writer=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true)){
        socket.setSoTimeout(10000);writer.print("220 localhost TEST SMTP\r\n");writer.flush();String line,recipient=null;
        while((line=reader.readLine())!=null){String upper=line.toUpperCase(Locale.ROOT);
            if(upper.startsWith("EHLO")||upper.startsWith("HELO")||upper.startsWith("MAIL FROM:"))writer.print("250 OK\r\n");
            else if(upper.startsWith("RCPT TO:")){String address=line.substring(line.indexOf(':')+1).trim().replace("<","").replace(">","");if(!allowed(address)){writer.print("550 Recipient not allowed\r\n");recipient=null;}else{recipient=address;writer.print("250 OK\r\n");}}
            else if(upper.equals("DATA")){if(recipient==null){writer.print("503 Recipient required\r\n");writer.flush();continue;}writer.print("354 End with dot\r\n");writer.flush();StringBuilder message=new StringBuilder();while((line=reader.readLine())!=null&&!line.equals(".")){if(message.length()>100000)throw new IOException("Message too large");message.append(line.startsWith("..")?line.substring(1):line).append('\n');}if(line==null)throw new EOFException();String id=UUID.randomUUID().toString();Files.writeString(messages.resolve(id+".eml"),"X-Test-SMTP-Accepted: true\nX-Test-Recipient: "+recipient+"\n"+message);writer.print("250 ACCEPTED "+id+"\r\n");}
            else if(upper.equals("QUIT")){writer.print("221 Bye\r\n");writer.flush();break;}else writer.print("502 Unsupported\r\n");writer.flush();
        }
    }catch(IOException ignored){/* Failed SMTP transaction is not recorded as accepted. */}}
    static boolean allowed(String email){return email!=null&&email.matches("(?:owner|manager|accountant|technician|tenant-(?:manual|[a-f]))@test\\.invalid");}
    @Override public void close()throws IOException{smtp.close();inbox.stop(0);executor.shutdownNow();}
    static final class Sender implements CommunicationSender {
        final JdbcClient db;Sender(JdbcClient db){this.db=db;}
        public Result unavailableOrSend(String channel,String key,long recipient,String title,String body){
            if(!channel.equals("EMAIL"))return new Result("FAILED","TEST_CHANNEL_DISABLED",null,false);
            String address=db.sql("SELECT email FROM users WHERE id=:id").param("id",recipient).query(String.class).single();
            if(!allowed(address))return new Result("FAILED","TEST_RECIPIENT_BLOCKED",null,false);
            try(var socket=new Socket()){
                socket.connect(new InetSocketAddress("127.0.0.1",11025),3000);socket.setSoTimeout(5000);
                var reader=new BufferedReader(new InputStreamReader(socket.getInputStream(),StandardCharsets.UTF_8));var writer=new PrintWriter(new OutputStreamWriter(socket.getOutputStream(),StandardCharsets.UTF_8),true);
                expect(reader,220);command(writer,reader,"EHLO localhost",250);command(writer,reader,"MAIL FROM:<smarthome@test.invalid>",250);command(writer,reader,"RCPT TO:<"+address+">",250);command(writer,reader,"DATA",354);
                String subject="[SmartHome AI - TEST] "+title.replaceAll("[\\r\\n]"," ");
                writer.print("From: smarthome@test.invalid\r\nTo: "+address+"\r\nSubject: =?UTF-8?B?"+Base64.getEncoder().encodeToString(subject.getBytes(StandardCharsets.UTF_8))+"?=\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\nX-Test-Business-Key: "+key+"\r\n\r\n");
                for(String line:(body+"\n\nĐây là email thử nghiệm, không yêu cầu thanh toán tiền thật.").split("\\R",-1))writer.print((line.startsWith(".")?".":"")+line+"\r\n");writer.print(".\r\n");writer.flush();String accepted=expect(reader,250);command(writer,reader,"QUIT",221);
                return new Result("SENT","SMTP_ACCEPTED",accepted.substring(accepted.lastIndexOf(' ')+1),false);
            }catch(IOException e){return new Result("FAILED","TEST_SMTP_FAILED",null,true);}
        }
        static void command(PrintWriter writer,BufferedReader reader,String value,int code)throws IOException{writer.print(value+"\r\n");writer.flush();expect(reader,code);}
        static String expect(BufferedReader reader,int code)throws IOException{String line=reader.readLine();if(line==null||!line.startsWith(Integer.toString(code)))throw new IOException("Unexpected SMTP response");return line;}
    }
}
