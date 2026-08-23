import { describe, expect, it, beforeEach } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { WorkspaceMemberService } from "./workspace-member.service";
import { WorkspaceAuthorizationService } from "./workspace-authorization";
import { EmailService } from "@/server/email/email.service";
import { MockEmailTransport } from "@/server/email/transports";
import type {
  IUserRepository,
  IWorkspaceInvitationRepository,
  IWorkspaceMemberRepository,
  IWorkspaceRepository,
  UserRecord,
  WorkspaceInvitationRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/server/db/repository";

describe("WorkspaceMemberService", () => {
  let mockWorkspaces: WorkspaceRecord[] = [];
  let mockMembers: WorkspaceMemberRecord[] = [];
  let mockUsers: UserRecord[] = [];
  let mockInvitations: WorkspaceInvitationRecord[] = [];
  const mockEmailTransport = new MockEmailTransport();
  const emailService = new EmailService(mockEmailTransport);

  const mockUserRepo: IUserRepository = {
    findById: async (id) => mockUsers.find((u) => u.id === id) ?? null,
    findByEmail: async (email) =>
      mockUsers.find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null,
    create: async (data) => {
      const user: UserRecord = {
        id: `u_${Date.now()}_${Math.random()}`,
        name: data.name,
        email: data.email,
        emailVerified: null,
        passwordHash: data.passwordHash,
        avatarUrl: data.avatarUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockUsers.push(user);
      return user;
    },
    update: async (id, data) => {
      const idx = mockUsers.findIndex((u) => u.id === id);
      if (idx === -1) throw new Error("Not found");
      mockUsers[idx] = { ...mockUsers[idx], ...data, updatedAt: new Date() };
      return mockUsers[idx];
    },
    delete: async (id) => {
      mockUsers = mockUsers.filter((u) => u.id !== id);
      return true;
    },
  };

  const mockWorkspaceRepo: IWorkspaceRepository = {
    findById: async (id) => mockWorkspaces.find((w) => w.id === id) ?? null,
    findBySlug: async (slug) => mockWorkspaces.find((w) => w.slug === slug) ?? null,
    findByUrlIdentifier: async (urlIdentifier) =>
      mockWorkspaces.find((w) => w.urlIdentifier === urlIdentifier) ?? null,
    findByIdOrUrlIdentifier: async (identifier) =>
      mockWorkspaces.find((w) => w.id === identifier || w.urlIdentifier === identifier) ?? null,
    findByUserId: async (userId) => {
      const userMemberships = mockMembers.filter((m) => m.userId === userId);
      return userMemberships
        .map((m) => {
          const ws = mockWorkspaces.find((w) => w.id === m.workspaceId);
          return ws ? { ...ws, role: m.role } : null;
        })
        .filter((w): w is NonNullable<typeof w> => Boolean(w));
    },
    createWithOwner: async () => {
      throw new Error("Not implemented in member mock");
    },
    update: async () => {
      throw new Error("Not implemented in member mock");
    },
    delete: async () => true,
  };

  const mockMemberRepo: IWorkspaceMemberRepository = {
    findByWorkspaceAndUser: async (workspaceId, userId) =>
      mockMembers.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null,
    findMembersByWorkspaceId: async (workspaceId) => {
      const filtered = mockMembers.filter((m) => m.workspaceId === workspaceId);
      return filtered.map((m) => {
        const user = mockUsers.find((u) => u.id === m.userId);
        return {
          ...m,
          user: user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
                createdAt: user.createdAt,
              }
            : {
                id: m.userId,
                name: "Unknown",
                email: "unknown@example.com",
                avatarUrl: null,
                createdAt: new Date(),
              },
        };
      });
    },
    create: async (data) => {
      const mem: WorkspaceMemberRecord = {
        id: `mem_${Date.now()}_${Math.random()}`,
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role ?? "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockMembers.push(mem);
      return mem;
    },
    updateRole: async (workspaceId, userId, role) => {
      const m = mockMembers.find(
        (mem) => mem.workspaceId === workspaceId && mem.userId === userId
      );
      if (!m) throw new Error("Member not found");
      m.role = role;
      return m;
    },
    delete: async (workspaceId, userId) => {
      mockMembers = mockMembers.filter(
        (m) => !(m.workspaceId === workspaceId && m.userId === userId)
      );
      return true;
    },
    countByWorkspaceId: async (workspaceId) =>
      mockMembers.filter((m) => m.workspaceId === workspaceId).length,
  };

  const mockInvitationRepo: IWorkspaceInvitationRepository = {
    create: async (data) => {
      const ws = mockWorkspaces.find((w) => w.id === data.workspaceId);
      const inviter = mockUsers.find((u) => u.id === data.inviterId);

      const inv: WorkspaceInvitationRecord = {
        id: `inv_${Date.now()}_${Math.random()}`,
        workspaceId: data.workspaceId,
        email: data.email,
        role: data.role,
        token: data.token,
        status: "PENDING",
        inviterId: data.inviterId,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
        updatedAt: new Date(),
        inviter: inviter ? { id: inviter.id, name: inviter.name, email: inviter.email } : undefined,
        workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug } : undefined,
      };
      mockInvitations.push(inv);
      return inv;
    },
    findByToken: async (token) => {
      const inv = mockInvitations.find((i) => i.token === token);
      if (!inv) return null;
      const ws = mockWorkspaces.find((w) => w.id === inv.workspaceId);
      const inviter = mockUsers.find((u) => u.id === inv.inviterId);
      return {
        ...inv,
        workspace: ws ? { id: ws.id, name: ws.name, slug: ws.slug } : undefined,
        inviter: inviter ? { id: inviter.id, name: inviter.name, email: inviter.email } : undefined,
      };
    },
    findByWorkspaceAndEmail: async (workspaceId, email) =>
      mockInvitations.find(
        (i) =>
          i.workspaceId === workspaceId &&
          i.email.toLowerCase() === email.toLowerCase() &&
          i.status === "PENDING"
      ) ?? null,
    findPendingByWorkspaceId: async (workspaceId) =>
      mockInvitations.filter(
        (i) => i.workspaceId === workspaceId && i.status === "PENDING"
      ),
    updateStatus: async (id, status) => {
      const inv = mockInvitations.find((i) => i.id === id);
      if (!inv) throw new Error("Invitation not found");
      inv.status = status;
      return inv;
    },
    acceptTransactionally: async (invitationId, workspaceId, userId, role) => {
      const inv = mockInvitations.find((i) => i.id === invitationId);
      if (!inv) throw new Error("Invitation not found");
      inv.status = "ACCEPTED";

      const existingMem = mockMembers.find(
        (m) => m.workspaceId === workspaceId && m.userId === userId
      );
      if (!existingMem) {
        mockMembers.push({
          id: `mem_${Date.now()}`,
          workspaceId,
          userId,
          role,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    },
    delete: async (id) => {
      mockInvitations = mockInvitations.filter((i) => i.id !== id);
      return true;
    },
  };

  const authService = new WorkspaceAuthorizationService(mockMemberRepo);

  const memberService = new WorkspaceMemberService(
    mockMemberRepo,
    mockWorkspaceRepo,
    mockUserRepo,
    mockInvitationRepo,
    authService,
    emailService
  );

  const testWorkspaceId = "ws_test_100";
  const ownerUserId = "user_owner_100";
  const adminUserId = "user_admin_100";
  const memberUserId = "user_member_100";

  beforeEach(() => {
    mockEmailTransport.clear();

    mockWorkspaces = [
      {
        id: testWorkspaceId,
        name: "Test Workspace",
        slug: "test-workspace",
        urlIdentifier: "test-workspace-owner-user-08232026",
        description: "Test Desc",
        ownerId: ownerUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockUsers = [
      {
        id: ownerUserId,
        name: "Owner User",
        email: "owner@example.com",
        emailVerified: null,
        passwordHash: "hash",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: adminUserId,
        name: "Admin User",
        email: "admin@example.com",
        emailVerified: null,
        passwordHash: "hash",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: memberUserId,
        name: "Member User",
        email: "member@example.com",
        emailVerified: null,
        passwordHash: "hash",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockMembers = [
      {
        id: "mem_owner",
        workspaceId: testWorkspaceId,
        userId: ownerUserId,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "mem_admin",
        workspaceId: testWorkspaceId,
        userId: adminUserId,
        role: "ADMIN",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "mem_member",
        workspaceId: testWorkspaceId,
        userId: memberUserId,
        role: "MEMBER",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockInvitations = [];
  });

  describe("listMembers", () => {
    it("should list all members for an authorized workspace user", async () => {
      const members = await memberService.listMembers(testWorkspaceId, memberUserId);
      expect(members).toHaveLength(3);
      expect(members.map((m) => m.userId)).toContain(ownerUserId);
      expect(members.map((m) => m.userId)).toContain(adminUserId);
      expect(members.map((m) => m.userId)).toContain(memberUserId);
    });

    it("should list all members when called with workspace urlIdentifier", async () => {
      const members = await memberService.listMembers(
        "test-workspace-owner-user-08232026",
        memberUserId
      );
      expect(members).toHaveLength(3);
      expect(members.map((m) => m.userId)).toContain(ownerUserId);
    });

    it("should reject non-member user with ForbiddenError", async () => {
      await expect(
        memberService.listMembers(testWorkspaceId, "non_member_user")
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("inviteMember & Email Delivery", () => {
    it("should create invitation and deliver invitation email when invited by OWNER", async () => {
      const result = await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "colleague@example.com",
        role: "MEMBER",
      });

      expect(result.type).toBe("invitation_created");
      expect(result.invitation?.email).toBe("colleague@example.com");
      expect(result.invitation?.role).toBe("MEMBER");
      expect(result.emailDelivered).toBe(true);

      // Verify email was sent via MockEmailTransport with inviter Reply-To
      expect(mockEmailTransport.getSentMessages()).toHaveLength(1);
      const sent = mockEmailTransport.getLastMessage();
      expect(sent?.to).toBe("colleague@example.com");
      expect(sent?.replyTo).toBe('"Owner User" <owner@example.com>');
      expect(sent?.from).toContain("NulisBareng");
      expect(sent?.subject).toBe("Owner User invited you to join Test Workspace");
      expect(sent?.html).toContain("Owner User");
      expect(sent?.html).toContain("owner@example.com");
      expect(sent?.html).toContain("MEMBER");
    });

    it("should allow ADMIN to invite a user and trigger email delivery with admin Reply-To", async () => {
      const result = await memberService.inviteMember(testWorkspaceId, adminUserId, {
        email: "external_admin@example.com",
        role: "ADMIN",
      });

      expect(result.type).toBe("invitation_created");
      expect(result.invitation?.email).toBe("external_admin@example.com");
      expect(result.invitation?.role).toBe("ADMIN");
      expect(result.emailDelivered).toBe(true);

      const sent = mockEmailTransport.getLastMessage();
      expect(sent?.replyTo).toBe('"Admin User" <admin@example.com>');
      expect(sent?.subject).toBe("Admin User invited you to join Test Workspace");
    });

    it("should handle email transport failure gracefully without losing the invitation record", async () => {
      mockEmailTransport.setShouldFail(true, "SMTP Server Offline");

      const result = await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "offline@example.com",
        role: "MEMBER",
      });

      expect(result.type).toBe("invitation_created");
      expect(result.invitation?.email).toBe("offline@example.com");
      expect(result.emailDelivered).toBe(false);

      // Verify invitation still exists in DB
      const inDb = await mockInvitationRepo.findByWorkspaceAndEmail(
        testWorkspaceId,
        "offline@example.com"
      );
      expect(inDb).not.toBeNull();
    });

    it("should reject invitation from MEMBER with ForbiddenError", async () => {
      await expect(
        memberService.inviteMember(testWorkspaceId, memberUserId, {
          email: "target@example.com",
        })
      ).rejects.toThrow(ForbiddenError);

      expect(mockEmailTransport.getSentMessages()).toHaveLength(0);
    });

    it("should reject invitation if user is already a workspace member with ConflictError", async () => {
      await expect(
        memberService.inviteMember(testWorkspaceId, ownerUserId, {
          email: "admin@example.com",
        })
      ).rejects.toThrow(ConflictError);

      expect(mockEmailTransport.getSentMessages()).toHaveLength(0);
    });

    it("should reject duplicate pending invitation with ConflictError", async () => {
      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "future@example.com",
      });

      await expect(
        memberService.inviteMember(testWorkspaceId, ownerUserId, {
          email: "future@example.com",
        })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getInvitationByToken & acceptInvitation", () => {
    it("should retrieve safe public invitation details by token", async () => {
      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "invitee@example.com",
        role: "MEMBER",
      });

      const token = mockInvitations[0].token;
      const details = await memberService.getInvitationByToken(token);

      expect(details.workspaceName).toBe("Test Workspace");
      expect(details.inviterName).toBe("Owner User");
      expect(details.email).toBe("invitee@example.com");
      expect(details.role).toBe("MEMBER");
      expect(details.status).toBe("PENDING");
      expect(details.isExpired).toBe(false);
    });

    it("should throw NotFoundError when token does not exist", async () => {
      await expect(
        memberService.getInvitationByToken("non_existent_token")
      ).rejects.toThrow(NotFoundError);
    });

    it("should accept invitation and add user as a member", async () => {
      const newJoiningUser = await mockUserRepo.create({
        name: "Joining User",
        email: "joining@example.com",
        passwordHash: "hash",
      });

      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "joining@example.com",
        role: "ADMIN",
      });

      const token = mockInvitations[0].token;
      const acceptResult = await memberService.acceptInvitation(token, newJoiningUser.id);

      expect(acceptResult.workspaceId).toBe(testWorkspaceId);

      // Verify membership was created in DB
      const member = await mockMemberRepo.findByWorkspaceAndUser(
        testWorkspaceId,
        newJoiningUser.id
      );
      expect(member).not.toBeNull();
      expect(member?.role).toBe("ADMIN");

      // Verify invitation status changed to ACCEPTED
      const updatedInvite = await mockInvitationRepo.findByToken(token);
      expect(updatedInvite?.status).toBe("ACCEPTED");
    });

    it("should reject acceptance if invitation was already accepted", async () => {
      const newJoiningUser = await mockUserRepo.create({
        name: "Joining User",
        email: "joining@example.com",
        passwordHash: "hash",
      });

      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: "joining@example.com",
      });

      const token = mockInvitations[0].token;
      await memberService.acceptInvitation(token, newJoiningUser.id);

      // Subsequent attempt by another or same user should handle already accepted
      const secondUser = await mockUserRepo.create({
        name: "Second User",
        email: "second@example.com",
        passwordHash: "hash",
      });

      await expect(
        memberService.acceptInvitation(token, secondUser.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject acceptance with ForbiddenError if user email does not match invitation email", async () => {
      const targetUser = await mockUserRepo.create({
        name: "Target User",
        email: "target@example.com",
        passwordHash: "hash",
      });

      const imposterUser = await mockUserRepo.create({
        name: "Imposter User",
        email: "imposter@example.com",
        passwordHash: "hash",
      });

      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: targetUser.email,
        role: "MEMBER",
      });

      const token = mockInvitations[0].token;

      // Imposter tries to accept target user's invitation
      await expect(
        memberService.acceptInvitation(token, imposterUser.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should reject acceptance with ConflictError if invitation has expired", async () => {
      const expiredUser = await mockUserRepo.create({
        name: "Expired User",
        email: "expired@example.com",
        passwordHash: "hash",
      });

      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: expiredUser.email,
        role: "MEMBER",
      });

      const inv = mockInvitations[0];
      // Set expiration to yesterday
      inv.expiresAt = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await expect(
        memberService.acceptInvitation(inv.token, expiredUser.id)
      ).rejects.toThrow(ConflictError);
    });

    it("should reject acceptance with ConflictError if user already belongs to a workspace with the same logical slug", async () => {
      const joiningUser = await mockUserRepo.create({
        name: "Joining User",
        email: "joining@example.com",
        passwordHash: "hash",
      });

      // User already owns a workspace with slug "test-workspace"
      const existingWs: WorkspaceRecord = {
        id: "ws_already_owned",
        name: "My Test Workspace",
        slug: "test-workspace",
        urlIdentifier: "test-workspace-joining-user-08232026",
        description: null,
        ownerId: joiningUser.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockWorkspaces.push(existingWs);
      mockMembers.push({
        id: "mem_already_owned",
        workspaceId: existingWs.id,
        userId: joiningUser.id,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // User is invited to another workspace with the same slug "test-workspace"
      await memberService.inviteMember(testWorkspaceId, ownerUserId, {
        email: joiningUser.email,
        role: "MEMBER",
      });

      const inv = mockInvitations.find((i) => i.email === joiningUser.email);
      expect(inv).toBeDefined();

      await expect(
        memberService.acceptInvitation(inv!.token, joiningUser.id)
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("removeMember", () => {
    it("should allow OWNER to remove an ADMIN", async () => {
      const success = await memberService.removeMember(
        testWorkspaceId,
        ownerUserId,
        adminUserId
      );
      expect(success).toBe(true);

      const mem = await mockMemberRepo.findByWorkspaceAndUser(testWorkspaceId, adminUserId);
      expect(mem).toBeNull();
    });

    it("should allow OWNER to remove a MEMBER", async () => {
      const success = await memberService.removeMember(
        testWorkspaceId,
        ownerUserId,
        memberUserId
      );
      expect(success).toBe(true);
    });

    it("should allow ADMIN to remove a MEMBER", async () => {
      const success = await memberService.removeMember(
        testWorkspaceId,
        adminUserId,
        memberUserId
      );
      expect(success).toBe(true);
    });

    it("should deny ADMIN from removing another ADMIN", async () => {
      const secondAdmin = await mockUserRepo.create({
        name: "Second Admin",
        email: "admin2@example.com",
        passwordHash: "hash",
      });
      await mockMemberRepo.create({
        workspaceId: testWorkspaceId,
        userId: secondAdmin.id,
        role: "ADMIN",
      });

      await expect(
        memberService.removeMember(testWorkspaceId, adminUserId, secondAdmin.id)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should deny removing the workspace OWNER with ForbiddenError", async () => {
      await expect(
        memberService.removeMember(testWorkspaceId, adminUserId, ownerUserId)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should deny self-removal with ForbiddenError", async () => {
      await expect(
        memberService.removeMember(testWorkspaceId, adminUserId, adminUserId)
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw NotFoundError when target user is not a member of the workspace", async () => {
      await expect(
        memberService.removeMember(testWorkspaceId, ownerUserId, "non_existent_user")
      ).rejects.toThrow(NotFoundError);
    });
  });
});
