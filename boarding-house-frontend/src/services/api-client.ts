import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/v1\/?$/, "") ??
  "http://localhost:8081/api";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;

export const apiClient = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});
const refreshClient = axios.create({
  baseURL,
  timeout: 10_000,
  withCredentials: true,
  headers: { Accept: "application/json", "Content-Type": "application/json" },
});

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post<ApiEnvelope<{ accessToken: string; expiresIn: number }>>(
        "/auth/refresh",
      )
      .then(({ data }) => {
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    const isAuthEndpoint =
      config?.url?.includes("/auth/login") ||
      config?.url?.includes("/auth/refresh");
    if (
      error.response?.status !== 401 ||
      !config ||
      config._authRetry ||
      isAuthEndpoint
    )
      return Promise.reject(error);
    config._authRetry = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return apiClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      if (typeof window !== "undefined")
        window.dispatchEvent(new Event("auth:expired"));
      return Promise.reject(refreshError);
    }
  },
);

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}
