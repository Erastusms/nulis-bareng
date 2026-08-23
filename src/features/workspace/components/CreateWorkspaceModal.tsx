"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { AppError } from "@/lib/api/errors";
import { useCreateWorkspace } from "../hooks/use-workspaces";
import { createWorkspaceSchema } from "../schemas/workspace.schema";

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const createMutation = useCreateWorkspace();

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [isSlugManuallyEdited, setIsSlugManuallyEdited] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<{
    name?: string;
    slug?: string;
    description?: string;
  }>({});
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName("");
      setSlug("");
      setDescription("");
      setIsSlugManuallyEdited(false);
      setFieldErrors({});
      setErrorMessage(null);
    }
  }, [isOpen]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!isSlugManuallyEdited) {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generatedSlug);
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsSlugManuallyEdited(true);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setFieldErrors({});

    const parseResult = createWorkspaceSchema.safeParse({
      name,
      slug,
      description: description || undefined,
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
      const created = await createMutation.mutateAsync(parseResult.data);
      onClose();
      router.push(`/workspaces/${created.urlIdentifier || created.id}`);
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
        if (error.message.toLowerCase().includes("slug") || error.code === "CONFLICT") {
          setFieldErrors((prev) => ({ ...prev, slug: error.message }));
        }
      } else {
        setErrorMessage("Failed to create workspace. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Workspace"
      description="Workspaces are shared hubs for your team to organize boards, documents, and collaborate."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ws-name">
            Workspace Name
          </label>
          <Input
            id="ws-name"
            placeholder="e.g. Acme Engineering"
            value={name}
            onChange={handleNameChange}
            error={Boolean(fieldErrors.name)}
            disabled={createMutation.isPending}
            required
          />
          {fieldErrors.name && <p className="text-xs text-destructive">{fieldErrors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ws-slug">
            Workspace Slug (URL Identifier)
          </label>
          <div className="flex items-center">
            <span className="inline-flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-xs text-muted-foreground">
              /workspaces/
            </span>
            <Input
              id="ws-slug"
              placeholder="acme-engineering"
              value={slug}
              onChange={handleSlugChange}
              error={Boolean(fieldErrors.slug)}
              disabled={createMutation.isPending}
              className="rounded-l-none"
              required
            />
          </div>
          {fieldErrors.slug && <p className="text-xs text-destructive">{fieldErrors.slug}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="ws-description">
            Description <span className="text-xs text-muted-foreground">(Optional)</span>
          </label>
          <Input
            id="ws-description"
            placeholder="Brief description of this workspace"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            error={Boolean(fieldErrors.description)}
            disabled={createMutation.isPending}
          />
          {fieldErrors.description && (
            <p className="text-xs text-destructive">{fieldErrors.description}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={createMutation.isPending} className="gap-1.5">
            <FolderPlus className="h-4 w-4" />
            Create Workspace
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
