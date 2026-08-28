import { describe, it, expect } from "vitest";
import {
  createBoardSchema,
  updateBoardSchema,
  createColumnSchema,
  updateColumnSchema,
  moveColumnSchema,
  reorderColumnsSchema,
  createCardSchema,
  updateCardSchema,
  moveCardSchema,
} from "./board.schema";

describe("Board & Kanban Validation Schemas (Unit)", () => {
  describe("createBoardSchema", () => {
    it("should accept valid board input", () => {
      const valid = {
        title: "Sprint Planning",
        description: "Sprint goals and backlog items",
      };
      const result = createBoardSchema.parse(valid);
      expect(result.title).toBe("Sprint Planning");
      expect(result.description).toBe("Sprint goals and backlog items");
    });

    it("should allow null or missing description", () => {
      expect(createBoardSchema.parse({ title: "Minimal Board" }).description).toBeUndefined();
      expect(createBoardSchema.parse({ title: "Minimal Board", description: null }).description).toBeNull();
    });

    it("should reject empty title", () => {
      expect(() => createBoardSchema.parse({ title: "" })).toThrow("Board title is required");
    });

    it("should reject title exceeding 100 characters", () => {
      expect(() => createBoardSchema.parse({ title: "a".repeat(101) })).toThrow();
    });

    it("should reject description exceeding 500 characters", () => {
      expect(() => createBoardSchema.parse({ title: "Valid", description: "a".repeat(501) })).toThrow();
    });
  });

  describe("updateBoardSchema", () => {
    it("should accept partial updates", () => {
      expect(updateBoardSchema.parse({ title: "New Title" })).toEqual({ title: "New Title" });
      expect(updateBoardSchema.parse({ position: 100 })).toEqual({ position: 100 });
      expect(updateBoardSchema.parse({})).toEqual({});
    });

    it("should reject negative position", () => {
      expect(() => updateBoardSchema.parse({ position: -1 })).toThrow();
    });
  });

  describe("createColumnSchema & updateColumnSchema", () => {
    it("should accept valid column input", () => {
      const result = createColumnSchema.parse({
        title: "In Progress",
        color: "#3B82F6",
        position: 65536,
      });
      expect(result.title).toBe("In Progress");
      expect(result.color).toBe("#3B82F6");
      expect(result.position).toBe(65536);
    });

    it("should reject empty column title", () => {
      expect(() => createColumnSchema.parse({ title: "" })).toThrow("Column title is required");
    });

    it("should reject column title exceeding 100 characters", () => {
      expect(() => createColumnSchema.parse({ title: "c".repeat(101) })).toThrow();
    });

    it("should reject negative column position", () => {
      expect(() => createColumnSchema.parse({ title: "Done", position: -10 })).toThrow();
    });
  });

  describe("moveColumnSchema & reorderColumnsSchema", () => {
    it("should accept valid column move payload", () => {
      const result = moveColumnSchema.parse({
        columnId: "col_123",
        targetPosition: 131072,
      });
      expect(result.columnId).toBe("col_123");
      expect(result.targetPosition).toBe(131072);
    });

    it("should reject negative targetPosition in column move", () => {
      expect(() =>
        moveColumnSchema.parse({ columnId: "col_123", targetPosition: -1 })
      ).toThrow("Target position must be non-negative");
    });

    it("should reject empty columnIds array in reorderColumnsSchema", () => {
      expect(() => reorderColumnsSchema.parse({ columnIds: [] })).toThrow(
        "At least one column ID is required"
      );
    });

    it("should accept valid list of columnIds for reordering", () => {
      const result = reorderColumnsSchema.parse({ columnIds: ["col_1", "col_2", "col_3"] });
      expect(result.columnIds).toHaveLength(3);
    });
  });

  describe("createCardSchema & updateCardSchema", () => {
    it("should accept valid card creation payload", () => {
      const result = createCardSchema.parse({
        columnId: "col_1",
        title: "Implement Testing Pyramid",
        description: "Add comprehensive unit, integration, and E2E tests",
        position: 65536,
        dueDate: "2026-09-01T12:00:00.000Z",
        labels: ["testing", "security"],
        assigneeIds: ["usr_1", "usr_2"],
      });
      expect(result.title).toBe("Implement Testing Pyramid");
      expect(result.columnId).toBe("col_1");
      expect(result.labels).toEqual(["testing", "security"]);
      expect(result.assigneeIds).toEqual(["usr_1", "usr_2"]);
    });

    it("should reject missing columnId on card creation", () => {
      expect(() => createCardSchema.parse({ title: "No Column" })).toThrow();
    });

    it("should reject empty card title", () => {
      expect(() => createCardSchema.parse({ columnId: "col_1", title: "" })).toThrow(
        "Card title is required"
      );
    });

    it("should reject card title exceeding 255 characters", () => {
      expect(() =>
        createCardSchema.parse({ columnId: "col_1", title: "k".repeat(256) })
      ).toThrow();
    });

    it("should reject label exceeding 50 characters", () => {
      expect(() =>
        createCardSchema.parse({
          columnId: "col_1",
          title: "Card",
          labels: ["a".repeat(51)],
        })
      ).toThrow();
    });
  });

  describe("moveCardSchema", () => {
    it("should accept valid card move payload", () => {
      const result = moveCardSchema.parse({
        cardId: "card_10",
        sourceColumnId: "col_backlog",
        targetColumnId: "col_done",
        targetPosition: 32768,
      });
      expect(result.cardId).toBe("card_10");
      expect(result.sourceColumnId).toBe("col_backlog");
      expect(result.targetColumnId).toBe("col_done");
      expect(result.targetPosition).toBe(32768);
    });

    it("should reject missing required cardId or column IDs", () => {
      expect(() =>
        moveCardSchema.parse({
          sourceColumnId: "col_1",
          targetColumnId: "col_2",
          targetPosition: 10,
        })
      ).toThrow();

      expect(() =>
        moveCardSchema.parse({
          cardId: "card_1",
          targetColumnId: "col_2",
          targetPosition: 10,
        })
      ).toThrow();
    });

    it("should reject negative targetPosition in card move", () => {
      expect(() =>
        moveCardSchema.parse({
          cardId: "card_1",
          sourceColumnId: "col_1",
          targetColumnId: "col_2",
          targetPosition: -5,
        })
      ).toThrow("Target position must be non-negative");
    });
  });
});
