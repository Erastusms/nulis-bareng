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

  const userMap: Record<string, string> = {};

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

    userMap[user.email] = upsertedUser.id;
    console.log(`  ✓ User upserted: ${upsertedUser.email} (${upsertedUser.id})`);
  }

  // Seed sample workspaces and memberships
  const SEED_WORKSPACES = [
    {
      name: "Acme Engineering",
      slug: "acme-engineering",
      urlIdentifier: "acme-engineering-alex-morgan-08232026",
      description: "Primary workspace for engineering, sprint planning, and architecture notes.",
      ownerEmail: "alex@example.com",
      members: [
        { email: "alex@example.com", role: "OWNER" as const },
        { email: "sam@example.com", role: "ADMIN" as const },
        { email: "jordan@example.com", role: "MEMBER" as const },
      ],
    },
    {
      name: "Product Design Studio",
      slug: "product-design-studio",
      urlIdentifier: "product-design-studio-sam-taylor-08232026",
      description: "Design systems, UI kits, and user research documentation.",
      ownerEmail: "sam@example.com",
      members: [
        { email: "sam@example.com", role: "OWNER" as const },
        { email: "alex@example.com", role: "MEMBER" as const },
      ],
    },
    {
      name: "Personal Workspace",
      slug: "personal-workspace",
      urlIdentifier: "personal-workspace-jordan-lee-08232026",
      description: "Private scratchpad and personal drafts.",
      ownerEmail: "jordan@example.com",
      members: [{ email: "jordan@example.com", role: "OWNER" as const }],
    },
  ];

  for (const ws of SEED_WORKSPACES) {
    const ownerId = userMap[ws.ownerEmail];
    if (!ownerId) continue;

    const workspace = await prisma.workspace.upsert({
      where: { urlIdentifier: ws.urlIdentifier },
      update: {
        name: ws.name,
        slug: ws.slug,
        description: ws.description,
        ownerId,
      },
      create: {
        name: ws.name,
        slug: ws.slug,
        urlIdentifier: ws.urlIdentifier,
        description: ws.description,
        ownerId,
      },
    });

    console.log(`  ✓ Workspace upserted: ${workspace.name} (${workspace.urlIdentifier})`);

    for (const member of ws.members) {
      const memberUserId = userMap[member.email];
      if (!memberUserId) continue;

      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: workspace.id,
            userId: memberUserId,
          },
        },
        update: {
          role: member.role,
        },
        create: {
          workspaceId: workspace.id,
          userId: memberUserId,
          role: member.role,
        },
      });

      console.log(`    ↳ Member: ${member.email} -> ${member.role}`);
    }
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
