import { QueryClient } from "@tanstack/react-query";

/**
 * Creates and configures a TanStack QueryClient with production defaults.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 2, // 2 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
        retry: (failureCount, error) => {
          // Do not retry 401, 403, 404 client errors
          if (
            typeof error === "object" &&
            error !== null &&
            "statusCode" in error &&
            [401, 403, 404].includes((error as { statusCode: number }).statusCode)
          ) {
            return false;
          }
          return failureCount < 3;
        },
        refetchOnWindowFocus: process.env.NODE_ENV === "production",
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}
