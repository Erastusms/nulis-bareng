"use client";

import * as React from "react";
import { Kanban, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoards } from "../hooks/use-boards";
import { BoardCard } from "./BoardCard";
import { CreateBoardModal } from "./CreateBoardModal";

interface BoardListProps {
  workspaceId: string;
}

export function BoardList({ workspaceId }: BoardListProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const { data: boards, isLoading, error } = useBoards(workspaceId);

  const filteredBoards = React.useMemo(() => {
    if (!boards) return [];
    if (!searchQuery.trim()) return boards;
    const query = searchQuery.toLowerCase().trim();
    return boards.filter(
      (b) =>
        b.title.toLowerCase().includes(query) ||
        (b.description && b.description.toLowerCase().includes(query))
    );
  }, [boards, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Action and Search Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search boards..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-1.5 self-start text-xs sm:self-auto sm:text-sm"
        >
          <Plus className="h-4 w-4" />
          <span>New Board</span>
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center text-sm text-destructive">
          Failed to load boards. Please try refreshing the page.
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && boards && boards.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Kanban className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-lg font-bold text-foreground">No boards yet</h3>
          <p className="mt-1.5 max-w-sm text-xs text-muted-foreground">
            Create your first Kanban board to start organizing tasks, columns, and workflows.
          </p>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="mt-6 inline-flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Create First Board</span>
          </Button>
        </div>
      )}

      {/* Search No Results */}
      {!isLoading && !error && boards && boards.length > 0 && filteredBoards.length === 0 && (
        <div className="rounded-xl border border-border bg-card/50 p-8 text-center text-xs text-muted-foreground">
          No boards match &quot;{searchQuery}&quot;. Try a different search term.
        </div>
      )}

      {/* Boards Grid */}
      {!isLoading && !error && filteredBoards.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBoards.map((board) => (
            <BoardCard
              key={board.id}
              workspaceId={workspaceId}
              board={board}
            />
          ))}
        </div>
      )}

      {/* Create Board Modal */}
      <CreateBoardModal
        workspaceId={workspaceId}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />
    </div>
  );
}
