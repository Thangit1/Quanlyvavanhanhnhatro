import { Suspense } from "react";
import { RoomListPage } from "@/components/admin/properties/room-pages";
import { PageLoading } from "@/components/shared/dashboard-ui";
export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoomListPage />
    </Suspense>
  );
}
