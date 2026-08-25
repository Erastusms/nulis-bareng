/**
 * Next.js Instrumentation hook.
 * Runs once at server startup in Node.js runtime.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initWebSocketServer } = await import("./server/websocket/standalone-init");
    initWebSocketServer();
  }
}
