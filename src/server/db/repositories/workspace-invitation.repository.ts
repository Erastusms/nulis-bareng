import { WorkspaceRole, InvitationStatus } from "@prisma/client";
import { db, type DatabaseClient } from "../client";
import type {
  CreateWorkspaceInvitationData,
  IWorkspaceInvitationRepository,
  WorkspaceInvitationRecord,
} from "../repository";
import type { WorkspaceRole as DomainWorkspaceRole } from "@/types/domain";

export class PrismaWorkspaceInvitationRepository implements IWorkspaceInvitationRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async create(data: CreateWorkspaceInvitationData): Promise<WorkspaceInvitationRecord> {
    const role = (data.role?.toUpperCase() ?? "MEMBER") as WorkspaceRole;
    const record = await this.prisma.workspaceInvitation.create({
      data: {
        workspaceId: data.workspaceId,
        email: data.email.toLowerCase().trim(),
        role,
        token: data.token,
        inviterId: data.inviterId,
        expiresAt: data.expiresAt,
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      email: record.email,
      role: record.role as DomainWorkspaceRole,
      token: record.token,
      status: record.status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED",
      inviterId: record.inviterId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      inviter: record.inviter,
    };
  }

  async findByToken(token: string): Promise<WorkspaceInvitationRecord | null> {
    const record = await this.prisma.workspaceInvitation.findUnique({
      where: { token },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      email: record.email,
      role: record.role as DomainWorkspaceRole,
      token: record.token,
      status: record.status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED",
      inviterId: record.inviterId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      inviter: record.inviter,
      workspace: record.workspace,
    };
  }

  async findByWorkspaceAndEmail(
    workspaceId: string,
    email: string
  ): Promise<WorkspaceInvitationRecord | null> {
    const record = await this.prisma.workspaceInvitation.findFirst({
      where: {
        workspaceId,
        email: email.toLowerCase().trim(),
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      email: record.email,
      role: record.role as DomainWorkspaceRole,
      token: record.token,
      status: record.status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED",
      inviterId: record.inviterId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      inviter: record.inviter,
    };
  }

  async findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitationRecord[]> {
    const records = await this.prisma.workspaceInvitation.findMany({
      where: {
        workspaceId,
        status: InvitationStatus.PENDING,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return records.map((record) => ({
      id: record.id,
      workspaceId: record.workspaceId,
      email: record.email,
      role: record.role as DomainWorkspaceRole,
      token: record.token,
      status: record.status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED",
      inviterId: record.inviterId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      inviter: record.inviter,
    }));
  }

  async updateStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED"
  ): Promise<WorkspaceInvitationRecord> {
    const record = await this.prisma.workspaceInvitation.update({
      where: { id },
      data: { status: status as InvitationStatus },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      id: record.id,
      workspaceId: record.workspaceId,
      email: record.email,
      role: record.role as DomainWorkspaceRole,
      token: record.token,
      status: record.status as "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED",
      inviterId: record.inviterId,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      inviter: record.inviter,
    };
  }

  async acceptTransactionally(
    invitationId: string,
    workspaceId: string,
    userId: string,
    role: DomainWorkspaceRole
  ): Promise<void> {
    const prismaRole = role.toUpperCase() as WorkspaceRole;
    await this.prisma.$transaction(async (tx) => {
      const existingMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            workspaceId,
            userId,
            role: prismaRole,
          },
        });
      }

      await tx.workspaceInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.ACCEPTED },
      });
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.workspaceInvitation.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const workspaceInvitationRepository = new PrismaWorkspaceInvitationRepository();
