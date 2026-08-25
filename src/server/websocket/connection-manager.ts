import type { WebSocket } from "ws";
import type { User } from "@/types/domain";
import { wsLogger } from "./logger";

export interface ClientConnection {
  id: string;
  socket: WebSocket;
  user: User;
  connectedAt: Date;
  subscribedWorkspaces: Set<string>;
}

export class ConnectionManager {
  private connections = new Map<WebSocket, ClientConnection>();
  private userToSockets = new Map<string, Set<WebSocket>>();

  /**
   * Registers a new authenticated client connection.
   */
  addConnection(socket: WebSocket, user: User): ClientConnection {
    const id = `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const connection: ClientConnection = {
      id,
      socket,
      user,
      connectedAt: new Date(),
      subscribedWorkspaces: new Set<string>(),
    };

    this.connections.set(socket, connection);

    let userSockets = this.userToSockets.get(user.id);
    if (!userSockets) {
      userSockets = new Set();
      this.userToSockets.set(user.id, userSockets);
    }
    userSockets.add(socket);

    wsLogger.info("Connection established", {
      connectionId: id,
      userId: user.id,
      activeConnections: this.connections.size,
    });

    return connection;
  }

  /**
   * Removes and cleans up a disconnected client socket.
   */
  removeConnection(socket: WebSocket): ClientConnection | undefined {
    const connection = this.connections.get(socket);
    if (!connection) {
      return undefined;
    }

    this.connections.delete(socket);

    const userSockets = this.userToSockets.get(connection.user.id);
    if (userSockets) {
      userSockets.delete(socket);
      if (userSockets.size === 0) {
        this.userToSockets.delete(connection.user.id);
      }
    }

    wsLogger.info("Connection closed", {
      connectionId: connection.id,
      userId: connection.user.id,
      activeConnections: this.connections.size,
    });

    return connection;
  }

  /**
   * Retrieves connection metadata for a given socket instance.
   */
  getConnection(socket: WebSocket): ClientConnection | undefined {
    return this.connections.get(socket);
  }

  /**
   * Retrieves all active connections belonging to a specific user.
   */
  getConnectionsByUserId(userId: string): ClientConnection[] {
    const sockets = this.userToSockets.get(userId);
    if (!sockets) return [];

    const result: ClientConnection[] = [];
    for (const socket of sockets) {
      const conn = this.connections.get(socket);
      if (conn) result.push(conn);
    }
    return result;
  }

  /**
   * Returns all active connections.
   */
  getAllConnections(): ClientConnection[] {
    return Array.from(this.connections.values());
  }

  /**
   * Returns total count of active connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Clears all connection records (useful for testing or server shutdown).
   */
  clear(): void {
    this.connections.clear();
    this.userToSockets.clear();
  }
}

export const connectionManager = new ConnectionManager();
