import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWorkspaceMembers, useInviteMember, useRemoveMember } from "./use-workspace-members";
import * as getWorkspaceMembersModule from "../api/get-workspace-members";
import * as inviteMemberModule from "../api/invite-member";
import * as removeMemberModule from "../api/remove-member";
import type { WorkspaceMember } from "@/types/domain";

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

describe("Workspace Members Hooks (use-workspace-members.ts)", () => {
  const mockMember: WorkspaceMember = {
    id: "mem_1",
    workspaceId: "ws_123",
    userId: "user_1",
    role: "OWNER",
    joinedAt: "2026-08-16T12:00:00.000Z",
    user: {
      id: "user_1",
      name: "Alex Morgan",
      email: "alex@example.com",
      avatarUrl: null,
      createdAt: "2026-08-16T12:00:00.000Z",
      updatedAt: "2026-08-16T12:00:00.000Z",
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("useWorkspaceMembers", () => {
    it("should fetch and return workspace members list", async () => {
      vi.spyOn(getWorkspaceMembersModule, "getWorkspaceMembers").mockResolvedValue([mockMember]);

      const { result } = renderHook(() => useWorkspaceMembers("ws_123"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([mockMember]);
    });
  });

  describe("useInviteMember", () => {
    it("should invite member successfully", async () => {
      vi.spyOn(inviteMemberModule, "inviteWorkspaceMember").mockResolvedValue({
        type: "invitation_created",
        invitation: {
          id: "inv_1",
          email: "alex@example.com",
          role: "MEMBER",
          expiresAt: "2026-08-23T12:00:00.000Z",
        },
        emailDelivered: true,
      });

      const { result } = renderHook(() => useInviteMember("ws_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        email: "alex@example.com",
        role: "MEMBER",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.type).toBe("invitation_created");
      expect(result.current.data?.emailDelivered).toBe(true);
    });
  });

  describe("useRemoveMember", () => {
    it("should remove member successfully", async () => {
      vi.spyOn(removeMemberModule, "removeWorkspaceMember").mockResolvedValue({
        message: "Member removed successfully.",
      });

      const { result } = renderHook(() => useRemoveMember("ws_123"), {
        wrapper: createWrapper(),
      });

      result.current.mutate("user_1");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ message: "Member removed successfully." });
    });
  });
});
