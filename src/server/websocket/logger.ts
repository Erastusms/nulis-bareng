import { sanitizeLogData } from "../observability/logger";
import { getRequestContext } from "../observability/request-context";

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
    const context = getRequestContext();
    const sanitizedMeta = meta ? (sanitizeLogData(meta) as LogPayload) : {};
    const requestId = (sanitizedMeta.requestId as string) || context?.requestId;

    if (process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json") {
      return JSON.stringify({
        timestamp,
        level,
        component: "websocket",
        message,
        ...(requestId && { requestId }),
        ...sanitizedMeta,
      });
    }

    const metaStr = Object.keys(sanitizedMeta).length > 0 ? ` ${JSON.stringify(sanitizedMeta)}` : "";
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
        : error !== undefined
          ? { rawError: String(error) }
          : {};
    console.error(this.format("error", message, { ...meta, ...errorDetails }));
  }
}

export const wsLogger = new WebSocketLogger();
