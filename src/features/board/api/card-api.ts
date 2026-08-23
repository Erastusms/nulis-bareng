import { apiClient } from "@/lib/api/client";
import type { Card } from "@/types/domain";
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from "../schemas/board.schema";

export async function getCardById(
  workspaceId: string,
  boardId: string,
  cardId: string
): Promise<Card> {
  return apiClient.get<Card>(
    `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`
  );
}

export async function createCard(
  workspaceId: string,
  boardId: string,
  input: CreateCardInput
): Promise<Card> {
  return apiClient.post<Card>(
    `/workspaces/${workspaceId}/boards/${boardId}/cards`,
    input
  );
}

export async function updateCard(
  workspaceId: string,
  boardId: string,
  cardId: string,
  input: UpdateCardInput
): Promise<Card> {
  return apiClient.patch<Card>(
    `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`,
    input
  );
}

export async function deleteCard(
  workspaceId: string,
  boardId: string,
  cardId: string
): Promise<{ message: string }> {
  return apiClient.delete<{ message: string }>(
    `/workspaces/${workspaceId}/boards/${boardId}/cards/${cardId}`
  );
}

export async function moveCard(
  workspaceId: string,
  boardId: string,
  input: MoveCardInput
): Promise<Card> {
  return apiClient.post<Card>(
    `/workspaces/${workspaceId}/boards/${boardId}/cards/move`,
    input
  );
}
