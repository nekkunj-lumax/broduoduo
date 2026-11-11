"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, hasAdminRole, loginRequest, tokenStore } from "@/lib/api";
import type { AdminUser } from "@/lib/types";

interface AuthState {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AdminUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** Temporary open access — auto-sign in with seed admin credentials. */
const DEV_AUTO_LOGIN = {
  email: "admin@pindodo.com",
  password: "Admin123!",
} as const;

export class NotAdminError extends Error {
  constructor() {
    super("This account does not have admin, owner or staff access.");
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        if (tokenStore.access) {
          const me = await fetchMe();
          if (cancelled) return;
          if (hasAdminRole(me)) {
            setUser(me);
            return;
          }
          tokenStore.clear();
        }
        const { user: u, tokens } = await loginRequest(
          DEV_AUTO_LOGIN.email,
          DEV_AUTO_LOGIN.password,
        );
        if (cancelled) return;
        if (!hasAdminRole(u)) throw new NotAdminError();
        tokenStore.set(tokens.access_token, tokens.refresh_token);
        setUser(u);
      } catch {
        tokenStore.clear();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { user: u, tokens } = await loginRequest(email, password);
    if (!hasAdminRole(u)) throw new NotAdminError();
    tokenStore.set(tokens.access_token, tokens.refresh_token);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    qc.clear();
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used inside AdminAuthProvider");
  return ctx;
}
