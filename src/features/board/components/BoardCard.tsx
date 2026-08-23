"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Edit2,
  Kanban,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { useDeleteBoard } from "../hooks/use-boards";
import { EditBoardModal } from "./EditBoardModal";
import type { Board } from "@/types/domain";

interface BoardCardProps {
  workspaceId: string;
  board: Board;
}

export function BoardCard({ workspaceId, board }: BoardCardProps) {
  const [isEditOpen, setIsEditOpen] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);
  const [showMenu, setShowMenu] = React.useState(false);
  const deleteMutation = useDeleteBoard(workspaceId);

  const formattedDate = new Date(board.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(board.id);
      setIsDeleteOpen(false);
    } catch (error) {
      console.error("Failed to delete board:", error);
    }
  };

  return (
    <>
      <Card className="group relative flex flex-col justify-between transition-all duration-200 hover:border-primary/50 hover:shadow-md">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Kanban className="h-5 w-5" />
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Board options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMenu(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 min-w-[140px] rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setIsEditOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      <span>Rename / Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setIsDeleteOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Delete Board</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div>
            <CardTitle className="text-base font-bold text-foreground">
              {board.title}
            </CardTitle>
            <CardDescription className="line-clamp-2 mt-1 text-xs text-muted-foreground">
              {board.description || "No description provided."}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="pb-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Created {formattedDate}</span>
          </div>
        </CardContent>

        <CardFooter className="pt-0">
          <Link
            href={`/workspaces/${workspaceId}/boards/${board.id}`}
            className="w-full"
          >
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-between gap-1 text-xs transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
            >
              <span>Open Board</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardFooter>
      </Card>

      {/* Edit Modal */}
      <EditBoardModal
        workspaceId={workspaceId}
        board={board}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title={`Delete "${board.title}"?`}
        description="Are you sure you want to delete this board? This will permanently delete all columns, cards, and data inside it. This action cannot be undone."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteOpen(false)}
            disabled={deleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            isLoading={deleteMutation.isPending}
          >
            Delete Board
          </Button>
        </div>
      </Dialog>
    </>
  );
}
