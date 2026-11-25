# Boarding House Frontend

Frontend Next.js App Router cho hệ thống quản lý và vận hành nhà trọ.

## Chạy cục bộ

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Mở http://localhost:3000. Trang chủ gọi health API thông qua TanStack Query và service Axios.

## Kiểm tra

```powershell
npm.cmd run lint
npm.cmd run format:check
npm.cmd run build
```
