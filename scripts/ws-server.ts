import { initWebSocketServer } from "../src/server/websocket/standalone-init";
import { wsLogger } from "../src/server/websocket/logger";

const server = initWebSocketServer();

process.on("SIGTERM", () => {
  wsLogger.info("SIGTERM received, shutting down WebSocket server...");
  server?.close(() => {
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  wsLogger.info("SIGINT received, shutting down WebSocket server...");
  server?.close(() => {
    process.exit(0);
  });
});
