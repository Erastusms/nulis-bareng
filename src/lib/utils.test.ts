import { describe, it, expect } from "vitest";
import {
  cn,
  formatDate,
  formatDateMMDDYYYY,
  generateWorkspaceUrlIdentifier,
  getSafeReturnUrl,
  sanitizeUsername,
  truncate,
} from "./utils";

describe("Shared Utilities", () => {
  describe("cn (classnames)", () => {
    it("should combine simple classes", () => {
      expect(cn("px-2", "py-1")).toBe("px-2 py-1");
    });

    it("should resolve conflicting tailwind classes correctly", () => {
      expect(cn("p-4", "p-2")).toBe("p-2");
      expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    });

    it("should handle conditionals and falsy values", () => {
      const isHidden = false;
      const isVisible = true;
      expect(cn("block", isHidden && "hidden", isVisible && "opacity-100")).toBe(
        "block opacity-100"
      );
    });
  });

  describe("truncate", () => {
    it("should truncate long strings with ellipsis", () => {
      expect(truncate("Hello World Collaborative Workspace", 11)).toBe("Hello World...");
    });

    it("should not truncate strings shorter than maxLength", () => {
      expect(truncate("Hello", 10)).toBe("Hello");
    });
  });

  describe("formatDate", () => {
    it("should format valid ISO date strings", () => {
      const formatted = formatDate("2026-08-16T12:00:00.000Z");
      expect(formatted).toContain("2026");
    });
  });

  describe("getSafeReturnUrl", () => {
    it("should allow valid internal relative paths", () => {
      expect(getSafeReturnUrl("/invitations/token123")).toBe("/invitations/token123");
      expect(getSafeReturnUrl("/workspaces/my-ws")).toBe("/workspaces/my-ws");
      expect(getSafeReturnUrl("/settings?tab=profile")).toBe("/settings?tab=profile");
    });

    it("should return fallback for missing or empty values", () => {
      expect(getSafeReturnUrl(null)).toBe("/");
      expect(getSafeReturnUrl(undefined)).toBe("/");
      expect(getSafeReturnUrl("")).toBe("/");
      expect(getSafeReturnUrl("", "/dashboard")).toBe("/dashboard");
    });

    it("should reject malicious absolute or protocol-relative URLs", () => {
      expect(getSafeReturnUrl("https://evil.com")).toBe("/");
      expect(getSafeReturnUrl("http://evil.com/hack")).toBe("/");
      expect(getSafeReturnUrl("//evil.com")).toBe("/");
      expect(getSafeReturnUrl("/\\evil.com")).toBe("/");
      expect(getSafeReturnUrl("javascript:alert(1)")).toBe("/");
    });
  });

  describe("formatDateMMDDYYYY", () => {
    it("should format date correctly as MMDDYYYY", () => {
      const date = new Date(Date.UTC(2026, 7, 23)); // August is month 7 (0-indexed)
      expect(formatDateMMDDYYYY(date)).toBe("08232026");
    });
  });

  describe("sanitizeUsername", () => {
    it("should convert username to lowercase alphanumeric slug", () => {
      expect(sanitizeUsername("Alex Morgan")).toBe("alex-morgan");
      expect(sanitizeUsername("member123")).toBe("member123");
      expect(sanitizeUsername("Dev_Team#1")).toBe("dev-team-1");
      expect(sanitizeUsername("")).toBe("user");
    });
  });

  describe("generateWorkspaceUrlIdentifier", () => {
    it("should generate {slug}-{username}-{MMDDYYYY}", () => {
      const testDate = new Date(Date.UTC(2026, 7, 23));
      const identifier = generateWorkspaceUrlIdentifier("backend", "member123", testDate);
      expect(identifier).toBe("backend-member123-08232026");
    });

    it("should handle multi-word names and special characters", () => {
      const testDate = new Date(Date.UTC(2026, 7, 23));
      const identifier = generateWorkspaceUrlIdentifier(
        "Product Design",
        "Sam Taylor",
        testDate
      );
      expect(identifier).toBe("product-design-sam-taylor-08232026");
    });
  });
});
