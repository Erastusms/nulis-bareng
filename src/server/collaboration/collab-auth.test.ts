import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollabAuthService } from "./collab-auth";
import { authService } from "@/server/modules/auth/auth.service";
import type { IPageRepository, IWorkspaceRepository } from "@/server/db/repository";
import { WorkspaceAuthorizationService } from "@/server/modules/workspaces/workspace-authorization";
import { ForbiddenError } from "@/lib/api/errors";

describe("CollabAuthService", () => {
  let workspaceRepoMock: IWorkspaceRepository;
  let pageRepoMock: IPageRepository;
  let workspaceAuthMock: WorkspaceAuthorizationService;
  let service: CollabAuthService;

  const mockUser = {
    id: "user_1",
    name: "Collaborator 1",
    email: "collab1@example.com",
    avatarUrl: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };

  const mockWorkspace = {
    id: "ws_1",
    name: "Workspace 1",
    slug: "ws-1",
    urlIdentifier: "ws-1-1234",
    description: null,
    ownerId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPage = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Project Notes",
    content: { type: "doc", content: [] },
    yjsState: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    workspaceRepoMock = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      findByUrlIdentifier: vi.fn(),
      findByIdOrUrlIdentifier: vi.fn(),
      findByUserId: vi.fn(),
      createWithOwner: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    pageRepoMock = {
      findById: vi.fn(),
      findByWorkspaceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    workspaceAuthMock = {
      getMembership: vi.fn(),
      requireWorkspaceAccess: vi.fn(),
      requireWorkspaceRole: vi.fn(),
    } as unknown as WorkspaceAuthorizationService;

    service = new CollabAuthService(workspaceRepoMock, pageRepoMock, workspaceAuthMock);
  });

  it("should authorize a valid user connection to a document room", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "token_123",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
    });

    vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockResolvedValue({
      member: {
        id: "m_1",
        workspaceId: "ws_1",
        userId: "user_1",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      role: "MEMBER",
    });
    vi.spyOn(pageRepoMock, "findById").mockResolvedValue(mockPage);

    const result = await service.authorizeConnection("token_123", "workspace:ws_1:page:page_1");
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.user.id).toBe("user_1");
      expect(result.user.name).toBe("Collaborator 1");
      expect(result.user.color).toBeDefined();
      expect(result.workspaceId).toBe("ws_1");
      expect(result.pageId).toBe("page_1");
    }
  });

  it("should reject connection when no token is provided", async () => {
    const result = await service.authorizeConnection("", "workspace:ws_1:page:page_1");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4401);
    }
  });

  it("should reject connection when session token is invalid or expired", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue(null);

    const result = await service.authorizeConnection("invalid_token", "workspace:ws_1:page:page_1");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4401);
    }
  });

  it("should reject connection with malformed room name", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "token_123",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
    });

    const result = await service.authorizeConnection("token_123", "random-room-name");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4400);
    }
  });

  it("should reject connection when user is not a member of the workspace", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "token_123",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
    });
    vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockRejectedValue(
      new ForbiddenError("Access denied")
    );

    const result = await service.authorizeConnection("token_123", "workspace:ws_1:page:page_1");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4403);
    }
  });

  it("should reject connection if page does not exist", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "token_123",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
    });
    vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockResolvedValue({
      member: {
        id: "m_1",
        workspaceId: "ws_1",
        userId: "user_1",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      role: "MEMBER",
    });
    vi.spyOn(pageRepoMock, "findById").mockResolvedValue(null);

    const result = await service.authorizeConnection("token_123", "workspace:ws_1:page:page_missing");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4404);
    }
  });

  it("should reject connection if page belongs to another workspace (cross-workspace attempt)", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "token_123",
        userId: "user_1",
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      },
    });
    vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockResolvedValue({
      member: {
        id: "m_1",
        workspaceId: "ws_1",
        userId: "user_1",
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      role: "MEMBER",
    });
    vi.spyOn(pageRepoMock, "findById").mockResolvedValue({
      ...mockPage,
      workspaceId: "another_workspace_id",
    });

    const result = await service.authorizeConnection("token_123", "workspace:ws_1:page:page_1");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.code).toBe(4403);
    }
  });
});
