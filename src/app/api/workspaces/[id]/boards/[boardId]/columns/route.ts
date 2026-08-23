import { NextRequest } from "next/server";
import { createColumnSchema } from "@/features/board/schemas/board.schema";
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
    const input = createColumnSchema.parse(json);

    const column = await boardColumnService.createColumn(
      workspaceId,
      boardId,
      user.id,
      input
    );

    return successResponse(column, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
