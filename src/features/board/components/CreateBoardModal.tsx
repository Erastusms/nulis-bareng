"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBoard } from "../hooks/use-boards";

interface CreateBoardModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (boardId: string) => void;
}

export function CreateBoardModal({
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
}: CreateBoardModalProps) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const createBoardMutation = useCreateBoard(workspaceId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Board title is required.");
      return;
    }

    setError(null);
    try {
      const created = await createBoardMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
      });

      setTitle("");
      setDescription("");
      onClose();
      onSuccess?.(created.id);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create board. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Board"
      description="Boards help you organize tasks, workflows, and projects with columns and cards."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="board-title" className="text-xs font-semibold text-foreground">
            Board Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="board-title"
            placeholder="e.g., Sprint 42, Product Roadmap, Bug Tracking"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createBoardMutation.isPending}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="board-description"
            className="text-xs font-semibold text-foreground"
          >
            Description <span className="text-xs text-muted-foreground">(optional)</span>
          </label>
          <Textarea
            id="board-description"
            placeholder="Briefly describe what this board is used for..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={createBoardMutation.isPending}
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createBoardMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={createBoardMutation.isPending}>
            Create Board
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
