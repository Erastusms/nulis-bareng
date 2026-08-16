import { beforeEach, describe, expect, it } from "vitest";
import { ConflictError, UnauthorizedError } from "@/lib/api/errors";
import { hashPassword } from "@/server/auth/password";
import type {
  CreateSessionData,
  CreateUserData,
  ISessionRepository,
  IUserRepository,
  SessionRecord,
  UserRecord,
} from "@/server/db/repository";
import { AuthService } from "./auth.service";

// In-Memory Test Repositories
class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, UserRecord> = new Map();
  private nextId = 1;

  async findById(id: string): Promise<UserRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const normalized = email.toLowerCase().trim();
    for (const user of this.users.values()) {
      if (user.email.toLowerCase().trim() === normalized) {
        return user;
      }
    }
    return null;
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    const id = `user_${this.nextId++}`;
    const user: UserRecord = {
      id,
      name: data.name,
      email: data.email,
      emailVerified: null,
      passwordHash: data.passwordHash,
      avatarUrl: data.avatarUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async update(id: string, data: Partial<CreateUserData>): Promise<UserRecord> {
    const user = this.users.get(id);
    if (!user) throw new Error("User not found");
    const updated: UserRecord = {
      ...user,
      ...data,
      updatedAt: new Date(),
    };
    this.users.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return this.users.delete(id);
  }

  clear() {
    this.users.clear();
    this.nextId = 1;
  }
}

class InMemorySessionRepository implements ISessionRepository {
  private sessions: Map<string, SessionRecord> = new Map();
  private nextId = 1;

  constructor(private userRepo: InMemoryUserRepository) {}

  async create(data: CreateSessionData): Promise<SessionRecord> {
    const id = `session_${this.nextId++}`;
    const user = await this.userRepo.findById(data.userId);
    const session: SessionRecord = {
      id,
      sessionToken: data.sessionToken,
      userId: data.userId,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      user: user ?? undefined,
    };
    this.sessions.set(data.sessionToken, session);
    return session;
  }

  async findByToken(sessionToken: string): Promise<SessionRecord | null> {
    const session = this.sessions.get(sessionToken);
    if (!session) return null;
    const user = await this.userRepo.findById(session.userId);
    return {
      ...session,
      user: user ?? undefined,
    };
  }

  async deleteByToken(sessionToken: string): Promise<boolean> {
    return this.sessions.delete(sessionToken);
  }

  async deleteByUserId(userId: string): Promise<number> {
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  async deleteExpired(): Promise<number> {
    let count = 0;
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt.getTime() <= now) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  clear() {
    this.sessions.clear();
    this.nextId = 1;
  }
}

describe("AuthService (auth.service.ts)", () => {
  let userRepo: InMemoryUserRepository;
  let sessionRepo: InMemorySessionRepository;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new InMemoryUserRepository();
    sessionRepo = new InMemorySessionRepository(userRepo);
    authService = new AuthService(userRepo, sessionRepo);
  });

  describe("register", () => {
    it("should successfully register a new user with hashed password and active session", async () => {
      const result = await authService.register({
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "Password123!",
      });

      expect(result.user.id).toBeDefined();
      expect(result.user.name).toBe("Alex Morgan");
      expect(result.user.email).toBe("alex@example.com");
      expect(result.sessionToken).toBeDefined();
      expect(result.sessionToken.length).toBe(64); // 32 bytes hex
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // Ensure user exists in repository with hashed password
      const stored = await userRepo.findByEmail("alex@example.com");
      expect(stored).not.toBeNull();
      expect(stored?.passwordHash).not.toBe("Password123!");
      expect(stored?.passwordHash.startsWith("$2a$") || stored?.passwordHash.startsWith("$2b$")).toBe(true);
    });

    it("should reject registration if email is already taken", async () => {
      await authService.register({
        name: "First User",
        email: "duplicate@example.com",
        password: "Password123!",
      });

      await expect(
        authService.register({
          name: "Second User",
          email: "duplicate@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow(ConflictError);
    });

    it("should normalize email addresses to lowercase and trimmed", async () => {
      await authService.register({
        name: "Case User",
        email: "  UpperCASE@Example.COM  ",
        password: "Password123!",
      });

      const found = await userRepo.findByEmail("uppercase@example.com");
      expect(found).not.toBeNull();
      expect(found?.email).toBe("uppercase@example.com");
    });
  });

  describe("login", () => {
    beforeEach(async () => {
      const hash = await hashPassword("ValidPassword123!");
      await userRepo.create({
        name: "Test User",
        email: "test@example.com",
        passwordHash: hash,
      });
    });

    it("should authenticate with correct credentials and return active session", async () => {
      const result = await authService.login({
        email: "test@example.com",
        password: "ValidPassword123!",
      });

      expect(result.user.email).toBe("test@example.com");
      expect(result.sessionToken).toBeDefined();

      const session = await sessionRepo.findByToken(result.sessionToken);
      expect(session).not.toBeNull();
      expect(session?.userId).toBe(result.user.id);
    });

    it("should reject login with wrong password without revealing account presence", async () => {
      await expect(
        authService.login({
          email: "test@example.com",
          password: "WrongPassword!",
        })
      ).rejects.toThrow(UnauthorizedError);
    });

    it("should reject login with nonexistent email using the same generic error", async () => {
      await expect(
        authService.login({
          email: "nonexistent@example.com",
          password: "Password123!",
        })
      ).rejects.toThrow(UnauthorizedError);
    });
  });

  describe("logout", () => {
    it("should invalidate the session in the database", async () => {
      const auth = await authService.register({
        name: "Logout User",
        email: "logout@example.com",
        password: "Password123!",
      });

      expect(await sessionRepo.findByToken(auth.sessionToken)).not.toBeNull();

      const success = await authService.logout(auth.sessionToken);
      expect(success).toBe(true);

      const sessionAfter = await sessionRepo.findByToken(auth.sessionToken);
      expect(sessionAfter).toBeNull();
    });

    it("should be idempotent when logging out an already-invalid session", async () => {
      const success = await authService.logout("non-existent-token");
      expect(success).toBe(true);
    });
  });

  describe("validateSession", () => {
    it("should return the user for a valid active session", async () => {
      const auth = await authService.register({
        name: "Session User",
        email: "session@example.com",
        password: "Password123!",
      });

      const validation = await authService.validateSession(auth.sessionToken);
      expect(validation).not.toBeNull();
      expect(validation?.user.email).toBe("session@example.com");
    });

    it("should return null for expired sessions", async () => {
      const hash = await hashPassword("Password123!");
      const user = await userRepo.create({
        name: "Expired User",
        email: "expired@example.com",
        passwordHash: hash,
      });

      const expiredToken = "expired_token_123";
      await sessionRepo.create({
        sessionToken: expiredToken,
        userId: user.id,
        expiresAt: new Date(Date.now() - 10000), // 10 seconds ago
      });

      const validation = await authService.validateSession(expiredToken);
      expect(validation).toBeNull();
    });

    it("should return null for nonexistent or empty session tokens", async () => {
      expect(await authService.validateSession(null)).toBeNull();
      expect(await authService.validateSession(undefined)).toBeNull();
      expect(await authService.validateSession("invalid_token")).toBeNull();
    });
  });
});
