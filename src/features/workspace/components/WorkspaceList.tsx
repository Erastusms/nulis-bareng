"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Boxes, Plus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspaces } from "../hooks/use-workspaces";
import { CreateWorkspaceModal } from "./CreateWorkspaceModal";
import type { WorkspaceRole } from "@/types/domain";

function getRoleBadgeVariant(role?: WorkspaceRole) {
  const norm = role?.toUpperCase();
  if (norm === "OWNER") return "default" as const;
  if (norm === "ADMIN") return "warning" as const;
  return "outline" as const;
}

export function WorkspaceList() {
  const { data: workspaces, isLoading, error } = useWorkspaces();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Workspaces
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your collaborative team workspaces and projects
          </p>
        </div>

        <Button onClick={() => setIsCreateOpen(true)} className="gap-2 self-start sm:self-auto">
          <Plus className="h-4 w-4" />
          Create Workspace
        </Button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <Card key={n} className="space-y-3 p-5">
              <Skeleton className="h-6 w-3/4 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-16 w-full rounded-md" />
            </Card>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
          Failed to load workspaces. Please refresh or try again later.
        </div>
      )}

      {!isLoading && !error && workspaces?.length === 0 && (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Boxes className="h-6 w-6" />
          </div>
          <CardTitle className="mt-4 text-lg">No workspaces found</CardTitle>
          <CardDescription className="mt-1.5 max-w-sm text-sm">
            You don&apos;t belong to any workspaces yet. Create your first workspace to start collaborating.
          </CardDescription>
          <Button onClick={() => setIsCreateOpen(true)} className="mt-5 gap-2">
            <Plus className="h-4 w-4" />
            Create Workspace
          </Button>
        </Card>
      )}

      {!isLoading && workspaces && workspaces.length > 0 && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => {
            const role = workspace.currentUserRole || workspace.role;
            const normRole = role?.toUpperCase();

            return (
              <Link
                key={workspace.id}
                href={`/workspaces/${workspace.urlIdentifier || workspace.id}`}
                className="group block transition-transform focus:outline-none"
              >
                <Card className="h-full transition-all duration-200 hover:border-primary/50 hover:shadow-md">
                  <CardHeader className="space-y-2 pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-bold text-primary">
                          {workspace.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          /{workspace.urlIdentifier || workspace.slug}
                        </span>
                      </div>
                      <Badge variant={getRoleBadgeVariant(role)} className="uppercase text-[10px]">
                        {normRole || "MEMBER"}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-semibold transition-colors group-hover:text-primary">
                      {workspace.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {workspace.description || "No description provided."}
                    </p>

                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        <span>{workspace.memberCount ?? 1} {workspace.memberCount === 1 ? "member" : "members"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-primary font-medium">
                        <span>Open</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <CreateWorkspaceModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
