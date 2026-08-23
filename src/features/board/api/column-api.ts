import { apiClient } from "@/lib/api/client";
import type { BoardColumn } from "@/types/domain";
import type {
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "../schemas/board.schema";

export async function createColumn(
  workspaceId: string,
  boardId: string,
  input: CreateColumnInput
): Promise<BoardColumn> {
  return apiClient.post<BoardColumn>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns`,
    input
  );
}

export async function updateColumn(
  workspaceId: string,
  boardId: string,
  columnId: string,
  input: UpdateColumnInput
): Promise<BoardColumn> {
  return apiClient.patch<BoardColumn>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`,
    input
  );
}

export async function deleteColumn(
  workspaceId: string,
  boardId: string,
  columnId: string
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns/${columnId}`
  );
}

export async function reorderColumns(
  workspaceId: string,
  boardId: string,
  input: ReorderColumnsInput
): Promise<BoardColumn[]> {
  return apiClient.patch<BoardColumn[]>(
    `/workspaces/${workspaceId}/boards/${boardId}/columns/reorder`,
    input
  );
}
