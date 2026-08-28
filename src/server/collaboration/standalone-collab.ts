import { Server } from "@hocuspocus/server";
import { createCollabServer } from "./collab-server";
import { wsLogger } from "../websocket/logger";

let collabServerInstance: Server | null = null;

/**
 * Initializes the standalone Collaboration WebSocket server.
 */
export async function initCollaborationServer(
  port = parseInt(process.env.COLLAB_PORT || "3002", 10)
): Promise<Server | null> {
  if (collabServerInstance) return collabServerInstance;

  try {
    const hocuspocus = createCollabServer();
    await hocuspocus.listen(port);
    collabServerInstance = hocuspocus;
    wsLogger.info(`Collaboration server listening on port ${port} (ws://localhost:${port})`);
    return hocuspocus;
  } catch (err) {
    wsLogger.warn("Failed to initialize Collaboration server", {
      error: (err as Error).message,
    });
    return null;
  }
}

/**
 * Gracefully shuts down the collaboration server.
 */
export async function stopCollaborationServer(): Promise<void> {
  if (collabServerInstance) {
    try {
      await collabServerInstance.destroy();
    } catch (err) {
      wsLogger.error("Error closing Hocuspocus server", err);
    }
    collabServerInstance = null;
  }

  wsLogger.info("Collaboration server terminated cleanly");
}
