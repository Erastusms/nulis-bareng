"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { documentKeys } from "@/lib/query/query-keys";
import {
  createPage,
  deletePage,
  getPageById,
  getPages,
  updatePage,
} from "../api/document-api";
import type { CreatePageInput, UpdatePageInput } from "../schemas/document.schema";
import type { Page, PageSummary } from "@/types/domain";

/**
 * Hook to retrieve all page summaries for a workspace.
 */
export function usePages(workspaceId: string) {
  return useQuery<PageSummary[]>({
    queryKey: documentKeys.lists(workspaceId),
    queryFn: () => getPages(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 1000 * 60, // 1 minute
  });
}

/**
 * Hook to retrieve full detail for a single page.
 */
export function usePage(pageId?: string, enabled = true) {
  return useQuery<Page>({
    queryKey: documentKeys.detail(pageId || ""),
    queryFn: () => getPageById(pageId!),
    enabled: Boolean(pageId) && enabled,
    staleTime: 1000 * 30,
  });
}

/**
 * Hook to create a new page in a workspace with optimistic list update.
 */
export function useCreatePage(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input?: CreatePageInput) => createPage(workspaceId, input),
    onSuccess: (newPage) => {
      const summary: PageSummary = {
        id: newPage.id,
        workspaceId: newPage.workspaceId,
        title: newPage.title,
        createdAt: newPage.createdAt,
        updatedAt: newPage.updatedAt,
      };

      queryClient.setQueryData<PageSummary[]>(
        documentKeys.lists(workspaceId),
        (old = []) => {
          const filtered = old.filter((p) => p.id !== newPage.id);
          return [summary, ...filtered];
        }
      );
      queryClient.setQueryData<Page>(documentKeys.detail(newPage.id), newPage);
    },
  });
}

/**
 * Hook to update a page (title or content).
 */
export function useUpdatePage(pageId: string, workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePageInput) => updatePage(pageId, input),
    onSuccess: (updatedPage) => {
      queryClient.setQueryData<Page>(documentKeys.detail(pageId), updatedPage);

      const targetWorkspaceId = workspaceId || updatedPage.workspaceId;
      if (targetWorkspaceId) {
        queryClient.setQueryData<PageSummary[]>(
          documentKeys.lists(targetWorkspaceId),
          (old = []) =>
            old.map((p) =>
              p.id === pageId
                ? {
                    ...p,
                    title: updatedPage.title,
                    updatedAt: updatedPage.updatedAt,
                  }
                : p
            )
        );
      }
    },
  });
}

/**
 * Hook to delete a page with cache cleanup.
 */
export function useDeletePage(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (pageId: string) => deletePage(pageId),
    onSuccess: (_, pageId) => {
      queryClient.setQueryData<PageSummary[]>(
        documentKeys.lists(workspaceId),
        (old = []) => old.filter((p) => p.id !== pageId)
      );
      queryClient.removeQueries({ queryKey: documentKeys.detail(pageId) });
    },
  });
}
