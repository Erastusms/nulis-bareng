import { apiClient } from "@/lib/api/client";
import type { AuthResponseData, RegisterInput } from "../types";

export async function registerUser(data: RegisterInput): Promise<AuthResponseData> {
  return apiClient.post<AuthResponseData>("/auth/register", data);
}
