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
  lists: (workspaceId?: string) => [...boardKeys.all, "list", workspaceId] as const,
  details: () => [...boardKeys.all, "detail"] as const,
  detail: (id: string) => [...boardKeys.details(), id] as const,
  columns: (boardId: string) => [...boardKeys.detail(boardId), "columns"] as const,
  cards: (boardId: string) => [...boardKeys.detail(boardId), "cards"] as const,
  card: (boardId: string, cardId: string) => [...boardKeys.cards(boardId), cardId] as const,
};

export const documentKeys = {
  all: ["documents"] as const,
  lists: (workspaceId?: string) => [...documentKeys.all, "list", workspaceId] as const,
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
