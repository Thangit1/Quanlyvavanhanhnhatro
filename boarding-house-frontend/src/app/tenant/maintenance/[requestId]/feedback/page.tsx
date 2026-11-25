import { MaintenanceFeedbackPage } from "@/components/tenant/maintenance/maintenance-feedback-page";
export default async function Page({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  return <MaintenanceFeedbackPage requestId={Number(requestId)} />;
}
