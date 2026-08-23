import { useMutation, useQueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import type { Board } from "@/types/domain";
import {
  createColumn,
  deleteColumn,
  reorderColumns,
  updateColumn,
} from "../api/column-api";
import type {
  CreateColumnInput,
  ReorderColumnsInput,
  UpdateColumnInput,
} from "../schemas/board.schema";

/**
 * Mutation hook to create a new column in a board.
 */
export function useCreateColumn(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateColumnInput) => createColumn(workspaceId, boardId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to update a column (rename, color, position).
 */
export function useUpdateColumn(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      columnId,
      data,
    }: {
      columnId: string;
      data: UpdateColumnInput;
    }) => updateColumn(workspaceId, boardId, columnId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to delete a column.
 */
export function useDeleteColumn(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (columnId: string) => deleteColumn(workspaceId, boardId, columnId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}

/**
 * Mutation hook to reorder columns with optimistic UI updates.
 */
export function useReorderColumns(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ReorderColumnsInput) => reorderColumns(workspaceId, boardId, data),
    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: boardKeys.detail(boardId) });

      const previousBoard = queryClient.getQueryData<Board>(boardKeys.detail(boardId));

      if (previousBoard && previousBoard.columns) {
        const columnMap = new Map(previousBoard.columns.map((col) => [col.id, col]));
        const reordered = newOrder.columnIds
          .map((id, index) => {
            const col = columnMap.get(id);
            return col ? { ...col, position: index } : null;
          })
          .filter(Boolean) as typeof previousBoard.columns;

        queryClient.setQueryData<Board>(boardKeys.detail(boardId), {
          ...previousBoard,
          columns: reordered,
        });
      }

      return { previousBoard };
    },
    onError: (_err, _newOrder, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(boardKeys.detail(boardId), context.previousBoard);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
    },
  });
}
