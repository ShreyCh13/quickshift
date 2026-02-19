"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { processRetryQueue, getRetryQueueCount } from "@/lib/offline";

interface UseOnlineStatusReturn {
  isOnline: boolean;
  pendingCount: number;
  syncPending: () => Promise<{ success: number; failed: number }>;
}

/**
 * Hook to track online/offline status and manage retry queue.
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  const queryClient = useQueryClient();

  useEffect(() => {
    // Set initial state
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when back online, then refresh cached data
      processRetryQueue().then(({ success }) => {
        if (success > 0) {
          queryClient.invalidateQueries();
        }
        return getRetryQueueCount();
      }).then(setPendingCount);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const refreshPendingCount = () => {
      getRetryQueueCount().then(setPendingCount);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("offline-queue-updated", refreshPendingCount);

    getRetryQueueCount().then(setPendingCount);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("offline-queue-updated", refreshPendingCount);
    };
  }, [queryClient]);

  const syncPending = useCallback(async () => {
    const result = await processRetryQueue();
    const count = await getRetryQueueCount();
    setPendingCount(count);
    return result;
  }, []);

  return {
    isOnline,
    pendingCount,
    syncPending,
  };
}

export default useOnlineStatus;
