import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as registerHandler } from "./register/route";
import { POST as loginHandler } from "./login/route";
import { POST as logoutHandler } from "./logout/route";
import { GET as meHandler } from "./me/route";
import { authService } from "@/server/modules/auth/auth.service";
import * as cookiesModule from "@/server/auth/cookies";
import * as currentUserModule from "@/server/auth/current-user";

describe("Authentication API Route Handlers", () => {
  const mockUser = {
    id: "user_123",
    name: "Alex Morgan",
    email: "alex@example.com",
    avatarUrl: null,
    createdAt: "2026-08-16T12:00:00.000Z",
    updatedAt: "2026-08-16T12:00:00.000Z",
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /api/auth/register", () => {
    it("should return 201 with safe user on successful registration", async () => {
      vi.spyOn(authService, "register").mockResolvedValue({
        user: mockUser,
        sessionToken: "sample_session_token",
        expiresAt: new Date(Date.now() + 100000),
      });
      vi.spyOn(cookiesModule, "setSessionTokenCookie").mockResolvedValue();

      const request = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Alex Morgan",
          email: "alex@example.com",
          password: "Password123!",
        }),
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user).toEqual(mockUser);
    });

    it("should return 400 when validation fails", async () => {
      const request = new NextRequest("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "A", // too short
          email: "invalid-email",
          password: "short",
        }),
      });

      const response = await registerHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("POST /api/auth/login", () => {
    it("should return 200 with safe user on valid credentials", async () => {
      vi.spyOn(authService, "login").mockResolvedValue({
        user: mockUser,
        sessionToken: "sample_session_token",
        expiresAt: new Date(Date.now() + 100000),
      });
      vi.spyOn(cookiesModule, "setSessionTokenCookie").mockResolvedValue();

      const request = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "alex@example.com",
          password: "Password123!",
        }),
      });

      const response = await loginHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toEqual(mockUser);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("should return 200 and clear session cookie", async () => {
      vi.spyOn(cookiesModule, "getSessionTokenFromCookies").mockResolvedValue("test-token");
      vi.spyOn(authService, "logout").mockResolvedValue(true);
      vi.spyOn(cookiesModule, "deleteSessionTokenCookie").mockResolvedValue();

      const response = await logoutHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toBe("Logged out successfully.");
    });
  });

  describe("GET /api/auth/me", () => {
    it("should return 200 with user when authenticated", async () => {
      vi.spyOn(currentUserModule, "getCurrentUser").mockResolvedValue(mockUser);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toEqual(mockUser);
    });

    it("should return 401 when unauthenticated", async () => {
      vi.spyOn(currentUserModule, "getCurrentUser").mockResolvedValue(null);

      const response = await meHandler();
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe("UNAUTHORIZED");
    });
  });
});
