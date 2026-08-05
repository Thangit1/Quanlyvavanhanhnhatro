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
import { refreshAccessToken, setAccessToken } from "@/services/api-client";
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
  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);
  useEffect(() => {
    let active = true;
    refreshAccessToken()
      .then(() => authService.me())
      .then((value) => active && setUser(value))
      .catch(clearSession)
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
    return () => window.removeEventListener("auth:expired", expired);
  }, [clearSession, router]);
  const login = useCallback(async (payload: LoginPayload) => {
    const envelope = await authService.login({
      ...payload,
      email: payload.email.trim().toLowerCase(),
    });
    setAccessToken(envelope.data.accessToken);
    setUser(envelope.data.user);
    return envelope.data.user;
  }, []);
  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      /* local logout still completes */
    }
    clearSession();
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
