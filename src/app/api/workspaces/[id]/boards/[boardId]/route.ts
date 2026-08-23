import { NextRequest } from "next/server";
import { updateBoardSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { boardService } from "@/server/modules/boards/board.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    const board = await boardService.getBoardById(workspaceId, boardId, user.id);
    return successResponse(board, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    const json = await request.json();
    const input = updateBoardSchema.parse(json);

    const board = await boardService.updateBoard(workspaceId, boardId, user.id, input);
    return successResponse(board, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    await boardService.deleteBoard(workspaceId, boardId, user.id);
    return successResponse({ message: "Board deleted successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
