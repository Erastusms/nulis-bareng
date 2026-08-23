import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { BoardAuthorizationService } from "./board-authorization";
import type {
  IBoardColumnRepository,
  IBoardRepository,
  ICardRepository,
  IWorkspaceMemberRepository,
  IWorkspaceRepository,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/server/db/repository";
import { WorkspaceAuthorizationService } from "../workspaces/workspace-authorization";

describe("BoardAuthorizationService (Cross-Workspace Isolation & RBAC)", () => {
  let workspaceRepoMock: IWorkspaceRepository;
  let workspaceAuthMock: WorkspaceAuthorizationService;
  let boardRepoMock: IBoardRepository;
  let columnRepoMock: IBoardColumnRepository;
  let cardRepoMock: ICardRepository;
  let memberRepoMock: IWorkspaceMemberRepository;
  let authService: BoardAuthorizationService;

  const mockWorkspace: WorkspaceRecord = {
    id: "ws_alpha",
    name: "Alpha Workspace",
    slug: "alpha",
    urlIdentifier: "alpha-user1-08232026",
    description: null,
    ownerId: "user_owner",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMember: WorkspaceMemberRecord = {
    id: "mem_1",
    workspaceId: "ws_alpha",
    userId: "user_alice",
    role: "MEMBER",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    workspaceRepoMock = {
      findById: vi.fn().mockResolvedValue(mockWorkspace),
      findBySlug: vi.fn(),
      findByUrlIdentifier: vi.fn(),
      findByIdOrUrlIdentifier: vi.fn().mockImplementation((id: string) => {
        if (id === "ws_alpha" || id === "alpha-user1-08232026") return Promise.resolve(mockWorkspace);
        return Promise.resolve(null);
      }),
      findByUserId: vi.fn(),
      createWithOwner: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    memberRepoMock = {
      findByWorkspaceAndUser: vi.fn(),
      findMembersByWorkspaceId: vi.fn(),
      create: vi.fn(),
      updateRole: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    workspaceAuthMock = new WorkspaceAuthorizationService(memberRepoMock);

    boardRepoMock = {
      findById: vi.fn(),
      findWithDetails: vi.fn(),
      findByWorkspaceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    columnRepoMock = {
      findById: vi.fn(),
      findByBoardId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      reorderColumns: vi.fn(),
    };

    cardRepoMock = {
      findById: vi.fn(),
      findByColumnId: vi.fn(),
      findByBoardId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      moveCard: vi.fn(),
    };

    authService = new BoardAuthorizationService(
      workspaceRepoMock,
      workspaceAuthMock,
      boardRepoMock,
      columnRepoMock,
      cardRepoMock,
      memberRepoMock
    );
  });

  describe("requireWorkspaceAccess", () => {
    it("should allow workspace member using workspace ID or urlIdentifier", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);

      const ctx = await authService.requireWorkspaceAccess("user_alice", "alpha-user1-08232026");
      expect(ctx.workspace.id).toBe("ws_alpha");
      expect(ctx.auth.role).toBe("MEMBER");
    });

    it("should reject non-member with ForbiddenError", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(null);

      await expect(
        authService.requireWorkspaceAccess("user_stranger", "ws_alpha")
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw NotFoundError if workspace does not exist", async () => {
      await expect(
        authService.requireWorkspaceAccess("user_alice", "non_existent_ws")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("requireBoardInWorkspace (Cross-Workspace Isolation)", () => {
    it("should allow access when board belongs to workspace", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);
      vi.spyOn(boardRepoMock, "findById").mockResolvedValue({
        id: "board_1",
        workspaceId: "ws_alpha",
        title: "Sprint 1",
        description: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.requireBoardInWorkspace(
        "board_1",
        "ws_alpha",
        "user_alice"
      );
      expect(result.board.id).toBe("board_1");
    });

    it("should reject with NotFoundError when board belongs to different workspace (Workspace Isolation)", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);
      vi.spyOn(boardRepoMock, "findById").mockResolvedValue({
        id: "board_beta",
        workspaceId: "ws_beta", // Belongs to workspace Beta!
        title: "Secret Board",
        description: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.requireBoardInWorkspace("board_beta", "ws_alpha", "user_alice")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("requireColumnInBoard", () => {
    it("should allow column belonging to board", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);
      vi.spyOn(boardRepoMock, "findById").mockResolvedValue({
        id: "board_1",
        workspaceId: "ws_alpha",
        title: "Sprint 1",
        description: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(columnRepoMock, "findById").mockResolvedValue({
        id: "col_1",
        boardId: "board_1",
        title: "To Do",
        position: 0,
        color: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await authService.requireColumnInBoard(
        "col_1",
        "board_1",
        "ws_alpha",
        "user_alice"
      );
      expect(result.column.id).toBe("col_1");
    });

    it("should reject column belonging to a different board", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);
      vi.spyOn(boardRepoMock, "findById").mockResolvedValue({
        id: "board_1",
        workspaceId: "ws_alpha",
        title: "Sprint 1",
        description: null,
        position: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      vi.spyOn(columnRepoMock, "findById").mockResolvedValue({
        id: "col_other",
        boardId: "board_other",
        title: "Other Board Column",
        position: 0,
        color: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        authService.requireColumnInBoard("col_other", "board_1", "ws_alpha", "user_alice")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("validateAssigneesInWorkspace", () => {
    it("should allow assigning valid workspace members", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(mockMember);

      await expect(
        authService.validateAssigneesInWorkspace(["user_alice"], "ws_alpha")
      ).resolves.not.toThrow();
    });

    it("should reject assigning non-workspace members with ValidationError", async () => {
      vi.spyOn(memberRepoMock, "findByWorkspaceAndUser").mockResolvedValue(null);

      await expect(
        authService.validateAssigneesInWorkspace(["user_stranger"], "ws_alpha")
      ).rejects.toThrow(ValidationError);
    });
  });
});
