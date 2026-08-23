import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoardService } from "./board.service";
import { BoardAuthorizationService } from "./board-authorization";
import type { IBoardRepository } from "@/server/db/repository";

describe("BoardService", () => {
  let boardRepoMock: IBoardRepository;
  let authServiceMock: BoardAuthorizationService;
  let service: BoardService;

  const mockBoardRecord = {
    id: "board_1",
    workspaceId: "ws_1",
    title: "Sprint Board",
    description: "Main development",
    position: 0,
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    updatedAt: new Date("2026-08-23T00:00:00.000Z"),
  };

  const mockWorkspace = {
    id: "ws_1",
    name: "Workspace 1",
    slug: "ws-1",
    urlIdentifier: "ws-1-user-08232026",
    description: null,
    ownerId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    boardRepoMock = {
      findById: vi.fn(),
      findWithDetails: vi.fn(),
      findByWorkspaceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    authServiceMock = {
      requireWorkspaceAccess: vi.fn().mockResolvedValue({
        workspace: mockWorkspace,
        auth: { role: "MEMBER" },
      }),
      requireBoardInWorkspace: vi.fn().mockResolvedValue({
        board: mockBoardRecord,
        workspace: mockWorkspace,
        auth: { role: "MEMBER" },
      }),
      requireColumnInBoard: vi.fn(),
      requireCardInBoard: vi.fn(),
      validateAssigneesInWorkspace: vi.fn(),
    } as unknown as BoardAuthorizationService;

    service = new BoardService(boardRepoMock, authServiceMock);
  });

  describe("getBoards", () => {
    it("should return workspace boards for authorized user", async () => {
      vi.spyOn(boardRepoMock, "findByWorkspaceId").mockResolvedValue([mockBoardRecord]);

      const boards = await service.getBoards("ws_1", "user_1");
      expect(boards).toHaveLength(1);
      expect(boards[0].id).toBe("board_1");
      expect(boards[0].title).toBe("Sprint Board");
    });
  });

  describe("getBoardById", () => {
    it("should return detailed board with columns and cards", async () => {
      vi.spyOn(boardRepoMock, "findWithDetails").mockResolvedValue({
        ...mockBoardRecord,
        columns: [
          {
            id: "col_1",
            boardId: "board_1",
            title: "To Do",
            position: 0,
            color: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            cards: [],
          },
        ],
      });

      const board = await service.getBoardById("ws_1", "board_1", "user_1");
      expect(board.id).toBe("board_1");
      expect(board.columns).toHaveLength(1);
      expect(board.columns?.[0].title).toBe("To Do");
    });
  });

  describe("createBoard", () => {
    it("should create board and trim title", async () => {
      vi.spyOn(boardRepoMock, "create").mockResolvedValue(mockBoardRecord);

      const board = await service.createBoard("ws_1", "user_1", {
        title: "  Sprint Board  ",
        description: "  Main development  ",
      });

      expect(boardRepoMock.create).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        title: "Sprint Board",
        description: "Main development",
      });
      expect(board.id).toBe("board_1");
    });
  });

  describe("updateBoard", () => {
    it("should update board title and description", async () => {
      vi.spyOn(boardRepoMock, "update").mockResolvedValue({
        ...mockBoardRecord,
        title: "Renamed Board",
      });

      const updated = await service.updateBoard("ws_1", "board_1", "user_1", {
        title: "Renamed Board",
      });

      expect(boardRepoMock.update).toHaveBeenCalledWith("board_1", {
        title: "Renamed Board",
        description: undefined,
        position: undefined,
      });
      expect(updated.title).toBe("Renamed Board");
    });
  });

  describe("deleteBoard", () => {
    it("should delete board", async () => {
      vi.spyOn(boardRepoMock, "delete").mockResolvedValue(true);

      const result = await service.deleteBoard("ws_1", "board_1", "user_1");
      expect(result).toBe(true);
      expect(boardRepoMock.delete).toHaveBeenCalledWith("board_1");
    });
  });
});
