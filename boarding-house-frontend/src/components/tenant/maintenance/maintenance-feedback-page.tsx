"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import {
  useMaintenanceActions,
  useTenantMaintenanceDetail,
} from "@/hooks/use-tenant-maintenance";
import { apiErrorMessage } from "@/lib/api-error";
import { ErrorState, PageLoading } from "@/components/shared/dashboard-ui";
export function MaintenanceFeedbackPage({ requestId }: { requestId: number }) {
  const { user } = useAuth();
  const router = useRouter();
  const q = useTenantMaintenanceDetail(
    user?.activeRole === "TENANT",
    requestId,
  );
  const action = useMaintenanceActions(requestId);
  const [result, setResult] = useState("PASSED"),
    [rating, setRating] = useState(5),
    [staff, setStaff] = useState(5),
    [time, setTime] = useState(5),
    [comment, setComment] = useState(""),
    [working, setWorking] = useState(true),
    [error, setError] = useState("");
  if (q.isLoading) return <PageLoading />;
  if (q.isError || !q.data)
    return (
      <main className="p-6">
        <ErrorState onRetry={() => void q.refetch()} />
      </main>
    );
  const d = q.data;
  if (d.feedback)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link
          href={`/tenant/maintenance/${requestId}`}
          className="text-blue-600"
        >
          ← Quay lại
        </Link>
        <div className="mt-5 rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-2xl font-black">Đã gửi đánh giá</h1>
          <p className="mt-2 text-slate-500">
            Bạn đã đánh giá {d.feedback.rating}/5 sao cho yêu cầu này.
          </p>
        </div>
      </main>
    );
  if (!d.permissions.canProvideFeedback && !d.feedback)
    return (
      <main className="mx-auto max-w-2xl p-6">
        <Link
          href={`/tenant/maintenance/${requestId}`}
          className="text-blue-600"
        >
          ← Quay lại
        </Link>
        <div className="mt-5 rounded-2xl border bg-white p-8 text-center">
          <h1 className="text-2xl font-black">Chưa thể đánh giá</h1>
          <p className="mt-2 text-slate-500">
            Yêu cầu cần ở trạng thái chờ xác nhận và chưa được đánh giá.
          </p>
        </div>
      </main>
    );
  async function submit() {
    setError("");
    try {
      await action.feedback.mutateAsync({
        result,
        rating,
        staffAttitudeRating: staff,
        resolutionTimeRating: time,
        comment: comment || undefined,
        assetWorking: working,
        version: d.version,
      });
      router.replace(`/tenant/maintenance/${requestId}`);
    } catch (e) {
      setError(apiErrorMessage(e, "Không thể gửi đánh giá."));
    }
  }
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4 sm:p-6">
      <Link
        href={`/tenant/maintenance/${requestId}`}
        className="inline-flex items-center gap-2 font-semibold text-slate-600"
      >
        <ArrowLeft className="size-4" />
        Chi tiết yêu cầu
      </Link>
      <div>
        <h1 className="text-3xl font-black">Xác nhận kết quả sửa chữa</h1>
        <p className="mt-1 text-slate-500">
          {d.requestCode} · {d.title}
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}
      <section className="space-y-5 rounded-2xl border bg-white p-6 shadow-sm">
        <label className="block text-sm font-semibold">
          Kết quả
          <select
            value={result}
            onChange={(e) => setResult(e.target.value)}
            className="mt-1 block w-full rounded-xl border p-3"
          >
            <option value="PASSED">Đã xử lý tốt</option>
            <option value="PARTIALLY_RESOLVED">
              Đã xử lý nhưng còn vấn đề
            </option>
            <option value="FAILED">Chưa được xử lý</option>
          </select>
        </label>
        <Rating label="Mức độ hài lòng" value={rating} onChange={setRating} />
        <Rating label="Thái độ nhân viên" value={staff} onChange={setStaff} />
        <Rating label="Thời gian xử lý" value={time} onChange={setTime} />
        <label className="block text-sm font-semibold">
          Nhận xét{result !== "PASSED" && " (bắt buộc)"}
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={5}
            maxLength={2000}
            className="mt-1 block w-full rounded-xl border p-3"
            placeholder="Mô tả kết quả hoặc vấn đề còn tồn tại..."
          />
        </label>
        <label className="flex items-center gap-3 rounded-xl border p-4">
          <input
            type="checkbox"
            checked={working}
            onChange={(e) => setWorking(e.target.checked)}
            className="size-4"
          />
          Thiết bị hoặc khu vực đã hoạt động bình thường
        </label>
        <button
          disabled={
            action.feedback.isPending ||
            (result !== "PASSED" && comment.trim().length < 10)
          }
          onClick={submit}
          className="w-full rounded-xl bg-blue-600 px-5 py-3 font-bold text-white disabled:opacity-40"
        >
          {action.feedback.isPending
            ? "Đang gửi..."
            : "Gửi xác nhận và đánh giá"}
        </button>
        <p className="text-xs text-slate-500">
          Nếu kết quả chưa đạt, yêu cầu sẽ được mở lại để quản lý tiếp tục xử
          lý.
        </p>
      </section>
    </main>
  );
}
function Rating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((x) => (
          <button
            key={x}
            type="button"
            aria-label={`${x} sao`}
            aria-pressed={value === x}
            onClick={() => onChange(x)}
            className="rounded-lg p-1 focus:ring-2 focus:ring-blue-500"
          >
            <Star
              className={`size-7 ${x <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
            />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
