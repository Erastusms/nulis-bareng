"use client";

import * as React from "react";
import type { CollabUserIdentity } from "@/server/collaboration/collab-auth";

interface CollaboratorListProps {
  collaborators: CollabUserIdentity[];
  currentUserId?: string;
}

export function CollaboratorList({
  collaborators,
  currentUserId,
}: CollaboratorListProps) {
  if (!collaborators || collaborators.length === 0) return null;

  const displayLimit = 4;
  const visible = collaborators.slice(0, displayLimit);
  const overflow = collaborators.length - displayLimit;

  return (
    <div className="flex items-center -space-x-1.5 overflow-hidden">
      {visible.map((collab) => {
        const isCurrent = collab.id === currentUserId;
        const initials = (collab.name || "U")
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();

        return (
          <div
            key={collab.id}
            title={`${collab.name}${isCurrent ? " (You)" : ""}`}
            className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow-sm transition-transform hover:z-10 hover:scale-110"
            style={{ backgroundColor: collab.color }}
          >
            {initials}
          </div>
        );
      })}

      {overflow > 0 && (
        <div
          title={`${overflow} more collaborator${overflow > 1 ? "s" : ""}`}
          className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm"
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
