import { InvoiceDetailPage } from "@/components/tenant/invoices/invoice-detail-page";
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoiceDetailPage invoiceId={Number(invoiceId)} />;
}
