/**
 * Standard API response envelope formats.
 */

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  code: string;
  message: string;
  details?: Record<string, string[]> | unknown;
}

export interface ApiErrorResponse {
  success: false;
  error: ApiErrorDetail;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  baseUrl?: string;
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  timeoutMs?: number;
}
