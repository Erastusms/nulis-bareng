import { describe, it, expect, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import type { User } from "@/types/domain";
import { ConnectionManager } from "./connection-manager";

describe("ConnectionManager", () => {
  let connManager: ConnectionManager;

  const mockUser1: User = {
    id: "user_1",
    email: "user1@example.com",
    name: "User One",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockUser2: User = {
    id: "user_2",
    email: "user2@example.com",
    name: "User Two",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    connManager = new ConnectionManager();
  });

  it("should register a new client connection and track it", () => {
    const socket = {} as WebSocket;
    const conn = connManager.addConnection(socket, mockUser1);

    expect(conn.id).toBeDefined();
    expect(conn.user.id).toBe("user_1");
    expect(connManager.getConnectionCount()).toBe(1);
    expect(connManager.getConnection(socket)).toBe(conn);
  });

  it("should track multiple connections for the same user", () => {
    const socket1 = {} as WebSocket;
    const socket2 = {} as WebSocket;

    connManager.addConnection(socket1, mockUser1);
    connManager.addConnection(socket2, mockUser1);

    expect(connManager.getConnectionCount()).toBe(2);
    const userConns = connManager.getConnectionsByUserId("user_1");
    expect(userConns.length).toBe(2);
  });

  it("should properly clean up connection upon removal", () => {
    const socket = {} as WebSocket;
    connManager.addConnection(socket, mockUser1);
    expect(connManager.getConnectionCount()).toBe(1);

    const removed = connManager.removeConnection(socket);
    expect(removed).toBeDefined();
    expect(connManager.getConnectionCount()).toBe(0);
    expect(connManager.getConnection(socket)).toBeUndefined();
    expect(connManager.getConnectionsByUserId("user_1")).toEqual([]);
  });

  it("should return all active connections", () => {
    const socket1 = {} as WebSocket;
    const socket2 = {} as WebSocket;

    connManager.addConnection(socket1, mockUser1);
    connManager.addConnection(socket2, mockUser2);

    const all = connManager.getAllConnections();
    expect(all.length).toBe(2);
    expect(all.map((c) => c.user.id)).toContain("user_1");
    expect(all.map((c) => c.user.id)).toContain("user_2");
  });
});
