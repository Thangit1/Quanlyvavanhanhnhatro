"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Đã xảy ra lỗi</h1>
        <p className="text-slate-400">Vui lòng thử tải lại nội dung.</p>
        <Button type="button" onClick={unstable_retry}>
          Thử lại
        </Button>
      </div>
    </main>
  );
}
