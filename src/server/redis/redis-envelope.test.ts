import { describe, it, expect } from "vitest";
import type { CardCreatedEvent, RealtimeDomainEvent } from "@/lib/realtime/events";
import {
  getWorkspaceChannel,
  getWorkspaceIdFromChannel,
  createRedisEnvelope,
  serializeRedisEnvelope,
  deserializeRedisEnvelope,
  WORKSPACE_CHANNEL_PREFIX,
} from "./redis-envelope";

describe("Redis Envelope & Channel Utilities", () => {
  it("should generate standard workspace channel names", () => {
    expect(getWorkspaceChannel("ws_123")).toBe("workspace:ws_123");
    expect(getWorkspaceChannel("cuid_abc_999")).toBe("workspace:cuid_abc_999");
    expect(WORKSPACE_CHANNEL_PREFIX).toBe("workspace:");
  });

  it("should extract workspace ID from channel names", () => {
    expect(getWorkspaceIdFromChannel("workspace:ws_123")).toBe("ws_123");
    expect(getWorkspaceIdFromChannel("workspace:cuid_abc_999")).toBe("cuid_abc_999");
    expect(getWorkspaceIdFromChannel("other:channel")).toBeNull();
    expect(getWorkspaceIdFromChannel("")).toBeNull();
  });

  it("should wrap domain events into a structured RedisEventEnvelope", () => {
    const domainEvent: CardCreatedEvent = {
      eventId: "evt_test_123",
      type: "card.created",
      workspaceId: "ws_456",
      boardId: "board_1",
      columnId: "col_1",
      cardId: "card_1",
      card: {
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Test Card",
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

    const envelope = createRedisEnvelope(domainEvent, "instance_node_1");

    expect(envelope).toEqual({
      eventId: "evt_test_123",
      type: "card.created",
      workspaceId: "ws_456",
      sourceInstanceId: "instance_node_1",
      timestamp: "2026-08-25T10:00:00.000Z",
      version: 1720000000,
      payload: domainEvent,
    });
  });

  it("should serialize and deserialize envelope without loss", () => {
    const domainEvent: RealtimeDomainEvent = {
      eventId: "evt_test_999",
      type: "board.updated",
      workspaceId: "ws_target",
      boardId: "board_100",
      changes: { title: "Updated Board Title" },
      version: 1720000100,
      timestamp: "2026-08-25T10:05:00.000Z",
    };

    const envelope = createRedisEnvelope(domainEvent, "api-instance-2");
    const serialized = serializeRedisEnvelope(envelope);
    expect(typeof serialized).toBe("string");

    const deserialized = deserializeRedisEnvelope(serialized);
    expect(deserialized).toEqual(envelope);
    expect(deserialized?.payload.type).toBe("board.updated");
  });

  it("should safely reject malformed JSON", () => {
    const result = deserializeRedisEnvelope("not a valid json {{{");
    expect(result).toBeNull();
  });

  it("should safely reject envelopes missing required metadata", () => {
    const invalidEnvelope = JSON.stringify({
      type: "card.created",
      // missing eventId, workspaceId, sourceInstanceId, etc.
    });

    const result = deserializeRedisEnvelope(invalidEnvelope);
    expect(result).toBeNull();
  });

  it("should safely reject envelopes with invalid payload structure", () => {
    const invalidPayloadEnvelope = JSON.stringify({
      eventId: "evt_1",
      type: "card.created",
      workspaceId: "ws_1",
      sourceInstanceId: "inst_1",
      timestamp: "2026-08-25T10:00:00.000Z",
      version: 123,
      payload: "invalid_payload_not_object",
    });

    const result = deserializeRedisEnvelope(invalidPayloadEnvelope);
    expect(result).toBeNull();
  });
});
