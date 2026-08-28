import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import WebSocket from "ws";
import EventEmitter from "events";
import type Redis from "ioredis";
import { QueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import { RealtimeCacheUpdater } from "@/lib/realtime/query-cache-updater";
import type { Board } from "@/types/domain";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { cardRepository } from "@/server/db/repositories/card.repository";
import { boardRepository } from "@/server/db/repositories/board.repository";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import { createWebSocketServer } from "@/server/websocket/ws-server";
import { ConnectionManager } from "@/server/websocket/connection-manager";
import { RoomManager } from "@/server/websocket/room-manager";
import { RedisPublisher } from "@/server/redis/redis-publisher";
import { RedisSubscriber } from "@/server/redis/redis-subscriber";
import { CardService } from "@/server/modules/boards/card.service";
import { BoardAuthorizationService } from "@/server/modules/boards/board-authorization";
import { WorkspaceAuthorizationService } from "@/server/modules/workspaces/workspace-authorization";

/**
 * Mock Redis Pub/Sub bus simulating distributed message distribution
 */
class DistributedRedisBus extends EventEmitter {
  private subscribers = new Map<string, Set<(channel: string, message: string) => void>>();

  createClient(role: "pub" | "sub"): Partial<Redis> {
    const subscribers = this.subscribers;
    const clientEmitter = new EventEmitter();

    if (role === "pub") {
      return {
        publish: vi.fn(async (channel: string, message: string) => {
          const listeners = subscribers.get(channel);
          if (listeners) {
            listeners.forEach((listener) => listener(channel, message));
          }
          return (listeners?.size || 0) as number;
        }),
      } as unknown as Partial<Redis>;
    } else {
      const activeChannels = new Set<string>();

      const listener = (channel: string, message: string) => {
        if (activeChannels.has(channel)) {
          clientEmitter.emit("message", channel, message);
        }
      };

      return Object.assign(clientEmitter, {
        subscribe: vi.fn(async (...channels: string[]) => {
          for (const ch of channels) {
            activeChannels.add(ch);
            let set = subscribers.get(ch);
            if (!set) {
              set = new Set();
              subscribers.set(ch, set);
            }
            set.add(listener);
          }
          return channels.length;
        }),
        unsubscribe: vi.fn(async (...channels: string[]) => {
          for (const ch of channels) {
            activeChannels.delete(ch);
            const set = subscribers.get(ch);
            if (set) {
              set.delete(listener);
              if (set.size === 0) subscribers.delete(ch);
            }
          }
          return channels.length;
        }),
      }) as unknown as Partial<Redis>;
    }
  }
}

describe("Two-User Real-Time Collaboration E2E Test (User A -> Mutation -> Redis -> User B UI Sync)", () => {
  let redisBus: DistributedRedisBus;
  let server: http.Server;
  let wss: ReturnType<typeof createWebSocketServer>;
  let port: number;
  let connManager: ConnectionManager;
  let rooms: RoomManager;
  let redisPublisher: RedisPublisher;
  let redisSubscriber: RedisSubscriber;
  let cardService: CardService;

  let queryClientUserA: QueryClient;
  let queryClientUserB: QueryClient;
  let cacheUpdaterUserA: RealtimeCacheUpdater;
  let cacheUpdaterUserB: RealtimeCacheUpdater;

  const userA = {
    id: "usr_alice",
    email: "alice@team.com",
    name: "Alice",
    avatarUrl: null,
  };

  const userB = {
    id: "usr_bob",
    email: "bob@team.com",
    name: "Bob",
    avatarUrl: null,
  };

  const sharedWorkspace = {
    id: "ws_collab_team",
    name: "Collab Team Workspace",
    slug: "collab-team",
    urlIdentifier: "collab-team-slug",
    ownerId: userA.id,
  };

  const collabBoard = {
    id: "board_collab_1",
    workspaceId: sharedWorkspace.id,
    title: "Sprint Collaboration Board",
    position: 65536,
  };

  const colTodo = {
    id: "col_todo",
    boardId: collabBoard.id,
    title: "To Do",
    position: 65536,
    color: "#6B7280",
  };

  const colDoing = {
    id: "col_doing",
    boardId: collabBoard.id,
    title: "Doing",
    position: 131072,
    color: "#3B82F6",
  };

  const cardTarget = {
    id: "card_movable_sync_1",
    columnId: colTodo.id,
    boardId: collabBoard.id,
    title: "Real-Time Collaboration Card",
    description: "Card moved by Alice, seen live by Bob",
    position: 65536,
    dueDate: null,
    labels: ["live", "realtime"],
    assigneeIds: [userA.id],
    assignees: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    redisBus = new DistributedRedisBus();
    connManager = new ConnectionManager();
    rooms = new RoomManager();

    const pubClient = redisBus.createClient("pub") as Redis;
    const subClient = redisBus.createClient("sub") as Redis;
    redisPublisher = new RedisPublisher(pubClient, "e2e-realtime-server");
    redisSubscriber = new RedisSubscriber(subClient);

    server = http.createServer();
    wss = createWebSocketServer({
      server,
      connManager,
      rooms,
      subscriber: redisSubscriber,
      publisher: redisPublisher,
    });

    const wsAuthService = new WorkspaceAuthorizationService(workspaceMemberRepository);
    const boardAuth = new BoardAuthorizationService(
      workspaceRepository,
      wsAuthService,
      boardRepository,
      boardColumnRepository,
      cardRepository,
      workspaceMemberRepository
    );

    const mockActivityService = { recordActivity: vi.fn() };
    cardService = new CardService(cardRepository, boardAuth, redisPublisher, mockActivityService as any);

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") port = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wss.close();
    server.closeAllConnections?.();
    server.close();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    rooms.clear();

    // Setup Auth Sessions
    vi.spyOn(authService, "validateSession").mockImplementation(async (token) => {
      if (token === "token_alice") {
        return {
          user: userA as any,
          session: { id: "sess_a", sessionToken: token, userId: userA.id, expiresAt: new Date(Date.now() + 100000), createdAt: new Date() },
        };
      }
      if (token === "token_bob") {
        return {
          user: userB as any,
          session: { id: "sess_b", sessionToken: token, userId: userB.id, expiresAt: new Date(Date.now() + 100000), createdAt: new Date() },
        };
      }
      return null;
    });

    // Mock Workspace repository lookups
    vi.spyOn(workspaceRepository, "findById").mockResolvedValue(sharedWorkspace as any);
    vi.spyOn(workspaceRepository, "findByUrlIdentifier").mockResolvedValue(sharedWorkspace as any);
    vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue(sharedWorkspace as any);

    // Mock Memberships for both Alice and Bob
    vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockImplementation(async (wsId, uId) => {
      if (wsId === sharedWorkspace.id && (uId === userA.id || uId === userB.id)) {
        return { id: `mem_${uId}`, workspaceId: wsId, userId: uId, role: uId === userA.id ? "OWNER" : "MEMBER" } as any;
      }
      return null;
    });

    vi.spyOn(workspaceMemberRepository, "findMembersByWorkspaceId").mockResolvedValue([
      { id: "mem_a", workspaceId: sharedWorkspace.id, userId: userA.id, role: "OWNER", user: userA },
      { id: "mem_b", workspaceId: sharedWorkspace.id, userId: userB.id, role: "MEMBER", user: userB },
    ] as any);

    // Mock Board & Column lookups
    vi.spyOn(boardRepository, "findById").mockResolvedValue(collabBoard as any);
    vi.spyOn(boardColumnRepository, "findById").mockImplementation(async (id) => {
      if (id === colTodo.id) return colTodo as any;
      if (id === colDoing.id) return colDoing as any;
      return null;
    });
    vi.spyOn(cardRepository, "findById").mockResolvedValue(cardTarget as any);
    vi.spyOn(cardRepository, "moveCard").mockImplementation(async (data) => {
      return {
        ...cardTarget,
        columnId: data.targetColumnId,
        position: data.targetPosition,
      } as any;
    });

    // Initialize TanStack Query Cache for both users
    queryClientUserA = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClientUserB = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cacheUpdaterUserA = new RealtimeCacheUpdater();
    cacheUpdaterUserB = new RealtimeCacheUpdater();

    const initialBoard: Board = {
      id: collabBoard.id,
      workspaceId: sharedWorkspace.id,
      title: collabBoard.title,
      description: null,
      position: collabBoard.position,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      columns: [
        {
          id: colTodo.id,
          boardId: collabBoard.id,
          title: colTodo.title,
          position: colTodo.position,
          color: colTodo.color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [
            {
              id: cardTarget.id,
              columnId: colTodo.id,
              boardId: collabBoard.id,
              title: cardTarget.title,
              description: cardTarget.description,
              position: cardTarget.position,
              dueDate: null,
              labels: cardTarget.labels,
              assigneeIds: cardTarget.assigneeIds,
              assignees: [],
              createdAt: cardTarget.createdAt.toISOString(),
              updatedAt: cardTarget.updatedAt.toISOString(),
            },
          ],
        },
        {
          id: colDoing.id,
          boardId: collabBoard.id,
          title: colDoing.title,
          position: colDoing.position,
          color: colDoing.color,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          cards: [],
        },
      ],
    };

    queryClientUserA.setQueryData(boardKeys.detail(collabBoard.id), initialBoard);
    queryClientUserB.setQueryData(boardKeys.detail(collabBoard.id), initialBoard);
  });

  async function connectAndSubscribe(token: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
    });

    await new Promise<void>((resolve) => {
      const listener = (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          ws.off("message", listener);
          resolve();
        }
      };
      ws.on("message", listener);
      ws.send(JSON.stringify({ type: "subscribe", workspaceId: sharedWorkspace.id }));
    });

    return ws;
  }

  it("should synchronize real-time card move from User A to User B UI without manual page refresh", async () => {
    // 1. User A (Alice) connects and subscribes
    const wsAlice = await connectAndSubscribe("token_alice");

    // 2. User B (Bob) connects and subscribes
    const wsBob = await connectAndSubscribe("token_bob");

    const aliceEvents: RealtimeDomainEvent[] = [];
    const bobEvents: RealtimeDomainEvent[] = [];

    wsAlice.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        aliceEvents.push(msg);
        cacheUpdaterUserA.applyEvent(queryClientUserA, msg);
      }
    });

    wsBob.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        bobEvents.push(msg);
        cacheUpdaterUserB.applyEvent(queryClientUserB, msg);
      }
    });

    // Verify initial state on Bob's client: Card is in "To Do" column
    const bobBoardBefore = queryClientUserB.getQueryData<Board>(boardKeys.detail(collabBoard.id));
    expect(bobBoardBefore?.columns?.[0]?.cards).toHaveLength(1);
    expect(bobBoardBefore?.columns?.[0]?.cards?.[0]?.id).toBe(cardTarget.id);
    expect(bobBoardBefore?.columns?.[1]?.cards).toHaveLength(0);

    // 3. User A (Alice) executes a card move mutation: moving card to "Doing" column
    await cardService.moveCard(
      sharedWorkspace.id,
      collabBoard.id,
      userA.id,
      {
        cardId: cardTarget.id,
        sourceColumnId: colTodo.id,
        targetColumnId: colDoing.id,
        targetPosition: 65536,
      }
    );

    // Wait for WebSocket event distribution
    await new Promise((r) => setTimeout(r, 100));

    // 4. Verification: Bob received card.moved real-time event
    const bobCardMoved = bobEvents.find((e) => e.type === "card.moved");
    expect(bobCardMoved).toBeDefined();
    expect(bobCardMoved?.type).toBe("card.moved");
    if (bobCardMoved && bobCardMoved.type === "card.moved") {
      expect(bobCardMoved.cardId).toBe(cardTarget.id);
      expect(bobCardMoved.fromColumnId).toBe(colTodo.id);
      expect(bobCardMoved.toColumnId).toBe(colDoing.id);
    }

    // 5. Verification: Bob's Query Cache updated in real-time without page refresh
    const bobBoardAfter = queryClientUserB.getQueryData<Board>(boardKeys.detail(collabBoard.id));
    expect(bobBoardAfter).toBeDefined();
    // "To Do" column is now empty
    expect(bobBoardAfter?.columns?.[0]?.cards).toHaveLength(0);
    // "Doing" column now contains the moved card
    expect(bobBoardAfter?.columns?.[1]?.cards).toHaveLength(1);
    expect(bobBoardAfter?.columns?.[1]?.cards?.[0]?.id).toBe(cardTarget.id);
    expect(bobBoardAfter?.columns?.[1]?.cards?.[0]?.columnId).toBe(colDoing.id);

    wsAlice.close();
    wsBob.close();
  });
});
