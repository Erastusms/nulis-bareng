import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/api/errors";
import type { ApiErrorResponse, ApiSuccessResponse } from "@/lib/api/types";

/**
 * Creates a standardized JSON success response envelope.
 */
export function successResponse<T>(data: T, status = 200): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Normalizes caught errors into standardized JSON error responses.
 * Never leaks database traces, passwords, or internal implementation details.
 */
export function errorResponse(error: unknown): NextResponse<ApiErrorResponse> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: error.errors[0]?.message || "Validation failed",
          details: error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      },
      { status: error.statusCode }
    );
  }

  console.error("Unhandled API error:", error);
  return NextResponse.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred on the server.",
      },
    },
    { status: 500 }
  );
}
