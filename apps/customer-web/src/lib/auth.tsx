"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AUTH_LOGOUT_EVENT, authApi, tokenStore, type AuthResponse, type User } from "@/lib/api";

interface RegisterInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  referral_code?: string;
}

interface AuthContextValue {
  user: User | null;
  /** true until the initial token check has completed */
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<User>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Temporary open access — auto-sign in with seed customer credentials. */
const DEV_AUTO_LOGIN = {
  email: "customer1@example.com",
  password: "Customer123!",
} as const;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  // Restore session from stored JWT, otherwise auto-login for local demo.
  useEffect(() => {
    let cancelled = false;
    async function restore() {
      try {
        if (tokenStore.getAccess() || tokenStore.getRefresh()) {
          const me = await authApi.me();
          if (!cancelled) setUser(me);
          return;
        }
        const res = await authApi.login(DEV_AUTO_LOGIN);
        if (cancelled) return;
        tokenStore.set(res.tokens);
        setUser(res.user);
      } catch {
        tokenStore.clear();
        try {
          const res = await authApi.login(DEV_AUTO_LOGIN);
          if (cancelled) return;
          tokenStore.set(res.tokens);
          setUser(res.user);
        } catch {
          // Backend unavailable — leave signed out.
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  // Axios interceptor signals when refresh failed.
  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener(AUTH_LOGOUT_EVENT, onLogout);
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, onLogout);
  }, [queryClient]);

  const handleAuth = useCallback(
    (res: AuthResponse) => {
      tokenStore.set(res.tokens);
      queryClient.clear();
      setUser(res.user);
      return res.user;
    },
    [queryClient],
  );

  const login = useCallback(
    async (email: string, password: string) => handleAuth(await authApi.login({ email, password })),
    [handleAuth],
  );

  const register = useCallback(
    async (input: RegisterInput) => handleAuth(await authApi.register(input)),
    [handleAuth],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // token may already be invalid; still clear locally
    }
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isAuthenticated: !!user, login, register, logout, setUser }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Auth gate disabled for local demo — pages stay open while auto-login runs. */
export function useRequireAuth() {
  return useAuth();
}
