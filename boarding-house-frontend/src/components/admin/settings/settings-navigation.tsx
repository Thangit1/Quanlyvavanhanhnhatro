"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { settingNavigation } from "@/constants/setting-groups";
import type { SettingSection } from "@/types/admin-setting";

export function SettingsNavigation({
  section,
  isOwner,
}: {
  section: SettingSection;
  isOwner: boolean;
}) {
  const visible = settingNavigation.filter(
    (item) => isOwner || !item.ownerOnly,
  );
  return (
    <>
      <label className="relative block lg:hidden">
        <span className="sr-only">Chọn mục cài đặt</span>
        <select
          value={section}
          onChange={(event) => {
            window.location.href =
              event.target.value === "overview"
                ? "/admin/settings"
                : `/admin/settings/${event.target.value}`;
          }}
          className="min-h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-800 shadow-sm outline-none focus:border-blue-500"
        >
          {visible.map((item) => (
            <option key={item.section} value={item.section}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-5 text-slate-400" />
      </label>
      <aside className="hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-sm lg:block">
        <nav aria-label="Danh mục cài đặt" className="space-y-1">
          {visible.map((item) => {
            const Icon = item.icon;
            const active = item.section === section;
            return (
              <Link
                key={item.section}
                href={
                  item.section === "overview"
                    ? "/admin/settings"
                    : `/admin/settings/${item.section}`
                }
                className={`flex gap-3 rounded-xl px-3 py-3 transition ${active ? "bg-blue-600 text-white shadow-sm" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <Icon className="mt-0.5 size-5 shrink-0" />
                <span>
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span
                    className={`mt-0.5 block text-xs ${active ? "text-blue-100" : "text-slate-400"}`}
                  >
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
