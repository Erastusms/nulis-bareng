import { apiClient } from "@/lib/api/client";
import type { Board } from "@/types/domain";
import type { CreateBoardInput, UpdateBoardInput } from "../schemas/board.schema";

export async function getBoards(workspaceId: string): Promise<Board[]> {
  return apiClient.get<Board[]>(`/workspaces/${workspaceId}/boards`);
}

export async function getBoardById(
  workspaceId: string,
  boardId: string
): Promise<Board> {
  return apiClient.get<Board>(`/workspaces/${workspaceId}/boards/${boardId}`);
}

export async function createBoard(
  workspaceId: string,
  input: CreateBoardInput
): Promise<Board> {
  return apiClient.post<Board>(`/workspaces/${workspaceId}/boards`, input);
}

export async function updateBoard(
  workspaceId: string,
  boardId: string,
  input: UpdateBoardInput
): Promise<Board> {
  return apiClient.patch<Board>(`/workspaces/${workspaceId}/boards/${boardId}`, input);
}

export async function deleteBoard(
  workspaceId: string,
  boardId: string
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(
    `/workspaces/${workspaceId}/boards/${boardId}`
  );
}
