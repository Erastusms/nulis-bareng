import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const details = await workspaceMemberService.getInvitationByToken(token);
    return successResponse(details, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
