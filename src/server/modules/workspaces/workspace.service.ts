import { ConflictError, NotFoundError } from "@/lib/api/errors";
import type { IWorkspaceRepository } from "@/server/db/repository";
import type { Workspace } from "@/types/domain";

export interface CreateWorkspaceDTO {
  name: string;
  slug: string;
  description?: string | null;
  ownerId: string;
}

export class WorkspaceService {
  constructor(private readonly workspaceRepository: IWorkspaceRepository) {}

  async getWorkspaceById(id: string): Promise<Workspace> {
    const workspace = await this.workspaceRepository.findById(id);
    if (!workspace) {
      throw new NotFoundError("Workspace", id);
    }
    return workspace;
  }

  async getWorkspacesByOwner(ownerId: string): Promise<Workspace[]> {
    return this.workspaceRepository.findByOwnerId(ownerId);
  }

  async createWorkspace(dto: CreateWorkspaceDTO): Promise<Workspace> {
    const existing = await this.workspaceRepository.findBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Workspace with slug '${dto.slug}' already exists.`);
    }

    return this.workspaceRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description,
      ownerId: dto.ownerId,
    });
  }
}
