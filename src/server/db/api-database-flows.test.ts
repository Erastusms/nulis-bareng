import { describe, it, expect, afterAll } from "vitest";
import { db } from "./client";
import { PrismaUserRepository } from "./repositories/user.repository";
import { PrismaSessionRepository } from "./repositories/session.repository";
import { PrismaWorkspaceRepository } from "./repositories/workspace.repository";
import { PrismaWorkspaceMemberRepository } from "./repositories/workspace-member.repository";
import { PrismaBoardRepository } from "./repositories/board.repository";
import { PrismaBoardColumnRepository } from "./repositories/board-column.repository";
import { PrismaCardRepository } from "./repositories/card.repository";
import { PrismaPageRepository } from "./repositories/page.repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { generateSessionToken, getSessionExpiration } from "@/server/auth/session";

describe("Full Stack API + Database Integration Flows (PostgreSQL + Prisma)", () => {
  const userRepo = new PrismaUserRepository(db);
  const sessionRepo = new PrismaSessionRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const memberRepo = new PrismaWorkspaceMemberRepository(db);
  const boardRepo = new PrismaBoardRepository(db);
  const columnRepo = new PrismaBoardColumnRepository(db);
  const cardRepo = new PrismaCardRepository(db);
  const pageRepo = new PrismaPageRepository(db);

  let testUserId: string;
  let testSessionToken: string;
  let testWorkspaceId: string;
  let testBoardId: string;
  let colTodoId: string;
  let colDoneId: string;
  let testCardId: string;
  let testPageId: string;

  const testEmail = `integration_flow_${Date.now()}@example.com`;
  const testSlug = `flow-ws-${Date.now()}`;
  const testUrlIdentifier = `${testSlug}-flow-08232026`;

  afterAll(async () => {
    // Cascade cleanup from workspace
    if (testWorkspaceId) {
      await db.card.deleteMany({ where: { board: { workspaceId: testWorkspaceId } } });
      await db.boardColumn.deleteMany({ where: { board: { workspaceId: testWorkspaceId } } });
      await db.board.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await db.page.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await db.workspaceMember.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await db.activity.deleteMany({ where: { workspaceId: testWorkspaceId } });
      await db.workspace.deleteMany({ where: { id: testWorkspaceId } });
    }

    if (testUserId) {
      await db.session.deleteMany({ where: { userId: testUserId } });
      await db.user.deleteMany({ where: { id: testUserId } });
    }
  });

  describe("1. Authentication & Session Database Flow", () => {
    it("should register a new user with securely hashed password", async () => {
      const password = "IntegrationPassword123!";
      const passwordHash = await hashPassword(password);

      const user = await userRepo.create({
        name: "Flow User",
        email: testEmail,
        passwordHash,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail);
      expect(user.passwordHash).toBeDefined();
      expect(await verifyPassword(password, user.passwordHash)).toBe(true);

      testUserId = user.id;
    });

    it("should create, validate, and persist an active session in the database", async () => {
      testSessionToken = generateSessionToken();
      const expiresAt = getSessionExpiration();

      const session = await sessionRepo.create({
        sessionToken: testSessionToken,
        userId: testUserId,
        expiresAt,
      });

      expect(session.id).toBeDefined();
      expect(session.sessionToken).toBe(testSessionToken);
      expect(session.userId).toBe(testUserId);

      // Validate session retrieval
      const foundSession = await sessionRepo.findByToken(testSessionToken);
      expect(foundSession).not.toBeNull();
      expect(foundSession?.userId).toBe(testUserId);
      expect(foundSession?.user?.email).toBe(testEmail);
    });

    it("should invalidate and delete session on logout", async () => {
      const deleted = await sessionRepo.deleteByToken(testSessionToken);
      expect(deleted).toBe(true);

      const check = await sessionRepo.findByToken(testSessionToken);
      expect(check).toBeNull();
    });
  });

  describe("2. Workspace & RBAC Database Flow", () => {
    it("should create workspace and automatically establish owner membership", async () => {
      const ws = await workspaceRepo.createWithOwner({
        name: "Integration Flow Workspace",
        slug: testSlug,
        urlIdentifier: testUrlIdentifier,
        description: "Testing end-to-end database persistence",
        ownerId: testUserId,
      });

      expect(ws.id).toBeDefined();
      expect(ws.name).toBe("Integration Flow Workspace");
      expect(ws.ownerId).toBe(testUserId);

      testWorkspaceId = ws.id;

      // Verify membership record in database
      const member = await memberRepo.findByWorkspaceAndUser(testWorkspaceId, testUserId);
      expect(member).not.toBeNull();
      expect(member?.role).toBe("OWNER");
    });

    it("should retrieve workspace by ID, slug, and urlIdentifier with member count", async () => {
      const byId = await workspaceRepo.findById(testWorkspaceId);
      expect(byId?.id).toBe(testWorkspaceId);
      expect(byId?.memberCount).toBe(1);

      const byIdentifier = await workspaceRepo.findByUrlIdentifier(testUrlIdentifier);
      expect(byIdentifier?.id).toBe(testWorkspaceId);

      const userWorkspaces = await workspaceRepo.findByUserId(testUserId);
      expect(userWorkspaces.some((w) => w.id === testWorkspaceId)).toBe(true);
    });
  });

  describe("3. Kanban Board, Column, & Card Database Flow", () => {
    it("should create a Kanban board in the workspace", async () => {
      const board = await boardRepo.create({
        workspaceId: testWorkspaceId,
        title: "Sprint Board",
        description: "Main development board",
        position: 65536,
      });

      expect(board.id).toBeDefined();
      expect(board.workspaceId).toBe(testWorkspaceId);
      testBoardId = board.id;
    });

    it("should create columns inside the board", async () => {
      const colTodo = await columnRepo.create({
        boardId: testBoardId,
        title: "To Do",
        position: 65536,
        color: "#6B7280",
      });
      colTodoId = colTodo.id;

      const colDone = await columnRepo.create({
        boardId: testBoardId,
        title: "Done",
        position: 131072,
        color: "#10B981",
      });
      colDoneId = colDone.id;

      expect(colTodoId).toBeDefined();
      expect(colDoneId).toBeDefined();

      const columns = await columnRepo.findByBoardId(testBoardId);
      expect(columns).toHaveLength(2);
    });

    it("should create a card and atomically move it between columns", async () => {
      const card = await cardRepo.create({
        boardId: testBoardId,
        columnId: colTodoId,
        title: "E2E Testing Flow",
        description: "Verify atomic card moves in PostgreSQL",
        position: 65536,
        labels: ["test", "e2e"],
        assigneeIds: [testUserId],
      });

      expect(card.id).toBeDefined();
      expect(card.columnId).toBe(colTodoId);
      expect(card.position).toBe(65536);
      testCardId = card.id;

      // Move card to Done column (target index 0 in empty column)
      const movedCard = await cardRepo.moveCard({
        cardId: testCardId,
        sourceColumnId: colTodoId,
        targetColumnId: colDoneId,
        targetPosition: 0,
      });

      expect(movedCard.id).toBe(testCardId);
      expect(movedCard.columnId).toBe(colDoneId);
      expect(movedCard.position).toBe(65536);

      // Verify in DB directly
      const verified = await cardRepo.findById(testCardId);
      expect(verified?.columnId).toBe(colDoneId);
      expect(verified?.position).toBe(65536);
    });
  });

  describe("4. Document & Binary Yjs Persistence Flow", () => {
    it("should create a document page in the workspace and persist binary Yjs state", async () => {
      const initialContent = {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "Database Flow Note" }] }],
      };

      const page = await pageRepo.create({
        workspaceId: testWorkspaceId,
        title: "Flow Architecture Document",
        content: initialContent,
      });

      expect(page.id).toBeDefined();
      expect(page.title).toBe("Flow Architecture Document");
      testPageId = page.id;

      // Persist binary Yjs state snapshot
      const mockBinaryState = new Uint8Array([0, 1, 2, 3, 4, 5, 255]);
      const updatedPage = await pageRepo.update(testPageId, {
        yjsState: mockBinaryState,
      });

      expect(updatedPage.yjsState).toBeDefined();
      expect(new Uint8Array(updatedPage.yjsState!)).toEqual(mockBinaryState);
    });
  });
});
