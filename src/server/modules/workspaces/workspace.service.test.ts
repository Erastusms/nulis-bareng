import { describe, expect, it, beforeEach } from "vitest";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { WorkspaceService } from "./workspace.service";
import { WorkspaceAuthorizationService } from "./workspace-authorization";
import type {
  IUserRepository,
  IWorkspaceMemberRepository,
  IWorkspaceRepository,
  UserRecord,
  WorkspaceMemberRecord,
  WorkspaceRecord,
} from "@/server/db/repository";

describe("WorkspaceService", () => {
  let mockWorkspaces: WorkspaceRecord[] = [];
  let mockMembers: WorkspaceMemberRecord[] = [];
  let mockUsers: UserRecord[] = [];

  const mockUserRepo: IUserRepository = {
    findById: async (id) => mockUsers.find((u) => u.id === id) ?? null,
    findByEmail: async (email) => mockUsers.find((u) => u.email === email) ?? null,
    create: async (data) => {
      const user: UserRecord = {
        id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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
    createWithOwner: async (data) => {
      const created: WorkspaceRecord = {
        id: `ws_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: data.name,
        slug: data.slug,
        urlIdentifier: data.urlIdentifier,
        description: data.description ?? null,
        ownerId: data.ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
        memberCount: 1,
      };
      mockWorkspaces.push(created);
      mockMembers.push({
        id: `mem_${Date.now()}`,
        workspaceId: created.id,
        userId: data.ownerId,
        role: "OWNER",
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return created;
    },
    update: async (id, data) => {
      const idx = mockWorkspaces.findIndex((w) => w.id === id);
      if (idx === -1) throw new Error("Not found");
      mockWorkspaces[idx] = {
        ...mockWorkspaces[idx],
        ...(data.name !== undefined && { name: data.name }),
        ...(data.slug !== undefined && { slug: data.slug }),
        ...(data.urlIdentifier !== undefined && { urlIdentifier: data.urlIdentifier }),
        ...(data.description !== undefined && { description: data.description }),
        updatedAt: new Date(),
      };
      return mockWorkspaces[idx];
    },
    delete: async (id) => {
      mockWorkspaces = mockWorkspaces.filter((w) => w.id !== id);
      mockMembers = mockMembers.filter((m) => m.workspaceId !== id);
      return true;
    },
  };

  const mockMemberRepo: IWorkspaceMemberRepository = {
    findByWorkspaceAndUser: async (workspaceId, userId) =>
      mockMembers.find((m) => m.workspaceId === workspaceId && m.userId === userId) ?? null,
    findMembersByWorkspaceId: async (_workspaceId) => [],
    create: async (data) => {
      const mem: WorkspaceMemberRecord = {
        id: `mem_${Date.now()}`,
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

  const authService = new WorkspaceAuthorizationService(mockMemberRepo);
  const workspaceService = new WorkspaceService(mockWorkspaceRepo, authService, mockUserRepo);

  beforeEach(() => {
    mockWorkspaces = [];
    mockMembers = [];
    mockUsers = [
      {
        id: "user_owner_1",
        name: "member123",
        email: "member123@example.com",
        emailVerified: null,
        passwordHash: "hash",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "user_owner_2",
        name: "developer456",
        email: "developer456@example.com",
        emailVerified: null,
        passwordHash: "hash",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  });

  describe("createWorkspace", () => {
    it("should successfully create workspace and assign creator as OWNER", async () => {
      const workspace = await workspaceService.createWorkspace({
        name: "Acme Product",
        slug: "acme-product",
        description: "Main workspace",
        ownerId: "user_owner_1",
      });

      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe("Acme Product");
      expect(workspace.slug).toBe("acme-product");
      expect(workspace.urlIdentifier).toContain("acme-product-member123");
      expect(workspace.ownerId).toBe("user_owner_1");
      expect(workspace.currentUserRole).toBe("OWNER");

      // Verify owner membership was created
      const ownerMem = await mockMemberRepo.findByWorkspaceAndUser(
        workspace.id,
        "user_owner_1"
      );
      expect(ownerMem).not.toBeNull();
      expect(ownerMem?.role).toBe("OWNER");
    });

    it("should allow different users to create workspaces with the same logical slug (Test 1)", async () => {
      const wsA = await workspaceService.createWorkspace({
        name: "Backend",
        slug: "backend",
        ownerId: "user_owner_1",
      });

      const wsB = await workspaceService.createWorkspace({
        name: "Backend",
        slug: "backend",
        ownerId: "user_owner_2",
      });

      expect(wsA.slug).toBe("backend");
      expect(wsB.slug).toBe("backend");
      expect(wsA.urlIdentifier).toContain("backend-member123");
      expect(wsB.urlIdentifier).toContain("backend-developer456");
      expect(wsA.urlIdentifier).not.toBe(wsB.urlIdentifier);
    });

    it("should reject duplicate logical slug for the same user as owner (Test 2)", async () => {
      await workspaceService.createWorkspace({
        name: "Backend",
        slug: "backend",
        ownerId: "user_owner_1",
      });

      await expect(
        workspaceService.createWorkspace({
          name: "Backend Second",
          slug: "backend",
          ownerId: "user_owner_1",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("should reject duplicate logical slug for the same user via membership (Test 3)", async () => {
      // User 2 creates a workspace "Frontend"
      const ws2 = await workspaceService.createWorkspace({
        name: "Frontend",
        slug: "frontend",
        ownerId: "user_owner_2",
      });

      // Add User 1 as a member of User 2's workspace
      await mockMemberRepo.create({
        workspaceId: ws2.id,
        userId: "user_owner_1",
        role: "MEMBER",
      });

      // User 1 tries to create their own "Frontend" workspace
      await expect(
        workspaceService.createWorkspace({
          name: "Frontend My Own",
          slug: "frontend",
          ownerId: "user_owner_1",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("should allow the same user to create a workspace with a different logical slug (Test 4)", async () => {
      await workspaceService.createWorkspace({
        name: "Backend",
        slug: "backend",
        ownerId: "user_owner_1",
      });

      const ws2 = await workspaceService.createWorkspace({
        name: "Frontend",
        slug: "frontend",
        ownerId: "user_owner_1",
      });

      expect(ws2.slug).toBe("frontend");
    });

    it("should allow different users to create different slugs (Test 5)", async () => {
      const wsA = await workspaceService.createWorkspace({
        name: "Backend",
        slug: "backend",
        ownerId: "user_owner_1",
      });

      const wsB = await workspaceService.createWorkspace({
        name: "Design",
        slug: "design",
        ownerId: "user_owner_2",
      });

      expect(wsA.slug).toBe("backend");
      expect(wsB.slug).toBe("design");
    });
  });

  describe("getWorkspaceById", () => {
    it("should return workspace when user is an authorized member by ID", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Engineering",
        slug: "engineering",
        ownerId: "user_owner_1",
      });

      const fetched = await workspaceService.getWorkspaceById(created.id, "user_owner_1");
      expect(fetched.id).toBe(created.id);
      expect(fetched.currentUserRole).toBe("OWNER");
    });

    it("should return workspace when looked up by unique urlIdentifier", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Engineering",
        slug: "engineering",
        ownerId: "user_owner_1",
      });

      const fetched = await workspaceService.getWorkspaceById(
        created.urlIdentifier,
        "user_owner_1"
      );
      expect(fetched.id).toBe(created.id);
      expect(fetched.name).toBe("Engineering");
    });

    it("should throw ForbiddenError when user does not have workspace access", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Engineering",
        slug: "engineering",
        ownerId: "user_owner_1",
      });

      await expect(
        workspaceService.getWorkspaceById(created.id, "unauthorized_user")
      ).rejects.toThrow(ForbiddenError);
    });

    it("should throw NotFoundError when workspace identifier does not exist", async () => {
      await expect(
        workspaceService.getWorkspaceById("non_existent_ws", "user_owner_1")
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getUserWorkspaces", () => {
    it("should return all workspaces user belongs to", async () => {
      const ws1 = await workspaceService.createWorkspace({
        name: "Workspace 1",
        slug: "ws-1",
        ownerId: "user_owner_1",
      });

      const ws2 = await workspaceService.createWorkspace({
        name: "Workspace 2",
        slug: "ws-2",
        ownerId: "user_owner_2",
      });

      // Add user_owner_1 as member of ws2
      await mockMemberRepo.create({
        workspaceId: ws2.id,
        userId: "user_owner_1",
        role: "ADMIN",
      });

      const list = await workspaceService.getUserWorkspaces("user_owner_1");
      expect(list).toHaveLength(2);
      expect(list.map((w) => w.id)).toContain(ws1.id);
      expect(list.map((w) => w.id)).toContain(ws2.id);
    });
  });

  describe("updateWorkspace", () => {
    it("should allow OWNER to update workspace name and description", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Old Name",
        slug: "old-slug",
        ownerId: "user_owner_1",
      });

      const updated = await workspaceService.updateWorkspace(created.id, "user_owner_1", {
        name: "New Name",
        description: "Updated description",
      });

      expect(updated.name).toBe("New Name");
      expect(updated.description).toBe("Updated description");
    });

    it("should allow ADMIN to update workspace", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Team WS",
        slug: "team-ws",
        ownerId: "user_owner_1",
      });

      await mockMemberRepo.create({
        workspaceId: created.id,
        userId: "user_admin_1",
        role: "ADMIN",
      });

      const updated = await workspaceService.updateWorkspace(created.id, "user_admin_1", {
        name: "Team WS Renamed",
      });

      expect(updated.name).toBe("Team WS Renamed");
    });

    it("should reject MEMBER from updating workspace", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Team WS",
        slug: "team-ws",
        ownerId: "user_owner_1",
      });

      await mockMemberRepo.create({
        workspaceId: created.id,
        userId: "user_member_1",
        role: "MEMBER",
      });

      await expect(
        workspaceService.updateWorkspace(created.id, "user_member_1", {
          name: "Hacked Name",
        })
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("deleteWorkspace", () => {
    it("should allow OWNER to delete workspace", async () => {
      const created = await workspaceService.createWorkspace({
        name: "To Delete",
        slug: "to-delete",
        ownerId: "user_owner_1",
      });

      const result = await workspaceService.deleteWorkspace(created.id, "user_owner_1");
      expect(result).toBe(true);

      const found = await mockWorkspaceRepo.findById(created.id);
      expect(found).toBeNull();
    });

    it("should reject non-owner (ADMIN) from deleting workspace", async () => {
      const created = await workspaceService.createWorkspace({
        name: "Protected WS",
        slug: "protected-ws",
        ownerId: "user_owner_1",
      });

      await mockMemberRepo.create({
        workspaceId: created.id,
        userId: "user_admin_1",
        role: "ADMIN",
      });

      await expect(
        workspaceService.deleteWorkspace(created.id, "user_admin_1")
      ).rejects.toThrow(ForbiddenError);
    });
  });
});
