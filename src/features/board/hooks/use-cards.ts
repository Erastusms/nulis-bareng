import { useMutation, useQueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import type { Board, Card } from "@/types/domain";
import {
  createCard,
  deleteCard,
  moveCard,
  updateCard,
} from "../api/card-api";
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from "../schemas/board.schema";

/**
 * Mutation hook to create a new card in a column.
 */
export function useCreateCard(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCardInput) => createCard(workspaceId, boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to update a card's details.
 */
export function useUpdateCard(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      cardId,
      data,
    }: {
      cardId: string;
      data: UpdateCardInput;
    }) => updateCard(workspaceId, boardId, cardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to delete a card.
 */
export function useDeleteCard(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cardId: string) => deleteCard(workspaceId, boardId, cardId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to move / reorder cards with optimistic UI updates.
 */
export function useMoveCard(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MoveCardInput) => moveCard(workspaceId, boardId, data),
    onMutate: async (moveInput) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardKeys.detail(boardId));

      if (previousBoard && previousBoard.columns) {
        // Deep copy columns and cards
        const newColumns = previousBoard.columns.map((col) => ({
          ...col,
          cards: [...(col.cards || [])],
        }));

        const sourceCol = newColumns.find((c) => c.id === moveInput.sourceColumnId);
        const targetCol = newColumns.find((c) => c.id === moveInput.targetColumnId);

        if (sourceCol && targetCol) {
          const cardIndex = sourceCol.cards.findIndex((c) => c.id === moveInput.cardId);
          if (cardIndex !== -1) {
            const [movedCard] = sourceCol.cards.splice(cardIndex, 1);
            const updatedCard: Card = {
              ...movedCard,
              columnId: moveInput.targetColumnId,
            };

            const insertIndex = Math.max(
              0,
              Math.min(moveInput.targetPosition, targetCol.cards.length)
            );
            targetCol.cards.splice(insertIndex, 0, updatedCard);

            // Re-index positions
            sourceCol.cards.forEach((c, idx) => {
              c.position = idx;
            });
            if (sourceCol.id !== targetCol.id) {
              targetCol.cards.forEach((c, idx) => {
                c.position = idx;
              });
            }

            queryClient.setQueryData<Board>(boardKeys.detail(boardId), {
              ...previousBoard,
              columns: newColumns,
            });
          }
        }
      }

      return { previousBoard };
    },
    onError: (_err, _moveInput, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previousBoard);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}
