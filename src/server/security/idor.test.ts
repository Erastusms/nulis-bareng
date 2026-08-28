import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { WorkspaceAuthorizationService } from "@/server/modules/workspaces/workspace-authorization";
import { BoardAuthorizationService } from "@/server/modules/boards/board-authorization";
import { PageAuthorizationService } from "@/server/modules/pages/page-authorization";
import { CollabAuthService } from "@/server/collaboration/collab-auth";
import { authorizeWorkspaceSubscription } from "@/server/websocket/auth";
import { WorkspaceService } from "@/server/modules/workspaces/workspace.service";
import { BoardService } from "@/server/modules/boards/board.service";
import { BoardColumnService } from "@/server/modules/boards/board-column.service";
import { CardService } from "@/server/modules/boards/card.service";
import { PageService } from "@/server/modules/pages/page.service";
import { ActivityService } from "@/server/modules/activities/activity.service";
import { authService } from "@/server/modules/auth/auth.service";

describe("IDOR (Insecure Direct Object Reference) Security Audit & Regression Suite", () => {
  // User A (Attacker / Target A)
  const userA = {
    id: "usr_alice",
    name: "Alice",
    email: "alice@example.com",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  // User B (Victim / Target B)
  const userB = {
    id: "usr_bob",
    name: "Bob",
    email: "bob@example.com",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Workspaces
  const workspaceA = {
    id: "ws_alice",
    name: "Alice's Workspace",
    slug: "alice-ws",
    urlIdentifier: "alice-ws-slug",
    ownerId: userA.id,
  };
  const workspaceB = {
    id: "ws_bob",
    name: "Bob's Workspace",
    slug: "bob-ws",
    urlIdentifier: "bob-ws-slug",
    ownerId: userB.id,
  };

  // Resources in Bob's Workspace
  const boardB = {
    id: "board_bob_1",
    workspaceId: workspaceB.id,
    title: "Bob's Board",
    position: 65536,
  };
  const columnB = { id: "col_bob_1", boardId: boardB.id, title: "Bob's Column", position: 65536 };
  const cardB = {
    id: "card_bob_1",
    boardId: boardB.id,
    columnId: columnB.id,
    title: "Bob's Confidential Card",
    position: 65536,
    assigneeIds: [userB.id],
    labels: [],
  };
  const pageB = {
    id: "page_bob_1",
    workspaceId: workspaceB.id,
    title: "Bob's Secret Document",
    content: { type: "doc", content: [] },
  };

  let mockWorkspaceRepo: any;
  let mockMemberRepo: any;
  let mockBoardRepo: any;
  let mockColumnRepo: any;
  let mockCardRepo: any;
  let mockPageRepo: any;
  let mockActivityRepo: any;
  let mockPublisher: any;

  let workspaceAuth: WorkspaceAuthorizationService;
  let boardAuth: BoardAuthorizationService;
  let pageAuth: PageAuthorizationService;
  let collabAuth: CollabAuthService;

  let workspaceService: WorkspaceService;
  let boardService: BoardService;
  let columnService: BoardColumnService;
  let cardService: CardService;
  let pageService: PageService;
  let activityService: ActivityService;

  beforeEach(() => {
    mockWorkspaceRepo = {
      findById: vi.fn(async (id) =>
        id === workspaceA.id ? workspaceA : id === workspaceB.id ? workspaceB : null
      ),
      findByIdOrUrlIdentifier: vi.fn(async (id) =>
        id === workspaceA.id || id === workspaceA.urlIdentifier
          ? workspaceA
          : id === workspaceB.id || id === workspaceB.urlIdentifier
            ? workspaceB
            : null
      ),
      findByUserId: vi.fn(async (userId) => (userId === userA.id ? [workspaceA] : [workspaceB])),
      getUserWorkspaces: vi.fn(async (userId) =>
        userId === userA.id ? [workspaceA] : [workspaceB]
      ),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockMemberRepo = {
      findByWorkspaceAndUser: vi.fn(async (wsId, uId) => {
        if (wsId === workspaceA.id && uId === userA.id) {
          return { id: "mem_a", workspaceId: wsId, userId: uId, role: "OWNER" };
        }
        if (wsId === workspaceB.id && uId === userB.id) {
          return { id: "mem_b", workspaceId: wsId, userId: uId, role: "OWNER" };
        }
        return null;
      }),
      findMembersByWorkspaceId: vi.fn(async (wsId) => {
        if (wsId === workspaceB.id)
          return [{ id: "mem_b", workspaceId: wsId, userId: userB.id, role: "OWNER", user: userB }];
        return [];
      }),
    };

    mockBoardRepo = {
      findById: vi.fn(async (id) => (id === boardB.id ? boardB : null)),
      findByWorkspaceId: vi.fn(async (wsId) => (wsId === workspaceB.id ? [boardB] : [])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockColumnRepo = {
      findById: vi.fn(async (id) => (id === columnB.id ? columnB : null)),
      findByBoardId: vi.fn(async (bId) => (bId === boardB.id ? [columnB] : [])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockCardRepo = {
      findById: vi.fn(async (id) => (id === cardB.id ? cardB : null)),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      moveCard: vi.fn(),
    };

    mockPageRepo = {
      findById: vi.fn(async (id) => (id === pageB.id ? pageB : null)),
      findByWorkspaceId: vi.fn(async (wsId) => (wsId === workspaceB.id ? [pageB] : [])),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };

    mockActivityRepo = {
      findByWorkspaceId: vi.fn(async () => []),
      create: vi.fn(),
    };

    mockPublisher = {
      publish: vi.fn(),
    };

    workspaceAuth = new WorkspaceAuthorizationService(mockMemberRepo, mockWorkspaceRepo);
    boardAuth = new BoardAuthorizationService(
      mockWorkspaceRepo,
      workspaceAuth,
      mockBoardRepo,
      mockColumnRepo,
      mockCardRepo,
      mockMemberRepo
    );
    pageAuth = new PageAuthorizationService(mockWorkspaceRepo, workspaceAuth, mockPageRepo);
    collabAuth = new CollabAuthService(mockWorkspaceRepo, mockPageRepo, workspaceAuth);

    const mockUserRepo: any = { findById: vi.fn(async () => userA) };

    activityService = new ActivityService(mockActivityRepo, workspaceAuth, mockPublisher);
    workspaceService = new WorkspaceService(
      mockWorkspaceRepo,
      workspaceAuth,
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
    pageService = new PageService(mockPageRepo, pageAuth, mockPublisher, activityService);

    vi.spyOn(authService, "validateSession").mockImplementation(async (token) => {
      if (token === "token_alice") {
        return {
          user: userA,
          session: {
            id: "sess_a",
            sessionToken: token,
            userId: userA.id,
            expiresAt: new Date(Date.now() + 100000),
            createdAt: new Date(),
          },
        };
      }
      return null;
    });
  });

  describe("Workspace-Level IDOR Prevention", () => {
    it("should prevent User A from accessing Bob's workspace details", async () => {
      await expect(workspaceService.getWorkspaceById(workspaceB.id, userA.id)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should prevent User A from updating Bob's workspace", async () => {
      await expect(
        workspaceService.updateWorkspace(workspaceB.id, userA.id, { name: "Hacked WS" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from deleting Bob's workspace", async () => {
      await expect(workspaceService.deleteWorkspace(workspaceB.id, userA.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("Board-Level IDOR Prevention", () => {
    it("should prevent User A from reading Bob's board", async () => {
      await expect(boardService.getBoardById(workspaceB.id, boardB.id, userA.id)).rejects.toThrow(
        ForbiddenError
      );
    });

    it("should prevent User A from updating Bob's board", async () => {
      await expect(
        boardService.updateBoard(workspaceB.id, boardB.id, userA.id, { title: "Renamed by Alice" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from accessing Bob's board through Alice's workspace ID", async () => {
      // Bob's board id passed with Alice's workspace id
      await expect(boardService.getBoardById(workspaceA.id, boardB.id, userA.id)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("Column-Level IDOR Prevention", () => {
    it("should prevent User A from creating a column on Bob's board", async () => {
      await expect(
        columnService.createColumn(workspaceB.id, boardB.id, userA.id, { title: "Injected Column" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from updating Bob's column", async () => {
      await expect(
        columnService.updateColumn(workspaceB.id, boardB.id, columnB.id, userA.id, {
          title: "Changed",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from deleting Bob's column", async () => {
      await expect(
        columnService.deleteColumn(workspaceB.id, boardB.id, columnB.id, userA.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Card-Level IDOR Prevention", () => {
    it("should prevent User A from creating cards in Bob's workspace", async () => {
      await expect(
        cardService.createCard(workspaceB.id, boardB.id, userA.id, {
          columnId: columnB.id,
          title: "Malicious Card",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from modifying Bob's cards", async () => {
      await expect(
        cardService.updateCard(workspaceB.id, boardB.id, cardB.id, userA.id, {
          title: "Stolen Card",
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from moving Bob's cards", async () => {
      await expect(
        cardService.moveCard(workspaceB.id, boardB.id, userA.id, {
          cardId: cardB.id,
          sourceColumnId: columnB.id,
          targetColumnId: columnB.id,
          targetPosition: 1,
        })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from deleting Bob's cards", async () => {
      await expect(
        cardService.deleteCard(workspaceB.id, boardB.id, cardB.id, userA.id)
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Document-Level IDOR Prevention", () => {
    it("should prevent User A from accessing Bob's documents", async () => {
      await expect(pageService.getPageById(pageB.id, userA.id)).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from updating Bob's documents", async () => {
      await expect(
        pageService.updatePage(pageB.id, userA.id, { title: "Alice's takeover" })
      ).rejects.toThrow(ForbiddenError);
    });

    it("should prevent User A from deleting Bob's documents", async () => {
      await expect(pageService.deletePage(pageB.id, userA.id)).rejects.toThrow(ForbiddenError);
    });
  });

  describe("Activity-Level IDOR Prevention", () => {
    it("should prevent User A from reading Bob's workspace activity audit logs", async () => {
      await expect(activityService.getWorkspaceActivities(workspaceB.id, userA.id)).rejects.toThrow(
        ForbiddenError
      );
    });
  });

  describe("WebSocket & Real-Time IDOR Prevention", () => {
    it("should reject User A from subscribing to Bob's workspace WebSocket channel", async () => {
      const authResult = await authorizeWorkspaceSubscription(
        userA.id,
        workspaceB.id,
        mockWorkspaceRepo,
        mockMemberRepo
      );
      expect(authResult.authorized).toBe(false);
    });

    it("should reject User A from connecting to Bob's Hocuspocus collaborative document room", async () => {
      const roomName = `workspace:${workspaceB.id}:page:${pageB.id}`;
      const collabResult = await collabAuth.authorizeConnection("token_alice", roomName);
      expect(collabResult.authorized).toBe(false);
      if (!collabResult.authorized) {
        expect(collabResult.code).toBe(4403);
      }
    });
  });
});
