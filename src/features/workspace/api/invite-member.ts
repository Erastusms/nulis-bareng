import { apiClient } from "@/lib/api/client";
import type { InviteMemberResult } from "@/server/modules/workspaces/workspace-member.service";
import type { InviteMemberInput } from "../schemas/workspace.schema";

/**
 * Invites or adds a member to a workspace by email.
 */
export async function inviteWorkspaceMember(
  workspaceId: string,
  data: InviteMemberInput
): Promise<InviteMemberResult> {
  return apiClient.post<InviteMemberResult>(`/workspaces/${workspaceId}/members`, data);
}
