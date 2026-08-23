import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useCurrentUser, useLogin, useLogout, useRegister } from "./use-auth";
import * as getCurrentUserModule from "../api/get-current-user";
import * as loginModule from "../api/login";
import * as registerModule from "../api/register";
import * as logoutModule from "../api/logout";

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


const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

describe("Authentication Hooks (use-auth.ts)", () => {
  const mockUser = {
    id: "user_1",
    name: "Alex Morgan",
    email: "alex@example.com",
    avatarUrl: null,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPush.mockClear();
    mockRefresh.mockClear();
  });

  describe("useCurrentUser", () => {
    it("should fetch and return current user data", async () => {
      vi.spyOn(getCurrentUserModule, "getCurrentUser").mockResolvedValue(mockUser);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockUser);
    });

    it("should return null when unauthenticated", async () => {
      vi.spyOn(getCurrentUserModule, "getCurrentUser").mockResolvedValue(null);

      const { result } = renderHook(() => useCurrentUser(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBeNull();
    });
  });

  describe("useLogin", () => {
    it("should execute login mutation successfully", async () => {
      vi.spyOn(loginModule, "loginUser").mockResolvedValue({ user: mockUser });

      const { result } = renderHook(() => useLogin(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({ email: "alex@example.com", password: "Password123!" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ user: mockUser });
    });
  });

  describe("useRegister", () => {
    it("should execute register mutation successfully", async () => {
      vi.spyOn(registerModule, "registerUser").mockResolvedValue({ user: mockUser });

      const { result } = renderHook(() => useRegister(), {
        wrapper: createWrapper(),
      });

      result.current.mutate({
        name: "Alex Morgan",
        email: "alex@example.com",
        password: "Password123!",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ user: mockUser });
    });
  });

  describe("useLogout", () => {
    it("should execute logout mutation successfully", async () => {
      vi.spyOn(logoutModule, "logoutUser").mockResolvedValue({
        message: "Logged out successfully.",
      });

      const { result } = renderHook(() => useLogout(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ message: "Logged out successfully." });
      expect(mockPush).toHaveBeenCalledWith("/home");
    });
  });
});
