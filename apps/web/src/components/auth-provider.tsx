"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";

export type User = {
  id: string;
  githubId: number;
  name: string;
  displayName: string | null;
  avatarUrl: string;
  email: string | null;
};

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function buildLoginUrl(apiBase: string, currentOrigin: string): string {
  return `${apiBase}/api/auth/github?frontend_origin=${encodeURIComponent(currentOrigin)}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await apiFetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBase) {
      console.error(
        "NEXT_PUBLIC_API_URL is not set. OAuth login requires the API base URL to avoid cross-origin cookie issues.",
      );
      return;
    }
    const currentOrigin = window.location.origin;
    window.location.href = buildLoginUrl(apiBase, currentOrigin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout failed", e);
    }
    setUser(null);
  }, []);

  return (
    <AuthContext value={{ user, loading, login, logout, refresh: fetchUser }}>
      {children}
    </AuthContext>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
