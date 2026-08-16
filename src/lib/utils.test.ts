import { describe, it, expect } from "vitest";
import { cn, formatDate, truncate } from "./utils";

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
});
