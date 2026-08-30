import { NotFoundError, ValidationError } from "@/lib/api/errors";
import { boardRepository } from "@/server/db/repositories/board.repository";
import { boardColumnRepository } from "@/server/db/repositories/board-column.repository";
import { cardRepository } from "@/server/db/repositories/card.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import type {
  BoardColumnRecord,
  BoardRecord,
  CardRecord,
  IBoardColumnRepository,
  IBoardRepository,
  ICardRepository,
  IWorkspaceMemberRepository,
  IWorkspaceRepository,
  WorkspaceRecord,
} from "@/server/db/repository";
import {
  workspaceAuth,
  WorkspaceAuthorizationService,
  type WorkspaceAuthContext,
} from "../workspaces/workspace-authorization";

export class BoardAuthorizationService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository = workspaceRepository,
    private readonly workspaceAuthService: WorkspaceAuthorizationService = workspaceAuth,
    private readonly boardRepo: IBoardRepository = boardRepository,
    private readonly columnRepo: IBoardColumnRepository = boardColumnRepository,
    private readonly cardRepo: ICardRepository = cardRepository,
    private readonly memberRepo: IWorkspaceMemberRepository = workspaceMemberRepository
  ) {}

  /**
   * Enforces that the user is an active member of the workspace (resolves by ID or urlIdentifier).
   */
  async requireWorkspaceAccess(
    userId: string,
    workspaceIdOrIdentifier: string
  ): Promise<{ workspace: WorkspaceRecord; auth: WorkspaceAuthContext }> {
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      throw new NotFoundError("Workspace", workspaceIdOrIdentifier);
    }

    const auth = await this.workspaceAuthService.requireWorkspaceAccess(userId, workspace.id);
    return { workspace, auth };
  }

  /**
   * Validates that the board exists and belongs to the specified workspace (resolves by ID or urlIdentifier).
   */
  async requireBoardInWorkspace(
    boardId: string,
    workspaceIdOrIdentifier: string,
    userId: string
  ): Promise<{
    board: BoardRecord;
    workspace: WorkspaceRecord;
    auth: WorkspaceAuthContext;
  }> {
    const { workspace, auth } = await this.requireWorkspaceAccess(
      userId,
      workspaceIdOrIdentifier
    );
    const board = await this.boardRepo.findById(boardId);

    if (!board || board.workspaceId !== workspace.id) {
      throw new NotFoundError("Board", boardId);
    }

    return { board, workspace, auth };
  }

  /**
   * Validates that the column exists and belongs to the specified board and workspace.
   */
  async requireColumnInBoard(
    columnId: string,
    boardId: string,
    workspaceIdOrIdentifier: string,
    userId: string
  ): Promise<{
    column: BoardColumnRecord;
    board: BoardRecord;
    workspace: WorkspaceRecord;
    auth: WorkspaceAuthContext;
  }> {
    const { board, workspace, auth } = await this.requireBoardInWorkspace(
      boardId,
      workspaceIdOrIdentifier,
      userId
    );
    const column = await this.columnRepo.findById(columnId);

    if (!column || column.boardId !== boardId) {
      throw new NotFoundError("Column", columnId);
    }

    return { column, board, workspace, auth };
  }

  /**
   * Validates that columns exist and belong to the specified board without re-verifying workspace auth.
   */
  async validateColumnsInBoard(columnIds: string[], boardId: string): Promise<void> {
    const uniqueIds = Array.from(new Set(columnIds));
    for (const columnId of uniqueIds) {
      const column = await this.columnRepo.findById(columnId);
      if (!column || column.boardId !== boardId) {
        throw new NotFoundError("Column", columnId);
      }
    }
  }

  /**
   * Validates that the card exists and belongs to the specified board and workspace.
   */
  async requireCardInBoard(
    cardId: string,
    boardId: string,
    workspaceIdOrIdentifier: string,
    userId: string
  ): Promise<{
    card: CardRecord;
    board: BoardRecord;
    workspace: WorkspaceRecord;
    auth: WorkspaceAuthContext;
  }> {
    const { board, workspace, auth } = await this.requireBoardInWorkspace(
      boardId,
      workspaceIdOrIdentifier,
      userId
    );
    const card = await this.cardRepo.findById(cardId);

    if (!card || card.boardId !== boardId) {
      throw new NotFoundError("Card", cardId);
    }

    return { card, board, workspace, auth };
  }

  /**
   * Enforces that all assigned users are active members of the workspace.
   */
  async validateAssigneesInWorkspace(
    assigneeIds: string[],
    workspaceIdOrIdentifier: string
  ): Promise<void> {
    if (!assigneeIds || assigneeIds.length === 0) return;

    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(
      workspaceIdOrIdentifier
    );
    const actualWorkspaceId = workspace ? workspace.id : workspaceIdOrIdentifier;

    const uniqueIds = Array.from(new Set(assigneeIds));

    // Batch query member memberships in a single query
    if (this.memberRepo.findMembersByUserIds) {
      const members = await this.memberRepo.findMembersByUserIds(
        actualWorkspaceId,
        uniqueIds
      );
      const foundUserIds = new Set(members.map((m) => m.userId));
      for (const memberId of uniqueIds) {
        if (!foundUserIds.has(memberId)) {
          throw new ValidationError(
            `User '${memberId}' is not an active member of this workspace and cannot be assigned to the card.`
          );
        }
      }
    } else {
      for (const memberId of uniqueIds) {
        const member = await this.memberRepo.findByWorkspaceAndUser(
          actualWorkspaceId,
          memberId
        );
        if (!member) {
          throw new ValidationError(
            `User '${memberId}' is not an active member of this workspace and cannot be assigned to the card.`
          );
        }
      }
    }
  }
}

export const boardAuth = new BoardAuthorizationService();
