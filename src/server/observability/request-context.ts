import { AsyncLocalStorage } from "async_hooks";
import crypto from "crypto";

export interface RequestContextData {
  requestId: string;
  userId?: string;
  workspaceId?: string;
  startTime: number;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContextData>();

const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_\-.]{8,64}$/;

/**
 * Validates and extracts a request ID from incoming request headers,
 * or generates a new secure random identifier if absent or invalid.
 */
export function extractOrGenerateRequestId(headers?: Headers | Record<string, unknown>): string {
  if (headers) {
    let candidate: string | null = null;
    if (typeof (headers as Headers).get === "function") {
      candidate = (headers as Headers).get("x-request-id") || (headers as Headers).get("traceparent");
    } else {
      const rec = headers as Record<string, unknown>;
      const val = rec["x-request-id"] || rec["X-Request-Id"] || rec["x_request_id"] || rec["traceparent"];
      if (typeof val === "string") candidate = val;
      else if (Array.isArray(val) && typeof val[0] === "string") candidate = val[0];
    }

    if (candidate && VALID_REQUEST_ID_REGEX.test(candidate.trim())) {
      return candidate.trim();
    }
  }

  return `req_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Runs an asynchronous function within a scoped RequestContext.
 */
export function runWithRequestContext<T>(
  context: RequestContextData,
  callback: () => T
): T {
  return asyncLocalStorage.run(context, callback);
}

/**
 * Retrieves the current request context if active in the async execution chain.
 */
export function getRequestContext(): RequestContextData | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Retrieves the active requestId or generates a fallback ID if outside a request lifecycle.
 */
export function getCurrentRequestId(): string {
  const store = asyncLocalStorage.getStore();
  return store?.requestId || `ctx_${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;
}
