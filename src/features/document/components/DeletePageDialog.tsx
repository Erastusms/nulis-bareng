"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

interface DeletePageDialogProps {
  isOpen: boolean;
  pageTitle: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePageDialog({
  isOpen,
  pageTitle,
  isDeleting = false,
  onClose,
  onConfirm,
}: DeletePageDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Page"
      description="This action cannot be undone."
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          Are you sure you want to delete{" "}
          <span className="font-semibold">&quot;{pageTitle || "Untitled"}&quot;</span>?
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onConfirm}
            isLoading={isDeleting}
          >
            Delete Page
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
