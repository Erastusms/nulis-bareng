import type { QueryClient } from "@tanstack/react-query";
import { activityKeys, boardKeys, documentKeys, presenceKeys, workspaceKeys } from "@/lib/query/query-keys";
import type {
  Activity,
  Board,
  BoardColumn,
  Card,
  Page,
  PageSummary,
  PaginatedActivities,
  UserPresence,
  WorkspaceMember,
} from "@/types/domain";
import type { RealtimeDomainEvent } from "./events";


export class RealtimeCacheUpdater {
  private processedEventIds = new Set<string>();
  private entityVersions = new Map<string, number>();
  private readonly maxTrackedEvents = 1000;

  /**
   * Clears the event tracking history (useful in tests).
   */
  reset(): void {
    this.processedEventIds.clear();
    this.entityVersions.clear();
  }

  /**
   * Applies a domain event to the TanStack Query cache.
   * Returns true if the event was processed, false if it was skipped (idempotent/stale).
   */
  applyEvent(queryClient: QueryClient, event: RealtimeDomainEvent): boolean {
    // 1. Idempotency check: Skip if event was already applied
    if (this.processedEventIds.has(event.eventId)) {
      return false;
    }

    // 2. Stale event check: Skip if an event with a higher version was already processed for this entity
    const entityKey = this.getEntityKey(event);
    if (entityKey) {
      const lastVersion = this.entityVersions.get(entityKey) ?? 0;
      if (event.version < lastVersion) {
        return false;
      }
      this.entityVersions.set(entityKey, event.version);
    }

    // Mark event as processed (with LRU-like size capping)
    this.processedEventIds.add(event.eventId);
    if (this.processedEventIds.size > this.maxTrackedEvents) {
      const oldest = this.processedEventIds.values().next().value;
      if (oldest) this.processedEventIds.delete(oldest);
    }

    // 3. Dispatch targeted query cache updates
    switch (event.type) {
      case "card.created":
        this.handleCardCreated(queryClient, event);
        break;
      case "card.updated":
        this.handleCardUpdated(queryClient, event);
        break;
      case "card.deleted":
        this.handleCardDeleted(queryClient, event);
        break;
      case "card.moved":
        this.handleCardMoved(queryClient, event);
        break;
      case "column.created":
        this.handleColumnCreated(queryClient, event);
        break;
      case "column.updated":
        this.handleColumnUpdated(queryClient, event);
        break;
      case "column.deleted":
        this.handleColumnDeleted(queryClient, event);
        break;
      case "board.updated":
        this.handleBoardUpdated(queryClient, event);
        break;
      case "member.added":
        this.handleMemberAdded(queryClient, event);
        break;
      case "member.removed":
        this.handleMemberRemoved(queryClient, event);
        break;
      case "page.created":
        this.handlePageCreated(queryClient, event);
        break;
      case "page.updated":
        this.handlePageUpdated(queryClient, event);
        break;
      case "page.deleted":
        this.handlePageDeleted(queryClient, event);
        break;
      case "activity.created":
        this.handleActivityCreated(queryClient, event);
        break;
      case "presence.updated":
        this.handlePresenceUpdated(queryClient, event);
        break;
    }

    return true;
  }

  private getEntityKey(event: RealtimeDomainEvent): string | null {
    switch (event.type) {
      case "card.created":
      case "card.updated":
      case "card.deleted":
      case "card.moved":
        return `card:${event.cardId}`;
      case "column.created":
      case "column.updated":
      case "column.deleted":
        return `column:${event.columnId}`;
      case "board.updated":
        return `board:${event.boardId}`;
      case "member.added":
      case "member.removed":
        return `member:${event.memberId}`;
      case "page.created":
      case "page.updated":
      case "page.deleted":
        return `page:${event.pageId}`;
      case "activity.created":
        return `activity:${event.activity.id}`;
      case "presence.updated":
        return `presence:${event.userId}`;
    }
  }


  private handleCardCreated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "card.created" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;
      return {
        ...oldBoard,
        columns: oldBoard.columns.map((col) => {
          if (col.id !== event.columnId) return col;
          const filtered = (col.cards || []).filter((c) => c.id !== event.cardId);
          const newCards = [...filtered, event.card];
          newCards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
          return {
            ...col,
            cards: newCards,
          };
        }),
      };
    });
  }

  private handleCardUpdated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "card.updated" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;

      let targetCard: Card | undefined;
      for (const col of oldBoard.columns) {
        const found = col.cards?.find((c) => c.id === event.cardId);
        if (found) {
          targetCard = { ...found, ...event.changes };
          break;
        }
      }

      if (!targetCard) {
        return oldBoard;
      }

      const targetColId = event.changes.columnId || event.columnId || targetCard.columnId;

      return {
        ...oldBoard,
        columns: oldBoard.columns.map((col) => {
          let cards = (col.cards || []).filter((c) => c.id !== event.cardId);
          if (col.id === targetColId) {
            cards = [...cards, targetCard!];
            cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
          } else {
            cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
          }
          return {
            ...col,
            cards,
          };
        }),
      };
    });
  }

  private handleCardDeleted(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "card.deleted" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;
      return {
        ...oldBoard,
        columns: oldBoard.columns.map((col) => ({
          ...col,
          cards: col.cards?.filter((c) => c.id !== event.cardId),
        })),
      };
    });
  }

  private handleCardMoved(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "card.moved" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;

      // 1. Find the moved card from any column in oldBoard
      let movedCard: Card | undefined;
      for (const col of oldBoard.columns) {
        const found = col.cards?.find((c) => c.id === event.cardId);
        if (found) {
          movedCard = { ...found };
          break;
        }
      }

      // If card was not in cache yet, invalidate query to fetch fresh state safely
      if (!movedCard) {
        queryClient.invalidateQueries({ queryKey: boardKeys.detail(event.boardId) });
        return oldBoard;
      }

      // 2. Set authoritative columnId and position
      movedCard.columnId = event.toColumnId;
      movedCard.position = event.position;

      // 3. Remove card from all columns and place it into toColumnId
      const newColumns = oldBoard.columns.map((col) => {
        let cards = (col.cards || []).filter((c) => c.id !== event.cardId);
        if (col.id === event.toColumnId) {
          cards = [...cards, movedCard!];
          cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
        } else if (col.id === event.fromColumnId) {
          cards.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
        }
        return {
          ...col,
          cards,
        };
      });

      return {
        ...oldBoard,
        columns: newColumns,
      };
    });
  }

  private handleColumnCreated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "column.created" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard) return oldBoard;
      const existingCols = (oldBoard.columns || []).filter((c) => c.id !== event.columnId);
      const newCol: BoardColumn = {
        ...event.column,
        cards: [],
      };
      const newCols = [...existingCols, newCol];
      newCols.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
      return {
        ...oldBoard,
        columns: newCols,
      };
    });
  }

  private handleColumnUpdated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "column.updated" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;
      const updatedCols = oldBoard.columns.map((col) =>
        col.id === event.columnId ? { ...col, ...event.changes } : col
      );
      updatedCols.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id.localeCompare(b.id));
      return {
        ...oldBoard,
        columns: updatedCols,
      };
    });
  }

  private handleColumnDeleted(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "column.deleted" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard || !oldBoard.columns) return oldBoard;
      return {
        ...oldBoard,
        columns: oldBoard.columns.filter((c) => c.id !== event.columnId),
      };
    });
  }

  private handleBoardUpdated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "board.updated" }>
  ): void {
    queryClient.setQueryData<Board>(boardKeys.detail(event.boardId), (oldBoard) => {
      if (!oldBoard) return oldBoard;
      return {
        ...oldBoard,
        ...event.changes,
      };
    });

    queryClient.setQueriesData<Board[]>({ queryKey: boardKeys.allLists() }, (oldBoards) => {
      if (!oldBoards) return oldBoards;
      return oldBoards.map((b) => (b.id === event.boardId ? { ...b, ...event.changes } : b));
    });
  }

  private handleMemberAdded(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "member.added" }>
  ): void {
    queryClient.setQueriesData<WorkspaceMember[]>(
      { queryKey: workspaceKeys.details() },
      (oldMembers) => {
        if (!oldMembers || !Array.isArray(oldMembers)) return oldMembers;
        if (oldMembers.some((m) => m.id === event.memberId || m.userId === event.member.userId)) {
          return oldMembers.map((m) => (m.id === event.memberId ? event.member : m));
        }
        return [...oldMembers, event.member];
      }
    );
  }

  private handleMemberRemoved(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "member.removed" }>
  ): void {
    queryClient.setQueriesData<WorkspaceMember[]>(
      { queryKey: workspaceKeys.details() },
      (oldMembers) => {
        if (!oldMembers || !Array.isArray(oldMembers)) return oldMembers;
        return oldMembers.filter(
          (m) => m.id !== event.memberId && m.userId !== event.memberId
        );
      }
    );
  }

  private handlePageCreated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "page.created" }>
  ): void {
    // 1. Update all matching pages list queries (regardless of whether workspace is keyed by ID, slug, or urlIdentifier)
    queryClient.setQueriesData<PageSummary[]>(
      { queryKey: documentKeys.allLists() },
      (oldPages) => {
        if (!oldPages || !Array.isArray(oldPages)) return [event.page];
        if (oldPages.some((p) => p.id === event.pageId)) {
          return oldPages.map((p) => (p.id === event.pageId ? event.page : p));
        }
        return [event.page, ...oldPages];
      }
    );

    // 2. Set detail query
    queryClient.setQueryData<Page>(
      documentKeys.detail(event.pageId),
      (oldPage) => (oldPage ? { ...oldPage, title: event.page.title } : undefined)
    );

    // 3. Invalidate to guarantee synchronization across active listeners
    queryClient.invalidateQueries({ queryKey: documentKeys.allLists() });
  }

  private handlePageUpdated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "page.updated" }>
  ): void {
    // 1. Update all matching pages list queries
    queryClient.setQueriesData<PageSummary[]>(
      { queryKey: documentKeys.allLists() },
      (oldPages) => {
        if (!oldPages || !Array.isArray(oldPages)) return oldPages;
        return oldPages.map((p) =>
          p.id === event.pageId
            ? {
                ...p,
                ...(event.changes.title !== undefined && { title: event.changes.title }),
                ...(event.changes.updatedAt !== undefined && { updatedAt: event.changes.updatedAt }),
              }
            : p
        );
      }
    );

    // 2. Update the page detail query cache
    queryClient.setQueryData<Page>(
      documentKeys.detail(event.pageId),
      (oldPage) => {
        if (!oldPage) return oldPage;
        return {
          ...oldPage,
          ...event.changes,
        };
      }
    );
  }

  private handlePageDeleted(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "page.deleted" }>
  ): void {
    // 1. Remove from all matching pages list queries
    queryClient.setQueriesData<PageSummary[]>(
      { queryKey: documentKeys.allLists() },
      (oldPages) => {
        if (!oldPages || !Array.isArray(oldPages)) return oldPages;
        return oldPages.filter((p) => p.id !== event.pageId);
      }
    );

    // 2. Invalidate or remove detail cache
    queryClient.removeQueries({ queryKey: documentKeys.detail(event.pageId) });
  }

  private handleActivityCreated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "activity.created" }>
  ): void {
    // Prepend activity to infinite query or list cache for this workspace
    queryClient.setQueriesData<any>(
      { queryKey: activityKeys.lists() },
      (oldData: any) => {
        if (!oldData) return oldData;


        // Support InfiniteData structure { pages: PaginatedActivities[], pageParams: ... }
        if (oldData.pages && Array.isArray(oldData.pages)) {
          const firstPage = oldData.pages[0];
          if (!firstPage) return oldData;
          if (firstPage.items?.some((a: Activity) => a.id === event.activity.id)) {
            return oldData;
          }
          const updatedFirstPage = {
            ...firstPage,
            items: [event.activity, ...(firstPage.items || [])],
          };
          return {
            ...oldData,
            pages: [updatedFirstPage, ...oldData.pages.slice(1)],
          };
        }

        // Support direct PaginatedActivities structure { items: Activity[], nextCursor: ... }
        if (oldData.items && Array.isArray(oldData.items)) {
          if (oldData.items.some((a: Activity) => a.id === event.activity.id)) {
            return oldData;
          }
          return {
            ...oldData,
            items: [event.activity, ...oldData.items],
          };
        }

        return oldData;
      }
    );
  }

  private handlePresenceUpdated(
    queryClient: QueryClient,
    event: Extract<RealtimeDomainEvent, { type: "presence.updated" }>
  ): void {
    // 1. Update workspace presence list
    queryClient.setQueriesData<UserPresence[]>(
      { queryKey: presenceKeys.workspace(event.workspaceId) },
      (oldPresences) => {
        if (!oldPresences || !Array.isArray(oldPresences)) {
          return [
            {
              userId: event.userId,
              status: event.status,
              lastSeenAt: event.lastSeenAt,
            },
          ];
        }

        const exists = oldPresences.some((p) => p.userId === event.userId);
        if (!exists) {
          return [
            ...oldPresences,
            {
              userId: event.userId,
              status: event.status,
              lastSeenAt: event.lastSeenAt,
            },
          ];
        }

        return oldPresences.map((p) =>
          p.userId === event.userId
            ? {
                ...p,
                status: event.status,
                lastSeenAt: event.lastSeenAt,
              }
            : p
        );
      }
    );

    // 2. Update individual user presence cache
    queryClient.setQueryData<UserPresence>(
      presenceKeys.user(event.userId),
      (oldPresence) => ({
        userId: event.userId,
        status: event.status,
        lastSeenAt: event.lastSeenAt,
        ...(oldPresence && { ...oldPresence, status: event.status, lastSeenAt: event.lastSeenAt }),
      })
    );
  }

  /**
   * Sets initial batch presence state received from server.
   */
  setWorkspacePresenceState(
    queryClient: QueryClient,
    workspaceId: string,
    presenceList: UserPresence[]
  ): void {
    queryClient.setQueryData<UserPresence[]>(
      presenceKeys.workspace(workspaceId),
      presenceList
    );

    for (const p of presenceList) {
      queryClient.setQueryData<UserPresence>(presenceKeys.user(p.userId), p);
    }
  }
}

export const realtimeCacheUpdater = new RealtimeCacheUpdater();


