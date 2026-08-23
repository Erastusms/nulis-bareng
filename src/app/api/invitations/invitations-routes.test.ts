import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getInvitationHandler } from "./[token]/route";
import { POST as acceptInvitationHandler } from "./[token]/accept/route";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";
import * as currentUserModule from "@/server/auth/current-user";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { User } from "@/types/domain";

describe("Invitation API Route Handlers", () => {
  const mockUser: User = {
    id: "user_newbie",
    name: "Newbie User",
    email: "newbie@example.com",
    avatarUrl: null,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  const mockInvitationDetails = {
    id: "inv_123",
    workspaceId: "ws_acme",
    workspaceName: "Acme Corp",
    workspaceSlug: "acme-corp",
    inviterName: "Alex Morgan",
    email: "newbie@example.com",
    role: "MEMBER" as const,
    status: "PENDING" as const,
    isExpired: false,
    expiresAt: "2026-08-23T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("GET /api/invitations/[token]", () => {
    it("should return 200 with invitation preview details for valid token", async () => {
      vi.spyOn(workspaceMemberService, "getInvitationByToken").mockResolvedValue(
        mockInvitationDetails
      );

      const request = new NextRequest("http://localhost:3000/api/invitations/valid_token");
      const context = { params: Promise.resolve({ token: "valid_token" }) };

      const response = await getInvitationHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.workspaceName).toBe("Acme Corp");
      expect(data.data.inviterName).toBe("Alex Morgan");
    });

    it("should return 404 when token is not found", async () => {
      vi.spyOn(workspaceMemberService, "getInvitationByToken").mockRejectedValue(
        new NotFoundError("Invitation", "invalid_token")
      );

      const request = new NextRequest("http://localhost:3000/api/invitations/invalid_token");
      const context = { params: Promise.resolve({ token: "invalid_token" }) };

      const response = await getInvitationHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /api/invitations/[token]/accept", () => {
    it("should return 200 with workspaceId upon successful acceptance", async () => {
      vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
      vi.spyOn(workspaceMemberService, "acceptInvitation").mockResolvedValue({
        workspaceId: "ws_acme",
      });

      const request = new NextRequest(
        "http://localhost:3000/api/invitations/valid_token/accept",
        { method: "POST" }
      );
      const context = { params: Promise.resolve({ token: "valid_token" }) };

      const response = await acceptInvitationHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.workspaceId).toBe("ws_acme");
    });

    it("should return 403 when user email does not match invitation recipient", async () => {
      vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
      vi.spyOn(workspaceMemberService, "acceptInvitation").mockRejectedValue(
        new ForbiddenError(
          "This invitation was sent to someoneelse@example.com. Please sign in with that account to accept."
        )
      );

      const request = new NextRequest(
        "http://localhost:3000/api/invitations/other_token/accept",
        { method: "POST" }
      );
      const context = { params: Promise.resolve({ token: "other_token" }) };

      const response = await acceptInvitationHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("FORBIDDEN");
    });

    it("should return 409 when invitation has already been accepted", async () => {
      vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
      vi.spyOn(workspaceMemberService, "acceptInvitation").mockRejectedValue(
        new ConflictError("This invitation has already been accepted.")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/invitations/used_token/accept",
        { method: "POST" }
      );
      const context = { params: Promise.resolve({ token: "used_token" }) };

      const response = await acceptInvitationHandler(request, context);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("CONFLICT");
    });
  });
});
