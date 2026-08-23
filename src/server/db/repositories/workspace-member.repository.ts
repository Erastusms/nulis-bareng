import { WorkspaceRole } from "@prisma/client";
import { db, type DatabaseClient } from "../client";
import type {
  CreateWorkspaceMemberData,
  IWorkspaceMemberRepository,
  WorkspaceMemberRecord,
  WorkspaceMemberWithUserRecord,
} from "../repository";
import type { WorkspaceRole as DomainWorkspaceRole } from "@/types/domain";

export class PrismaWorkspaceMemberRepository implements IWorkspaceMemberRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findByWorkspaceAndUser(
    workspaceId: string,
    userId: string
  ): Promise<WorkspaceMemberRecord | null> {
    const record = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      role: record.role as DomainWorkspaceRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async findMembersByWorkspaceId(workspaceId: string): Promise<WorkspaceMemberWithUserRecord[]> {
    const records = await this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return records.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      role: record.role as DomainWorkspaceRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      user: {
        id: record.user.id,
        name: record.user.name,
        email: record.user.email,
        avatarUrl: record.user.avatarUrl,
        createdAt: record.user.createdAt,
      },
    }));
  }

  async create(data: CreateWorkspaceMemberData): Promise<WorkspaceMemberRecord> {
    const role = (data.role?.toUpperCase() ?? "MEMBER") as WorkspaceRole;
    const record = await this.prisma.workspaceMember.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        role,
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      role: record.role as DomainWorkspaceRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: DomainWorkspaceRole
  ): Promise<WorkspaceMemberRecord> {
    const prismaRole = role.toUpperCase() as WorkspaceRole;
    const record = await this.prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      data: {
        role: prismaRole,
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      userId: record.userId,
      role: record.role as DomainWorkspaceRole,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async delete(workspaceId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  async countByWorkspaceId(workspaceId: string): Promise<number> {
    return this.prisma.workspaceMember.count({
      where: { workspaceId },
    });
  }
}

export const workspaceMemberRepository = new PrismaWorkspaceMemberRepository();
