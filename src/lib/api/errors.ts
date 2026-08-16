/**
 * Base Application Error class for domain and API errors.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation failed", details?: Record<string, string[]> | unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied") {
    super(message, 403, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "Resource", identifier?: string) {
    const message = identifier
      ? `${resource} with ID '${identifier}' was not found.`
      : `${resource} not found.`;
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Resource conflict") {
    super(message, 409, "CONFLICT");
  }
}

export class RateLimitError extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, 429, "RATE_LIMIT_EXCEEDED");
  }
}

export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred on the server.") {
    super(message, 500, "INTERNAL_SERVER_ERROR");
  }
}

export class NetworkError extends AppError {
  constructor(message = "Network connection failed or timed out.") {
    super(message, 0, "NETWORK_ERROR");
  }
}

/**
 * Normalizes any caught error into a known AppError subclass.
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return new NetworkError("Unable to reach the server. Please check your connection.");
  }

  if (error instanceof Error) {
    return new AppError(error.message, 500, "UNKNOWN_ERROR");
  }

  return new AppError("An unknown error occurred", 500, "UNKNOWN_ERROR", error);
}
