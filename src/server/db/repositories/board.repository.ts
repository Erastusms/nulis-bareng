import { db, type DatabaseClient } from "../client";
import type {
  BoardRecord,
  CreateBoardData,
  IBoardRepository,
  UpdateBoardData,
} from "../repository";

export class PrismaBoardRepository implements IBoardRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<BoardRecord | null> {
    const record = await this.prisma.board.findUnique({
      where: { id },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findWithDetails(id: string): Promise<BoardRecord | null> {
    const record = await this.prisma.board.findUnique({
      where: { id },
      include: {
        columns: {
          orderBy: { position: "asc" },
          include: {
            cards: {
              orderBy: { position: "asc" },
              include: {
                assignees: {
                  include: {
                    user: {
                      select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                        createdAt: true,
                        updatedAt: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      columns: record.columns.map((col) => ({
        id: col.id,
        boardId: col.boardId,
        title: col.title,
        position: col.position,
        color: col.color,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
        cards: col.cards.map((c) => ({
          id: c.id,
          columnId: c.columnId,
          boardId: c.boardId,
          title: c.title,
          description: c.description,
          position: c.position,
          dueDate: c.dueDate,
          labels: c.labels,
          assigneeIds: c.assignees.map((a) => a.userId),
          assignees: c.assignees.map((a) => ({
            id: a.user.id,
            name: a.user.name,
            email: a.user.email,
            avatarUrl: a.user.avatarUrl,
            createdAt: a.user.createdAt.toISOString(),
            updatedAt: a.user.updatedAt.toISOString(),
          })),
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      })),
    };
  }

  async findByWorkspaceId(workspaceId: string): Promise<BoardRecord[]> {
    const records = await this.prisma.board.findMany({
      where: { workspaceId },
      orderBy: { position: "asc" },
    });

    return records.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async create(data: CreateBoardData): Promise<BoardRecord> {
    let position = data.position;
    if (position === undefined) {
      const count = await this.prisma.board.count({
        where: { workspaceId: data.workspaceId },
      });
      position = count;
    }

    const record = await this.prisma.board.create({
      data: {
        workspaceId: data.workspaceId,
        title: data.title.trim(),
        description: data.description ? data.description.trim() : null,
        position,
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(id: string, data: UpdateBoardData): Promise<BoardRecord> {
    const record = await this.prisma.board.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title.trim() }),
        ...(data.description !== undefined && {
          description: data.description ? data.description.trim() : null,
        }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      description: record.description,
      position: record.position,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.board.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return this.prisma.board.count({
      where: { workspaceId },
    });
  }
}

export const boardRepository = new PrismaBoardRepository();
