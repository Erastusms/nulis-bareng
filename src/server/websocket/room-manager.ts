import type { WebSocket } from "ws";
import type { ConnectionManager } from "./connection-manager";
import { connectionManager as defaultConnManager } from "./connection-manager";
import { wsLogger } from "./logger";

export class RoomManager {
  private rooms = new Map<string, Set<WebSocket>>();

  private getRoomKey(workspaceId: string): string {
    return `workspace:${workspaceId}`;
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
    if (room.size === 0) {
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
          room.delete(socket);
          if (room.size === 0) {
            this.rooms.delete(roomKey);
          }
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
