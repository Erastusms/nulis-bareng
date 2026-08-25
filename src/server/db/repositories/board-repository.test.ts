import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../client";
import { PrismaBoardRepository } from "./board.repository";
import { PrismaBoardColumnRepository } from "./board-column.repository";
import { PrismaCardRepository } from "./card.repository";
import { PrismaUserRepository } from "./user.repository";
import { PrismaWorkspaceRepository } from "./workspace.repository";
import { hashPassword } from "@/server/auth/password";
import { ORDERING_CONSTANTS } from "../../modules/boards/ordering.utils";

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
    it("should create a new board in workspace with default gap position", async () => {
      const board = await boardRepo.create({
        workspaceId,
        title: "Sprint 1 Board",
        description: "Main development board",
      });

      expect(board.id).toBeDefined();
      expect(board.workspaceId).toBe(workspaceId);
      expect(board.title).toBe("Sprint 1 Board");
      expect(board.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION);

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
    it("should create columns with correct gap-spaced positions", async () => {
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

      expect(col1.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION);
      expect(col2.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION + ORDERING_CONSTANTS.POSITION_GAP);
      expect(col3.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION + 2 * ORDERING_CONSTANTS.POSITION_GAP);

      col1Id = col1.id;
      col2Id = col2.id;
    });

    it("should find columns by board id ordered by position deterministically", async () => {
      const cols = await columnRepo.findByBoardId(boardId);
      expect(cols).toHaveLength(3);
      expect(cols[0].title).toBe("To Do");
      expect(cols[1].title).toBe("In Progress");
      expect(cols[2].title).toBe("Done");
    });

    it("should atomically reorder columns with gap-based positions", async () => {
      const cols = await columnRepo.findByBoardId(boardId);
      const reversedIds = cols.map((c) => c.id).reverse();

      const reordered = await columnRepo.reorderColumns(boardId, reversedIds);
      expect(reordered[0].id).toBe(reversedIds[0]);
      expect(reordered[0].position).toBe(ORDERING_CONSTANTS.POSITION_GAP);
      expect(reordered[1].position).toBe(2 * ORDERING_CONSTANTS.POSITION_GAP);
      expect(reordered[2].position).toBe(3 * ORDERING_CONSTANTS.POSITION_GAP);
    });

    it("should move a single column between two columns with midpoint position", async () => {
      const cols = await columnRepo.findByBoardId(boardId);
      // Move first column to index 1 (between index 0 and index 2)
      const moved = await columnRepo.moveColumn({
        columnId: cols[0].id,
        boardId,
        targetPosition: 1,
      });

      expect(moved.id).toBe(cols[0].id);
      // Verify new position is between the other two
      const updatedCols = await columnRepo.findByBoardId(boardId);
      expect(updatedCols[1].id).toBe(cols[0].id);
    });
  });

  describe("PrismaCardRepository", () => {
    it("should create cards with assignees and labels and gap positions", async () => {
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
      expect(card1.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION);
      expect(card1.assigneeIds).toContain(userId);
      expect(card1.labels).toContain("Feature");

      expect(card2.id).toBeDefined();
      expect(card2.position).toBe(ORDERING_CONSTANTS.INITIAL_POSITION + ORDERING_CONSTANTS.POSITION_GAP);

      card1Id = card1.id;
      card2Id = card2.id;
    });

    it("should find board with detailed columns and cards ordered by position", async () => {
      const detailed = await boardRepo.findWithDetails(boardId);
      expect(detailed).not.toBeNull();
      expect(detailed?.columns).toBeDefined();

      const colWithCards = detailed?.columns?.find((c) => c.id === col1Id);
      expect(colWithCards?.cards?.length).toBe(2);
      expect(colWithCards?.cards?.[0].assignees?.[0].id).toBe(userId);
    });

    it("should move card within the same column and update only the moved card position", async () => {
      // Move card2 (originally index 1) to index 0 (before card1)
      const initialCard1 = await cardRepo.findById(card1Id);
      const moved = await cardRepo.moveCard({
        cardId: card2Id,
        sourceColumnId: col1Id,
        targetColumnId: col1Id,
        targetPosition: 0,
      });

      // Card 2 position should now be less than card 1 position
      expect(moved.position).toBeLessThan(initialCard1!.position);

      // Card 1 position in DB should remain unchanged!
      const afterCard1 = await cardRepo.findById(card1Id);
      expect(afterCard1?.position).toBe(initialCard1?.position);

      const cards = await cardRepo.findByColumnId(col1Id);
      expect(cards[0].id).toBe(card2Id);
      expect(cards[1].id).toBe(card1Id);
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

      const col1Cards = await cardRepo.findByColumnId(col1Id);
      expect(col1Cards).toHaveLength(1);
      expect(col1Cards[0].id).toBe(card2Id);

      const col2Cards = await cardRepo.findByColumnId(col2Id);
      expect(col2Cards).toHaveLength(1);
      expect(col2Cards[0].id).toBe(card1Id);
    });

    it("should trigger rebalance when gap is exhausted", async () => {
      // Artificially create a narrow gap in col2:
      // Create card3 and card4 with positions 100 and 101
      const card3 = await cardRepo.create({
        columnId: col2Id,
        boardId,
        title: "Narrow Gap Card 1",
        position: 100,
      });
      const card4 = await cardRepo.create({
        columnId: col2Id,
        boardId,
        title: "Narrow Gap Card 2",
        position: 101,
      });

      // Move card1 between card3 and card4 (targetPosition: 1)
      const moved = await cardRepo.moveCard({
        cardId: card1Id,
        sourceColumnId: col2Id,
        targetColumnId: col2Id,
        targetPosition: 1,
      });

      expect(moved.id).toBe(card1Id);
      // All cards in col2 should now have healthy rebalanced positions
      const col2Cards = await cardRepo.findByColumnId(col2Id);
      expect(col2Cards.length).toBe(3);
      for (let i = 0; i < col2Cards.length - 1; i++) {
        expect(col2Cards[i + 1].position - col2Cards[i].position).toBeGreaterThanOrEqual(
          ORDERING_CONSTANTS.MIN_POSITION_GAP
        );
      }

      await cardRepo.delete(card3.id);
      await cardRepo.delete(card4.id);
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
