import { apiClient } from "@/lib/api/client";
import type { Page, PageSummary } from "@/types/domain";
import type { CreatePageInput, UpdatePageInput } from "../schemas/document.schema";

export async function getPages(workspaceId: string): Promise<PageSummary[]> {
  return apiClient.get<PageSummary[]>(`/workspaces/${workspaceId}/pages`);
}

export async function getPageById(pageId: string): Promise<Page> {
  return apiClient.get<Page>(`/pages/${pageId}`);
}

export async function createPage(
  workspaceId: string,
  input?: CreatePageInput
): Promise<Page> {
  return apiClient.post<Page>(`/workspaces/${workspaceId}/pages`, input ?? {});
}

export async function updatePage(
  pageId: string,
  input: UpdatePageInput
): Promise<Page> {
  return apiClient.patch<Page>(`/pages/${pageId}`, input);
}

export async function deletePage(
  pageId: string
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(`/pages/${pageId}`);
}
