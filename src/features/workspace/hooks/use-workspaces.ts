import { useQuery } from "@tanstack/react-query";
import { workspaceKeys } from "@/lib/query/query-keys";
import { getWorkspaceById, getWorkspaces } from "../api/get-workspaces";

/**
 * Hook to retrieve user's workspaces.
 */
export function useWorkspaces() {
  return useQuery({
    queryKey: workspaceKeys.lists(),
    queryFn: () => getWorkspaces(),
  });
}

/**
 * Hook to retrieve single workspace detail.
 */
export function useWorkspace(id: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => getWorkspaceById(id),
    enabled: Boolean(id),
  });
}
