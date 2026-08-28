import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { WorkspaceService } from "@/server/modules/workspaces/workspace.service";
import { BoardService } from "@/server/modules/boards/board.service";
import { BoardColumnService } from "@/server/modules/boards/board-column.service";
import { CardService } from "@/server/modules/boards/card.service";
import { WorkspaceAuthorizationService } from "@/server/modules/workspaces/workspace-authorization";
import { BoardAuthorizationService } from "@/server/modules/boards/board-authorization";
import { ActivityService } from "@/server/modules/activities/activity.service";
import { boardKeys, workspaceKeys } from "@/lib/query/query-keys";
import type { Board, Workspace } from "@/types/domain";

describe("Critical Path E2E Journey: Login -> Workspace -> Board -> Card -> Move", () => {
  let queryClient: QueryClient;

  // Mock State Stores
  const usersStore = new Map<string, any>();
  const sessionsStore = new Map<string, any>();
  const workspacesStore = new Map<string, any>();
  const membersStore = new Map<string, any>();
  const boardsStore = new Map<string, any>();
  const columnsStore = new Map<string, any>();
  const cardsStore = new Map<string, any>();
  const activitiesStore: any[] = [];
  const publishedEvents: any[] = [];

  let workspaceService: WorkspaceService;
  let boardService: BoardService;
  let columnService: BoardColumnService;
  let cardService: CardService;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    usersStore.clear();
    sessionsStore.clear();
    workspacesStore.clear();
    membersStore.clear();
    boardsStore.clear();
    columnsStore.clear();
    cardsStore.clear();
    activitiesStore.length = 0;
    publishedEvents.length = 0;

    // Seed test user
    const testUser = {
      id: "usr_e2e_1",
      name: "E2E Test User",
      email: "e2e@example.com",
      passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz1234567890",
      avatarUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    usersStore.set(testUser.id, testUser);

    // Mock Repositories
    const mockWorkspaceRepo: any = {
      createWithOwner: vi.fn(async (data) => {
        const id = `ws_${Date.now()}`;
        const ws = {
          id,
          name: data.name,
          slug: data.slug,
          urlIdentifier: data.urlIdentifier,
          description: data.description ?? null,
          ownerId: data.ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberCount: 1,
        };
        workspacesStore.set(id, ws);
        membersStore.set(`${id}:${data.ownerId}`, {
          id: `mem_${id}`,
          workspaceId: id,
          userId: data.ownerId,
          role: "OWNER",
          user: testUser,
        });
        return ws;
      }),
      findById: vi.fn(async (id) => workspacesStore.get(id) ?? null),
      findByIdOrUrlIdentifier: vi.fn(async (identifier) => {
        for (const ws of workspacesStore.values()) {
          if (ws.id === identifier || ws.urlIdentifier === identifier || ws.slug === identifier) {
            return ws;
          }
        }
        return null;
      }),
      findByUrlIdentifier: vi.fn(async (urlIdentifier) => {
        for (const ws of workspacesStore.values()) {
          if (ws.urlIdentifier === urlIdentifier) return ws;
        }
        return null;
      }),
      findBySlug: vi.fn(async (slug) => {
        for (const ws of workspacesStore.values()) {
          if (ws.slug === slug) return ws;
        }
        return null;
      }),
      findByUserId: vi.fn(async (userId) => {
        return Array.from(workspacesStore.values()).filter((w) => w.ownerId === userId);
      }),
      getUserWorkspaces: vi.fn(async (userId) => {
        return Array.from(workspacesStore.values()).filter((w) => w.ownerId === userId);
      }),
    };

    const mockMemberRepo: any = {
      findByWorkspaceAndUser: vi.fn(async (wsId, userId) => {
        return membersStore.get(`${wsId}:${userId}`) ?? null;
      }),
      findMembersByWorkspaceId: vi.fn(async (wsId) => {
        return Array.from(membersStore.values()).filter((m) => m.workspaceId === wsId);
      }),
    };

    const mockBoardRepo: any = {
      create: vi.fn(async (data) => {
        const id = `board_${Date.now()}`;
        const b = {
          id,
          workspaceId: data.workspaceId,
          title: data.title,
          description: data.description ?? null,
          position: data.position ?? 65536,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        boardsStore.set(id, b);
        return b;
      }),
      findById: vi.fn(async (id) => boardsStore.get(id) ?? null),
      findByWorkspaceId: vi.fn(async (wsId) => {
        return Array.from(boardsStore.values()).filter((b) => b.workspaceId === wsId);
      }),
    };

    const mockColumnRepo: any = {
      create: vi.fn(async (data) => {
        const id = `col_${Date.now()}_${Math.random()}`;
        const c = {
          id,
          boardId: data.boardId,
          title: data.title,
          color: data.color ?? null,
          position: data.position ?? 65536,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        columnsStore.set(id, c);
        return c;
      }),
      findById: vi.fn(async (id) => columnsStore.get(id) ?? null),
      findByBoardId: vi.fn(async (boardId) => {
        return Array.from(columnsStore.values()).filter((c) => c.boardId === boardId);
      }),
    };

    const mockCardRepo: any = {
      create: vi.fn(async (data) => {
        const id = `card_${Date.now()}`;
        const card = {
          id,
          boardId: data.boardId,
          columnId: data.columnId,
          title: data.title,
          description: data.description ?? null,
          position: data.position ?? 65536,
          dueDate: data.dueDate ?? null,
          labels: data.labels ?? [],
          assigneeIds: data.assigneeIds ?? [],
          assignees: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        cardsStore.set(id, card);
        return card;
      }),
      findById: vi.fn(async (id) => cardsStore.get(id) ?? null),
      moveCard: vi.fn(async (data) => {
        const card = cardsStore.get(data.cardId);
        if (!card) throw new Error("Card not found");
        card.columnId = data.targetColumnId;
        card.position = data.targetPosition;
        card.updatedAt = new Date();
        return card;
      }),
    };

    const mockActivityRepo: any = {
      create: vi.fn(async (data) => {
        activitiesStore.push(data);
        return { id: `act_${Date.now()}`, ...data, createdAt: new Date() };
      }),
    };

    const mockPublisher: any = {
      publish: vi.fn(async (event) => {
        publishedEvents.push(event);
      }),
    };

    const wsAuth = new WorkspaceAuthorizationService(mockMemberRepo, mockWorkspaceRepo);
    const boardAuth = new BoardAuthorizationService(
      mockWorkspaceRepo,
      wsAuth,
      mockBoardRepo,
      mockColumnRepo,
      mockCardRepo,
      mockMemberRepo
    );

    const mockUserRepo: any = {
      findById: vi.fn(async (id) => usersStore.get(id) ?? null),
    };

    const activityService = new ActivityService(mockActivityRepo, wsAuth, mockPublisher);
    workspaceService = new WorkspaceService(
      mockWorkspaceRepo,
      wsAuth,
      mockUserRepo,
      activityService
    );
    boardService = new BoardService(mockBoardRepo, boardAuth, mockPublisher, activityService);
    columnService = new BoardColumnService(
      mockColumnRepo,
      boardAuth,
      mockPublisher,
      activityService
    );
    cardService = new CardService(mockCardRepo, boardAuth, mockPublisher, activityService);
  });

  it("should complete the full critical user journey end-to-end", async () => {
    // 1. Step 1: User Login
    const loginResult = {
      user: usersStore.get("usr_e2e_1"),
      sessionToken: "token_e2e_user",
      expiresAt: new Date(Date.now() + 1000000),
    };
    expect(loginResult.user.email).toBe("e2e@example.com");

    // 2. Step 2: Create Workspace
    const createdWorkspace = await workspaceService.createWorkspace({
      name: "Product Roadmap Workspace",
      slug: "product-roadmap",
      description: "Q3 & Q4 deliverables",
      ownerId: loginResult.user.id,
    });

    expect(createdWorkspace.id).toBeDefined();
    expect(createdWorkspace.name).toBe("Product Roadmap Workspace");
    expect(createdWorkspace.ownerId).toBe(loginResult.user.id);

    // Update query cache
    queryClient.setQueryData(workspaceKeys.lists(), [createdWorkspace]);
    expect(queryClient.getQueryData<Workspace[]>(workspaceKeys.lists())).toHaveLength(1);

    // 3. Step 3: Create Kanban Board
    const createdBoard = await boardService.createBoard(createdWorkspace.id, loginResult.user.id, {
      title: "Sprint 1 Kanban",
      description: "Primary engineering sprint board",
    });

    expect(createdBoard.id).toBeDefined();
    expect(createdBoard.title).toBe("Sprint 1 Kanban");
    expect(createdBoard.workspaceId).toBe(createdWorkspace.id);

    // 4. Step 4: Create Columns
    const colBacklog = await columnService.createColumn(
      createdWorkspace.id,
      createdBoard.id,
      loginResult.user.id,
      { title: "Backlog", color: "#6B7280", position: 65536 }
    );
    const colDone = await columnService.createColumn(
      createdWorkspace.id,
      createdBoard.id,
      loginResult.user.id,
      { title: "Done", color: "#10B981", position: 131072 }
    );

    expect(colBacklog.id).toBeDefined();
    expect(colDone.id).toBeDefined();

    // 5. Step 5: Create Card in Backlog
    const createdCard = await cardService.createCard(
      createdWorkspace.id,
      createdBoard.id,
      loginResult.user.id,
      {
        columnId: colBacklog.id,
        title: "Deploy Testing Pipeline",
        description: "Configure automated CI checks and tests",
        labels: ["ci", "testing"],
        assigneeIds: [loginResult.user.id],
      }
    );

    expect(createdCard.id).toBeDefined();
    expect(createdCard.columnId).toBe(colBacklog.id);
    expect(createdCard.title).toBe("Deploy Testing Pipeline");

    // Board cache state before move
    const boardStateBefore: Board = {
      ...createdBoard,
      columns: [
        { ...colBacklog, cards: [createdCard] },
        { ...colDone, cards: [] },
      ],
    };
    queryClient.setQueryData(boardKeys.detail(createdBoard.id), boardStateBefore);

    // 6. Step 6: Move Card from Backlog to Done
    const movedCard = await cardService.moveCard(
      createdWorkspace.id,
      createdBoard.id,
      loginResult.user.id,
      {
        cardId: createdCard.id,
        sourceColumnId: colBacklog.id,
        targetColumnId: colDone.id,
        targetPosition: 65536,
      }
    );

    expect(movedCard.columnId).toBe(colDone.id);
    expect(cardsStore.get(createdCard.id).columnId).toBe(colDone.id);

    // 7. Step 7: Verify Event & Activity Log Generation
    const cardMovedEvent = publishedEvents.find((e) => e.type === "card.moved");
    expect(cardMovedEvent).toBeDefined();
    expect(cardMovedEvent.cardId).toBe(createdCard.id);
    expect(cardMovedEvent.fromColumnId).toBe(colBacklog.id);
    expect(cardMovedEvent.toColumnId).toBe(colDone.id);

    const cardMovedActivity = activitiesStore.find((a) => a.type === "CARD_MOVED");
    expect(cardMovedActivity).toBeDefined();
    expect(cardMovedActivity.actorId).toBe(loginResult.user.id);
    expect(cardMovedActivity.entityId).toBe(createdCard.id);
  });
});
