"use client";

/**
 * Offline support utilities for State Fleet.
 * Provides IndexedDB caching, retry queue, and online status detection.
 */

const DB_NAME = "state_fleet_offline";
const DB_VERSION = 1;

// Store names
const STORES = {
  CACHE: "cache",
  RETRY_QUEUE: "retry_queue",
} as const;

interface CacheEntry {
  key: string;
  data: unknown;
  timestamp: number;
  ttl: number; // Time to live in ms
}

interface RetryQueueEntry {
  id: string;
  url: string;
  method: string;
  body?: string;
  headers?: Record<string, string>;
  timestamp: number;
  attempts: number;
  maxAttempts: number;
}

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB for offline storage.
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("Failed to open IndexedDB:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create cache store
      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        const cacheStore = database.createObjectStore(STORES.CACHE, { keyPath: "key" });
        cacheStore.createIndex("timestamp", "timestamp", { unique: false });
      }

      // Create retry queue store
      if (!database.objectStoreNames.contains(STORES.RETRY_QUEUE)) {
        const queueStore = database.createObjectStore(STORES.RETRY_QUEUE, { keyPath: "id" });
        queueStore.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

/**
 * Get cached data by key.
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.CACHE, "readonly");
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if expired
        if (Date.now() > entry.timestamp + entry.ttl) {
          // Delete expired entry
          deleteFromCache(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data as T);
      };
    });
  } catch (error) {
    console.error("Failed to get from cache:", error);
    return null;
  }
}

/**
 * Save data to cache.
 */
export async function saveToCache(
  key: string,
  data: unknown,
  ttl: number = 5 * 60 * 1000 // Default 5 minutes
): Promise<void> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.CACHE, "readwrite");
      const store = transaction.objectStore(STORES.CACHE);

      const entry: CacheEntry = {
        key,
        data,
        timestamp: Date.now(),
        ttl,
      };

      const request = store.put(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to save to cache:", error);
  }
}

/**
 * Delete data from cache.
 */
export async function deleteFromCache(key: string): Promise<void> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.CACHE, "readwrite");
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to delete from cache:", error);
  }
}

/**
 * Clear all cached data.
 */
export async function clearCache(): Promise<void> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.CACHE, "readwrite");
      const store = transaction.objectStore(STORES.CACHE);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to clear cache:", error);
  }
}

/**
 * Add a failed request to the retry queue.
 */
export async function addToRetryQueue(
  url: string,
  method: string,
  body?: string,
  headers?: Record<string, string>,
  maxAttempts: number = 5
): Promise<string> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.RETRY_QUEUE, "readwrite");
      const store = transaction.objectStore(STORES.RETRY_QUEUE);

      const entry: RetryQueueEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(7)}`,
        url,
        method,
        body,
        headers,
        timestamp: Date.now(),
        attempts: 0,
        maxAttempts,
      };

      const request = store.add(entry);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("offline-queue-updated"));
        }
        resolve(entry.id);
      };
    });
  } catch (error) {
    console.error("Failed to add to retry queue:", error);
    throw error;
  }
}

/**
 * Get all entries from the retry queue.
 */
export async function getRetryQueue(): Promise<RetryQueueEntry[]> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.RETRY_QUEUE, "readonly");
      const store = transaction.objectStore(STORES.RETRY_QUEUE);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error("Failed to get retry queue:", error);
    return [];
  }
}

/**
 * Remove an entry from the retry queue.
 */
export async function removeFromRetryQueue(id: string): Promise<void> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.RETRY_QUEUE, "readwrite");
      const store = transaction.objectStore(STORES.RETRY_QUEUE);
      const request = store.delete(id);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("Failed to remove from retry queue:", error);
  }
}

/**
 * Update retry count for a queue entry.
 */
export async function updateRetryAttempt(id: string): Promise<void> {
  try {
    const database = await initOfflineDB();
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORES.RETRY_QUEUE, "readwrite");
      const store = transaction.objectStore(STORES.RETRY_QUEUE);
      const getRequest = store.get(id);

      getRequest.onerror = () => reject(getRequest.error);
      getRequest.onsuccess = () => {
        const entry = getRequest.result as RetryQueueEntry | undefined;
        if (!entry) {
          resolve();
          return;
        }

        entry.attempts += 1;
        const putRequest = store.put(entry);
        putRequest.onerror = () => reject(putRequest.error);
        putRequest.onsuccess = () => resolve();
      };
    });
  } catch (error) {
    console.error("Failed to update retry attempt:", error);
  }
}

/**
 * Process the retry queue when back online.
 */
export async function processRetryQueue(): Promise<{ success: number; failed: number }> {
  if (!navigator.onLine) {
    return { success: 0, failed: 0 };
  }

  const queue = await getRetryQueue();
  let success = 0;
  let failed = 0;

  for (const entry of queue) {
    if (entry.attempts >= entry.maxAttempts) {
      // Max attempts reached, remove from queue
      await removeFromRetryQueue(entry.id);
      failed++;
      continue;
    }

    try {
      const response = await fetch(entry.url, {
        method: entry.method,
        body: entry.body,
        headers: entry.headers,
      });

      if (response.ok) {
        await removeFromRetryQueue(entry.id);
        success++;
      } else if (response.status >= 400 && response.status < 500) {
        // Client error, don't retry
        await removeFromRetryQueue(entry.id);
        failed++;
      } else {
        await updateRetryAttempt(entry.id);
      }
    } catch {
      await updateRetryAttempt(entry.id);
    }
  }

  return { success, failed };
}

/**
 * Check if the browser is online.
 */
export function isOnline(): boolean {
  if (typeof window === "undefined") return true;
  return navigator.onLine;
}

/**
 * Get the number of pending items in the retry queue.
 */
export async function getRetryQueueCount(): Promise<number> {
  const queue = await getRetryQueue();
  return queue.length;
}
