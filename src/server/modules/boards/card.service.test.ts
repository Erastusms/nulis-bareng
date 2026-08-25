import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { CardService } from "./card.service";
import { BoardAuthorizationService } from "./board-authorization";
import type { ICardRepository } from "@/server/db/repository";

describe("CardService", () => {
  let cardRepoMock: ICardRepository;
  let authServiceMock: BoardAuthorizationService;
  let service: CardService;

  const mockCardRecord = {
    id: "card_1",
    columnId: "col_1",
    boardId: "board_1",
    title: "Implement drag and drop",
    description: "Use hello-pangea/dnd",
    position: 65536,
    dueDate: new Date("2026-09-01T00:00:00.000Z"),
    labels: ["Feature", "Frontend"],
    assigneeIds: ["user_1"],
    assignees: [
      {
        id: "user_1",
        name: "Developer",
        email: "dev@example.com",
        createdAt: "2026-08-23T00:00:00.000Z",
        updatedAt: "2026-08-23T00:00:00.000Z",
      },
    ],
    createdAt: new Date("2026-08-23T00:00:00.000Z"),
    updatedAt: new Date("2026-08-23T00:00:00.000Z"),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    cardRepoMock = {
      findById: vi.fn(),
      findByColumnId: vi.fn(),
      findByBoardId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      moveCard: vi.fn(),
    };

    authServiceMock = {
      requireWorkspaceAccess: vi.fn(),
      requireBoardInWorkspace: vi.fn().mockResolvedValue({
        board: { id: "board_1", workspaceId: "ws_1" },
        auth: { role: "MEMBER" },
      }),
      requireColumnInBoard: vi.fn().mockResolvedValue({
        column: { id: "col_1", boardId: "board_1" },
        board: { id: "board_1", workspaceId: "ws_1" },
        auth: { role: "MEMBER" },
      }),
      requireCardInBoard: vi.fn().mockResolvedValue({
        card: mockCardRecord,
        board: { id: "board_1", workspaceId: "ws_1" },
        auth: { role: "MEMBER" },
      }),
      validateAssigneesInWorkspace: vi.fn().mockResolvedValue(undefined),
    } as unknown as BoardAuthorizationService;

    service = new CardService(cardRepoMock, authServiceMock);
  });

  describe("getCardById", () => {
    it("should return card by ID", async () => {
      const card = await service.getCardById("ws_1", "board_1", "card_1", "user_1");
      expect(card.id).toBe("card_1");
      expect(card.title).toBe("Implement drag and drop");
      expect(card.assigneeIds).toEqual(["user_1"]);
    });
  });

  describe("createCard", () => {
    it("should create card and validate assignees", async () => {
      vi.spyOn(cardRepoMock, "create").mockResolvedValue(mockCardRecord);

      const card = await service.createCard("ws_1", "board_1", "user_1", {
        columnId: "col_1",
        title: "Implement drag and drop",
        description: "Use hello-pangea/dnd",
        assigneeIds: ["user_1"],
        dueDate: "2026-09-01T00:00:00.000Z",
        labels: ["Feature", "Frontend"],
      });

      expect(authServiceMock.validateAssigneesInWorkspace).toHaveBeenCalledWith(
        ["user_1"],
        "ws_1"
      );
      expect(cardRepoMock.create).toHaveBeenCalled();
      expect(card.id).toBe("card_1");
    });

    it("should reject invalid due date format", async () => {
      await expect(
        service.createCard("ws_1", "board_1", "user_1", {
          columnId: "col_1",
          title: "Bad Date Card",
          dueDate: "NOT_A_DATE",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("updateCard", () => {
    it("should update card details and parse due date", async () => {
      vi.spyOn(cardRepoMock, "update").mockResolvedValue({
        ...mockCardRecord,
        title: "Updated Title",
      });

      const updated = await service.updateCard(
        "ws_1",
        "board_1",
        "card_1",
        "user_1",
        {
          title: "Updated Title",
          dueDate: "2026-10-01T00:00:00.000Z",
        }
      );

      expect(cardRepoMock.update).toHaveBeenCalled();
      expect(updated.title).toBe("Updated Title");
    });
  });

  describe("deleteCard", () => {
    it("should delete card", async () => {
      vi.spyOn(cardRepoMock, "delete").mockResolvedValue(true);

      const res = await service.deleteCard("ws_1", "board_1", "card_1", "user_1");
      expect(res).toBe(true);
    });
  });

  describe("moveCard", () => {
    it("should validate source and target columns and move card successfully", async () => {
      vi.spyOn(cardRepoMock, "moveCard").mockResolvedValue({
        ...mockCardRecord,
        columnId: "col_2",
        position: 131072,
      });

      const moved = await service.moveCard("ws_1", "board_1", "user_1", {
        cardId: "card_1",
        sourceColumnId: "col_1",
        targetColumnId: "col_2",
        targetPosition: 1,
      });

      expect(authServiceMock.requireColumnInBoard).toHaveBeenCalledWith(
        "col_1",
        "board_1",
        "ws_1",
        "user_1"
      );
      expect(authServiceMock.requireColumnInBoard).toHaveBeenCalledWith(
        "col_2",
        "board_1",
        "ws_1",
        "user_1"
      );
      expect(moved.columnId).toBe("col_2");
      expect(moved.position).toBe(131072);
    });

    it("should reject move if card does not belong to specified source column", async () => {
      await expect(
        service.moveCard("ws_1", "board_1", "user_1", {
          cardId: "card_1",
          sourceColumnId: "col_wrong",
          targetColumnId: "col_2",
          targetPosition: 0,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject move if target position is negative", async () => {
      await expect(
        service.moveCard("ws_1", "board_1", "user_1", {
          cardId: "card_1",
          sourceColumnId: "col_1",
          targetColumnId: "col_2",
          targetPosition: -1,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject move if user is unauthorized", async () => {
      vi.spyOn(authServiceMock, "requireCardInBoard").mockRejectedValue(
        new ForbiddenError("Unauthorized access to workspace")
      );

      await expect(
        service.moveCard("ws_1", "board_1", "user_intruder", {
          cardId: "card_1",
          sourceColumnId: "col_1",
          targetColumnId: "col_2",
          targetPosition: 0,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject move if destination column belongs to another board", async () => {
      vi.spyOn(authServiceMock, "requireColumnInBoard").mockImplementation(async (colId) => {
        if (colId === "col_other_board") {
          throw new NotFoundError("Column does not belong to board");
        }
        return {
          column: {
            id: colId,
            boardId: "board_1",
            title: "Column",
            position: 0,
            color: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          board: {
            id: "board_1",
            workspaceId: "ws_1",
            title: "Board",
            description: null,
            position: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          workspace: {
            id: "ws_1",
            name: "WS",
            slug: "ws",
            urlIdentifier: "ws",
            description: null,
            ownerId: "user_1",
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          auth: {
            member: {
              id: "mem_1",
              workspaceId: "ws_1",
              userId: "user_1",
              role: "MEMBER",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            role: "MEMBER",
          },
        };
      });

      await expect(
        service.moveCard("ws_1", "board_1", "user_1", {
          cardId: "card_1",
          sourceColumnId: "col_1",
          targetColumnId: "col_other_board",
          targetPosition: 0,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });
});
