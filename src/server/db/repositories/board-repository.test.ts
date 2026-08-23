import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../client";
import { PrismaBoardRepository } from "./board.repository";
import { PrismaBoardColumnRepository } from "./board-column.repository";
import { PrismaCardRepository } from "./card.repository";
import { PrismaUserRepository } from "./user.repository";
import { PrismaWorkspaceRepository } from "./workspace.repository";
import { hashPassword } from "@/server/auth/password";

describe("Board, Column & Card Repositories Integration (PostgreSQL + Prisma)", () => {
  const userRepo = new PrismaUserRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const boardRepo = new PrismaBoardRepository(db);
  const columnRepo = new PrismaBoardColumnRepository(db);
  const cardRepo = new PrismaCardRepository(db);

  let userId: string;
  let workspaceId: string;
  let boardId: string;
  let col1Id: string;
  let col2Id: string;
  let card1Id: string;
  let card2Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("BoardPass123!");
    const user = await userRepo.create({
      name: "Board Tester",
      email: `board_test_${Date.now()}@example.com`,
      passwordHash,
    });
    userId = user.id;

    const ws = await workspaceRepo.createWithOwner({
      name: "Board Test WS",
      slug: `board-ws-${Date.now()}`,
      urlIdentifier: `board-ws-id-${Date.now()}`,
      ownerId: userId,
    });
    workspaceId = ws.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  describe("PrismaBoardRepository", () => {
    it("should create a new board in workspace", async () => {
      const board = await boardRepo.create({
        workspaceId,
        title: "Sprint 1 Board",
        description: "Main development board",
      });

      expect(board.id).toBeDefined();
      expect(board.workspaceId).toBe(workspaceId);
      expect(board.title).toBe("Sprint 1 Board");
      expect(board.position).toBe(0);

      boardId = board.id;
    });

    it("should find board by id", async () => {
      const found = await boardRepo.findById(boardId);
      expect(found).not.toBeNull();
      expect(found?.title).toBe("Sprint 1 Board");
    });

    it("should list boards by workspace id", async () => {
      const boards = await boardRepo.findByWorkspaceId(workspaceId);
      expect(boards.length).toBeGreaterThanOrEqual(1);
      expect(boards[0].id).toBe(boardId);
    });

    it("should update board title and description", async () => {
      const updated = await boardRepo.update(boardId, {
        title: "Sprint 1 Board (Renamed)",
        description: "Updated description",
      });

      expect(updated.title).toBe("Sprint 1 Board (Renamed)");
      expect(updated.description).toBe("Updated description");
    });
  });

  describe("PrismaBoardColumnRepository", () => {
    it("should create columns with correct positions", async () => {
      const col1 = await columnRepo.create({
        boardId,
        title: "To Do",
        color: "#3b82f6",
      });
      const col2 = await columnRepo.create({
        boardId,
        title: "In Progress",
        color: "#f59e0b",
      });
      const col3 = await columnRepo.create({
        boardId,
        title: "Done",
        color: "#10b981",
      });

      expect(col1.position).toBe(0);
      expect(col2.position).toBe(1);
      expect(col3.position).toBe(2);

      col1Id = col1.id;
      col2Id = col2.id;
    });

    it("should find columns by board id ordered by position", async () => {
      const cols = await columnRepo.findByBoardId(boardId);
      expect(cols).toHaveLength(3);
      expect(cols[0].title).toBe("To Do");
      expect(cols[1].title).toBe("In Progress");
      expect(cols[2].title).toBe("Done");
    });

    it("should atomically reorder columns", async () => {
      const cols = await columnRepo.findByBoardId(boardId);
      const reversedIds = cols.map((c) => c.id).reverse();

      const reordered = await columnRepo.reorderColumns(boardId, reversedIds);
      expect(reordered[0].id).toBe(reversedIds[0]);
      expect(reordered[0].position).toBe(0);
      expect(reordered[1].position).toBe(1);
      expect(reordered[2].position).toBe(2);
    });
  });

  describe("PrismaCardRepository", () => {
    it("should create cards with assignees and labels", async () => {
      const card1 = await cardRepo.create({
        columnId: col1Id,
        boardId,
        title: "Implement authentication",
        description: "JWT and Session Auth",
        assigneeIds: [userId],
        labels: ["Feature", "Security"],
        dueDate: new Date("2026-12-31T00:00:00.000Z"),
      });

      const card2 = await cardRepo.create({
        columnId: col1Id,
        boardId,
        title: "Design Landing Page",
        labels: ["Design"],
      });

      expect(card1.id).toBeDefined();
      expect(card1.position).toBe(0);
      expect(card1.assigneeIds).toContain(userId);
      expect(card1.labels).toContain("Feature");

      expect(card2.id).toBeDefined();
      expect(card2.position).toBe(1);

      card1Id = card1.id;
      card2Id = card2.id;
    });

    it("should find board with detailed columns and cards", async () => {
      const detailed = await boardRepo.findWithDetails(boardId);
      expect(detailed).not.toBeNull();
      expect(detailed?.columns).toBeDefined();

      const colWithCards = detailed?.columns?.find((c) => c.id === col1Id);
      expect(colWithCards?.cards?.length).toBe(2);
      expect(colWithCards?.cards?.[0].assignees?.[0].id).toBe(userId);
    });

    it("should move card within the same column atomically", async () => {
      // Move card2 (originally index 1) to index 0
      const moved = await cardRepo.moveCard({
        cardId: card2Id,
        sourceColumnId: col1Id,
        targetColumnId: col1Id,
        targetPosition: 0,
      });

      expect(moved.position).toBe(0);

      const cards = await cardRepo.findByColumnId(col1Id);
      expect(cards[0].id).toBe(card2Id);
      expect(cards[0].position).toBe(0);
      expect(cards[1].id).toBe(card1Id);
      expect(cards[1].position).toBe(1);
    });

    it("should move card across columns atomically", async () => {
      // Move card1 from col1 to col2 at position 0
      const moved = await cardRepo.moveCard({
        cardId: card1Id,
        sourceColumnId: col1Id,
        targetColumnId: col2Id,
        targetPosition: 0,
      });

      expect(moved.columnId).toBe(col2Id);
      expect(moved.position).toBe(0);

      const col1Cards = await cardRepo.findByColumnId(col1Id);
      expect(col1Cards).toHaveLength(1);
      expect(col1Cards[0].id).toBe(card2Id);
      expect(col1Cards[0].position).toBe(0);

      const col2Cards = await cardRepo.findByColumnId(col2Id);
      expect(col2Cards).toHaveLength(1);
      expect(col2Cards[0].id).toBe(card1Id);
    });

    it("should update card details and replace assignees", async () => {
      const updated = await cardRepo.update(card1Id, {
        title: "Updated Card Title",
        description: "New description text",
        assigneeIds: [],
        labels: ["Refactor"],
      });

      expect(updated.title).toBe("Updated Card Title");
      expect(updated.assigneeIds).toHaveLength(0);
      expect(updated.labels).toEqual(["Refactor"]);
    });

    it("should delete card", async () => {
      const deleted = await cardRepo.delete(card1Id);
      expect(deleted).toBe(true);

      const found = await cardRepo.findById(card1Id);
      expect(found).toBeNull();
    });

    it("should cascade delete columns and cards when board is deleted", async () => {
      await boardRepo.delete(boardId);

      const col = await columnRepo.findById(col1Id);
      expect(col).toBeNull();

      const remainingCard = await cardRepo.findById(card2Id);
      expect(remainingCard).toBeNull();
    });
  });
});
