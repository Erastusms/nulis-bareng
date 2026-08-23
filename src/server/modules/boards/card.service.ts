import { ValidationError } from "@/lib/api/errors";
import { cardRepository } from "@/server/db/repositories/card.repository";
import type {
  CardRecord,
  ICardRepository,
} from "@/server/db/repository";
import { boardAuth, BoardAuthorizationService } from "./board-authorization";
import type { Card } from "@/types/domain";

export interface CreateCardDTO {
  columnId: string;
  title: string;
  description?: string | null;
  position?: number;
  dueDate?: string | null;
  assigneeIds?: string[];
  labels?: string[];
}

export interface UpdateCardDTO {
  title?: string;
  description?: string | null;
  columnId?: string;
  position?: number;
  dueDate?: string | null;
  assigneeIds?: string[];
  labels?: string[];
}

export interface MoveCardDTO {
  cardId: string;
  sourceColumnId: string;
  targetColumnId: string;
  targetPosition: number;
}

function toDomainCard(record: CardRecord): Card {
  return {
    id: record.id,
    columnId: record.columnId,
    boardId: record.boardId,
    title: record.title,
    description: record.description,
    position: record.position,
    dueDate: record.dueDate ? record.dueDate.toISOString() : null,
    labels: record.labels,
    assigneeIds: record.assigneeIds,
    assignees: record.assignees,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export class CardService {
  constructor(
    private readonly cardRepo: ICardRepository = cardRepository,
    private readonly authService: BoardAuthorizationService = boardAuth
  ) {}

  /**
   * Retrieves a single card with relations by ID.
   */
  async getCardById(
    workspaceId: string,
    boardId: string,
    cardId: string,
    userId: string
  ): Promise<Card> {
    const { card } = await this.authService.requireCardInBoard(
      cardId,
      boardId,
      workspaceId,
      userId
    );
    return toDomainCard(card);
  }

  /**
   * Creates a card inside a column.
   */
  async createCard(
    workspaceId: string,
    boardId: string,
    userId: string,
    dto: CreateCardDTO
  ): Promise<Card> {
    await this.authService.requireColumnInBoard(
      dto.columnId,
      boardId,
      workspaceId,
      userId
    );

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      await this.authService.validateAssigneesInWorkspace(dto.assigneeIds, workspaceId);
    }

    let parsedDueDate: Date | null | undefined = undefined;
    if (dto.dueDate !== undefined) {
      if (dto.dueDate === null || dto.dueDate === "") {
        parsedDueDate = null;
      } else {
        const d = new Date(dto.dueDate);
        if (isNaN(d.getTime())) {
          throw new ValidationError("Invalid due date format.");
        }
        parsedDueDate = d;
      }
    }

    const created = await this.cardRepo.create({
      columnId: dto.columnId,
      boardId,
      title: dto.title.trim(),
      description: dto.description?.trim() ?? null,
      position: dto.position,
      dueDate: parsedDueDate,
      assigneeIds: dto.assigneeIds,
      labels: dto.labels,
    });

    return toDomainCard(created);
  }

  /**
   * Updates an existing card.
   */
  async updateCard(
    workspaceId: string,
    boardId: string,
    cardId: string,
    userId: string,
    dto: UpdateCardDTO
  ): Promise<Card> {
    await this.authService.requireCardInBoard(cardId, boardId, workspaceId, userId);

    if (dto.columnId) {
      await this.authService.requireColumnInBoard(
        dto.columnId,
        boardId,
        workspaceId,
        userId
      );
    }

    if (dto.assigneeIds !== undefined) {
      await this.authService.validateAssigneesInWorkspace(dto.assigneeIds, workspaceId);
    }

    let parsedDueDate: Date | null | undefined = undefined;
    if (dto.dueDate !== undefined) {
      if (dto.dueDate === null || dto.dueDate === "") {
        parsedDueDate = null;
      } else {
        const d = new Date(dto.dueDate);
        if (isNaN(d.getTime())) {
          throw new ValidationError("Invalid due date format.");
        }
        parsedDueDate = d;
      }
    }

    const updated = await this.cardRepo.update(cardId, {
      title: dto.title?.trim(),
      description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
      columnId: dto.columnId,
      position: dto.position,
      dueDate: parsedDueDate,
      assigneeIds: dto.assigneeIds,
      labels: dto.labels,
    });

    return toDomainCard(updated);
  }

  /**
   * Deletes a card.
   */
  async deleteCard(
    workspaceId: string,
    boardId: string,
    cardId: string,
    userId: string
  ): Promise<boolean> {
    await this.authService.requireCardInBoard(cardId, boardId, workspaceId, userId);
    return this.cardRepo.delete(cardId);
  }

  /**
   * Moves or reorders a card within or across columns atomically.
   */
  async moveCard(
    workspaceId: string,
    boardId: string,
    userId: string,
    dto: MoveCardDTO
  ): Promise<Card> {
    await this.authService.requireCardInBoard(dto.cardId, boardId, workspaceId, userId);
    await this.authService.requireColumnInBoard(
      dto.sourceColumnId,
      boardId,
      workspaceId,
      userId
    );
    await this.authService.requireColumnInBoard(
      dto.targetColumnId,
      boardId,
      workspaceId,
      userId
    );

    const moved = await this.cardRepo.moveCard({
      cardId: dto.cardId,
      sourceColumnId: dto.sourceColumnId,
      targetColumnId: dto.targetColumnId,
      targetPosition: dto.targetPosition,
    });

    return toDomainCard(moved);
  }
}

export const cardService = new CardService();
