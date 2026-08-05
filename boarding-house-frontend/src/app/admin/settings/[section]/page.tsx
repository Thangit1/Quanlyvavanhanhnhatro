import { notFound } from "next/navigation";
import { SettingsPage } from "@/components/admin/settings/settings-page";
import { settingNavigation } from "@/constants/setting-groups";
import type { SettingSection } from "@/types/admin-setting";

export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !settingNavigation.some((item) => item.section === section) ||
    section === "overview"
  )
    notFound();
  return <SettingsPage section={section as SettingSection} />;
}
