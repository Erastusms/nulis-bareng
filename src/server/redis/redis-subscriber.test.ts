import { describe, it, expect, vi, beforeEach } from "vitest";
import EventEmitter from "events";
import type Redis from "ioredis";
import type { CardCreatedEvent } from "@/lib/realtime/events";
import { RedisSubscriber } from "./redis-subscriber";
import { createRedisEnvelope, serializeRedisEnvelope } from "./redis-envelope";

class MockRedisClient extends EventEmitter {
  subscribe = vi.fn().mockResolvedValue(1);
  unsubscribe = vi.fn().mockResolvedValue(1);
}

describe("RedisSubscriber", () => {
  let mockClient: MockRedisClient;
  let subscriber: RedisSubscriber;

  beforeEach(() => {
    mockClient = new MockRedisClient();
    subscriber = new RedisSubscriber(mockClient as unknown as Redis);
  });

  it("should dynamically subscribe to a workspace channel", async () => {
    await subscriber.subscribeToWorkspace("ws_alpha");

    expect(mockClient.subscribe).toHaveBeenCalledWith("workspace:ws_alpha");
    expect(subscriber.getActiveWorkspaces()).toEqual(["ws_alpha"]);
  });

  it("should be idempotent when subscribing to the same workspace multiple times", async () => {
    await subscriber.subscribeToWorkspace("ws_alpha");
    await subscriber.subscribeToWorkspace("ws_alpha");

    expect(mockClient.subscribe).toHaveBeenCalledTimes(1);
    expect(subscriber.getActiveWorkspaces()).toEqual(["ws_alpha"]);
  });

  it("should unsubscribe from a workspace channel", async () => {
    await subscriber.subscribeToWorkspace("ws_alpha");
    await subscriber.unsubscribeFromWorkspace("ws_alpha");

    expect(mockClient.unsubscribe).toHaveBeenCalledWith("workspace:ws_alpha");
    expect(subscriber.getActiveWorkspaces()).toEqual([]);
  });

  it("should dispatch incoming events to registered message handlers", () => {
    const handler = vi.fn();
    subscriber.onMessage(handler);

    const domainEvent: CardCreatedEvent = {
      eventId: "evt_sub_test",
      type: "card.created",
      workspaceId: "ws_alpha",
      boardId: "b1",
      columnId: "c1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "b1",
        columnId: "c1",
        title: "Dispatched Card",
        position: 0,
        labels: [],
        assigneeIds: [],
        createdAt: "2026-08-25T10:00:00.000Z",
        updatedAt: "2026-08-25T10:00:00.000Z",
      },
      version: 1720000000,
      timestamp: "2026-08-25T10:00:00.000Z",
    };

    const envelope = createRedisEnvelope(domainEvent, "remote-instance");
    const rawMessage = serializeRedisEnvelope(envelope);

    // Simulate Redis message event
    mockClient.emit("message", "workspace:ws_alpha", rawMessage);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith("ws_alpha", domainEvent, envelope);
  });

  it("should safely ignore malformed Redis messages without crashing", () => {
    const handler = vi.fn();
    subscriber.onMessage(handler);

    mockClient.emit("message", "workspace:ws_alpha", "invalid-json-payload");

    expect(handler).not.toHaveBeenCalled();
  });

  it("should restore active channel subscriptions upon reconnection (ready event)", async () => {
    await subscriber.subscribeToWorkspace("ws_alpha");
    await subscriber.subscribeToWorkspace("ws_beta");

    expect(mockClient.subscribe).toHaveBeenCalledTimes(2);

    // Simulate Redis reconnect / ready event
    mockClient.emit("ready");

    expect(mockClient.subscribe).toHaveBeenCalledWith("workspace:ws_alpha", "workspace:ws_beta");
  });

  it("should unsubscribe from all active channels on close", async () => {
    await subscriber.subscribeToWorkspace("ws_1");
    await subscriber.subscribeToWorkspace("ws_2");

    await subscriber.close();

    expect(mockClient.unsubscribe).toHaveBeenCalledWith("workspace:ws_1", "workspace:ws_2");
    expect(subscriber.getActiveWorkspaces()).toEqual([]);
  });
});
