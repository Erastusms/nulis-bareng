"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PresenceStatus } from "@/types/domain";

interface PresenceIndicatorProps {
  status?: PresenceStatus;
  showLabel?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function PresenceIndicator({
  status = "OFFLINE",
  showLabel = false,
  className,
  size = "md",
}: PresenceIndicatorProps) {
  const dotSizes = {
    sm: "h-2 w-2",
    md: "h-2.5 w-2.5",
    lg: "h-3 w-3",
  };

  const statusConfig = {
    ONLINE: {
      color: "bg-emerald-500",
      ring: "ring-emerald-500/20",
      text: "Online",
      textColor: "text-emerald-700 dark:text-emerald-400",
    },
    AWAY: {
      color: "bg-amber-500",
      ring: "ring-amber-500/20",
      text: "Away",
      textColor: "text-amber-700 dark:text-amber-400",
    },
    OFFLINE: {
      color: "bg-zinc-400 dark:bg-zinc-600",
      ring: "ring-zinc-400/20",
      text: "Offline",
      textColor: "text-muted-foreground",
    },
  };

  const current = statusConfig[status] || statusConfig.OFFLINE;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)} title={current.text}>
      <span className="relative flex items-center justify-center">
        {status === "ONLINE" && (
          <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75", current.color)} />
        )}
        <span
          className={cn(
            "relative inline-block rounded-full ring-2",
            dotSizes[size],
            current.color,
            current.ring
          )}
        />
      </span>
      {showLabel && (
        <span className={cn("text-xs font-medium capitalize", current.textColor)}>
          {current.text}
        </span>
      )}
    </div>
  );
}
