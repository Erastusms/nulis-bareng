import { ValidationError } from "@/lib/api/errors";
import { createEventId, createVersion } from "@/lib/realtime/events";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import type {
  BoardColumnRecord,
  IBoardColumnRepository,
} from "@/server/db/repository";
import { eventPublisher, IEventPublisher } from "@/server/websocket/event-publisher";
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
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    cards: record.cards
      ? record.cards.map((card) => ({
          id: card.id,
          columnId: card.columnId,
          boardId: card.boardId,
          title: card.title,
          description: card.description,
          position: card.position,
          dueDate: card.dueDate ? card.dueDate.toISOString() : null,
          labels: card.labels,
          assigneeIds: card.assigneeIds,
          assignees: card.assignees,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        }))
      : [],
  };
}

export class BoardColumnService {
  constructor(
    private readonly columnRepo: IBoardColumnRepository = boardColumnRepository,
    private readonly authService: BoardAuthorizationService = boardAuth,
    private readonly publisher: IEventPublisher = eventPublisher
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
    const authResult = await this.authService.requireBoardInWorkspace(boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

    const created = await this.columnRepo.create({
      boardId,
      title: dto.title.trim(),
      color: dto.color?.trim() ?? null,
      position: dto.position,
    });

    const domainColumn = toDomainColumn(created);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "column.created",
      workspaceId: canonicalWorkspaceId,
      boardId,
      columnId: domainColumn.id,
      column: {
        id: domainColumn.id,
        boardId: domainColumn.boardId,
        title: domainColumn.title,
        position: domainColumn.position,
        color: domainColumn.color,
        createdAt: domainColumn.createdAt,
        updatedAt: domainColumn.updatedAt,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainColumn;
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
    const authResult = await this.authService.requireColumnInBoard(columnId, boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

    const updated = await this.columnRepo.update(columnId, {
      title: dto.title?.trim(),
      color: dto.color !== undefined ? dto.color?.trim() ?? null : undefined,
      position: dto.position,
    });

    const domainColumn = toDomainColumn(updated);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "column.updated",
      workspaceId: canonicalWorkspaceId,
      boardId,
      columnId: domainColumn.id,
      changes: {
        title: dto.title?.trim(),
        color: dto.color !== undefined ? dto.color?.trim() ?? null : undefined,
        position: dto.position,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainColumn;
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
    const authResult = await this.authService.requireColumnInBoard(columnId, boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;
    const deleted = await this.columnRepo.delete(columnId);

    if (deleted) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "column.deleted",
        workspaceId: canonicalWorkspaceId,
        boardId,
        columnId,
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });
    }

    return deleted;
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
    const authResult = await this.authService.requireColumnInBoard(dto.columnId, boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

    if (dto.targetPosition < 0) {
      throw new ValidationError("Target position must be non-negative.");
    }

    const moved = await this.columnRepo.moveColumn({
      columnId: dto.columnId,
      boardId,
      targetPosition: dto.targetPosition,
    });

    const domainColumn = toDomainColumn(moved);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "column.updated",
      workspaceId: canonicalWorkspaceId,
      boardId,
      columnId: domainColumn.id,
      changes: {
        position: domainColumn.position,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainColumn;
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
    const authResult = await this.authService.requireBoardInWorkspace(boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

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
    const domainColumns = reordered.map(toDomainColumn);

    for (const col of domainColumns) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "column.updated",
        workspaceId: canonicalWorkspaceId,
        boardId,
        columnId: col.id,
        changes: {
          position: col.position,
        },
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });
    }

    return domainColumns;
  }
}

export const boardColumnService = new BoardColumnService();
