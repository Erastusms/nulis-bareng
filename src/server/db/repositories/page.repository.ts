import { Prisma } from "@prisma/client";
import { db, type DatabaseClient } from "../client";
import type {
  CreatePageData,
  IPageRepository,
  PageRecord,
  PageSummaryRecord,
  UpdatePageData,
} from "../repository";
import { DEFAULT_EMPTY_DOCUMENT } from "@/features/document/schemas/document-validator";

export class PrismaPageRepository implements IPageRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<PageRecord | null> {
    const record = await this.prisma.page.findUnique({
      where: { id },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      content: (record.content as Record<string, unknown>) ?? DEFAULT_EMPTY_DOCUMENT,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findByWorkspaceId(workspaceId: string): Promise<PageSummaryRecord[]> {
    const records = await this.prisma.page.findMany({
      where: { workspaceId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    });

    return records;
  }

  async create(data: CreatePageData): Promise<PageRecord> {
    const content = (data.content ?? DEFAULT_EMPTY_DOCUMENT) as Prisma.InputJsonValue;

    const record = await this.prisma.page.create({
      data: {
        workspaceId: data.workspaceId,
        title: data.title !== undefined ? data.title.trim() : "Untitled",
        content,
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      content: (record.content as Record<string, unknown>) ?? DEFAULT_EMPTY_DOCUMENT,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async update(id: string, data: UpdatePageData): Promise<PageRecord> {
    const updatePayload: Prisma.PageUpdateInput = {};

    if (data.title !== undefined) {
      updatePayload.title = data.title.trim() || "Untitled";
    }

    if (data.content !== undefined) {
      updatePayload.content = data.content as Prisma.InputJsonValue;
    }

    const record = await this.prisma.page.update({
      where: { id },
      data: updatePayload,
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      title: record.title,
      content: (record.content as Record<string, unknown>) ?? DEFAULT_EMPTY_DOCUMENT,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.page.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return this.prisma.page.count({
      where: { workspaceId },
    });
  }
}

export const pageRepository = new PrismaPageRepository();
