/**
 * Unified, hierarchical Query Key Factories.
 * Prevents magic strings and guarantees consistent cache invalidation.
 */

export const workspaceKeys = {
  all: ["workspaces"] as const,
  lists: () => [...workspaceKeys.all, "list"] as const,
  list: (filters?: Record<string, unknown>) => [...workspaceKeys.lists(), filters] as const,
  details: () => [...workspaceKeys.all, "detail"] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
  members: (workspaceId: string) => [...workspaceKeys.detail(workspaceId), "members"] as const,
};

export const boardKeys = {
  all: ["boards"] as const,
  allLists: () => [...boardKeys.all, "list"] as const,
  lists: (workspaceId?: string) =>
    workspaceId
      ? ([...boardKeys.all, "list", workspaceId] as const)
      : ([...boardKeys.all, "list"] as const),
  details: () => [...boardKeys.all, "detail"] as const,
  detail: (id: string) => [...boardKeys.details(), id] as const,
  columns: (boardId: string) => [...boardKeys.detail(boardId), "columns"] as const,
  cards: (boardId: string) => [...boardKeys.detail(boardId), "cards"] as const,
  card: (boardId: string, cardId: string) => [...boardKeys.cards(boardId), cardId] as const,
};

export const documentKeys = {
  all: ["documents"] as const,
  allLists: () => [...documentKeys.all, "list"] as const,
  lists: (workspaceId?: string) =>
    workspaceId
      ? ([...documentKeys.all, "list", workspaceId] as const)
      : ([...documentKeys.all, "list"] as const),
  details: () => [...documentKeys.all, "detail"] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
};

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (filters?: { unreadOnly?: boolean }) => [...notificationKeys.all, "list", filters] as const,
  unreadCount: () => [...notificationKeys.all, "unread-count"] as const,
};

export const userKeys = {
  all: ["users"] as const,
  current: () => [...userKeys.all, "current"] as const,
  profile: (id: string) => [...userKeys.all, "profile", id] as const,
};

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
  user: () => userKeys.current(),
};
