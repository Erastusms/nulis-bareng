import { createEventId, createVersion } from "@/lib/realtime/events";
import { pageRepository } from "@/server/db/repositories/page.repository";
import type { IPageRepository, PageRecord, PageSummaryRecord } from "@/server/db/repository";
import { eventPublisher, IEventPublisher } from "@/server/websocket/event-publisher";
import { activityService as defaultActivityService, ActivityService } from "../activities/activity.service";
import { pageAuth, PageAuthorizationService } from "./page-authorization";
import { validateDocumentContent } from "@/features/document/schemas/document-validator";
import type { Page, PageSummary } from "@/types/domain";

export interface CreatePageDTO {
  title?: string;
  content?: Record<string, unknown>;
}

export interface UpdatePageDTO {
  title?: string;
  content?: Record<string, unknown>;
}

function toDomainPage(record: PageRecord): Page {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    content: record.content,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toDomainPageSummary(record: PageSummaryRecord): PageSummary {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class PageService {
  constructor(
    private readonly pageRepo: IPageRepository = pageRepository,
    private readonly authService: PageAuthorizationService = pageAuth,
    private readonly publisher: IEventPublisher = eventPublisher,
    private readonly activityService: ActivityService = defaultActivityService
  ) {}

  /**
   * Retrieves all page summaries for a workspace.
   */
  async getPagesByWorkspace(
    workspaceIdOrIdentifier: string,
    userId: string
  ): Promise<PageSummary[]> {
    const { workspace } = await this.authService.requireWorkspaceAccess(
      userId,
      workspaceIdOrIdentifier
    );
    const records = await this.pageRepo.findByWorkspaceId(workspace.id);
    return records.map(toDomainPageSummary);
  }

  /**
   * Retrieves full page detail by ID.
   */
  async getPageById(pageId: string, userId: string): Promise<Page> {
    const { page } = await this.authService.requirePageAccess(pageId, userId);
    return toDomainPage(page);
  }

  /**
   * Creates a new page in a workspace.
   */
  async createPage(
    workspaceIdOrIdentifier: string,
    userId: string,
    dto: CreatePageDTO
  ): Promise<Page> {
    const { workspace } = await this.authService.requireWorkspaceAccess(
      userId,
      workspaceIdOrIdentifier
    );

    const validatedContent = dto.content
      ? validateDocumentContent(dto.content)
      : undefined;

    const created = await this.pageRepo.create({
      workspaceId: workspace.id,
      title: dto.title?.trim() || "Untitled",
      content: validatedContent,
    });

    const domainPage = toDomainPage(created);
    const summary: PageSummary = {
      id: domainPage.id,
      workspaceId: domainPage.workspaceId,
      title: domainPage.title,
      createdAt: domainPage.createdAt,
      updatedAt: domainPage.updatedAt,
    };

    await this.publisher.publish({
      eventId: createEventId(),
      type: "page.created",
      workspaceId: workspace.id,
      pageId: domainPage.id,
      page: summary,
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    await this.activityService.recordActivity({
      workspaceId: workspace.id,
      actorId: userId,
      type: "DOCUMENT_CREATED",
      entityType: "DOCUMENT",
      entityId: domainPage.id,
      metadata: {
        documentTitle: domainPage.title,
      },
    });

    return domainPage;
  }

  /**
   * Partially updates an existing page (title and/or content).
   */
  async updatePage(
    pageId: string,
    userId: string,
    dto: UpdatePageDTO
  ): Promise<Page> {
    const { workspace, page: existingPage } = await this.authService.requirePageAccess(pageId, userId);

    let validatedContent: Record<string, unknown> | undefined = undefined;
    if (dto.content !== undefined) {
      validatedContent = validateDocumentContent(dto.content);
    }

    const updated = await this.pageRepo.update(pageId, {
      title: dto.title !== undefined ? dto.title.trim() || "Untitled" : undefined,
      content: validatedContent,
    });

    const domainPage = toDomainPage(updated);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "page.updated",
      workspaceId: workspace.id,
      pageId: domainPage.id,
      changes: {
        ...(dto.title !== undefined && { title: domainPage.title }),
        ...(dto.content !== undefined && { content: domainPage.content }),
        updatedAt: domainPage.updatedAt,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    if (dto.title && existingPage && existingPage.title !== domainPage.title) {
      await this.activityService.recordActivity({
        workspaceId: workspace.id,
        actorId: userId,
        type: "DOCUMENT_RENAMED",
        entityType: "DOCUMENT",
        entityId: domainPage.id,
        metadata: {
          documentTitle: domainPage.title,
          previousTitle: existingPage.title,
        },
      });
    }

    return domainPage;
  }

  /**
   * Deletes a page from its workspace.
   */
  async deletePage(pageId: string, userId: string): Promise<boolean> {
    const { workspace, page } = await this.authService.requirePageAccess(pageId, userId);

    const deleted = await this.pageRepo.delete(pageId);
    if (deleted) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "page.deleted",
        workspaceId: workspace.id,
        pageId,
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });

      await this.activityService.recordActivity({
        workspaceId: workspace.id,
        actorId: userId,
        type: "DOCUMENT_DELETED",
        entityType: "DOCUMENT",
        entityId: pageId,
        metadata: {
          documentTitle: page?.title || "Document",
        },
      });
    }

    return deleted;
  }
}

export const pageService = new PageService();

