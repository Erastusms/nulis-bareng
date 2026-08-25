import { ValidationError } from "@/lib/api/errors";
import { createEventId, createVersion } from "@/lib/realtime/events";
import { cardRepository } from "@/server/db/repositories/card.repository";
import type {
  CardRecord,
  ICardRepository,
} from "@/server/db/repository";
import { eventPublisher, IEventPublisher } from "@/server/websocket/event-publisher";
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
    private readonly authService: BoardAuthorizationService = boardAuth,
    private readonly publisher: IEventPublisher = eventPublisher
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
    const authResult = await this.authService.requireColumnInBoard(
      dto.columnId,
      boardId,
      workspaceId,
      userId
    );
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

    if (dto.assigneeIds && dto.assigneeIds.length > 0) {
      await this.authService.validateAssigneesInWorkspace(dto.assigneeIds, canonicalWorkspaceId);
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

    const domainCard = toDomainCard(created);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "card.created",
      workspaceId: canonicalWorkspaceId,
      boardId,
      columnId: domainCard.columnId,
      cardId: domainCard.id,
      card: domainCard,
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainCard;
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
    const authResult = await this.authService.requireCardInBoard(cardId, boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;

    if (dto.columnId) {
      await this.authService.requireColumnInBoard(
        dto.columnId,
        boardId,
        canonicalWorkspaceId,
        userId
      );
    }

    if (dto.assigneeIds !== undefined) {
      await this.authService.validateAssigneesInWorkspace(dto.assigneeIds, canonicalWorkspaceId);
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

    const domainCard = toDomainCard(updated);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "card.updated",
      workspaceId: canonicalWorkspaceId,
      boardId,
      columnId: domainCard.columnId,
      cardId: domainCard.id,
      changes: {
        title: dto.title?.trim(),
        description: dto.description !== undefined ? dto.description?.trim() ?? null : undefined,
        columnId: dto.columnId,
        position: dto.position,
        dueDate: domainCard.dueDate,
        assigneeIds: dto.assigneeIds,
        labels: dto.labels,
      },
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainCard;
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
    const authResult = await this.authService.requireCardInBoard(cardId, boardId, workspaceId, userId);
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;
    const card = authResult.card;
    const deleted = await this.cardRepo.delete(cardId);

    if (deleted) {
      await this.publisher.publish({
        eventId: createEventId(),
        type: "card.deleted",
        workspaceId: canonicalWorkspaceId,
        boardId,
        columnId: card?.columnId ?? "",
        cardId,
        version: createVersion(),
        timestamp: new Date().toISOString(),
      });
    }

    return deleted;
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
    const authResult = await this.authService.requireCardInBoard(
      dto.cardId,
      boardId,
      workspaceId,
      userId
    );
    const canonicalWorkspaceId = authResult?.workspace?.id ?? workspaceId;
    const card = authResult.card;

    await this.authService.requireColumnInBoard(
      dto.sourceColumnId,
      boardId,
      canonicalWorkspaceId,
      userId
    );
    await this.authService.requireColumnInBoard(
      dto.targetColumnId,
      boardId,
      canonicalWorkspaceId,
      userId
    );

    if (card && card.columnId !== dto.sourceColumnId) {
      throw new ValidationError("Card does not belong to the specified source column.");
    }

    if (dto.targetPosition < 0) {
      throw new ValidationError("Target position must be non-negative.");
    }

    const moved = await this.cardRepo.moveCard({
      cardId: dto.cardId,
      sourceColumnId: dto.sourceColumnId,
      targetColumnId: dto.targetColumnId,
      targetPosition: dto.targetPosition,
    });

    const domainCard = toDomainCard(moved);

    await this.publisher.publish({
      eventId: createEventId(),
      type: "card.moved",
      workspaceId: canonicalWorkspaceId,
      boardId,
      cardId: domainCard.id,
      fromColumnId: dto.sourceColumnId,
      toColumnId: dto.targetColumnId,
      position: domainCard.position,
      version: createVersion(),
      timestamp: new Date().toISOString(),
    });

    return domainCard;
  }
}

export const cardService = new CardService();
