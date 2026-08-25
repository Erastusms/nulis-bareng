import { ValidationError } from "@/lib/api/errors";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import type {
  BoardColumnRecord,
  IBoardColumnRepository,
} from "@/server/db/repository";
import { boardAuth, BoardAuthorizationService } from "./board-authorization";
import type { BoardColumn } from "@/types/domain";

export interface CreateColumnDTO {
  title: string;
  color?: string | null;
  position?: number;
}

export interface UpdateColumnDTO {
  title?: string;
  color?: string | null;
  position?: number;
}

export interface MoveColumnDTO {
  columnId: string;
  targetPosition: number;
}

function toDomainColumn(record: BoardColumnRecord): BoardColumn {
  return {
    id: record.id,
    boardId: record.boardId,
    title: record.title,
    position: record.position,
    color: record.color,
    cards: record.cards?.map((c) => ({
      id: c.id,
      columnId: c.columnId,
      boardId: c.boardId,
      title: c.title,
      description: c.description,
      position: c.position,
      dueDate: c.dueDate ? c.dueDate.toISOString() : null,
      labels: c.labels,
      assigneeIds: c.assigneeIds,
      assignees: c.assignees,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class BoardColumnService {
  constructor(
    private readonly columnRepo: IBoardColumnRepository = boardColumnRepository,
    private readonly authService: BoardAuthorizationService = boardAuth
  ) {}

  /**
   * Creates a new column in a board.
   */
  async createColumn(
    workspaceId: string,
    boardId: string,
    userId: string,
    dto: CreateColumnDTO
  ): Promise<BoardColumn> {
    await this.authService.requireBoardInWorkspace(boardId, workspaceId, userId);

    const created = await this.columnRepo.create({
      boardId,
      title: dto.title.trim(),
      color: dto.color?.trim() ?? null,
      position: dto.position,
    });

    return toDomainColumn(created);
  }

  /**
   * Updates an existing column.
   */
  async updateColumn(
    workspaceId: string,
    boardId: string,
    columnId: string,
    userId: string,
    dto: UpdateColumnDTO
  ): Promise<BoardColumn> {
    await this.authService.requireColumnInBoard(columnId, boardId, workspaceId, userId);

    const updated = await this.columnRepo.update(columnId, {
      title: dto.title?.trim(),
      color: dto.color !== undefined ? dto.color?.trim() ?? null : undefined,
      position: dto.position,
    });

    return toDomainColumn(updated);
  }

  /**
   * Deletes a column and its cards.
   */
  async deleteColumn(
    workspaceId: string,
    boardId: string,
    columnId: string,
    userId: string
  ): Promise<boolean> {
    await this.authService.requireColumnInBoard(columnId, boardId, workspaceId, userId);
    return this.columnRepo.delete(columnId);
  }

  /**
   * Moves a single column to a new target index within its board.
   */
  async moveColumn(
    workspaceId: string,
    boardId: string,
    userId: string,
    dto: MoveColumnDTO
  ): Promise<BoardColumn> {
    await this.authService.requireColumnInBoard(dto.columnId, boardId, workspaceId, userId);

    if (dto.targetPosition < 0) {
      throw new ValidationError("Target position must be non-negative.");
    }

    const moved = await this.columnRepo.moveColumn({
      columnId: dto.columnId,
      boardId,
      targetPosition: dto.targetPosition,
    });

    return toDomainColumn(moved);
  }

  /**
   * Atomically reorders columns in a board.
   */
  async reorderColumns(
    workspaceId: string,
    boardId: string,
    userId: string,
    columnIds: string[]
  ): Promise<BoardColumn[]> {
    await this.authService.requireBoardInWorkspace(boardId, workspaceId, userId);

    if (!columnIds || columnIds.length === 0) {
      throw new ValidationError("At least one column ID is required.");
    }

    const existingColumns = await this.columnRepo.findByBoardId(boardId);
    const existingIds = new Set(existingColumns.map((c) => c.id));

    // Validate that all columnIds belong to this board
    for (const id of columnIds) {
      if (!existingIds.has(id)) {
        throw new ValidationError(`Column '${id}' does not belong to board '${boardId}'.`);
      }
    }

    const reordered = await this.columnRepo.reorderColumns(boardId, columnIds);
    return reordered.map(toDomainColumn);
  }
}

export const boardColumnService = new BoardColumnService();
