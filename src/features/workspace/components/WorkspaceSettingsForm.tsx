"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Save, ShieldAlert, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { AppError } from "@/lib/api/errors";
import { useDeleteWorkspace, useUpdateWorkspace, useWorkspace } from "../hooks/use-workspaces";
import { updateWorkspaceSchema } from "../schemas/workspace.schema";

interface WorkspaceSettingsFormProps {
  workspaceId: string;
}

export function WorkspaceSettingsForm({ workspaceId }: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const { data: workspace, isLoading } = useWorkspace(workspaceId);
  const updateMutation = useUpdateWorkspace(workspaceId);
  const deleteMutation = useDeleteWorkspace();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    slug?: string;
    description?: string;
  }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (workspace) {
      setName(workspace.name || "");
      setSlug(workspace.slug || "");
      setDescription(workspace.description || "");
    }
  }, [workspace]);

  if (isLoading) {
    return (
      <Card className="space-y-4 p-6">
        <Skeleton className="h-6 w-1/3 rounded-md" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <div className="space-y-3 pt-4">
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      </Card>
    );
  }

  if (!workspace) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-center text-sm text-destructive">
        Workspace not found or you do not have permission to view settings.
      </div>
    );
  }

  const role = (workspace.currentUserRole || workspace.role)?.toUpperCase();
  const isOwner = role === "OWNER";
  const canEdit = isOwner || role === "ADMIN";

  if (!canEdit) {
    return (
      <Card className="border-border">
        <CardHeader>
          <div className="flex items-center space-x-2 text-muted-foreground">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-base">Permission Restricted</CardTitle>
          </div>
          <CardDescription>
            You are a <strong>Member</strong> of this workspace. Only workspace Owners and Admins
            can edit workspace metadata and settings.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFieldErrors({});

    const parseResult = updateWorkspaceSchema.safeParse({
      name,
      slug,
      description: description || null,
    });

    if (!parseResult.success) {
      const formatted = parseResult.error.flatten().fieldErrors;
      setFieldErrors({
        name: formatted.name?.[0],
        slug: formatted.slug?.[0],
        description: formatted.description?.[0],
      });
      return;
    }

    try {
      await updateMutation.mutateAsync(parseResult.data);
      setSuccessMessage("Workspace settings updated successfully.");
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to update workspace settings.");
      }
    }
  };

  const handleDeleteWorkspace = async () => {
    try {
      await deleteMutation.mutateAsync(workspaceId);
      router.push("/workspaces");
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to delete workspace.");
      }
      setIsDeleteDialogOpen(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Workspace Settings
        </h2>
        <p className="text-sm text-muted-foreground">
          Update workspace general information, URL identifier, and administrative settings
        </p>
      </div>

      <Card>
        <form onSubmit={handleUpdate}>
          <CardHeader>
            <CardTitle className="text-base">General Information</CardTitle>
            <CardDescription>
              Basic identity information displayed to members of this workspace.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {successMessage && (
              <div
                role="status"
                className="flex items-center gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="edit-ws-name">
                Workspace Name
              </label>
              <Input
                id="edit-ws-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                error={Boolean(fieldErrors.name)}
                disabled={updateMutation.isPending}
                required
              />
              {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="edit-ws-slug">
                Workspace Slug
              </label>
              <div className="flex items-center">
                <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
                  /workspaces/
                </span>
                <Input
                  id="edit-ws-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                  error={Boolean(fieldErrors.slug)}
                  disabled={updateMutation.isPending}
                  className="rounded-l-none"
                  required
                />
              </div>
              {fieldErrors.slug && <p className="text-xs text-destructive">{fieldErrors.slug}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="edit-ws-desc">
                Description
              </label>
              <Input
                id="edit-ws-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                error={Boolean(fieldErrors.description)}
                disabled={updateMutation.isPending}
                placeholder="No description provided."
              />
              {fieldErrors.description && (
                <p className="text-xs text-destructive">{fieldErrors.description}</p>
              )}
            </div>
          </CardContent>

          <CardFooter className="flex justify-end border-t border-border/50 py-4">
            <Button type="submit" isLoading={updateMutation.isPending} className="gap-1.5">
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>

      {isOwner && (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Permanently delete this workspace and all associated boards, documents, and membership records.
            </CardDescription>
          </CardHeader>
          <CardFooter className="border-t border-destructive/20 py-4">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              Delete Workspace
            </Button>
          </CardFooter>
        </Card>
      )}

      {isOwner && (
        <Dialog
          isOpen={isDeleteDialogOpen}
          onClose={() => setIsDeleteDialogOpen(false)}
          title="Delete Workspace"
          description="Are you absolutely sure? This action cannot be undone."
        >
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Deleting <strong>{workspace.name}</strong> will remove all data, boards, and access
              for all members permanently.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setIsDeleteDialogOpen(false)}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteWorkspace}
                isLoading={deleteMutation.isPending}
              >
                Delete Workspace
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
