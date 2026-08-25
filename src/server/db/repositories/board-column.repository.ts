import { db, type DatabaseClient } from "../client";
import type {
  BoardColumnRecord,
  CreateBoardColumnData,
  IBoardColumnRepository,
  MoveColumnData,
  UpdateBoardColumnData,
} from "../repository";
import {
  calculatePosition,
  generateRebalancedPositions,
  isGapExhausted,
  ORDERING_CONSTANTS,
} from "../../modules/boards/ordering.utils";

export class PrismaBoardColumnRepository implements IBoardColumnRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<BoardColumnRecord | null> {
    const record = await this.prisma.boardColumn.findUnique({
      where: { id },
    });

    if (!record) return null;

    return {
      id: record.id,
      boardId: record.boardId,
      title: record.title,
      position: record.position,
      color: record.color,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findByBoardId(boardId: string): Promise<BoardColumnRecord[]> {
    const records = await this.prisma.boardColumn.findMany({
      where: { boardId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
    });

    return records.map((record) => ({
      id: record.id,
      boardId: record.boardId,
      title: record.title,
      position: record.position,
      color: record.color,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async create(data: CreateBoardColumnData): Promise<BoardColumnRecord> {
    let position = data.position;
    if (position === undefined) {
      const lastCol = await this.prisma.boardColumn.findFirst({
        where: { boardId: data.boardId },
        orderBy: [{ position: "desc" }, { id: "desc" }],
      });
      position = lastCol
        ? lastCol.position + ORDERING_CONSTANTS.POSITION_GAP
        : ORDERING_CONSTANTS.INITIAL_POSITION;
    }

    const record = await this.prisma.boardColumn.create({
      data: {
        boardId: data.boardId,
        title: data.title.trim(),
        position,
        color: data.color ? data.color.trim() : null,
      },
    });

    return {
      id: record.id,
      boardId: record.boardId,
      title: record.title,
      position: record.position,
      color: record.color,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(id: string, data: UpdateBoardColumnData): Promise<BoardColumnRecord> {
    const record = await this.prisma.boardColumn.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.color !== undefined && {
          color: data.color ? data.color.trim() : null,
        }),
      },
    });

    return {
      id: record.id,
      boardId: record.boardId,
      title: record.title,
      position: record.position,
      color: record.color,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.boardColumn.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async moveColumn(data: MoveColumnData): Promise<BoardColumnRecord> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch other columns in the board
      const targetColumns = await tx.boardColumn.findMany({
        where: {
          boardId: data.boardId,
          id: { not: data.columnId },
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      const clampedIndex = Math.max(0, Math.min(data.targetPosition, targetColumns.length));
      let prevPos = clampedIndex > 0 ? targetColumns[clampedIndex - 1].position : null;
      let nextPos = clampedIndex < targetColumns.length ? targetColumns[clampedIndex].position : null;

      // 2. Check for gap exhaustion and rebalance if needed
      if (isGapExhausted(prevPos, nextPos)) {
        const rebalancedPositions = generateRebalancedPositions(targetColumns.length);
        for (let i = 0; i < targetColumns.length; i++) {
          targetColumns[i].position = rebalancedPositions[i];
          await tx.boardColumn.update({
            where: { id: targetColumns[i].id },
            data: { position: rebalancedPositions[i] },
          });
        }
        prevPos = clampedIndex > 0 ? targetColumns[clampedIndex - 1].position : null;
        nextPos = clampedIndex < targetColumns.length ? targetColumns[clampedIndex].position : null;
      }

      // 3. Calculate new position
      const newPosition = calculatePosition(prevPos, nextPos);

      // 4. Update the moved column (single update in common case)
      const updated = await tx.boardColumn.update({
        where: { id: data.columnId },
        data: { position: newPosition },
      });

      return {
        id: updated.id,
        boardId: updated.boardId,
        title: updated.title,
        position: updated.position,
        color: updated.color,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async reorderColumns(
    boardId: string,
    orderedColumnIds: string[]
  ): Promise<BoardColumnRecord[]> {
    return await this.prisma.$transaction(async (tx) => {
      // Update each column position in order with consistent gap spacing
      const updatePromises = orderedColumnIds.map((colId, index) =>
        tx.boardColumn.update({
          where: { id: colId, boardId },
          data: { position: (index + 1) * ORDERING_CONSTANTS.POSITION_GAP },
        })
      );

      await Promise.all(updatePromises);

      const updated = await tx.boardColumn.findMany({
        where: { boardId },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      return updated.map((record) => ({
        id: record.id,
        boardId: record.boardId,
        title: record.title,
        position: record.position,
        color: record.color,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }));
    });
  }
}

export const boardColumnRepository = new PrismaBoardColumnRepository();
