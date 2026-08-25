"use client";

import React, { createContext, useContext } from "react";
import { useWorkspaceRealtime } from "@/lib/realtime/use-workspace-realtime";
import type { ConnectionStatus } from "@/lib/realtime/ws-client";

interface RealtimeContextValue {
  status: ConnectionStatus;
  isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "disconnected",
  isConnected: false,
});

interface WorkspaceRealtimeProviderProps {
  workspaceId: string;
  children: React.ReactNode;
}

export function WorkspaceRealtimeProvider({
  workspaceId,
  children,
}: WorkspaceRealtimeProviderProps) {
  const { status } = useWorkspaceRealtime(workspaceId);

  return (
    <RealtimeContext.Provider
      value={{
        status,
        isConnected: status === "connected",
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeContext(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
