"use client";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="m-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
      <h2 className="font-bold text-red-800">Không thể mở phân hệ kế toán</h2>
      <p className="mt-2 text-sm text-red-700">
        Vui lòng kiểm tra kết nối và thử lại.
      </p>
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
