import { NextRequest } from "next/server";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { setSessionTokenCookie } from "@/server/auth/cookies";
import { authService } from "@/server/modules/auth/auth.service";
import { getClientIp, rateLimiter, RATE_LIMIT_PRESETS } from "@/server/security/rate-limiter";

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    await rateLimiter.enforce(`login:${ip}`, RATE_LIMIT_PRESETS.AUTH);

    const json = await request.json();
    const validatedInput = loginSchema.parse(json);

    const { user, sessionToken, expiresAt } = await authService.login({
      email: validatedInput.email,
      password: validatedInput.password,
    });

    await setSessionTokenCookie(sessionToken, expiresAt);

    return successResponse({ user }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}

