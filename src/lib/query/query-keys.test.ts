import { describe, expect, it } from "vitest";
import { authKeys, boardKeys, documentKeys, notificationKeys, userKeys, workspaceKeys } from "./query-keys";

describe("Query Key Factories", () => {
  it("should generate consistent workspace query keys", () => {
    expect(workspaceKeys.all).toEqual(["workspaces"]);
    expect(workspaceKeys.lists()).toEqual(["workspaces", "list"]);
    expect(workspaceKeys.list({ page: 1 })).toEqual(["workspaces", "list", { page: 1 }]);
    expect(workspaceKeys.detail("ws-123")).toEqual(["workspaces", "detail", "ws-123"]);
    expect(workspaceKeys.members("ws-123")).toEqual(["workspaces", "detail", "ws-123", "members"]);
  });

  it("should generate consistent board query keys", () => {
    expect(boardKeys.all).toEqual(["boards"]);
    expect(boardKeys.lists("ws-1")).toEqual(["boards", "list", "ws-1"]);
    expect(boardKeys.detail("b-1")).toEqual(["boards", "detail", "b-1"]);
    expect(boardKeys.cards("b-1")).toEqual(["boards", "detail", "b-1", "cards"]);
    expect(boardKeys.card("b-1", "c-1")).toEqual(["boards", "detail", "b-1", "cards", "c-1"]);
  });

  it("should generate consistent document query keys", () => {
    expect(documentKeys.all).toEqual(["documents"]);
    expect(documentKeys.detail("doc-1")).toEqual(["documents", "detail", "doc-1"]);
  });

  it("should generate consistent notification query keys", () => {
    expect(notificationKeys.all).toEqual(["notifications"]);
    expect(notificationKeys.unreadCount()).toEqual(["notifications", "unread-count"]);
  });

  it("should generate consistent user query keys", () => {
    expect(userKeys.all).toEqual(["users"]);
    expect(userKeys.current()).toEqual(["users", "current"]);
  });

  it("should generate consistent auth query keys", () => {
    expect(authKeys.all).toEqual(["auth"]);
    expect(authKeys.session()).toEqual(["auth", "session"]);
    expect(authKeys.user()).toEqual(["users", "current"]);
  });
});

