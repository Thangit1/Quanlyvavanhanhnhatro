import { PropertyDetailPage } from "@/components/admin/properties/property-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  return <PropertyDetailPage id={Number(propertyId)} />;
}
