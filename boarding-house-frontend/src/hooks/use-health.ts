import { useQuery } from "@tanstack/react-query";
import { healthService } from "@/services/health.service";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: healthService.getHealth,
  });
}
