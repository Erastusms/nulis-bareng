import { describe, expect, it } from "vitest";
import type { User as PrismaUser } from "@prisma/client";
import { toSafeUser } from "./user-serializer";

describe("User Serializer & Security Invariants (user-serializer.ts)", () => {
  const mockPrismaUser: PrismaUser = {
    id: "user_123",
    name: "Alex Morgan",
    email: "alex@example.com",
    emailVerified: null,
    passwordHash: "$2a$12$e8xL4XyG8yQ9wH5N0U8N..someSuperSecretHash12345",
    avatarUrl: "https://example.com/avatar.png",
    createdAt: new Date("2026-08-16T12:00:00.000Z"),
    updatedAt: new Date("2026-08-16T12:30:00.000Z"),
  };

  it("should transform a Prisma user into a safe domain User representation", () => {
    const safeUser = toSafeUser(mockPrismaUser);

    expect(safeUser).toEqual({
      id: "user_123",
      name: "Alex Morgan",
      email: "alex@example.com",
      avatarUrl: "https://example.com/avatar.png",
      createdAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:30:00.000Z",
    });
  });

  it("SECURITY INVARIANT: passwordHash is NEVER exposed in the serialized output", () => {
    const safeUser = toSafeUser(mockPrismaUser);

    expect("passwordHash" in safeUser).toBe(false);
    expect((safeUser as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
    expect(JSON.stringify(safeUser)).not.toContain("passwordHash");
    expect(JSON.stringify(safeUser)).not.toContain("$2a$12$");
  });

  it("should correctly format timestamps to ISO strings", () => {
    const safeUser = toSafeUser(mockPrismaUser);

    expect(typeof safeUser.createdAt).toBe("string");
    expect(typeof safeUser.updatedAt).toBe("string");
    expect(safeUser.createdAt).toBe("2026-08-16T12:00:00.000Z");
  });
});
