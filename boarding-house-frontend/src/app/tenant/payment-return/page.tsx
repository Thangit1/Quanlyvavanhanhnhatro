import Link from "next/link";
import { PaymentTransactionsPanel } from "@/components/shared/payment-transactions-panel";
export default function Page() {
  return (
    <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <section className="surface-card p-6">
        <h1 className="text-2xl font-bold">Kiểm tra kết quả thanh toán</h1>
        <p className="mt-3 text-muted-foreground">
          Bạn đã quay lại từ cổng thanh toán. Hệ thống chỉ ghi nhận thực thu sau
          khi xác minh kết quả từ nhà cung cấp; việc quay lại trang này không tự
          xác nhận hóa đơn đã thanh toán.
        </p>
        <Link
          className="mt-4 inline-block font-semibold text-link underline"
          href="/tenant/payments"
        >
          Xem lịch sử và tải biên nhận
        </Link>
      </section>
      <PaymentTransactionsPanel />
    </main>
  );
}
