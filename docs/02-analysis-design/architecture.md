# Kiến trúc giai đoạn 1

```text
Next.js page -> feature component -> TanStack Query hook -> service -> Axios
                                                               |
                                                               v
Spring Controller -> Service -> Repository (ở các module có dữ liệu) -> MySQL
```

Frontend không gọi Axios trực tiếp từ page/component. Backend không trả Entity và giữ kiểm tra quyền sở hữu dữ liệu ở Service trong các giai đoạn nghiệp vụ.
