"use client";

import * as React from "react";
import { Draggable, Droppable } from "@hello-pangea/dnd";
import {
  Edit2,
  GripVertical,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDeleteColumn, useUpdateColumn } from "../hooks/use-columns";
import { CreateCardInline } from "./CreateCardInline";
import { KanbanCard } from "./KanbanCard";
import type { BoardColumn } from "@/types/domain";

interface KanbanColumnProps {
  workspaceId: string;
  boardId: string;
  column: BoardColumn;
  index: number;
  allColumns: BoardColumn[];
}

export function KanbanColumn({
  workspaceId,
  boardId,
  column,
  index,
  allColumns,
}: KanbanColumnProps) {
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [title, setTitle] = React.useState(column.title);
  const [showMenu, setShowMenu] = React.useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = React.useState(false);

  const updateColumnMutation = useUpdateColumn(workspaceId, boardId);
  const deleteColumnMutation = useDeleteColumn(workspaceId, boardId);

  React.useEffect(() => {
    setTitle(column.title);
  }, [column.title]);

  const handleTitleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!title.trim() || title === column.title) {
      setTitle(column.title);
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateColumnMutation.mutateAsync({
        columnId: column.id,
        data: { title: title.trim() },
      });
      setIsEditingTitle(false);
    } catch {
      setTitle(column.title);
      setIsEditingTitle(false);
    }
  };

  const handleDeleteColumn = async () => {
    try {
      await deleteColumnMutation.mutateAsync(column.id);
      setIsDeleteOpen(false);
    } catch (err) {
      console.error("Failed to delete column:", err);
    }
  };

  const cards = column.cards || [];

  return (
    <>
      <Draggable draggableId={column.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            className={`flex h-full max-h-full w-72 min-w-[288px] flex-col rounded-xl border bg-muted/40 p-3 transition-colors ${
              snapshot.isDragging
                ? "border-primary/60 bg-muted/70 shadow-2xl ring-2 ring-primary/20"
                : "border-border/80"
            }`}
          >
            {/* Column Header */}
            <div className="mb-3 flex items-center justify-between gap-1.5">
              <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
                <div
                  {...provided.dragHandleProps}
                  className="cursor-grab text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing"
                  title="Drag to reorder column"
                >
                  <GripVertical className="h-4 w-4" />
                </div>

                {column.color && (
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: column.color }}
                  />
                )}

                {isEditingTitle ? (
                  <form onSubmit={handleTitleSubmit} className="flex-1">
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => handleTitleSubmit()}
                      autoFocus
                      className="h-7 text-xs font-semibold"
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingTitle(true)}
                    className="truncate text-left text-xs font-bold text-foreground hover:underline"
                    title="Click to rename"
                  >
                    {column.title}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1">
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-card px-1.5 text-[11px] font-semibold text-muted-foreground">
                  {cards.length}
                </span>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowMenu(!showMenu)}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
                    aria-label="Column options"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>

                  {showMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setShowMenu(false)}
                      />
                      <div className="absolute right-0 top-full z-50 mt-1 min-w-[130px] rounded-lg border border-border bg-card p-1 shadow-lg animate-in fade-in zoom-in-95">
                        <button
                          type="button"
                          onClick={() => {
                            setShowMenu(false);
                            setIsEditingTitle(true);
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Rename</span>
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
                          <span>Delete Column</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Droppable Card Container */}
            <Droppable droppableId={column.id} type="card">
              {(dropProvided, dropSnapshot) => (
                <div
                  ref={dropProvided.innerRef}
                  {...dropProvided.droppableProps}
                  className={`flex-1 overflow-y-auto rounded-lg p-1 transition-colors min-h-[50px] ${
                    dropSnapshot.isDraggingOver ? "bg-primary/5 ring-1 ring-primary/20" : ""
                  }`}
                >
                  {cards.map((card, cardIndex) => (
                    <KanbanCard
                      key={card.id}
                      workspaceId={workspaceId}
                      boardId={boardId}
                      card={card}
                      index={cardIndex}
                      columns={allColumns}
                    />
                  ))}
                  {dropProvided.placeholder}

                  {cards.length === 0 && !dropSnapshot.isDraggingOver && (
                    <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/60 text-center text-xs text-muted-foreground">
                      No cards yet
                    </div>
                  )}
                </div>
              )}
            </Droppable>

            {/* Create Card Trigger */}
            <div className="mt-2 pt-1">
              <CreateCardInline
                workspaceId={workspaceId}
                boardId={boardId}
                columnId={column.id}
              />
            </div>
          </div>
        )}
      </Draggable>

      {/* Delete Column Dialog */}
      <Dialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        title={`Delete "${column.title}" Column?`}
        description="Are you sure you want to delete this column? All cards in this column will be permanently deleted."
      >
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDeleteOpen(false)}
            disabled={deleteColumnMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDeleteColumn}
            isLoading={deleteColumnMutation.isPending}
          >
            Delete Column
          </Button>
        </div>
      </Dialog>
    </>
  );
}
