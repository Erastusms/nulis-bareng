"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useCreateColumn } from "../hooks/use-columns";

interface CreateColumnModalProps {
  workspaceId: string;
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#64748b", // Slate
  "#ef4444", // Red
  "#f97316", // Orange
  "#eab308", // Yellow
  "#22c55e", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
];

export function CreateColumnModal({
  workspaceId,
  boardId,
  isOpen,
  onClose,
}: CreateColumnModalProps) {
  const [title, setTitle] = React.useState("");
  const [color, setColor] = React.useState<string>(PRESET_COLORS[0]);
  const [error, setError] = React.useState<string | null>(null);

  const createColumnMutation = useCreateColumn(workspaceId, boardId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Column title is required.");
      return;
    }

    setError(null);
    try {
      await createColumnMutation.mutateAsync({
        title: title.trim(),
        color,
      });

      setTitle("");
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create column. Please try again.");
      }
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Add New Column"
      description="Columns organize cards into distinct stages or categories."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor="col-title" className="text-xs font-semibold text-foreground">
            Column Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="col-title"
            placeholder="e.g., Backlog, In Progress, In Review, Done"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={createColumnMutation.isPending}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            Column Accent Color
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{ backgroundColor: c }}
                className={`h-6 w-6 rounded-full transition-transform hover:scale-110 ${
                  color === c ? "ring-2 ring-foreground ring-offset-2" : ""
                }`}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createColumnMutation.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={createColumnMutation.isPending}>
            Add Column
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
