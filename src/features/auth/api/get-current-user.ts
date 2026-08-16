import { apiClient } from "@/lib/api/client";
import { UnauthorizedError } from "@/lib/api/errors";
import type { User } from "@/types/domain";
import type { AuthResponseData } from "../types";

export async function getCurrentUser(): Promise<User | null> {
  try {
    const data = await apiClient.get<AuthResponseData>("/auth/me");
    return data.user;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }
    throw error;
  }
}
