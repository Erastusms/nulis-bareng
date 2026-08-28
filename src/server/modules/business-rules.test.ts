import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { evaluateMemberRemoval, canUpdateWorkspace, canInviteMember } from "./workspaces/workspace-authorization";
import { CardService } from "./boards/card.service";
import { BoardColumnService } from "./boards/board-column.service";
import { BoardService } from "./boards/board.service";
import { PageService } from "./pages/page.service";
import { BoardAuthorizationService } from "./boards/board-authorization";
import { PageAuthorizationService } from "./pages/page-authorization";
import { WorkspaceAuthorizationService } from "./workspaces/workspace-authorization";

describe("Core Business Rules & Invariants (Unit)", () => {
  describe("Workspace Membership & Removal Invariants", () => {
    it("should allow OWNER to remove MEMBER and ADMIN", () => {
      const resMember = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(resMember.allowed).toBe(true);

      const resAdmin = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(resAdmin.allowed).toBe(true);
    });

    it("should allow ADMIN to remove MEMBER but reject removing another ADMIN", () => {
      const resMember = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(resMember.allowed).toBe(true);

      const resAdmin = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(resAdmin.allowed).toBe(false);
      expect(resAdmin.reason).toContain("Admins cannot remove other admins");
    });

    it("should forbid MEMBER from removing anyone", () => {
      const res = evaluateMemberRemoval({
        removerRole: "MEMBER",
        targetRole: "MEMBER",
        isTargetOwner: false,
        isSelf: false,
      });
      expect(res.allowed).toBe(false);
    });

    it("should forbid removing the workspace OWNER under any circumstances", () => {
      const res = evaluateMemberRemoval({
        removerRole: "OWNER",
        targetRole: "OWNER",
        isTargetOwner: true,
        isSelf: false,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("The workspace owner cannot be removed");
    });

    it("should forbid self-removal through member removal method", () => {
      const res = evaluateMemberRemoval({
        removerRole: "ADMIN",
        targetRole: "ADMIN",
        isTargetOwner: false,
        isSelf: true,
      });
      expect(res.allowed).toBe(false);
      expect(res.reason).toContain("You cannot remove yourself");
    });

    it("should enforce update and invite permissions based on role", () => {
      expect(canUpdateWorkspace("OWNER")).toBe(true);
      expect(canUpdateWorkspace("ADMIN")).toBe(true);
      expect(canUpdateWorkspace("MEMBER")).toBe(false);

      expect(canInviteMember("OWNER")).toBe(true);
      expect(canInviteMember("ADMIN")).toBe(true);
      expect(canInviteMember("MEMBER")).toBe(false);
    });
  });

  describe("Kanban Hierarchy & Boundary Invariants", () => {
    let mockWorkspaceRepo: any;
    let mockMemberRepo: any;
    let mockBoardRepo: any;
    let mockColumnRepo: any;
    let mockCardRepo: any;
    let mockPublisher: any;
    let mockActivityService: any;
    let boardAuthService: BoardAuthorizationService;
    let cardService: CardService;

    const mockWorkspace = { id: "ws_100", ownerId: "usr_owner", slug: "ws-100", urlIdentifier: "ws-100" };
    const mockBoard = { id: "board_1", workspaceId: "ws_100", title: "Board 1", position: 65536 };
    const mockColumn1 = { id: "col_1", boardId: "board_1", title: "Col 1", position: 65536 };
    const mockColumn2 = { id: "col_2", boardId: "board_2_diff", title: "Col 2 on other board", position: 65536 };

    beforeEach(() => {
      mockWorkspaceRepo = {
        findById: vi.fn(async (id: string) => (id === mockWorkspace.id ? mockWorkspace : null)),
        findByIdOrUrlIdentifier: vi.fn(async (id: string) => (id === mockWorkspace.id ? mockWorkspace : null)),
      };
      mockMemberRepo = {
        findByWorkspaceAndUser: vi.fn(async (wsId: string, uId: string) => {
          if (wsId === mockWorkspace.id && uId === "usr_member") {
            return { id: "mem_1", workspaceId: wsId, userId: uId, role: "MEMBER" };
          }
          return null;
        }),
      };
      mockBoardRepo = {
        findById: vi.fn(async (id: string) => (id === mockBoard.id ? mockBoard : null)),
      };
      mockColumnRepo = {
        findById: vi.fn(async (id: string) => {
          if (id === mockColumn1.id) return mockColumn1;
          if (id === mockColumn2.id) return mockColumn2;
          return null;
        }),
      };
      mockCardRepo = {
        findById: vi.fn(async (id: string) => null),
        create: vi.fn(),
        moveCard: vi.fn(),
      };
      mockPublisher = { publish: vi.fn() };
      mockActivityService = { recordActivity: vi.fn() };

      const wsAuth = new WorkspaceAuthorizationService(mockMemberRepo, mockWorkspaceRepo);
      boardAuthService = new BoardAuthorizationService(
        mockWorkspaceRepo,
        wsAuth,
        mockBoardRepo,
        mockColumnRepo,
        mockCardRepo,
        mockMemberRepo
      );

      cardService = new CardService(
        mockCardRepo,
        boardAuthService,
        mockPublisher,
        mockActivityService
      );
    });

    it("should reject creating a card in a nonexistent column", async () => {
      await expect(
        cardService.createCard("ws_100", "board_1", "usr_member", {
          columnId: "nonexistent_col",
          title: "New Card",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject creating a card in a column belonging to a different board", async () => {
      await expect(
        cardService.createCard("ws_100", "board_1", "usr_member", {
          columnId: "col_2", // Belongs to board_2_diff, not board_1
          title: "Cross Board Card",
        })
      ).rejects.toThrow(NotFoundError);
    });

    it("should reject assigning a non-member user to a card", async () => {
      await expect(
        cardService.createCard("ws_100", "board_1", "usr_member", {
          columnId: "col_1",
          title: "Assigned Card",
          assigneeIds: ["usr_stranger"],
        })
      ).rejects.toThrow(ValidationError);
    });

    it("should reject moving a card across mismatched board/column hierarchy", async () => {
      mockCardRepo.findById.mockResolvedValueOnce({
        id: "card_1",
        boardId: "board_1",
        columnId: "col_1",
        title: "Card 1",
        position: 65536,
      });

      // Target column belongs to another board
      await expect(
        cardService.moveCard("ws_100", "board_1", "usr_member", {
          cardId: "card_1",
          sourceColumnId: "col_1",
          targetColumnId: "col_2", // col_2 is on board_2_diff
          targetPosition: 65536,
        })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("Document Hierarchy Invariants", () => {
    it("should reject document access if document belongs to another workspace", async () => {
      const mockWorkspaceRepo = {
        findById: vi.fn(async (id: string) => ({ id: "ws_foreign" })),
        findByIdOrUrlIdentifier: vi.fn(async (id: string) => ({ id: "ws_foreign" })),
      };
      const mockMemberRepo = {
        findByWorkspaceAndUser: vi.fn(async () => null), // User is not member of ws_foreign
      };
      const mockPageRepo = {
        findById: vi.fn(async () => ({ id: "page_foreign", workspaceId: "ws_foreign" })),
      };

      const wsAuth = new WorkspaceAuthorizationService(mockMemberRepo as any, mockWorkspaceRepo as any);
      const pageAuth = new PageAuthorizationService(mockWorkspaceRepo as any, wsAuth, mockPageRepo as any);

      await expect(pageAuth.requirePageAccess("page_foreign", "usr_intruder")).rejects.toThrow(
        ForbiddenError
      );
    });
  });
});
