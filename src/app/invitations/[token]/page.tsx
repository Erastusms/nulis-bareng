"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Clock, LogIn, Mail, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { siteConfig } from "@/config/site";
import { useCurrentUser } from "@/features/auth/hooks/use-auth";
import { apiClient } from "@/lib/api/client";
import { AppError } from "@/lib/api/errors";
import { workspaceKeys } from "@/lib/query/query-keys";
import type { InvitationDetails } from "@/server/modules/workspaces/workspace-member.service";

export default function InvitationAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: isAuthLoading } = useCurrentUser();

  const [invitation, setInvitation] = React.useState<InvitationDetails | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [acceptSuccess, setAcceptSuccess] = React.useState(false);

  React.useEffect(() => {
    async function fetchInvitation() {
      try {
        setIsLoading(true);
        const data = await apiClient.get<InvitationDetails>(`/invitations/${token}`);
        setInvitation(data);
      } catch (err) {
        if (err instanceof AppError) {
          setError(err.message);
        } else {
          setError("Failed to load invitation. The link may be invalid or expired.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (token) {
      fetchInvitation();
    }
  }, [token]);

  const isEmailMismatch = Boolean(
    currentUser &&
      invitation &&
      currentUser.email.toLowerCase().trim() !== invitation.email.toLowerCase().trim()
  );

  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      setError(null);

      const result = await apiClient.post<{ workspaceId: string }>(
        `/invitations/${token}/accept`
      );

      // Invalidate queries so dashboard and workspace listings reflect the new membership
      await queryClient.invalidateQueries({ queryKey: workspaceKeys.all });

      setAcceptSuccess(true);
      setTimeout(() => {
        router.push(`/workspaces/${result.workspaceId}`);
      }, 1000);
    } catch (err) {
      if (err instanceof AppError) {
        setError(err.message);
      } else {
        setError("Failed to accept invitation. Please try again.");
      }
      setIsAccepting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <Link href="/" className="flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground shadow">
              NB
            </div>
            <span className="text-lg font-semibold tracking-tight">{siteConfig.name}</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="container mx-auto flex max-w-lg flex-1 items-center justify-center p-6">
        {isLoading || isAuthLoading ? (
          <Card className="w-full space-y-4 p-8">
            <Skeleton className="h-8 w-3/4 rounded-md" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </Card>
        ) : error || !invitation ? (
          <Card className="w-full border-destructive/30 text-center">
            <CardHeader className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                <AlertCircle className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">Invitation Unavailable</CardTitle>
              <CardDescription>
                {error || "This invitation link is invalid or has already been used."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center pt-2">
              <Link href="/">
                <Button variant="outline">Back to Home</Button>
              </Link>
            </CardFooter>
          </Card>
        ) : invitation.isExpired || invitation.status !== "PENDING" ? (
          <Card className="w-full text-center">
            <CardHeader className="space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Clock className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl">
                {invitation.status === "ACCEPTED"
                  ? "Invitation Already Accepted"
                  : "Invitation Expired"}
              </CardTitle>
              <CardDescription>
                {invitation.status === "ACCEPTED"
                  ? "This workspace invitation has already been accepted."
                  : "This invitation link has expired. Please ask the workspace admin to send a new invitation."}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex justify-center pt-2">
              <Link href="/workspaces">
                <Button variant="outline">Go to Workspaces</Button>
              </Link>
            </CardFooter>
          </Card>
        ) : (
          <Card className="w-full shadow-lg">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Mail className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl font-bold">Join {invitation.workspaceName}</CardTitle>
              <CardDescription>
                <strong>{invitation.inviterName}</strong> has invited you to collaborate in{" "}
                <strong>{invitation.workspaceName}</strong>.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {acceptSuccess && (
                <div
                  role="status"
                  className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
                >
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>Invitation accepted! Redirecting to workspace...</span>
                </div>
              )}

              {isEmailMismatch && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-sm text-amber-800 dark:text-amber-300"
                >
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-1">
                    <p className="font-semibold">Account Mismatch</p>
                    <p className="text-xs leading-relaxed">
                      You are signed in as{" "}
                      <span className="font-mono font-medium">{currentUser?.email}</span>, but this
                      invitation was sent to{" "}
                      <span className="font-mono font-medium">{invitation.email}</span>. Please
                      switch accounts to accept.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Workspace:</span>
                  <span className="font-semibold text-foreground">{invitation.workspaceName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Assigned Role:</span>
                  <Badge variant="outline" className="uppercase text-[10px]">
                    {invitation.role}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Invited Email:</span>
                  <span className="font-mono text-foreground">{invitation.email}</span>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-3">
              {currentUser ? (
                isEmailMismatch ? (
                  <div className="w-full space-y-2">
                    <Link
                      href={`/login?from=/invitations/${token}`}
                      className="block w-full"
                    >
                      <Button variant="default" className="w-full gap-2" size="lg">
                        <LogIn className="h-4 w-4" />
                        <span>Sign In as {invitation.email}</span>
                      </Button>
                    </Link>
                    <Link
                      href={`/register?from=/invitations/${token}`}
                      className="block w-full"
                    >
                      <Button variant="outline" className="w-full gap-2">
                        <UserPlus className="h-4 w-4" />
                        <span>Create New Account</span>
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    onClick={handleAccept}
                    isLoading={isAccepting}
                    disabled={acceptSuccess}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Users className="h-4 w-4" />
                    <span>Accept Invitation & Join</span>
                  </Button>
                )
              ) : (
                <div className="w-full space-y-2.5">
                  <Link href={`/login?from=/invitations/${token}`} className="block w-full">
                    <Button variant="default" className="w-full gap-2" size="lg">
                      <LogIn className="h-4 w-4" />
                      <span>Sign in to Accept</span>
                    </Button>
                  </Link>
                  <Link href={`/register?from=/invitations/${token}`} className="block w-full">
                    <Button variant="outline" className="w-full gap-2">
                      <UserPlus className="h-4 w-4" />
                      <span>Create Account & Join</span>
                    </Button>
                  </Link>
                </div>
              )}

              <p className="text-center text-xs text-muted-foreground">
                Expires on {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </CardFooter>
          </Card>
        )}
      </main>
    </div>
  );
}
