export type { User } from "@/types/domain";
export type {
  LoginInput,
  RegisterInput,
  RegisterFormInput,
} from "../schemas/auth.schema";

export interface AuthResponseData {
  user: import("@/types/domain").User;
}

export interface LogoutResponseData {
  message: string;
}
