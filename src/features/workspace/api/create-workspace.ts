import { apiClient } from "@/lib/api/client";
import type { Workspace } from "@/types/domain";
import type { CreateWorkspaceInput } from "../schemas/workspace.schema";

/**
 * Creates a new workspace and assigns creator as OWNER.
 */
export async function createWorkspace(data: CreateWorkspaceInput): Promise<Workspace> {
  return apiClient.post<Workspace>("/workspaces", data);
}
