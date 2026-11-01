import axios, {
  AxiosError,
  CanceledError,
  InternalAxiosRequestConfig,
} from "axios";

const baseURL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/v1\/?$/, "") ??
  "http://localhost:8080/api";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let sessionEpoch = 0;
let refreshController: AbortController | null = null;
const successfulReads = new Set<string>();
const resourceKey = (config: InternalAxiosRequestConfig) =>
  JSON.stringify([config.url, config.params]);
export function resetApiSession() {
  sessionEpoch += 1;
  accessToken = null;
  refreshController?.abort();
  refreshController = null;
  refreshPromise = null;
  successfulReads.clear();
  return sessionEpoch;
}
export function currentSessionEpoch() {
  return sessionEpoch;
}

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
    const epoch = sessionEpoch;
    const controller = new AbortController();
    refreshController = controller;
    const pending = refreshClient
      .post<ApiEnvelope<{ accessToken: string; expiresIn: number }>>(
        "/auth/refresh",
        undefined,
        { signal: controller.signal },
      )
      .then(({ data }) => {
        if (epoch !== sessionEpoch) throw new CanceledError("Session changed");
        setAccessToken(data.data.accessToken);
        return data.data.accessToken;
      })
      .finally(() => {
        if (refreshPromise === pending) {
          refreshPromise = null;
          refreshController = null;
        }
      });
    refreshPromise = pending;
  }
  return refreshPromise;
}

apiClient.interceptors.request.use(async (config) => {
  const scoped = config as RetryConfig;
  if (
    scoped._sessionEpoch !== undefined &&
    scoped._sessionEpoch !== sessionEpoch
  )
    throw new CanceledError("Session changed");
  scoped._sessionEpoch = sessionEpoch;
  if (!config.url?.startsWith("/auth/")) {
    // Bootstrap/rotation may still be restoring the in-memory token.
    if (!accessToken && refreshPromise) await refreshPromise;
    if (scoped._sessionEpoch !== sessionEpoch)
      throw new CanceledError("Session changed");
    // Mounted observers must not restart a session after logout has cleared it.
    if (!accessToken && sessionEpoch > 0)
      throw new CanceledError("No authenticated session");
  }
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

type RetryConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean;
  _sessionEpoch?: number;
};
apiClient.interceptors.response.use(
  (response) => {
    if ((response.config as RetryConfig)._sessionEpoch !== sessionEpoch)
      throw new CanceledError("Session changed");
    if (
      /^get$/i.test(response.config.method ?? "get") &&
      !response.config.url?.startsWith("/auth/")
    )
      successfulReads.add(resourceKey(response.config));
    if (
      !/^(get|head|options)$/i.test(response.config.method ?? "get") &&
      !response.config.url?.startsWith("/auth/") &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("business:changed"));
    return response;
  },
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (
      config?._sessionEpoch !== undefined &&
      config._sessionEpoch !== sessionEpoch
    )
      return Promise.reject(new CanceledError("Session changed"));
    const isAuthEndpoint = config?.url?.startsWith("/auth/");
    if (
      error.response?.status === 403 &&
      config &&
      successfulReads.delete(resourceKey(config)) &&
      typeof window !== "undefined"
    )
      window.dispatchEvent(new Event("access:revoked"));
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
      if (config._sessionEpoch !== sessionEpoch)
        return Promise.reject(new CanceledError("Session changed"));
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
