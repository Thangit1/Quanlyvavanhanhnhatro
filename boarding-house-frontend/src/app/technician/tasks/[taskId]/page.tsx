import { TechnicianTaskDetail } from "@/components/technician/technician-task-detail";
export default async function Page({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;
  return <TechnicianTaskDetail id={Number(taskId)} />;
}
