import { initWebSocketServer, stopWebSocketServer } from "../src/server/websocket/standalone-init";
import { initCollaborationServer, stopCollaborationServer } from "../src/server/collaboration/standalone-collab";
import { wsLogger } from "../src/server/websocket/logger";

initWebSocketServer();
initCollaborationServer().catch((err) => {
  wsLogger.error("Failed to start collaboration server in runner script", err);
});

const handleShutdown = async (signal: string) => {
  wsLogger.info(`${signal} received, shutting down real-time and collaboration servers...`);
  try {
    await stopCollaborationServer();
    await stopWebSocketServer();
    process.exit(0);
  } catch (err) {
    wsLogger.error("Error during graceful shutdown", err);
    process.exit(1);
  }
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
