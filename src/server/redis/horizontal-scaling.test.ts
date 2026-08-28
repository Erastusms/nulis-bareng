import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import WebSocket from "ws";
import EventEmitter from "events";
import type Redis from "ioredis";
import { QueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import type { Board } from "@/types/domain";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { authService } from "@/server/modules/auth/auth.service";
import { emailService } from "@/server/email/email.service";
import { userRepository } from "@/server/db/repositories/user.repository";
import { workspaceInvitationRepository } from "@/server/db/repositories/workspace-invitation.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { cardRepository } from "@/server/db/repositories/card.repository";
import { boardRepository } from "@/server/db/repositories/board.repository";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import { createWebSocketServer } from "../websocket/ws-server";
import { ConnectionManager } from "../websocket/connection-manager";
import { RoomManager } from "../websocket/room-manager";
import { RedisPublisher } from "./redis-publisher";
import { RedisSubscriber } from "./redis-subscriber";
import { CardService } from "../modules/boards/card.service";
import { BoardColumnService } from "../modules/boards/board-column.service";
import { BoardService } from "../modules/boards/board.service";
import { WorkspaceMemberService } from "../modules/workspaces/workspace-member.service";
import { BoardAuthorizationService } from "../modules/boards/board-authorization";
import { WorkspaceAuthorizationService } from "../modules/workspaces/workspace-authorization";
import { RealtimeCacheUpdater } from "@/lib/realtime/query-cache-updater";

/**
 * In-memory Mock Redis Pub/Sub Bus that accurately models Redis message distribution
 * across separate subscriber connections.
 */
class MockRedisBus extends EventEmitter {
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

describe("Horizontal Scaling Multi-Instance Redis Pub/Sub E2E", () => {
  let redisBus: MockRedisBus;

  // Instance #1 (API #1)
  let server1: http.Server;
  let wss1: ReturnType<typeof createWebSocketServer>;
  let port1: number;
  let connManager1: ConnectionManager;
  let rooms1: RoomManager;
  let redisPublisher1: RedisPublisher;
  let redisSubscriber1: RedisSubscriber;
  let cardService1: CardService;
  let columnService1: BoardColumnService;
  let boardService1: BoardService;
  let _memberService1: WorkspaceMemberService;

  // Instance #2 (API #2)
  let server2: http.Server;
  let wss2: ReturnType<typeof createWebSocketServer>;
  let port2: number;
  let connManager2: ConnectionManager;
  let rooms2: RoomManager;
  let redisPublisher2: RedisPublisher;
  let redisSubscriber2: RedisSubscriber;
  let cardService2: CardService;
  let columnService2: BoardColumnService;
  let _boardService2: BoardService;
  let _memberService2: WorkspaceMemberService;

  // Client Query Caches
  let queryClientA: QueryClient;
  let queryClientB: QueryClient;
  let cacheUpdaterA: RealtimeCacheUpdater;
  let cacheUpdaterB: RealtimeCacheUpdater;

  const mockUserA = {
    id: "usr_a",
    email: "usera@example.com",
    name: "User A",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUserB = {
    id: "usr_b",
    email: "userb@example.com",
    name: "User B",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUserC = {
    id: "usr_c",
    email: "userc@example.com",
    name: "User C",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockWorkspaceShared = {
    id: "ws_shared_123",
    name: "Shared Team Workspace",
    slug: "shared-team-workspace",
    urlIdentifier: "shared-team-slug",
    description: "Shared workspace across instances",
    ownerId: "usr_a",
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 2,
  };

  const mockWorkspaceIsolated = {
    id: "ws_isolated_456",
    name: "Isolated Workspace",
    slug: "isolated-workspace",
    urlIdentifier: "isolated-slug",
    description: "Other workspace",
    ownerId: "usr_c",
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 1,
  };

  const mockBoardRecord = {
    id: "board_dist_1",
    workspaceId: mockWorkspaceShared.id,
    title: "Distributed Kanban Board",
    description: "Multi-instance board",
    position: 65536,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockColBacklog = {
    id: "col_backlog",
    boardId: mockBoardRecord.id,
    title: "Backlog",
    position: 65536,
    color: "#6B7280",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockColDone = {
    id: "col_done",
    boardId: mockBoardRecord.id,
    title: "Done",
    position: 131072,
    color: "#10B981",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    redisBus = new MockRedisBus();

    // -------------------------------------------------------------------------
    // Setup Instance 1 (API #1)
    // -------------------------------------------------------------------------
    connManager1 = new ConnectionManager();
    rooms1 = new RoomManager();
    const pubClient1 = redisBus.createClient("pub") as Redis;
    const subClient1 = redisBus.createClient("sub") as Redis;
    redisPublisher1 = new RedisPublisher(pubClient1, "api-instance-1");
    redisSubscriber1 = new RedisSubscriber(subClient1);

    server1 = http.createServer();
    wss1 = createWebSocketServer({
      server: server1,
      connManager: connManager1,
      rooms: rooms1,
      subscriber: redisSubscriber1,
    });

    const wsAuthService1 = new WorkspaceAuthorizationService(workspaceMemberRepository);
    const boardAuth1 = new BoardAuthorizationService(
      workspaceRepository,
      wsAuthService1,
      boardRepository,
      boardColumnRepository,
      cardRepository,
      workspaceMemberRepository
    );

    cardService1 = new CardService(cardRepository, boardAuth1, redisPublisher1);
    columnService1 = new BoardColumnService(boardColumnRepository, boardAuth1, redisPublisher1);
    boardService1 = new BoardService(boardRepository, boardAuth1, redisPublisher1);
    _memberService1 = new WorkspaceMemberService(
      workspaceMemberRepository,
      workspaceRepository,
      userRepository,
      workspaceInvitationRepository,
      wsAuthService1,
      emailService,
      redisPublisher1
    );

    await new Promise<void>((resolve) => {
      server1.listen(0, () => {
        const addr = server1.address();
        if (addr && typeof addr === "object") port1 = addr.port;
        resolve();
      });
    });

    // -------------------------------------------------------------------------
    // Setup Instance 2 (API #2)
    // -------------------------------------------------------------------------
    connManager2 = new ConnectionManager();
    rooms2 = new RoomManager();
    const pubClient2 = redisBus.createClient("pub") as Redis;
    const subClient2 = redisBus.createClient("sub") as Redis;
    redisPublisher2 = new RedisPublisher(pubClient2, "api-instance-2");
    redisSubscriber2 = new RedisSubscriber(subClient2);

    server2 = http.createServer();
    wss2 = createWebSocketServer({
      server: server2,
      connManager: connManager2,
      rooms: rooms2,
      subscriber: redisSubscriber2,
    });

    const wsAuthService2 = new WorkspaceAuthorizationService(workspaceMemberRepository);
    const boardAuth2 = new BoardAuthorizationService(
      workspaceRepository,
      wsAuthService2,
      boardRepository,
      boardColumnRepository,
      cardRepository,
      workspaceMemberRepository
    );

    cardService2 = new CardService(cardRepository, boardAuth2, redisPublisher2);
    columnService2 = new BoardColumnService(boardColumnRepository, boardAuth2, redisPublisher2);
    _boardService2 = new BoardService(boardRepository, boardAuth2, redisPublisher2);
    _memberService2 = new WorkspaceMemberService(
      workspaceMemberRepository,
      workspaceRepository,
      userRepository,
      workspaceInvitationRepository,
      wsAuthService2,
      emailService,
      redisPublisher2
    );

    await new Promise<void>((resolve) => {
      server2.listen(0, () => {
        const addr = server2.address();
        if (addr && typeof addr === "object") port2 = addr.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    wss1.close();
    wss2.close();
    server1.closeAllConnections?.();
    server2.closeAllConnections?.();
    server1.close();
    server2.close();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();

    rooms1.clear();
    rooms2.clear();
    await redisSubscriber1.unsubscribeAll();
    await redisSubscriber2.unsubscribeAll();

    // Setup Auth Session Mocking
    vi.spyOn(authService, "validateSession").mockImplementation(async (token) => {
      if (token === "token_user_a") {
        return {
          user: mockUserA,
          session: {
            id: "sess_a",
            sessionToken: "token_user_a",
            userId: mockUserA.id,
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
          },
        };
      }
      if (token === "token_user_b") {
        return {
          user: mockUserB,
          session: {
            id: "sess_b",
            sessionToken: "token_user_b",
            userId: mockUserB.id,
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
          },
        };
      }
      if (token === "token_user_c") {
        return {
          user: mockUserC,
          session: {
            id: "sess_c",
            sessionToken: "token_user_c",
            userId: mockUserC.id,
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
          },
        };
      }
      return null;
    });

    // Mock Workspace repository lookups
    vi.spyOn(workspaceRepository, "findById").mockImplementation(async (id) => {
      if (id === mockWorkspaceShared.id) return mockWorkspaceShared as any;
      if (id === mockWorkspaceIsolated.id) return mockWorkspaceIsolated as any;
      return null;
    });

    vi.spyOn(workspaceRepository, "findByUrlIdentifier").mockImplementation(async (urlIdentifier) => {
      if (urlIdentifier === mockWorkspaceShared.urlIdentifier || urlIdentifier === mockWorkspaceShared.id) {
        return mockWorkspaceShared as any;
      }
      if (urlIdentifier === mockWorkspaceIsolated.urlIdentifier || urlIdentifier === mockWorkspaceIsolated.id) {
        return mockWorkspaceIsolated as any;
      }
      return null;
    });

    vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockImplementation(async (identifier) => {
      if (identifier === mockWorkspaceShared.id || identifier === mockWorkspaceShared.urlIdentifier || identifier === mockWorkspaceShared.slug) {
        return mockWorkspaceShared as any;
      }
      if (identifier === mockWorkspaceIsolated.id || identifier === mockWorkspaceIsolated.urlIdentifier || identifier === mockWorkspaceIsolated.slug) {
        return mockWorkspaceIsolated as any;
      }
      return null;
    });

    vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockImplementation(async (wsId, userId) => {
      if (wsId === mockWorkspaceShared.id && (userId === mockUserA.id || userId === mockUserB.id)) {
        return {
          id: `mem_${userId}`,
          workspaceId: wsId,
          userId,
          role: userId === mockUserA.id ? "OWNER" : "MEMBER",
          joinedAt: new Date(),
        } as any;
      }
      if (wsId === mockWorkspaceIsolated.id && userId === mockUserC.id) {
        return {
          id: `mem_${userId}`,
          workspaceId: wsId,
          userId,
          role: "OWNER",
          joinedAt: new Date(),
        } as any;
      }
      return null;
    });

    // Setup TanStack Query Clients
    queryClientA = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClientB = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    cacheUpdaterA = new RealtimeCacheUpdater();
    cacheUpdaterB = new RealtimeCacheUpdater();

    const initialBoard: Board = {
      id: mockBoardRecord.id,
      workspaceId: mockWorkspaceShared.id,
      title: mockBoardRecord.title,
      description: mockBoardRecord.description,
      position: mockBoardRecord.position,
      createdAt: mockBoardRecord.createdAt.toISOString(),
      updatedAt: mockBoardRecord.updatedAt.toISOString(),
      columns: [
        {
          id: mockColBacklog.id,
          boardId: mockBoardRecord.id,
          title: mockColBacklog.title,
          position: mockColBacklog.position,
          color: mockColBacklog.color,
          createdAt: mockColBacklog.createdAt.toISOString(),
          updatedAt: mockColBacklog.updatedAt.toISOString(),
          cards: [],
        },
        {
          id: mockColDone.id,
          boardId: mockBoardRecord.id,
          title: mockColDone.title,
          position: mockColDone.position,
          color: mockColDone.color,
          createdAt: mockColDone.createdAt.toISOString(),
          updatedAt: mockColDone.updatedAt.toISOString(),
          cards: [],
        },
      ],
    };

    queryClientA.setQueryData(boardKeys.detail(mockBoardRecord.id), initialBoard);
    queryClientB.setQueryData(boardKeys.detail(mockBoardRecord.id), initialBoard);
  });

  async function connectClient(port: number, token: string): Promise<WebSocket> {
    const ws = new WebSocket(`ws://localhost:${port}?token=${token}`);
    await new Promise<void>((resolve, reject) => {
      ws.on("open", () => resolve());
      ws.on("error", (err) => reject(err));
    });
    return ws;
  }

  async function subscribeToWorkspace(ws: WebSocket, workspaceId: string): Promise<void> {
    return new Promise((resolve) => {
      const listener = (data: WebSocket.RawData) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed" && msg.workspaceId === workspaceId) {
          ws.off("message", listener);
          resolve();
        }
      };
      ws.on("message", listener);
      ws.send(JSON.stringify({ type: "subscribe", workspaceId }));
    });
  }

  it("should synchronize card creation from API #1 (Client A) to API #2 (Client B) via Redis", async () => {
    // 1. Client A connects to Instance 1
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    // 2. Client B connects to Instance 2
    const wsB = await connectClient(port2, "token_user_b");
    await subscribeToWorkspace(wsB, mockWorkspaceShared.id);

    const clientAEvents: RealtimeDomainEvent[] = [];
    const clientBEvents: RealtimeDomainEvent[] = [];

    wsA.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        clientAEvents.push(msg);
        cacheUpdaterA.applyEvent(queryClientA, msg);
      }
    });

    wsB.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        clientBEvents.push(msg);
        cacheUpdaterB.applyEvent(queryClientB, msg);
      }
    });

    // 3. Mock database create on Instance 1
    const createdCardRecord = {
      id: "card_task_1",
      columnId: mockColBacklog.id,
      boardId: mockBoardRecord.id,
      title: "Cross-Instance Redis Task",
      description: "Must sync from API #1 to API #2",
      position: 65536,
      dueDate: null,
      labels: ["redis", "scaling"],
      assigneeIds: [mockUserA.id],
      assignees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(cardRepository, "create").mockResolvedValue(createdCardRecord as any);
    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord as any);
    vi.spyOn(boardColumnRepository, "findById").mockResolvedValue(mockColBacklog as any);

    // 4. Mutation triggered on API #1
    await cardService1.createCard(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      mockUserA.id,
      {
        columnId: mockColBacklog.id,
        title: "Cross-Instance Redis Task",
        description: "Must sync from API #1 to API #2",
        labels: ["redis", "scaling"],
        assigneeIds: [mockUserA.id],
      }
    );

    // Wait for event dissemination through Redis
    await new Promise((r) => setTimeout(r, 100));

    // 5. Verification: Both Client A (API #1) and Client B (API #2) received card.created event
    const cardCreatedA = clientAEvents.filter((e) => e.type === "card.created");
    const cardCreatedB = clientBEvents.filter((e) => e.type === "card.created");

    expect(cardCreatedA).toHaveLength(1);
    expect(cardCreatedA[0].type).toBe("card.created");

    expect(cardCreatedB).toHaveLength(1);
    expect(cardCreatedB[0].type).toBe("card.created");


    // 6. Cache state on both clients is identical
    const boardA = queryClientA.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    const boardB = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));

    expect(boardA).toBeDefined();
    expect(boardB).toBeDefined();
    expect(boardA?.columns?.[0]?.cards).toHaveLength(1);
    expect(boardA?.columns?.[0]?.cards?.[0]?.id).toBe("card_task_1");

    expect(boardB?.columns?.[0]?.cards).toHaveLength(1);
    expect(boardB?.columns?.[0]?.cards?.[0]?.id).toBe("card_task_1");

    wsA.close();
    wsB.close();
  });

  it("should synchronize card movement and updates bidirectionally across instances", async () => {
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    const wsB = await connectClient(port2, "token_user_b");
    await subscribeToWorkspace(wsB, mockWorkspaceShared.id);

    const clientAEvents: RealtimeDomainEvent[] = [];
    const clientBEvents: RealtimeDomainEvent[] = [];

    wsA.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        clientAEvents.push(msg);
        cacheUpdaterA.applyEvent(queryClientA, msg);
      }
    });

    wsB.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) {
        clientBEvents.push(msg);
        cacheUpdaterB.applyEvent(queryClientB, msg);
      }
    });

    // Mock existing card
    const existingCard = {
      id: "card_movable_1",
      columnId: mockColBacklog.id,
      boardId: mockBoardRecord.id,
      title: "Movable Task",
      description: null,
      position: 65536,
      dueDate: null,
      labels: [],
      assigneeIds: [],
      assignees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord as any);
    vi.spyOn(boardColumnRepository, "findById").mockImplementation(async (id) => {
      if (id === mockColBacklog.id) return mockColBacklog as any;
      if (id === mockColDone.id) return mockColDone as any;
      return null;
    });
    vi.spyOn(cardRepository, "findById").mockResolvedValue(existingCard as any);
    vi.spyOn(cardRepository, "moveCard").mockResolvedValue({
      ...existingCard,
      columnId: mockColDone.id,
      position: 1,
    } as any);

    // Mutation: Client B on API #2 moves card to Done column
    await cardService2.moveCard(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      mockUserB.id,
      {
        cardId: "card_movable_1",
        sourceColumnId: mockColBacklog.id,
        targetColumnId: mockColDone.id,
        targetPosition: 1,
      }
    );

    await new Promise((r) => setTimeout(r, 100));

    // Client A (connected to API #1) receives card.moved from API #2
    expect(clientAEvents.some((e) => e.type === "card.moved")).toBe(true);
    expect(clientBEvents.some((e) => e.type === "card.moved")).toBe(true);

    wsA.close();
    wsB.close();
  });

  it("should isolate workspaces so isolated clients on API #2 do not receive events from API #1", async () => {
    // Client A in Shared Workspace on API #1
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    // Client C in Isolated Workspace on API #2
    const wsC = await connectClient(port2, "token_user_c");
    await subscribeToWorkspace(wsC, mockWorkspaceIsolated.id);

    const clientCEvents: RealtimeDomainEvent[] = [];
    wsC.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".") && msg.type !== "presence.state") {
        clientCEvents.push(msg);
      }
    });


    // Trigger board update in Shared Workspace on API #1
    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord as any);
    vi.spyOn(boardRepository, "update").mockResolvedValue({
      ...mockBoardRecord,
      title: "New Title in Shared Workspace",
    } as any);

    await boardService1.updateBoard(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      mockUserA.id,
      { title: "New Title in Shared Workspace" }
    );

    await new Promise((r) => setTimeout(r, 100));

    // Client C should NOT receive any events from the shared workspace
    expect(clientCEvents).toHaveLength(0);

    wsA.close();
    wsC.close();
  });

  it("should dynamically unsubscribe from Redis channel when the last local client disconnects", async () => {
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    expect(redisSubscriber1.getActiveWorkspaces()).toContain(mockWorkspaceShared.id);

    // Disconnect Client A
    wsA.close();
    await new Promise((r) => setTimeout(r, 150));

    // API #1 subscriber should have unsubscribed from the workspace channel
    expect(redisSubscriber1.getActiveWorkspaces()).not.toContain(mockWorkspaceShared.id);
  });

  it("should synchronize column creation, update, and deletion across instances", async () => {
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    const wsB = await connectClient(port2, "token_user_b");
    await subscribeToWorkspace(wsB, mockWorkspaceShared.id);

    const clientAEvents: RealtimeDomainEvent[] = [];
    const clientBEvents: RealtimeDomainEvent[] = [];

    wsA.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) clientAEvents.push(msg);
    });

    wsB.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) clientBEvents.push(msg);
    });

    // 1. Column Created on API #2
    const newCol = {
      id: "col_qa",
      boardId: mockBoardRecord.id,
      title: "QA & Testing",
      position: 196608,
      color: "#F59E0B",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord as any);
    vi.spyOn(boardColumnRepository, "create").mockResolvedValue(newCol as any);

    await columnService2.createColumn(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      mockUserB.id,
      { title: "QA & Testing", color: "#F59E0B" }
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(clientAEvents.some((e) => e.type === "column.created")).toBe(true);
    expect(clientBEvents.some((e) => e.type === "column.created")).toBe(true);

    // 2. Column Updated on API #1
    vi.spyOn(boardColumnRepository, "findById").mockResolvedValue(newCol as any);
    vi.spyOn(boardColumnRepository, "update").mockResolvedValue({
      ...newCol,
      title: "QA Verified",
    } as any);

    await columnService1.updateColumn(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      newCol.id,
      mockUserA.id,
      { title: "QA Verified" }
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(clientAEvents.some((e) => e.type === "column.updated")).toBe(true);
    expect(clientBEvents.some((e) => e.type === "column.updated")).toBe(true);

    // 3. Column Deleted on API #2
    vi.spyOn(boardColumnRepository, "delete").mockResolvedValue(newCol as any);

    await columnService2.deleteColumn(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      newCol.id,
      mockUserB.id
    );

    await new Promise((r) => setTimeout(r, 100));

    expect(clientAEvents.some((e) => e.type === "column.deleted")).toBe(true);
    expect(clientBEvents.some((e) => e.type === "column.deleted")).toBe(true);

    wsA.close();
    wsB.close();
  });

  it("should synchronize card deletion across instances without duplicates", async () => {
    const wsA = await connectClient(port1, "token_user_a");
    await subscribeToWorkspace(wsA, mockWorkspaceShared.id);

    const wsB = await connectClient(port2, "token_user_b");
    await subscribeToWorkspace(wsB, mockWorkspaceShared.id);

    const clientAEvents: RealtimeDomainEvent[] = [];
    const clientBEvents: RealtimeDomainEvent[] = [];

    wsA.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) clientAEvents.push(msg);
    });

    wsB.on("message", (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type && msg.type.includes(".")) clientBEvents.push(msg);
    });

    const cardToDelete = {
      id: "card_to_delete_99",
      columnId: mockColBacklog.id,
      boardId: mockBoardRecord.id,
      title: "Delete Me",
      description: null,
      position: 65536,
      dueDate: null,
      labels: [],
      assigneeIds: [],
      assignees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord as any);
    vi.spyOn(boardColumnRepository, "findById").mockResolvedValue(mockColBacklog as any);
    vi.spyOn(cardRepository, "findById").mockResolvedValue(cardToDelete as any);
    vi.spyOn(cardRepository, "delete").mockResolvedValue(cardToDelete as any);

    // Delete card on API #1
    await cardService1.deleteCard(
      mockWorkspaceShared.id,
      mockBoardRecord.id,
      cardToDelete.id,
      mockUserA.id
    );

    await new Promise((r) => setTimeout(r, 100));

    // Both clients receive exactly one card.deleted event
    const aDeleteEvents = clientAEvents.filter((e) => e.type === "card.deleted");
    const bDeleteEvents = clientBEvents.filter((e) => e.type === "card.deleted");

    expect(aDeleteEvents).toHaveLength(1);
    expect(bDeleteEvents).toHaveLength(1);

    wsA.close();
    wsB.close();
  });
});

