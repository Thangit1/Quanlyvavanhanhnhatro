"use client";
import { useEffect, useRef, useState } from "react";
import {
  Banknote,
  Check,
  ChevronDown,
  House,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedRole = value ?? "OWNER";
  const SelectedIcon = icons[selectedRole];

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    if (open) {
      document.addEventListener("pointerdown", closeOnOutsideClick);
      window.addEventListener("keydown", closeOnEscape);
    }
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative ml-auto shrink-0">
      <button
        type="button"
        aria-label="Chọn vai trò truy cập"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="login-role-menu"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm outline-none transition hover:border-blue-300 hover:bg-blue-50 focus-visible:ring-4 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SelectedIcon className="size-4 text-blue-700" aria-hidden="true" />
        <span>{roleLabel[selectedRole]}</span>
        <ChevronDown
          className={`size-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id="login-role-menu"
          role="listbox"
          aria-label="Vai trò truy cập"
          className="absolute right-0 top-full z-30 mt-2 w-56 max-w-[calc(100vw-3rem)] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10"
        >
          {roles.map((role) => {
            const Icon = icons[role];
            const selected = selectedRole === role;
            return (
              <button
                key={role}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(role);
                  setOpen(false);
                }}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${selected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"}`}
              >
                <span
                  className={`grid size-8 shrink-0 place-items-center rounded-lg ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="flex-1">{roleLabel[role]}</span>
                {selected && <Check aria-hidden="true" className="size-4" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
