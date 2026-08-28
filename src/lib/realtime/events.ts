import { z } from "zod";
import type { Board, BoardColumn, Card, Page, PageSummary, WorkspaceMember } from "@/types/domain";


/**
 * Generates a unique event identifier.
 */
export function createEventId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generates a monotonically increasing version timestamp (in milliseconds).
 */
export function createVersion(): number {
  return Date.now();
}

/**
 * Base properties required on every real-time domain event.
 */
export interface BaseRealtimeEvent {
  eventId: string;
  type: string;
  workspaceId: string;
  version: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Card Domain Events
// ---------------------------------------------------------------------------

export interface CardCreatedEvent extends BaseRealtimeEvent {
  type: "card.created";
  boardId: string;
  columnId: string;
  cardId: string;
  card: Card;
}

export interface CardUpdatedEvent extends BaseRealtimeEvent {
  type: "card.updated";
  boardId: string;
  columnId: string;
  cardId: string;
  changes: Partial<
    Pick<
      Card,
      | "title"
      | "description"
      | "columnId"
      | "position"
      | "dueDate"
      | "labels"
      | "assigneeIds"
      | "assignees"
    >
  >;
}

export interface CardDeletedEvent extends BaseRealtimeEvent {
  type: "card.deleted";
  boardId: string;
  columnId: string;
  cardId: string;
}

export interface CardMovedEvent extends BaseRealtimeEvent {
  type: "card.moved";
  boardId: string;
  cardId: string;
  fromColumnId: string;
  toColumnId: string;
  position: number;
}

// ---------------------------------------------------------------------------
// Column Domain Events
// ---------------------------------------------------------------------------

export interface ColumnCreatedEvent extends BaseRealtimeEvent {
  type: "column.created";
  boardId: string;
  columnId: string;
  column: Omit<BoardColumn, "cards">;
}

export interface ColumnUpdatedEvent extends BaseRealtimeEvent {
  type: "column.updated";
  boardId: string;
  columnId: string;
  changes: Partial<Pick<BoardColumn, "title" | "color" | "position">>;
}

export interface ColumnDeletedEvent extends BaseRealtimeEvent {
  type: "column.deleted";
  boardId: string;
  columnId: string;
}

// ---------------------------------------------------------------------------
// Board Domain Events
// ---------------------------------------------------------------------------

export interface BoardUpdatedEvent extends BaseRealtimeEvent {
  type: "board.updated";
  boardId: string;
  changes: Partial<Pick<Board, "title" | "description" | "position">>;
}

// ---------------------------------------------------------------------------
// Workspace Member Domain Events
// ---------------------------------------------------------------------------

export interface MemberAddedEvent extends BaseRealtimeEvent {
  type: "member.added";
  memberId: string;
  member: WorkspaceMember;
}

export interface MemberRemovedEvent extends BaseRealtimeEvent {
  type: "member.removed";
  memberId: string;
}

// ---------------------------------------------------------------------------
// Page Domain Events
// ---------------------------------------------------------------------------

export interface PageCreatedEvent extends BaseRealtimeEvent {
  type: "page.created";
  pageId: string;
  page: PageSummary;
}

export interface PageUpdatedEvent extends BaseRealtimeEvent {
  type: "page.updated";
  pageId: string;
  changes: Partial<Pick<Page, "title" | "content" | "updatedAt">>;
}

export interface PageDeletedEvent extends BaseRealtimeEvent {
  type: "page.deleted";
  pageId: string;
}

/**
 * Discriminated union of all supported domain events.
 */
export type RealtimeDomainEvent =
  | CardCreatedEvent
  | CardUpdatedEvent
  | CardDeletedEvent
  | CardMovedEvent
  | ColumnCreatedEvent
  | ColumnUpdatedEvent
  | ColumnDeletedEvent
  | BoardUpdatedEvent
  | MemberAddedEvent
  | MemberRemovedEvent
  | PageCreatedEvent
  | PageUpdatedEvent
  | PageDeletedEvent;


export type RealtimeDomainEventType = RealtimeDomainEvent["type"];

// ---------------------------------------------------------------------------
// Client -> Server Messages & Validation Schemas
// ---------------------------------------------------------------------------

export const clientSubscribeSchema = z.object({
  type: z.literal("subscribe"),
  workspaceId: z.string().min(1, "workspaceId is required"),
});

export const clientUnsubscribeSchema = z.object({
  type: z.literal("unsubscribe"),
  workspaceId: z.string().min(1, "workspaceId is required"),
});

export const clientPingSchema = z.object({
  type: z.literal("ping"),
});

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientSubscribeSchema,
  clientUnsubscribeSchema,
  clientPingSchema,
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientSubscribeMessage = z.infer<typeof clientSubscribeSchema>;
export type ClientUnsubscribeMessage = z.infer<typeof clientUnsubscribeSchema>;
export type ClientPingMessage = z.infer<typeof clientPingSchema>;

// ---------------------------------------------------------------------------
// Server -> Client Control Messages
// ---------------------------------------------------------------------------

export interface SubscribedMessage {
  type: "subscribed";
  workspaceId: string;
}

export interface UnsubscribedMessage {
  type: "unsubscribed";
  workspaceId: string;
}

export interface ErrorMessage {
  type: "error";
  code: string;
  message: string;
  workspaceId?: string;
}

export interface PongMessage {
  type: "pong";
}

/**
 * Union of all possible messages received by a WebSocket client.
 */
export type RealtimeServerMessage =
  | RealtimeDomainEvent
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | PongMessage;

export type RealtimeEventHandler<T extends RealtimeDomainEvent = RealtimeDomainEvent> = (
  event: T
) => void;

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

export interface IRealtimeService {
  subscribe(channel: string, handler: RealtimeEventHandler): RealtimeSubscription;
  publish(channel: string, event: RealtimeDomainEvent): Promise<void>;
}
