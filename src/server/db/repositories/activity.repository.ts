import { ActivityType } from "@prisma/client";
import { db, type DatabaseClient } from "../client";
import type {
  ActivityPaginationOptions,
  ActivityRecord,
  CreateActivityData,
  IActivityRepository,
  PaginatedActivitiesResult,
} from "../repository";
import type { ActivityType as DomainActivityType } from "@/types/domain";

export class PrismaActivityRepository implements IActivityRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<ActivityRecord | null> {
    const record = await this.prisma.activity.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      actorId: record.actorId,
      type: record.type as unknown as DomainActivityType,
      entityType: record.entityType,
      entityId: record.entityId,
      metadata: (record.metadata as Record<string, unknown>) || null,
      createdAt: record.createdAt,
      actor: record.actor
        ? {
            id: record.actor.id,
            name: record.actor.name,
            email: record.actor.email,
            avatarUrl: record.actor.avatarUrl,
          }
        : undefined,
    };
  }

  async findByWorkspaceId(
    workspaceId: string,
    options?: ActivityPaginationOptions
  ): Promise<PaginatedActivitiesResult> {
    const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
    const cursor = options?.cursor;

    const records = await this.prisma.activity.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    let nextCursor: string | null = null;
    let items = records;

    if (records.length > limit) {
      items = records.slice(0, limit);
      nextCursor = items[items.length - 1].id;
    }


    return {
      items: items.map((record) => ({
        id: record.id,
        workspaceId: record.workspaceId,
        actorId: record.actorId,
        type: record.type as unknown as DomainActivityType,
        entityType: record.entityType,
        entityId: record.entityId,
        metadata: (record.metadata as Record<string, unknown>) || null,
        createdAt: record.createdAt,
        actor: record.actor
          ? {
              id: record.actor.id,
              name: record.actor.name,
              email: record.actor.email,
              avatarUrl: record.actor.avatarUrl,
            }
          : undefined,
      })),
      nextCursor,
    };
  }

  async create(data: CreateActivityData): Promise<ActivityRecord> {
    const record = await this.prisma.activity.create({
      data: {
        workspaceId: data.workspaceId,
        actorId: data.actorId,
        type: data.type as unknown as ActivityType,
        entityType: data.entityType ?? null,
        entityId: data.entityId ?? null,
        metadata: (data.metadata as any) ?? {},
        ...(data.createdAt && { createdAt: data.createdAt }),
      },
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      actorId: record.actorId,
      type: record.type as unknown as DomainActivityType,
      entityType: record.entityType,
      entityId: record.entityId,
      metadata: (record.metadata as Record<string, unknown>) || null,
      createdAt: record.createdAt,
      actor: record.actor
        ? {
            id: record.actor.id,
            name: record.actor.name,
            email: record.actor.email,
            avatarUrl: record.actor.avatarUrl,
          }
        : undefined,
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.activity.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return this.prisma.activity.count({
      where: { workspaceId },
    });
  }
}

export const activityRepository = new PrismaActivityRepository();
