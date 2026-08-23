"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { BoardList } from "@/features/board/components/BoardList";

export default function WorkspaceBoardsPage() {
  const params = useParams();
  const workspaceId = params.id as string;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-foreground">
          Kanban Boards
        </h2>
        <p className="text-xs text-muted-foreground">
          Manage, create, and organize your workspace task boards.
        </p>
      </div>

      <BoardList workspaceId={workspaceId} />
    </div>
  );
}
