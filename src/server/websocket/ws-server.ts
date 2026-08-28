import { WebSocket, WebSocketServer, type ServerOptions } from "ws";
import type { IncomingMessage } from "http";
import {
  clientMessageSchema,
  type ErrorMessage,
  type PongMessage,
  type SubscribedMessage,
  type UnsubscribedMessage,
} from "@/lib/realtime/events";
import { redisSubscriber, RedisSubscriber } from "../redis";
import { authenticateWebSocket, authorizeWorkspaceSubscription } from "./auth";
import { connectionManager, ConnectionManager } from "./connection-manager";
import { roomManager, RoomManager } from "./room-manager";
import { wsLogger } from "./logger";

export interface CreateWebSocketServerOptions extends ServerOptions {
  connManager?: ConnectionManager;
  rooms?: RoomManager;
  subscriber?: RedisSubscriber;
}

/**
 * Creates and initializes a WebSocket Server instance with full authentication,
 * room routing, message validation, and dynamic Redis Pub/Sub integration.
 */
export function createWebSocketServer(options: CreateWebSocketServerOptions = {}): WebSocketServer {
  const {
    connManager = connectionManager,
    rooms = roomManager,
    subscriber = redisSubscriber,
    ...wsOptions
  } = options;

  // 1. Wire dynamic Redis Pub/Sub subscription hooks into RoomManager
  if (subscriber) {
    rooms.setHooks({
      onFirstSubscriber: (workspaceId) => {
        subscriber.subscribeToWorkspace(workspaceId);
      },
      onLastSubscriberLeft: (workspaceId) => {
        subscriber.unsubscribeFromWorkspace(workspaceId);
      },
    });

    // Route incoming distributed Redis events to local WebSocket rooms
    subscriber.onMessage((workspaceId, event) => {
      rooms.broadcastToRoom(workspaceId, event);
    });
  }

  const wss = new WebSocketServer(wsOptions);

  wss.on("error", (err: unknown) => {
    const errorWithCode = err as { code?: string };
    if (errorWithCode.code === "EADDRINUSE") {
      wsLogger.info("WebSocketServer port already in use, skipping attachment");
    } else {
      wsLogger.error("WebSocketServer error", err);
    }
  });

  wss.on("connection", async (socket: WebSocket, req: IncomingMessage) => {
    // 1. Authenticate the connecting client
    const user = await authenticateWebSocket(req);
    if (!user) {
      const errorMsg: ErrorMessage = {
        type: "error",
        code: "UNAUTHORIZED",
        message: "Authentication required to establish WebSocket connection.",
      };
      try {
        socket.send(JSON.stringify(errorMsg));
      } catch {
        // Socket might already be closed
      }
      socket.close(4401, "Unauthorized");
      return;
    }

    // 2. Register connection
    const clientConn = connManager.addConnection(socket, user);

    // 3. Message handling
    socket.on("message", async (data) => {
      try {
        const rawString = typeof data === "string" ? data : data.toString("utf8");
        let parsedJson: unknown;

        try {
          parsedJson = JSON.parse(rawString);
        } catch {
          const err: ErrorMessage = {
            type: "error",
            code: "INVALID_JSON",
            message: "Payload could not be parsed as valid JSON.",
          };
          socket.send(JSON.stringify(err));
          return;
        }

        const parseResult = clientMessageSchema.safeParse(parsedJson);
        if (!parseResult.success) {
          wsLogger.warn("Invalid client message schema", {
            connectionId: clientConn.id,
            userId: user.id,
          });
          const err: ErrorMessage = {
            type: "error",
            code: "VALIDATION_ERROR",
            message: "Invalid message schema or missing required fields.",
          };
          socket.send(JSON.stringify(err));
          return;
        }

        const message = parseResult.data;

        // Route message by type
        if (message.type === "ping") {
          const pong: PongMessage = { type: "pong" };
          socket.send(JSON.stringify(pong));
          return;
        }

        if (message.type === "subscribe") {
          const authResult = await authorizeWorkspaceSubscription(user.id, message.workspaceId);
          if (!authResult.authorized || !authResult.workspaceId) {
            const forbiddenErr: ErrorMessage = {
              type: "error",
              code: "FORBIDDEN",
              message: "You do not have permission to subscribe to this workspace.",
              workspaceId: message.workspaceId,
            };
            socket.send(JSON.stringify(forbiddenErr));
            return;
          }

          // Subscribe socket to canonical workspace ID
          rooms.subscribe(authResult.workspaceId, socket, connManager);

          // Also subscribe to urlIdentifier and message.workspaceId if different so all room lookups match
          if (authResult.urlIdentifier && authResult.urlIdentifier !== authResult.workspaceId) {
            rooms.subscribe(authResult.urlIdentifier, socket, connManager);
          }
          if (message.workspaceId !== authResult.workspaceId && message.workspaceId !== authResult.urlIdentifier) {
            rooms.subscribe(message.workspaceId, socket, connManager);
          }

          const subResponse: SubscribedMessage = {
            type: "subscribed",
            workspaceId: message.workspaceId,
          };
          socket.send(JSON.stringify(subResponse));
          return;
        }

        if (message.type === "unsubscribe") {
          rooms.unsubscribe(message.workspaceId, socket, connManager);
          const unsubResponse: UnsubscribedMessage = {
            type: "unsubscribed",
            workspaceId: message.workspaceId,
          };
          socket.send(JSON.stringify(unsubResponse));
          return;
        }
      } catch (err) {
        wsLogger.error("Error processing WebSocket message", err, {
          connectionId: clientConn.id,
          userId: user.id,
        });
        const internalErr: ErrorMessage = {
          type: "error",
          code: "INTERNAL_ERROR",
          message: "An error occurred while processing your request.",
        };
        try {
          socket.send(JSON.stringify(internalErr));
        } catch {}
      }
    });

    // 4. Disconnection & error handling
    const cleanup = () => {
      rooms.leaveAll(socket, connManager);
      connManager.removeConnection(socket);
    };

    socket.on("close", cleanup);
    socket.on("error", (err) => {
      wsLogger.error("WebSocket client socket error", err, {
        connectionId: clientConn.id,
        userId: user.id,
      });
      cleanup();
    });
  });

  wsLogger.info("WebSocket Server initialized with Redis Pub/Sub support");

  return wss;
}

/**
 * Gracefully shuts down a WebSocketServer instance and clears room states.
 */
export async function closeWebSocketServer(
  wss: WebSocketServer,
  subscriber?: RedisSubscriber
): Promise<void> {
  if (subscriber) {
    await subscriber.close();
  }
  return new Promise<void>((resolve, reject) => {
    wss.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}
