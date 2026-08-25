import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RealtimeClient } from "./ws-client";
import type { CardCreatedEvent, RealtimeDomainEvent } from "./events";

// Mock WebSocket implementation for client testing
class MockWebSocket {
  static instances: MockWebSocket[] = [];
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((err: unknown) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) this.onopen();
    }, 10);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  triggerMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage({ data: typeof data === "string" ? data : JSON.stringify(data) });
    }
  }
}

describe("RealtimeClient", () => {
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    (global as unknown as { WebSocket: unknown }).WebSocket = MockWebSocket;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    global.WebSocket = originalWebSocket;
  });

  it("should initialize with disconnected status and connect", async () => {
    const client = new RealtimeClient({
      url: "ws://localhost:3001",
      autoConnect: false,
    });

    expect(client.getStatus()).toBe("disconnected");

    client.connect();
    expect(client.getStatus()).toBe("connecting");

    vi.advanceTimersByTime(15);
    expect(client.getStatus()).toBe("connected");

    client.disconnect();
    expect(client.getStatus()).toBe("disconnected");
  });

  it("should send subscribe message when subscribed", async () => {
    const client = new RealtimeClient({
      url: "ws://localhost:3001",
      autoConnect: false,
    });

    client.connect();
    vi.advanceTimersByTime(15);

    client.subscribe("ws_alpha");

    const wsInstance = MockWebSocket.instances[0];
    expect(wsInstance.sentMessages).toContain(
      JSON.stringify({ type: "subscribe", workspaceId: "ws_alpha" })
    );

    client.disconnect();
  });

  it("should dispatch received domain events to onEvent listener", async () => {
    const client = new RealtimeClient({
      url: "ws://localhost:3001",
      autoConnect: false,
    });

    const receivedEvents: RealtimeDomainEvent[] = [];
    client.onEvent((event) => {
      receivedEvents.push(event);
    });

    client.connect();
    vi.advanceTimersByTime(15);

    const wsInstance = MockWebSocket.instances[0];

    const event: CardCreatedEvent = {
      eventId: "evt_100",
      type: "card.created",
      workspaceId: "ws_alpha",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Test",
        position: 0,
        labels: [],
        assigneeIds: [],
        createdAt: "2026-08-25T00:00:00Z",
        updatedAt: "2026-08-25T00:00:00Z",
      },
      version: 100,
      timestamp: "2026-08-25T00:00:00Z",
    };

    wsInstance.triggerMessage(event);

    expect(receivedEvents.length).toBe(1);
    expect(receivedEvents[0].eventId).toBe("evt_100");

    client.disconnect();
  });

  it("should automatically resubscribe to active rooms after reconnection", async () => {
    const client = new RealtimeClient({
      url: "ws://localhost:3001",
      autoConnect: false,
      initialReconnectDelayMs: 100,
      maxReconnectDelayMs: 200,
    });

    client.connect();
    vi.advanceTimersByTime(15);
    client.subscribe("ws_persisted");

    const firstSocket = MockWebSocket.instances[0];
    expect(firstSocket.sentMessages).toContain(
      JSON.stringify({ type: "subscribe", workspaceId: "ws_persisted" })
    );

    // Simulate unexpected disconnect
    firstSocket.close();
    expect(client.getStatus()).toBe("reconnecting");

    // Advance timers to trigger reconnect
    vi.advanceTimersByTime(600);

    expect(MockWebSocket.instances.length).toBe(2);
    const secondSocket = MockWebSocket.instances[1];
    vi.advanceTimersByTime(15);

    expect(client.getStatus()).toBe("connected");
    expect(secondSocket.sentMessages).toContain(
      JSON.stringify({ type: "subscribe", workspaceId: "ws_persisted" })
    );

    client.disconnect();
  });
});
