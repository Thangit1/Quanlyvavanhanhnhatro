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
import { authService } from "@/services/auth.service";
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
}
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setBootstrapping] = useState(true);
  const router = useRouter();
  const queries = useQueryClient();
  const clearSession = useCallback(() => {
    resetApiSession();
    clearSessionCache(queries);
    setUser(null);
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
      window.removeEventListener("access:revoked", revoked);
    };
  }, [clearSession, queries, router]);
  const login = useCallback(
    async (payload: LoginPayload) => {
      clearSession();
      const envelope = await authService.login({
        ...payload,
        email: payload.email.trim().toLowerCase(),
      });
      setAccessToken(envelope.data.accessToken);
      setUser(envelope.data.user);
      return envelope.data.user;
    },
    [clearSession],
  );
  const logout = useCallback(async () => {
    clearSession();
    const epoch = currentSessionEpoch();
    try {
      await authService.logout();
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
    () => ({ user, isBootstrapping, login, logout, refreshUser }),
    [user, isBootstrapping, login, logout, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
