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

export interface IWorkspaceRepository extends IRepository<import("@/types/domain").Workspace> {
  findBySlug(slug: string): Promise<import("@/types/domain").Workspace | null>;
  findByOwnerId(ownerId: string): Promise<import("@/types/domain").Workspace[]>;
}
