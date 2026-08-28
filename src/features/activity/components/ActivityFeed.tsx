"use client";

import * as React from "react";
import Image from "next/image";
import {
  Activity as ActivityIcon,
  Clock,
  FileText,
  FolderPlus,
  Kanban,
  LayoutGrid,
  Loader2,
  SquareCheck,
  UserCheck,
  UserMinus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaceActivities } from "../hooks/use-activities";
import type { Activity, ActivityType } from "@/types/domain";

function getActivityIcon(type: ActivityType) {
  switch (type) {
    case "WORKSPACE_CREATED":
    case "WORKSPACE_RENAMED":
      return <LayoutGrid className="h-4 w-4 text-primary" />;
    case "MEMBER_JOINED":
      return <UserCheck className="h-4 w-4 text-emerald-500" />;
    case "MEMBER_LEFT":
      return <UserMinus className="h-4 w-4 text-rose-500" />;
    case "BOARD_CREATED":
    case "BOARD_RENAMED":
    case "BOARD_DELETED":
      return <Kanban className="h-4 w-4 text-indigo-500" />;
    case "COLUMN_CREATED":
    case "COLUMN_RENAMED":
    case "COLUMN_DELETED":
    case "COLUMN_MOVED":
      return <FolderPlus className="h-4 w-4 text-sky-500" />;
    case "CARD_CREATED":
    case "CARD_RENAMED":
    case "CARD_DELETED":
    case "CARD_MOVED":
      return <SquareCheck className="h-4 w-4 text-violet-500" />;
    case "DOCUMENT_CREATED":
    case "DOCUMENT_RENAMED":
    case "DOCUMENT_DELETED":
      return <FileText className="h-4 w-4 text-amber-500" />;
    default:
      return <ActivityIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatActivityMessage(activity: Activity): React.ReactNode {
  const meta = (activity.metadata || {}) as Record<string, any>;
  const actorName = activity.actor?.name || "Someone";

  switch (activity.type) {
    case "WORKSPACE_CREATED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created the workspace{" "}
          <span className="font-medium text-foreground">{meta.workspaceName || "this workspace"}</span>.
        </span>
      );
    case "WORKSPACE_RENAMED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> renamed the workspace to{" "}
          <span className="font-medium text-foreground">{meta.workspaceName}</span>.
        </span>
      );
    case "MEMBER_JOINED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{meta.memberName || actorName}</strong> joined the workspace.
        </span>
      );
    case "MEMBER_LEFT":
      return (
        <span>
          <strong className="font-semibold text-foreground">{meta.targetMemberName || actorName}</strong> left the workspace.
        </span>
      );
    case "BOARD_CREATED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created board{" "}
          <span className="font-medium text-foreground">{meta.boardTitle || "a new board"}</span>.
        </span>
      );
    case "BOARD_RENAMED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> renamed board to{" "}
          <span className="font-medium text-foreground">{meta.boardTitle}</span>.
        </span>
      );
    case "BOARD_DELETED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> deleted board{" "}
          <span className="font-medium text-foreground">{meta.boardTitle || "a board"}</span>.
        </span>
      );
    case "COLUMN_CREATED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created column{" "}
          <span className="font-medium text-foreground">{meta.columnTitle}</span>.
        </span>
      );
    case "COLUMN_RENAMED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> renamed column to{" "}
          <span className="font-medium text-foreground">{meta.columnTitle}</span>.
        </span>
      );
    case "COLUMN_DELETED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> deleted column{" "}
          <span className="font-medium text-foreground">{meta.columnTitle || "a column"}</span>.
        </span>
      );
    case "COLUMN_MOVED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> reordered board columns.
        </span>
      );
    case "CARD_CREATED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> added card{" "}
          <span className="font-medium text-foreground">{meta.cardTitle || "a new card"}</span>.
        </span>
      );
    case "CARD_RENAMED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> renamed card to{" "}
          <span className="font-medium text-foreground">{meta.cardTitle}</span>.
        </span>
      );
    case "CARD_DELETED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> deleted card{" "}
          <span className="font-medium text-foreground">{meta.cardTitle || "a card"}</span>.
        </span>
      );
    case "CARD_MOVED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> moved card{" "}
          <span className="font-medium text-foreground">{meta.cardTitle || "a card"}</span>.
        </span>
      );
    case "DOCUMENT_CREATED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> created document{" "}
          <span className="font-medium text-foreground">{meta.documentTitle || "a document"}</span>.
        </span>
      );
    case "DOCUMENT_RENAMED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> renamed document to{" "}
          <span className="font-medium text-foreground">{meta.documentTitle}</span>.
        </span>
      );
    case "DOCUMENT_DELETED":
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> deleted document{" "}
          <span className="font-medium text-foreground">{meta.documentTitle || "a document"}</span>.
        </span>
      );
    default:
      return (
        <span>
          <strong className="font-semibold text-foreground">{actorName}</strong> performed an update.
        </span>
      );
  }
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "just now";
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface ActivityFeedProps {
  workspaceId: string;
  className?: string;
  limit?: number;
}

export function ActivityFeed({ workspaceId, className, limit = 20 }: ActivityFeedProps) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useWorkspaceActivities(workspaceId, { limit });

  const activities = React.useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page) => page.items || []);
  }, [data]);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ActivityIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Workspace Activity</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">Real-time log</span>
        </div>
        <CardDescription>
          Recent audit and collaboration updates across this workspace.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start space-x-3 py-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
            Failed to load workspace activity log.
          </div>
        )}

        {!isLoading && !isError && activities.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Clock className="h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">No activity recorded yet</p>
            <p className="text-xs text-muted-foreground">
              Actions taken in boards, documents, and settings will appear here.
            </p>
          </div>
        )}

        {!isLoading && !isError && activities.length > 0 && (
          <div className="divide-y divide-border/60">
            {activities.map((activity) => {
              const actorInitials = activity.actor?.name
                ? activity.actor.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()
                : "U";

              return (
                <div key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="relative mt-0.5">
                    {activity.actor?.avatarUrl ? (
                      <Image
                        src={activity.actor.avatarUrl}
                        alt={activity.actor.name || "Actor"}
                        width={32}
                        height={32}
                        unoptimized
                        className="h-8 w-8 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground border border-border">
                        {actorInitials}
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 rounded-full bg-background p-0.5 ring-1 ring-border shadow-xs">
                      {getActivityIcon(activity.type)}
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {formatActivityMessage(activity)}
                    </p>
                    <span className="text-[11px] text-muted-foreground/80 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 inline" />
                      {formatRelativeTime(activity.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasNextPage && (
          <div className="pt-2 text-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="w-full text-xs gap-1.5"
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading more...
                </>
              ) : (
                "Load more activities"
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
