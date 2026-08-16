import { db, type DatabaseClient } from "../client";
import type { CreateSessionData, ISessionRepository, SessionRecord } from "../repository";

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async create(data: CreateSessionData): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        sessionToken: data.sessionToken,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
      include: {
        user: true,
      },
    });
  }

  async findByToken(sessionToken: string): Promise<SessionRecord | null> {
    return this.prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: true,
      },
    });
  }

  async deleteByToken(sessionToken: string): Promise<boolean> {
    try {
      await this.prisma.session.delete({
        where: { sessionToken },
      });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByUserId(userId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { userId },
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    });
    return result.count;
  }
}

export const sessionRepository = new PrismaSessionRepository();
