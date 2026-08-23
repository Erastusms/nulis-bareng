import { NextRequest } from "next/server";
import { updateCardSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { cardService } from "@/server/modules/boards/card.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string; cardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId, cardId } = await context.params;
    const card = await cardService.getCardById(
      workspaceId,
      boardId,
      cardId,
      user.id
    );
    return successResponse(card, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string; cardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId, cardId } = await context.params;
    const json = await request.json();
    const input = updateCardSchema.parse(json);

    const card = await cardService.updateCard(
      workspaceId,
      boardId,
      cardId,
      user.id,
      input
    );

    return successResponse(card, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string; cardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId, cardId } = await context.params;
    await cardService.deleteCard(workspaceId, boardId, cardId, user.id);
    return successResponse({ message: "Card deleted successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
