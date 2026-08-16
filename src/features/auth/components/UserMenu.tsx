"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser, useLogout } from "../hooks/use-auth";


export function UserMenu() {
  const { data: user, isLoading } = useCurrentUser();
  const logoutMutation = useLogout();

  if (isLoading) {
    return (
      <div className="flex items-center space-x-3">
        <Skeleton className="h-8 w-24 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center space-x-2">
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
        <Link href="/register">
          <Button variant="default" size="sm">
            Create account
          </Button>
        </Link>
      </div>
    );
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "U";

  return (
    <div className="flex items-center space-x-3">
      <div className="flex items-center space-x-2.5">
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt={user.name}
            width={32}
            height={32}
            unoptimized
            className="h-8 w-8 rounded-full object-cover border border-border"
          />
        ) : (

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary border border-primary/20">
            {initials}
          </div>
        )}
        <div className="hidden flex-col text-left sm:flex">
          <span className="text-xs font-semibold text-foreground leading-none">{user.name}</span>
          <span className="text-[11px] text-muted-foreground leading-tight mt-0.5">{user.email}</span>
        </div>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => logoutMutation.mutate()}
        isLoading={logoutMutation.isPending}
        className="gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/30"
        title="Sign out"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden md:inline">Sign out</span>
      </Button>
    </div>
  );
}
