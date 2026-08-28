import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageService } from "./page.service";
import { PageAuthorizationService } from "./page-authorization";
import type { IPageRepository } from "@/server/db/repository";
import type { IEventPublisher } from "@/server/websocket/event-publisher";
import { DEFAULT_EMPTY_DOCUMENT } from "@/features/document/schemas/document-validator";

describe("PageService", () => {
  let pageRepoMock: IPageRepository;
  let authServiceMock: PageAuthorizationService;
  let publisherMock: IEventPublisher;
  let service: PageService;

  const mockPageRecord = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Sprint Notes",
    content: DEFAULT_EMPTY_DOCUMENT,
    yjsState: null,
    createdAt: new Date("2026-08-28T00:00:00.000Z"),
    updatedAt: new Date("2026-08-28T00:00:00.000Z"),
  };

  const mockWorkspace = {
    id: "ws_1",
    name: "Workspace 1",
    slug: "ws-1",
    urlIdentifier: "ws-1-id-1234",
    description: null,
    ownerId: "user_1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    pageRepoMock = {
      findById: vi.fn(),
      findByWorkspaceId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      countByWorkspaceId: vi.fn(),
    };

    authServiceMock = {
      requireWorkspaceAccess: vi.fn().mockResolvedValue({
        workspace: mockWorkspace,
        auth: { role: "MEMBER" },
      }),
      requirePageAccess: vi.fn().mockResolvedValue({
        page: mockPageRecord,
        workspace: mockWorkspace,
        auth: { role: "MEMBER" },
      }),
    } as unknown as PageAuthorizationService;

    publisherMock = {
      publish: vi.fn().mockResolvedValue(undefined),
    };

    service = new PageService(pageRepoMock, authServiceMock, publisherMock);
  });

  describe("getPagesByWorkspace", () => {
    it("should return workspace page summaries", async () => {
      vi.spyOn(pageRepoMock, "findByWorkspaceId").mockResolvedValue([
        {
          id: "page_1",
          workspaceId: "ws_1",
          title: "Sprint Notes",
          createdAt: new Date("2026-08-28T00:00:00.000Z"),
          updatedAt: new Date("2026-08-28T00:00:00.000Z"),
        },
      ]);

      const pages = await service.getPagesByWorkspace("ws_1", "user_1");
      expect(pages).toHaveLength(1);
      expect(pages[0].id).toBe("page_1");
      expect(pages[0].title).toBe("Sprint Notes");
    });
  });

  describe("getPageById", () => {
    it("should return full page detail", async () => {
      const page = await service.getPageById("page_1", "user_1");
      expect(page.id).toBe("page_1");
      expect(page.title).toBe("Sprint Notes");
      expect(page.content).toEqual(DEFAULT_EMPTY_DOCUMENT);
    });
  });

  describe("createPage", () => {
    it("should create a new page, publish page.created event, and return page", async () => {
      vi.spyOn(pageRepoMock, "create").mockResolvedValue(mockPageRecord);

      const page = await service.createPage("ws_1", "user_1", {
        title: "Sprint Notes",
      });

      expect(pageRepoMock.create).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        title: "Sprint Notes",
        content: undefined,
      });

      expect(publisherMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page.created",
          workspaceId: "ws_1",
          pageId: "page_1",
        })
      );

      expect(page.id).toBe("page_1");
    });
  });

  describe("updatePage", () => {
    it("should update page, publish page.updated event, and return updated page", async () => {
      const updatedRecord = {
        ...mockPageRecord,
        title: "Renamed Notes",
        updatedAt: new Date("2026-08-28T01:00:00.000Z"),
      };
      vi.spyOn(pageRepoMock, "update").mockResolvedValue(updatedRecord);

      const updated = await service.updatePage("page_1", "user_1", {
        title: "Renamed Notes",
      });

      expect(pageRepoMock.update).toHaveBeenCalledWith("page_1", {
        title: "Renamed Notes",
        content: undefined,
      });

      expect(publisherMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page.updated",
          workspaceId: "ws_1",
          pageId: "page_1",
          changes: expect.objectContaining({ title: "Renamed Notes" }),
        })
      );

      expect(updated.title).toBe("Renamed Notes");
    });

    it("should reject malformed document content on update", async () => {
      const invalidDoc = { type: "doc", content: [{ type: "unknown_custom_node" }] };

      await expect(
        service.updatePage("page_1", "user_1", { content: invalidDoc })
      ).rejects.toThrow("Unsupported node type 'unknown_custom_node'.");
    });
  });

  describe("deletePage", () => {
    it("should delete page, publish page.deleted event, and return true", async () => {
      vi.spyOn(pageRepoMock, "delete").mockResolvedValue(true);

      const result = await service.deletePage("page_1", "user_1");
      expect(result).toBe(true);

      expect(pageRepoMock.delete).toHaveBeenCalledWith("page_1");
      expect(publisherMock.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "page.deleted",
          workspaceId: "ws_1",
          pageId: "page_1",
        })
      );
    });
  });
});
