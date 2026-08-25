import { NextRequest } from "next/server";
import { moveColumnSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { boardColumnService } from "@/server/modules/boards/board-column.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    const json = await request.json();
    const input = moveColumnSchema.parse(json);

    const movedColumn = await boardColumnService.moveColumn(
      workspaceId,
      boardId,
      user.id,
      input
    );

    return successResponse(movedColumn, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
