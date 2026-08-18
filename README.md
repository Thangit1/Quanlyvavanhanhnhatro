# Hệ thống quản lý và vận hành nhà trọ tích hợp AI

Monorepo đồ án tốt nghiệp gồm frontend Next.js, backend Spring Boot và MySQL. Giai đoạn 1 cung cấp nền tảng dự án, migration xác thực, bảo mật cơ sở và health check end-to-end.

## Yêu cầu trên Windows

- Git
- Node.js 22 và npm
- JDK 21 (`java -version`)
- Docker Desktop

Backend dùng Maven Wrapper nên không cần cài Maven toàn cục.

## Cấu trúc

```text
boarding-house-frontend/  Next.js, TypeScript, Tailwind CSS, shadcn/ui
boarding-house-backend/   Spring Boot, Java 21, Maven, Flyway
database/                 Ghi chú schema, seed và script dữ liệu
docs/                     Tài liệu yêu cầu, thiết kế, API, test, triển khai
scripts/                  Script hỗ trợ dự án
docker-compose.yml        MySQL dùng chung toàn repository
```

## 1. Cấu hình môi trường

```powershell
Copy-Item .env.example .env
Copy-Item .\boarding-house-frontend\.env.example .\boarding-house-frontend\.env.local
```

Các giá trị mặc định chỉ dành cho local. Đổi `DB_PASSWORD` và `JWT_SECRET` trước khi dùng ở môi trường khác.

## 2. Khởi động MySQL

```powershell
docker compose up -d mysql
docker compose ps
```

Nếu Docker Desktop chỉ cung cấp executable cũ, thay `docker compose` bằng `docker-compose`.

MySQL lắng nghe tại `localhost:3306`; database `boarding_house_management` được tạo tự động. Flyway chạy migration khi backend khởi động.

## 3. Chạy backend

```powershell
Set-Location .\boarding-house-backend
.\mvnw.cmd spring-boot:run
```

Kiểm tra http://localhost:8081/api/v1/health.

## 4. Chạy frontend

Mở terminal PowerShell khác:

```powershell
Set-Location .\boarding-house-frontend
npm.cmd install
npm.cmd run dev
```

Mở http://localhost:3000 để xem trạng thái kết nối backend.

## Build và test

```powershell
Set-Location .\boarding-house-backend
.\mvnw.cmd clean verify

Set-Location ..\boarding-house-frontend
npm.cmd run lint
npm.cmd run build
```

## Dừng hạ tầng local

```powershell
docker compose down
```

Không dùng `-v` nếu muốn giữ dữ liệu MySQL trong volume.
