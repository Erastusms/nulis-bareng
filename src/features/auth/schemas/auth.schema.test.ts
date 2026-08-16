import { describe, expect, it } from "vitest";
import { loginSchema, registerFormSchema, registerSchema } from "./auth.schema";

describe("Authentication Schemas (auth.schema.ts)", () => {
  describe("loginSchema", () => {
    it("should accept valid credentials and normalize email", () => {
      const result = loginSchema.safeParse({
        email: "  User@Example.COM  ",
        password: "Password123!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("user@example.com");
        expect(result.data.password).toBe("Password123!");
      }
    });

    it("should reject invalid email format", () => {
      const result = loginSchema.safeParse({
        email: "not-an-email",
        password: "Password123!",
      });

      expect(result.success).toBe(false);
    });

    it("should reject password shorter than 8 characters", () => {
      const result = loginSchema.safeParse({
        email: "test@example.com",
        password: "short",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("registerSchema", () => {
    it("should accept valid registration input", () => {
      const result = registerSchema.safeParse({
        name: "  Alex Morgan  ",
        email: "alex@example.com",
        password: "Password123!",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Alex Morgan");
        expect(result.data.email).toBe("alex@example.com");
      }
    });

    it("should reject name shorter than 2 characters", () => {
      const result = registerSchema.safeParse({
        name: "A",
        email: "alex@example.com",
        password: "Password123!",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("registerFormSchema", () => {
    it("should accept when passwords match", () => {
      const result = registerFormSchema.safeParse({
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "Password123!",
        confirmPassword: "Password123!",
      });

      expect(result.success).toBe(true);
    });

    it("should reject when password confirmation does not match", () => {
      const result = registerFormSchema.safeParse({
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "Password123!",
        confirmPassword: "DifferentPassword123!",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.flatten().fieldErrors;
        expect(errors.confirmPassword).toContain("Passwords do not match");
      }
    });
  });
});
