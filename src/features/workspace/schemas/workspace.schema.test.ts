import { describe, it, expect } from "vitest";
import { createWorkspaceSchema } from "./workspace.schema";

describe("Workspace Schema Validation", () => {
  it("should validate a correct workspace payload", () => {
    const input = {
      name: "Acme Corp",
      slug: "acme-corp",
      description: "Company primary workspace",
    };

    const result = createWorkspaceSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("should reject invalid slug with uppercase letters or special characters", () => {
    const input = {
      name: "Acme Corp",
      slug: "Acme_Corp!",
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
