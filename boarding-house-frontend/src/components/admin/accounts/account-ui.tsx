"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
const secondary =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-secondary-foreground disabled:opacity-50";
export function AccountField({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-semibold text-secondary-foreground">
      <span>{title}</span>
      {children}
    </label>
  );
}
export function AccountModal({
  title,
  children,
  onClose,
  drawer = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`${drawer ? "fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(95vw,640px)] rounded-l-2xl" : "m-auto max-h-[90dvh] w-[min(95vw,850px)] rounded-2xl"} overflow-y-auto border border-border bg-card p-6 shadow-2xl backdrop:bg-slate-950/50`}
    >
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 id={id} className="text-xl font-bold text-foreground">
          {title}
        </h2>
        <button
          type="button"
          className={secondary}
          aria-label="Đóng"
          onClick={onClose}
        >
          <X className="size-4" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
