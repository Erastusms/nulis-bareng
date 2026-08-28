import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";
import type { IActivityRepository } from "@/server/db/repository";
import type { IEventPublisher } from "@/server/websocket/event-publisher";
import type { WorkspaceAuthorizationService } from "../workspaces/workspace-authorization";
import { ActivityService } from "./activity.service";

describe("ActivityService", () => {
  let activityRepo: IActivityRepository;
  let authService: WorkspaceAuthorizationService;
  let publisher: IEventPublisher;
  let activityService: ActivityService;

  const mockActivityRecord = {
    id: "act_1",
    workspaceId: "ws_123",
    actorId: "usr_1",
    type: "CARD_MOVED" as const,
    entityType: "CARD",
    entityId: "card_100",
    metadata: { cardTitle: "Payment Bug", fromColumnId: "col_1", toColumnId: "col_2" },
    createdAt: new Date("2026-08-28T08:00:00.000Z"),
    actor: {
      id: "usr_1",
      name: "John Doe",
      email: "john@example.com",
      avatarUrl: null,
    },
  };

  beforeEach(() => {
    activityRepo = {
      findById: vi.fn(),
      findByWorkspaceId: vi.fn().mockResolvedValue({
        items: [mockActivityRecord],
        nextCursor: null,
      }),
      create: vi.fn().mockResolvedValue(mockActivityRecord),
      delete: vi.fn().mockResolvedValue(true),
      countByWorkspaceId: vi.fn().mockResolvedValue(1),
    };

    authService = {
      requireWorkspaceAccess: vi.fn().mockResolvedValue({
        member: { id: "mem_1", workspaceId: "ws_123", userId: "usr_1", role: "MEMBER" },
        role: "MEMBER",
      }),
    } as unknown as WorkspaceAuthorizationService;


    publisher = {
      publish: vi.fn().mockResolvedValue(true),
    };

    activityService = new ActivityService(activityRepo, authService, publisher);
  });

  it("should record an activity and broadcast activity.created event", async () => {
    const result = await activityService.recordActivity({
      workspaceId: "ws_123",
      actorId: "usr_1",
      type: "CARD_MOVED",
      entityType: "CARD",
      entityId: "card_100",
      metadata: { cardTitle: "Payment Bug", fromColumnId: "col_1", toColumnId: "col_2" },
    });

    expect(activityRepo.create).toHaveBeenCalledWith({
      workspaceId: "ws_123",
      actorId: "usr_1",
      type: "CARD_MOVED",
      entityType: "CARD",
      entityId: "card_100",
      metadata: { cardTitle: "Payment Bug", fromColumnId: "col_1", toColumnId: "col_2" },
    });

    expect(publisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "activity.created",
        workspaceId: "ws_123",
        activity: expect.objectContaining({
          id: "act_1",
          type: "CARD_MOVED",
          actor: expect.objectContaining({ name: "John Doe" }),
          entity: { type: "CARD", id: "card_100" },
        }),
      })
    );

    expect(result).toBeDefined();
    expect(result?.id).toBe("act_1");
    expect(result?.type).toBe("CARD_MOVED");
    expect(result?.actor?.name).toBe("John Doe");
  });


  it("should retrieve paginated activities for an authorized workspace member", async () => {
    const result = await activityService.getWorkspaceActivities("ws_123", "usr_1", { limit: 10 });

    expect(authService.requireWorkspaceAccess).toHaveBeenCalledWith("usr_1", "ws_123");
    expect(activityRepo.findByWorkspaceId).toHaveBeenCalledWith("ws_123", { limit: 10 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("act_1");
    expect(result.nextCursor).toBeNull();
  });

  it("should throw ForbiddenError if user does not belong to workspace", async () => {
    vi.spyOn(authService, "requireWorkspaceAccess").mockRejectedValue(
      new ForbiddenError("You are not a member of this workspace.")
    );

    await expect(
      activityService.getWorkspaceActivities("ws_123", "unauthorized_user")
    ).rejects.toThrow(ForbiddenError);
  });
});
