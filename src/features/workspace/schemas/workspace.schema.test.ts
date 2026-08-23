import { describe, it, expect } from "vitest";
import {
  createWorkspaceSchema,
  inviteMemberSchema,
  updateWorkspaceSchema,
} from "./workspace.schema";

describe("Workspace Schema Validation", () => {
  describe("createWorkspaceSchema", () => {
    it("should validate a correct workspace payload", () => {
      const input = {
        name: "Acme Corp",
        slug: "acme-corp",
        description: "Company primary workspace",
      };

      const result = createWorkspaceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid slug with spaces or uppercase or special characters", () => {
      const input = {
        name: "Acme Corp",
        slug: "Acme Corp!",
      };

      const result = createWorkspaceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("should reject workspace name that is too short", () => {
      const input = {
        name: "A",
        slug: "valid-slug",
      };

      const result = createWorkspaceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("updateWorkspaceSchema", () => {
    it("should allow partial updates", () => {
      const input = {
        name: "New Name",
      };

      const result = updateWorkspaceSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should reject invalid slug on update", () => {
      const input = {
        slug: "invalid slug",
      };

      const result = updateWorkspaceSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe("inviteMemberSchema", () => {
    it("should validate valid email and role", () => {
      const input = {
        email: "colleague@example.com",
        role: "ADMIN",
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("should default role to MEMBER when omitted", () => {
      const input = {
        email: "colleague@example.com",
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.role).toBe("MEMBER");
      }
    });

    it("should reject invalid email format", () => {
      const input = {
        email: "not-an-email",
      };

      const result = inviteMemberSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });
});
