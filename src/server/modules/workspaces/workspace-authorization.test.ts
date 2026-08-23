import { describe, expect, it } from "vitest";
import {
  canInviteMember,
  canUpdateWorkspace,
  evaluateMemberRemoval,
  getWorkspacePermissions,
  normalizeRole,
  WorkspaceAuthorizationService,
} from "./workspace-authorization";
import type { IWorkspaceMemberRepository, WorkspaceMemberRecord } from "@/server/db/repository";

describe("Workspace Authorization & RBAC Policy", () => {
  describe("normalizeRole", () => {
    it("should normalize upper and lowercase role strings correctly", () => {
      expect(normalizeRole("owner")).toBe("OWNER");
      expect(normalizeRole("OWNER")).toBe("OWNER");
      expect(normalizeRole("admin")).toBe("ADMIN");
      expect(normalizeRole("ADMIN")).toBe("ADMIN");
      expect(normalizeRole("member")).toBe("MEMBER");
      expect(normalizeRole("MEMBER")).toBe("MEMBER");
      expect(normalizeRole("unknown")).toBe("MEMBER");
    });
  });

  describe("canUpdateWorkspace policy", () => {
    it("should allow OWNER to update workspace", () => {
      expect(canUpdateWorkspace("OWNER")).toBe(true);
      expect(canUpdateWorkspace("owner")).toBe(true);
    });

    it("should allow ADMIN to update workspace", () => {
      expect(canUpdateWorkspace("ADMIN")).toBe(true);
      expect(canUpdateWorkspace("admin")).toBe(true);
    });

    it("should deny MEMBER from updating workspace", () => {
      expect(canUpdateWorkspace("MEMBER")).toBe(false);
      expect(canUpdateWorkspace("member")).toBe(false);
    });
  });

  describe("canInviteMember policy", () => {
    it("should allow OWNER to invite members", () => {
      expect(canInviteMember("OWNER")).toBe(true);
    });

    it("should allow ADMIN to invite members", () => {
      expect(canInviteMember("ADMIN")).toBe(true);
    });

    it("should deny MEMBER from inviting members", () => {
      expect(canInviteMember("MEMBER")).toBe(false);
    });
  });

  describe("evaluateMemberRemoval policy matrix", () => {
    it("should strictly deny removing the workspace owner regardless of remover role", () => {
      const ownerAttempt = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "OWNER",
        isTargetOwner: true,
        isSelf: false,
      });
      expect(ownerAttempt.allowed).toBe(false);
      expect(ownerAttempt.reason).toContain("workspace owner cannot be removed");

      const adminAttempt = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "OWNER",
        isTargetOwner: true,
        isSelf: false,
      });
      expect(adminAttempt.allowed).toBe(false);
      expect(adminAttempt.reason).toContain("workspace owner cannot be removed");
    });

    it("should strictly deny self-removal via member removal operation", () => {
      const result = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: true,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("cannot remove yourself");
    });

    it("should deny MEMBER from removing any member", () => {
      const result = evaluateMemberRemoval({
        removerRole: "MEMBER",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Members do not have permission");
    });

    it("should deny ADMIN from removing another ADMIN", () => {
      const result = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Admins cannot remove other admins");
    });

    it("should allow ADMIN to remove a MEMBER", () => {
      const result = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(result.allowed).toBe(true);
    });

    it("should allow OWNER to remove an ADMIN", () => {
      const result = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(result.allowed).toBe(true);
    });

    it("should allow OWNER to remove a MEMBER", () => {
      const result = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("getWorkspacePermissions", () => {
    it("should return full permissions for OWNER", () => {
      const perms = getWorkspacePermissions("OWNER");
      expect(perms.isOwner).toBe(true);
      expect(perms.isAdmin).toBe(false);
      expect(perms.canUpdateWorkspace).toBe(true);
      expect(perms.canInviteMembers).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canDeleteWorkspace).toBe(true);
    });

    it("should return administrative permissions for ADMIN", () => {
      const perms = getWorkspacePermissions("ADMIN");
      expect(perms.isOwner).toBe(false);
      expect(perms.isAdmin).toBe(true);
      expect(perms.canUpdateWorkspace).toBe(true);
      expect(perms.canInviteMembers).toBe(true);
      expect(perms.canManageMembers).toBe(true);
      expect(perms.canDeleteWorkspace).toBe(false);
    });

    it("should return view/contribute only permissions for MEMBER", () => {
      const perms = getWorkspacePermissions("MEMBER");
      expect(perms.isOwner).toBe(false);
      expect(perms.isAdmin).toBe(false);
      expect(perms.isMember).toBe(true);
      expect(perms.canUpdateWorkspace).toBe(false);
      expect(perms.canInviteMembers).toBe(false);
      expect(perms.canManageMembers).toBe(false);
      expect(perms.canDeleteWorkspace).toBe(false);
    });
  });

  describe("WorkspaceAuthorizationService", () => {
    const mockMemberRecord: WorkspaceMemberRecord = {
      id: "mem_1",
      workspaceId: "ws_123",
      userId: "user_123",
      role: "MEMBER",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockMemberRepo: IWorkspaceMemberRepository = {
      findByWorkspaceAndUser: async (workspaceId, userId) => {
        if (workspaceId === "ws_123" && userId === "user_123") {
          return mockMemberRecord;
        }
        return null;
      },
      findMembersByWorkspaceId: async () => [],
      create: async () => mockMemberRecord,
      updateRole: async () => mockMemberRecord,
      delete: async () => true,
      countByWorkspaceId: async () => 1,
    };

    const authService = new WorkspaceAuthorizationService(mockMemberRepo);

    it("should grant access for valid workspace member", async () => {
      const context = await authService.requireWorkspaceAccess("user_123", "ws_123");
      expect(context.member.id).toBe("mem_1");
      expect(context.role).toBe("MEMBER");
    });

    it("should throw ForbiddenError when user is not a member of workspace", async () => {
      await expect(
        authService.requireWorkspaceAccess("other_user", "ws_123")
      ).rejects.toThrow("You do not have access to this workspace.");
    });

    it("should allow role when role matches required list", async () => {
      const context = await authService.requireWorkspaceRole("user_123", "ws_123", [
        "MEMBER",
        "ADMIN",
      ]);
      expect(context.role).toBe("MEMBER");
    });

    it("should throw ForbiddenError when user lacks required role", async () => {
      await expect(
        authService.requireWorkspaceRole("user_123", "ws_123", ["OWNER", "ADMIN"])
      ).rejects.toThrow("You do not have sufficient permissions");
    });
  });
});
