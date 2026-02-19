"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { clearSession, getSessionHeader, loadSession } from "@/lib/auth";

function SessionValidator() {
  useEffect(() => {
    const session = loadSession();
    if (!session) return;

    fetch("/api/auth/validate", {
      headers: { "Content-Type": "application/json", ...getSessionHeader() },
    })
      .then((r) => r.json())
      .then((data: { valid: boolean; reason?: string }) => {
        if (!data.valid) {
          clearSession();
          // Hard redirect so the page re-renders correctly
          window.location.href = "/login";
        }
      })
      .catch(() => {
        // Network error - don't clear session, just fail silently
      });
  }, []);

  return null;
}

export default function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
          },
          mutations: {
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SessionValidator />
      {children}
    </QueryClientProvider>
  );
}
