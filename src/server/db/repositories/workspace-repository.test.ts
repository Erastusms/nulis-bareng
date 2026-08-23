import { afterAll, describe, expect, it } from "vitest";
import { db } from "../client";
import { PrismaWorkspaceRepository } from "./workspace.repository";
import { PrismaWorkspaceMemberRepository } from "./workspace-member.repository";
import { PrismaUserRepository } from "./user.repository";
import { hashPassword } from "@/server/auth/password";

describe("Workspace & Member Database Integration (PostgreSQL + Prisma)", () => {
  const userRepo = new PrismaUserRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const memberRepo = new PrismaWorkspaceMemberRepository(db);

  let ownerUserId: string;
  let secondUserId: string;
  let createdWorkspaceId: string;
  const testEmailOwner = `ws_owner_${Date.now()}@example.com`;
  const testEmailMember = `ws_member_${Date.now()}@example.com`;
  const testSlug = `test-ws-${Date.now()}`;

  afterAll(async () => {
    // Cleanup created test records
    if (createdWorkspaceId) {
      await db.workspaceMember.deleteMany({ where: { workspaceId: createdWorkspaceId } });
      await db.workspace.deleteMany({ where: { id: createdWorkspaceId } });
    }
    if (ownerUserId) {
      await db.user.deleteMany({ where: { id: ownerUserId } });
    }
    if (secondUserId) {
      await db.user.deleteMany({ where: { id: secondUserId } });
    }
  });

  it("should create user accounts for workspace tests", async () => {
    const owner = await userRepo.create({
      name: "WS Owner",
      email: testEmailOwner,
      passwordHash: await hashPassword("Pass123!"),
    });
    ownerUserId = owner.id;

    const second = await userRepo.create({
      name: "WS Second",
      email: testEmailMember,
      passwordHash: await hashPassword("Pass123!"),
    });
    secondUserId = second.id;

    expect(ownerUserId).toBeDefined();
    expect(secondUserId).toBeDefined();
  });

  it("should transactionally create a workspace and owner membership record", async () => {
    const ws = await workspaceRepo.createWithOwner({
      name: "Transactional Test WS",
      slug: testSlug,
      urlIdentifier: `${testSlug}-ws-owner-08232026`,
      description: "Integration test description",
      ownerId: ownerUserId,
    });

    expect(ws.id).toBeDefined();
    expect(ws.slug).toBe(testSlug);
    expect(ws.urlIdentifier).toBe(`${testSlug}-ws-owner-08232026`);
    expect(ws.ownerId).toBe(ownerUserId);
    expect(ws.memberCount).toBe(1);

    createdWorkspaceId = ws.id;

    // Verify in database directly
    const member = await memberRepo.findByWorkspaceAndUser(ws.id, ownerUserId);
    expect(member).not.toBeNull();
    expect(member?.role).toBe("OWNER");
  });

  it("should reject duplicate workspace urlIdentifier at database constraint level", async () => {
    await expect(
      workspaceRepo.createWithOwner({
        name: "Duplicate Slug WS",
        slug: testSlug,
        urlIdentifier: `${testSlug}-ws-owner-08232026`,
        ownerId: secondUserId,
      })
    ).rejects.toThrow();
  });

  it("should allow same logical slug with distinct urlIdentifier at database level", async () => {
    const secondWs = await workspaceRepo.createWithOwner({
      name: "Second User WS",
      slug: testSlug,
      urlIdentifier: `${testSlug}-ws-second-08232026`,
      ownerId: secondUserId,
    });

    expect(secondWs.slug).toBe(testSlug);
    expect(secondWs.urlIdentifier).toBe(`${testSlug}-ws-second-08232026`);

    // Cleanup second workspace
    await db.workspaceMember.deleteMany({ where: { workspaceId: secondWs.id } });
    await db.workspace.deleteMany({ where: { id: secondWs.id } });
  });

  it("should add a second member to the workspace and prevent duplicate member insertion", async () => {
    const member = await memberRepo.create({
      workspaceId: createdWorkspaceId,
      userId: secondUserId,
      role: "MEMBER",
    });

    expect(member.id).toBeDefined();
    expect(member.role).toBe("MEMBER");

    // Attempt duplicate member insertion
    await expect(
      memberRepo.create({
        workspaceId: createdWorkspaceId,
        userId: secondUserId,
        role: "ADMIN",
      })
    ).rejects.toThrow();
  });

  it("should list workspace members with user profile information", async () => {
    const members = await memberRepo.findMembersByWorkspaceId(createdWorkspaceId);
    expect(members).toHaveLength(2);

    const ownerEntry = members.find((m) => m.userId === ownerUserId);
    expect(ownerEntry).toBeDefined();
    expect(ownerEntry?.user.email).toBe(testEmailOwner);
    expect(ownerEntry?.role).toBe("OWNER");

    const secondEntry = members.find((m) => m.userId === secondUserId);
    expect(secondEntry).toBeDefined();
    expect(secondEntry?.user.email).toBe(testEmailMember);
    expect(secondEntry?.role).toBe("MEMBER");
  });

  it("should delete member from workspace", async () => {
    const deleted = await memberRepo.delete(createdWorkspaceId, secondUserId);
    expect(deleted).toBe(true);

    const found = await memberRepo.findByWorkspaceAndUser(createdWorkspaceId, secondUserId);
    expect(found).toBeNull();
  });
});
