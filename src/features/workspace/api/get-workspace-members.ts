import { apiClient } from "@/lib/api/client";
import type { WorkspaceMember } from "@/types/domain";

/**
 * Fetches all members for a given workspace.
 */
export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  return apiClient.get<WorkspaceMember[]>(`/workspaces/${workspaceId}/members`);
}
