import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getWorkspacesHandler, POST as createWorkspaceHandler } from "./route";
import {
  GET as getWorkspaceByIdHandler,
  PATCH as updateWorkspaceHandler,
  DELETE as deleteWorkspaceHandler,
} from "./[id]/route";
import {
  GET as getMembersHandler,
  POST as inviteMemberHandler,
} from "./[id]/members/route";
import { DELETE as removeMemberHandler } from "./[id]/members/[userId]/route";
import { workspaceService } from "@/server/modules/workspaces/workspace.service";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";
import * as currentUserModule from "@/server/auth/current-user";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { User, Workspace, WorkspaceMember } from "@/types/domain";

describe("Workspace & RBAC API Route Handlers", () => {
  const mockUser: User = {
    id: "user_alex",
    name: "Alex Morgan",
    email: "alex@example.com",
    avatarUrl: null,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  const mockWorkspace: Workspace = {
    id: "ws_acme",
    name: "Acme Corp",
    slug: "acme-corp",
    urlIdentifier: "acme-corp-alex-morgan-08232026",
    description: "Main workspace",
    ownerId: "user_alex",
    role: "OWNER",
    currentUserRole: "OWNER",
    memberCount: 1,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  const mockMember: WorkspaceMember = {
    id: "mem_1",
    workspaceId: "ws_acme",
    userId: "user_alex",
    role: "OWNER",
    joinedAt: "2026-08-16T12:00:00.000Z",
    user: mockUser,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
  });

  describe("GET /api/workspaces", () => {
    it("should return 200 with user's workspaces", async () => {
      vi.spyOn(workspaceService, "getUserWorkspaces").mockResolvedValue([mockWorkspace]);

      const response = await getWorkspacesHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe("ws_acme");
    });
  });

  describe("POST /api/workspaces", () => {
    it("should return 201 on valid workspace creation", async () => {
      vi.spyOn(workspaceService, "createWorkspace").mockResolvedValue(mockWorkspace);

      const request = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corp",
          slug: "acme-corp",
          description: "Main workspace",
        }),
      });

      const response = await createWorkspaceHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Acme Corp");
    });

    it("should return 400 when input validation fails", async () => {
      const request = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "A", // too short
          slug: "INVALID SLUG WITH SPACES",
        }),
      });

      const response = await createWorkspaceHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });

    it("should return 409 when slug conflicts", async () => {
      vi.spyOn(workspaceService, "createWorkspace").mockRejectedValue(
        new ConflictError("Workspace with slug 'acme-corp' already exists.")
      );

      const request = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Acme Corp",
          slug: "acme-corp",
        }),
      });

      const response = await createWorkspaceHandler(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("CONFLICT");
    });
  });

  describe("GET /api/workspaces/[id]", () => {
    it("should return 200 with workspace detail for authorized user", async () => {
      vi.spyOn(workspaceService, "getWorkspaceById").mockResolvedValue(mockWorkspace);

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_acme");
      const context = { params: Promise.resolve({ id: "ws_acme" }) };

      const response = await getWorkspaceByIdHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("ws_acme");
    });

    it("should return 403 when user lacks workspace access", async () => {
      vi.spyOn(workspaceService, "getWorkspaceById").mockRejectedValue(
        new ForbiddenError("You do not have access to this workspace.")
      );

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_secret");
      const context = { params: Promise.resolve({ id: "ws_secret" }) };

      const response = await getWorkspaceByIdHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("FORBIDDEN");
    });
  });

  describe("PATCH /api/workspaces/[id]", () => {
    it("should return 200 on successful update", async () => {
      vi.spyOn(workspaceService, "updateWorkspace").mockResolvedValue({
        ...mockWorkspace,
        name: "Acme Updated",
      });

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_acme", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Acme Updated" }),
      });
      const context = { params: Promise.resolve({ id: "ws_acme" }) };

      const response = await updateWorkspaceHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.name).toBe("Acme Updated");
    });
  });

  describe("DELETE /api/workspaces/[id]", () => {
    it("should return 200 on successful workspace deletion", async () => {
      vi.spyOn(workspaceService, "deleteWorkspace").mockResolvedValue(true);

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_acme", {
        method: "DELETE",
      });
      const context = { params: Promise.resolve({ id: "ws_acme" }) };

      const response = await deleteWorkspaceHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("GET /api/workspaces/[id]/members", () => {
    it("should return 200 with members list", async () => {
      vi.spyOn(workspaceMemberService, "listMembers").mockResolvedValue([mockMember]);

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_acme/members");
      const context = { params: Promise.resolve({ id: "ws_acme" }) };

      const response = await getMembersHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
    });
  });

  describe("POST /api/workspaces/[id]/members", () => {
    it("should return 201 on valid member invitation", async () => {
      vi.spyOn(workspaceMemberService, "inviteMember").mockResolvedValue({
        type: "invitation_created",
        invitation: {
          id: "inv_123",
          email: "colleague@example.com",
          role: "MEMBER",
          expiresAt: "2026-08-23T12:00:00.000Z",
        },
        emailDelivered: true,
      });

      const request = new NextRequest("http://localhost:3000/api/workspaces/ws_acme/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "colleague@example.com", role: "MEMBER" }),
      });
      const context = { params: Promise.resolve({ id: "ws_acme" }) };

      const response = await inviteMemberHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
    });
  });

  describe("DELETE /api/workspaces/[id]/members/[userId]", () => {
    it("should return 200 on successful member removal", async () => {
      vi.spyOn(workspaceMemberService, "removeMember").mockResolvedValue(true);

      const request = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_acme/members/user_target",
        { method: "DELETE" }
      );
      const context = {
        params: Promise.resolve({ id: "ws_acme", userId: "user_target" }),
      };

      const response = await removeMemberHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("should return 404 when target member not found", async () => {
      vi.spyOn(workspaceMemberService, "removeMember").mockRejectedValue(
        new NotFoundError("WorkspaceMember", "user_target")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_acme/members/user_target",
        { method: "DELETE" }
      );
      const context = {
        params: Promise.resolve({ id: "ws_acme", userId: "user_target" }),
      };

      const response = await removeMemberHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
    });
  });
});
