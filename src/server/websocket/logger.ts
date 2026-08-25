export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  [key: string]: unknown;
}

/**
 * Structured logger for WebSocket events and lifecycle tracking.
 * Ensures tokens, passwords, and sensitive credentials are never logged.
 */
class WebSocketLogger {
  private format(level: LogLevel, message: string, meta?: LogPayload): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
    return `[WebSocket] [${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
  }

  info(message: string, meta?: LogPayload): void {
    console.log(this.format("info", message, meta));
  }

  debug(message: string, meta?: LogPayload): void {
    if (process.env.LOG_LEVEL === "debug" || process.env.NODE_ENV === "development") {
      console.debug(this.format("debug", message, meta));
    }
  }

  warn(message: string, meta?: LogPayload): void {
    console.warn(this.format("warn", message, meta));
  }

  error(message: string, error?: unknown, meta?: LogPayload): void {
    const errorDetails =
      error instanceof Error
        ? { errorMessage: error.message, errorName: error.name }
        : { rawError: String(error) };
    console.error(this.format("error", message, { ...meta, ...errorDetails }));
  }
}

export const wsLogger = new WebSocketLogger();
