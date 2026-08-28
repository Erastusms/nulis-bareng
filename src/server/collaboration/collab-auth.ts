import type { IncomingHttpHeaders } from "http";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceAuth, WorkspaceAuthorizationService } from "@/server/modules/workspaces/workspace-authorization";
import { pageRepository } from "@/server/db/repositories/page.repository";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import type { IPageRepository, IWorkspaceRepository } from "@/server/db/repository";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { getUserColor, parseCollabRoomName } from "@/features/document/lib/collab-utils";
import { wsLogger } from "../websocket/logger";

export interface CollabUserIdentity {
  id: string;
  name: string;
  avatar: string | null;
  color: string;
}

export interface CollabAuthSuccess {
  authorized: true;
  user: CollabUserIdentity;
  workspaceId: string;
  pageId: string;
}

export interface CollabAuthFailure {
  authorized: false;
  reason: string;
  code: number;
}

export type CollabAuthResult = CollabAuthSuccess | CollabAuthFailure;

export type CollabRequestHeaders =
  | IncomingHttpHeaders
  | Headers
  | Record<string, string | string[] | undefined>;

function getHeader(headers: CollabRequestHeaders | undefined, name: string): string | null {
  if (!headers) return null;
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name);
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const val = record[name.toLowerCase()] || record[name];
  if (Array.isArray(val)) return val.join("; ");
  if (typeof val === "string") return val;
  return null;
}

function extractCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export class CollabAuthService {
  constructor(
    private readonly workspaceRepo: IWorkspaceRepository = workspaceRepository,
    private readonly pageRepo: IPageRepository = pageRepository,
    private readonly workspaceAuthService: WorkspaceAuthorizationService = workspaceAuth
  ) {}

  /**
   * Authenticates and authorizes a collaborative WebSocket connection to a document room.
   * Resolves token from explicit token argument, Authorization header, or Cookie header.
   */
  async authorizeConnection(
    token: string | undefined | null,
    documentName: string,
    headers?: CollabRequestHeaders
  ): Promise<CollabAuthResult> {
    // 1. Resolve session token
    let resolvedToken: string | null = null;

    if (token && typeof token === "string" && token.trim() && token !== "cookie_session") {
      resolvedToken = token.trim();
    } else if (headers) {
      // Try authorization header
      const authHeader = getHeader(headers, "authorization");
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        resolvedToken = authHeader.substring(7).trim();
      }

      // Try cookie header
      if (!resolvedToken) {
        const cookieHeader = getHeader(headers, "cookie");
        resolvedToken = extractCookie(cookieHeader, SESSION_COOKIE_NAME);
      }
    }

    if (!resolvedToken) {
      wsLogger.warn("Collaboration auth failed: No valid session token provided", { documentName });
      return { authorized: false, reason: "Authentication token is required.", code: 4401 };
    }

    let user;
    try {
      const sessionResult = await authService.validateSession(resolvedToken);
      if (!sessionResult || !sessionResult.user) {
        wsLogger.warn("Collaboration auth failed: Invalid or expired session", { documentName });
        return { authorized: false, reason: "Invalid or expired session.", code: 4401 };
      }
      user = sessionResult.user;
    } catch (err) {
      wsLogger.error("Collaboration auth exception validating session", err, { documentName });
      return { authorized: false, reason: "Failed to validate session.", code: 4401 };
    }

    // 2. Parse room name into workspaceId and pageId
    const parsedRoom = parseCollabRoomName(documentName);
    if (!parsedRoom) {
      wsLogger.warn("Collaboration auth failed: Invalid room name format", {
        userId: user.id,
        documentName,
      });
      return {
        authorized: false,
        reason: "Invalid collaborative room identifier format.",
        code: 4400,
      };
    }

    const { workspaceId, pageId } = parsedRoom;

    // 3. Verify workspace exists
    const workspace = await this.workspaceRepo.findByIdOrUrlIdentifier(workspaceId);
    if (!workspace) {
      wsLogger.warn("Collaboration auth failed: Workspace not found", {
        userId: user.id,
        workspaceId,
        pageId,
      });
      return { authorized: false, reason: "Workspace not found.", code: 4404 };
    }

    // 4. Verify user has workspace membership
    try {
      await this.workspaceAuthService.requireWorkspaceAccess(user.id, workspace.id);
    } catch {
      wsLogger.warn("Collaboration auth failed: User not a member of workspace", {
        userId: user.id,
        workspaceId: workspace.id,
        pageId,
      });
      return {
        authorized: false,
        reason: "You do not have access to this workspace.",
        code: 4403,
      };
    }

    // 5. Verify page exists and belongs to the workspace
    const page = await this.pageRepo.findById(pageId);
    if (!page) {
      wsLogger.warn("Collaboration auth failed: Page not found", {
        userId: user.id,
        workspaceId: workspace.id,
        pageId,
      });
      return { authorized: false, reason: "Document page not found.", code: 4404 };
    }

    if (page.workspaceId !== workspace.id) {
      wsLogger.warn("Collaboration auth failed: Page does not belong to workspace", {
        userId: user.id,
        workspaceId: workspace.id,
        pageId,
        pageWorkspaceId: page.workspaceId,
      });
      return {
        authorized: false,
        reason: "Document does not belong to the specified workspace.",
        code: 4403,
      };
    }

    const userIdentity: CollabUserIdentity = {
      id: user.id,
      name: user.name,
      avatar: user.avatarUrl ?? null,
      color: getUserColor(user.id),
    };

    wsLogger.info("Collaboration connection authorized", {
      userId: user.id,
      workspaceId: workspace.id,
      pageId,
      documentName,
    });

    return {
      authorized: true,
      user: userIdentity,
      workspaceId: workspace.id,
      pageId,
    };
  }
}

export const collabAuth = new CollabAuthService();
