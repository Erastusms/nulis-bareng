import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("Environment Configuration (env.ts)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should successfully validate valid environment variables on server", async () => {
    (process.env as Record<string, string>).NODE_ENV = "test";
    process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/test";
    process.env.AUTH_SECRET = "secret-key-at-least-16-characters-long";
    process.env.NEXT_PUBLIC_APP_NAME = "NulisBareng";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000/api";
    process.env.NEXT_PUBLIC_ENABLE_REALTIME = "false";

    const { validateEnv } = await import("./env");
    const validated = validateEnv(true);

    expect(validated.NEXT_PUBLIC_APP_NAME).toBe("NulisBareng");
    expect(validated.NEXT_PUBLIC_ENABLE_REALTIME).toBe(false);
    expect(validated.DATABASE_URL).toBe("postgresql://postgres:postgres@localhost:5432/test");
  });

  it("should throw an error when DATABASE_URL is missing on server", async () => {
    process.env.DATABASE_URL = "";
    process.env.AUTH_SECRET = "secret-key-at-least-16-characters-long";

    const { validateEnv } = await import("./env");
    expect(() => validateEnv(true)).toThrow("Invalid server environment configuration.");
  });

  it("should throw an error when AUTH_SECRET is too short", async () => {
    process.env.DATABASE_URL = "postgresql://localhost:5432/test";
    process.env.AUTH_SECRET = "short";

    const { validateEnv } = await import("./env");
    expect(() => validateEnv(true)).toThrow("Invalid server environment configuration.");
  });

  it("should validate client variables without requiring server secrets when client-side", async () => {
    process.env.NEXT_PUBLIC_APP_NAME = "NulisBareng Client";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3000/api";

    const { validateEnv } = await import("./env");
    const validated = validateEnv(false);

    expect(validated.NEXT_PUBLIC_APP_NAME).toBe("NulisBareng Client");
    expect(validated.DATABASE_URL).toBe("");
  });
});
