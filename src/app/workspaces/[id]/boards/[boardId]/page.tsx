"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { KanbanBoard } from "@/features/board/components/KanbanBoard";

export default function BoardDetailPage() {
  const params = useParams();
  const workspaceId = params.id as string;
  const boardId = params.boardId as string;

  return <KanbanBoard workspaceId={workspaceId} boardId={boardId} />;
}
