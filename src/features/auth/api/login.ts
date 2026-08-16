import { apiClient } from "@/lib/api/client";
import type { AuthResponseData, LoginInput } from "../types";

export async function loginUser(credentials: LoginInput): Promise<AuthResponseData> {
  return apiClient.post<AuthResponseData>("/auth/login", credentials);
}
