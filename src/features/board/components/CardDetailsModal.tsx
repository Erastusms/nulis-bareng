"use client";

import * as React from "react";
import {
  Calendar,
  Check,
  Plus,
  Tag,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceMembers } from "@/features/workspace/hooks/use-workspace-members";
import { useDeleteCard, useUpdateCard } from "../hooks/use-cards";
import type { BoardColumn, Card } from "@/types/domain";

interface CardDetailsModalProps {
  workspaceId: string;
  boardId: string;
  card: Card;
  columns: BoardColumn[];
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_LABELS = [
  { name: "Bug", color: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30" },
  { name: "Feature", color: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30" },
  { name: "Urgent", color: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30" },
  { name: "Design", color: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30" },
  { name: "Documentation", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30" },
];

export function CardDetailsModal({
  workspaceId,
  boardId,
  card,
  columns,
  isOpen,
  onClose,
}: CardDetailsModalProps) {
  const [title, setTitle] = React.useState(card.title);
  const [description, setDescription] = React.useState(card.description || "");
  const [columnId, setColumnId] = React.useState(card.columnId);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>(card.assigneeIds || []);
  const [dueDate, setDueDate] = React.useState<string>(
    card.dueDate ? card.dueDate.slice(0, 10) : ""
  );
  const [labels, setLabels] = React.useState<string[]>(card.labels || []);
  const [customLabelInput, setCustomLabelInput] = React.useState("");
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const { data: members } = useWorkspaceMembers(workspaceId);
  const updateCardMutation = useUpdateCard(workspaceId, boardId);
  const deleteCardMutation = useDeleteCard(workspaceId, boardId);

  React.useEffect(() => {
    setTitle(card.title);
    setDescription(card.description || "");
    setColumnId(card.columnId);
    setAssigneeIds(card.assigneeIds || []);
    setDueDate(card.dueDate ? card.dueDate.slice(0, 10) : "");
    setLabels(card.labels || []);
    setError(null);
  }, [card, isOpen]);

  const handleToggleAssignee = (userId: string) => {
    setAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleToggleLabel = (labelName: string) => {
    setLabels((prev) =>
      prev.includes(labelName)
        ? prev.filter((l) => l !== labelName)
        : [...prev, labelName]
    );
  };

  const handleAddCustomLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = customLabelInput.trim();
    if (!trimmed) return;
    if (!labels.includes(trimmed)) {
      setLabels((prev) => [...prev, trimmed]);
    }
    setCustomLabelInput("");
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Card title is required.");
      return;
    }

    setError(null);
    try {
      await updateCardMutation.mutateAsync({
        cardId: card.id,
        data: {
          title: title.trim(),
          description: description.trim() || null,
          columnId: columnId !== card.columnId ? columnId : undefined,
          assigneeIds,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          labels,
        },
      });

      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to save changes.");
      }
    }
  };

  const handleDeleteCard = async () => {
    try {
      await deleteCardMutation.mutateAsync(card.id);
      setIsDeleteConfirmOpen(false);
      onClose();
    } catch (err: unknown) {
      console.error("Failed to delete card:", err);
    }
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title="Card Details"
        className="max-w-2xl"
      >
        <div className="space-y-5">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="card-title" className="text-xs font-semibold text-foreground">
              Title <span className="text-destructive">*</span>
            </label>
            <Input
              id="card-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-sm font-semibold"
              disabled={updateCardMutation.isPending}
            />
          </div>

          {/* Column Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">Column / Status</label>
            <select
              value={columnId}
              onChange={(e) => setColumnId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              disabled={updateCardMutation.isPending}
            >
              {columns.map((col) => (
                <option key={col.id} value={col.id} className="bg-card text-foreground">
                  {col.title}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="card-desc" className="text-xs font-semibold text-foreground">
              Description
            </label>
            <Textarea
              id="card-desc"
              placeholder="Add more detailed notes, specifications, or links..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={updateCardMutation.isPending}
              rows={4}
            />
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              <span>Assignees</span>
            </div>

            {members && members.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const isAssigned = assigneeIds.includes(m.userId);
                  const name = m.user?.name || m.user?.email || "Member";
                  return (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => handleToggleAssignee(m.userId)}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                        isAssigned
                          ? "border-primary bg-primary text-primary-foreground font-medium"
                          : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      {isAssigned && <Check className="h-3 w-3" />}
                      <span>{name}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No workspace members found.</p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Due Date</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-48 text-xs"
                disabled={updateCardMutation.isPending}
              />
              {dueDate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDueDate("")}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  Clear Date
                </Button>
              )}
            </div>
          </div>

          {/* Labels */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Tag className="h-3.5 w-3.5" />
              <span>Labels</span>
            </div>

            {/* Active Labels */}
            {labels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1">
                {labels.map((l) => (
                  <Badge
                    key={l}
                    variant="outline"
                    className="inline-flex items-center gap-1 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                  >
                    <span>{l}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleLabel(l)}
                      className="hover:text-destructive"
                      aria-label={`Remove label ${l}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Presets and Custom Label Input */}
            <div className="flex flex-wrap items-center gap-1.5">
              {PRESET_LABELS.map((preset) => {
                const isActive = labels.includes(preset.name);
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleToggleLabel(preset.name)}
                    className={`rounded-md border px-2 py-0.5 text-xs transition-colors ${
                      isActive ? preset.color + " font-semibold ring-1" : "border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAddCustomLabel} className="flex gap-2 pt-1">
              <Input
                placeholder="Add custom label..."
                value={customLabelInput}
                onChange={(e) => setCustomLabelInput(e.target.value)}
                className="h-8 text-xs"
              />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                disabled={!customLabelInput.trim()}
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </form>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between border-t border-border/60 pt-4">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="text-xs"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              <span>Delete Card</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateCardMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                isLoading={updateCardMutation.isPending}
              >
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title={`Delete "${card.title}"?`}
        description="Are you sure you want to delete this card? This action cannot be undone."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteConfirmOpen(false)}
            disabled={deleteCardMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteCard}
            isLoading={deleteCardMutation.isPending}
          >
            Delete Card
          </Button>
        </div>
      </Dialog>
    </>
  );
}
