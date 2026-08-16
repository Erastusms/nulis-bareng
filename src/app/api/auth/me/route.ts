import { errorResponse, successResponse } from "@/server/api/route-handler";
import { getCurrentUser } from "@/server/auth/current-user";
import { UnauthorizedError } from "@/lib/api/errors";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      throw new UnauthorizedError("Not authenticated");
    }

    return successResponse({ user }, 200);
  } catch (error) {
    return errorResponse(error);
  }
}
