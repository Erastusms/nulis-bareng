import { ForbiddenError } from "@/lib/api/errors";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import type { IWorkspaceMemberRepository, WorkspaceMemberRecord } from "@/server/db/repository";
import type { WorkspaceRole } from "@/types/domain";

export type NormalizedWorkspaceRole = "OWNER" | "ADMIN" | "MEMBER";

/**
 * Normalizes any role representation into standard uppercase WorkspaceRole.
 */
export function normalizeRole(role: string): NormalizedWorkspaceRole {
  const upper = role.toUpperCase();
  if (upper === "OWNER") return "OWNER";
  if (upper === "ADMIN") return "ADMIN";
  return "MEMBER";
}

export interface WorkspaceAuthContext {
  member: WorkspaceMemberRecord;
  role: NormalizedWorkspaceRole;
}

export interface WorkspacePermissions {
  canUpdateWorkspace: boolean;
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canDeleteWorkspace: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
}

/**
 * Pure policy check: determines whether a role can update workspace settings.
 */
export function canUpdateWorkspace(role: WorkspaceRole): boolean {
  const norm = normalizeRole(role);
  return norm === "OWNER" || norm === "ADMIN";
}

/**
 * Pure policy check: determines whether a role can invite members to a workspace.
 */
export function canInviteMember(role: WorkspaceRole): boolean {
  const norm = normalizeRole(role);
  return norm === "OWNER" || norm === "ADMIN";
}

/**
 * Pure policy check: evaluates member removal authorization rules according to RBAC hierarchy.
 */
export function evaluateMemberRemoval(params: {
  removerRole: WorkspaceRole;
  targetRole: WorkspaceRole;
  isTargetOwner: boolean;
  isSelf: boolean;
}): { allowed: boolean; reason?: string } {
  const { removerRole, targetRole, isTargetOwner, isSelf } = params;
  const normRemover = normalizeRole(removerRole);
  const normTarget = normalizeRole(targetRole);

  if (isTargetOwner) {
    return {
      allowed: false,
      reason: "The workspace owner cannot be removed.",
    };
  }

  if (isSelf) {
    return {
      allowed: false,
      reason: "You cannot remove yourself from the workspace using member removal.",
    };
  }

  if (normRemover === "MEMBER") {
    return {
      allowed: false,
      reason: "Members do not have permission to remove other members.",
    };
  }

  if (normRemover === "ADMIN") {
    if (normTarget === "ADMIN") {
      return {
        allowed: false,
        reason: "Admins cannot remove other admins. Only workspace owners can remove admins.",
      };
    }
    if (normTarget === "MEMBER") {
      return { allowed: true };
    }
  }

  if (normRemover === "OWNER") {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: "You do not have permission to remove this member.",
  };
}

/**
 * Returns user permissions object for client-side UI convenience.
 */
export function getWorkspacePermissions(role: WorkspaceRole): WorkspacePermissions {
  const norm = normalizeRole(role);
  const isOwner = norm === "OWNER";
  const isAdmin = norm === "ADMIN";
  const isMember = norm === "MEMBER";

  return {
    canUpdateWorkspace: isOwner || isAdmin,
    canInviteMembers: isOwner || isAdmin,
    canManageMembers: isOwner || isAdmin,
    canDeleteWorkspace: isOwner,
    isOwner,
    isAdmin,
    isMember,
  };
}

/**
 * Centralized Workspace Authorization Service
 */
export class WorkspaceAuthorizationService {
  constructor(
    private readonly memberRepo: IWorkspaceMemberRepository = workspaceMemberRepository
  ) {}

  /**
   * Retrieves user membership record in a workspace.
   */
  async getMembership(userId: string, workspaceId: string): Promise<WorkspaceMemberRecord | null> {
    return this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
  }

  /**
   * Enforces that the user has access (is a member) of the specified workspace.
   */
  async requireWorkspaceAccess(userId: string, workspaceId: string): Promise<WorkspaceAuthContext> {
    const member = await this.memberRepo.findByWorkspaceAndUser(workspaceId, userId);
    if (!member) {
      throw new ForbiddenError("You do not have access to this workspace.");
    }

    return {
      member,
      role: normalizeRole(member.role),
    };
  }

  /**
   * Enforces that the user is a member with one of the allowed roles.
   */
  async requireWorkspaceRole(
    userId: string,
    workspaceId: string,
    allowedRoles: WorkspaceRole[]
  ): Promise<WorkspaceAuthContext> {
    const context = await this.requireWorkspaceAccess(userId, workspaceId);
    const normalizedAllowed = allowedRoles.map(normalizeRole);

    if (!normalizedAllowed.includes(context.role)) {
      throw new ForbiddenError(
        "You do not have sufficient permissions to perform this action in this workspace."
      );
    }

    return context;
  }
}

export const workspaceAuth = new WorkspaceAuthorizationService();
