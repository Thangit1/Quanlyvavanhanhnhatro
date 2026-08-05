"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="m-8 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
      <h2 className="text-xl font-bold">Không thể tải phân hệ bảo trì</h2>
      <p className="mt-2">Vui lòng kiểm tra kết nối và thử lại.</p>
      <button
        onClick={reset}
        className="mt-4 rounded-xl bg-red-600 px-4 py-2 font-semibold text-white"
      >
        Thử lại
      </button>
    </div>
  );
}
