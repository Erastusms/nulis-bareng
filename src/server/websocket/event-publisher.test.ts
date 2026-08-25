import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocket } from "ws";
import type { CardCreatedEvent } from "@/lib/realtime/events";
import { WebSocketEventPublisher } from "./event-publisher";
import { RoomManager } from "./room-manager";

describe("WebSocketEventPublisher", () => {
  let roomManager: RoomManager;
  let publisher: WebSocketEventPublisher;

  beforeEach(() => {
    roomManager = new RoomManager();
    publisher = new WebSocketEventPublisher(roomManager);
  });

  it("should broadcast domain event to all open sockets in the workspace room", async () => {
    const socket1 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const socket2 = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    roomManager.subscribe("ws_target", socket1);
    roomManager.subscribe("ws_target", socket2);

    const event: CardCreatedEvent = {
      eventId: "evt_123",
      type: "card.created",
      workspaceId: "ws_target",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "New Card",
        description: null,
        position: 0,
        dueDate: null,
        labels: [],
        assigneeIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      version: 1720000000,
      timestamp: new Date().toISOString(),
    };

    await publisher.publish(event);

    const serialized = JSON.stringify(event);
    expect(socket1.send).toHaveBeenCalledWith(serialized);
    expect(socket2.send).toHaveBeenCalledWith(serialized);
  });

  it("should not broadcast events to sockets in a different workspace", async () => {
    const socketA = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const socketB = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    roomManager.subscribe("ws_A", socketA);
    roomManager.subscribe("ws_B", socketB);

    const event: CardCreatedEvent = {
      eventId: "evt_123",
      type: "card.created",
      workspaceId: "ws_A",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Workspace A Card",
        position: 0,
        labels: [],
        assigneeIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      version: 1720000000,
      timestamp: new Date().toISOString(),
    };

    await publisher.publish(event);

    expect(socketA.send).toHaveBeenCalledWith(JSON.stringify(event));
    expect(socketB.send).not.toHaveBeenCalled();
  });

  it("should skip closed sockets safely", async () => {
    const openSocket = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
    } as unknown as WebSocket;

    const closedSocket = {
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
    } as unknown as WebSocket;

    roomManager.subscribe("ws_target", openSocket);
    roomManager.subscribe("ws_target", closedSocket);

    const event: CardCreatedEvent = {
      eventId: "evt_123",
      type: "card.created",
      workspaceId: "ws_target",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Test Card",
        position: 0,
        labels: [],
        assigneeIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      version: 1720000000,
      timestamp: new Date().toISOString(),
    };

    await publisher.publish(event);

    expect(openSocket.send).toHaveBeenCalled();
    expect(closedSocket.send).not.toHaveBeenCalled();
  });
});
