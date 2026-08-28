/**
 * Core Domain Entities and Enums for the Collaborative Workspace
 */

export type EntityId = string;

export type Timestamp = string; // ISO 8601 string

export type WorkspaceRole =
  | "OWNER"
  | "ADMIN"
  | "MEMBER"
  | "VIEWER"
  | "owner"
  | "admin"
  | "member"
  | "viewer";

export interface User {
  id: EntityId;
  email: string;
  name: string;
  avatarUrl?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Workspace {
  id: EntityId;
  name: string;
  slug: string;
  urlIdentifier: string;
  description?: string | null;
  ownerId: EntityId;
  role?: WorkspaceRole;
  currentUserRole?: WorkspaceRole;
  memberCount?: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkspaceMember {
  id: EntityId;
  workspaceId: EntityId;
  userId: EntityId;
  role: WorkspaceRole;
  user?: User;
  joinedAt: Timestamp;
}

export interface WorkspaceInvitation {
  id: EntityId;
  workspaceId: EntityId;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  inviterId: EntityId;
  inviter?: User;
  expiresAt: Timestamp;
  createdAt: Timestamp;
}

export interface Board {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  description?: string | null;
  position: number;
  columns?: BoardColumn[];
  cards?: Card[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BoardColumn {
  id: EntityId;
  boardId: EntityId;
  title: string;
  position: number;
  color?: string | null;
  cards?: Card[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Card {
  id: EntityId;
  columnId: EntityId;
  boardId: EntityId;
  title: string;
  description?: string | null;
  position: number;
  dueDate?: Timestamp | null;
  assigneeIds: EntityId[];
  assignees?: User[];
  labels: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PageDocContent {
  type: string;
  content?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface Page {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  content: PageDocContent | Record<string, unknown>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PageSummary {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Document extends Page {
  parentId?: EntityId | null;
  icon?: string | null;
  coverImage?: string | null;
  authorId?: EntityId;
  isArchived?: boolean;
}

export interface Comment {
  id: EntityId;
  entityType: "card" | "document";
  entityId: EntityId;
  authorId: EntityId;
  author?: User;
  content: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Notification {
  id: EntityId;
  userId: EntityId;
  actorId: EntityId;
  actor?: User;
  type: "mention" | "assignment" | "comment" | "workspace_invite";
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Presence Types
// ---------------------------------------------------------------------------

export type PresenceStatus = "ONLINE" | "AWAY" | "OFFLINE";

export interface UserPresence {
  userId: EntityId;
  status: PresenceStatus;
  lastSeenAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Activity Types
// ---------------------------------------------------------------------------

export type ActivityType =
  | "WORKSPACE_CREATED"
  | "WORKSPACE_RENAMED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "BOARD_CREATED"
  | "BOARD_RENAMED"
  | "BOARD_DELETED"
  | "COLUMN_CREATED"
  | "COLUMN_RENAMED"
  | "COLUMN_DELETED"
  | "COLUMN_MOVED"
  | "CARD_CREATED"
  | "CARD_RENAMED"
  | "CARD_DELETED"
  | "CARD_MOVED"
  | "DOCUMENT_CREATED"
  | "DOCUMENT_RENAMED"
  | "DOCUMENT_DELETED";

export interface ActivityActor {
  id: EntityId;
  name: string;
  email?: string;
  avatarUrl?: string | null;
}

export interface ActivityEntity {
  type: string;
  id?: EntityId | null;
}

export interface Activity {
  id: EntityId;
  workspaceId: EntityId;
  actorId: EntityId;
  actor?: ActivityActor;
  type: ActivityType;
  entityType?: string | null;
  entityId?: EntityId | null;
  entity?: ActivityEntity;
  metadata?: Record<string, unknown> | null;
  createdAt: Timestamp;
}

export interface PaginatedActivities {
  items: Activity[];
  nextCursor?: string | null;
}

