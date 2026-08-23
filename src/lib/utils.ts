import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes safely with clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats an ISO date string into a user-friendly format.
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  } catch {
    return dateString;
  }
}

/**
 * Truncates text to a specified maximum length.
 */
export function truncate(text: string, maxLength: number): string {
  if (!text || text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/**
 * Validates and sanitizes a return URL to prevent open redirect vulnerabilities.
 * Ensures the destination is a safe relative internal application route.
 */
export function getSafeReturnUrl(rawUrl: string | null | undefined, fallback = "/"): string {
  if (!rawUrl || typeof rawUrl !== "string") {
    return fallback;
  }

  const trimmed = rawUrl.trim();

  // Must start with a single slash and not double slashes (protocol-relative) or backslashes
  if (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !trimmed.startsWith("/\\") &&
    !trimmed.includes(":")
  ) {
    return trimmed;
  }

  return fallback;
}

/**
 * Formats a Date object into MMDDYYYY format using server UTC/Date time.
 * E.g., August 23, 2026 -> "08232026".
 */
export function formatDateMMDDYYYY(date: Date = new Date()): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const year = String(date.getUTCFullYear());
  return `${month}${day}${year}`;
}

/**
 * Sanitizes a username for URL identifiers.
 */
export function sanitizeUsername(username: string): string {
  if (!username) return "user";
  const cleaned = username
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "user";
}

/**
 * Generates a unique workspace URL identifier in the format:
 * {requested-slug}-{username}-{creation-date}
 * Example: "backend-member123-08232026"
 */
export function generateWorkspaceUrlIdentifier(
  slug: string,
  username: string,
  date: Date = new Date()
): string {
  const normalizedSlug = slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const normalizedUser = sanitizeUsername(username);
  const dateStr = formatDateMMDDYYYY(date);

  return `${normalizedSlug || "workspace"}-${normalizedUser}-${dateStr}`;
}

