import { db, type DatabaseClient } from "../client";
import type {
  CardRecord,
  CreateCardData,
  ICardRepository,
  MoveCardData,
  UpdateCardData,
} from "../repository";
import {
  calculatePosition,
  generateRebalancedPositions,
  isGapExhausted,
  ORDERING_CONSTANTS,
} from "../../modules/boards/ordering.utils";

export class PrismaCardRepository implements ICardRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<CardRecord | null> {
    const record = await this.prisma.card.findUnique({
      where: { id },
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
    });

    if (!record) return null;

    return {
      id: record.id,
      columnId: record.columnId,
      boardId: record.boardId,
      title: record.title,
      description: record.description,
      position: record.position,
      dueDate: record.dueDate,
      labels: record.labels,
      assigneeIds: record.assignees.map((a) => a.userId),
      assignees: record.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
        createdAt: a.user.createdAt.toISOString(),
        updatedAt: a.user.updatedAt.toISOString(),
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findByColumnId(columnId: string): Promise<CardRecord[]> {
    const records = await this.prisma.card.findMany({
      where: { columnId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
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
    });

    return records.map((record) => ({
      id: record.id,
      columnId: record.columnId,
      boardId: record.boardId,
      title: record.title,
      description: record.description,
      position: record.position,
      dueDate: record.dueDate,
      labels: record.labels,
      assigneeIds: record.assignees.map((a) => a.userId),
      assignees: record.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
        createdAt: a.user.createdAt.toISOString(),
        updatedAt: a.user.updatedAt.toISOString(),
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async findByBoardId(boardId: string): Promise<CardRecord[]> {
    const records = await this.prisma.card.findMany({
      where: { boardId },
      orderBy: [{ position: "asc" }, { id: "asc" }],
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
    });

    return records.map((record) => ({
      id: record.id,
      columnId: record.columnId,
      boardId: record.boardId,
      title: record.title,
      description: record.description,
      position: record.position,
      dueDate: record.dueDate,
      labels: record.labels,
      assigneeIds: record.assignees.map((a) => a.userId),
      assignees: record.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name,
        email: a.user.email,
        avatarUrl: a.user.avatarUrl,
        createdAt: a.user.createdAt.toISOString(),
        updatedAt: a.user.updatedAt.toISOString(),
      })),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }));
  }

  async create(data: CreateCardData): Promise<CardRecord> {
    return await this.prisma.$transaction(async (tx) => {
      let position = data.position;
      if (position === undefined) {
        const lastCard = await tx.card.findFirst({
          where: { columnId: data.columnId },
          orderBy: [{ position: "desc" }, { id: "desc" }],
        });
        position = lastCard
          ? lastCard.position + ORDERING_CONSTANTS.POSITION_GAP
          : ORDERING_CONSTANTS.INITIAL_POSITION;
      }

      const card = await tx.card.create({
        data: {
          columnId: data.columnId,
          boardId: data.boardId,
          title: data.title.trim(),
          description: data.description ? data.description.trim() : null,
          position,
          dueDate: data.dueDate ?? null,
          labels: data.labels ?? [],
        },
      });

      if (data.assigneeIds && data.assigneeIds.length > 0) {
        const uniqueAssignees = Array.from(new Set(data.assigneeIds));
        await tx.cardAssignee.createMany({
          data: uniqueAssignees.map((userId) => ({
            cardId: card.id,
            userId,
          })),
        });
      }

      const created = await tx.card.findUniqueOrThrow({
        where: { id: card.id },
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
      });

      return {
        id: created.id,
        columnId: created.columnId,
        boardId: created.boardId,
        title: created.title,
        description: created.description,
        position: created.position,
        dueDate: created.dueDate,
        labels: created.labels,
        assigneeIds: created.assignees.map((a) => a.userId),
        assignees: created.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
          createdAt: a.user.createdAt.toISOString(),
          updatedAt: a.user.updatedAt.toISOString(),
        })),
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      };
    });
  }

  async update(id: string, data: UpdateCardData): Promise<CardRecord> {
    return await this.prisma.$transaction(async (tx) => {
      await tx.card.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title.trim() }),
          ...(data.description !== undefined && {
            description: data.description ? data.description.trim() : null,
          }),
          ...(data.columnId !== undefined && { columnId: data.columnId }),
          ...(data.position !== undefined && { position: data.position }),
          ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
          ...(data.labels !== undefined && { labels: data.labels }),
        },
      });

      if (data.assigneeIds !== undefined) {
        // Replace assignees
        await tx.cardAssignee.deleteMany({
          where: { cardId: id },
        });

        const uniqueAssignees = Array.from(new Set(data.assigneeIds));
        if (uniqueAssignees.length > 0) {
          await tx.cardAssignee.createMany({
            data: uniqueAssignees.map((userId) => ({
              cardId: id,
              userId,
            })),
          });
        }
      }

      const updated = await tx.card.findUniqueOrThrow({
        where: { id },
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
      });

      return {
        id: updated.id,
        columnId: updated.columnId,
        boardId: updated.boardId,
        title: updated.title,
        description: updated.description,
        position: updated.position,
        dueDate: updated.dueDate,
        labels: updated.labels,
        assigneeIds: updated.assignees.map((a) => a.userId),
        assignees: updated.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
          createdAt: a.user.createdAt.toISOString(),
          updatedAt: a.user.updatedAt.toISOString(),
        })),
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      };
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.card.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async moveCard(data: MoveCardData): Promise<CardRecord> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch other cards in target column ordered deterministically
      const targetCards = await tx.card.findMany({
        where: {
          columnId: data.targetColumnId,
          id: { not: data.cardId },
        },
        orderBy: [{ position: "asc" }, { id: "asc" }],
      });

      const clampedIndex = Math.max(0, Math.min(data.targetPosition, targetCards.length));
      let prevPos = clampedIndex > 0 ? targetCards[clampedIndex - 1].position : null;
      let nextPos = clampedIndex < targetCards.length ? targetCards[clampedIndex].position : null;

      // 2. Check for gap exhaustion and rebalance column if needed
      if (isGapExhausted(prevPos, nextPos)) {
        const rebalancedPositions = generateRebalancedPositions(targetCards.length);
        for (let i = 0; i < targetCards.length; i++) {
          targetCards[i].position = rebalancedPositions[i];
          await tx.card.update({
            where: { id: targetCards[i].id },
            data: { position: rebalancedPositions[i] },
          });
        }
        prevPos = clampedIndex > 0 ? targetCards[clampedIndex - 1].position : null;
        nextPos = clampedIndex < targetCards.length ? targetCards[clampedIndex].position : null;
      }

      // 3. Calculate new position
      const newPosition = calculatePosition(prevPos, nextPos);

      // 4. Update the moved card (single update in common case)
      await tx.card.update({
        where: { id: data.cardId },
        data: {
          columnId: data.targetColumnId,
          position: newPosition,
        },
      });

      const finalCard = await tx.card.findUniqueOrThrow({
        where: { id: data.cardId },
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
      });

      return {
        id: finalCard.id,
        columnId: finalCard.columnId,
        boardId: finalCard.boardId,
        title: finalCard.title,
        description: finalCard.description,
        position: finalCard.position,
        dueDate: finalCard.dueDate,
        labels: finalCard.labels,
        assigneeIds: finalCard.assignees.map((a) => a.userId),
        assignees: finalCard.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
          avatarUrl: a.user.avatarUrl,
          createdAt: a.user.createdAt.toISOString(),
          updatedAt: a.user.updatedAt.toISOString(),
        })),
        createdAt: finalCard.createdAt,
        updatedAt: finalCard.updatedAt,
      };
    });
  }
}

export const cardRepository = new PrismaCardRepository();
