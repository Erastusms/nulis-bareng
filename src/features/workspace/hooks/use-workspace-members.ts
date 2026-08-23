import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceKeys } from "@/lib/query/query-keys";
import type { WorkspaceMember } from "@/types/domain";
import { getWorkspaceMembers } from "../api/get-workspace-members";
import { inviteWorkspaceMember } from "../api/invite-member";
import { removeWorkspaceMember } from "../api/remove-member";
import type { InviteMemberInput } from "../schemas/workspace.schema";

/**
 * Hook to retrieve all members of a workspace.
 */
export function useWorkspaceMembers(workspaceId: string) {
  return useQuery<WorkspaceMember[]>({
    queryKey: workspaceKeys.members(workspaceId),
    queryFn: () => getWorkspaceMembers(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

/**
 * Mutation hook to invite or add a member to a workspace.
 */
export function useInviteMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InviteMemberInput) => inviteWorkspaceMember(workspaceId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    },
  });
}

/**
 * Mutation hook to remove a member from a workspace.
 */
export function useRemoveMember(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (targetUserId: string) => removeWorkspaceMember(workspaceId, targetUserId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.members(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    },
  });
}
