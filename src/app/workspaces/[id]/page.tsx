"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowRight, FileText, Kanban, ShieldCheck, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/hooks/use-workspaces";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace-members";

export default function WorkspaceOverviewPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const { data: workspace, isLoading: isWsLoading, error: wsError } = useWorkspace(workspaceId);
  const { data: members, isLoading: isMembersLoading } = useWorkspaceMembers(workspaceId);

  if (isWsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-28 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
      </div>
    );
  }

  if (wsError || !workspace) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
        Unable to load workspace details or you do not have permission to access this workspace.
      </div>
    );
  }

  const role = (workspace.currentUserRole || workspace.role)?.toUpperCase();

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <Card className="border-border/60 bg-gradient-to-r from-primary/5 via-card to-card">
        <CardHeader>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span>Workspace Active • {role} Role</span>
          </div>
          <CardTitle className="text-2xl font-bold">{workspace.name}</CardTitle>
          <CardDescription className="text-sm">
            {workspace.description || "Welcome to your collaborative team workspace."}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Members Module */}
        <Card className="transition-all hover:border-primary/50">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <CardTitle className="text-base pt-2">Team & Members</CardTitle>
            <CardDescription className="text-xs">
              {isMembersLoading ? "Loading members..." : `${members?.length || 1} active members in workspace`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href={`/workspaces/${workspaceId}/members`}>
              <Button variant="outline" size="sm" className="w-full justify-between gap-1 text-xs">
                <span>Manage Members</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Boards Placeholder */}
        <Card className="transition-all hover:border-primary/50">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Kanban className="h-5 w-5" />
            </div>
            <CardTitle className="text-base pt-2">Kanban Boards</CardTitle>
            <CardDescription className="text-xs">
              Phase 4: Drag & Drop Kanban boards with columns and cards.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" disabled className="w-full justify-between gap-1 text-xs">
              <span>Coming in Phase 4</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>

        {/* Documents Placeholder */}
        <Card className="transition-all hover:border-primary/50">
          <CardHeader className="space-y-1 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <FileText className="h-5 w-5" />
            </div>
            <CardTitle className="text-base pt-2">Documents</CardTitle>
            <CardDescription className="text-xs">
              Phase 5: Real-time collaborative documents and notes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" disabled className="w-full justify-between gap-1 text-xs">
              <span>Coming in Phase 5</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
