import { WebSocket } from "ws";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import type { ConnectionManager } from "./connection-manager";
import { connectionManager as defaultConnManager } from "./connection-manager";
import { wsLogger } from "./logger";

export interface RoomSubscriptionHooks {
  onFirstSubscriber?: (workspaceId: string) => void | Promise<void>;
  onLastSubscriberLeft?: (workspaceId: string) => void | Promise<void>;
}

export class RoomManager {
  private rooms = new Map<string, Set<WebSocket>>();
  private hooks: RoomSubscriptionHooks = {};

  constructor(hooks?: RoomSubscriptionHooks) {
    if (hooks) {
      this.hooks = hooks;
    }
  }

  /**
   * Sets lifecycle hooks for workspace subscriptions.
   */
  setHooks(hooks: RoomSubscriptionHooks): void {
    this.hooks = { ...this.hooks, ...hooks };
  }

  private getRoomKey(workspaceId: string): string {
    return `workspace:${workspaceId}`;
  }

  private getWorkspaceIdFromKey(roomKey: string): string {
    return roomKey.startsWith("workspace:") ? roomKey.slice(10) : roomKey;
  }

  /**
   * Subscribes a client socket to a workspace channel.
   */
  subscribe(
    workspaceId: string,
    socket: WebSocket,
    connManager: ConnectionManager = defaultConnManager
  ): boolean {
    const roomKey = this.getRoomKey(workspaceId);
    let room = this.rooms.get(roomKey);
    const isFirstSubscriber = !room || room.size === 0;

    if (!room) {
      room = new Set<WebSocket>();
      this.rooms.set(roomKey, room);
    }

    if (room.has(socket)) {
      return false; // Already subscribed
    }

    room.add(socket);

    const conn = connManager.getConnection(socket);
    if (conn) {
      conn.subscribedWorkspaces.add(workspaceId);
      wsLogger.info("Workspace subscribed", {
        connectionId: conn.id,
        userId: conn.user.id,
        workspaceId,
        subscribersCount: room.size,
      });
    }

    // Trigger dynamic subscription hook when the first client joins
    if (isFirstSubscriber && this.hooks.onFirstSubscriber) {
      try {
        this.hooks.onFirstSubscriber(workspaceId);
      } catch (err) {
        wsLogger.error("Error in onFirstSubscriber hook", err, { workspaceId });
      }
    }

    return true;
  }

  /**
   * Unsubscribes a client socket from a workspace channel.
   */
  unsubscribe(
    workspaceId: string,
    socket: WebSocket,
    connManager: ConnectionManager = defaultConnManager
  ): boolean {
    const roomKey = this.getRoomKey(workspaceId);
    const room = this.rooms.get(roomKey);

    if (!room || !room.has(socket)) {
      return false;
    }

    room.delete(socket);
    const isLastSubscriber = room.size === 0;

    if (isLastSubscriber) {
      this.rooms.delete(roomKey);
    }

    const conn = connManager.getConnection(socket);
    if (conn) {
      conn.subscribedWorkspaces.delete(workspaceId);
      wsLogger.info("Workspace unsubscribed", {
        connectionId: conn.id,
        userId: conn.user.id,
        workspaceId,
        remainingSubscribers: room.size,
      });
    }

    // Trigger dynamic unsubscription hook when the last client leaves
    if (isLastSubscriber && this.hooks.onLastSubscriberLeft) {
      try {
        this.hooks.onLastSubscriberLeft(workspaceId);
      } catch (err) {
        wsLogger.error("Error in onLastSubscriberLeft hook", err, { workspaceId });
      }
    }

    return true;
  }

  /**
   * Removes a socket from all subscribed workspace rooms.
   */
  leaveAll(
    socket: WebSocket,
    connManager: ConnectionManager = defaultConnManager
  ): void {
    const conn = connManager.getConnection(socket);
    if (conn) {
      for (const workspaceId of Array.from(conn.subscribedWorkspaces)) {
        this.unsubscribe(workspaceId, socket, connManager);
      }
    } else {
      // Fallback sweep through all rooms
      for (const [roomKey, room] of this.rooms.entries()) {
        if (room.has(socket)) {
          const workspaceId = this.getWorkspaceIdFromKey(roomKey);
          this.unsubscribe(workspaceId, socket, connManager);
        }
      }
    }
  }

  /**
   * Returns all active client sockets in a workspace room.
   */
  getSocketsInRoom(workspaceId: string): WebSocket[] {
    const roomKey = this.getRoomKey(workspaceId);
    const room = this.rooms.get(roomKey);
    if (!room) return [];
    return Array.from(room);
  }

  /**
   * Broadcasts a real-time domain event to all open local WebSockets in a workspace room.
   * Returns the count of successfully sent messages.
   */
  broadcastToRoom(workspaceId: string, event: RealtimeDomainEvent): number {
    const sockets = this.getSocketsInRoom(workspaceId);
    const payload = JSON.stringify(event);
    let sentCount = 0;

    for (const socket of sockets) {
      if (socket.readyState === WebSocket.OPEN) {
        try {
          socket.send(payload);
          sentCount++;
        } catch (err) {
          wsLogger.error("Failed to send message to client socket", err, {
            type: event.type,
            workspaceId,
            eventId: event.eventId,
          });
        }
      }
    }

    if (sentCount > 0) {
      wsLogger.info("Event broadcast to local sockets", {
        type: event.type,
        workspaceId,
        eventId: event.eventId,
        recipients: sentCount,
      });
    }

    return sentCount;
  }

  /**
   * Returns all currently active workspace IDs with connected local clients.
   */
  getActiveWorkspaceIds(): string[] {
    return Array.from(this.rooms.keys()).map((k) => this.getWorkspaceIdFromKey(k));
  }

  /**
   * Returns the count of active subscribers in a workspace room.
   */
  getRoomSubscribersCount(workspaceId: string): number {
    const roomKey = this.getRoomKey(workspaceId);
    return this.rooms.get(roomKey)?.size ?? 0;
  }

  /**
   * Clears all room entries (useful for testing or shutdown).
   */
  clear(): void {
    this.rooms.clear();
  }
}

export const roomManager = new RoomManager();
