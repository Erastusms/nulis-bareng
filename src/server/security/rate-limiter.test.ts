import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter, getClientIp } from "./rate-limiter";
import { RateLimitError } from "@/lib/api/errors";

describe("RateLimiter Service", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
    limiter.reset();
  });

  it("should allow requests under the maximum limit", async () => {
    const config = { maxRequests: 3, windowMs: 1000 };
    const key = "ip:192.168.1.1:login";

    const res1 = await limiter.checkRateLimit(key, config);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await limiter.checkRateLimit(key, config);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await limiter.checkRateLimit(key, config);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it("should reject requests exceeding the maximum limit", async () => {
    const config = { maxRequests: 2, windowMs: 1000 };
    const key = "ip:192.168.1.2:login";

    await limiter.checkRateLimit(key, config);
    await limiter.checkRateLimit(key, config);

    const res3 = await limiter.checkRateLimit(key, config);
    expect(res3.success).toBe(false);
    expect(res3.remaining).toBe(0);
    expect(res3.resetTime).toBeGreaterThan(Date.now());
  });

  it("should throw RateLimitError on enforce when limit is exceeded", async () => {
    const config = { maxRequests: 1, windowMs: 1000 };
    const key = "ip:192.168.1.3:auth";

    await expect(limiter.enforce(key, config)).resolves.toBeDefined();
    await expect(limiter.enforce(key, config)).rejects.toThrow(RateLimitError);
  });

  it("should isolate rate limits across different keys", async () => {
    const config = { maxRequests: 1, windowMs: 1000 };

    const resA1 = await limiter.checkRateLimit("user:user_1", config);
    expect(resA1.success).toBe(true);

    const resA2 = await limiter.checkRateLimit("user:user_1", config);
    expect(resA2.success).toBe(false);

    // Different user should still be allowed
    const resB1 = await limiter.checkRateLimit("user:user_2", config);
    expect(resB1.success).toBe(true);
  });

  it("should reset window after windowMs duration", async () => {
    const config = { maxRequests: 1, windowMs: 50 };
    const key = "ip:192.168.1.4:test";

    const res1 = await limiter.checkRateLimit(key, config);
    expect(res1.success).toBe(true);

    const res2 = await limiter.checkRateLimit(key, config);
    expect(res2.success).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    const res3 = await limiter.checkRateLimit(key, config);
    expect(res3.success).toBe(true);
  });

  describe("getClientIp helper", () => {
    it("should extract client IP from x-forwarded-for header", () => {
      const req = new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("should extract client IP from x-real-ip header", () => {
      const req = new Request("http://localhost/api/auth/login", {
        headers: { "x-real-ip": "198.51.100.4" },
      });
      expect(getClientIp(req)).toBe("198.51.100.4");
    });

    it("should fallback to default local IP when headers are missing", () => {
      const req = new Request("http://localhost/api/auth/login");
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });
});
