import { NextRequest } from "next/server";
import { inviteMemberSchema } from "@/features/workspace/schemas/workspace.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { requireAuth } from "@/server/auth/current-user";
import { workspaceMemberService } from "@/server/modules/workspaces/workspace-member.service";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const members = await workspaceMemberService.listMembers(id, user.id);
    return successResponse(members, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await context.params;
    const json = await request.json();
    const input = inviteMemberSchema.parse(json);

    const result = await workspaceMemberService.inviteMember(id, user.id, input);
    return successResponse(result, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
