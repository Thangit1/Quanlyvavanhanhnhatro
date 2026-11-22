import { InvoiceListPage } from "@/components/admin/invoices/invoice-list-page";
import { PaymentTransactionsPanel } from "@/components/shared/payment-transactions-panel";
export default function Page() {
  return (
    <>
      <InvoiceListPage />
      <PaymentTransactionsPanel management />
    </>
  );
}
