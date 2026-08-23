"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useWorkspace } from "../hooks/use-workspaces";
import type { WorkspaceRole } from "@/types/domain";

function getRoleBadgeVariant(role?: WorkspaceRole) {
  const norm = role?.toUpperCase();
  if (norm === "OWNER") return "default" as const;
  if (norm === "ADMIN") return "warning" as const;
  return "outline" as const;
}

interface WorkspaceHeaderProps {
  workspaceId: string;
}

export function WorkspaceHeader({ workspaceId }: WorkspaceHeaderProps) {
  const pathname = usePathname();
  const { data: workspace, isLoading } = useWorkspace(workspaceId);

  if (isLoading) {
    return (
      <div className="space-y-4 border-b bg-card/40 pb-4 pt-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
    );
  }

  if (!workspace) return null;

  const role = workspace.currentUserRole || workspace.role;
  const normRole = role?.toUpperCase();
  const canManage = normRole === "OWNER" || normRole === "ADMIN";

  const tabs = [
    {
      name: "Overview",
      href: `/workspaces/${workspaceId}`,
      icon: LayoutDashboard,
      active: pathname === `/workspaces/${workspaceId}`,
    },
    {
      name: "Members",
      href: `/workspaces/${workspaceId}/members`,
      icon: Users,
      active: pathname === `/workspaces/${workspaceId}/members`,
    },
    ...(canManage
      ? [
          {
            name: "Settings",
            href: `/workspaces/${workspaceId}/settings`,
            icon: Settings,
            active: pathname === `/workspaces/${workspaceId}/settings`,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-4 border-b bg-card/40 pb-0 pt-6">
      {/* Back Link and Workspace Title */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/workspaces"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>All Workspaces</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
              {workspace.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {workspace.name}
              </h1>
              <p className="font-mono text-xs text-muted-foreground">/{workspace.urlIdentifier || workspace.slug}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Badge variant={getRoleBadgeVariant(role)} className="gap-1 px-3 py-1 uppercase text-xs">
            <Shield className="h-3 w-3" />
            <span>Role: {normRole || "MEMBER"}</span>
          </Badge>
        </div>
      </div>

      {/* Navigation Tabs */}
      <nav className="flex space-x-1 overflow-x-auto border-t border-border/50 pt-2" aria-label="Workspace Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors hover:text-foreground focus:outline-none",
                tab.active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
