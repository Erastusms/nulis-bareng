import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workspaceKeys } from "@/lib/query/query-keys";
import type { Workspace } from "@/types/domain";
import { createWorkspace } from "../api/create-workspace";
import { getWorkspaceById, getWorkspaces } from "../api/get-workspaces";
import { deleteWorkspace, updateWorkspace } from "../api/update-workspace";
import type { CreateWorkspaceInput, UpdateWorkspaceInput } from "../schemas/workspace.schema";

/**
 * Hook to retrieve all workspaces where user is an active member or owner.
 */
export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: workspaceKeys.lists(),
    queryFn: () => getWorkspaces(),
  });
}

/**
 * Hook to retrieve a single workspace detail.
 */
export function useWorkspace(id: string) {
  return useQuery<Workspace>({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => getWorkspaceById(id),
    enabled: Boolean(id),
  });
}

/**
 * Mutation hook to create a new workspace.
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkspaceInput) => createWorkspace(data),
    onSuccess: (newWorkspace) => {
      queryClient.setQueryData(
        workspaceKeys.lists(),
        (old: Workspace[] | undefined) => (old ? [newWorkspace, ...old] : [newWorkspace])
      );
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });
}

/**
 * Mutation hook to update workspace settings.
 */
export function useUpdateWorkspace(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateWorkspaceInput) => updateWorkspace(workspaceId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(workspaceKeys.detail(workspaceId), updated);
      queryClient.invalidateQueries({ queryKey: workspaceKeys.detail(workspaceId) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });
}

/**
 * Mutation hook to delete a workspace.
 */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteWorkspace(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
    },
  });
}
