import type { QueryClient } from "@tanstack/react-query";
export function clearSessionCache(client: QueryClient) {
  void client.cancelQueries().catch(() => undefined);
  client.clear();
}
