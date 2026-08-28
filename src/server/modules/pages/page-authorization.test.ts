import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageAuthorizationService } from "./page-authorization";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { IPageRepository, IWorkspaceRepository } from "@/server/db/repository";
import type { WorkspaceAuthorizationService } from "../workspaces/workspace-authorization";

describe("PageAuthorizationService", () => {
  let workspaceRepoMock: IWorkspaceRepository;
  let workspaceAuthMock: WorkspaceAuthorizationService;
  let pageRepoMock: IPageRepository;
  let service: PageAuthorizationService;

  const mockWorkspace = {
    id: "ws_1",
    name: "Test Workspace",
    slug: "test-workspace",
    urlIdentifier: "test-workspace-1234",
    description: null,
    ownerId: "user_owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPage = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Project Notes",
    content: { type: "doc", content: [] },
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

    workspaceAuthMock = {
      getMembership: vi.fn(),
      requireWorkspaceAccess: vi.fn(),
      requireWorkspaceRole: vi.fn(),
    } as unknown as WorkspaceAuthorizationService;

    pageRepoMock = {
      findById: vi.fn(),
      findByWorkspaceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    service = new PageAuthorizationService(
      workspaceRepoMock,
      workspaceAuthMock,
      pageRepoMock
    );
  });

  describe("requireWorkspaceAccess", () => {
    it("should resolve workspace by identifier and check membership", async () => {
      vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
      vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockResolvedValue({
        member: { id: "m_1", workspaceId: "ws_1", userId: "user_1", role: "MEMBER", createdAt: new Date(), updatedAt: new Date() },
        role: "MEMBER",
      });

      const result = await service.requireWorkspaceAccess("user_1", "ws_1");
      expect(result.workspace.id).toBe("ws_1");
      expect(result.auth.role).toBe("MEMBER");
    });

    it("should throw NotFoundError if workspace not found", async () => {
      vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(null);

      await expect(service.requireWorkspaceAccess("user_1", "non_existent")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw ForbiddenError if user is not a member of workspace", async () => {
      vi.spyOn(workspaceRepoMock, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
      vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockRejectedValue(
        new ForbiddenError("Access denied")
      );

      await expect(service.requireWorkspaceAccess("user_intruder", "ws_1")).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("requirePageAccess", () => {
    it("should validate page exists and belongs to workspace that user has access to", async () => {
      vi.spyOn(pageRepoMock, "findById").mockResolvedValue(mockPage);
      vi.spyOn(workspaceRepoMock, "findById").mockResolvedValue(mockWorkspace);
      vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockResolvedValue({
        member: { id: "m_1", workspaceId: "ws_1", userId: "user_1", role: "MEMBER", createdAt: new Date(), updatedAt: new Date() },
        role: "MEMBER",
      });

      const result = await service.requirePageAccess("page_1", "user_1");
      expect(result.page.id).toBe("page_1");
      expect(result.workspace.id).toBe("ws_1");
      expect(result.auth.role).toBe("MEMBER");
    });

    it("should throw NotFoundError if page does not exist", async () => {
      vi.spyOn(pageRepoMock, "findById").mockResolvedValue(null);

      await expect(service.requirePageAccess("page_missing", "user_1")).rejects.toThrow(
        NotFoundError
      );
    });

    it("should throw ForbiddenError if user has no access to the page's workspace", async () => {
      vi.spyOn(pageRepoMock, "findById").mockResolvedValue(mockPage);
      vi.spyOn(workspaceRepoMock, "findById").mockResolvedValue(mockWorkspace);
      vi.spyOn(workspaceAuthMock, "requireWorkspaceAccess").mockRejectedValue(
        new ForbiddenError("Access denied")
      );

      await expect(service.requirePageAccess("page_1", "user_intruder")).rejects.toThrow(
        ForbiddenError
      );
    });
  });
});
