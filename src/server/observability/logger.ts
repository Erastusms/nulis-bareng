import { getRequestContext } from "./request-context";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  boardId?: string;
  documentId?: string;
  event?: string;
  duration?: number;
  statusCode?: number;
  errorCode?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "password_hash",
  "sessiontoken",
  "session_token",
  "token",
  "cookie",
  "cookies",
  "authorization",
  "auth",
  "databaseurl",
  "database_url",
  "redisurl",
  "redis_url",
  "secret",
  "privatekey",
  "private_key",
  "apikey",
  "api_key",
  "accesstoken",
  "access_token",
  "refreshtoken",
  "refresh_token",
]);

/**
 * Recursively scrubs sensitive credentials, tokens, and secrets from logging objects.
 */
export function sanitizeLogData(data: unknown, depth = 0): unknown {
  if (depth > 5) return "[Max Depth Reached]";
  if (data === null || data === undefined) return data;

  if (typeof data !== "object") {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
    if (SENSITIVE_KEYS.has(lowerKey)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeLogData(value, depth + 1);
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Production-ready structured JSON logger with request correlation and privacy redaction.
 */
export class StructuredLogger {
  private format(
    level: LogLevel,
    event: string,
    meta?: LogFields,
    error?: unknown
  ): string {
    const timestamp = new Date().toISOString();
    const context = getRequestContext();

    const {
      requestId = context?.requestId,
      userId = context?.userId,
      workspaceId = context?.workspaceId,
      boardId,
      documentId,
      duration,
      statusCode,
      errorCode,
      meta: rawMeta,
      ...extraFields
    } = meta || {};

    const sanitizedExtra = sanitizeLogData(extraFields) as Record<string, unknown>;
    const sanitizedMeta = rawMeta ? (sanitizeLogData(rawMeta) as Record<string, unknown>) : undefined;

    let errorPayload: Record<string, unknown> | undefined = undefined;
    if (error !== undefined && error !== null) {
      if (error instanceof Error) {
        errorPayload = {
          message: error.message,
          name: error.name,
          ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
        };
      } else {
        errorPayload = { rawError: String(error) };
      }
    }

    const payload: Record<string, unknown> = {
      timestamp,
      level,
      event,
      ...(requestId && { requestId }),
      ...(userId && { userId }),
      ...(workspaceId && { workspaceId }),
      ...(boardId && { boardId }),
      ...(documentId && { documentId }),
      ...(duration !== undefined && { duration }),
      ...(statusCode !== undefined && { statusCode }),
      ...(errorCode && { errorCode }),
      ...(sanitizedMeta && Object.keys(sanitizedMeta).length > 0 && { meta: sanitizedMeta }),
      ...(Object.keys(sanitizedExtra).length > 0 && { extra: sanitizedExtra }),
      ...(errorPayload && { error: errorPayload }),
    };

    if (process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json") {
      return JSON.stringify(payload);
    }

    // Readable developer formatting
    const durationStr = duration !== undefined ? ` [${duration}ms]` : "";
    const reqStr = requestId ? ` [${requestId}]` : "";
    const metaStr = Object.keys(sanitizedExtra).length > 0 || sanitizedMeta
      ? ` ${JSON.stringify({ ...sanitizedExtra, ...sanitizedMeta })}`
      : "";
    const errStr = errorPayload ? ` error=${JSON.stringify(errorPayload)}` : "";

    return `[${timestamp}] [${level.toUpperCase()}] [${event}]${reqStr}${durationStr}${metaStr}${errStr}`;
  }

  info(event: string, meta?: LogFields): void {
    console.log(this.format("info", event, meta));
  }

  debug(event: string, meta?: LogFields): void {
    if (process.env.LOG_LEVEL === "debug" || process.env.NODE_ENV === "development") {
      console.debug(this.format("debug", event, meta));
    }
  }

  warn(event: string, meta?: LogFields): void {
    console.warn(this.format("warn", event, meta));
  }

  error(event: string, error?: unknown, meta?: LogFields): void {
    console.error(this.format("error", event, meta, error));
  }
}

export const appLogger = new StructuredLogger();
