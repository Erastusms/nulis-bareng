import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { workspaceAuth } from "@/server/modules/workspaces/workspace-authorization";
import { presenceService } from "@/server/redis/presence.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;

    const authContext = await workspaceAuth.requireWorkspaceAccess(user.id, id);
    const workspaceId = authContext.workspace?.id || authContext.member.workspaceId;


    const members = await workspaceMemberRepository.findMembersByWorkspaceId(workspaceId);
    const memberUserIds = members.map((m) => m.userId);
    if (!memberUserIds.includes(user.id)) {
      memberUserIds.push(user.id);
    }


    const presenceList = await presenceService.getWorkspacePresence(memberUserIds);

    return successResponse(presenceList, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
