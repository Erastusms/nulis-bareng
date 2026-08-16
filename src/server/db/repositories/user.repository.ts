import { db, type DatabaseClient } from "../client";
import type { CreateUserData, IUserRepository, UserRecord } from "../repository";

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: DatabaseClient = db) {}

  async findById(id: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });
  }

  async create(data: CreateUserData): Promise<UserRecord> {
    return this.prisma.user.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        passwordHash: data.passwordHash,
        avatarUrl: data.avatarUrl ?? null,
      },
    });
  }

  async update(id: string, data: Partial<CreateUserData>): Promise<UserRecord> {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name.trim() }),
        ...(data.email !== undefined && { email: data.email.toLowerCase().trim() }),
        ...(data.passwordHash !== undefined && { passwordHash: data.passwordHash }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
      },
    });
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({
        where: { id },
      });
      return true;
    } catch {
      return false;
    }
  }
}

export const userRepository = new PrismaUserRepository();
