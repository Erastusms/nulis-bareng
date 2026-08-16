import { NextRequest } from "next/server";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { setSessionTokenCookie } from "@/server/auth/cookies";
import { authService } from "@/server/modules/auth/auth.service";

export async function POST(request: NextRequest) {
  try {
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
