import { describe, expect, it } from "vitest";
import {
  calculatePosition,
  generateRebalancedPositions,
  isGapExhausted,
  ORDERING_CONSTANTS,
} from "./ordering.utils";

describe("Ordering Utilities (ordering.utils.ts)", () => {
  describe("calculatePosition", () => {
    it("should return INITIAL_POSITION for an empty list (no neighbors)", () => {
      const pos = calculatePosition(null, null);
      expect(pos).toBe(ORDERING_CONSTANTS.INITIAL_POSITION);
      expect(pos).toBe(65536);
    });

    it("should calculate position when inserting at the beginning with large gap", () => {
      // next = 131072 -> next > 65536 -> 131072 - 65536 = 65536
      const pos = calculatePosition(null, 131072);
      expect(pos).toBe(65536);
    });

    it("should calculate halved position when inserting at the beginning with small next value", () => {
      // next = 65536 -> 65536 / 2 = 32768
      const pos = calculatePosition(null, 65536);
      expect(pos).toBe(32768);
    });

    it("should calculate position when inserting at the end", () => {
      // prev = 65536 -> prev + 65536 = 131072
      const pos = calculatePosition(65536, null);
      expect(pos).toBe(131072);

      const pos2 = calculatePosition(131072, null);
      expect(pos2).toBe(196608);
    });

    it("should calculate midpoint when inserting between two items", () => {
      // prev = 65536, next = 131072 -> (65536 + 131072) / 2 = 98304
      const pos = calculatePosition(65536, 131072);
      expect(pos).toBe(98304);
    });

    it("should support repeated insertions halving the space", () => {
      const prev = 65536;
      const next = 131072;

      const pos1 = calculatePosition(prev, next);
      expect(pos1).toBe(98304);

      // Insert between 65536 and 98304
      const pos2 = calculatePosition(prev, pos1);
      expect(pos2).toBe(81920);

      // Insert between 65536 and 81920
      const pos3 = calculatePosition(prev, pos2);
      expect(pos3).toBe(73728);
    });
  });

  describe("isGapExhausted", () => {
    it("should return false when gap is healthy between two items", () => {
      expect(isGapExhausted(65536, 131072)).toBe(false);
      expect(isGapExhausted(100, 200)).toBe(false);
    });

    it("should return true when gap between two items is <= MIN_POSITION_GAP", () => {
      expect(isGapExhausted(100, 102)).toBe(true);
      expect(isGapExhausted(100, 101)).toBe(true);
      expect(isGapExhausted(100, 100)).toBe(true); // Invalid inverted order
      expect(isGapExhausted(200, 100)).toBe(true); // Inverted positions
    });

    it("should detect gap exhaustion when inserting at start and next is <= MIN_POSITION_GAP", () => {
      expect(isGapExhausted(null, 2)).toBe(true);
      expect(isGapExhausted(null, 1)).toBe(true);
      expect(isGapExhausted(null, 65536)).toBe(false);
    });

    it("should detect gap exhaustion when inserting at end and approaching MAX_POSITION", () => {
      expect(isGapExhausted(ORDERING_CONSTANTS.MAX_POSITION - 100, null)).toBe(true);
      expect(isGapExhausted(65536, null)).toBe(false);
    });
  });

  describe("generateRebalancedPositions", () => {
    it("should generate evenly spaced positions for n items", () => {
      const rebalanced = generateRebalancedPositions(3);
      expect(rebalanced).toEqual([65536, 131072, 196608]);
    });

    it("should handle single item", () => {
      const rebalanced = generateRebalancedPositions(1);
      expect(rebalanced).toEqual([65536]);
    });

    it("should handle empty list", () => {
      const rebalanced = generateRebalancedPositions(0);
      expect(rebalanced).toEqual([]);
    });
  });
});
