import { NextRequest } from "next/server";
import { createBoardSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { boardService } from "@/server/modules/boards/board.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const boards = await boardService.getBoards(workspaceId, user.id);
    return successResponse(boards, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId } = await context.params;
    const json = await request.json();
    const input = createBoardSchema.parse(json);

    const board = await boardService.createBoard(workspaceId, user.id, {
      title: input.title,
      description: input.description,
    });

    return successResponse(board, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
