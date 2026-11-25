package com.thangit.boardinghouse.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Set;

/** Date-only invoice deadlines are inclusive in the company's business timezone. */
public final class InvoicePaymentRules {
    public static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final Set<String> NON_COLLECTIBLE = Set.of("DRAFT", "PENDING_REVIEW", "CANCELLED", "PAID");
    private InvoicePaymentRules() {}

    public static void requireAmount(BigDecimal amount) {
        if (amount == null || amount.signum() <= 0 || amount.stripTrailingZeros().scale() > 2
                || amount.compareTo(new BigDecimal("9999999999999.99")) > 0)
            throw new com.thangit.boardinghouse.common.exception.AuthException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "PAYMENT_AMOUNT_INVALID",
                    "Số tiền phải lớn hơn 0, tối đa 13 chữ số nguyên và 2 chữ số thập phân.");
    }

    public static void requireReceipt(BigDecimal amount, String method, java.time.LocalDateTime paidAt, String reference) {
        requireAmount(amount);
        if (method == null || !Set.of("CASH", "BANK_TRANSFER", "CARD", "EWALLET", "OTHER").contains(method))
            throw new com.thangit.boardinghouse.common.exception.AuthException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "PAYMENT_METHOD_INVALID", "Phương thức thanh toán không hợp lệ.");
        if (paidAt == null || paidAt.isAfter(BusinessTime.now().plusMinutes(5)))
            throw new com.thangit.boardinghouse.common.exception.AuthException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "PAYMENT_TIME_INVALID", "Thời gian nhận tiền không hợp lệ.");
        if ("BANK_TRANSFER".equals(method) && (reference == null || reference.isBlank()))
            throw new com.thangit.boardinghouse.common.exception.AuthException(
                    org.springframework.http.HttpStatus.BAD_REQUEST, "PAYMENT_REFERENCE_REQUIRED",
                    "Cần mã giao dịch ngân hàng đã đối chiếu để xác nhận chuyển khoản.");
    }

    public static String effectiveStatus(String status, BigDecimal balance, LocalDate due, LocalDate today) {
        return !NON_COLLECTIBLE.contains(status) && balance.signum() > 0 && due != null && today.isAfter(due)
                ? "OVERDUE" : status;
    }

    public static long lateDays(LocalDate due, LocalDate paidOrToday) {
        return due == null || paidOrToday == null ? 0 : Math.max(0, ChronoUnit.DAYS.between(due, paidOrToday));
    }
    public static boolean paymentOpen(java.util.Map<String,Object> invoice,LocalDate date){
        Object value=invoice.get("payment_available_from");
        if(value==null)return true;
        LocalDate start=value instanceof LocalDate d?d:value instanceof java.sql.Date d?d.toLocalDate():LocalDate.parse(value.toString());
        return date!=null&&!date.isBefore(start);
    }
    public static void requireOpen(java.util.Map<String,Object> invoice,LocalDate date){
        if(!paymentOpen(invoice,date))throw new com.thangit.boardinghouse.common.exception.AuthException(org.springframework.http.HttpStatus.CONFLICT,"PAYMENT_WINDOW_NOT_OPEN","Chưa đến ngày bắt đầu thanh toán của hóa đơn.");
    }
}
