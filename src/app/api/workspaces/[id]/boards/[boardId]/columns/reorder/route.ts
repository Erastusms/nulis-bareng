import { NextRequest } from "next/server";
import { reorderColumnsSchema } from "@/features/board/schemas/board.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { boardColumnService } from "@/server/modules/boards/board-column.service";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; boardId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: workspaceId, boardId } = await context.params;
    const json = await request.json();
    const input = reorderColumnsSchema.parse(json);

    const reordered = await boardColumnService.reorderColumns(
      workspaceId,
      boardId,
      user.id,
      input.columnIds
    );

    return successResponse(reordered, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
