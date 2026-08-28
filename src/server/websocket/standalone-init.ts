import http from "http";
import type { WebSocketServer } from "ws";
import { createWebSocketServer, closeWebSocketServer } from "./ws-server";
import { eventPublisher } from "./event-publisher";
import { redisSubscriber, closeRedisClients } from "../redis";
import { wsLogger } from "./logger";

let serverInstance: http.Server | null = null;
let wssInstance: WebSocketServer | null = null;

/**
 * Initializes the standalone WebSocket server with healthcheck and internal publish bridge endpoints.
 */
export function initWebSocketServer(
  port = parseInt(process.env.WS_PORT || "3001", 10)
): http.Server | null {
  if (serverInstance) return serverInstance;

  try {
    const server = http.createServer((req, res) => {
      // 1. Healthcheck endpoint
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", timestamp: new Date().toISOString() }));
        return;
      }

      // 2. Internal publish bridge endpoint (accepts events from Next.js API mutations)
      if (req.method === "POST" && (req.url === "/publish" || req.url === "/api/publish")) {
        let body = "";
        req.on("data", (chunk) => {
          body += chunk;
        });
        req.on("end", async () => {
          try {
            const event = JSON.parse(body);
            await eventPublisher.publish(event, { isForwarded: true });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "ok", eventId: event.eventId }));
          } catch {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid event payload" }));
          }
        });
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    server.on("error", (err: unknown) => {
      const errorWithCode = err as { code?: string };
      if (errorWithCode.code === "EADDRINUSE") {
        wsLogger.info(`WebSocket server already running on port ${port}, reusing existing instance.`);
        if (wssInstance) {
          try {
            wssInstance.close();
          } catch {}
          wssInstance = null;
        }
        serverInstance = null;
      } else {
        wsLogger.error("WebSocket server error", err);
      }
    });

    wssInstance = createWebSocketServer({ server, subscriber: redisSubscriber });

    server.listen(port, () => {
      wsLogger.info(`WebSocket server listening on port ${port} (ws://localhost:${port})`);
    });

    serverInstance = server;
    return server;
  } catch (err) {
    wsLogger.warn("Failed to initialize background WebSocket server", {
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Gracefully shuts down the running WebSocket server and Redis connections.
 */
export async function stopWebSocketServer(): Promise<void> {
  if (wssInstance) {
    try {
      await closeWebSocketServer(wssInstance, redisSubscriber);
    } catch (err) {
      wsLogger.error("Error closing WebSocketServer", err);
    }
    wssInstance = null;
  }

  if (serverInstance) {
    await new Promise<void>((resolve) => {
      serverInstance?.close(() => resolve());
    });
    serverInstance = null;
  }

  try {
    await closeRedisClients();
  } catch (err) {
    wsLogger.error("Error closing Redis clients", err);
  }

  wsLogger.info("WebSocket server and Redis connections terminated cleanly");
}
