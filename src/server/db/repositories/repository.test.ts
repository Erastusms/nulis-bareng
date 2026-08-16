import { describe, expect, it, afterAll } from "vitest";
import { db } from "../client";
import { PrismaUserRepository } from "./user.repository";
import { PrismaSessionRepository } from "./session.repository";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { generateSessionToken, getSessionExpiration } from "@/server/auth/session";

describe("Database Repositories & Constraints Integration (PostgreSQL + Prisma)", () => {
  const userRepo = new PrismaUserRepository(db);
  const sessionRepo = new PrismaSessionRepository(db);

  const testEmail = `test_${Date.now()}@example.com`;
  let createdUserId: string;
  let createdSessionToken: string;

  afterAll(async () => {
    // Clean up test data
    if (createdUserId) {
      await db.session.deleteMany({ where: { userId: createdUserId } });
      await db.user.deleteMany({ where: { id: createdUserId } });
    }
  });

  describe("PrismaUserRepository", () => {
    it("should persist a new user record with hashed password", async () => {
      const passwordHash = await hashPassword("SecretPass123!");
      const user = await userRepo.create({
        name: "Integration Tester",
        email: testEmail,
        passwordHash,
      });

      expect(user.id).toBeDefined();
      expect(user.email).toBe(testEmail.toLowerCase());
      expect(user.name).toBe("Integration Tester");
      expect(user.passwordHash).toBe(passwordHash);

      createdUserId = user.id;
    });

    it("should find user by email (case-insensitive)", async () => {
      const found = await userRepo.findByEmail(testEmail.toUpperCase());
      expect(found).not.toBeNull();
      expect(found?.id).toBe(createdUserId);
    });

    it("should find user by id", async () => {
      const found = await userRepo.findById(createdUserId);
      expect(found).not.toBeNull();
      expect(found?.email).toBe(testEmail);
    });

    it("should reject duplicate email insertion at the database level", async () => {
      const passwordHash = await hashPassword("AnotherPass123!");
      await expect(
        userRepo.create({
          name: "Duplicate User",
          email: testEmail,
          passwordHash,
        })
      ).rejects.toThrow();
    });

    it("should verify password against stored hash", async () => {
      const user = await userRepo.findById(createdUserId);
      expect(user).not.toBeNull();
      if (user) {
        const isMatch = await verifyPassword("SecretPass123!", user.passwordHash);
        expect(isMatch).toBe(true);

        const isWrong = await verifyPassword("WrongPassword123!", user.passwordHash);
        expect(isWrong).toBe(false);
      }
    });
  });

  describe("PrismaSessionRepository & Cascading Relations", () => {
    it("should persist a session linked to the user", async () => {
      createdSessionToken = generateSessionToken();
      const expiresAt = getSessionExpiration();

      const session = await sessionRepo.create({
        sessionToken: createdSessionToken,
        userId: createdUserId,
        expiresAt,
      });

      expect(session.id).toBeDefined();
      expect(session.sessionToken).toBe(createdSessionToken);
      expect(session.userId).toBe(createdUserId);
      expect(session.user).toBeDefined();
      expect(session.user?.id).toBe(createdUserId);
    });

    it("should find session by session token with user relation", async () => {
      const found = await sessionRepo.findByToken(createdSessionToken);
      expect(found).not.toBeNull();
      expect(found?.sessionToken).toBe(createdSessionToken);
      expect(found?.user?.email).toBe(testEmail);
    });

    it("should delete session by token", async () => {
      const tempToken = generateSessionToken();
      await sessionRepo.create({
        sessionToken: tempToken,
        userId: createdUserId,
        expiresAt: getSessionExpiration(),
      });

      const deleted = await sessionRepo.deleteByToken(tempToken);
      expect(deleted).toBe(true);

      const found = await sessionRepo.findByToken(tempToken);
      expect(found).toBeNull();
    });

    it("should cascade delete sessions when user is deleted", async () => {
      const cascadeEmail = `cascade_${Date.now()}@example.com`;
      const cascadeUser = await userRepo.create({
        name: "Cascade User",
        email: cascadeEmail,
        passwordHash: await hashPassword("Pass123!"),
      });

      const cascadeToken = generateSessionToken();
      await sessionRepo.create({
        sessionToken: cascadeToken,
        userId: cascadeUser.id,
        expiresAt: getSessionExpiration(),
      });

      expect(await sessionRepo.findByToken(cascadeToken)).not.toBeNull();

      // Delete user directly via prisma
      await db.user.delete({ where: { id: cascadeUser.id } });

      // Verify session was cascaded
      const sessionAfter = await sessionRepo.findByToken(cascadeToken);
      expect(sessionAfter).toBeNull();
    });
  });
});
