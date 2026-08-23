import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useCreateCard,
  useDeleteCard,
  useMoveCard,
  useUpdateCard,
} from "./use-cards";
import * as cardApiModule from "../api/card-api";
import type { Card } from "@/types/domain";

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

describe("Card Hooks (use-cards.ts)", () => {
  const mockCard: Card = {
    id: "card_1",
    columnId: "col_1",
    boardId: "board_1",
    title: "Write documentation",
    description: "API documentation",
    position: 0,
    dueDate: null,
    labels: ["Docs"],
    assigneeIds: [],
    createdAt: "2026-08-23T00:00:00.000Z",
    updatedAt: "2026-08-23T00:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useCreateCard", () => {
    it("should create card", async () => {
      vi.spyOn(cardApiModule, "createCard").mockResolvedValue(mockCard);

      const { result } = renderHook(() => useCreateCard("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        columnId: "col_1",
        title: "Write documentation",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockCard);
    });
  });

  describe("useUpdateCard", () => {
    it("should update card", async () => {
      const updated = { ...mockCard, title: "Write API docs" };
      vi.spyOn(cardApiModule, "updateCard").mockResolvedValue(updated);

      const { result } = renderHook(() => useUpdateCard("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        cardId: "card_1",
        data: { title: "Write API docs" },
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(updated);
    });
  });

  describe("useDeleteCard", () => {
    it("should delete card", async () => {
      vi.spyOn(cardApiModule, "deleteCard").mockResolvedValue({
        message: "Card deleted successfully.",
      });

      const { result } = renderHook(() => useDeleteCard("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate("card_1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
    });
  });

  describe("useMoveCard", () => {
    it("should move card", async () => {
      const moved = { ...mockCard, columnId: "col_2", position: 1 };
      vi.spyOn(cardApiModule, "moveCard").mockResolvedValue(moved);

      const { result } = renderHook(() => useMoveCard("ws_1", "board_1"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        cardId: "card_1",
        sourceColumnId: "col_1",
        targetColumnId: "col_2",
        targetPosition: 1,
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(moved);
    });
  });
});
