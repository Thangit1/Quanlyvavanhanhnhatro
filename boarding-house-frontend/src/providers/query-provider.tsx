"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchInterval: 60_000,
          },
        },
      }),
  );

  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("smarthome-business-changed")
        : null;
    const changed = () => {
      void queryClient.invalidateQueries();
      channel?.postMessage("changed");
    };
    if (channel)
      channel.onmessage = () => {
        void queryClient.invalidateQueries();
      };
    window.addEventListener("business:changed", changed);
    return () => {
      window.removeEventListener("business:changed", changed);
      channel?.close();
    };
  }, [queryClient]);
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
