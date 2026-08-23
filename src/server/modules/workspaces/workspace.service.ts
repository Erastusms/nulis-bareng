import { ConflictError, NotFoundError } from "@/lib/api/errors";
import { generateWorkspaceUrlIdentifier } from "@/lib/utils";
import { userRepository } from "@/server/db/repositories/user.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import type {
  IUserRepository,
  IWorkspaceRepository,
  WorkspaceRecord,
} from "@/server/db/repository";
import {
  workspaceAuth,
  WorkspaceAuthorizationService,
} from "./workspace-authorization";
import type { Workspace, WorkspaceRole } from "@/types/domain";

export interface CreateWorkspaceDTO {
  name: string;
  slug: string;
  description?: string | null;
  ownerId: string;
}

export interface UpdateWorkspaceDTO {
  name?: string;
  slug?: string;
  description?: string | null;
}

function toDomainWorkspace(
  record: WorkspaceRecord,
  currentUserRole?: WorkspaceRole
): Workspace {
  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
    urlIdentifier: record.urlIdentifier || record.slug,
    description: record.description,
    ownerId: record.ownerId,
    role: record.role ?? currentUserRole,
    currentUserRole: currentUserRole ?? record.role,
    memberCount: record.memberCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class WorkspaceService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository = workspaceRepository,
    private readonly authService: WorkspaceAuthorizationService = workspaceAuth,
    private readonly userRepo: IUserRepository = userRepository
  ) {}

  /**
   * Retrieves a single workspace by ID or URL identifier if the requesting user has access.
   */
  async getWorkspaceById(idOrIdentifier: string, userId: string): Promise<Workspace> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(idOrIdentifier);

    if (!workspace) {
      throw new NotFoundError("Workspace", idOrIdentifier);
    }

    const authContext = await this.authService.requireWorkspaceAccess(userId, workspace.id);
    return toDomainWorkspace(workspace, authContext.role);
  }

  /**
   * Retrieves all workspaces for which the user is an active member or owner.
   */
  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const records = await this.workspaceRepo.findByUserId(userId);
    return records.map((record) => toDomainWorkspace(record, record.role));
  }

  /**
   * Creates a new workspace with membership-aware logical slug validation,
   * generates a unique URL identifier ({slug}-{username}-{MMDDYYYY}),
   * and transactionally assigns the creator as OWNER.
   */
  async createWorkspace(dto: CreateWorkspaceDTO): Promise<Workspace> {
    const normalizedSlug = dto.slug.toLowerCase().trim();

    // Check if the user already has access to a workspace with the same logical slug
    const userWorkspaces = await this.workspaceRepo.findByUserId(dto.ownerId);
    const existingDuplicate = userWorkspaces.find(
      (w) => w.slug.toLowerCase() === normalizedSlug
    );

    if (existingDuplicate) {
      throw new ConflictError(
        `You already have access to a workspace with slug '${normalizedSlug}'. Please choose another workspace name or URL.`
      );
    }

    // Retrieve creator user to determine username for URL identifier
    const creator = await this.userRepo.findById(dto.ownerId);
    const username = creator?.name || creator?.email.split("@")[0] || "user";

    // Generate unique URL identifier: {requested-slug}-{username}-{MMDDYYYY}
    const baseIdentifier = generateWorkspaceUrlIdentifier(
      normalizedSlug,
      username,
      new Date()
    );

    let urlIdentifier = baseIdentifier;
    let counter = 2;
    while (await this.workspaceRepo.findByUrlIdentifier(urlIdentifier)) {
      urlIdentifier = `${baseIdentifier}-${counter}`;
      counter++;
    }

    const created = await this.workspaceRepo.createWithOwner({
      name: dto.name.trim(),
      slug: normalizedSlug,
      urlIdentifier,
      description: dto.description?.trim() ?? null,
      ownerId: dto.ownerId,
    });

    return toDomainWorkspace(created, "OWNER");
  }

  /**
   * Updates workspace metadata. Requires OWNER or ADMIN role.
   */
  async updateWorkspace(
    idOrIdentifier: string,
    userId: string,
    dto: UpdateWorkspaceDTO
  ): Promise<Workspace> {
    const existingWorkspace = await this.workspaceRepo.findByIdOrUrlIdentifier(idOrIdentifier);
    if (!existingWorkspace) {
      throw new NotFoundError("Workspace", idOrIdentifier);
    }

    const authContext = await this.authService.requireWorkspaceRole(userId, existingWorkspace.id, [
      "OWNER",
      "ADMIN",
    ]);

    let newUrlIdentifier: string | undefined = undefined;

    if (dto.slug) {
      const normalizedSlug = dto.slug.toLowerCase().trim();
      if (normalizedSlug !== existingWorkspace.slug) {
        // Membership-aware duplicate check for this user
        const userWorkspaces = await this.workspaceRepo.findByUserId(userId);
        const collision = userWorkspaces.find(
          (w) => w.slug.toLowerCase() === normalizedSlug && w.id !== existingWorkspace.id
        );
        if (collision) {
          throw new ConflictError(
            `You already have access to a workspace with slug '${normalizedSlug}'.`
          );
        }

        const user = await this.userRepo.findById(userId);
        const username = user?.name || user?.email.split("@")[0] || "user";
        const baseIdentifier = generateWorkspaceUrlIdentifier(
          normalizedSlug,
          username,
          new Date()
        );

        let uniqueIdentifier = baseIdentifier;
        let counter = 2;
        while (
          (await this.workspaceRepo.findByUrlIdentifier(uniqueIdentifier)) &&
          uniqueIdentifier !== existingWorkspace.urlIdentifier
        ) {
          uniqueIdentifier = `${baseIdentifier}-${counter}`;
          counter++;
        }
        newUrlIdentifier = uniqueIdentifier;
      }
    }

    const updated = await this.workspaceRepo.update(existingWorkspace.id, {
      name: dto.name?.trim(),
      slug: dto.slug?.toLowerCase().trim(),
      urlIdentifier: newUrlIdentifier,
      description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
    });

    return toDomainWorkspace(updated, authContext.role);
  }

  /**
   * Deletes a workspace. Requires OWNER role.
   */
  async deleteWorkspace(idOrIdentifier: string, userId: string): Promise<boolean> {
    const existing = await this.workspaceRepo.findByIdOrUrlIdentifier(idOrIdentifier);
    if (!existing) {
      throw new NotFoundError("Workspace", idOrIdentifier);
    }

    await this.authService.requireWorkspaceRole(userId, existing.id, ["OWNER"]);
    return this.workspaceRepo.delete(existing.id);
  }
}

export const workspaceService = new WorkspaceService();
