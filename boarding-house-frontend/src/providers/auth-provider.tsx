"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { authErrorMessage } from "@/services/auth-error";
import { authService } from "@/services/auth.service";
import { disableWebPush } from "@/services/web-push.service";
import {
  refreshAccessToken,
  setAccessToken,
  getAccessToken,
  resetApiSession,
  currentSessionEpoch,
} from "@/services/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { clearSessionCache } from "@/services/session-cache";
import type { AuthUser, LoginPayload } from "@/types/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isBootstrapping: boolean;
  login: (payload: LoginPayload) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  discardSession: () => void;
  sessionWarning: string | null;
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);
  const [sessionWarning, setSessionWarning] = useState<string | null>(null);
  const router = useRouter();
  const queries = useQueryClient();
  const clearSession = useCallback(() => {
    resetApiSession();
    clearSessionCache(queries);
    setUser(null);
    setSessionWarning(null);
  }, [queries]);
  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then(() => authService.me())
      .then((value) => active && setUser(value))
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => active && setBootstrapping(false));
    return () => {
      active = false;
    };
  }, [clearSession]);
  useEffect(() => {
    const expired = () => {
      clearSession();
      router.replace("/login?reason=expired");
    };
    window.addEventListener("auth:expired", expired);
    const passwordRequired = () => {
      setUser((value) =>
        value ? { ...value, mustChangePassword: true } : value,
      );
      router.replace("/change-password");
    };
    window.addEventListener("auth:password-change-required", passwordRequired);
    const revoked = () => {
      const token = getAccessToken();
      resetApiSession();
      setAccessToken(token);
      clearSessionCache(queries);
      setUser((value) => (value ? { ...value } : null));
    };
    window.addEventListener("access:revoked", revoked);
    return () => {
      window.removeEventListener("auth:expired", expired);
      window.removeEventListener(
        "auth:password-change-required",
        passwordRequired,
      );
      window.removeEventListener("access:revoked", revoked);
    };
  }, [clearSession, queries, router]);
  useEffect(() => {
    if (
      user?.mustChangePassword &&
      window.location.pathname !== "/change-password"
    )
      router.replace("/change-password");
  }, [user, router]);
  const login = useCallback(
    async (payload: LoginPayload) => {
      clearSession();
      const envelope = await authService.login({
        ...payload,
        email: payload.email.trim().toLowerCase(),
      });
      setAccessToken(envelope.data.accessToken);
      setUser(envelope.data.user);
      const epoch = currentSessionEpoch();
      // Verify that the browser actually retained/sent the HttpOnly cookie.
      // A blocked cookie still permits this in-memory session; never persist refresh tokens in JS.
      try {
        await refreshAccessToken();
      } catch (error) {
        if (currentSessionEpoch() !== epoch)
          throw new axios.CanceledError("Session changed");
        if (
          axios.isAxiosError(error) &&
          error.response?.status === 401 &&
          error.response.data?.errorCode === "MISSING_REFRESH_TOKEN"
        )
          setSessionWarning(
            "Trình duyệt không gửi được cookie đăng nhập. Phiên hiện tại có thể mất khi tải lại trang. Hãy cho phép cookie hoặc dùng địa chỉ đăng nhập cùng origin do quản trị viên cấu hình.",
          );
        else setSessionWarning(authErrorMessage(error));
      }
      if (currentSessionEpoch() !== epoch)
        throw new axios.CanceledError("Session changed");
      return envelope.data.user;
    },
    [clearSession],
  );
  const logout = useCallback(async () => {
    try {
      await disableWebPush();
    } catch {
      /* Logout still clears the authenticated session. */
    }
    const token = getAccessToken();
    clearSession();
    const epoch = currentSessionEpoch();
    try {
      await authService.logout(token);
    } catch {
      /* local logout still completes */
    }
    if (currentSessionEpoch() !== epoch) return;
    router.replace("/login?reason=logout");
    router.refresh();
  }, [clearSession, router]);
  const refreshUser = useCallback(async () => {
    setUser(await authService.me());
  }, []);
  const value = useMemo(
    () => ({
      user,
      isBootstrapping,
      login,
      logout,
      refreshUser,
      discardSession: clearSession,
      sessionWarning,
    }),
    [
      user,
      isBootstrapping,
      login,
      logout,
      refreshUser,
      clearSession,
      sessionWarning,
    ],
  );
  return (
    <AuthContext.Provider value={value}>
      {sessionWarning && (
        <div
          role="status"
          className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {sessionWarning}
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
