"use client";
import { ErrorState, Page } from "@/components/technician/technician-ui";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Page title="Cổng kỹ thuật">
      <ErrorState retry={reset} />
    </Page>
  );
}
