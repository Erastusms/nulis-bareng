import type { User as PrismaUser } from "@prisma/client";
import type { User } from "@/types/domain";

/**
 * Transforms a raw database user model into a client-safe domain User object.
 * Strictly guarantees that sensitive fields (passwordHash, etc.) are never exposed.
 */
export function toSafeUser(user: PrismaUser): User {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}
