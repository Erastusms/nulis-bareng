import { WebSocket } from "ws";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { roomManager, RoomManager } from "./room-manager";
import { redisPublisher, RedisPublisher, IEventPublisher, PublishOptions } from "../redis";
import { wsLogger } from "./logger";

export type { IEventPublisher, PublishOptions };

/**
 * Direct local WebSocket event publisher.
 * Used for single-instance in-memory testing or standalone fallback.
 */
export class WebSocketEventPublisher implements IEventPublisher {
  constructor(private readonly rooms: RoomManager = roomManager) {}

  /**
   * Publishes a granular domain event to all clients authorized and subscribed
   * to the event's workspace room.
   */
  async publish(event: RealtimeDomainEvent, options?: PublishOptions): Promise<void> {
    const socketSet = new Set<WebSocket>(this.rooms.getSocketsInRoom(event.workspaceId));
    const payload = JSON.stringify(event);
    let sentCount = 0;

    for (const socket of socketSet) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
          sentCount++;
        } catch (err) {
          wsLogger.error("Failed to send message to client socket", err, {
            type: event.type,
            workspaceId: event.workspaceId,
            eventId: event.eventId,
          });
        }
      }
    }

    if (sentCount > 0) {
      wsLogger.info("Event broadcast", {
        type: event.type,
        workspaceId: event.workspaceId,
        eventId: event.eventId,
        recipients: sentCount,
      });
    }

    // Forward to standalone WS server endpoint if called outside WS server
    if (!options?.isForwarded) {
      const port = process.env.WS_PORT || "3001";
      const host = "127.0.0.1";
      try {
        await fetch(`http://${host}:${port}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          signal: AbortSignal.timeout(2000),
        });
      } catch {
        // Silently catch if already in the same process or standalone server isn't running
      }
    }
  }
}

/**
 * Hybrid / Distributed Event Publisher that delegates to Redis Pub/Sub.
 */
export class DistributedEventPublisher implements IEventPublisher {
  constructor(
    private readonly redisPub: RedisPublisher = redisPublisher,
    private readonly localPub: WebSocketEventPublisher = new WebSocketEventPublisher(roomManager)
  ) {}

  async publish(event: RealtimeDomainEvent, options?: PublishOptions): Promise<void> {
    // If Redis is disabled via environment, use local publisher
    if (process.env.ENABLE_REDIS === "false") {
      await this.localPub.publish(event, options);
      return;
    }

    let success = false;
    try {
      success = await this.redisPub.publish(event, options);
    } catch {
      success = false;
    }

    if (!success) {
      wsLogger.warn("Redis publish failed or unavailable, falling back to local broadcast", {
        eventId: event.eventId,
      });
      await this.localPub.publish(event, options);
    }
  }
}

/**
 * Global singleton event publisher used by domain services.
 */
export const eventPublisher: IEventPublisher = new DistributedEventPublisher();
