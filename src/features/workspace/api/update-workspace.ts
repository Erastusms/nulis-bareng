import { apiClient } from "@/lib/api/client";
import type { Workspace } from "@/types/domain";
import type { UpdateWorkspaceInput } from "../schemas/workspace.schema";

/**
 * Updates an existing workspace.
 */
export async function updateWorkspace(
  id: string,
  data: UpdateWorkspaceInput
): Promise<Workspace> {
  return apiClient.patch<Workspace>(`/workspaces/${id}`, data);
}

/**
 * Deletes a workspace.
 */
export async function deleteWorkspace(id: string): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/workspaces/${id}`);
}
