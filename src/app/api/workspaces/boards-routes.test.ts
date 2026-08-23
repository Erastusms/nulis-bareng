import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getBoardsHandler, POST as createBoardHandler } from "./[id]/boards/route";
import {
  GET as getBoardByIdHandler,
  PATCH as updateBoardHandler,
  DELETE as deleteBoardHandler,
} from "./[id]/boards/[boardId]/route";
import { POST as createColumnHandler } from "./[id]/boards/[boardId]/columns/route";
import {
  PATCH as updateColumnHandler,
  DELETE as deleteColumnHandler,
} from "./[id]/boards/[boardId]/columns/[columnId]/route";
import { PATCH as reorderColumnsHandler } from "./[id]/boards/[boardId]/columns/reorder/route";
import { POST as createCardHandler } from "./[id]/boards/[boardId]/cards/route";
import {
  GET as getCardHandler,
  PATCH as updateCardHandler,
  DELETE as deleteCardHandler,
} from "./[id]/boards/[boardId]/cards/[cardId]/route";
import { POST as moveCardHandler } from "./[id]/boards/[boardId]/cards/move/route";
import { boardService } from "@/server/modules/boards/board.service";
import { boardColumnService } from "@/server/modules/boards/board-column.service";
import { cardService } from "@/server/modules/boards/card.service";
import * as currentUserModule from "@/server/auth/current-user";
import type { Board, BoardColumn, Card, User } from "@/types/domain";

describe("Kanban API Route Handlers", () => {
  const mockUser: User = {
    id: "user_test",
    name: "Tester",
    email: "test@example.com",
    avatarUrl: null,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  const mockBoard: Board = {
    id: "board_1",
    workspaceId: "ws_1",
    title: "Sprint 1",
    description: "Main development",
    position: 0,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  const mockColumn: BoardColumn = {
    id: "col_1",
    boardId: "board_1",
    title: "To Do",
    position: 0,
    color: "#3b82f6",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  const mockCard: Card = {
    id: "card_1",
    columnId: "col_1",
    boardId: "board_1",
    title: "Write documentation",
    description: "API docs",
    position: 0,
    dueDate: null,
    labels: ["Docs"],
    assigneeIds: [],
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
  });

  describe("Board Routes", () => {
    it("GET /api/workspaces/[id]/boards returns 200 with boards list", async () => {
      vi.spyOn(boardService, "getBoards").mockResolvedValue([mockBoard]);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/boards");
      const res = await getBoardsHandler(req, { params: Promise.resolve({ id: "ws_1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Sprint 1");
    });

    it("POST /api/workspaces/[id]/boards returns 201 on board creation", async () => {
      vi.spyOn(boardService, "createBoard").mockResolvedValue(mockBoard);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sprint 1", description: "Main development" }),
      });
      const res = await createBoardHandler(req, { params: Promise.resolve({ id: "ws_1" }) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("board_1");
    });

    it("GET /api/workspaces/[id]/boards/[boardId] returns 200 with board details", async () => {
      vi.spyOn(boardService, "getBoardById").mockResolvedValue(mockBoard);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/boards/board_1");
      const res = await getBoardByIdHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Sprint 1");
    });

    it("PATCH /api/workspaces/[id]/boards/[boardId] returns 200 on update", async () => {
      vi.spyOn(boardService, "updateBoard").mockResolvedValue({
        ...mockBoard,
        title: "Sprint 1 (Renamed)",
      });

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/boards/board_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sprint 1 (Renamed)" }),
      });
      const res = await updateBoardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Sprint 1 (Renamed)");
    });

    it("DELETE /api/workspaces/[id]/boards/[boardId] returns 200 on deletion", async () => {
      vi.spyOn(boardService, "deleteBoard").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/boards/board_1", {
        method: "DELETE",
      });
      const res = await deleteBoardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Column Routes", () => {
    it("POST /api/workspaces/[id]/boards/[boardId]/columns returns 201 on column creation", async () => {
      vi.spyOn(boardColumnService, "createColumn").mockResolvedValue(mockColumn);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/columns",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "To Do", color: "#3b82f6" }),
        }
      );
      const res = await createColumnHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("To Do");
    });

    it("PATCH /api/workspaces/[id]/boards/[boardId]/columns/[columnId] returns 200 on rename", async () => {
      vi.spyOn(boardColumnService, "updateColumn").mockResolvedValue({
        ...mockColumn,
        title: "Done",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/columns/col_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Done" }),
        }
      );
      const res = await updateColumnHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1", columnId: "col_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Done");
    });

    it("DELETE /api/workspaces/[id]/boards/[boardId]/columns/[columnId] returns 200 on delete", async () => {
      vi.spyOn(boardColumnService, "deleteColumn").mockResolvedValue(true);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/columns/col_1",
        {
          method: "DELETE",
        }
      );
      const res = await deleteColumnHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1", columnId: "col_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("PATCH /api/workspaces/[id]/boards/[boardId]/columns/reorder returns 200 on reorder", async () => {
      vi.spyOn(boardColumnService, "reorderColumns").mockResolvedValue([mockColumn]);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/columns/reorder",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ columnIds: ["col_1"] }),
        }
      );
      const res = await reorderColumnsHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe("Card Routes", () => {
    it("POST /api/workspaces/[id]/boards/[boardId]/cards returns 201 on card creation", async () => {
      vi.spyOn(cardService, "createCard").mockResolvedValue(mockCard);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/cards",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnId: "col_1",
            title: "Write documentation",
            labels: ["Docs"],
          }),
        }
      );
      const res = await createCardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Write documentation");
    });

    it("GET /api/workspaces/[id]/boards/[boardId]/cards/[cardId] returns 200 with card details", async () => {
      vi.spyOn(cardService, "getCardById").mockResolvedValue(mockCard);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/cards/card_1"
      );
      const res = await getCardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1", cardId: "card_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("card_1");
    });

    it("PATCH /api/workspaces/[id]/boards/[boardId]/cards/[cardId] returns 200 on update", async () => {
      vi.spyOn(cardService, "updateCard").mockResolvedValue({
        ...mockCard,
        title: "Updated Title",
      });

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/cards/card_1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Updated Title" }),
        }
      );
      const res = await updateCardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1", cardId: "card_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Updated Title");
    });

    it("DELETE /api/workspaces/[id]/boards/[boardId]/cards/[cardId] returns 200 on delete", async () => {
      vi.spyOn(cardService, "deleteCard").mockResolvedValue(true);

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/cards/card_1",
        { method: "DELETE" }
      );
      const res = await deleteCardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1", cardId: "card_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("POST /api/workspaces/[id]/boards/[boardId]/cards/move returns 200 on move card", async () => {
      vi.spyOn(cardService, "moveCard").mockResolvedValue({
        ...mockCard,
        columnId: "col_2",
        position: 1,
      });

      const req = new NextRequest(
        "http://localhost:3000/api/workspaces/ws_1/boards/board_1/cards/move",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId: "card_1",
            sourceColumnId: "col_1",
            targetColumnId: "col_2",
            targetPosition: 1,
          }),
        }
      );
      const res = await moveCardHandler(req, {
        params: Promise.resolve({ id: "ws_1", boardId: "board_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.columnId).toBe("col_2");
    });
  });
});
