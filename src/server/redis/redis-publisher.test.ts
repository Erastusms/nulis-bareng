import { describe, it, expect, vi, beforeEach } from "vitest";
import type Redis from "ioredis";
import type { CardCreatedEvent } from "@/lib/realtime/events";
import { RedisPublisher } from "./redis-publisher";
import { deserializeRedisEnvelope } from "./redis-envelope";

describe("RedisPublisher", () => {
  let mockRedisClient: Partial<Redis>;
  let publisher: RedisPublisher;

  beforeEach(() => {
    mockRedisClient = {
      publish: vi.fn().mockResolvedValue(1),
    };
    publisher = new RedisPublisher(mockRedisClient as Redis, "test-instance-1");
  });

  it("should publish serialized envelope to the correct workspace channel", async () => {
    const domainEvent: CardCreatedEvent = {
      eventId: "evt_card_create_1",
      type: "card.created",
      workspaceId: "ws_acme_123",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Redis Card",
        description: null,
        position: 0,
        dueDate: null,
        labels: [],
        assigneeIds: [],
        createdAt: "2026-08-25T10:00:00.000Z",
        updatedAt: "2026-08-25T10:00:00.000Z",
      },
      version: 1720000000,
      timestamp: "2026-08-25T10:00:00.000Z",
    };

    await publisher.publish(domainEvent);

    expect(mockRedisClient.publish).toHaveBeenCalledTimes(1);
    const [channel, rawPayload] = (mockRedisClient.publish as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(channel).toBe("workspace:ws_acme_123");

    const parsedEnvelope = deserializeRedisEnvelope(rawPayload);
    expect(parsedEnvelope).not.toBeNull();
    expect(parsedEnvelope?.eventId).toBe("evt_card_create_1");
    expect(parsedEnvelope?.workspaceId).toBe("ws_acme_123");
    expect(parsedEnvelope?.sourceInstanceId).toBe("test-instance-1");
    expect(parsedEnvelope?.payload).toEqual(domainEvent);
  });

  it("should handle Redis publish failure gracefully without crashing", async () => {
    mockRedisClient.publish = vi.fn().mockRejectedValue(new Error("Redis connection closed"));

    const domainEvent: CardCreatedEvent = {
      eventId: "evt_fail_1",
      type: "card.created",
      workspaceId: "ws_fail",
      boardId: "b1",
      columnId: "c1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "b1",
        columnId: "c1",
        title: "Card",
        position: 0,
        labels: [],
        assigneeIds: [],
        createdAt: "2026-08-25T10:00:00.000Z",
        updatedAt: "2026-08-25T10:00:00.000Z",
      },
      version: 1720000000,
      timestamp: "2026-08-25T10:00:00.000Z",
    };

    // Should not throw
    await expect(publisher.publish(domainEvent)).resolves.not.toThrow();
  });
});
