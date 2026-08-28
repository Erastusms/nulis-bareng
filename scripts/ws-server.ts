import { initWebSocketServer, stopWebSocketServer } from "../src/server/websocket/standalone-init";
import { wsLogger } from "../src/server/websocket/logger";

initWebSocketServer();

const handleShutdown = async (signal: string) => {
  wsLogger.info(`${signal} received, shutting down WebSocket server and Redis connections...`);
  try {
    await stopWebSocketServer();
    process.exit(0);
  } catch (err) {
    wsLogger.error("Error during graceful shutdown", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
