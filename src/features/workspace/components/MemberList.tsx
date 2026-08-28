"use client";

import * as React from "react";
import Image from "next/image";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/features/auth/hooks/use-auth";
import { PresenceIndicator } from "@/features/presence/components/PresenceIndicator";
import { useWorkspacePresence } from "@/features/presence/hooks/use-presence";
import { useWorkspace } from "../hooks/use-workspaces";
import { useWorkspaceMembers } from "../hooks/use-workspace-members";
import { InviteMemberModal } from "./InviteMemberModal";
import { RemoveMemberDialog } from "./RemoveMemberDialog";
import type { WorkspaceMember, WorkspaceRole } from "@/types/domain";


function getRoleBadgeVariant(role?: WorkspaceRole) {
  const norm = role?.toUpperCase();
  if (norm === "OWNER") return "default" as const;
  if (norm === "ADMIN") return "warning" as const;
  return "outline" as const;
}

interface MemberListProps {
  workspaceId: string;
}

export function MemberList({ workspaceId }: MemberListProps) {
  const { data: currentUser } = useCurrentUser();
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: members, isLoading, error } = useWorkspaceMembers(workspaceId);
  const { data: presenceList } = useWorkspacePresence(workspaceId);

  const presenceMap = React.useMemo(() => {
    const map = new Map<string, "ONLINE" | "AWAY" | "OFFLINE">();
    if (presenceList) {
      for (const p of presenceList) {
        map.set(p.userId, p.status);
      }
    }
    return map;
  }, [presenceList]);

  const [isInviteOpen, setIsInviteOpen] = React.useState(false);
  const [memberToRemove, setMemberToRemove] = React.useState<WorkspaceMember | null>(null);

  const currentUserRole = (workspace?.currentUserRole || workspace?.role)?.toUpperCase();
  const canInvite = currentUserRole === "OWNER" || currentUserRole === "ADMIN";

  const canRemoveTarget = (target: WorkspaceMember) => {
    if (!currentUser) return false;
    const targetNormRole = target.role.toUpperCase();
    const isOwner = targetNormRole === "OWNER" || workspace?.ownerId === target.userId;
    const isSelf = currentUser.id === target.userId;

    if (isOwner || isSelf) return false;
    if (currentUserRole === "OWNER") return true;
    if (currentUserRole === "ADMIN" && targetNormRole === "MEMBER") return true;
    return false;
  };


  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Team Members
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage who has access to this workspace and their assigned roles
          </p>
        </div>

        {canInvite && (
          <Button onClick={() => setIsInviteOpen(true)} className="gap-2 self-start sm:self-auto">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Workspace Members</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              {members?.length || 0} {members?.length === 1 ? "member" : "members"}
            </span>
          </div>
          <CardDescription>
            All collaborators currently participating in this workspace.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isLoading && (
            <div className="divide-y divide-border">
              {[1, 2, 3].map((n) => (
                <div key={n} className="flex items-center justify-between py-3.5">
                  <div className="flex items-center space-x-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-32 rounded-md" />
                      <Skeleton className="h-3 w-48 rounded-md" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-16 rounded-full" />
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
              Failed to load workspace members. Please refresh or verify your access.
            </div>
          )}

          {!isLoading && !error && members && (
            <div className="divide-y divide-border">
              {members.map((member) => {
                const normRole = member.role.toUpperCase();
                const isCurrent = currentUser?.id === member.userId;
                const initials = member.user?.name
                  ? member.user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "U";

                const joinedDate = member.joinedAt
                  ? new Date(member.joinedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : null;

                const memberPresence = presenceMap.get(member.userId) || "OFFLINE";

                return (
                  <div
                    key={member.id}
                    className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        {member.user?.avatarUrl ? (
                          <Image
                            src={member.user.avatarUrl}
                            alt={member.user?.name || "Member Avatar"}
                            width={40}
                            height={40}
                            unoptimized
                            className="h-10 w-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary border border-primary/20">
                            {initials}
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background p-0.5 shadow-xs">
                          <PresenceIndicator status={memberPresence} size="sm" />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {member.user?.name || "Anonymous User"}
                          </span>
                          {isCurrent && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {member.user?.email || member.userId}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <PresenceIndicator status={memberPresence} showLabel size="sm" className="hidden sm:inline-flex" />

                      {joinedDate && (
                        <span className="hidden text-xs text-muted-foreground md:inline">
                          Joined {joinedDate}
                        </span>
                      )}

                      <Badge
                        variant={getRoleBadgeVariant(member.role)}
                        className="uppercase text-[11px] px-2.5 py-0.5"
                      >
                        {normRole}
                      </Badge>


                      {canRemoveTarget(member) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setMemberToRemove(member)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Remove member"
                          aria-label={`Remove ${member.user?.name || member.user?.email}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <InviteMemberModal
        workspaceId={workspaceId}
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
      />

      <RemoveMemberDialog
        workspaceId={workspaceId}
        member={memberToRemove}
        isOpen={Boolean(memberToRemove)}
        onClose={() => setMemberToRemove(null)}
      />
    </div>
  );
}
