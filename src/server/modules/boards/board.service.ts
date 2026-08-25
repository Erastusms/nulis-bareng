import { NotFoundError } from "@/lib/api/errors";
import { createEventId, createVersion } from "@/lib/realtime/events";
import { boardRepository } from "@/server/db/repositories/board.repository";
import type { BoardRecord, IBoardRepository } from "@/server/db/repository";
import { eventPublisher, IEventPublisher } from "@/server/websocket/event-publisher";
import { boardAuth, BoardAuthorizationService } from "./board-authorization";
import type { Board } from "@/types/domain";

export interface CreateBoardDTO {
  title: string;
  description?: string | null;
}

export interface UpdateBoardDTO {
  title?: string;
  description?: string | null;
  position?: number;
}

function toDomainBoard(record: BoardRecord): Board {
  return {
    id: record.id,
    workspaceId: record.workspaceId,
    title: record.title,
    description: record.description,
    position: record.position,
    columns: record.columns?.map((col) => ({
      id: col.id,
      boardId: col.boardId,
      title: col.title,
      position: col.position,
      color: col.color,
      cards: col.cards?.map((c) => ({
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
      createdAt: col.createdAt.toISOString(),
      updatedAt: col.updatedAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class BoardService {
  constructor(
    private readonly boardRepo: IBoardRepository = boardRepository,
    private readonly authService: BoardAuthorizationService = boardAuth,
    private readonly publisher: IEventPublisher = eventPublisher
  ) {}

  /**
   * Retrieves all boards in the workspace for an authorized user (by workspace ID or urlIdentifier).
   */
  async getBoards(workspaceIdOrIdentifier: string, userId: string): Promise<Board[]> {
    const { workspace } = await this.authService.requireWorkspaceAccess(
      userId,
      workspaceIdOrIdentifier
    );
    const records = await this.boardRepo.findByWorkspaceId(workspace.id);
    return records.map(toDomainBoard);
  }

  /**
   * Retrieves a single board by ID with its columns and cards.
   */
  async getBoardById(
    workspaceIdOrIdentifier: string,
    boardId: string,
    userId: string
  ): Promise<Board> {
    await this.authService.requireBoardInWorkspace(
      boardId,
      workspaceIdOrIdentifier,
      userId
    );
    const detailed = await this.boardRepo.findWithDetails(boardId);

    if (!detailed) {
      throw new NotFoundError("Board", boardId);
    }

    return toDomainBoard(detailed);
  }

  /**
   * Creates a new board in the workspace.
   */
  async createBoard(
    workspaceIdOrIdentifier: string,
    userId: string,
    dto: CreateBoardDTO
  ): Promise<Board> {
    const { workspace } = await this.authService.requireWorkspaceAccess(
      userId,
      workspaceIdOrIdentifier
    );

    const created = await this.boardRepo.create({
      workspaceId: workspace.id,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
    });

    return toDomainBoard(created);
  }

  /**
   * Updates an existing board's metadata.
   */
  async updateBoard(
    workspaceIdOrIdentifier: string,
    boardId: string,
    userId: string,
    dto: UpdateBoardDTO
  ): Promise<Board> {
    const { workspace } = await this.authService.requireBoardInWorkspace(
      boardId,
      workspaceIdOrIdentifier,
      userId
    );

    const updated = await this.boardRepo.update(boardId, {
      title: dto.title?.trim(),
      description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
      position: dto.position,
    });

    const domainBoard = toDomainBoard(updated);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "board.updated",
      workspaceId: workspace.id,
      boardId: domainBoard.id,
      changes: {
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
        position: dto.position,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainBoard;
  }

  /**
   * Deletes a board from the workspace.
   */
  async deleteBoard(
    workspaceIdOrIdentifier: string,
    boardId: string,
    userId: string
  ): Promise<boolean> {
    await this.authService.requireBoardInWorkspace(
      boardId,
      workspaceIdOrIdentifier,
      userId
    );
    return this.boardRepo.delete(boardId);
  }
}

export const boardService = new BoardService();
