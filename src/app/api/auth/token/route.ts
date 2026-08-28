import { NextRequest } from "next/server";
import { getSessionTokenFromCookies } from "@/server/auth/cookies";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { UnauthorizedError } from "@/lib/api/errors";
import { authService } from "@/server/modules/auth/auth.service";
import { getClientIp, rateLimiter, RATE_LIMIT_PRESETS } from "@/server/security/rate-limiter";

/**
 * Returns the current active session token for WebSocket collaboration authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    await rateLimiter.enforce(`token:${ip}`, RATE_LIMIT_PRESETS.TOKEN);

    const sessionToken = await getSessionTokenFromCookies();
    if (!sessionToken) {
      return errorResponse(new UnauthorizedError("Authentication required."));
    }

    const sessionResult = await authService.validateSession(sessionToken);
    if (!sessionResult) {
      return errorResponse(new UnauthorizedError("Invalid or expired session."));
    }

    return successResponse({ token: sessionToken });
  } catch (error) {
    return errorResponse(error);
  }
}

