import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../client";
import { PrismaActivityRepository } from "./activity.repository";
import { PrismaUserRepository } from "./user.repository";
import { PrismaWorkspaceRepository } from "./workspace.repository";
import { hashPassword } from "@/server/auth/password";

describe("PrismaActivityRepository", () => {
  const userRepo = new PrismaUserRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const activityRepo = new PrismaActivityRepository(db);

  let userId: string;
  let workspaceId: string;
  let otherWorkspaceId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("ActivityPass123!");
    const user = await userRepo.create({
      name: "Activity Tester",
      email: `activity_test_${Date.now()}@example.com`,
      passwordHash,
    });
    userId = user.id;

    const ws = await workspaceRepo.createWithOwner({
      name: "Activity Test WS",
      slug: `activity-ws-${Date.now()}`,
      urlIdentifier: `activity-ws-id-${Date.now()}`,
      ownerId: userId,
    });
    workspaceId = ws.id;

    const otherWs = await workspaceRepo.createWithOwner({
      name: "Other WS",
      slug: `other-ws-${Date.now()}`,
      urlIdentifier: `other-ws-id-${Date.now()}`,
      ownerId: userId,
    });
    otherWorkspaceId = otherWs.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
    }
    if (otherWorkspaceId) {
      await db.workspace.delete({ where: { id: otherWorkspaceId } }).catch(() => {});
    }
    if (userId) {
      await db.user.delete({ where: { id: userId } }).catch(() => {});
    }
  });

  it("should create an activity record and include actor details", async () => {
    const activity = await activityRepo.create({
      workspaceId,
      actorId: userId,
      type: "CARD_CREATED",
      entityType: "CARD",
      entityId: "card_123",
      metadata: { cardTitle: "Fix payment issue", columnTitle: "To Do" },
    });

    expect(activity.id).toBeDefined();
    expect(activity.workspaceId).toBe(workspaceId);
    expect(activity.actorId).toBe(userId);
    expect(activity.type).toBe("CARD_CREATED");
    expect(activity.entityType).toBe("CARD");
    expect(activity.entityId).toBe("card_123");
    expect(activity.metadata).toEqual({ cardTitle: "Fix payment issue", columnTitle: "To Do" });
    expect(activity.actor).toBeDefined();
    expect(activity.actor?.name).toBe("Activity Tester");
    expect(activity.createdAt).toBeInstanceOf(Date);
  });

  it("should find an activity by id", async () => {
    const created = await activityRepo.create({
      workspaceId,
      actorId: userId,
      type: "BOARD_CREATED",
      entityType: "BOARD",
      entityId: "board_123",
      metadata: { boardTitle: "Sprint 10" },
    });

    const found = await activityRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.type).toBe("BOARD_CREATED");
    expect(found?.metadata).toEqual({ boardTitle: "Sprint 10" });
  });

  it("should support cursor pagination and order activities descending", async () => {
    const pagWs = await workspaceRepo.createWithOwner({
      name: "Pagination WS",
      slug: `pag-ws-${Date.now()}`,
      urlIdentifier: `pag-ws-id-${Date.now()}`,
      ownerId: userId,
    });

    try {
      // Create 5 activities in chronological order
      const a1 = await activityRepo.create({
        workspaceId: pagWs.id,
        actorId: userId,
        type: "WORKSPACE_CREATED",
        createdAt: new Date(Date.now() - 50000),
      });
      const a2 = await activityRepo.create({
        workspaceId: pagWs.id,
        actorId: userId,
        type: "COLUMN_CREATED",
        createdAt: new Date(Date.now() - 40000),
      });
      const a3 = await activityRepo.create({
        workspaceId: pagWs.id,
        actorId: userId,
        type: "CARD_CREATED",
        createdAt: new Date(Date.now() - 30000),
      });
      const a4 = await activityRepo.create({
        workspaceId: pagWs.id,
        actorId: userId,
        type: "CARD_MOVED",
        createdAt: new Date(Date.now() - 20000),
      });
      const a5 = await activityRepo.create({
        workspaceId: pagWs.id,
        actorId: userId,
        type: "DOCUMENT_CREATED",
        createdAt: new Date(Date.now() - 10000),
      });

      // Create activity in another workspace
      await activityRepo.create({
        workspaceId: otherWorkspaceId,
        actorId: userId,
        type: "CARD_CREATED",
      });

      // First page: limit 2
      const page1 = await activityRepo.findByWorkspaceId(pagWs.id, { limit: 2 });
      expect(page1.items).toHaveLength(2);
      expect(page1.items[0].id).toBe(a5.id);
      expect(page1.items[1].id).toBe(a4.id);
      expect(page1.nextCursor).toBe(a4.id);

      // Second page using nextCursor: limit 2
      const page2 = await activityRepo.findByWorkspaceId(pagWs.id, {
        limit: 2,
        cursor: page1.nextCursor!,
      });
      expect(page2.items).toHaveLength(2);
      expect(page2.items[0].id).toBe(a3.id);
      expect(page2.items[1].id).toBe(a2.id);
      expect(page2.nextCursor).toBe(a2.id);

      // Third page
      const page3 = await activityRepo.findByWorkspaceId(pagWs.id, {
        limit: 2,
        cursor: page2.nextCursor!,
      });
      expect(page3.items).toHaveLength(1);
      expect(page3.items[0].id).toBe(a1.id);
      expect(page3.nextCursor).toBeNull();

    } finally {
      await db.workspace.delete({ where: { id: pagWs.id } }).catch(() => {});
    }
  });


  it("should count activities in a workspace accurately", async () => {
    const initialCount = await activityRepo.countByWorkspaceId(otherWorkspaceId);
    expect(initialCount).toBe(1);

    await activityRepo.create({
      workspaceId: otherWorkspaceId,
      actorId: userId,
      type: "MEMBER_JOINED",
    });

    const newCount = await activityRepo.countByWorkspaceId(otherWorkspaceId);
    expect(newCount).toBe(2);
  });
});
