"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateCard } from "../hooks/use-cards";

interface CreateCardInlineProps {
  workspaceId: string;
  boardId: string;
  columnId: string;
}

export function CreateCardInline({
  workspaceId,
  boardId,
  columnId,
}: CreateCardInlineProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const createCardMutation = useCreateCard(workspaceId, boardId);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim()) return;

    setError(null);
    try {
      await createCardMutation.mutateAsync({
        columnId,
        title: title.trim(),
      });

      setTitle("");
      // Keep open for rapid multi-card entry
      textareaRef.current?.focus();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create card.");
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setTitle("");
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center gap-1.5 rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:bg-card/70 hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>Add a card</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 rounded-lg bg-card/60 p-1.5">
      {error && (
        <div className="rounded border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <Textarea
        ref={textareaRef}
        placeholder="Enter a title for this card..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={createCardMutation.isPending}
        className="min-h-[64px] resize-none bg-background text-xs"
        rows={2}
      />

      <div className="flex items-center gap-1.5">
        <Button
          type="submit"
          size="sm"
          isLoading={createCardMutation.isPending}
          disabled={!title.trim()}
          className="h-7 px-2.5 text-xs"
        >
          Add Card
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsOpen(false);
            setTitle("");
          }}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          aria-label="Cancel adding card"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
}
