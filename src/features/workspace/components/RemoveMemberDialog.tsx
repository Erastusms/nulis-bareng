"use client";

import * as React from "react";
import { AlertCircle, AlertTriangle, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { AppError } from "@/lib/api/errors";
import { useRemoveMember } from "../hooks/use-workspace-members";
import type { WorkspaceMember } from "@/types/domain";

interface RemoveMemberDialogProps {
  workspaceId: string;
  member: WorkspaceMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export function RemoveMemberDialog({
  workspaceId,
  member,
  isOpen,
  onClose,
}: RemoveMemberDialogProps) {
  const removeMutation = useRemoveMember(workspaceId);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!member) return null;

  const handleConfirm = async () => {
    setErrorMessage(null);
    try {
      await removeMutation.mutateAsync(member.userId);
      onClose();
    } catch (error) {
      if (error instanceof AppError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("Failed to remove member. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Workspace Member"
      description="Are you sure you want to remove this member from the workspace?"
    >
      <div className="space-y-4">
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3.5 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 font-medium text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Revoking Access</span>
          </div>
          <p className="mt-1">
            <strong>{member.user?.name || member.user?.email || member.userId}</strong> will immediately
            lose access to all boards, documents, and real-time activities in this workspace.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={removeMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            isLoading={removeMutation.isPending}
            className="gap-1.5"
          >
            <UserMinus className="h-4 w-4" />
            Confirm Removal
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
