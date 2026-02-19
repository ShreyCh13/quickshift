"use client";

/**
 * Central API client with offline queue support.
 * Queues POST/PUT/PATCH/DELETE when offline; retries when back online.
 */

import { getSessionHeader } from "@/lib/auth";
import { addToRetryQueue } from "@/lib/offline";

/** Error thrown when a mutation was queued for offline sync */
export const OFFLINE_QUEUED_ERROR = "OFFLINE_QUEUED";

const MUTATION_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function isMutation(method: string): boolean {
  return MUTATION_METHODS.includes(method.toUpperCase());
}

/**
 * Fetch with session auth. Queues mutations when offline.
 * @throws Error with message OFFLINE_QUEUED_ERROR when request was queued (caller should show "saved locally" toast)
 */
export async function fetchWithSession<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const method = (options?.method || "GET").toUpperCase();
  const mutation = isMutation(method);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...getSessionHeader(),
    ...(options?.headers as Record<string, string>),
  };

  const doQueue = async () => {
    await addToRetryQueue(url, method, options?.body as string | undefined, headers);
  };

  // Offline: queue mutations, fail GETs
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    if (mutation) {
      await doQueue();
      throw new Error(OFFLINE_QUEUED_ERROR);
    }
    throw new Error("You are offline. Please check your connection and try again.");
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  } catch (err) {
    // Network failure while "online" (e.g. flaky connection): queue mutations for retry
    const isNetworkError =
      err instanceof TypeError &&
      (err.message === "Failed to fetch" || err.message.includes("network"));
    if (mutation && isNetworkError) {
      await doQueue();
      throw new Error(OFFLINE_QUEUED_ERROR);
    }
    throw err;
  }
}
