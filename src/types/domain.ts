/**
 * Core Domain Entities and Enums for the Collaborative Workspace
 */

export type EntityId = string;

export type Timestamp = string; // ISO 8601 string

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

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
  description?: string | null;
  ownerId: EntityId;
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

export interface Board {
  id: EntityId;
  workspaceId: EntityId;
  title: string;
  description?: string | null;
  position: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface BoardColumn {
  id: EntityId;
  boardId: EntityId;
  title: string;
  position: number;
  color?: string | null;
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
  labels: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Document {
  id: EntityId;
  workspaceId: EntityId;
  parentId?: EntityId | null; // For hierarchical documents
  title: string;
  content: string; // Markdown or rich text JSON
  icon?: string | null;
  coverImage?: string | null;
  authorId: EntityId;
  isArchived: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
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
