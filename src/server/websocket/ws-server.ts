import { WebSocket, WebSocketServer, type ServerOptions } from "ws";
import type { IncomingMessage } from "http";
import {
  clientMessageSchema,
  createEventId,
  createVersion,
  type ErrorMessage,
  type PongMessage,
  type PresenceStateMessage,
  type SubscribedMessage,
  type UnsubscribedMessage,
} from "@/lib/realtime/events";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { presenceService as defaultPresenceService, PresenceService, redisSubscriber, RedisSubscriber } from "../redis";
import { eventPublisher as defaultEventPublisher, IEventPublisher } from "./event-publisher";
import { authenticateWebSocket, authorizeWorkspaceSubscription } from "./auth";
import { connectionManager, ConnectionManager } from "./connection-manager";
import { roomManager, RoomManager } from "./room-manager";
import { wsLogger } from "./logger";

export interface CreateWebSocketServerOptions extends ServerOptions {
  connManager?: ConnectionManager;
  rooms?: RoomManager;
  subscriber?: RedisSubscriber;
  presence?: PresenceService;
  publisher?: IEventPublisher;
}

/**
 * Creates and initializes a WebSocket Server instance with full authentication,
 * room routing, message validation, dynamic Redis Pub/Sub, and Presence lifecycle integration.
 */
export function createWebSocketServer(options: CreateWebSocketServerOptions = {}): WebSocketServer {
  const {
    connManager = connectionManager,
    rooms = roomManager,
    subscriber = redisSubscriber,
    presence = defaultPresenceService,
    publisher = defaultEventPublisher,
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

    // 2. Register connection & initial presence
    const clientConn = connManager.addConnection(socket, user);
    await presence.setUserOnline(user.id, clientConn.id, "ONLINE").catch((err) => {
      wsLogger.error("Failed to register presence on connection", err, { userId: user.id });
    });

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
          // Ping also refreshes presence heartbeat
          await presence.heartbeat(user.id, clientConn.id).catch(() => {});
          return;
        }

        if (message.type === "heartbeat") {
          const refreshed = await presence.heartbeat(user.id, clientConn.id, message.status);
          const pong: PongMessage = { type: "pong" };
          socket.send(JSON.stringify(pong));

          // If status was explicitly supplied, broadcast presence update to subscribed rooms
          if (message.status) {
            for (const wsId of Array.from(clientConn.subscribedWorkspaces)) {
              await publisher.publish({
                eventId: createEventId(),
                type: "presence.updated",
                workspaceId: wsId,
                userId: user.id,
                status: refreshed.status,
                lastSeenAt: refreshed.lastSeenAt,
                version: createVersion(),
                timestamp: new Date().toISOString(),
              }).catch(() => {});
            }
          }
          return;
        }

        if (message.type === "presence.update") {
          const updated = await presence.setUserStatus(user.id, message.status);
          for (const wsId of Array.from(clientConn.subscribedWorkspaces)) {
            await publisher.publish({
              eventId: createEventId(),
              type: "presence.updated",
              workspaceId: wsId,
              userId: user.id,
              status: updated.status,
              lastSeenAt: updated.lastSeenAt,
              version: createVersion(),
              timestamp: new Date().toISOString(),
            }).catch(() => {});
          }
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

          // Send initial presence state of all workspace members to the newly subscribed socket
          try {
            const members = await workspaceMemberRepository.findMembersByWorkspaceId(authResult.workspaceId);
            const memberIds = members.map((m) => m.userId);
            if (!memberIds.includes(user.id)) {
              memberIds.push(user.id);
            }
            const presenceMap = await presence.getMultipleUsersPresence(memberIds);
            const initialPresences = Array.from(presenceMap.values());

            const presenceStateMsg: PresenceStateMessage = {
              type: "presence.state",
              workspaceId: message.workspaceId,
              presence: initialPresences,
            };
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(presenceStateMsg));
            }
          } catch (err) {
            wsLogger.warn("Failed to load initial workspace presence state", {
              workspaceId: authResult.workspaceId,
              error: (err as Error).message,
            });
          }

          // Broadcast user's online presence to workspace room
          const currentPresence = await presence.getUserPresence(user.id);
          await publisher.publish({
            eventId: createEventId(),
            type: "presence.updated",
            workspaceId: authResult.workspaceId,
            userId: user.id,
            status: currentPresence.status,
            lastSeenAt: currentPresence.lastSeenAt,
            version: createVersion(),
            timestamp: new Date().toISOString(),
          }).catch(() => {});

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
    const cleanup = async () => {
      const subscribedWorkspaces = Array.from(clientConn.subscribedWorkspaces);
      rooms.leaveAll(socket, connManager);
      connManager.removeConnection(socket);

      try {
        const { isOffline } = await presence.removeConnection(user.id, clientConn.id);
        if (isOffline) {
          const nowIso = new Date().toISOString();
          for (const wsId of subscribedWorkspaces) {
            await publisher.publish({
              eventId: createEventId(),
              type: "presence.updated",
              workspaceId: wsId,
              userId: user.id,
              status: "OFFLINE",
              lastSeenAt: nowIso,
              version: createVersion(),
              timestamp: nowIso,
            }).catch(() => {});
          }
        }
      } catch (err) {
        wsLogger.error("Error during connection presence cleanup", err, {
          connectionId: clientConn.id,
          userId: user.id,
        });
      }
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
