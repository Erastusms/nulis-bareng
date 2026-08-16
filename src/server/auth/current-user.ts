import { UnauthorizedError } from "@/lib/api/errors";
import { authService } from "@/server/modules/auth/auth.service";
import type { User } from "@/types/domain";
import { getSessionTokenFromCookies } from "./cookies";

/**
 * Retrieves the currently authenticated user from the request session cookie.
 * Returns null if the request is unauthenticated or the session has expired.
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = await getSessionTokenFromCookies();
  if (!token) {
    return null;
  }

  const result = await authService.validateSession(token);
  return result?.user ?? null;
}

/**
 * Enforces that the current request is authenticated.
 * Throws UnauthorizedError if unauthenticated, otherwise returns the non-null User.
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError("You must be logged in to perform this action.");
  }
  return user;
}
