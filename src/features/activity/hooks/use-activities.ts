"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { activityKeys } from "@/lib/query/query-keys";
import type { PaginatedActivities } from "@/types/domain";

interface UseWorkspaceActivitiesOptions {
  limit?: number;
}

async function fetchActivities(
  workspaceId: string,
  limit = 20,
  cursor?: string
): Promise<PaginatedActivities> {
  const params = new URLSearchParams();
  params.set("limit", limit.toString());
  if (cursor) {
    params.set("cursor", cursor);
  }

  const res = await fetch(
    `/api/workspaces/${encodeURIComponent(workspaceId)}/activities?${params.toString()}`
  );

  if (!res.ok) {
    throw new Error("Failed to fetch workspace activities");
  }

  const json = await res.json();
  return json.data || { items: [], nextCursor: null };
}

/**
 * Hook to retrieve cursor-paginated workspace activity history with infinite scroll support.
 */
export function useWorkspaceActivities(
  workspaceId: string | undefined | null,
  options: UseWorkspaceActivitiesOptions = {}
) {
  const limit = options.limit || 20;

  return useInfiniteQuery({
    queryKey: workspaceId ? activityKeys.list(workspaceId, { limit }) : ["activities", "list", "disabled"],
    queryFn: ({ pageParam }) =>
      workspaceId
        ? fetchActivities(workspaceId, limit, pageParam as string | undefined)
        : Promise.resolve({ items: [], nextCursor: null }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(workspaceId),
    staleTime: 10000,
  });
}
