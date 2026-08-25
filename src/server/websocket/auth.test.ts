import { describe, it, expect, vi, beforeEach } from "vitest";
import type { IncomingMessage } from "http";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import {
  authenticateWebSocket,
  authorizeWorkspaceSubscription,
  extractSessionToken,
} from "./auth";

describe("WebSocket Authentication & Authorization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractSessionToken", () => {
    it("should extract token from Cookie header", () => {
      const req = {
        headers: {
          cookie: `other=123; ${SESSION_COOKIE_NAME}=test_token_abc; theme=dark`,
        },
      } as unknown as IncomingMessage;

      expect(extractSessionToken(req)).toBe("test_token_abc");
    });

    it("should extract token from Authorization header", () => {
      const req = {
        headers: {
          authorization: "Bearer bearer_token_xyz",
        },
      } as unknown as IncomingMessage;

      expect(extractSessionToken(req)).toBe("bearer_token_xyz");
    });

    it("should extract token from URL query params", () => {
      const req = {
        headers: {},
        url: "/?token=query_token_123",
      } as unknown as IncomingMessage;

      expect(extractSessionToken(req)).toBe("query_token_123");
    });

    it("should return null if no token is found", () => {
      const req = {
        headers: {},
        url: "/",
      } as unknown as IncomingMessage;

      expect(extractSessionToken(req)).toBeNull();
    });
  });

  describe("authenticateWebSocket", () => {
    it("should return User on valid session", async () => {
      const mockUser = {
        id: "usr_1",
        email: "user@example.com",
        name: "Test User",
        avatarUrl: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      vi.spyOn(authService, "validateSession").mockResolvedValue({
        user: mockUser,
        session: {
          id: "sess_1",
          sessionToken: "valid_token",
          userId: "usr_1",
          expiresAt: new Date(Date.now() + 100000),
          createdAt: new Date(),
        },
      });

      const req = {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=valid_token`,
        },
      } as unknown as IncomingMessage;

      const user = await authenticateWebSocket(req);
      expect(user).toEqual(mockUser);
    });

    it("should return null on invalid/expired session", async () => {
      vi.spyOn(authService, "validateSession").mockResolvedValue(null);

      const req = {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=expired_token`,
        },
      } as unknown as IncomingMessage;

      const user = await authenticateWebSocket(req);
      expect(user).toBeNull();
    });
  });

  describe("authorizeWorkspaceSubscription", () => {
    it("should return authorized: true if user is a member of the workspace", async () => {
      vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue({
        id: "ws_123",
        name: "Workspace 123",
        slug: "ws-123",
        urlIdentifier: "ws-url-123",
        description: null,
        ownerId: "usr_1",
        createdAt: new Date(),
        updatedAt: new Date(),
        memberCount: 1,
      });

      vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockResolvedValue({
        id: "mem_1",
        workspaceId: "ws_123",
        userId: "usr_1",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const authResult = await authorizeWorkspaceSubscription("usr_1", "ws-url-123");
      expect(authResult.authorized).toBe(true);
      expect(authResult.workspaceId).toBe("ws_123");
      expect(authResult.urlIdentifier).toBe("ws-url-123");
    });

    it("should return authorized: false if workspace not found", async () => {
      vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue(null);

      const authResult = await authorizeWorkspaceSubscription("usr_1", "ws_nonexistent");
      expect(authResult.authorized).toBe(false);
    });

    it("should return authorized: false if user is not a member of the workspace", async () => {
      vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue({
        id: "ws_123",
        name: "Workspace 123",
        slug: "ws-123",
        urlIdentifier: "ws-url-123",
        description: null,
        ownerId: "usr_other",
        createdAt: new Date(),
        updatedAt: new Date(),
        memberCount: 1,
      });

      vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockResolvedValue(null);

      const authResult = await authorizeWorkspaceSubscription("usr_attacker", "ws_123");
      expect(authResult.authorized).toBe(false);
    });
  });
});
