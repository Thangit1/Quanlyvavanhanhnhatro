import { RoomDetailPage } from "@/components/admin/properties/room-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  return <RoomDetailPage id={Number(roomId)} />;
}
