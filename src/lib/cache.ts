/**
 * Server-side in-memory cache with TTL support
 * Used to reduce database load for frequently accessed data
 */

interface CacheEntry<T> {
  data: T;
  expires: number;
  createdAt: number;
}

// Global cache store (persists across requests in the same Node process)
const cache = new Map<string, CacheEntry<unknown>>();

// In-flight requests to prevent duplicate fetches (race condition fix)
const inFlightRequests = new Map<string, Promise<unknown>>();

// Cache statistics for monitoring
let cacheHits = 0;
let cacheMisses = 0;

// Maximum cache size to prevent unbounded growth
const MAX_CACHE_SIZE = 1000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Auto-cleanup timer (initialized lazily)
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Start automatic cache cleanup if not already running
 */
function ensureCleanupScheduled(): void {
  if (cleanupTimer === null) {
    cleanupTimer = setInterval(() => {
      cleanupExpired();
      // Also enforce max size by removing oldest entries
      if (cache.size > MAX_CACHE_SIZE) {
        const entries = Array.from(cache.entries());
        entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
        const toRemove = entries.slice(0, cache.size - MAX_CACHE_SIZE);
        for (const [key] of toRemove) {
          cache.delete(key);
        }
      }
    }, CLEANUP_INTERVAL_MS);
    // Don't prevent Node from exiting
    if (cleanupTimer.unref) {
      cleanupTimer.unref();
    }
  }
}

/**
 * Get cached data by key
 * @returns Cached data if valid, null if expired or not found
 */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  
  if (!entry) {
    cacheMisses++;
    return null;
  }
  
  // Check if expired
  if (Date.now() > entry.expires) {
    cache.delete(key);
    cacheMisses++;
    return null;
  }
  
  cacheHits++;
  return entry.data as T;
}

/**
 * Set cache data with TTL
 * @param key Cache key
 * @param data Data to cache
 * @param ttlMs Time to live in milliseconds
 */
export function setCache<T>(key: string, data: T, ttlMs: number): void {
  // Ensure cleanup is scheduled
  ensureCleanupScheduled();
  
  const now = Date.now();
  cache.set(key, {
    data,
    expires: now + ttlMs,
    createdAt: now,
  });
}

/**
 * Get or set cache - helper for common pattern
 * Prevents duplicate fetches for concurrent requests (race condition safe)
 * @param key Cache key
 * @param ttlMs Time to live in milliseconds
 * @param fetcher Async function to fetch data if not cached
 */
export async function getOrSetCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // Check cache first
  const cached = getCached<T>(key);
  if (cached !== null) {
    return cached;
  }
  
  // Check if there's already an in-flight request for this key
  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    return inFlight as Promise<T>;
  }
  
  // Create new request and track it
  const request = (async () => {
    try {
      const data = await fetcher();
      setCache(key, data, ttlMs);
      return data;
    } finally {
      // Always remove from in-flight when done
      inFlightRequests.delete(key);
    }
  })();
  
  inFlightRequests.set(key, request);
  return request;
}

/**
 * Invalidate cache entries matching a prefix pattern
 * @param prefix Key prefix to match
 */
export function invalidateCache(prefix: string): number {
  let count = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      count++;
    }
  }
  return count;
}

/**
 * Invalidate a specific cache key
 */
export function invalidateCacheKey(key: string): boolean {
  return cache.delete(key);
}

/**
 * Clear the entire cache
 */
export function clearCache(): void {
  cache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
} {
  const total = cacheHits + cacheMisses;
  return {
    size: cache.size,
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: total > 0 ? cacheHits / total : 0,
  };
}

/**
 * Clean up expired entries (call periodically if needed)
 */
export function cleanupExpired(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expires) {
      cache.delete(key);
      cleaned++;
    }
  }
  
  return cleaned;
}

// Cache key generators for consistent naming
export const cacheKeys = {
  vehicles: (filters?: string) => `vehicles:${filters || 'all'}`,
  vehicleDropdown: () => 'vehicles:dropdown',
  remarkFields: () => 'remark_fields:active',
  analytics: (filters: string) => `analytics:${filters}`,
  userById: (id: string) => `user:${id}`,
};
