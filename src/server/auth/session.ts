export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const SESSION_COOKIE_NAME = "nb_session";

/**
 * Generates a cryptographically secure random session token (64 hex characters / 256 bits).
 * Uses universal Web Crypto API, fully compatible with Edge and Node.js runtimes.
 */
export function generateSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Computes expiration date for a new session.
 */
export function getSessionExpiration(durationMs: number = SESSION_DURATION_MS): Date {
  return new Date(Date.now() + durationMs);
}

/**
 * Checks whether a given expiration date is in the past.
 */
export function isSessionExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() <= Date.now();
}
