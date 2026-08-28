import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { activityService } from "@/server/modules/activities/activity.service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor") || undefined;

    let limit: number | undefined = undefined;
    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

    const result = await activityService.getWorkspaceActivities(id, user.id, {
      limit,
      cursor,
    });

    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
