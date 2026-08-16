import { env } from "@/config/env";
import {
  ConflictError,
  ForbiddenError,
  InternalServerError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  ValidationError,
  normalizeError,
} from "./errors";
import type { ApiResponse, RequestOptions } from "./types";

export class ApiClient {
  private readonly baseUrl: string;
  private readonly defaultTimeoutMs: number;

  constructor(options?: { baseUrl?: string; defaultTimeoutMs?: number }) {
    this.baseUrl = options?.baseUrl ?? env.NEXT_PUBLIC_API_URL;
    this.defaultTimeoutMs = options?.defaultTimeoutMs ?? 15000;
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined | null>,
    customBaseUrl?: string
  ): string {
    const base = (customBaseUrl ?? this.baseUrl).replace(/\/$/, "");
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const url = new URL(`${base}${path}`);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  public async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const {
      baseUrl,
      params,
      body,
      headers,
      timeoutMs = this.defaultTimeoutMs,
      ...customConfig
    } = options;

    const targetUrl = this.buildUrl(endpoint, params, baseUrl);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const requestHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(headers as Record<string, string>),
    };

    const config: RequestInit = {
      ...customConfig,
      headers: requestHeaders,
      signal: controller.signal,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    };

    try {
      const response = await fetch(targetUrl, config);
      clearTimeout(timer);

      let responseData: unknown;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        this.handleHttpError(response.status, responseData);
      }

      // If response conforms to envelope { success: true, data: T }
      if (
        responseData &&
        typeof responseData === "object" &&
        "success" in responseData &&
        "data" in responseData
      ) {
        const envelope = responseData as ApiResponse<T>;
        if (envelope.success) {
          return envelope.data;
        }
      }

      return responseData as T;
    } catch (error: unknown) {
      clearTimeout(timer);
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new NetworkError("Request timed out. Please try again.");
      }
      throw normalizeError(error);
    }
  }

  private handleHttpError(status: number, data: unknown): never {
    let message = "An error occurred";
    let details: unknown = undefined;

    if (data && typeof data === "object") {
      const errorObj =
        (data as { error?: { message?: string; code?: string; details?: unknown } }).error ??
        (data as { message?: string });
      message = errorObj.message || message;
      details = (errorObj as { details?: unknown }).details;
    }

    switch (status) {
      case 400:
        throw new ValidationError(message, details);
      case 401:
        throw new UnauthorizedError(message);
      case 403:
        throw new ForbiddenError(message);
      case 404:
        throw new NotFoundError(message);
      case 409:
        throw new ConflictError(message);
      case 429:
        throw new RateLimitError(message);
      case 500:
      default:
        throw new InternalServerError(message);
    }
  }

  public get<T>(endpoint: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  public post<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "POST", body });
  }

  public put<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PUT", body });
  }

  public patch<T>(
    endpoint: string,
    body?: unknown,
    options?: Omit<RequestOptions, "method" | "body">
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "PATCH", body });
  }

  public delete<T>(endpoint: string, options?: Omit<RequestOptions, "method">): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
