"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { getSessionHeader, clearSession } from "@/lib/auth";

interface ApiOptions {
  /** Number of retry attempts for failed requests (default: 3) */
  retries?: number;
  /** Delay between retries in ms (default: 1000) */
  retryDelay?: number;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** Whether to include session headers (default: true) */
  authenticated?: boolean;
}

interface ApiState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

interface UseApiReturn<T> extends ApiState<T> {
  execute: () => Promise<T | null>;
  reset: () => void;
}

/**
 * Hook for making API calls with retry logic, error handling, and loading states.
 * Automatically handles authentication and session expiration.
 */
export function useApi<T>(
  url: string | (() => string),
  options: ApiOptions & RequestInit = {}
): UseApiReturn<T> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    authenticated = true,
    ...fetchOptions
  } = options;

  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  
  // Memoize fetch options to prevent unnecessary re-renders
  // Serialize to JSON for stable comparison (only re-create if content changes)
  const fetchOptionsJson = JSON.stringify(fetchOptions);
  const stableFetchOptions = useMemo(
    () => JSON.parse(fetchOptionsJson) as RequestInit,
    [fetchOptionsJson]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const execute = useCallback(async (): Promise<T | null> => {
    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    const resolvedUrl = typeof url === "function" ? url() : url;
    
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Set up timeout
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const headers: HeadersInit = {
          ...stableFetchOptions.headers,
        };

        if (authenticated) {
          Object.assign(headers, getSessionHeader());
        }

        const response = await fetch(resolvedUrl, {
          ...stableFetchOptions,
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          
          // Handle unauthorized - clear session and don't retry
          if (response.status === 401) {
            clearSession();
            window.location.href = "/login";
            throw new Error("Session expired");
          }

          // Don't retry 4xx errors (except 429 rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(errorData.error || `Request failed: ${response.status}`);
          }

          throw new Error(errorData.error || `Request failed: ${response.status}`);
        }

        const data = await response.json();
        
        setState({
          data,
          error: null,
          isLoading: false,
        });

        return data;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error("Unknown error");

        // Don't retry if aborted
        if (lastError.name === "AbortError") {
          setState((prev) => ({ ...prev, isLoading: false }));
          return null;
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
        }
      }
    }

    // All retries failed
    setState({
      data: null,
      error: lastError?.message || "Request failed",
      isLoading: false,
    });

    return null;
  }, [url, retries, retryDelay, timeout, authenticated, stableFetchOptions]);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      data: null,
      error: null,
      isLoading: false,
    });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

/**
 * Simplified fetch helper with retry logic for one-off API calls.
 */
export async function fetchWithRetry<T>(
  url: string,
  options: ApiOptions & RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    authenticated = true,
    ...fetchOptions
  } = options;

  const controller = new AbortController();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const headers: HeadersInit = {
        ...fetchOptions.headers,
      };

      if (authenticated) {
        Object.assign(headers, getSessionHeader());
      }

      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          clearSession();
          return { data: null, error: "Session expired" };
        }

        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          return { data: null, error: errorData.error || `Request failed: ${response.status}` };
        }

        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      const data = await response.json();
      return { data, error: null };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error("Unknown error");

      if (lastError.name === "AbortError") {
        return { data: null, error: "Request cancelled" };
      }

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay * (attempt + 1)));
      }
    }
  }

  return { data: null, error: lastError?.message || "Request failed" };
}

export default useApi;
