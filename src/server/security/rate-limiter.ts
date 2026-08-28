import { RateLimitError } from "@/lib/api/errors";
import { getRedisClient } from "@/server/redis/redis-client";

export interface RateLimitConfig {
  /** Maximum allowed requests within the time window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number; // Unix timestamp in ms
}

/** Pre-configured presets for different endpoint categories */
export const RATE_LIMIT_PRESETS = {
  /** Stricter limits for authentication endpoints to prevent brute-force attacks */
  AUTH: { maxRequests: 10, windowMs: 60 * 1000 }, // 10 attempts per minute
  /** Moderately strict limits for sensitive token endpoints */
  TOKEN: { maxRequests: 30, windowMs: 60 * 1000 }, // 30 requests per minute
  /** General API mutation limits */
  MUTATION: { maxRequests: 120, windowMs: 60 * 1000 }, // 120 mutations per minute
  /** Standard read API limits */
  READ: { maxRequests: 300, windowMs: 60 * 1000 }, // 300 reads per minute
} as const;

/**
 * In-memory sliding window store for standalone and development/test environments.
 */
class MemoryRateLimitStore {
  private hits = new Map<string, number[]>();

  async recordHit(key: string, windowMs: number, maxRequests: number): Promise<RateLimitResult> {
    const now = Date.now();
    const windowStart = now - windowMs;

    let timestamps = this.hits.get(key) ?? [];
    // Filter out timestamps outside the active window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      const oldestInWindow = timestamps[0];
      const resetTime = oldestInWindow + windowMs;
      this.hits.set(key, timestamps);
      return {
        success: false,
        limit: maxRequests,
        remaining: 0,
        resetTime,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - timestamps.length,
      resetTime: now + windowMs,
    };
  }

  clear(): void {
    this.hits.clear();
  }
}

export class RateLimiter {
  private memoryStore = new MemoryRateLimitStore();

  /**
   * Checks whether an action under a given key exceeds rate limits.
   * Uses Redis if enabled, falling back safely to local memory store.
   */
  async checkRateLimit(
    key: string,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.AUTH
  ): Promise<RateLimitResult> {
    const redis = getRedisClient();

    if (redis && process.env.ENABLE_REDIS === "true") {
      try {
        const now = Date.now();
        const windowStart = now - config.windowMs;
        const redisKey = `ratelimit:${key}`;

        const multi = redis.multi();
        multi.zremrangebyscore(redisKey, 0, windowStart);
        multi.zcard(redisKey);
        multi.zadd(redisKey, now.toString(), `${now}-${Math.random()}`);
        multi.pexpire(redisKey, config.windowMs);

        const results = await multi.exec();
        if (results && results[1]) {
          const currentCount = (results[1][1] as number) || 0;
          if (currentCount >= config.maxRequests) {
            return {
              success: false,
              limit: config.maxRequests,
              remaining: 0,
              resetTime: now + config.windowMs,
            };
          }

          return {
            success: true,
            limit: config.maxRequests,
            remaining: Math.max(0, config.maxRequests - currentCount - 1),
            resetTime: now + config.windowMs,
          };
        }
      } catch {
        // If Redis command fails, fallback safely to memory store
      }
    }

    return this.memoryStore.recordHit(key, config.windowMs, config.maxRequests);
  }

  /**
   * Enforces rate limiting. Throws RateLimitError if limit is exceeded.
   */
  async enforce(
    key: string,
    config: RateLimitConfig = RATE_LIMIT_PRESETS.AUTH
  ): Promise<RateLimitResult> {
    const result = await this.checkRateLimit(key, config);
    if (!result.success) {
      const retryAfterSeconds = Math.ceil((result.resetTime - Date.now()) / 1000);
      throw new RateLimitError(
        `Too many requests. Please try again in ${Math.max(1, retryAfterSeconds)} seconds.`
      );
    }
    return result;
  }

  /**
   * Clears in-memory rate limit records (useful for test resets).
   */
  reset(): void {
    this.memoryStore.clear();
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Extracts a client identifier (IP address or fallback identifier) from incoming Request.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
