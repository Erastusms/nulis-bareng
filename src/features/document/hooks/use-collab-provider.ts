"use client";

import * as React from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import * as Y from "yjs";
import { getCollabRoomName, getUserColor } from "../lib/collab-utils";
import type { CollabUserIdentity } from "@/server/collaboration/collab-auth";

export interface UseCollabProviderOptions {
  workspaceId: string;
  pageId: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string | null;
  } | null;
}

export type CollabConnectionStatus = "connecting" | "connected" | "disconnected";

export interface UseCollabProviderResult {
  provider: HocuspocusProvider | null;
  ydoc: Y.Doc | null;
  status: CollabConnectionStatus;
  isSynced: boolean;
  collaborators: CollabUserIdentity[];
  error: string | null;
}

function getCollabWsUrl(): string {
  if (process.env.NEXT_PUBLIC_COLLAB_WS_URL) {
    return process.env.NEXT_PUBLIC_COLLAB_WS_URL;
  }
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const hostname = window.location.hostname || "localhost";
    return `${protocol}//${hostname}:3002`;
  }
  return "ws://localhost:3002";
}

async function fetchSessionToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/token", { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.token || "";
  } catch {
    return "";
  }
}

export function useCollabProvider({
  workspaceId,
  pageId,
  user,
}: UseCollabProviderOptions): UseCollabProviderResult {
  const [provider, setProvider] = React.useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = React.useState<Y.Doc | null>(null);
  const [status, setStatus] = React.useState<CollabConnectionStatus>("connecting");
  const [isSynced, setIsSynced] = React.useState(false);
  const [collaborators, setCollaborators] = React.useState<CollabUserIdentity[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  const userId = user?.id;
  const userName = user?.name;
  const userAvatar = user?.avatarUrl;

  React.useEffect(() => {
    if (!workspaceId || !pageId) return;

    const documentName = getCollabRoomName(workspaceId, pageId);
    const wsUrl = getCollabWsUrl();
    const doc = new Y.Doc();

    setError(null);
    setStatus("connecting");
    setIsSynced(false);

    const hocuspocusProvider = new HocuspocusProvider({
      url: wsUrl,
      name: documentName,
      document: doc,
      token: fetchSessionToken,
      onStatus: ({ status: newStatus }) => {
        setStatus(newStatus as CollabConnectionStatus);
      },
      onSynced: ({ state }) => {
        setIsSynced(state);
      },
      onAuthenticationFailed: ({ reason }) => {
        setError(reason || "Authentication failed.");
        setStatus("disconnected");
      },
    });

    if (userId && userName) {
      const userColor = getUserColor(userId);
      hocuspocusProvider.setAwarenessField("user", {
        id: userId,
        name: userName,
        color: userColor,
        avatar: userAvatar || null,
      });
    }

    const updateCollaborators = () => {
      if (!hocuspocusProvider.awareness) return;
      const states = hocuspocusProvider.awareness.getStates();
      const active: CollabUserIdentity[] = [];

      states.forEach((state) => {
        if (state.user && typeof state.user === "object") {
          const u = state.user as CollabUserIdentity;
          if (u.id && !active.some((existing) => existing.id === u.id)) {
            active.push(u);
          }
        }
      });

      setCollaborators(active);
    };

    if (hocuspocusProvider.awareness) {
      hocuspocusProvider.awareness.on("change", updateCollaborators);
      updateCollaborators();
    }

    setProvider(hocuspocusProvider);
    setYdoc(doc);

    return () => {
      if (hocuspocusProvider.awareness) {
        hocuspocusProvider.awareness.off("change", updateCollaborators);
      }
      hocuspocusProvider.destroy();
      setProvider(null);
      setYdoc(null);
    };
  }, [workspaceId, pageId, userId, userName, userAvatar]);

  return {
    provider,
    ydoc,
    status,
    isSynced,
    collaborators,
    error,
  };
}
