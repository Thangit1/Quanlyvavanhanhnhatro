export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface HealthData {
  application: string;
  status: "UP" | "DOWN";
}
