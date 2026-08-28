import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { boardKeys } from "@/lib/query/query-keys";
import type { Board } from "@/types/domain";
import {
  createBoard,
  deleteBoard,
  getBoardById,
  getBoards,
  updateBoard,
} from "../api/board-api";
import type { CreateBoardInput, UpdateBoardInput } from "../schemas/board.schema";

/**
 * Hook to retrieve all boards belonging to a workspace.
 */
export function useBoards(workspaceId: string) {
  return useQuery<Board[]>({
    queryKey: boardKeys.lists(workspaceId),
    queryFn: () => getBoards(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

/**
 * Hook to retrieve a single board with columns and cards.
 */
export function useBoard(workspaceId: string, boardId: string) {
  return useQuery<Board>({
    queryKey: boardKeys.detail(boardId),
    queryFn: () => getBoardById(workspaceId, boardId),
    enabled: Boolean(workspaceId && boardId),
  });
}

/**
 * Mutation hook to create a new board.
 */
export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateBoardInput) => createBoard(workspaceId, data),
    onSuccess: (newBoard) => {
      queryClient.setQueryData(
        boardKeys.lists(workspaceId),
        (old: Board[] | undefined) => {
          if (!old) return [newBoard];
          const filtered = old.filter((b) => b.id !== newBoard.id);
          return [...filtered, newBoard];
        }
      );
      queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) });
    },
  });
}

/**
 * Mutation hook to update an existing board.
 */
export function useUpdateBoard(workspaceId: string, boardId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateBoardInput) => updateBoard(workspaceId, boardId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(boardKeys.detail(boardId), (old: Board | undefined) =>
        old ? { ...old, ...updated } : updated
      );
      queryClient.invalidateQueries({ queryKey: boardKeys.detail(boardId) });
      queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) });
    },
  });
}

/**
 * Mutation hook to delete a board.
 */
export function useDeleteBoard(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (boardId: string) => deleteBoard(workspaceId, boardId),
    onSuccess: (_, boardId) => {
      queryClient.removeQueries({ queryKey: boardKeys.detail(boardId) });
      queryClient.setQueryData(
        boardKeys.lists(workspaceId),
        (old: Board[] | undefined) => old?.filter((b) => b.id !== boardId) ?? []
      );
      queryClient.invalidateQueries({ queryKey: boardKeys.lists(workspaceId) });
    },
  });
}
