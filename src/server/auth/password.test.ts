import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("Password Hashing & Verification (password.ts)", () => {
  it("should securely hash a plaintext password", async () => {
    const rawPassword = "SuperSecretPassword123!";
    const hash = await hashPassword(rawPassword);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(rawPassword);
    expect(hash.startsWith("$2a$") || hash.startsWith("$2b$")).toBe(true);
  });

  it("should verify a matching password correctly", async () => {
    const rawPassword = "ValidPassword123!";
    const hash = await hashPassword(rawPassword);

    const isValid = await verifyPassword(rawPassword, hash);
    expect(isValid).toBe(true);
  });

  it("should reject an incorrect password", async () => {
    const rawPassword = "CorrectPassword123!";
    const wrongPassword = "WrongPassword123!";
    const hash = await hashPassword(rawPassword);

    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it("should generate distinct hashes for identical passwords due to unique salts", async () => {
    const password = "SamePassword123!";
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);

    expect(hash1).not.toBe(hash2);
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it("should handle empty or missing inputs safely without throwing", async () => {
    expect(await verifyPassword("", "")).toBe(false);
    expect(await verifyPassword("test", "")).toBe(false);
    expect(await verifyPassword("", "some-hash")).toBe(false);
  });
});
