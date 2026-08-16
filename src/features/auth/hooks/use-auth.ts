import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userKeys } from "@/lib/query/query-keys";
import type { User } from "@/types/domain";
import { getCurrentUser } from "../api/get-current-user";
import { loginUser } from "../api/login";
import { logoutUser } from "../api/logout";
import { registerUser } from "../api/register";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema";

/**
 * Hook to retrieve the currently authenticated user from server session state.
 */
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: userKeys.current(),
    queryFn: getCurrentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });
}

/**
 * Mutation hook for user login.
 */
export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentials: LoginInput) => loginUser(credentials),
    onSuccess: (data) => {
      queryClient.setQueryData(userKeys.current(), data.user);
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

/**
 * Mutation hook for user registration.
 */
export function useRegister() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RegisterInput) => registerUser(data),
    onSuccess: (data) => {
      queryClient.setQueryData(userKeys.current(), data.user);
      queryClient.invalidateQueries({ queryKey: userKeys.current() });
    },
  });
}

/**
 * Mutation hook for user logout.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      queryClient.setQueryData(userKeys.current(), null);
      queryClient.clear();
    },
  });
}
