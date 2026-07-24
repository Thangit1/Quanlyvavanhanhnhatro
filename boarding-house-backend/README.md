# Boarding House Backend

REST API Spring Boot 4, Java 21 và Maven Wrapper.

## Chạy cục bộ trên Windows

Khởi động MySQL từ thư mục gốc trước, sau đó:

```powershell
.\mvnw.cmd spring-boot:run
```

Các địa chỉ chính:

- Health: http://localhost:8080/api/v1/health
- Swagger UI: http://localhost:8080/swagger-ui.html
- OpenAPI: http://localhost:8080/api-docs

## Kiểm tra

```powershell
.\mvnw.cmd clean verify
```
