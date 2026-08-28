import { NotFoundError } from "@/lib/api/errors";
import { pageRepository } from "@/server/db/repositories/page.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import type {
  IPageRepository,
  IWorkspaceRepository,
  PageRecord,
  WorkspaceRecord,
} from "@/server/db/repository";
import {
  workspaceAuth,
  WorkspaceAuthorizationService,
  type WorkspaceAuthContext,
} from "../workspaces/workspace-authorization";

export class PageAuthorizationService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository = workspaceRepository,
    private readonly workspaceAuthService: WorkspaceAuthorizationService = workspaceAuth,
    private readonly pageRepo: IPageRepository = pageRepository
  ) {}

  /**
   * Enforces that the user is an active member of the workspace (resolves by ID or urlIdentifier).
   */
  async requireWorkspaceAccess(
    userId: string,
    workspaceIdOrIdentifier: string
  ): Promise<{ workspace: WorkspaceRecord; auth: WorkspaceAuthContext }> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceIdOrIdentifier);
    }

    const auth = await this.workspaceAuthService.requireWorkspaceAccess(userId, workspace.id);
    return { workspace, auth };
  }

  /**
   * Validates that the page exists and the user is an authorized member of its workspace.
   */
  async requirePageAccess(
    pageId: string,
    userId: string
  ): Promise<{
    page: PageRecord;
    workspace: WorkspaceRecord;
    auth: WorkspaceAuthContext;
  }> {
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      throw new NotFoundError("Page", pageId);
    }

    const workspace = await this.workspaceRepo.findById(page.workspaceId);
    if (!workspace) {
      throw new NotFoundError("Workspace", page.workspaceId);
    }

    const auth = await this.workspaceAuthService.requireWorkspaceAccess(userId, workspace.id);
    return { page, workspace, auth };
  }
}

export const pageAuth = new PageAuthorizationService();
