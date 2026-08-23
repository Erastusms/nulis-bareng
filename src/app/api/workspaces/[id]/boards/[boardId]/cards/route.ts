import { NextRequest } from "next/server";
import { createCardSchema } from "@/features/board/schemas/board.schema";
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
    const input = createCardSchema.parse(json);

    const card = await cardService.createCard(
      workspaceId,
      boardId,
      user.id,
      input
    );

    return successResponse(card, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
