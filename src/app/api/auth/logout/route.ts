import { deleteSessionTokenCookie, getSessionTokenFromCookies } from "@/server/auth/cookies";
import { errorResponse, successResponse } from "@/server/api/route-handler";
import { authService } from "@/server/modules/auth/auth.service";

export async function POST() {
  try {
    const sessionToken = await getSessionTokenFromCookies();

    if (sessionToken) {
      await authService.logout(sessionToken);
    }

    await deleteSessionTokenCookie();

    return successResponse({ message: "Logged out successfully." }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
