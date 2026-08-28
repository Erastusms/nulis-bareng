import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "../client";
import { PrismaPageRepository } from "./page.repository";
import { PrismaUserRepository } from "./user.repository";
import { PrismaWorkspaceRepository } from "./workspace.repository";
import { hashPassword } from "@/server/auth/password";
import { DEFAULT_EMPTY_DOCUMENT } from "@/features/document/schemas/document-validator";

describe("Page Repository Integration (PostgreSQL + Prisma)", () => {
  const userRepo = new PrismaUserRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const pageRepo = new PrismaPageRepository(db);

  let userId: string;
  let workspaceId: string;
  let page1Id: string;
  let page2Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("PageTest123!");
    const user = await userRepo.create({
      name: "Page Tester",
      email: `page_test_${Date.now()}@example.com`,
      passwordHash,
    });
    userId = user.id;

    const ws = await workspaceRepo.createWithOwner({
      name: "Page Test WS",
      slug: `page-ws-${Date.now()}`,
      urlIdentifier: `page-ws-id-${Date.now()}`,
      ownerId: userId,
    });
    workspaceId = ws.id;
  });

  afterAll(async () => {
    if (workspaceId) {
      await db.page.deleteMany({ where: { workspaceId } });
      await db.workspaceMember.deleteMany({ where: { workspaceId } });
      await db.workspace.deleteMany({ where: { id: workspaceId } });
    }
    if (userId) {
      await db.user.deleteMany({ where: { id: userId } });
    }
  });

  it("should create a new page with default content", async () => {
    const page = await pageRepo.create({
      workspaceId,
      title: "  Project Roadmap  ",
    });

    expect(page.id).toBeDefined();
    expect(page.workspaceId).toBe(workspaceId);
    expect(page.title).toBe("Project Roadmap");
    expect(page.content).toEqual(DEFAULT_EMPTY_DOCUMENT);
    expect(page.createdAt).toBeInstanceOf(Date);
    expect(page.updatedAt).toBeInstanceOf(Date);

    page1Id = page.id;
  });

  it("should create a second page with custom structured content", async () => {
    const customContent = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Architecture Overview" }],
        },
      ],
    };

    const page = await pageRepo.create({
      workspaceId,
      title: "Architecture",
      content: customContent,
    });

    expect(page.id).toBeDefined();
    expect(page.title).toBe("Architecture");
    expect(page.content).toEqual(customContent);

    page2Id = page.id;
  });

  it("should find page by ID", async () => {
    const page = await pageRepo.findById(page1Id);
    expect(page).not.toBeNull();
    expect(page?.id).toBe(page1Id);
    expect(page?.title).toBe("Project Roadmap");
  });

  it("should return null for non-existent page ID", async () => {
    const page = await pageRepo.findById("non_existent_id");
    expect(page).toBeNull();
  });

  it("should find all page summaries for workspace without fetching full content", async () => {
    const pages = await pageRepo.findByWorkspaceId(workspaceId);
    expect(pages.length).toBe(2);
    expect(pages.map((p) => p.id)).toContain(page1Id);
    expect(pages.map((p) => p.id)).toContain(page2Id);
    // PageSummary should only have summary fields
    expect(pages[0].title).toBeDefined();
    expect((pages[0] as unknown as Record<string, unknown>).content).toBeUndefined();
  });

  it("should update page title and content", async () => {
    const updatedContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Updated paragraph text" }],
        },
      ],
    };

    const updated = await pageRepo.update(page1Id, {
      title: "Updated Roadmap",
      content: updatedContent,
    });

    expect(updated.title).toBe("Updated Roadmap");
    expect(updated.content).toEqual(updatedContent);

    const fetched = await pageRepo.findById(page1Id);
    expect(fetched?.title).toBe("Updated Roadmap");
    expect(fetched?.content).toEqual(updatedContent);
  });

  it("should count pages in a workspace", async () => {
    const count = await pageRepo.countByWorkspaceId(workspaceId);
    expect(count).toBe(2);
  });

  it("should delete a page", async () => {
    const deleted = await pageRepo.delete(page2Id);
    expect(deleted).toBe(true);

    const found = await pageRepo.findById(page2Id);
    expect(found).toBeNull();

    const remaining = await pageRepo.countByWorkspaceId(workspaceId);
    expect(remaining).toBe(1);
  });
});
