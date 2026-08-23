"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateBoard } from "../hooks/use-boards";
import type { Board } from "@/types/domain";

interface EditBoardModalProps {
  workspaceId: string;
  board: Board;
  isOpen: boolean;
  onClose: () => void;
}

export function EditBoardModal({
  workspaceId,
  board,
  isOpen,
  onClose,
}: EditBoardModalProps) {
  const [title, setTitle] = React.useState(board.title);
  const [description, setDescription] = React.useState(board.description || "");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setTitle(board.title);
    setDescription(board.description || "");
    setError(null);
  }, [board, isOpen]);

  const updateBoardMutation = useUpdateBoard(workspaceId, board.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Board title is required.");
      return;
    }

    setError(null);
    try {
      await updateBoardMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
      });

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to update board. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Board Settings"
      description="Update board title and description."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="edit-board-title" className="text-xs font-semibold text-foreground">
            Board Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="edit-board-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={updateBoardMutation.isPending}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="edit-board-description"
            className="text-xs font-semibold text-foreground"
          >
            Description <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="edit-board-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={updateBoardMutation.isPending}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={updateBoardMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={updateBoardMutation.isPending}>
            Save Changes
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
