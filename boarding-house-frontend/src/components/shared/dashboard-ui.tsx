import { AlertTriangle, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { statusLabel } from "@/lib/format";

export function PageLoading() {
  return (
    <main
      className="grid min-h-screen place-items-center bg-background"
      aria-live="polite"
    >
      <div className="flex items-center gap-3 text-secondary-foreground">
        <LoaderCircle className="size-6 animate-spin text-link" />
        Đang tải dữ liệu...
      </div>
    </main>
  );
}
export function ErrorState({
  onRetry,
  message = "Không thể tải dữ liệu. Vui lòng kiểm tra kết nối và thử lại.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-danger-border bg-danger-muted p-6 text-center"
    >
      <AlertTriangle className="mx-auto size-8 text-danger" />
      <p className="mt-3 font-semibold text-danger">{message}</p>
      <button
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
      >
        <RefreshCw className="size-4" />
        Thử lại
      </button>
    </div>
  );
}
export function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-input p-6 text-center text-muted-foreground">
      <Inbox className="mx-auto mb-2 size-8 text-muted-foreground" />
      {text}
    </div>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const warning = ["OVERDUE", "URGENT", "IMPORTANT", "MAINTENANCE"].includes(
    status,
  );
  const success = ["PAID", "ACTIVE", "COMPLETED", "VACANT", "READY"].includes(
    status,
  );
  const pending = [
    "RESERVED",
    "PENDING",
    "PARTIALLY_PAID",
    "HIGH",
    "NOTICE",
  ].includes(status);
  const neutral = ["INACTIVE", "CANCELLED", "REJECTED"].includes(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
        warning
          ? "bg-danger-muted text-danger"
          : success
            ? "bg-success-muted text-success"
            : pending
              ? "bg-warning-muted text-warning"
              : neutral
                ? "bg-muted text-secondary-foreground"
                : "bg-accent text-link"
      }`}
    >
      {statusLabel(status)}
    </span>
  );
}
