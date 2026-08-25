import { WebSocket } from "ws";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { roomManager, RoomManager } from "./room-manager";
import { wsLogger } from "./logger";

export interface PublishOptions {
  isForwarded?: boolean;
}

export interface IEventPublisher {
  publish(event: RealtimeDomainEvent, options?: PublishOptions): Promise<void>;
}

export class WebSocketEventPublisher implements IEventPublisher {
  constructor(private readonly rooms: RoomManager = roomManager) {}

  /**
   * Publishes a granular domain event to all clients authorized and subscribed
   * to the event's workspace room. Also forwards the event to the standalone WebSocket server
   * if called from a separate process (e.g. Next.js API route).
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

    // If this publish call did NOT originate from the WS server's HTTP bridge,
    // forward it to the standalone WS server's /publish endpoint (port 3001)
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

export const eventPublisher = new WebSocketEventPublisher();
