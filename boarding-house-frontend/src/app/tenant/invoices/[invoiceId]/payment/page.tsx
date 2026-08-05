import { InvoicePaymentPage } from "@/components/tenant/invoices/invoice-payment-page";
export default async function Page({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  return <InvoicePaymentPage invoiceId={Number(invoiceId)} />;
}
