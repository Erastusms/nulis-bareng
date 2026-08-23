"use client";

import * as React from "react";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardDetailsModal } from "./CardDetailsModal";
import type { BoardColumn, Card } from "@/types/domain";

interface KanbanCardProps {
  workspaceId: string;
  boardId: string;
  card: Card;
  index: number;
  columns: BoardColumn[];
}

export function KanbanCard({
  workspaceId,
  boardId,
  card,
  index,
  columns,
}: KanbanCardProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const isDueDatePassed = React.useMemo(() => {
    if (!card.dueDate) return false;
    const due = new Date(card.dueDate);
    const now = new Date();
    return due < now;
  }, [card.dueDate]);

  const formattedDueDate = React.useMemo(() => {
    if (!card.dueDate) return null;
    return new Date(card.dueDate).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }, [card.dueDate]);

  return (
    <>
      <Draggable draggableId={card.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setIsModalOpen(true)}
            className={`group relative mb-2 cursor-pointer rounded-lg border border-border bg-card p-3 shadow-sm transition-all duration-150 hover:border-primary/50 hover:shadow-md ${
              snapshot.isDragging
                ? "rotate-1 scale-105 border-primary shadow-xl ring-2 ring-primary/20"
                : ""
            }`}
          >
            {/* Labels */}
            {card.labels && card.labels.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1">
                {card.labels.map((label) => (
                  <Badge
                    key={label}
                    variant="outline"
                    className="bg-primary/10 px-2 py-0 text-[10px] font-medium text-primary"
                  >
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {/* Card Title */}
            <p className="text-xs font-semibold leading-snug text-foreground group-hover:text-primary">
              {card.title}
            </p>

            {/* Card Footer Metadata (Icons, Due Date, Assignees) */}
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                {card.description && (
                  <div
                    title="This card has a description."
                    className="flex items-center text-muted-foreground hover:text-foreground"
                  >
                    <AlignLeft className="h-3 w-3" />
                  </div>
                )}

                {formattedDueDate && (
                  <div
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-medium ${
                      isDueDatePassed
                        ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Calendar className="h-2.5 w-2.5" />
                    <span>{formattedDueDate}</span>
                  </div>
                )}
              </div>

              {/* Assignee Avatars */}
              {card.assignees && card.assignees.length > 0 && (
                <div className="flex -space-x-1.5 overflow-hidden">
                  {card.assignees.map((assignee) => (
                    <div
                      key={assignee.id}
                      title={assignee.name || assignee.email}
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-card bg-primary text-[9px] font-bold text-primary-foreground"
                    >
                      {(assignee.name || assignee.email).slice(0, 1).toUpperCase()}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Draggable>

      {/* Details Modal */}
      {isModalOpen && (
        <CardDetailsModal
          workspaceId={workspaceId}
          boardId={boardId}
          card={card}
          columns={columns}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
