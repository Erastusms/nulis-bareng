import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  generateSessionToken,
  getSessionExpiration,
  isSessionExpired,
  SESSION_DURATION_MS,
} from "@/server/auth/session";
import { getSessionCookieOptions } from "@/server/auth/cookies";
import { serializeUser } from "@/server/auth/user-serializer";
import { errorResponse } from "@/server/api/route-handler";
import { UnauthorizedError } from "@/lib/api/errors";

describe("Authentication & Credentials Security Audit (Unit)", () => {
  describe("Password Hashing & Verification", () => {
    it("should produce different bcrypt hashes for the same password due to unique salt generation", async () => {
      const password = "SuperSecretPassword123!";
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1).not.toEqual(hash2);
      expect(hash1.startsWith("$2")).toBe(true);
      expect(hash2.startsWith("$2")).toBe(true);

      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });

    it("should strictly reject incorrect passwords without throwing exceptions", async () => {
      const hash = await hashPassword("CorrectPassword123!");
      expect(await verifyPassword("WrongPassword123!", hash)).toBe(false);
      expect(await verifyPassword("", hash)).toBe(false);
    });
  });

  describe("Session Token Entropy & Lifecycle", () => {
    it("should generate cryptographically random 256-bit (64 hex characters) session tokens", () => {
      const token1 = generateSessionToken();
      const token2 = generateSessionToken();

      expect(token1).toHaveLength(64);
      expect(token2).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(token1)).toBe(true);
      expect(token1).not.toEqual(token2);
    });

    it("should correctly calculate expiration and detect expired sessions", () => {
      const now = Date.now();
      const expiration = getSessionExpiration(SESSION_DURATION_MS);
      expect(expiration.getTime()).toBeGreaterThanOrEqual(now + SESSION_DURATION_MS - 100);

      // Past date -> expired
      const pastDate = new Date(Date.now() - 1000);
      expect(isSessionExpired(pastDate)).toBe(true);

      // Future date -> valid
      const futureDate = new Date(Date.now() + 10000);
      expect(isSessionExpired(futureDate)).toBe(false);
    });
  });

  describe("Session Cookie Configuration", () => {
    it("should configure strict httpOnly, sameSite lax, and root path cookie options", () => {
      const expires = new Date(Date.now() + 10000);
      const options = getSessionCookieOptions(expires);

      expect(options.name).toBe("nb_session");
      expect(options.httpOnly).toBe(true);
      expect(options.sameSite).toBe("lax");
      expect(options.path).toBe("/");
      expect(options.expires).toEqual(expires);
    });
  });

  describe("User Serialization & Credential Exposure Prevention", () => {
    it("should never expose passwordHash, reset tokens, or private secrets in serialized user", () => {
      const userRecord = {
        id: "usr_100",
        name: "Security Test User",
        email: "sec@example.com",
        emailVerified: null,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890",
        avatarUrl: "https://avatar.example.com/pic.png",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const serialized = serializeUser(userRecord);

      expect(serialized).toHaveProperty("id", "usr_100");
      expect(serialized).toHaveProperty("name", "Security Test User");
      expect(serialized).toHaveProperty("email", "sec@example.com");
      expect(serialized).toHaveProperty("avatarUrl", "https://avatar.example.com/pic.png");

      // Verify sensitive properties are NOT present
      expect((serialized as any).passwordHash).toBeUndefined();
      expect((serialized as any).password).toBeUndefined();
      expect(JSON.stringify(serialized)).not.toContain("$2a$10$");
    });
  });

  describe("Error Response Sanitization", () => {
    it("should return clean client-safe error for AppError without leaking stack traces", async () => {
      const error = new UnauthorizedError("Invalid credentials provided.");
      const response = errorResponse(error);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("UNAUTHORIZED");
      expect(json.error.message).toBe("Invalid credentials provided.");
      expect(json.stack).toBeUndefined();
    });

    it("should sanitize unexpected internal server errors and not leak DB errors or SQL traces", async () => {
      const sensitiveDbError = new Error(
        "prisma:error Connection failed to postgresql://postgres:SuperSecretPass@db.internal:5432/db"
      );
      const response = errorResponse(sensitiveDbError);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
      expect(json.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(json.error.message).toBe("An unexpected error occurred on the server.");
      // Ensure credentials and internal connection strings are NOT in response
      expect(JSON.stringify(json)).not.toContain("SuperSecretPass");
      expect(JSON.stringify(json)).not.toContain("postgresql://");
    });
  });
});
