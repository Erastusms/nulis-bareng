import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "http";
import WebSocket from "ws";
import { db } from "@/server/db/client";
import { createWebSocketServer } from "./ws-server";
import { ConnectionManager } from "./connection-manager";
import { RoomManager } from "./room-manager";
import { PresenceService } from "../redis/presence.service";
import { activityService } from "../modules/activities/activity.service";
import { cardService } from "../modules/boards/card.service";
import { boardColumnRepository } from "../db/repositories/board-column.repository";
import { boardRepository } from "../db/repositories/board.repository";
import { workspaceRepository } from "../db/repositories/workspace.repository";
import { userRepository } from "../db/repositories/user.repository";

describe("Phase 10: Presence & Activity Real-time Integration", () => {
  let server: http.Server;
  let wss: any;
  let wsPort: number;

  let connManager: ConnectionManager;
  let rooms: RoomManager;
  let presence: PresenceService;

  let userA: any;
  let userB: any;
  let workspace: any;
  let board: any;
  let column: any;

  beforeAll(async () => {
    // 1. Create test users and workspace
    const ts = Date.now();
    userA = await userRepository.create({
      email: `alice_${ts}@example.com`,
      name: "Alice Realtime",
      passwordHash: "hash_alice_123",
    });

    userB = await userRepository.create({
      email: `bob_${ts}@example.com`,
      name: "Bob Realtime",
      passwordHash: "hash_bob_123",
    });


    workspace = await workspaceRepository.createWithOwner({
      name: `Presence Lab ${ts}`,
      slug: `pres-lab-${ts}`,
      urlIdentifier: `pres-lab-${ts}`,
      ownerId: userA.id,
    });


    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: userB.id,
        role: "MEMBER",
      },
    });

    board = await boardRepository.create({
      workspaceId: workspace.id,
      title: "Sprint Board",
    });

    column = await boardColumnRepository.create({
      boardId: board.id,
      title: "Backlog",
      position: 0,
    });

    // 2. Setup WebSocket server with local presence & room routing
    connManager = new ConnectionManager();
    rooms = new RoomManager();
    presence = new PresenceService(undefined); // in-memory mode for standalone test reliability

    server = http.createServer();
    wss = createWebSocketServer({
      server,
      connManager,
      rooms,
      subscriber: undefined,
      presence,
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address() as any;
        wsPort = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    // Clean up test DB records
    if (workspace) {
      await db.workspace.delete({ where: { id: workspace.id } }).catch(() => {});
    }
    if (userA) {
      await db.user.delete({ where: { id: userA.id } }).catch(() => {});
    }
    if (userB) {
      await db.user.delete({ where: { id: userB.id } }).catch(() => {});
    }
  });

  function createTestClient(userId: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${wsPort}?token=usr_token_${userId}`, {
        headers: {
          Cookie: `nb_session=sess_${userId}`,
        },
      });

      // Mock session lookup for auth
      (ws as any).userId = userId;

      ws.on("open", () => resolve(ws));
      ws.on("error", (err) => reject(err));
    });
  }

  it("should handle presence lifecycle (online, away, multi-tab, and offline)", async () => {
    // 1. User A connects Tab 1
    const { presence: pA1 } = await presence.setUserOnline(userA.id, "conn_a1");
    expect(pA1.status).toBe("ONLINE");

    // 2. User A connects Tab 2
    const { presence: pA2 } = await presence.setUserOnline(userA.id, "conn_a2");
    expect(pA2.status).toBe("ONLINE");

    // 3. User B connects
    const { presence: pB } = await presence.setUserOnline(userB.id, "conn_b1");
    expect(pB.status).toBe("ONLINE");

    // 4. Batch query workspace presence
    const initialList = await presence.getWorkspacePresence([userA.id, userB.id]);
    expect(initialList).toHaveLength(2);
    expect(initialList.find((p) => p.userId === userA.id)?.status).toBe("ONLINE");
    expect(initialList.find((p) => p.userId === userB.id)?.status).toBe("ONLINE");

    // 5. User B switches status to AWAY
    const awayPresence = await presence.setUserStatus(userB.id, "AWAY");
    expect(awayPresence.status).toBe("AWAY");

    const checkAway = await presence.getUserPresence(userB.id);
    expect(checkAway.status).toBe("AWAY");

    // 6. User A closes Tab 1 (Tab 2 remains open) -> User A must remain ONLINE
    const disconnectTab1 = await presence.removeConnection(userA.id, "conn_a1");
    expect(disconnectTab1.isOffline).toBe(false);
    expect(disconnectTab1.remainingConnections).toBe(1);

    const checkAStillOnline = await presence.getUserPresence(userA.id);
    expect(checkAStillOnline.status).toBe("ONLINE");

    // 7. User A closes Tab 2 -> User A is now OFFLINE
    const disconnectTab2 = await presence.removeConnection(userA.id, "conn_a2");
    expect(disconnectTab2.isOffline).toBe(true);
    expect(disconnectTab2.remainingConnections).toBe(0);

    const checkAOffline = await presence.getUserPresence(userA.id);
    expect(checkAOffline.status).toBe("OFFLINE");
  });

  it("should record activities persistently and allow paginated queries", async () => {
    // User A creates a card
    const card = await cardService.createCard(workspace.id, board.id, userA.id, {
      columnId: column.id,
      title: "Realtime Notification Engine",
    });
    expect(card.id).toBeDefined();

    // User A updates card
    await cardService.updateCard(workspace.id, board.id, card.id, userA.id, {
      title: "Realtime Notification Engine v2",
    });

    // Query workspace activities
    const activitiesResult = await activityService.getWorkspaceActivities(workspace.id, userA.id, {
      limit: 10,
    });

    expect(activitiesResult.items.length).toBeGreaterThanOrEqual(2);

    const createdActivity = activitiesResult.items.find((a) => a.type === "CARD_CREATED");
    expect(createdActivity).toBeDefined();
    expect(createdActivity?.actor?.name).toBe("Alice Realtime");
    expect((createdActivity?.metadata as any)?.cardTitle).toBe("Realtime Notification Engine");

    const renamedActivity = activitiesResult.items.find((a) => a.type === "CARD_RENAMED");
    expect(renamedActivity).toBeDefined();
    expect((renamedActivity?.metadata as any)?.previousTitle).toBe("Realtime Notification Engine");
    expect((renamedActivity?.metadata as any)?.cardTitle).toBe("Realtime Notification Engine v2");

    // Query workspace activities using urlIdentifier
    const activitiesByIdentifier = await activityService.getWorkspaceActivities(
      workspace.urlIdentifier,
      userA.id,
      { limit: 10 }
    );
    expect(activitiesByIdentifier.items.length).toBeGreaterThanOrEqual(2);
  });
});

