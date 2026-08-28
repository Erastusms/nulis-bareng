import { describe, it, expect } from "vitest";
import {
  calculatePosition,
  generateRebalancedPositions,
  isGapExhausted,
  ORDERING_CONSTANTS,
} from "./ordering.utils";

describe("Kanban Ordering Invariants & Positioning Logic (Unit)", () => {
  describe("Basic Positioning Invariants", () => {
    it("should assign INITIAL_POSITION (65536) when inserting into an empty column", () => {
      const pos = calculatePosition(null, null);
      expect(pos).toBe(ORDERING_CONSTANTS.INITIAL_POSITION);
      expect(pos).toBe(65536);
    });

    it("should assign nextPosition - GAP when inserting at the beginning with sufficient space", () => {
      // First card is at 131072 -> new card inserted before it should be at 131072 - 65536 = 65536
      const pos = calculatePosition(null, 131072);
      expect(pos).toBe(65536);
    });

    it("should halve the position when inserting at beginning with small nextPosition", () => {
      // First card is at 65536 -> new card before it should be at 32768
      const pos1 = calculatePosition(null, 65536);
      expect(pos1).toBe(32768);

      const pos2 = calculatePosition(null, 32768);
      expect(pos2).toBe(16384);

      const pos3 = calculatePosition(null, 16384);
      expect(pos3).toBe(8192);
    });

    it("should assign prevPosition + GAP when inserting at the end", () => {
      const pos1 = calculatePosition(65536, null);
      expect(pos1).toBe(131072);

      const pos2 = calculatePosition(131072, null);
      expect(pos2).toBe(196608);
    });

    it("should assign integer midpoint when inserting between two items", () => {
      // Between 65536 and 131072 -> 98304
      const pos = calculatePosition(65536, 131072);
      expect(pos).toBe(98304);
      expect(pos).toBeGreaterThan(65536);
      expect(pos).toBeLessThan(131072);
    });
  });

  describe("Ordering Invariant Preservation: Card A -> Card C -> Card B", () => {
    it("should preserve strict ascending order when moving C between A and B", () => {
      const cardA = { id: "A", pos: 65536 };
      const cardB = { id: "B", pos: 131072 };
      const cardC = { id: "C", pos: 196608 };

      // Move C between A and B
      const newPosC = calculatePosition(cardA.pos, cardB.pos);
      cardC.pos = newPosC;

      const column = [cardA, cardC, cardB];
      const sorted = [...column].sort((a, b) => a.pos - b.pos);

      expect(sorted.map((c) => c.id)).toEqual(["A", "C", "B"]);
      expect(cardA.pos).toBeLessThan(cardC.pos);
      expect(cardC.pos).toBeLessThan(cardB.pos);
    });

    it("should preserve deterministic order across repeatedly moving the same card", () => {
      let cards = [
        { id: "A", pos: 65536 },
        { id: "B", pos: 131072 },
        { id: "C", pos: 196608 },
        { id: "D", pos: 262144 },
      ];

      // Move D to start (before A)
      const dPos1 = calculatePosition(null, cards[0].pos);
      cards = [{ id: "D", pos: dPos1 }, cards[0], cards[1], cards[2]];
      expect(cards.map((c) => c.id)).toEqual(["D", "A", "B", "C"]);

      // Move D between B and C
      const bCard = cards.find((c) => c.id === "B")!;
      const cCard = cards.find((c) => c.id === "C")!;
      const dPos2 = calculatePosition(bCard.pos, cCard.pos);
      const remaining = cards.filter((c) => c.id !== "D");
      const updatedList = [...remaining, { id: "D", pos: dPos2 }].sort((a, b) => a.pos - b.pos);

      expect(updatedList.map((c) => c.id)).toEqual(["A", "B", "D", "C"]);
    });
  });

  describe("Gap Exhaustion & Rebalancing Detection", () => {
    it("should detect when gap between neighboring cards is exhausted (<= MIN_POSITION_GAP)", () => {
      expect(isGapExhausted(100, 101)).toBe(true); // gap is 1
      expect(isGapExhausted(100, 102)).toBe(true); // gap is 2 (<= MIN_POSITION_GAP)
      expect(isGapExhausted(100, 103)).toBe(false); // gap is 3 (> MIN_POSITION_GAP)
    });

    it("should detect gap exhaustion at the beginning of a column", () => {
      expect(isGapExhausted(null, 1)).toBe(true);
      expect(isGapExhausted(null, 2)).toBe(true);
      expect(isGapExhausted(null, 3)).toBe(false);
      expect(isGapExhausted(null, 65536)).toBe(false);
    });

    it("should detect gap exhaustion near 32-bit integer overflow limit at end", () => {
      const nearMax = ORDERING_CONSTANTS.MAX_POSITION - 1000;
      expect(isGapExhausted(nearMax, null)).toBe(true);
      expect(isGapExhausted(1000000, null)).toBe(false);
    });

    it("should detect inverted positions as exhausted", () => {
      expect(isGapExhausted(200, 100)).toBe(true);
      expect(isGapExhausted(100, 100)).toBe(true);
    });

    it("should generate evenly spaced rebalanced positions", () => {
      const positions = generateRebalancedPositions(5);
      expect(positions).toHaveLength(5);
      expect(positions).toEqual([65536, 131072, 196608, 262144, 327680]);

      // Check gap between every pair is constant
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i] - positions[i - 1]).toBe(ORDERING_CONSTANTS.POSITION_GAP);
      }
    });
  });

  describe("Cross-Column and Same-Column Invariant Consistency", () => {
    it("should compute valid insertion position into arbitrary non-empty target column", () => {
      const targetColumnCards = [
        { id: "T1", pos: 10000 },
        { id: "T2", pos: 50000 },
      ];

      // Insert at head
      const headPos = calculatePosition(null, targetColumnCards[0].pos);
      expect(headPos).toBe(5000);

      // Insert between T1 and T2
      const midPos = calculatePosition(targetColumnCards[0].pos, targetColumnCards[1].pos);
      expect(midPos).toBe(30000);

      // Insert at tail
      const tailPos = calculatePosition(targetColumnCards[1].pos, null);
      expect(tailPos).toBe(50000 + ORDERING_CONSTANTS.POSITION_GAP);
    });
  });
});
