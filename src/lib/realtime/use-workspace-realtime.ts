"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeCacheUpdater } from "./query-cache-updater";
import { ConnectionStatus, getRealtimeClient } from "./ws-client";

/**
 * Hook to subscribe to real-time events for a workspace and automatically
 * synchronize TanStack Query cache with incoming domain events.
 */
export function useWorkspaceRealtime(workspaceId: string | undefined | null) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");

  useEffect(() => {
    if (!workspaceId) return;

    const client = getRealtimeClient();
    setStatus(client.getStatus());

    // Connect if not already connected
    client.connect();

    // Subscribe to workspace channel
    client.subscribe(workspaceId);

    // Listen for incoming domain events and update query cache
    const unsubscribeEvents = client.onEvent((event) => {
      realtimeCacheUpdater.applyEvent(queryClient, event);
    });

    // Listen for connection status changes
    const unsubscribeStatus = client.onStatusChange((newStatus) => {
      setStatus(newStatus);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeStatus();
      client.unsubscribe(workspaceId);
    };
  }, [workspaceId, queryClient]);

  return { status };
}
