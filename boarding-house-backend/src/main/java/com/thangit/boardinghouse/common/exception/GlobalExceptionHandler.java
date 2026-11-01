package com.thangit.boardinghouse.common.exception;

import com.thangit.boardinghouse.common.base.ApiErrorResponse;
import com.thangit.boardinghouse.common.base.ApiErrorResponse.FieldError;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);
    @ExceptionHandler(org.springframework.web.multipart.MaxUploadSizeExceededException.class)
    public ResponseEntity<ApiErrorResponse> handleFileLimit(org.springframework.web.multipart.MaxUploadSizeExceededException exception) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(ApiErrorResponse.of("Chứng từ vượt quá giới hạn tải lên.","FILE_TOO_LARGE",List.of()));
    }
    @ExceptionHandler(org.springframework.dao.DuplicateKeyException.class)
    public ResponseEntity<ApiErrorResponse> handleDuplicate(org.springframework.dao.DuplicateKeyException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of("Mã giao dịch hoặc chứng từ đã tồn tại.","FINANCIAL_REFERENCE_CONFLICT",List.of()));
    }
    @ExceptionHandler(org.springframework.dao.DataAccessException.class)
    public ResponseEntity<ApiErrorResponse> handleDatabaseGuard(org.springframework.dao.DataAccessException exception) {
        for(Throwable cause=exception;cause!=null;cause=cause.getCause()) {
            if(cause instanceof java.sql.SQLException sql && "45000".equals(sql.getSQLState())) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of("Kỳ kế toán đã khóa hoặc lịch sử tài chính không được sửa trực tiếp.","FINANCIAL_POSTING_BLOCKED",List.of()));
            }
        }
        return handleUnexpected(exception);
    }
    @ExceptionHandler({org.springframework.dao.PessimisticLockingFailureException.class,org.springframework.dao.OptimisticLockingFailureException.class})
    public ResponseEntity<ApiErrorResponse> handleConcurrentUpdate(RuntimeException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ApiErrorResponse.of("Dữ liệu đang được xử lý đồng thời. Vui lòng tải lại và thử lại.","CONCURRENT_UPDATE",List.of()));
    }

    @ExceptionHandler(AuthException.class)
    public ResponseEntity<ApiErrorResponse> handleAuth(AuthException exception) {
        return ResponseEntity.status(exception.status()).body(
                ApiErrorResponse.of(exception.getMessage(), exception.code(), List.of()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<FieldError> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldError(error.getField(), error.getDefaultMessage())).toList();
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of("Dữ liệu không hợp lệ.", "VALIDATION_ERROR", errors));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableBody(HttpMessageNotReadableException exception) {
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of("Nội dung yêu cầu không hợp lệ.", "MALFORMED_REQUEST", List.of()));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingResource(NoResourceFoundException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(
                ApiErrorResponse.of("Không tìm thấy tài nguyên được yêu cầu.", "RESOURCE_NOT_FOUND", List.of()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception) {
        log.error("Unhandled request failure type={} requestId={}",exception.getClass().getSimpleName(),org.slf4j.MDC.get("requestId"));
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                ApiErrorResponse.of("Đã xảy ra lỗi hệ thống.", "INTERNAL_SERVER_ERROR", List.of()));
    }
}
