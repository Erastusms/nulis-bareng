import type { User, WorkspaceRole } from "@/types/domain";

/**
 * Internal persistence representation of User containing the password hash.
 */
export interface UserRecord {
  id: string;
  name: string;
  email: string;
  emailVerified: Date | null;
  passwordHash: string;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserData {
  name: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string | null;
}

export interface SessionRecord {
  id: string;
  sessionToken: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
  user?: UserRecord;
}

export interface CreateSessionData {
  sessionToken: string;
  userId: string;
  expiresAt: Date;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  urlIdentifier: string;
  description: string | null;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;
  role?: WorkspaceRole;
  memberCount?: number;
}

export interface CreateWorkspaceData {
  name: string;
  slug: string;
  urlIdentifier: string;
  description?: string | null;
  ownerId: string;
}

export interface UpdateWorkspaceData {
  name?: string;
  slug?: string;
  urlIdentifier?: string;
  description?: string | null;
}

export interface WorkspaceMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMemberWithUserRecord extends WorkspaceMemberRecord {
  user: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    createdAt: Date;
  };
}

export interface CreateWorkspaceMemberData {
  workspaceId: string;
  userId: string;
  role?: WorkspaceRole;
}

export interface WorkspaceInvitationRecord {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED";
  inviterId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  inviter?: {
    id: string;
    name: string;
    email: string;
  };
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateWorkspaceInvitationData {
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  inviterId: string;
  expiresAt: Date;
}

// Kanban Core Domain Records & DTOs

export interface BoardRecord {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  position: number;
  createdAt: Date;
  updatedAt: Date;
  columns?: BoardColumnRecord[];
  cards?: CardRecord[];
}

export interface CreateBoardData {
  workspaceId: string;
  title: string;
  description?: string | null;
  position?: number;
}

export interface UpdateBoardData {
  title?: string;
  description?: string | null;
  position?: number;
}

export interface BoardColumnRecord {
  id: string;
  boardId: string;
  title: string;
  position: number;
  color: string | null;
  createdAt: Date;
  updatedAt: Date;
  cards?: CardRecord[];
}

export interface CreateBoardColumnData {
  boardId: string;
  title: string;
  position?: number;
  color?: string | null;
}

export interface UpdateBoardColumnData {
  title?: string;
  position?: number;
  color?: string | null;
}

export interface MoveColumnData {
  columnId: string;
  boardId: string;
  targetPosition: number;
}

export interface CardRecord {
  id: string;
  columnId: string;
  boardId: string;
  title: string;
  description: string | null;
  position: number;
  dueDate: Date | null;
  labels: string[];
  assigneeIds: string[];
  assignees?: User[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCardData {
  columnId: string;
  boardId: string;
  title: string;
  description?: string | null;
  position?: number;
  dueDate?: Date | null;
  labels?: string[];
  assigneeIds?: string[];
}

export interface UpdateCardData {
  title?: string;
  description?: string | null;
  columnId?: string;
  position?: number;
  dueDate?: Date | null;
  labels?: string[];
  assigneeIds?: string[];
}

export interface MoveCardData {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  targetPosition: number;
}

/**
 * Generic Repository Interface to isolate database persistence from domain logic.
 */
export interface IRepository<T, ID = string> {
  findById(id: ID): Promise<T | null>;
  findMany(filter?: Partial<T>): Promise<T[]>;
  create(data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T>;
  delete(id: ID): Promise<boolean>;
}

export interface IUserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmail(email: string): Promise<UserRecord | null>;
  create(data: CreateUserData): Promise<UserRecord>;
  update(id: string, data: Partial<CreateUserData>): Promise<UserRecord>;
  delete(id: string): Promise<boolean>;
}

export interface ISessionRepository {
  create(data: CreateSessionData): Promise<SessionRecord>;
  findByToken(sessionToken: string): Promise<SessionRecord | null>;
  deleteByToken(sessionToken: string): Promise<boolean>;
  deleteByUserId(userId: string): Promise<number>;
  deleteExpired(): Promise<number>;
}

export interface IWorkspaceRepository {
  findById(id: string): Promise<WorkspaceRecord | null>;
  findBySlug(slug: string): Promise<WorkspaceRecord | null>;
  findByUrlIdentifier(urlIdentifier: string): Promise<WorkspaceRecord | null>;
  findByIdOrUrlIdentifier(identifier: string): Promise<WorkspaceRecord | null>;
  findByUserId(userId: string): Promise<(WorkspaceRecord & { role: WorkspaceRole })[]>;
  createWithOwner(data: CreateWorkspaceData): Promise<WorkspaceRecord>;
  update(id: string, data: UpdateWorkspaceData): Promise<WorkspaceRecord>;
  delete(id: string): Promise<boolean>;
}

export interface IWorkspaceMemberRepository {
  findByWorkspaceAndUser(workspaceId: string, userId: string): Promise<WorkspaceMemberRecord | null>;
  findMembersByWorkspaceId(workspaceId: string): Promise<WorkspaceMemberWithUserRecord[]>;
  create(data: CreateWorkspaceMemberData): Promise<WorkspaceMemberRecord>;
  updateRole(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMemberRecord>;
  delete(workspaceId: string, userId: string): Promise<boolean>;
  countByWorkspaceId(workspaceId: string): Promise<number>;
}

export interface IWorkspaceInvitationRepository {
  create(data: CreateWorkspaceInvitationData): Promise<WorkspaceInvitationRecord>;
  findByToken(token: string): Promise<WorkspaceInvitationRecord | null>;
  findByWorkspaceAndEmail(workspaceId: string, email: string): Promise<WorkspaceInvitationRecord | null>;
  findPendingByWorkspaceId(workspaceId: string): Promise<WorkspaceInvitationRecord[]>;
  updateStatus(
    id: string,
    status: "PENDING" | "ACCEPTED" | "REJECTED" | "EXPIRED"
  ): Promise<WorkspaceInvitationRecord>;
  acceptTransactionally(
    invitationId: string,
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<void>;
  delete(id: string): Promise<boolean>;
}

export interface IBoardRepository {
  findById(id: string): Promise<BoardRecord | null>;
  findWithDetails(id: string): Promise<BoardRecord | null>;
  findByWorkspaceId(workspaceId: string): Promise<BoardRecord[]>;
  create(data: CreateBoardData): Promise<BoardRecord>;
  update(id: string, data: UpdateBoardData): Promise<BoardRecord>;
  delete(id: string): Promise<boolean>;
  countByWorkspaceId(workspaceId: string): Promise<number>;
}

export interface IBoardColumnRepository {
  findById(id: string): Promise<BoardColumnRecord | null>;
  findByBoardId(boardId: string): Promise<BoardColumnRecord[]>;
  create(data: CreateBoardColumnData): Promise<BoardColumnRecord>;
  update(id: string, data: UpdateBoardColumnData): Promise<BoardColumnRecord>;
  delete(id: string): Promise<boolean>;
  moveColumn(data: MoveColumnData): Promise<BoardColumnRecord>;
  reorderColumns(boardId: string, orderedColumnIds: string[]): Promise<BoardColumnRecord[]>;
}

export interface ICardRepository {
  findById(id: string): Promise<CardRecord | null>;
  findByColumnId(columnId: string): Promise<CardRecord[]>;
  findByBoardId(boardId: string): Promise<CardRecord[]>;
  create(data: CreateCardData): Promise<CardRecord>;
  update(id: string, data: UpdateCardData): Promise<CardRecord>;
  delete(id: string): Promise<boolean>;
  moveCard(data: MoveCardData): Promise<CardRecord>;
}
