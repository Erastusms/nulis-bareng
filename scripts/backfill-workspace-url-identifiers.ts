import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function formatDateMMDDYYYY(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${month}${day}${year}`;
}

function sanitizeUsername(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "user";
}

async function main() {
  console.log("🔄 Backfilling workspace url_identifiers...");

  const workspaces = await prisma.workspace.findMany({
    include: {
      owner: true,
    },
  });

  const usedIdentifiers = new Set<string>();

  for (const ws of workspaces) {
    const username = sanitizeUsername(ws.owner.name || ws.owner.email.split("@")[0]);
    const dateStr = formatDateMMDDYYYY(ws.createdAt);
    const base = `${ws.slug}-${username}-${dateStr}`;

    let identifier = base;
    let counter = 2;
    while (usedIdentifiers.has(identifier)) {
      identifier = `${base}-${counter}`;
      counter++;
    }

    usedIdentifiers.add(identifier);

    await prisma.workspace.update({
      where: { id: ws.id },
      data: { urlIdentifier: identifier },
    });

    console.log(`  ✓ Workspace "${ws.name}" (${ws.slug}) -> url_identifier: "${identifier}"`);
  }

  console.log("✅ Backfill completed.");
}

main()
  .catch((err) => {
    console.error("❌ Backfill failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
