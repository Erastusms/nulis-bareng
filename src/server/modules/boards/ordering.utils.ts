/**
 * Ordering & Positioning Utility for Kanban Boards, Columns, and Cards.
 * Implements gap-based positioning with controlled rebalancing.
 */

export const ORDERING_CONSTANTS = {
  /** Initial position when adding to an empty list */
  INITIAL_POSITION: 65536,
  /** Standard gap between consecutive items */
  POSITION_GAP: 65536,
  /** Minimum allowable gap before triggering a rebalance */
  MIN_POSITION_GAP: 2,
  /** Maximum safe signed 32-bit integer position */
  MAX_POSITION: 2147483647,
} as const;

export interface PositionCalculationParams {
  prevPosition?: number | null;
  nextPosition?: number | null;
}

/**
 * Calculates the next position based on neighboring item positions.
 *
 * Cases:
 * 1. Empty list: returns INITIAL_POSITION (65536)
 * 2. Insert at beginning: returns nextPosition - POSITION_GAP if nextPosition > POSITION_GAP, else floor(nextPosition / 2)
 * 3. Insert at end: returns prevPosition + POSITION_GAP
 * 4. Insert between two items: returns floor((prevPosition + nextPosition) / 2)
 */
export function calculatePosition(
  prevPosition?: number | null,
  nextPosition?: number | null
): number {
  const hasPrev = prevPosition !== undefined && prevPosition !== null;
  const hasNext = nextPosition !== undefined && nextPosition !== null;

  // Case 1: Empty list
  if (!hasPrev && !hasNext) {
    return ORDERING_CONSTANTS.INITIAL_POSITION;
  }

  // Case 2: Insert at start (no previous item)
  if (!hasPrev && hasNext) {
    const next = nextPosition as number;
    if (next > ORDERING_CONSTANTS.POSITION_GAP) {
      return next - ORDERING_CONSTANTS.POSITION_GAP;
    }
    return Math.floor(next / 2);
  }

  // Case 3: Insert at end (no next item)
  if (hasPrev && !hasNext) {
    const prev = prevPosition as number;
    return prev + ORDERING_CONSTANTS.POSITION_GAP;
  }

  // Case 4: Insert between two items
  const prev = prevPosition as number;
  const next = nextPosition as number;
  return Math.floor((prev + next) / 2);
}

/**
 * Determines whether the gap between two positions is too narrow to insert safely.
 */
export function isGapExhausted(
  prevPosition?: number | null,
  nextPosition?: number | null
): boolean {
  const hasPrev = prevPosition !== undefined && prevPosition !== null;
  const hasNext = nextPosition !== undefined && nextPosition !== null;

  // Both neighbors exist: check difference between them
  if (hasPrev && hasNext) {
    const prev = prevPosition as number;
    const next = nextPosition as number;
    if (next <= prev) {
      return true;
    }
    return next - prev <= ORDERING_CONSTANTS.MIN_POSITION_GAP;
  }

  // Insert at beginning: check if next item has enough space above 0
  if (!hasPrev && hasNext) {
    const next = nextPosition as number;
    return next <= ORDERING_CONSTANTS.MIN_POSITION_GAP;
  }

  // Insert at end: check if overflow limit is approached
  if (hasPrev && !hasNext) {
    const prev = prevPosition as number;
    return prev + ORDERING_CONSTANTS.POSITION_GAP >= ORDERING_CONSTANTS.MAX_POSITION;
  }

  return false;
}

/**
 * Generates an array of evenly spaced positions for rebalancing an item list.
 *
 * @param count Number of items to assign positions to
 * @returns Array of numbers: [65536, 131072, 196608, ...]
 */
export function generateRebalancedPositions(count: number): number[] {
  const positions: number[] = new Array(count);
  for (let i = 0; i < count; i++) {
    positions[i] = (i + 1) * ORDERING_CONSTANTS.POSITION_GAP;
  }
  return positions;
}
