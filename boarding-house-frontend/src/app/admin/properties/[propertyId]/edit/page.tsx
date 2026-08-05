import { PropertyFormPage } from "@/components/admin/properties/property-pages";
export default async function Page({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  return <PropertyFormPage id={Number(propertyId)} />;
}
