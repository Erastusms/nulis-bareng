import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const user = await requireAuth();
    const { id, userId: targetUserId } = await context.params;

    await workspaceMemberService.removeMember(id, user.id, targetUserId);
    return successResponse({ message: "Member removed successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
