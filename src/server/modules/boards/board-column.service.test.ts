import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, ValidationError } from "@/lib/api/errors";
import { BoardColumnService } from "./board-column.service";
import { BoardAuthorizationService } from "./board-authorization";
import type { IBoardColumnRepository } from "@/server/db/repository";

describe("BoardColumnService", () => {
  let columnRepoMock: IBoardColumnRepository;
  let authServiceMock: BoardAuthorizationService;
  let service: BoardColumnService;

  const mockColumnRecord = {
    id: "col_1",
    boardId: "board_1",
    title: "To Do",
    position: 65536,
    color: "#3b82f6",
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    updatedAt: new Date("2026-08-23T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    columnRepoMock = {
      findById: vi.fn(),
      findByBoardId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      moveColumn: vi.fn(),
      reorderColumns: vi.fn(),
    };

    authServiceMock = {
      requireWorkspaceAccess: vi.fn(),
      requireBoardInWorkspace: vi.fn().mockResolvedValue({
        board: { id: "board_1", workspaceId: "ws_1" },
        auth: { role: "MEMBER" },
      }),
      requireColumnInBoard: vi.fn().mockResolvedValue({
        column: mockColumnRecord,
        board: { id: "board_1", workspaceId: "ws_1" },
        auth: { role: "MEMBER" },
      }),
      requireCardInBoard: vi.fn(),
      validateAssigneesInWorkspace: vi.fn(),
    } as unknown as BoardAuthorizationService;

    service = new BoardColumnService(columnRepoMock, authServiceMock);
  });

  describe("createColumn", () => {
    it("should create column", async () => {
      vi.spyOn(columnRepoMock, "create").mockResolvedValue(mockColumnRecord);

      const col = await service.createColumn("ws_1", "board_1", "user_1", {
        title: "To Do",
        color: "#3b82f6",
      });

      expect(columnRepoMock.create).toHaveBeenCalledWith({
        boardId: "board_1",
        title: "To Do",
        color: "#3b82f6",
        position: undefined,
      });
      expect(col.id).toBe("col_1");
    });
  });

  describe("updateColumn", () => {
    it("should update column title", async () => {
      vi.spyOn(columnRepoMock, "update").mockResolvedValue({
        ...mockColumnRecord,
        title: "In Progress",
      });

      const updated = await service.updateColumn("ws_1", "board_1", "col_1", "user_1", {
        title: "In Progress",
      });

      expect(columnRepoMock.update).toHaveBeenCalledWith("col_1", {
        title: "In Progress",
        color: undefined,
        position: undefined,
      });
      expect(updated.title).toBe("In Progress");
    });
  });

  describe("deleteColumn", () => {
    it("should delete column", async () => {
      vi.spyOn(columnRepoMock, "delete").mockResolvedValue(true);

      const res = await service.deleteColumn("ws_1", "board_1", "col_1", "user_1");
      expect(res).toBe(true);
    });
  });

  describe("moveColumn", () => {
    it("should move column successfully to target index", async () => {
      vi.spyOn(columnRepoMock, "moveColumn").mockResolvedValue({
        ...mockColumnRecord,
        position: 131072,
      });

      const result = await service.moveColumn("ws_1", "board_1", "user_1", {
        columnId: "col_1",
        targetPosition: 1,
      });

      expect(authServiceMock.requireColumnInBoard).toHaveBeenCalledWith(
        "col_1",
        "board_1",
        "ws_1",
        "user_1"
      );
      expect(columnRepoMock.moveColumn).toHaveBeenCalledWith({
        columnId: "col_1",
        boardId: "board_1",
        targetPosition: 1,
      });
      expect(result.position).toBe(131072);
    });

    it("should reject move if target position is negative", async () => {
      await expect(
        service.moveColumn("ws_1", "board_1", "user_1", {
          columnId: "col_1",
          targetPosition: -1,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject move if user is unauthorized", async () => {
      vi.spyOn(authServiceMock, "requireColumnInBoard").mockRejectedValue(
        new ForbiddenError("Unauthorized access")
      );

      await expect(
        service.moveColumn("ws_1", "board_1", "user_intruder", {
          columnId: "col_1",
          targetPosition: 0,
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("reorderColumns", () => {
    it("should reorder columns when all column IDs are valid", async () => {
      vi.spyOn(columnRepoMock, "findByBoardId").mockResolvedValue([
        mockColumnRecord,
        { ...mockColumnRecord, id: "col_2", position: 131072 },
      ]);
      vi.spyOn(columnRepoMock, "reorderColumns").mockResolvedValue([
        { ...mockColumnRecord, id: "col_2", position: 65536 },
        { ...mockColumnRecord, id: "col_1", position: 131072 },
      ]);

      const result = await service.reorderColumns("ws_1", "board_1", "user_1", [
        "col_2",
        "col_1",
      ]);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("col_2");
      expect(result[1].id).toBe("col_1");
    });

    it("should reject reordering if a column ID does not belong to the board", async () => {
      vi.spyOn(columnRepoMock, "findByBoardId").mockResolvedValue([mockColumnRecord]);

      await expect(
        service.reorderColumns("ws_1", "board_1", "user_1", ["col_invalid"])
      ).rejects.toThrow(ValidationError);
    });

    it("should reject reordering if columnIds is empty", async () => {
      await expect(
        service.reorderColumns("ws_1", "board_1", "user_1", [])
      ).rejects.toThrow(ValidationError);
    });
  });
});
