"use client";
import { ErrorState } from "@/components/shared/dashboard-ui";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="p-6">
      <ErrorState onRetry={reset} />
    </main>
  );
}
