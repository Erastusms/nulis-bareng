import { apiClient } from "@/lib/api/client";

/**
 * Removes a member from a workspace.
 */
export async function removeWorkspaceMember(
  workspaceId: string,
  userId: string
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(
    `/workspaces/${workspaceId}/members/${userId}`
  );
}
