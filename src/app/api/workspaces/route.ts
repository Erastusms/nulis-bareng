import { NextRequest } from "next/server";
import { createWorkspaceSchema } from "@/features/workspace/schemas/workspace.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceService } from "@/server/modules/workspaces/workspace.service";

export async function GET() {
  try {
    const user = await requireAuth();
    const workspaces = await workspaceService.getUserWorkspaces(user.id);
    return successResponse(workspaces, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();
    const json = await request.json();
    const input = createWorkspaceSchema.parse(json);

    const workspace = await workspaceService.createWorkspace({
      name: input.name,
      slug: input.slug,
      description: input.description,
      ownerId: user.id,
    });

    return successResponse(workspace, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
