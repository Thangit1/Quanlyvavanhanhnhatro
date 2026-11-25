import { Suspense } from "react";
import { InvoiceListPage } from "@/components/admin/invoices/invoice-list-page";
export default function Page() {
  return (
    <Suspense>
      <InvoiceListPage debtOnly />
    </Suspense>
  );
}
