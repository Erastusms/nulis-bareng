"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { presenceKeys } from "@/lib/query/query-keys";
import { getRealtimeClient } from "@/lib/realtime/ws-client";
import type { PresenceStatus, UserPresence } from "@/types/domain";

async function fetchWorkspacePresence(workspaceId: string): Promise<UserPresence[]> {
  const res = await fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/presence`);
  if (!res.ok) {
    throw new Error("Failed to fetch workspace presence");
  }
  const json = await res.json();
  return json.data || [];
}

/**
 * Hook to retrieve and subscribe to all member presence states within a workspace.
 */
export function useWorkspacePresence(workspaceId: string | undefined | null) {
  return useQuery({
    queryKey: workspaceId ? presenceKeys.workspace(workspaceId) : ["presence", "workspace", "disabled"],
    queryFn: () => (workspaceId ? fetchWorkspacePresence(workspaceId) : Promise.resolve([])),
    enabled: Boolean(workspaceId),
    staleTime: 10000,
  });
}

/**
 * Hook to retrieve a single user's presence state from the client query cache.
 */
export function useUserPresence(userId: string | undefined | null): UserPresence {
  const queryClient = useQueryClient();
  if (!userId) {
    return { userId: "", status: "OFFLINE", lastSeenAt: new Date().toISOString() };
  }

  const cached = queryClient.getQueryData<UserPresence>(presenceKeys.user(userId));
  return cached || { userId, status: "OFFLINE", lastSeenAt: new Date().toISOString() };
}

/**
 * Hook to provide status update controls (e.g. ONLINE or AWAY).
 */
export function usePresenceUpdater() {
  const setStatus = (status: "ONLINE" | "AWAY") => {
    const client = getRealtimeClient();
    client.setPresence(status);
  };

  return { setStatus };
}
