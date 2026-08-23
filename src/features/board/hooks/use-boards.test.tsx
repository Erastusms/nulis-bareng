import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useBoard,
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useUpdateBoard,
} from "./use-boards";
import * as boardApiModule from "../api/board-api";
import type { Board } from "@/types/domain";

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = "QueryClientTestWrapper";

  return Wrapper;
}

describe("Board Hooks (use-boards.ts)", () => {
  const mockBoard: Board = {
    id: "board_123",
    workspaceId: "ws_123",
    title: "Sprint 42",
    description: "Main development",
    position: 0,
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useBoards", () => {
    it("should fetch and return boards list", async () => {
      vi.spyOn(boardApiModule, "getBoards").mockResolvedValue([mockBoard]);

      const { result } = renderHook(() => useBoards("ws_123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([mockBoard]);
    });
  });

  describe("useBoard", () => {
    it("should fetch single board by id", async () => {
      vi.spyOn(boardApiModule, "getBoardById").mockResolvedValue(mockBoard);

      const { result } = renderHook(() => useBoard("ws_123", "board_123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockBoard);
    });
  });

  describe("useCreateBoard", () => {
    it("should create board and invalidate cache", async () => {
      vi.spyOn(boardApiModule, "createBoard").mockResolvedValue(mockBoard);

      const { result } = renderHook(() => useCreateBoard("ws_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ title: "Sprint 42" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockBoard);
    });
  });

  describe("useUpdateBoard", () => {
    it("should update board", async () => {
      const updated = { ...mockBoard, title: "Sprint 42 (Renamed)" };
      vi.spyOn(boardApiModule, "updateBoard").mockResolvedValue(updated);

      const { result } = renderHook(() => useUpdateBoard("ws_123", "board_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ title: "Sprint 42 (Renamed)" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(updated);
    });
  });

  describe("useDeleteBoard", () => {
    it("should delete board", async () => {
      vi.spyOn(boardApiModule, "deleteBoard").mockResolvedValue({
        message: "Board deleted successfully.",
      });

      const { result } = renderHook(() => useDeleteBoard("ws_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate("board_123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });
});
