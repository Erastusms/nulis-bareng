import { apiClient } from "@/lib/api/client";
import type { LogoutResponseData } from "../types";

export async function logoutUser(): Promise<LogoutResponseData> {
  return apiClient.post<LogoutResponseData>("/auth/logout");
}
