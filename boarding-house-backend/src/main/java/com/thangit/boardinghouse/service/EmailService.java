package com.thangit.boardinghouse.service;

import jakarta.mail.internet.InternetAddress;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.mail.MailAuthenticationException;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.JavaMailSenderImpl;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/** Shared SMTP transport. The existing communication queue owns history and bounded retries. */
@Service
@ConditionalOnProperty(name = "spring.mail.host")
public class EmailService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(EmailService.class);
    public record Result(String status, String code, String reference, boolean retryable) {
        public boolean accepted() { return "SENT".equals(status); }
    }
    private final JavaMailSender mailSender;
    private final String senderEmail;
    private final String senderName;
    private final String testRecipient;
    private final boolean businessDeliveryEnabled;

    public EmailService(JavaMailSender mailSender,
                        @Value("${app.mail.from:${spring.mail.username:}}") String senderEmail,
                        @Value("${app.mail.from-name:SmartHome AI}") String senderName,
                        @Value("${MAIL_TEST_RECIPIENT:}") String testRecipient,
                        @Value("${app.mail.business-delivery-enabled:false}") boolean businessDeliveryEnabled) {
        this.mailSender = mailSender;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.testRecipient = testRecipient;
        this.businessDeliveryEnabled = businessDeliveryEnabled;
    }

    public Result sendEmail(String recipient, String subject, String body) {
        return sendEmail(List.of(recipient == null ? "" : recipient), subject, body);
    }
    public Result sendEmail(List<String> recipients, String subject, String body) {
        return send(recipients, subject, body, false);
    }
    public Result sendHtmlEmail(List<String> recipients, String subject, String html) {
        return send(recipients, subject, html, true);
    }
    private boolean configured() {
        return !senderEmail.isBlank() && (!(mailSender instanceof JavaMailSenderImpl smtp)
                || (smtp.getUsername() != null && !smtp.getUsername().isBlank()
                && smtp.getPassword() != null && !smtp.getPassword().isBlank()));
    }
    private Result send(List<String> recipients, String subject, String body, boolean html) {
        if (!configured()) return result("NOT_CONFIGURED", "SMTP_CREDENTIALS_MISSING", null, false);
        if (!businessDeliveryEnabled && (recipients == null || recipients.size() != 1
                || testRecipient.isBlank() || !testRecipient.equalsIgnoreCase(recipients.getFirst())))
            return result("ERROR", "TEST_RECIPIENT_NOT_ALLOWED", null, false);
        return sendConfigured(mailSender, senderEmail, senderName, recipients, subject, body, html, null);
    }
    public Result checkConnection() {
        if (!configured()) return result("NOT_CONFIGURED", "SMTP_CREDENTIALS_MISSING", null, false);
        if (!(mailSender instanceof JavaMailSenderImpl smtp))
            return result("ERROR", "SMTP_CONNECTION_CHECK_UNSUPPORTED", null, false);
        return checkConfigured(smtp);
    }
    public static Result checkConfigured(JavaMailSenderImpl sender) {
        try {
            sender.testConnection();
            return result("CONNECTED", "SMTP_CONNECTION_AUTHENTICATED", null, false);
        } catch (Exception error) { return failure(error); }
    }
    /** Reused by owner-scoped integrations without changing their credential policy. */
    public static Result sendConfigured(JavaMailSender sender, String from, String fromName,
                                        List<String> recipients, String subject, String body,
                                        boolean html, String requestKey) {
        if (TransactionSynchronizationManager.isActualTransactionActive())
            return result("ERROR", "SMTP_REQUIRES_COMMITTED_TRANSACTION", null, false);
        try {
            if (recipients == null || recipients.isEmpty() || recipients.size() > 50
                    || subject == null || subject.isBlank() || subject.length() > 250
                    || control(subject) || control(fromName) || body == null
                    || (requestKey != null && control(requestKey)))
                return result("ERROR", "EMAIL_MESSAGE_INVALID", null, false);
            address(from);
            for (String recipient : recipients) address(recipient);
            var message = sender.createMimeMessage();
            var helper = new MimeMessageHelper(message, false, "UTF-8");
            helper.setFrom(from, fromName);
            if (recipients.size() == 1) helper.setTo(recipients.getFirst());
            else helper.setBcc(recipients.toArray(String[]::new));
            helper.setSubject(subject);
            helper.setText(body, html);
            if (requestKey != null) message.setHeader("X-SmartHome-Request", requestKey);
            sender.send(message);
            String id = message.getMessageID();
            return result("SENT", "SMTP_ACCEPTED", id == null ? null : Integer.toHexString(id.hashCode()), false);
        } catch (jakarta.mail.internet.AddressException invalid) {
            return result("ERROR", "EMAIL_ADDRESS_INVALID", null, false);
        } catch (Exception error) { return failure(error); }
    }
    private static void address(String value) throws jakarta.mail.internet.AddressException {
        if (value == null || value.isBlank() || control(value))
            throw new jakarta.mail.internet.AddressException("Invalid mailbox");
        InternetAddress parsed = new InternetAddress(value, true);
        parsed.validate();
        if (parsed.getPersonal() != null || !value.equals(parsed.getAddress()) || !value.contains("@"))
            throw new jakarta.mail.internet.AddressException("Expected one mailbox");
    }
    private static boolean control(String value) {
        return value == null || value.contains("\r") || value.contains("\n") || value.indexOf(0) >= 0;
    }
    private static Result failure(Exception error) {
        if (hasCause(error, MailAuthenticationException.class) || hasCause(error, jakarta.mail.AuthenticationFailedException.class))
            return result("ERROR", "SMTP_AUTH_FAILED", null, false);
        if (hasCause(error, java.net.SocketTimeoutException.class))
            return result("UNKNOWN", "SMTP_TIMEOUT", null, false);
        if (hasCause(error, java.net.ConnectException.class))
            return result("ERROR", "SMTP_CONNECTION_FAILED", null, true);
        // A send may already have been accepted or partially accepted: never retry it blindly.
        return result("UNKNOWN", error instanceof MailSendException ? "SMTP_SEND_UNCONFIRMED"
                : "SMTP_OUTCOME_UNCONFIRMED", null, false);
    }
    private static boolean hasCause(Throwable error, Class<? extends Throwable> type) {
        for (int depth = 0; error != null && depth < 20; depth++, error = error.getCause()) {
            if (type.isInstance(error)) return true;
            if (error instanceof MailSendException send)
                for (Exception nested : send.getMessageExceptions())
                    if (type.isInstance(nested)) return true;
        }
        return false;
    }
    private static Result result(String status, String code, String reference, boolean retryable) {
        LOG.info("SMTP status={} code={}", status, code);
        return new Result(status, code, reference, retryable);
    }
}
