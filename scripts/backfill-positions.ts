import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const INITIAL_POSITION = 65536;
export const POSITION_GAP = 65536;

/**
 * Backfills positions for Boards, Columns, and Cards deterministically.
 * Uses (index + 1) * POSITION_GAP (65536, 131072, 196608, ...) based on existing order.
 */
export async function backfillPositions() {
  console.log("🔄 Starting deterministic position backfill...");

  // 1. Backfill Boards grouped by workspaceId
  const workspaces = await prisma.workspace.findMany({
    select: { id: true, name: true },
  });

  let totalBoardsUpdated = 0;
  for (const ws of workspaces) {
    const boards = await prisma.board.findMany({
      where: { workspaceId: ws.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    for (let i = 0; i < boards.length; i++) {
      const targetPos = (i + 1) * POSITION_GAP;
      if (boards[i].position !== targetPos) {
        await prisma.board.update({
          where: { id: boards[i].id },
          data: { position: targetPos },
        });
        totalBoardsUpdated++;
      }
    }
  }
  console.log(`  ✓ Boards backfilled (${totalBoardsUpdated} updated)`);

  // 2. Backfill Columns grouped by boardId
  const boards = await prisma.board.findMany({
    select: { id: true, title: true },
  });

  let totalColumnsUpdated = 0;
  for (const board of boards) {
    const columns = await prisma.boardColumn.findMany({
      where: { boardId: board.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    for (let i = 0; i < columns.length; i++) {
      const targetPos = (i + 1) * POSITION_GAP;
      if (columns[i].position !== targetPos) {
        await prisma.boardColumn.update({
          where: { id: columns[i].id },
          data: { position: targetPos },
        });
        totalColumnsUpdated++;
      }
    }
  }
  console.log(`  ✓ Columns backfilled (${totalColumnsUpdated} updated)`);

  // 3. Backfill Cards grouped by columnId
  const columns = await prisma.boardColumn.findMany({
    select: { id: true, title: true },
  });

  let totalCardsUpdated = 0;
  for (const col of columns) {
    const cards = await prisma.card.findMany({
      where: { columnId: col.id },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    });

    for (let i = 0; i < cards.length; i++) {
      const targetPos = (i + 1) * POSITION_GAP;
      if (cards[i].position !== targetPos) {
        await prisma.card.update({
          where: { id: cards[i].id },
          data: { position: targetPos },
        });
        totalCardsUpdated++;
      }
    }
  }
  console.log(`  ✓ Cards backfilled (${totalCardsUpdated} updated)`);

  console.log("✅ Position backfill completed successfully.");
}

if (require.main === module) {
  backfillPositions()
    .catch((err) => {
      console.error("❌ Backfill failed:", err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
