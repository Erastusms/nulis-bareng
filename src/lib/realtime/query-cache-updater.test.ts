import { describe, it, expect, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { activityKeys, boardKeys, documentKeys, presenceKeys, workspaceKeys } from "@/lib/query/query-keys";
import type { Activity, Board, Page, PageSummary, PaginatedActivities, UserPresence, WorkspaceMember } from "@/types/domain";
import { RealtimeCacheUpdater } from "./query-cache-updater";
import type {
  ActivityCreatedEvent,
  BoardUpdatedEvent,
  CardCreatedEvent,
  CardDeletedEvent,
  CardMovedEvent,
  CardUpdatedEvent,
  ColumnCreatedEvent,
  ColumnDeletedEvent,
  ColumnUpdatedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  PageCreatedEvent,
  PageDeletedEvent,
  PageUpdatedEvent,
  PresenceUpdatedEvent,
} from "./events";



describe("RealtimeCacheUpdater", () => {
  let queryClient: QueryClient;
  let cacheUpdater: RealtimeCacheUpdater;

  const initialBoard: Board = {
    id: "board_1",
    workspaceId: "ws_1",
    title: "Project Alpha",
    description: "Initial description",
    position: 0,
    columns: [
      {
        id: "col_1",
        boardId: "board_1",
        title: "To Do",
        position: 0,
        color: null,
        cards: [
          {
            id: "card_1",
            boardId: "board_1",
            columnId: "col_1",
            title: "Task 1",
            description: null,
            position: 0,
            dueDate: null,
            labels: [],
            assigneeIds: [],
            createdAt: "2026-08-25T00:00:00Z",
            updatedAt: "2026-08-25T00:00:00Z",
          },
        ],
        createdAt: "2026-08-25T00:00:00Z",
        updatedAt: "2026-08-25T00:00:00Z",
      },
      {
        id: "col_2",
        boardId: "board_1",
        title: "Done",
        position: 1,
        color: null,
        cards: [],
        createdAt: "2026-08-25T00:00:00Z",
        updatedAt: "2026-08-25T00:00:00Z",
      },
    ],
    createdAt: "2026-08-25T00:00:00Z",
    updatedAt: "2026-08-25T00:00:00Z",
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    cacheUpdater = new RealtimeCacheUpdater();
    queryClient.setQueryData(boardKeys.detail("board_1"), initialBoard);
  });

  it("should handle card.created event by appending card to target column", () => {
    const event: CardCreatedEvent = {
      eventId: "evt_c1",
      type: "card.created",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_2",
      card: {
        id: "card_2",
        boardId: "board_1",
        columnId: "col_1",
        title: "Task 2",
        description: "New task description",
        position: 1,
        dueDate: null,
        labels: ["feature"],
        assigneeIds: [],
        createdAt: "2026-08-25T01:00:00Z",
        updatedAt: "2026-08-25T01:00:00Z",
      },
      version: 100,
      timestamp: "2026-08-25T01:00:00Z",
    };

    const applied = cacheUpdater.applyEvent(queryClient, event);
    expect(applied).toBe(true);

    const updated = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    const col1 = updated?.columns?.find((c) => c.id === "col_1");
    expect(col1?.cards?.length).toBe(2);
    expect(col1?.cards?.[1].title).toBe("Task 2");
  });

  it("should handle card.updated event by updating card fields", () => {
    const event: CardUpdatedEvent = {
      eventId: "evt_c_up",
      type: "card.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      changes: {
        title: "Task 1 Renamed",
        description: "Updated description",
      },
      version: 101,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, event);

    const updated = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    const card = updated?.columns?.[0].cards?.[0];
    expect(card?.title).toBe("Task 1 Renamed");
    expect(card?.description).toBe("Updated description");
  });

  it("should handle card.deleted event by removing card from column", () => {
    const event: CardDeletedEvent = {
      eventId: "evt_c_del",
      type: "card.deleted",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      version: 102,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, event);

    const updated = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    const col1 = updated?.columns?.find((c) => c.id === "col_1");
    expect(col1?.cards?.length).toBe(0);
  });

  it("should handle card.moved event across columns", () => {
    const event: CardMovedEvent = {
      eventId: "evt_c_mv",
      type: "card.moved",
      workspaceId: "ws_1",
      boardId: "board_1",
      cardId: "card_1",
      fromColumnId: "col_1",
      toColumnId: "col_2",
      position: 0,
      version: 103,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, event);

    const updated = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    const col1 = updated?.columns?.find((c) => c.id === "col_1");
    const col2 = updated?.columns?.find((c) => c.id === "col_2");

    expect(col1?.cards?.length).toBe(0);
    expect(col2?.cards?.length).toBe(1);
    expect(col2?.cards?.[0].id).toBe("card_1");
    expect(col2?.cards?.[0].columnId).toBe("col_2");
  });

  it("should maintain authoritative position ordering when cards are moved", () => {
    // Add multiple cards to col_1
    const boardWithCards: Board = {
      ...initialBoard,
      columns: [
        {
          id: "col_1",
          boardId: "board_1",
          title: "To Do",
          position: 65536,
          cards: [
            {
              id: "card_a",
              columnId: "col_1",
              boardId: "board_1",
              title: "Card A",
              position: 65536,
              labels: [],
              assigneeIds: [],
              createdAt: "2026-08-25T00:00:00Z",
              updatedAt: "2026-08-25T00:00:00Z",
            },
            {
              id: "card_b",
              columnId: "col_1",
              boardId: "board_1",
              title: "Card B",
              position: 131072,
              labels: [],
              assigneeIds: [],
              createdAt: "2026-08-25T00:00:00Z",
              updatedAt: "2026-08-25T00:00:00Z",
            },
            {
              id: "card_c",
              columnId: "col_1",
              boardId: "board_1",
              title: "Card C",
              position: 196608,
              labels: [],
              assigneeIds: [],
              createdAt: "2026-08-25T00:00:00Z",
              updatedAt: "2026-08-25T00:00:00Z",
            },
          ],
          createdAt: "2026-08-25T00:00:00Z",
          updatedAt: "2026-08-25T00:00:00Z",
        },
        {
          id: "col_2",
          boardId: "board_1",
          title: "In Progress",
          position: 131072,
          cards: [],
          createdAt: "2026-08-25T00:00:00Z",
          updatedAt: "2026-08-25T00:00:00Z",
        },
      ],
    };

    queryClient.setQueryData<Board>(boardKeys.detail("board_1"), boardWithCards);

    // Move Card C to position between Card A and Card B (e.g. position 98304)
    const moveEvent: CardMovedEvent = {
      eventId: "evt_move_between",
      type: "card.moved",
      workspaceId: "ws_1",
      boardId: "board_1",
      cardId: "card_c",
      fromColumnId: "col_1",
      toColumnId: "col_1",
      position: 98304,
      version: 110,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, moveEvent);

    const updated = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    const col1Cards = updated?.columns?.[0].cards || [];

    expect(col1Cards.length).toBe(3);
    expect(col1Cards[0].id).toBe("card_a"); // position: 65536
    expect(col1Cards[1].id).toBe("card_c"); // position: 98304
    expect(col1Cards[2].id).toBe("card_b"); // position: 131072
  });

  it("should handle column.created, column.updated, and column.deleted events", () => {
    // Column Created
    const createColEvent: ColumnCreatedEvent = {
      eventId: "evt_col_cr",
      type: "column.created",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_3",
      column: {
        id: "col_3",
        boardId: "board_1",
        title: "In Review",
        position: 2,
        color: "#F59E0B",
        createdAt: "2026-08-25T01:00:00Z",
        updatedAt: "2026-08-25T01:00:00Z",
      },
      version: 104,
      timestamp: "2026-08-25T01:00:00Z",
    };
    cacheUpdater.applyEvent(queryClient, createColEvent);

    let board = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    expect(board?.columns?.length).toBe(3);
    expect(board?.columns?.find((c) => c.id === "col_3")?.title).toBe("In Review");

    // Column Updated
    const updateColEvent: ColumnUpdatedEvent = {
      eventId: "evt_col_up",
      type: "column.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_3",
      changes: { title: "QA Testing" },
      version: 105,
      timestamp: "2026-08-25T01:05:00Z",
    };
    cacheUpdater.applyEvent(queryClient, updateColEvent);

    board = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    expect(board?.columns?.find((c) => c.id === "col_3")?.title).toBe("QA Testing");

    // Column Deleted
    const deleteColEvent: ColumnDeletedEvent = {
      eventId: "evt_col_del",
      type: "column.deleted",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_3",
      version: 106,
      timestamp: "2026-08-25T01:10:00Z",
    };
    cacheUpdater.applyEvent(queryClient, deleteColEvent);

    board = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    expect(board?.columns?.length).toBe(2);
    expect(board?.columns?.find((c) => c.id === "col_3")).toBeUndefined();
  });

  it("should handle board.updated event", () => {
    queryClient.setQueryData<Board[]>(boardKeys.lists("ws_1"), [initialBoard]);

    const event: BoardUpdatedEvent = {
      eventId: "evt_b_up",
      type: "board.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      changes: {
        title: "Sprint 20 Board",
        description: "New Board Description",
      },
      version: 107,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, event);

    const board = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    expect(board?.title).toBe("Sprint 20 Board");
    expect(board?.description).toBe("New Board Description");

    const boardList = queryClient.getQueryData<Board[]>(boardKeys.lists("ws_1"));
    expect(boardList?.[0].title).toBe("Sprint 20 Board");
  });

  it("should handle member.added and member.removed events", () => {
    const existingMember: WorkspaceMember = {
      id: "mem_1",
      workspaceId: "ws_1",
      userId: "usr_1",
      role: "OWNER",
      joinedAt: "2026-08-25T00:00:00Z",
    };
    queryClient.setQueryData<WorkspaceMember[]>(workspaceKeys.members("ws_1"), [existingMember]);

    const newMember: WorkspaceMember = {
      id: "mem_2",
      workspaceId: "ws_1",
      userId: "usr_2",
      role: "MEMBER",
      user: {
        id: "usr_2",
        email: "usr2@example.com",
        name: "User Two",
        avatarUrl: null,
        createdAt: "2026-08-25T00:00:00Z",
        updatedAt: "2026-08-25T00:00:00Z",
      },
      joinedAt: "2026-08-25T01:00:00Z",
    };

    const addEvent: MemberAddedEvent = {
      eventId: "evt_m_add",
      type: "member.added",
      workspaceId: "ws_1",
      memberId: "mem_2",
      member: newMember,
      version: 108,
      timestamp: "2026-08-25T01:00:00Z",
    };

    cacheUpdater.applyEvent(queryClient, addEvent);

    let members = queryClient.getQueryData<WorkspaceMember[]>(workspaceKeys.members("ws_1"));
    expect(members?.length).toBe(2);
    expect(members?.find((m) => m.id === "mem_2")?.role).toBe("MEMBER");

    const removeEvent: MemberRemovedEvent = {
      eventId: "evt_m_rem",
      type: "member.removed",
      workspaceId: "ws_1",
      memberId: "mem_2",
      version: 109,
      timestamp: "2026-08-25T01:05:00Z",
    };

    cacheUpdater.applyEvent(queryClient, removeEvent);

    members = queryClient.getQueryData<WorkspaceMember[]>(workspaceKeys.members("ws_1"));
    expect(members?.length).toBe(1);
    expect(members?.find((m) => m.id === "mem_2")).toBeUndefined();
  });

  it("should be idempotent and ignore duplicate event IDs", () => {
    const event: CardUpdatedEvent = {
      eventId: "evt_dup",
      type: "card.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      changes: { title: "Title 1" },
      version: 200,
      timestamp: "2026-08-25T01:00:00Z",
    };

    const first = cacheUpdater.applyEvent(queryClient, event);
    expect(first).toBe(true);

    const second = cacheUpdater.applyEvent(queryClient, event);
    expect(second).toBe(false);
  });

  it("should ignore stale events with older versions", () => {
    const newerEvent: CardUpdatedEvent = {
      eventId: "evt_newer",
      type: "card.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      changes: { title: "Newer Title" },
      version: 300,
      timestamp: "2026-08-25T01:10:00Z",
    };

    const olderEvent: CardUpdatedEvent = {
      eventId: "evt_older",
      type: "card.updated",
      workspaceId: "ws_1",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      changes: { title: "Older Title" },
      version: 250,
      timestamp: "2026-08-25T01:05:00Z",
    };

    cacheUpdater.applyEvent(queryClient, newerEvent);
    const staleResult = cacheUpdater.applyEvent(queryClient, olderEvent);

    expect(staleResult).toBe(false);
    const board = queryClient.getQueryData<Board>(boardKeys.detail("board_1"));
    expect(board?.columns?.[0].cards?.[0].title).toBe("Newer Title");
  });

  describe("Page Domain Events", () => {
    const initialPage: Page = {
      id: "page_1",
      workspaceId: "ws_1",
      title: "Initial Page",
      content: { type: "doc", content: [] },
      createdAt: "2026-08-28T00:00:00Z",
      updatedAt: "2026-08-28T00:00:00Z",
    };

    const initialSummary: PageSummary = {
      id: "page_1",
      workspaceId: "ws_1",
      title: "Initial Page",
      createdAt: "2026-08-28T00:00:00Z",
      updatedAt: "2026-08-28T00:00:00Z",
    };

    it("should handle page.created event by adding to workspace page list", () => {
      queryClient.setQueryData<PageSummary[]>(documentKeys.lists("ws_1"), [initialSummary]);

      const newSummary: PageSummary = {
        id: "page_2",
        workspaceId: "ws_1",
        title: "Second Page",
        createdAt: "2026-08-28T01:00:00Z",
        updatedAt: "2026-08-28T01:00:00Z",
      };

      const event: PageCreatedEvent = {
        eventId: "evt_page_create",
        type: "page.created",
        workspaceId: "ws_1",
        pageId: "page_2",
        page: newSummary,
        version: 1,
        timestamp: "2026-08-28T01:00:00Z",
      };

      cacheUpdater.applyEvent(queryClient, event);

      const pages = queryClient.getQueryData<PageSummary[]>(documentKeys.lists("ws_1"));
      expect(pages).toHaveLength(2);
      expect(pages?.[0].id).toBe("page_2");
    });

    it("should handle page.created event when list query is keyed by workspace slug/urlIdentifier", () => {
      queryClient.setQueryData<PageSummary[]>(documentKeys.lists("my-workspace-slug"), [initialSummary]);

      const newSummary: PageSummary = {
        id: "page_3",
        workspaceId: "ws_canonical_id",
        title: "Third Page",
        createdAt: "2026-08-28T01:00:00Z",
        updatedAt: "2026-08-28T01:00:00Z",
      };

      const event: PageCreatedEvent = {
        eventId: "evt_page_create_slug",
        type: "page.created",
        workspaceId: "ws_canonical_id",
        pageId: "page_3",
        page: newSummary,
        version: 1,
        timestamp: "2026-08-28T01:00:00Z",
      };

      cacheUpdater.applyEvent(queryClient, event);

      const pages = queryClient.getQueryData<PageSummary[]>(documentKeys.lists("my-workspace-slug"));
      expect(pages).toHaveLength(2);
      expect(pages?.[0].id).toBe("page_3");
    });

    it("should handle page.updated event in both list and detail query cache", () => {
      queryClient.setQueryData<PageSummary[]>(documentKeys.lists("ws_1"), [initialSummary]);
      queryClient.setQueryData<Page>(documentKeys.detail("page_1"), initialPage);

      const event: PageUpdatedEvent = {
        eventId: "evt_page_update",
        type: "page.updated",
        workspaceId: "ws_1",
        pageId: "page_1",
        changes: {
          title: "Renamed Page",
          updatedAt: "2026-08-28T02:00:00Z",
        },
        version: 2,
        timestamp: "2026-08-28T02:00:00Z",
      };

      cacheUpdater.applyEvent(queryClient, event);

      const pages = queryClient.getQueryData<PageSummary[]>(documentKeys.lists("ws_1"));
      expect(pages?.[0].title).toBe("Renamed Page");

      const pageDetail = queryClient.getQueryData<Page>(documentKeys.detail("page_1"));
      expect(pageDetail?.title).toBe("Renamed Page");
      expect(pageDetail?.updatedAt).toBe("2026-08-28T02:00:00Z");
    });

    it("should handle page.deleted event by removing from list and invalidating detail cache", () => {
      queryClient.setQueryData<PageSummary[]>(documentKeys.lists("ws_1"), [initialSummary]);
      queryClient.setQueryData<Page>(documentKeys.detail("page_1"), initialPage);

      const event: PageDeletedEvent = {
        eventId: "evt_page_del",
        type: "page.deleted",
        workspaceId: "ws_1",
        pageId: "page_1",
        version: 3,
        timestamp: "2026-08-28T03:00:00Z",
      };

      cacheUpdater.applyEvent(queryClient, event);

      const pages = queryClient.getQueryData<PageSummary[]>(documentKeys.lists("ws_1"));
      expect(pages).toHaveLength(0);

      const pageDetail = queryClient.getQueryData<Page>(documentKeys.detail("page_1"));
      expect(pageDetail).toBeUndefined();
    });
  });

  describe("Activity Events", () => {
    it("should prepend activity to infinite query cache upon activity.created event", () => {
      const initialActivity: Activity = {
        id: "act_1",
        workspaceId: "ws_1",
        actorId: "u_1",
        type: "WORKSPACE_CREATED",
        createdAt: "2026-08-28T01:00:00Z",
      };

      queryClient.setQueryData(activityKeys.list("ws_1", { limit: 20 }), {
        pages: [
          {
            items: [initialActivity],
            nextCursor: null,
          },
        ],
        pageParams: [undefined],
      });

      const newActivity: Activity = {
        id: "act_2",
        workspaceId: "ws_1",
        actorId: "u_2",
        type: "CARD_CREATED",
        entityType: "CARD",
        entityId: "card_10",
        metadata: { cardTitle: "New Feature" },
        createdAt: "2026-08-28T02:00:00Z",
      };

      const event: ActivityCreatedEvent = {
        eventId: "evt_act_2",
        type: "activity.created",
        workspaceId: "ws_1",
        activity: newActivity,
        version: 1,
        timestamp: "2026-08-28T02:00:00Z",
      };

      const applied = cacheUpdater.applyEvent(queryClient, event);
      expect(applied).toBe(true);

      const cached = queryClient.getQueryData<any>(activityKeys.list("ws_1", { limit: 20 }));
      expect(cached.pages[0].items).toHaveLength(2);
      expect(cached.pages[0].items[0].id).toBe("act_2");
      expect(cached.pages[0].items[1].id).toBe("act_1");
    });
  });

  describe("Presence Events", () => {
    it("should update workspace presence and individual user presence upon presence.updated event", () => {
      const initialPresence: UserPresence[] = [
        { userId: "u_1", status: "ONLINE", lastSeenAt: "2026-08-28T01:00:00Z" },
        { userId: "u_2", status: "ONLINE", lastSeenAt: "2026-08-28T01:00:00Z" },
      ];

      queryClient.setQueryData(presenceKeys.workspace("ws_1"), initialPresence);

      const event: PresenceUpdatedEvent = {
        eventId: "evt_pres_1",
        type: "presence.updated",
        workspaceId: "ws_1",
        userId: "u_2",
        status: "AWAY",
        lastSeenAt: "2026-08-28T02:00:00Z",
        version: 1,
        timestamp: "2026-08-28T02:00:00Z",
      };

      const applied = cacheUpdater.applyEvent(queryClient, event);
      expect(applied).toBe(true);

      const presences = queryClient.getQueryData<UserPresence[]>(presenceKeys.workspace("ws_1"));
      expect(presences).toHaveLength(2);
      expect(presences?.find((p) => p.userId === "u_2")?.status).toBe("AWAY");
      expect(presences?.find((p) => p.userId === "u_1")?.status).toBe("ONLINE");

      const userPresence = queryClient.getQueryData<UserPresence>(presenceKeys.user("u_2"));
      expect(userPresence?.status).toBe("AWAY");
    });

    it("should set batch initial workspace presence state", () => {
      const initialPresence: UserPresence[] = [
        { userId: "u_1", status: "ONLINE", lastSeenAt: "2026-08-28T01:00:00Z" },
        { userId: "u_2", status: "AWAY", lastSeenAt: "2026-08-28T01:00:00Z" },
      ];

      cacheUpdater.setWorkspacePresenceState(queryClient, "ws_1", initialPresence);

      const presences = queryClient.getQueryData<UserPresence[]>(presenceKeys.workspace("ws_1"));
      expect(presences).toEqual(initialPresence);

      expect(queryClient.getQueryData(presenceKeys.user("u_1"))).toEqual(initialPresence[0]);
      expect(queryClient.getQueryData(presenceKeys.user("u_2"))).toEqual(initialPresence[1]);
    });
  });
});


