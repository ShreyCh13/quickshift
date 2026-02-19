"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { loadSession, clearSession as clearStoredSession } from "@/lib/auth";
import type { Session } from "@/lib/types";

interface UseSessionOptions {
  /** If true, redirect to login when no session (default: true) */
  requireAuth?: boolean;
  /** Roles that are allowed to access. If empty, any authenticated user is allowed */
  allowedRoles?: Array<"admin" | "staff" | "dev">;
  /** URL to redirect to when unauthorized (default: "/login") */
  redirectTo?: string;
}

interface UseSessionReturn {
  session: Session | null;
  isLoading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refresh: () => void;
}

/**
 * Hook to manage user session state consistently across all pages.
 * Handles authentication checks, role verification, and logout.
 */
export function useSession(options: UseSessionOptions = {}): UseSessionReturn {
  const {
    requireAuth = true,
    allowedRoles = [],
    redirectTo = "/login",
  } = options;

  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkSession = useCallback(() => {
    const s = loadSession();
    
    if (!s && requireAuth) {
      router.replace(redirectTo);
      setIsLoading(false);
      return;
    }

    if (s && allowedRoles.length > 0 && !allowedRoles.includes(s.user.role)) {
      // User is authenticated but doesn't have required role
      router.replace("/vehicles"); // Redirect to default page
      setIsLoading(false);
      return;
    }

    setSession(s);
    setIsLoading(false);
  }, [requireAuth, allowedRoles, redirectTo, router]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearStoredSession();
    router.replace("/login");
  }, [router]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    checkSession();
  }, [checkSession]);

  return {
    session,
    isLoading,
    isAdmin: session?.user.role === "admin",
    isAuthenticated: !!session,
    logout,
    refresh,
  };
}

export default useSession;
