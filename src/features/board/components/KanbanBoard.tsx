"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import {
  ChevronLeft,
  Edit2,
  Kanban,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoard, useDeleteBoard } from "../hooks/use-boards";
import { useMoveCard } from "../hooks/use-cards";
import { useReorderColumns } from "../hooks/use-columns";
import { CreateColumnModal } from "./CreateColumnModal";
import { EditBoardModal } from "./EditBoardModal";
import { KanbanColumn } from "./KanbanColumn";

interface KanbanBoardProps {
  workspaceId: string;
  boardId: string;
}

export function KanbanBoard({ workspaceId, boardId }: KanbanBoardProps) {
  const router = useRouter();
  const [isMounted, setIsMounted] = React.useState(false);
  const [isAddColumnOpen, setIsAddColumnOpen] = React.useState(false);
  const [isEditBoardOpen, setIsEditBoardOpen] = React.useState(false);
  const [isDeleteBoardOpen, setIsDeleteBoardOpen] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const { data: board, isLoading, error } = useBoard(workspaceId, boardId);
  const reorderColumnsMutation = useReorderColumns(workspaceId, boardId);
  const moveCardMutation = useMoveCard(workspaceId, boardId);
  const deleteBoardMutation = useDeleteBoard(workspaceId);

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    if (!destination) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    if (type === "column") {
      if (!board?.columns) return;
      const columnIds = board.columns.map((c) => c.id);
      const [removed] = columnIds.splice(source.index, 1);
      columnIds.splice(destination.index, 0, removed);

      reorderColumnsMutation.mutate({ columnIds });
      return;
    }

    if (type === "card") {
      moveCardMutation.mutate({
        cardId: draggableId,
        sourceColumnId: source.droppableId,
        targetColumnId: destination.droppableId,
        targetPosition: destination.index,
      });
    }
  };

  const handleDeleteBoard = async () => {
    try {
      await deleteBoardMutation.mutateAsync(boardId);
      setIsDeleteBoardOpen(false);
      router.push(`/workspaces/${workspaceId}/boards`);
    } catch (err) {
      console.error("Failed to delete board:", err);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
        <div className="flex gap-4 overflow-x-hidden">
          <Skeleton className="h-[600px] w-72 shrink-0 rounded-xl" />
          <Skeleton className="h-[600px] w-72 shrink-0 rounded-xl" />
          <Skeleton className="h-[600px] w-72 shrink-0 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-8 text-center text-sm text-destructive">
        <p className="font-semibold">Board not found or inaccessible.</p>
        <Link href={`/workspaces/${workspaceId}/boards`} className="mt-4 inline-block">
          <Button variant="outline" size="sm" className="mt-2 text-xs">
            Back to Boards
          </Button>
        </Link>
      </div>
    );
  }

  const columns = board.columns || [];

  return (
    <div className="flex h-[calc(100vh-180px)] flex-col space-y-4">
      {/* Board Header */}
      <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link
              href={`/workspaces/${workspaceId}/boards`}
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Boards</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {board.title}
            </h1>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditBoardOpen(true)}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                aria-label="Rename board"
              >
                <Edit2 className="h-3.5 w-3.5 mr-1" />
                <span>Rename</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleteBoardOpen(true)}
                className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10"
                aria-label="Delete board"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                <span>Delete</span>
              </Button>
            </div>
          </div>

          {board.description && (
            <p className="text-xs text-muted-foreground">{board.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsAddColumnOpen(true)}
            size="sm"
            className="inline-flex items-center gap-1.5 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Column</span>
          </Button>
        </div>
      </div>

      {/* Main Drag-and-Drop Columns Area */}
      {isMounted && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable
            droppableId="board-columns"
            direction="horizontal"
            type="column"
          >
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="flex flex-1 items-start gap-4 overflow-x-auto pb-4 pt-1"
              >
                {columns.map((column, colIndex) => (
                  <KanbanColumn
                    key={column.id}
                    workspaceId={workspaceId}
                    boardId={boardId}
                    column={column}
                    index={colIndex}
                    allColumns={columns}
                  />
                ))}
                {provided.placeholder}

                {/* Empty State / Add Column Card */}
                {columns.length === 0 ? (
                  <div className="flex h-64 w-80 flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/40 p-6 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Kanban className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-foreground">
                      This board has no columns yet
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Add a column (e.g. &quot;To Do&quot;, &quot;In Progress&quot;, &quot;Done&quot;) to start organizing cards.
                    </p>
                    <Button
                      onClick={() => setIsAddColumnOpen(true)}
                      size="sm"
                      className="mt-4 inline-flex items-center gap-1.5 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add First Column</span>
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddColumnOpen(true)}
                    className="flex h-20 w-72 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-dashed border-border/80 bg-card/20 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card/60 hover:text-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add another column</span>
                  </button>
                )}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Add Column Modal */}
      <CreateColumnModal
        workspaceId={workspaceId}
        boardId={boardId}
        isOpen={isAddColumnOpen}
        onClose={() => setIsAddColumnOpen(false)}
      />

      {/* Edit Board Modal */}
      <EditBoardModal
        workspaceId={workspaceId}
        board={board}
        isOpen={isEditBoardOpen}
        onClose={() => setIsEditBoardOpen(false)}
      />

      {/* Delete Board Dialog */}
      <Dialog
        isOpen={isDeleteBoardOpen}
        onClose={() => setIsDeleteBoardOpen(false)}
        title={`Delete "${board.title}"?`}
        description="Are you sure you want to delete this board? All columns and cards will be permanently removed."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteBoardOpen(false)}
            disabled={deleteBoardMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteBoard}
            isLoading={deleteBoardMutation.isPending}
          >
            Delete Board
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
