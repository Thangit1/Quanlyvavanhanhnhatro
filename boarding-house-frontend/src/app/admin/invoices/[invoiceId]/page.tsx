import { InvoiceDetailPage } from "@/components/admin/invoices/invoice-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoiceDetailPage id={Number(invoiceId)} />;
}
