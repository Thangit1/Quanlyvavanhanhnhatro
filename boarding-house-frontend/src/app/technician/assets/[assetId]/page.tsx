import { AssetDetailPage } from "@/components/technician/technician-resource-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = await params;
  return <AssetDetailPage id={Number(assetId)} />;
}
