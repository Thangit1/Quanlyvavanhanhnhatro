import { FinanceWorkspace } from "@/components/shared/finance-workspace";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const params = await searchParams;
  const property = Number(params.propertyId);
  return (
    <FinanceWorkspace
      portal="admin"
      initialTab="vouchers"
      initialPropertyId={
        Number.isSafeInteger(property) && property > 0 ? property : undefined
      }
    />
  );
}
