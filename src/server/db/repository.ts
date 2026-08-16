import type { Workspace as DomainWorkspace } from "@/types/domain";

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

export interface IWorkspaceRepository extends IRepository<DomainWorkspace> {
  findBySlug(slug: string): Promise<DomainWorkspace | null>;
  findByOwnerId(ownerId: string): Promise<DomainWorkspace[]>;
}
