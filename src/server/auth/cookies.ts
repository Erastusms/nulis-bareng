import { cookies } from "next/headers";
import { type ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { SESSION_COOKIE_NAME } from "./session";

export function getSessionCookieOptions(expiresAt?: Date): Partial<ResponseCookie> {
  const isProduction = process.env.NODE_ENV === "production";

  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  };
}

/**
 * Reads the session token from the incoming cookie headers.
 */
export async function getSessionTokenFromCookies(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
  return sessionCookie?.value ?? null;
}

/**
 * Sets the session cookie on the current response store.
 */
export async function setSessionTokenCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  const options = getSessionCookieOptions(expiresAt);

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    ...options,
  });
}

/**
 * Clears the session cookie.
 */
export async function deleteSessionTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  const options = getSessionCookieOptions(new Date(0));

  cookieStore.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    ...options,
    maxAge: 0,
  });
}
