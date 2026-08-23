import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaces, useWorkspace, useCreateWorkspace, useUpdateWorkspace } from "./use-workspaces";
import * as getWorkspacesModule from "../api/get-workspaces";
import * as createWorkspaceModule from "../api/create-workspace";
import * as updateWorkspaceModule from "../api/update-workspace";
import type { Workspace } from "@/types/domain";

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

describe("Workspace Hooks (use-workspaces.ts)", () => {
  const mockWorkspace: Workspace = {
    id: "ws_123",
    name: "Engineering",
    slug: "engineering",
    urlIdentifier: "engineering-user1-08232026",
    description: "Dev team",
    ownerId: "user_1",
    role: "OWNER",
    currentUserRole: "OWNER",
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useWorkspaces", () => {
    it("should fetch and return workspaces list", async () => {
      vi.spyOn(getWorkspacesModule, "getWorkspaces").mockResolvedValue([mockWorkspace]);

      const { result } = renderHook(() => useWorkspaces(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([mockWorkspace]);
    });
  });

  describe("useWorkspace", () => {
    it("should fetch single workspace by id", async () => {
      vi.spyOn(getWorkspacesModule, "getWorkspaceById").mockResolvedValue(mockWorkspace);

      const { result } = renderHook(() => useWorkspace("ws_123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockWorkspace);
    });
  });

  describe("useCreateWorkspace", () => {
    it("should create workspace and update query state", async () => {
      vi.spyOn(createWorkspaceModule, "createWorkspace").mockResolvedValue(mockWorkspace);

      const { result } = renderHook(() => useCreateWorkspace(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: "Engineering",
        slug: "engineering",
        description: "Dev team",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockWorkspace);
    });
  });

  describe("useUpdateWorkspace", () => {
    it("should update workspace", async () => {
      const updated = { ...mockWorkspace, name: "Engineering V2" };
      vi.spyOn(updateWorkspaceModule, "updateWorkspace").mockResolvedValue(updated);

      const { result } = renderHook(() => useUpdateWorkspace("ws_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ name: "Engineering V2" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(updated);
    });
  });
});
