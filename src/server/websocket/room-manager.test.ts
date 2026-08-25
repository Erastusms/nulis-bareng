import { describe, it, expect, beforeEach } from "vitest";
import type { WebSocket } from "ws";
import type { User } from "@/types/domain";
import { ConnectionManager } from "./connection-manager";
import { RoomManager } from "./room-manager";

describe("RoomManager", () => {
  let roomManager: RoomManager;
  let connManager: ConnectionManager;

  const mockUser: User = {
    id: "user_1",
    email: "user1@example.com",
    name: "User One",
    avatarUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    roomManager = new RoomManager();
    connManager = new ConnectionManager();
  });

  it("should subscribe a socket to a workspace room", () => {
    const socket = {} as WebSocket;
    connManager.addConnection(socket, mockUser);

    const subscribed = roomManager.subscribe("ws_100", socket, connManager);
    expect(subscribed).toBe(true);

    const socketsInRoom = roomManager.getSocketsInRoom("ws_100");
    expect(socketsInRoom.length).toBe(1);
    expect(socketsInRoom[0]).toBe(socket);

    const conn = connManager.getConnection(socket);
    expect(conn?.subscribedWorkspaces.has("ws_100")).toBe(true);
  });

  it("should be idempotent when subscribing an already-subscribed socket", () => {
    const socket = {} as WebSocket;
    connManager.addConnection(socket, mockUser);

    expect(roomManager.subscribe("ws_100", socket, connManager)).toBe(true);
    expect(roomManager.subscribe("ws_100", socket, connManager)).toBe(false);
    expect(roomManager.getRoomSubscribersCount("ws_100")).toBe(1);
  });

  it("should unsubscribe a socket from a workspace room", () => {
    const socket = {} as WebSocket;
    connManager.addConnection(socket, mockUser);
    roomManager.subscribe("ws_100", socket, connManager);

    const unsubscribed = roomManager.unsubscribe("ws_100", socket, connManager);
    expect(unsubscribed).toBe(true);
    expect(roomManager.getSocketsInRoom("ws_100")).toEqual([]);
    expect(roomManager.getRoomSubscribersCount("ws_100")).toBe(0);

    const conn = connManager.getConnection(socket);
    expect(conn?.subscribedWorkspaces.has("ws_100")).toBe(false);
  });

  it("should isolate multiple workspace rooms", () => {
    const socket1 = {} as WebSocket;
    const socket2 = {} as WebSocket;
    connManager.addConnection(socket1, mockUser);
    connManager.addConnection(socket2, mockUser);

    roomManager.subscribe("ws_A", socket1, connManager);
    roomManager.subscribe("ws_B", socket2, connManager);

    expect(roomManager.getSocketsInRoom("ws_A")).toEqual([socket1]);
    expect(roomManager.getSocketsInRoom("ws_B")).toEqual([socket2]);
  });

  it("should remove socket from all rooms on leaveAll", () => {
    const socket = {} as WebSocket;
    connManager.addConnection(socket, mockUser);

    roomManager.subscribe("ws_A", socket, connManager);
    roomManager.subscribe("ws_B", socket, connManager);
    expect(roomManager.getRoomSubscribersCount("ws_A")).toBe(1);
    expect(roomManager.getRoomSubscribersCount("ws_B")).toBe(1);

    roomManager.leaveAll(socket, connManager);

    expect(roomManager.getRoomSubscribersCount("ws_A")).toBe(0);
    expect(roomManager.getRoomSubscribersCount("ws_B")).toBe(0);
  });
});
