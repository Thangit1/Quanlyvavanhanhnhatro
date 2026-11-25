import { apiClient } from "@/services/api-client";
import type { ApiResponse, HealthData } from "@/types/api";

export const healthService = {
  async getHealth(): Promise<ApiResponse<HealthData>> {
    const response = await apiClient.get<ApiResponse<HealthData>>("/v1/health");
    return response.data;
  },
};
