import { NextRequest } from "next/server";
import { updateColumnSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { boardColumnService } from "@/server/modules/boards/board-column.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string; columnId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId, columnId } = await context.params;
    const json = await request.json();
    const input = updateColumnSchema.parse(json);

    const column = await boardColumnService.updateColumn(
      workspaceId,
      boardId,
      columnId,
      user.id,
      input
    );

    return successResponse(column, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string; columnId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId, columnId } = await context.params;
    await boardColumnService.deleteColumn(workspaceId, boardId, columnId, user.id);
    return successResponse({ message: "Column deleted successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
