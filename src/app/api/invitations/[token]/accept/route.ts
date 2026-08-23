import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const user = await requireAuth();
    const { token } = await context.params;

    const result = await workspaceMemberService.acceptInvitation(token, user.id);
    return successResponse(result, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
