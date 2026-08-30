import { Prisma, WorkspaceRole } from "@prisma/client";
import { ConflictError } from "@/lib/api/errors";
import { db, type DatabaseClient } from "../client";
import type {
  CreateWorkspaceData,
  IWorkspaceRepository,
  UpdateWorkspaceData,
  WorkspaceRecord,
} from "../repository";
import type { WorkspaceRole as DomainWorkspaceRole } from "@/types/domain";

export class PrismaWorkspaceRepository implements IWorkspaceRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<WorkspaceRecord | null> {
    const record = await this.prisma.workspace.findUnique({
      where: { id },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      urlIdentifier: record.urlIdentifier,
      description: record.description,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      memberCount: record._count.members,
    };
  }

  async findBySlug(slug: string): Promise<WorkspaceRecord | null> {
    const record = await this.prisma.workspace.findFirst({
      where: { slug: slug.toLowerCase().trim() },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      urlIdentifier: record.urlIdentifier,
      description: record.description,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      memberCount: record._count.members,
    };
  }

  async findByUrlIdentifier(urlIdentifier: string): Promise<WorkspaceRecord | null> {
    const record = await this.prisma.workspace.findUnique({
      where: { urlIdentifier: urlIdentifier.toLowerCase().trim() },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      urlIdentifier: record.urlIdentifier,
      description: record.description,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      memberCount: record._count.members,
    };
  }

  async findByIdOrUrlIdentifier(identifier: string): Promise<WorkspaceRecord | null> {
    const clean = identifier.trim();
    const lower = clean.toLowerCase();
    const record = await this.prisma.workspace.findFirst({
      where: {
        OR: [
          { id: clean },
          { urlIdentifier: lower },
          { slug: lower },
        ],
      },
      include: {
        _count: {
          select: { members: true },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      name: record.name,
      slug: record.slug,
      urlIdentifier: record.urlIdentifier,
      description: record.description,
      ownerId: record.ownerId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      memberCount: record._count.members,
    };
  }

  async findByUserId(userId: string): Promise<(WorkspaceRecord & { role: DomainWorkspaceRole })[]> {
    const memberships = await this.prisma.workspaceMember.findMany({
      where: { userId },
      include: {
        workspace: {
          include: {
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      urlIdentifier: m.workspace.urlIdentifier,
      description: m.workspace.description,
      ownerId: m.workspace.ownerId,
      createdAt: m.workspace.createdAt,
      updatedAt: m.workspace.updatedAt,
      role: m.role as DomainWorkspaceRole,
      memberCount: m.workspace._count.members,
    }));
  }

  async createWithOwner(data: CreateWorkspaceData): Promise<WorkspaceRecord> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            name: data.name.trim(),
            slug: data.slug.toLowerCase().trim(),
            urlIdentifier: data.urlIdentifier.toLowerCase().trim(),
            description: data.description ? data.description.trim() : null,
            ownerId: data.ownerId,
          },
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            userId: data.ownerId,
            role: WorkspaceRole.OWNER,
          },
        });

        return {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          urlIdentifier: workspace.urlIdentifier,
          description: workspace.description,
          ownerId: workspace.ownerId,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          role: "OWNER" as DomainWorkspaceRole,
          memberCount: 1,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          `Workspace with URL identifier '${data.urlIdentifier.toLowerCase().trim()}' already exists. Please choose another workspace URL.`
        );
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateWorkspaceData): Promise<WorkspaceRecord> {
    try {
      const record = await this.prisma.workspace.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.slug !== undefined && { slug: data.slug.toLowerCase().trim() }),
          ...(data.urlIdentifier !== undefined && {
            urlIdentifier: data.urlIdentifier.toLowerCase().trim(),
          }),
          ...(data.description !== undefined && {
            description: data.description ? data.description.trim() : null,
          }),
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
      });

      return {
        id: record.id,
        name: record.name,
        slug: record.slug,
        urlIdentifier: record.urlIdentifier,
        description: record.description,
        ownerId: record.ownerId,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        memberCount: record._count.members,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictError(
          `Workspace with URL identifier '${data.urlIdentifier?.toLowerCase().trim()}' already exists. Please choose another workspace URL.`
        );
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workspace.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const workspaceRepository = new PrismaWorkspaceRepository();
