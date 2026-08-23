import { db, type DatabaseClient } from "../client";
import type {
  BoardColumnRecord,
  CreateBoardColumnData,
  IBoardColumnRepository,
  UpdateBoardColumnData,
} from "../repository";

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
      orderBy: { position: "asc" },
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
      const count = await this.prisma.boardColumn.count({
        where: { boardId: data.boardId },
      });
      position = count;
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

  async reorderColumns(
    boardId: string,
    orderedColumnIds: string[]
  ): Promise<BoardColumnRecord[]> {
    return await this.prisma.$transaction(async (tx) => {
      // Update each column position in order
      const updatePromises = orderedColumnIds.map((colId, index) =>
        tx.boardColumn.update({
          where: { id: colId, boardId },
          data: { position: index },
        })
      );

      await Promise.all(updatePromises);

      const updated = await tx.boardColumn.findMany({
        where: { boardId },
        orderBy: { position: "asc" },
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
