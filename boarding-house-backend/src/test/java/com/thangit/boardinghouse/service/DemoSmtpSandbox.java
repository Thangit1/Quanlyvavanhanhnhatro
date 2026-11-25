package com.thangit.boardinghouse.service;

import com.sun.net.httpserver.HttpServer;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import jakarta.mail.Session;
import jakarta.mail.internet.MimeMessage;

/** Loopback-only SMTP receiver. Captured .eml is evidence of SMTP acceptance, never delivery. */
final class DemoSmtpSandbox implements AutoCloseable {
    static final String RECIPIENTS="owner@test.invalid,manager@test.invalid,accountant@test.invalid,technician@test.invalid,"
        +"tenant-manual@test.invalid,tenant-a@test.invalid,tenant-b@test.invalid,tenant-c@test.invalid,"
        +"tenant-d@test.invalid,tenant-e@test.invalid,tenant-f@test.invalid,tenant-activation@test.invalid";
    private static final Set<String> ALLOWED=Set.of(RECIPIENTS.split(","));
    final ServerSocket smtp;
    final HttpServer inbox;
    final ExecutorService executor=Executors.newCachedThreadPool();
    final Path messages;
    DemoSmtpSandbox(Path directory)throws IOException{
        messages=directory.resolve("mail");Files.createDirectories(messages);
        smtp=new ServerSocket();smtp.bind(new InetSocketAddress("127.0.0.1",11025));
        inbox=HttpServer.create(new InetSocketAddress("127.0.0.1",18025),0);
        inbox.createContext("/",exchange->{
            StringBuilder text=new StringBuilder("Hộp thư SmartHome AI TEST — SMTP đã tiếp nhận\n\n");
            try(var files=Files.list(messages)){for(Path file:files.sorted().toList())text.append(readMessage(file)).append("\n\n");}
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
    static String readMessage(Path file)throws IOException{
        try(var input=Files.newInputStream(file)){
            var message=new MimeMessage(Session.getInstance(new Properties()),input);
            return "Người nhận: "+message.getHeader("X-Test-Recipient",", ")+"\nTiêu đề: "+message.getSubject()+"\n\n"+message.getContent();
        }catch(jakarta.mail.MessagingException invalid){return Files.readString(file);}
    }
    static boolean allowed(String email){return email!=null&&ALLOWED.contains(email);}
    @Override public void close()throws IOException{smtp.close();inbox.stop(0);executor.shutdownNow();}
}
