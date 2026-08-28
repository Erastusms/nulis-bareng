import crypto from "crypto";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "@/lib/api/errors";
import { createEventId, createVersion } from "@/lib/realtime/events";
import { emailService, EmailService } from "@/server/email/email.service";
import { userRepository } from "@/server/db/repositories/user.repository";
import { workspaceInvitationRepository } from "@/server/db/repositories/workspace-invitation.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import type {
  IUserRepository,
  IWorkspaceInvitationRepository,
  IWorkspaceMemberRepository,
  IWorkspaceRepository,
  WorkspaceMemberWithUserRecord,
} from "@/server/db/repository";
import { eventPublisher, IEventPublisher } from "@/server/websocket/event-publisher";
import { activityService as defaultActivityService, ActivityService } from "../activities/activity.service";
import {
  evaluateMemberRemoval,
  normalizeRole,
  workspaceAuth,
  WorkspaceAuthorizationService,
} from "./workspace-authorization";
import type { WorkspaceMember, WorkspaceRole } from "@/types/domain";

export interface InviteMemberDTO {
  email: string;
  role?: WorkspaceRole;
}

export interface InviteMemberResult {
  type: "invitation_created";
  member?: WorkspaceMember;
  invitation?: {
    id: string;
    email: string;
    role: WorkspaceRole;
    expiresAt: string;
  };
  emailDelivered?: boolean;
}

export interface InvitationDetails {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  inviterName: string;
  email: string;
  role: WorkspaceRole;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  isExpired: boolean;
  expiresAt: string;
}

function toDomainWorkspaceMember(record: WorkspaceMemberWithUserRecord): WorkspaceMember {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    userId: record.userId,
    role: record.role,
    joinedAt: record.createdAt.toISOString(),
    user: {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      avatarUrl: record.user.avatarUrl,
      createdAt: record.user.createdAt.toISOString(),
      updatedAt: record.user.createdAt.toISOString(),
    },
  };
}

export class WorkspaceMemberService {
  constructor(
    private readonly memberRepo: IWorkspaceMemberRepository = workspaceMemberRepository,
    private readonly workspaceRepo: IWorkspaceRepository = workspaceRepository,
    private readonly userRepo: IUserRepository = userRepository,
    private readonly invitationRepo: IWorkspaceInvitationRepository = workspaceInvitationRepository,
    private readonly authService: WorkspaceAuthorizationService = workspaceAuth,
    private readonly mailer: EmailService = emailService,
    private readonly publisher: IEventPublisher = eventPublisher,
    private readonly activityService: ActivityService = defaultActivityService
  ) {}


  /**
   * Retrieves all members of a workspace. Supports workspace ID or URL identifier.
   */
  async listMembers(workspaceIdOrIdentifier: string, userId: string): Promise<WorkspaceMember[]> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceIdOrIdentifier);
    }

    await this.authService.requireWorkspaceAccess(userId, workspace.id);

    const members = await this.memberRepo.findMembersByWorkspaceId(workspace.id);
    return members.map(toDomainWorkspaceMember);
  }

  /**
   * Invites a member to a workspace by email, creates an invitation record, and delivers an email.
   * Requires OWNER or ADMIN role. Supports workspace ID or URL identifier.
   */
  async inviteMember(
    workspaceIdOrIdentifier: string,
    inviterId: string,
    dto: InviteMemberDTO
  ): Promise<InviteMemberResult> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceIdOrIdentifier);
    }

    await this.authService.requireWorkspaceRole(inviterId, workspace.id, ["OWNER", "ADMIN"]);

    const inviter = await this.userRepo.findById(inviterId);
    const inviterName = inviter?.name || "A workspace team member";
    const inviterEmail = inviter?.email || "no-reply@example.com";

    const normalizedEmail = dto.email.toLowerCase().trim();
    const targetRole = dto.role ? normalizeRole(dto.role) : "MEMBER";

    // 1. Check if user with this email is already a workspace member
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      const existingMembership = await this.memberRepo.findByWorkspaceAndUser(
        workspace.id,
        existingUser.id
      );

      if (existingMembership) {
        throw new ConflictError("User is already a member of this workspace.");
      }
    }

    // 2. Check for active pending invitation
    const existingInvite = await this.invitationRepo.findByWorkspaceAndEmail(
      workspace.id,
      normalizedEmail
    );

    if (existingInvite) {
      throw new ConflictError("An invitation has already been sent to this email address.");
    }

    // 3. Create persistent invitation with secure token (expires in 7 days)
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const invitation = await this.invitationRepo.create({
      workspaceId: workspace.id,
      email: normalizedEmail,
      role: targetRole,
      token,
      inviterId,
      expiresAt,
    });

    // 4. Deliver invitation email via EmailService (From: system, Reply-To: inviter)
    const emailResult = await this.mailer.sendInvitationEmail({
      recipientEmail: normalizedEmail,
      inviterName,
      inviterEmail,
      workspaceName: workspace.name,
      role: targetRole,
      invitationToken: invitation.token,
      expiresAt: invitation.expiresAt,
    });

    return {
      type: "invitation_created",
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
      emailDelivered: emailResult.success,
    };
  }

  /**
   * Retrieves public safe invitation details for display on the acceptance page.
   */
  async getInvitationByToken(token: string): Promise<InvitationDetails> {
    if (!token || typeof token !== "string") {
      throw new ValidationError("Invalid invitation token provided.");
    }

    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation", token);
    }

    const isExpired =
      new Date() > new Date(invitation.expiresAt) || invitation.status === "EXPIRED";

    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace?.name || "Workspace",
      workspaceSlug: invitation.workspace?.slug || "",
      inviterName: invitation.inviter?.name || "Team Member",
      email: invitation.email,
      role: invitation.role,
      status: isExpired && invitation.status === "PENDING" ? "EXPIRED" : invitation.status,
      isExpired,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }

  /**
   * Accepts an invitation, validates recipient identity, adds the user as a member,
   * and updates invitation status transactionally.
   */
  async acceptInvitation(token: string, userId: string): Promise<{ workspaceId: string }> {
    if (!token) {
      throw new ValidationError("Invalid invitation token.");
    }

    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User", userId);
    }

    const invitation = await this.invitationRepo.findByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation", token);
    }

    // Verify recipient identity matches the authenticated user
    if (user.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()) {
      throw new ForbiddenError(
        `This invitation was sent to ${invitation.email}. Please sign in with that account to accept.`
      );
    }

    const workspace = await this.workspaceRepo.findById(invitation.workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace", invitation.workspaceId);
    }

    // Check if the user already belongs to another workspace with the same logical slug
    const userWorkspaces = await this.workspaceRepo.findByUserId(userId);
    const hasDuplicateSlug = userWorkspaces.some(
      (w) =>
        w.slug.toLowerCase() === workspace.slug.toLowerCase() &&
        w.id !== workspace.id
    );

    if (hasDuplicateSlug) {
      throw new ConflictError(
        `You already belong to a workspace with the slug '${workspace.slug}'.`
      );
    }

    // Idempotent check for already accepted invitations
    if (invitation.status === "ACCEPTED") {
      const isMember = await this.memberRepo.findByWorkspaceAndUser(
        invitation.workspaceId,
        userId
      );
      if (isMember) {
        return { workspaceId: invitation.workspaceId };
      }
      throw new ConflictError("This invitation has already been accepted.");
    }

    if (invitation.status === "REJECTED") {
      throw new ConflictError("This invitation is no longer valid.");
    }

    if (new Date() > new Date(invitation.expiresAt) || invitation.status === "EXPIRED") {
      await this.invitationRepo.updateStatus(invitation.id, "EXPIRED").catch(() => {});
      throw new ConflictError("This invitation has expired.");
    }

    // Transactionally create membership and mark invitation as accepted
    await this.invitationRepo.acceptTransactionally(
      invitation.id,
      invitation.workspaceId,
      userId,
      invitation.role
    );

    // Broadcast member.added event to workspace room
    const members = await this.memberRepo.findMembersByWorkspaceId(invitation.workspaceId);
    const addedMember = members.find((m) => m.userId === userId);
    if (addedMember) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "member.added",
        workspaceId: invitation.workspaceId,
        memberId: addedMember.id,
        member: toDomainWorkspaceMember(addedMember),
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });
    }

    await this.activityService.recordActivity({
      workspaceId: invitation.workspaceId,
      actorId: userId,
      type: "MEMBER_JOINED",
      entityType: "MEMBER",
      entityId: addedMember ? addedMember.id : userId,
      metadata: {
        memberName: addedMember?.user?.name || user.name,
        memberEmail: user.email,
        role: invitation.role,
      },
    });

    return {
      workspaceId: invitation.workspaceId,
    };
  }

  /**
   * Removes a member from a workspace. Enforces role hierarchy and owner protection.
   * Supports workspace ID or URL identifier.
   */
  async removeMember(
    workspaceIdOrIdentifier: string,
    removerId: string,
    targetUserId: string
  ): Promise<boolean> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceIdOrIdentifier);
    }

    const authContext = await this.authService.requireWorkspaceAccess(removerId, workspace.id);

    const targetMember = await this.memberRepo.findByWorkspaceAndUser(
      workspace.id,
      targetUserId
    );

    if (!targetMember) {
      throw new NotFoundError("WorkspaceMember", targetUserId);
    }

    const isTargetOwner =
      targetMember.role === "OWNER" || workspace.ownerId === targetUserId;
    const isSelf = removerId === targetUserId;

    const evaluation = evaluateMemberRemoval({
      removerRole: authContext.role,
      targetRole: targetMember.role,
      isTargetOwner,
      isSelf,
    });

    if (!evaluation.allowed) {
      throw new ForbiddenError(
        evaluation.reason || "You do not have permission to remove this member."
      );
    }

    const deleted = await this.memberRepo.delete(workspace.id, targetUserId);

    if (deleted) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "member.removed",
        workspaceId: workspace.id,
        memberId: targetMember.id,
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });

      await this.activityService.recordActivity({
        workspaceId: workspace.id,
        actorId: removerId,
        type: "MEMBER_LEFT",
        entityType: "MEMBER",
        entityId: targetMember.id,
        metadata: {
          targetUserId,
          isSelf,
        },
      });
    }

    return deleted;
  }
}


export const workspaceMemberService = new WorkspaceMemberService();
