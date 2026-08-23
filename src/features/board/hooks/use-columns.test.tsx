import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateColumn,
  useDeleteColumn,
  useReorderColumns,
  useUpdateColumn,
} from "./use-columns";
import * as columnApiModule from "../api/column-api";
import type { BoardColumn } from "@/types/domain";

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

describe("Column Hooks (use-columns.ts)", () => {
  const mockColumn: BoardColumn = {
    id: "col_1",
    boardId: "board_1",
    title: "To Do",
    position: 0,
    color: "#3b82f6",
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useCreateColumn", () => {
    it("should create column", async () => {
      vi.spyOn(columnApiModule, "createColumn").mockResolvedValue(mockColumn);

      const { result } = renderHook(() => useCreateColumn("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ title: "To Do", color: "#3b82f6" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockColumn);
    });
  });

  describe("useUpdateColumn", () => {
    it("should update column", async () => {
      const updated = { ...mockColumn, title: "In Progress" };
      vi.spyOn(columnApiModule, "updateColumn").mockResolvedValue(updated);

      const { result } = renderHook(() => useUpdateColumn("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        columnId: "col_1",
        data: { title: "In Progress" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(updated);
    });
  });

  describe("useDeleteColumn", () => {
    it("should delete column", async () => {
      vi.spyOn(columnApiModule, "deleteColumn").mockResolvedValue({
        message: "Column deleted successfully.",
      });

      const { result } = renderHook(() => useDeleteColumn("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate("col_1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useReorderColumns", () => {
    it("should reorder columns", async () => {
      vi.spyOn(columnApiModule, "reorderColumns").mockResolvedValue([mockColumn]);

      const { result } = renderHook(() => useReorderColumns("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ columnIds: ["col_1"] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([mockColumn]);
    });
  });
});
