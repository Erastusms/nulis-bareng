import { apiClient } from "@/lib/api/client";
import type { Workspace } from "@/types/domain";

/**
 * Fetches workspaces for the currently authenticated user.
 */
export async function getWorkspaces(): Promise<Workspace[]> {
  return apiClient.get<Workspace[]>("/workspaces");
}

/**
 * Fetches single workspace details by ID.
 */
export async function getWorkspaceById(id: string): Promise<Workspace> {
  return apiClient.get<Workspace>(`/workspaces/${id}`);
}
