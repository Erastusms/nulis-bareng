import type { Card, Document, EntityId, Notification, User, WorkspaceMember } from "@/types/domain";

/**
 * Supported real-time workspace event types.
 * Defines the contract for future WebSockets / SSE / WebRTC real-time integration.
 */
export type RealtimeEventType =
  | "CARD_CREATED"
  | "CARD_UPDATED"
  | "CARD_MOVED"
  | "CARD_DELETED"
  | "COLUMN_MOVED"
  | "DOCUMENT_UPDATED"
  | "DOCUMENT_SAVED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "PRESENCE_UPDATED"
  | "NOTIFICATION_RECEIVED";

export interface CardMovedPayload {
  cardId: EntityId;
  boardId: EntityId;
  sourceColumnId: EntityId;
  targetColumnId: EntityId;
  sourcePosition: number;
  targetPosition: number;
  userId: EntityId;
}

export interface ColumnMovedPayload {
  columnId: EntityId;
  boardId: EntityId;
  position: number;
  userId: EntityId;
}

export interface PresencePayload {
  userId: EntityId;
  workspaceId: EntityId;
  user: Pick<User, "id" | "name" | "avatarUrl">;
  currentLocation?: {
    type: "board" | "document";
    id: EntityId;
  };
  lastActiveAt: string;
}

export type RealtimeEvent =
  | { type: "CARD_CREATED"; payload: Card; timestamp: string }
  | { type: "CARD_UPDATED"; payload: Card; timestamp: string }
  | { type: "CARD_MOVED"; payload: CardMovedPayload; timestamp: string }
  | { type: "CARD_DELETED"; payload: { cardId: EntityId; boardId: EntityId }; timestamp: string }
  | { type: "COLUMN_MOVED"; payload: ColumnMovedPayload; timestamp: string }
  | { type: "DOCUMENT_UPDATED"; payload: Partial<Document> & { id: EntityId }; timestamp: string }
  | { type: "DOCUMENT_SAVED"; payload: Document; timestamp: string }
  | { type: "MEMBER_JOINED"; payload: WorkspaceMember; timestamp: string }
  | { type: "MEMBER_LEFT"; payload: { workspaceId: EntityId; userId: EntityId }; timestamp: string }
  | { type: "PRESENCE_UPDATED"; payload: PresencePayload; timestamp: string }
  | { type: "NOTIFICATION_RECEIVED"; payload: Notification; timestamp: string };

export type RealtimeEventHandler<T extends RealtimeEvent = RealtimeEvent> = (event: T) => void;

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface IRealtimeService {
  subscribe(channel: string, handler: RealtimeEventHandler): RealtimeSubscription;
  publish(channel: string, event: RealtimeEvent): Promise<void>;
}
