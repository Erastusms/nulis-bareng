import { describe, it, expect } from "vitest";
import { db } from "@/server/db/client";
import { PrismaUserRepository } from "@/server/db/repositories/user.repository";
import { PrismaWorkspaceRepository } from "@/server/db/repositories/workspace.repository";
import { PrismaBoardRepository } from "@/server/db/repositories/board.repository";
import { PrismaCardRepository } from "@/server/db/repositories/card.repository";
import { PrismaPageRepository } from "@/server/db/repositories/page.repository";

describe("SQL Injection & Query Parameterization Safety (Database Integration)", () => {
  const userRepo = new PrismaUserRepository(db);
  const workspaceRepo = new PrismaWorkspaceRepository(db);
  const boardRepo = new PrismaBoardRepository(db);
  const cardRepo = new PrismaCardRepository(db);
  const pageRepo = new PrismaPageRepository(db);

  const SQL_PAYLOADS = [
    "' OR '1'='1",
    "'; DROP TABLE users; --",
    "1' UNION SELECT * FROM users --",
    "admin' --",
    "' OR 1=1 #",
    '" OR ""="',
    "'; EXEC sp_msforeachtable 'DROP TABLE ?' --",
    "\\x27\\x20OR\\x201=1--",
  ];

  it("should safely parameterize user lookup by email with malicious SQL payloads", async () => {
    for (const payload of SQL_PAYLOADS) {
      // Must resolve safely to null (or throw validation/not found) without executing SQL commands
      const user = await userRepo.findByEmail(payload);
      expect(user).toBeNull();
    }
  });

  it("should safely parameterize workspace lookup by slug and urlIdentifier", async () => {
    for (const payload of SQL_PAYLOADS) {
      const wsBySlug = await workspaceRepo.findBySlug(payload);
      expect(wsBySlug).toBeNull();

      const wsByIdentifier = await workspaceRepo.findByUrlIdentifier(payload);
      expect(wsByIdentifier).toBeNull();

      const wsByIdOrId = await workspaceRepo.findByIdOrUrlIdentifier(payload);
      expect(wsByIdOrId).toBeNull();
    }
  });

  it("should safely handle malicious payloads in board, card, and page queries", async () => {
    for (const payload of SQL_PAYLOADS) {
      const board = await boardRepo.findById(payload);
      expect(board).toBeNull();

      const card = await cardRepo.findById(payload);
      expect(card).toBeNull();

      const page = await pageRepo.findById(payload);
      expect(page).toBeNull();
    }
  });
});
