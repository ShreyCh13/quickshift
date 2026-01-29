/**
 * Server-side rate limiting utility
 * Protects API endpoints from abuse and brute force attacks
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Store for rate limit tracking (in-memory, resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Blocked IPs (for repeated violations)
const blockedIps = new Map<string, number>(); // IP -> blocked until timestamp

// Maximum store size to prevent unbounded growth
const MAX_STORE_SIZE = 10000;

// Cleanup interval (5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Auto-cleanup timer (initialized lazily)
let cleanupTimer: NodeJS.Timeout | null = null;

/**
 * Start automatic rate limit cleanup if not already running
 */
function ensureCleanupScheduled(): void {
  if (cleanupTimer === null) {
    cleanupTimer = setInterval(() => {
      cleanupRateLimits();
      // Also enforce max size by removing oldest entries
      if (rateLimitStore.size > MAX_STORE_SIZE) {
        const entries = Array.from(rateLimitStore.entries());
        entries.sort((a, b) => a[1].resetAt - b[1].resetAt);
        const toRemove = entries.slice(0, rateLimitStore.size - MAX_STORE_SIZE);
        for (const [key] of toRemove) {
          rateLimitStore.delete(key);
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
 * Check rate limit for an identifier (IP, user ID, etc.)
 * @param identifier Unique identifier for the client
 * @param limit Maximum requests allowed in the window
 * @param windowMs Time window in milliseconds
 * @returns Object with allowed status and remaining requests
 */
export function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
} {
  // Ensure cleanup is scheduled
  ensureCleanupScheduled();
  
  const now = Date.now();
  
  // Check if IP is blocked
  const blockedUntil = blockedIps.get(identifier);
  if (blockedUntil && now < blockedUntil) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: blockedUntil,
      retryAfterMs: blockedUntil - now,
    };
  } else if (blockedUntil) {
    // Unblock if time has passed
    blockedIps.delete(identifier);
  }
  
  const entry = rateLimitStore.get(identifier);
  
  // If no entry or window expired, create new entry
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    rateLimitStore.set(identifier, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: limit - 1,
      resetAt,
      retryAfterMs: 0,
    };
  }
  
  // Check if limit exceeded
  if (entry.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
      retryAfterMs: entry.resetAt - now,
    };
  }
  
  // Increment count
  entry.count++;
  return {
    allowed: true,
    remaining: limit - entry.count,
    resetAt: entry.resetAt,
    retryAfterMs: 0,
  };
}

/**
 * Block an IP temporarily (for security violations)
 * @param ip IP address to block
 * @param durationMs How long to block
 */
export function blockIp(ip: string, durationMs: number): void {
  blockedIps.set(ip, Date.now() + durationMs);
}

/**
 * Check if an IP is blocked
 */
export function isIpBlocked(ip: string): boolean {
  const blockedUntil = blockedIps.get(ip);
  if (!blockedUntil) return false;
  if (Date.now() >= blockedUntil) {
    blockedIps.delete(ip);
    return false;
  }
  return true;
}

/**
 * Get client IP from request (handles proxies)
 */
export function getClientIp(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP in the chain (original client)
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  
  // Fallback - use a hash of user agent + some header as fallback
  // In production with Vercel, x-forwarded-for should always be present
  return 'unknown';
}

/**
 * Create a rate limit key combining IP and optional user ID
 */
export function createRateLimitKey(
  ip: string,
  endpoint: string,
  userId?: string
): string {
  if (userId) {
    return `${endpoint}:user:${userId}`;
  }
  return `${endpoint}:ip:${ip}`;
}

/**
 * Clean up expired rate limit entries (call periodically)
 */
export function cleanupRateLimits(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }
  
  // Also clean up blocked IPs
  for (const [ip, blockedUntil] of blockedIps.entries()) {
    if (now > blockedUntil) {
      blockedIps.delete(ip);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Get rate limit statistics
 */
export function getRateLimitStats(): {
  activeEntries: number;
  blockedIps: number;
} {
  return {
    activeEntries: rateLimitStore.size,
    blockedIps: blockedIps.size,
  };
}

/**
 * Rate limit presets for common use cases
 */
export const rateLimitPresets = {
  // Login: strict limits to prevent brute force
  login: { limit: 5, windowMs: 15 * 60 * 1000 }, // 5 attempts per 15 minutes
  
  // Password reset: very strict
  passwordReset: { limit: 3, windowMs: 60 * 60 * 1000 }, // 3 attempts per hour
  
  // API reads: generous limits
  apiRead: { limit: 100, windowMs: 60 * 1000 }, // 100 requests per minute
  
  // API writes: moderate limits
  apiWrite: { limit: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  
  // Export: strict to prevent abuse
  export: { limit: 10, windowMs: 5 * 60 * 1000 }, // 10 exports per 5 minutes
  
  // Import: very strict (heavy operation)
  import: { limit: 5, windowMs: 5 * 60 * 1000 }, // 5 imports per 5 minutes
};

/**
 * Helper to create NextResponse with rate limit headers
 */
export function rateLimitHeaders(result: ReturnType<typeof checkRateLimit>): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.remaining + 1),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.retryAfterMs > 0 ? { 'Retry-After': String(Math.ceil(result.retryAfterMs / 1000)) } : {}),
  };
}
