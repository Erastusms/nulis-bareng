import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "http";
import WebSocket from "ws";
import { QueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import type { Board } from "@/types/domain";
import type { CardMovedEvent, RealtimeDomainEvent, SubscribedMessage } from "@/lib/realtime/events";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { cardRepository } from "@/server/db/repositories/card.repository";
import { boardRepository } from "@/server/db/repositories/board.repository";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import { createWebSocketServer } from "./ws-server";
import { ConnectionManager } from "./connection-manager";
import { RoomManager } from "./room-manager";
import { WebSocketEventPublisher } from "./event-publisher";
import { CardService } from "../modules/boards/card.service";
import { BoardColumnService } from "../modules/boards/board-column.service";
import { BoardAuthorizationService } from "../modules/boards/board-authorization";
import { WorkspaceAuthorizationService } from "../modules/workspaces/workspace-authorization";
import { RealtimeCacheUpdater } from "@/lib/realtime/query-cache-updater";

describe("Cross-Browser Real-Time Synchronization (Browser A & Browser B)", () => {
  let server: http.Server;
  let wss: ReturnType<typeof createWebSocketServer>;
  let port: number;
  let connManager: ConnectionManager;
  let rooms: RoomManager;
  let publisher: WebSocketEventPublisher;
  let cardService: CardService;
  let columnService: BoardColumnService;
  let cacheUpdater: RealtimeCacheUpdater;

  const mockUserA = {
    id: "user_a",
    email: "user_a@example.com",
    name: "User A",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUserB = {
    id: "user_b",
    email: "user_b@example.com",
    name: "User B",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockWorkspace = {
    id: "cuid_ws_123",
    name: "Project Workspace",
    slug: "project-workspace",
    urlIdentifier: "proj-sync-slug",
    description: "Realtime test workspace",
    ownerId: "user_a",
    createdAt: new Date(),
    updatedAt: new Date(),
    memberCount: 2,
  };

  const mockBoardRecord = {
    id: "board_kanban_1",
    workspaceId: mockWorkspace.id,
    title: "Main Kanban Board",
    description: "Sprint board",
    position: 65536,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockColOnHold = {
    id: "col_on_hold",
    boardId: mockBoardRecord.id,
    title: "On Hold",
    position: 65536,
    color: "#EF4444",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockColInProgress = {
    id: "col_in_progress",
    boardId: mockBoardRecord.id,
    title: "In Progress",
    position: 131072,
    color: "#3B82F6",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockCardRecord = {
    id: "card_feature_1",
    columnId: mockColOnHold.id,
    boardId: mockBoardRecord.id,
    title: "Fixing This feature please",
    description: "Important bug fix",
    position: 65536,
    dueDate: null,
    labels: ["bug"],
    assigneeIds: [],
    assignees: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    connManager = new ConnectionManager();
    rooms = new RoomManager();
    publisher = new WebSocketEventPublisher(rooms);
    cacheUpdater = new RealtimeCacheUpdater();

    const workspaceAuth = new WorkspaceAuthorizationService(workspaceMemberRepository);
    const boardAuth = new BoardAuthorizationService(
      workspaceRepository,
      workspaceAuth,
      boardRepository,
      boardColumnRepository,
      cardRepository,
      workspaceMemberRepository
    );

    cardService = new CardService(cardRepository, boardAuth, publisher);
    columnService = new BoardColumnService(boardColumnRepository, boardAuth, publisher);

    server = http.createServer();
    wss = createWebSocketServer({ server, connManager, rooms });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });

    // Mocks for DB repositories
    vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceRepository, "findById").mockResolvedValue(mockWorkspace);
    vi.spyOn(workspaceRepository, "findByUrlIdentifier").mockResolvedValue(mockWorkspace);

    vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockImplementation(
      async (wsId, uId) => {
        if (wsId === mockWorkspace.id && (uId === "user_a" || uId === "user_b")) {
          return {
            id: `mem_${uId}`,
            workspaceId: mockWorkspace.id,
            userId: uId,
            role: uId === "user_a" ? "OWNER" : "MEMBER",
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
        return null;
      }
    );

    vi.spyOn(boardRepository, "findById").mockResolvedValue(mockBoardRecord);

    vi.spyOn(boardColumnRepository, "findById").mockImplementation(async (colId) => {
      if (colId === mockColOnHold.id) return mockColOnHold;
      if (colId === mockColInProgress.id) return mockColInProgress;
      if (colId === "col_done") {
        return {
          id: "col_done",
          boardId: mockBoardRecord.id,
          title: "Done",
          position: 196608,
          color: "#10B981",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });

    vi.spyOn(cardRepository, "findById").mockImplementation(async (cId) => {
      if (cId === mockCardRecord.id) return mockCardRecord;
      if (cId === "card_new_1") {
        return {
          id: "card_new_1",
          columnId: mockColInProgress.id,
          boardId: mockBoardRecord.id,
          title: "New Realtime Card",
          description: "Description",
          position: 65536,
          dueDate: null,
          labels: [],
          assigneeIds: [],
          assignees: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }
      return null;
    });
  });

  afterAll(async () => {
    for (const conn of connManager.getAllConnections()) {
      try {
        conn.socket.close();
      } catch {}
    }
    await new Promise<void>((resolve) => {
      wss.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should synchronize card.moved immediately between Browser A and Browser B when using urlIdentifier", async () => {
    // 1. Setup Auth Spies for User A and User B
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
      return null;
    });

    // 2. Open Browser A WebSocket connection
    const browserA = new WebSocket(`ws://localhost:${port}?token=token_user_a`);
    await new Promise<void>((resolve) => browserA.on("open", () => resolve()));

    // 3. Open Browser B WebSocket connection
    const browserB = new WebSocket(`ws://localhost:${port}?token=token_user_b`);
    await new Promise<void>((resolve) => browserB.on("open", () => resolve()));

    // 4. Both browsers subscribe using workspace urlIdentifier 'proj-sync-slug'
    const subPromiseA = new Promise<SubscribedMessage>((resolve) => {
      browserA.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") resolve(msg);
      });
    });
    const subPromiseB = new Promise<SubscribedMessage>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") resolve(msg);
      });
    });

    browserA.send(JSON.stringify({ type: "subscribe", workspaceId: "proj-sync-slug" }));
    browserB.send(JSON.stringify({ type: "subscribe", workspaceId: "proj-sync-slug" }));

    const [subResA, subResB] = await Promise.all([subPromiseA, subPromiseB]);
    expect(subResA.type).toBe("subscribed");
    expect(subResB.type).toBe("subscribed");

    // 5. Initialize Browser B's TanStack Query Client with the initial board state
    const queryClientB = new QueryClient();
    const initialBoardState: Board = {
      id: mockBoardRecord.id,
      workspaceId: mockWorkspace.id,
      title: mockBoardRecord.title,
      description: mockBoardRecord.description,
      position: mockBoardRecord.position,
      createdAt: mockBoardRecord.createdAt.toISOString(),
      updatedAt: mockBoardRecord.updatedAt.toISOString(),
      columns: [
        {
          id: mockColOnHold.id,
          boardId: mockBoardRecord.id,
          title: "On Hold",
          position: 65536,
          color: "#EF4444",
          cards: [
            {
              id: mockCardRecord.id,
              columnId: mockColOnHold.id,
              boardId: mockBoardRecord.id,
              title: "Fixing This feature please",
              description: "Important bug fix",
              position: 65536,
              dueDate: null,
              labels: ["bug"],
              assigneeIds: [],
              createdAt: mockCardRecord.createdAt.toISOString(),
              updatedAt: mockCardRecord.updatedAt.toISOString(),
            },
          ],
          createdAt: mockColOnHold.createdAt.toISOString(),
          updatedAt: mockColOnHold.updatedAt.toISOString(),
        },
        {
          id: mockColInProgress.id,
          boardId: mockBoardRecord.id,
          title: "In Progress",
          position: 131072,
          color: "#3B82F6",
          cards: [],
          createdAt: mockColInProgress.createdAt.toISOString(),
          updatedAt: mockColInProgress.updatedAt.toISOString(),
        },
      ],
    };
    queryClientB.setQueryData<Board>(boardKeys.detail(mockBoardRecord.id), initialBoardState);

    // Verify initial state on Browser B: Card is in On Hold
    const initialCachedBoard = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    expect(initialCachedBoard?.columns?.[0].cards?.length).toBe(1);
    expect(initialCachedBoard?.columns?.[0].cards?.[0].title).toBe("Fixing This feature please");
    expect(initialCachedBoard?.columns?.[1].cards?.length).toBe(0);

    // 6. Listen for incoming events on Browser B
    const browserBEventPromise = new Promise<RealtimeDomainEvent>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "card.moved") {
          resolve(msg);
        }
      });
    });

    // 7. Mock Card Repository moveCard execution (authoritative DB mutation)
    const authoritativeMovedPosition = 65536;
    vi.spyOn(cardRepository, "moveCard").mockImplementation(async (data) => {
      mockCardRecord = {
        ...mockCardRecord,
        columnId: data.targetColumnId,
        position: authoritativeMovedPosition,
        updatedAt: new Date(),
      };
      return mockCardRecord;
    });

    // 8. User A moves card from "On Hold" to "In Progress"
    const movedCard = await cardService.moveCard(
      "proj-sync-slug",
      mockBoardRecord.id,
      mockUserA.id,
      {
        cardId: mockCardRecord.id,
        sourceColumnId: mockColOnHold.id,
        targetColumnId: mockColInProgress.id,
        targetPosition: 0,
      }
    );

    expect(movedCard.columnId).toBe(mockColInProgress.id);

    // 9. Browser B receives the broadcast event over WebSocket
    const receivedEvent = await browserBEventPromise;
    expect(receivedEvent.type).toBe("card.moved");
    const movedEvt = receivedEvent as CardMovedEvent;
    expect(movedEvt.cardId).toBe(mockCardRecord.id);
    expect(movedEvt.fromColumnId).toBe(mockColOnHold.id);
    expect(movedEvt.toColumnId).toBe(mockColInProgress.id);
    expect(movedEvt.position).toBe(authoritativeMovedPosition);

    // 10. Browser B applies the event to its TanStack Query cache
    cacheUpdater.applyEvent(queryClientB, receivedEvent);

    // 11. Assert Browser B's cache is immediately updated:
    // "On Hold" has 0 cards, "In Progress" has the moved card
    const updatedCachedBoard = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    const colOnHold = updatedCachedBoard?.columns?.find((c) => c.id === mockColOnHold.id);
    const colInProgress = updatedCachedBoard?.columns?.find((c) => c.id === mockColInProgress.id);

    expect(colOnHold?.cards?.length).toBe(0);
    expect(colInProgress?.cards?.length).toBe(1);
    expect(colInProgress?.cards?.[0].id).toBe(mockCardRecord.id);
    expect(colInProgress?.cards?.[0].title).toBe("Fixing This feature please");
    expect(colInProgress?.cards?.[0].columnId).toBe(mockColInProgress.id);
    expect(colInProgress?.cards?.[0].position).toBe(authoritativeMovedPosition);

    // Clean up connections
    browserA.close();
    browserB.close();
  });

  it("should synchronize card.created, card.updated, and card.deleted between Browser A and Browser B", async () => {
    const browserA = new WebSocket(`ws://localhost:${port}?token=token_user_a`);
    const browserB = new WebSocket(`ws://localhost:${port}?token=token_user_b`);
    await Promise.all([
      new Promise<void>((resolve) => browserA.on("open", () => resolve())),
      new Promise<void>((resolve) => browserB.on("open", () => resolve())),
    ]);

    browserA.send(JSON.stringify({ type: "subscribe", workspaceId: mockWorkspace.id }));
    browserB.send(JSON.stringify({ type: "subscribe", workspaceId: mockWorkspace.id }));

    // Wait for subscriptions
    await new Promise((r) => setTimeout(r, 50));

    const queryClientB = new QueryClient();
    queryClientB.setQueryData<Board>(boardKeys.detail(mockBoardRecord.id), {
      id: mockBoardRecord.id,
      workspaceId: mockWorkspace.id,
      title: mockBoardRecord.title,
      description: mockBoardRecord.description,
      position: mockBoardRecord.position,
      createdAt: mockBoardRecord.createdAt.toISOString(),
      updatedAt: mockBoardRecord.updatedAt.toISOString(),
      columns: [
        {
          id: mockColInProgress.id,
          boardId: mockBoardRecord.id,
          title: "In Progress",
          position: 131072,
          color: "#3B82F6",
          cards: [],
          createdAt: mockColInProgress.createdAt.toISOString(),
          updatedAt: mockColInProgress.updatedAt.toISOString(),
        },
      ],
    });

    // 1. Test Card Created
    const createPromise = new Promise<RealtimeDomainEvent>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "card.created") resolve(msg);
      });
    });

    vi.spyOn(cardRepository, "create").mockResolvedValue({
      id: "card_new_1",
      columnId: mockColInProgress.id,
      boardId: mockBoardRecord.id,
      title: "New Realtime Card",
      description: "Description",
      position: 65536,
      dueDate: null,
      labels: [],
      assigneeIds: [],
      assignees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await cardService.createCard(mockWorkspace.id, mockBoardRecord.id, mockUserA.id, {
      columnId: mockColInProgress.id,
      title: "New Realtime Card",
    });

    const createEvt = await createPromise;
    cacheUpdater.applyEvent(queryClientB, createEvt);

    let boardState = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    expect(boardState?.columns?.[0].cards?.length).toBe(1);
    expect(boardState?.columns?.[0].cards?.[0].title).toBe("New Realtime Card");

    // 2. Test Card Updated
    const updatePromise = new Promise<RealtimeDomainEvent>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "card.updated") resolve(msg);
      });
    });

    vi.spyOn(cardRepository, "update").mockResolvedValue({
      id: "card_new_1",
      columnId: mockColInProgress.id,
      boardId: mockBoardRecord.id,
      title: "New Realtime Card (Edited)",
      description: "Updated description",
      position: 65536,
      dueDate: null,
      labels: [],
      assigneeIds: [],
      assignees: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await cardService.updateCard(mockWorkspace.id, mockBoardRecord.id, "card_new_1", mockUserA.id, {
      title: "New Realtime Card (Edited)",
    });

    const updateEvt = await updatePromise;
    cacheUpdater.applyEvent(queryClientB, updateEvt);

    boardState = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    expect(boardState?.columns?.[0].cards?.[0].title).toBe("New Realtime Card (Edited)");

    // 3. Test Card Deleted
    const deletePromise = new Promise<RealtimeDomainEvent>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "card.deleted") resolve(msg);
      });
    });

    vi.spyOn(cardRepository, "delete").mockResolvedValue(true);
    await cardService.deleteCard(mockWorkspace.id, mockBoardRecord.id, "card_new_1", mockUserA.id);

    const deleteEvt = await deletePromise;
    cacheUpdater.applyEvent(queryClientB, deleteEvt);

    boardState = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    expect(boardState?.columns?.[0].cards?.length).toBe(0);

    browserA.close();
    browserB.close();
  });

  it("should synchronize column mutations between Browser A and Browser B", async () => {
    const browserA = new WebSocket(`ws://localhost:${port}?token=token_user_a`);
    const browserB = new WebSocket(`ws://localhost:${port}?token=token_user_b`);
    await Promise.all([
      new Promise<void>((resolve) => browserA.on("open", () => resolve())),
      new Promise<void>((resolve) => browserB.on("open", () => resolve())),
    ]);

    browserA.send(JSON.stringify({ type: "subscribe", workspaceId: mockWorkspace.id }));
    browserB.send(JSON.stringify({ type: "subscribe", workspaceId: mockWorkspace.id }));

    await new Promise((r) => setTimeout(r, 50));

    const queryClientB = new QueryClient();
    queryClientB.setQueryData<Board>(boardKeys.detail(mockBoardRecord.id), {
      id: mockBoardRecord.id,
      workspaceId: mockWorkspace.id,
      title: mockBoardRecord.title,
      description: mockBoardRecord.description,
      position: mockBoardRecord.position,
      createdAt: mockBoardRecord.createdAt.toISOString(),
      updatedAt: mockBoardRecord.updatedAt.toISOString(),
      columns: [],
    });

    const colCreatedPromise = new Promise<RealtimeDomainEvent>((resolve) => {
      browserB.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "column.created") resolve(msg);
      });
    });

    vi.spyOn(boardColumnRepository, "create").mockResolvedValue({
      id: "col_done",
      boardId: mockBoardRecord.id,
      title: "Done",
      position: 196608,
      color: "#10B981",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await columnService.createColumn(mockWorkspace.id, mockBoardRecord.id, mockUserA.id, {
      title: "Done",
    });

    const colEvt = await colCreatedPromise;
    cacheUpdater.applyEvent(queryClientB, colEvt);

    const boardState = queryClientB.getQueryData<Board>(boardKeys.detail(mockBoardRecord.id));
    expect(boardState?.columns?.length).toBe(1);
    expect(boardState?.columns?.[0].title).toBe("Done");

    browserA.close();
    browserB.close();
  });
});
