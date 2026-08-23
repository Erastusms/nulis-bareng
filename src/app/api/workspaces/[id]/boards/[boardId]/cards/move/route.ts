import { NextRequest } from "next/server";
import { moveCardSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { cardService } from "@/server/modules/boards/card.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    const json = await request.json();
    const input = moveCardSchema.parse(json);

    const movedCard = await cardService.moveCard(
      workspaceId,
      boardId,
      user.id,
      input
    );

    return successResponse(movedCard, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
