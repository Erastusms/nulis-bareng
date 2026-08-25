import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import http from "http";
import WebSocket from "ws";
import type { ErrorMessage, SubscribedMessage } from "@/lib/realtime/events";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { createWebSocketServer } from "./ws-server";
import { ConnectionManager } from "./connection-manager";
import { RoomManager } from "./room-manager";

describe("WebSocketServer E2E / Integration", () => {
  let server: http.Server;
  let wss: ReturnType<typeof createWebSocketServer>;
  let port: number;
  let connManager: ConnectionManager;
  let rooms: RoomManager;

  const mockUser = {
    id: "usr_ws_test",
    email: "wstest@example.com",
    name: "WS Tester",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    connManager = new ConnectionManager();
    rooms = new RoomManager();

    server = http.createServer();
    wss = createWebSocketServer({ server, connManager, rooms });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    wss.close();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should reject connection if unauthenticated", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue(null);

    const client = new WebSocket(`ws://localhost:${port}`);

    const errorReceived = await new Promise<string>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") {
          resolve(msg.code);
        }
      });
      client.on("close", (code) => {
        if (code === 4401) resolve("CLOSED_4401");
      });
    });

    expect(["UNAUTHORIZED", "CLOSED_4401"]).toContain(errorReceived);
  });

  it("should accept connection with valid session and respond to ping", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "valid_token_123",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      },
    });

    const client = new WebSocket(`ws://localhost:${port}?token=valid_token_123`);

    await new Promise<void>((resolve) => {
      client.on("open", () => resolve());
    });

    const pongPromise = new Promise<string>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "pong") {
          resolve("pong");
        }
      });
    });

    client.send(JSON.stringify({ type: "ping" }));
    const result = await pongPromise;
    expect(result).toBe("pong");

    client.close();
  });

  it("should handle subscribe to authorized workspace", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "valid_token_123",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      },
    });

    vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue({
      id: "ws_allowed",
      name: "Allowed WS",
      slug: "ws-allowed",
      urlIdentifier: "ws_allowed",
      description: null,
      ownerId: mockUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      memberCount: 1,
    });

    vi.spyOn(workspaceMemberRepository, "findByWorkspaceAndUser").mockResolvedValue({
      id: "mem_1",
      workspaceId: "ws_allowed",
      userId: mockUser.id,
      role: "MEMBER",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const client = new WebSocket(`ws://localhost:${port}?token=valid_token_123`);

    await new Promise<void>((resolve) => {
      client.on("open", () => resolve());
    });

    const subPromise = new Promise<SubscribedMessage>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "subscribed") {
          resolve(msg as SubscribedMessage);
        }
      });
    });

    client.send(JSON.stringify({ type: "subscribe", workspaceId: "ws_allowed" }));
    const response = await subPromise;

    expect(response).toEqual({
      type: "subscribed",
      workspaceId: "ws_allowed",
    });

    client.close();
  });

  it("should reject subscribe to unauthorized workspace", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "valid_token_123",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      },
    });

    vi.spyOn(workspaceRepository, "findByIdOrUrlIdentifier").mockResolvedValue(null);

    const client = new WebSocket(`ws://localhost:${port}?token=valid_token_123`);

    await new Promise<void>((resolve) => {
      client.on("open", () => resolve());
    });

    const errPromise = new Promise<ErrorMessage>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") {
          resolve(msg as ErrorMessage);
        }
      });
    });

    client.send(JSON.stringify({ type: "subscribe", workspaceId: "ws_forbidden" }));
    const response = await errPromise;

    expect(response.type).toBe("error");
    expect(response.code).toBe("FORBIDDEN");
    expect(response.workspaceId).toBe("ws_forbidden");

    client.close();
  });

  it("should handle invalid JSON payload safely", async () => {
    vi.spyOn(authService, "validateSession").mockResolvedValue({
      user: mockUser,
      session: {
        id: "sess_1",
        sessionToken: "valid_token_123",
        userId: mockUser.id,
        expiresAt: new Date(Date.now() + 100000),
        createdAt: new Date(),
      },
    });

    const client = new WebSocket(`ws://localhost:${port}?token=valid_token_123`);

    await new Promise<void>((resolve) => {
      client.on("open", () => resolve());
    });

    const errPromise = new Promise<ErrorMessage>((resolve) => {
      client.on("message", (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === "error") {
          resolve(msg as ErrorMessage);
        }
      });
    });

    client.send("THIS IS NOT JSON");
    const response = await errPromise;

    expect(response.type).toBe("error");
    expect(response.code).toBe("INVALID_JSON");

    client.close();
  });
});
