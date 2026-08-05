"use client";
import { Banknote, House, ShieldCheck, UserRound, Wrench } from "lucide-react";
import { roleLabel, roles, type Role } from "@/types/auth";

const icons = {
  OWNER: UserRound,
  MANAGER: ShieldCheck,
  ACCOUNTANT: Banknote,
  TECHNICIAN: Wrench,
  TENANT: House,
};
export function RoleSelector({
  value,
  onChange,
  disabled,
}: {
  value?: Role;
  onChange: (role: Role) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Vai trò truy cập"
      className="grid grid-cols-2 gap-3 sm:grid-cols-3"
    >
      {roles.map((role) => {
        const Icon = icons[role];
        const selected = value === role;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(role)}
            className={`group flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition disabled:cursor-not-allowed disabled:opacity-60 ${selected ? "border-blue-700 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"}`}
          >
            <span
              className={`grid size-11 place-items-center rounded-full ${selected ? "bg-blue-600 text-white" : "bg-blue-100 text-slate-600 group-hover:text-blue-700"}`}
            >
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <span className="text-sm font-semibold">{roleLabel[role]}</span>
          </button>
        );
      })}
    </div>
  );
}
