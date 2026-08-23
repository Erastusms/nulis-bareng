import { NextRequest } from "next/server";
import { updateWorkspaceSchema } from "@/features/workspace/schemas/workspace.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceService } from "@/server/modules/workspaces/workspace.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const workspace = await workspaceService.getWorkspaceById(id, user.id);
    return successResponse(workspace, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const json = await request.json();
    const input = updateWorkspaceSchema.parse(json);

    const workspace = await workspaceService.updateWorkspace(id, user.id, input);
    return successResponse(workspace, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    await workspaceService.deleteWorkspace(id, user.id);
    return successResponse({ message: "Workspace deleted successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
