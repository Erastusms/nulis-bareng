import { ConflictError, UnauthorizedError } from "@/lib/api/errors";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  generateSessionToken,
  getSessionExpiration,
  isSessionExpired,
} from "@/server/auth/session";
import { toSafeUser } from "@/server/auth/user-serializer";
import { userRepository } from "@/server/db/repositories/user.repository";
import { sessionRepository } from "@/server/db/repositories/session.repository";
import type { IUserRepository, ISessionRepository, SessionRecord } from "@/server/db/repository";
import type { User } from "@/types/domain";

export interface RegisterDTO {
  name: string;
  email: string;
  password: string;
  avatarUrl?: string | null;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  sessionToken: string;
  expiresAt: Date;
}

export interface SessionValidationResult {
  user: User;
  session: SessionRecord;
}

export class AuthService {
  constructor(
    private readonly userRepo: IUserRepository = userRepository,
    private readonly sessionRepo: ISessionRepository = sessionRepository
  ) {}

  /**
   * Registers a new user account with hashed password and initial active session.
   */
  async register(dto: RegisterDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();
    const trimmedName = dto.name.trim();

    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(dto.password);

    const userRecord = await this.userRepo.create({
      name: trimmedName,
      email: normalizedEmail,
      passwordHash,
      avatarUrl: dto.avatarUrl ?? null,
    });

    const sessionToken = generateSessionToken();
    const expiresAt = getSessionExpiration();

    await this.sessionRepo.create({
      sessionToken,
      userId: userRecord.id,
      expiresAt,
    });

    return {
      user: toSafeUser(userRecord),
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Authenticates user credentials and establishes an active session.
   * Returns generic unauthorized error to prevent email enumeration.
   */
  async login(dto: LoginDTO): Promise<AuthResult> {
    const normalizedEmail = dto.email.toLowerCase().trim();

    const userRecord = await this.userRepo.findByEmail(normalizedEmail);
    if (!userRecord) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isPasswordValid = await verifyPassword(dto.password, userRecord.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const sessionToken = generateSessionToken();
    const expiresAt = getSessionExpiration();

    await this.sessionRepo.create({
      sessionToken,
      userId: userRecord.id,
      expiresAt,
    });

    return {
      user: toSafeUser(userRecord),
      sessionToken,
      expiresAt,
    };
  }

  /**
   * Logs out by destroying the session associated with the token.
   * Operation is idempotent.
   */
  async logout(sessionToken: string): Promise<boolean> {
    if (!sessionToken) {
      return true;
    }
    await this.sessionRepo.deleteByToken(sessionToken);
    return true;
  }

  /**
   * Validates a session token and returns the corresponding authenticated user.
   */
  async validateSession(sessionToken: string | null | undefined): Promise<SessionValidationResult | null> {
    if (!sessionToken) {
      return null;
    }

    const sessionRecord = await this.sessionRepo.findByToken(sessionToken);
    if (!sessionRecord || !sessionRecord.user) {
      return null;
    }

    if (isSessionExpired(sessionRecord.expiresAt)) {
      // Asynchronously clean up expired session
      this.sessionRepo.deleteByToken(sessionToken).catch(() => {});
      return null;
    }

    return {
      user: toSafeUser(sessionRecord.user),
      session: sessionRecord,
    };
  }
}

export const authService = new AuthService();
