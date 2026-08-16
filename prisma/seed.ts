import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const SEED_USERS = [
  {
    email: "alex@example.com",
    name: "Alex Morgan",
    password: "Password123!",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "sam@example.com",
    name: "Sam Taylor",
    password: "Password123!",
    avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80",
  },
  {
    email: "jordan@example.com",
    name: "Jordan Lee",
    password: "Password123!",
    avatarUrl: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80",
  },
];

async function main() {
  console.log("🌱 Seeding development database...");

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password, SALT_ROUNDS);

    const upsertedUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        passwordHash,
        avatarUrl: user.avatarUrl,
      },
      create: {
        email: user.email,
        name: user.name,
        passwordHash,
        avatarUrl: user.avatarUrl,
      },
    });

    console.log(`  ✓ User upserted: ${upsertedUser.email} (${upsertedUser.id})`);
  }

  console.log("✅ Seed completed successfully.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
