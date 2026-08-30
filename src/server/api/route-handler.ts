import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/api/errors";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/api/types";
import { appLogger } from "../observability/logger";
import { metrics } from "../observability/metrics";
import {
  extractOrGenerateRequestId,
  getCurrentRequestId,
  getRequestContext,
  runWithRequestContext,
} from "../observability/request-context";

/**
 * Creates a standardized JSON success response envelope with correlation headers.
 */
export function successResponse<T>(
  data: T,
  status = 200,
  headers?: Record<string, string>
): NextResponse<ApiSuccessResponse<T>> {
  const requestId = getCurrentRequestId();
  const res: NextResponse<ApiSuccessResponse<T>> = NextResponse.json(
    {
      success: true as const,
      data,
    },
    {
      status,
      headers: {
        "x-request-id": requestId,
        ...headers,
      },
    }
  );
  return res;
}

/**
 * Normalizes caught errors into standardized JSON error responses.
 * Never leaks database traces, passwords, or internal implementation details.
 */
export function errorResponse(
  error: unknown,
  customStatus?: number
): NextResponse<ApiErrorResponse> {
  const requestId = getCurrentRequestId();
  const context = getRequestContext();
  const duration = context ? Date.now() - context.startTime : undefined;

  let statusCode = customStatus || 500;
  let errorCode = "INTERNAL_SERVER_ERROR";
  let message = "An unexpected error occurred on the server.";
  let details: unknown = undefined;

  if (error instanceof ZodError) {
    statusCode = 400;
    errorCode = "VALIDATION_ERROR";
    message = error.errors[0]?.message || "Validation failed";
    details = error.flatten().fieldErrors;

    appLogger.warn("api.request.failed", {
      requestId,
      statusCode,
      errorCode,
      duration,
      meta: { validationErrors: details },
    });

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message,
          details,
        },
      },
      {
        status: statusCode,
        headers: { "x-request-id": requestId },
      }
    );
  }

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    errorCode = error.code;
    message = error.message;
    details = error.details;

    if (statusCode >= 500) {
      appLogger.error("api.request.failed", error, {
        requestId,
        statusCode,
        errorCode,
        duration,
      });
    } else {
      appLogger.warn("api.request.failed", {
        requestId,
        statusCode,
        errorCode,
        duration,
        meta: { message },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: {
          code: errorCode,
          message,
          details,
        },
      },
      {
        status: statusCode,
        headers: { "x-request-id": requestId },
      }
    );
  }

  // Unhandled internal server error
  appLogger.error("api.request.failed", error, {
    requestId,
    statusCode: 500,
    errorCode: "INTERNAL_SERVER_ERROR",
    duration,
  });

  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred on the server.",
      },
    },
    {
      status: 500,
      headers: { "x-request-id": requestId },
    }
  );
}

export interface RouteContext {
  params?: Promise<Record<string, string | string[]>>;
}

/**
 * Observability wrapper for Next.js API route handlers.
 * Sets up request correlation ID, measures latency, records metrics, and produces structured logs.
 */
export function withObservability<TContext extends RouteContext = RouteContext>(
  routeTemplate: string,
  handler: (request: NextRequest, context?: TContext) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: TContext): Promise<NextResponse> => {
    const startTime = Date.now();
    const requestId = extractOrGenerateRequestId(request.headers);
    const method = request.method || "GET";

    return runWithRequestContext(
      {
        requestId,
        startTime,
      },
      async () => {
        try {
          const response = await handler(request, context);
          const duration = Date.now() - startTime;

          // Attach x-request-id if not already present
          if (!response.headers.has("x-request-id")) {
            response.headers.set("x-request-id", requestId);
          }

          metrics.recordApiRequest(method, routeTemplate, response.status, duration);

          if (response.status < 400) {
            appLogger.info("api.request.completed", {
              requestId,
              statusCode: response.status,
              duration,
              event: "api.request.completed",
              meta: { method, route: routeTemplate },
            });
          }

          return response;
        } catch (error) {
          const duration = Date.now() - startTime;
          const errorRes = errorResponse(error);
          metrics.recordApiRequest(method, routeTemplate, errorRes.status, duration);
          return errorRes;
        }
      }
    );
  };
}
