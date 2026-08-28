import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as getPagesHandler, POST as createPageHandler } from "./[id]/pages/route";
import {
  GET as getPageByIdHandler,
  PATCH as updatePageHandler,
  DELETE as deletePageHandler,
} from "../pages/[pageId]/route";
import { pageService } from "@/server/modules/pages/page.service";
import * as currentUserModule from "@/server/auth/current-user";
import type { Page, PageSummary, User } from "@/types/domain";
import { DEFAULT_EMPTY_DOCUMENT } from "@/features/document/schemas/document-validator";

describe("Page API Route Handlers", () => {
  const mockUser: User = {
    id: "user_test",
    name: "Tester",
    email: "test@example.com",
    avatarUrl: null,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };

  const mockPageSummary: PageSummary = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Sprint Notes",
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };

  const mockPage: Page = {
    id: "page_1",
    workspaceId: "ws_1",
    title: "Sprint Notes",
    content: DEFAULT_EMPTY_DOCUMENT,
    createdAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-28T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(currentUserModule, "requireAuth").mockResolvedValue(mockUser);
  });

  describe("GET /api/workspaces/[id]/pages", () => {
    it("returns 200 with page summaries", async () => {
      vi.spyOn(pageService, "getPagesByWorkspace").mockResolvedValue([mockPageSummary]);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/pages");
      const res = await getPagesHandler(req, { params: Promise.resolve({ id: "ws_1" }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(1);
      expect(data.data[0].title).toBe("Sprint Notes");
    });
  });

  describe("POST /api/workspaces/[id]/pages", () => {
    it("returns 201 with created page", async () => {
      vi.spyOn(pageService, "createPage").mockResolvedValue(mockPage);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Sprint Notes" }),
      });
      const res = await createPageHandler(req, { params: Promise.resolve({ id: "ws_1" }) });
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("page_1");
    });
  });

  describe("GET /api/pages/[pageId]", () => {
    it("returns 200 with full page details", async () => {
      vi.spyOn(pageService, "getPageById").mockResolvedValue(mockPage);

      const req = new NextRequest("http://localhost:3000/api/pages/page_1");
      const res = await getPageByIdHandler(req, {
        params: Promise.resolve({ pageId: "page_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe("page_1");
      expect(data.data.content).toEqual(DEFAULT_EMPTY_DOCUMENT);
    });
  });

  describe("PATCH /api/pages/[pageId]", () => {
    it("returns 200 with updated page", async () => {
      vi.spyOn(pageService, "updatePage").mockResolvedValue({
        ...mockPage,
        title: "Renamed Page",
      });

      const req = new NextRequest("http://localhost:3000/api/pages/page_1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Renamed Page" }),
      });
      const res = await updatePageHandler(req, {
        params: Promise.resolve({ pageId: "page_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.title).toBe("Renamed Page");
    });
  });

  describe("DELETE /api/pages/[pageId]", () => {
    it("returns 200 on deletion", async () => {
      vi.spyOn(pageService, "deletePage").mockResolvedValue(true);

      const req = new NextRequest("http://localhost:3000/api/pages/page_1", {
        method: "DELETE",
      });
      const res = await deletePageHandler(req, {
        params: Promise.resolve({ pageId: "page_1" }),
      });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
