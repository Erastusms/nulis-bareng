import type { IncomingMessage } from "http";
import { SESSION_COOKIE_NAME } from "@/server/auth/session";
import { authService } from "@/server/modules/auth/auth.service";
import { workspaceRepository } from "@/server/db/repositories/workspace.repository";
import { workspaceMemberRepository } from "@/server/db/repositories/workspace-member.repository";
import type { IWorkspaceRepository, IWorkspaceMemberRepository } from "@/server/db/repository";
import type { User } from "@/types/domain";
import { wsLogger } from "./logger";

export interface WorkspaceAuthResult {
  authorized: boolean;
  workspaceId?: string;
  urlIdentifier?: string;
}

/**
 * Extracts a cookie value by name from the Cookie header.
 */
function extractCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extracts session token from incoming HTTP upgrade request.
 * Supports Cookie header (`nb_session`), Authorization Bearer header, or URL query param (`token`/`sessionToken`).
 */
export function extractSessionToken(req: IncomingMessage): string | null {
  // 1. Check Cookie header
  const cookieToken = extractCookie(req.headers.cookie, SESSION_COOKIE_NAME);
  if (cookieToken) return cookieToken;

  // 2. Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 3. Check query parameters from request URL
  if (req.url) {
    try {
      const url = new URL(req.url, "http://localhost");
      const queryToken = url.searchParams.get("token") || url.searchParams.get("sessionToken");
      if (queryToken) return queryToken;
    } catch {
      // Invalid URL format
    }
  }

  return null;
}

/**
 * Authenticates a WebSocket connection request.
 * Returns the User if authenticated, otherwise null.
 */
export async function authenticateWebSocket(req: IncomingMessage): Promise<User | null> {
  const token = extractSessionToken(req);
  if (!token) {
    wsLogger.warn("WebSocket authentication failed: No session token provided");
    return null;
  }

  try {
    const result = await authService.validateSession(token);
    if (!result) {
      wsLogger.warn("WebSocket authentication failed: Invalid or expired session");
      return null;
    }
    return result.user;
  } catch (error) {
    wsLogger.error("WebSocket authentication exception", error);
    return null;
  }
}

/**
 * Authorizes a user's subscription to a workspace channel.
 * Resolves workspace by ID or urlIdentifier and verifies user membership.
 */
export async function authorizeWorkspaceSubscription(
  userId: string,
  workspaceIdOrIdentifier: string,
  workspaceRepo: IWorkspaceRepository = workspaceRepository,
  memberRepo: IWorkspaceMemberRepository = workspaceMemberRepository
): Promise<WorkspaceAuthResult> {
  try {
    const workspace = await workspaceRepo.findByIdOrUrlIdentifier(workspaceIdOrIdentifier);
    if (!workspace) {
      wsLogger.warn("Workspace subscription denied: Workspace not found", {
        userId,
        workspaceId: workspaceIdOrIdentifier,
      });
      return { authorized: false };
    }

    const membership = await memberRepo.findByWorkspaceAndUser(workspace.id, userId);
    if (!membership) {
      wsLogger.warn("Workspace subscription denied: User is not a member", {
        userId,
        workspaceId: workspaceIdOrIdentifier,
        resolvedId: workspace.id,
      });
      return { authorized: false };
    }

    return {
      authorized: true,
      workspaceId: workspace.id,
      urlIdentifier: workspace.urlIdentifier,
    };
  } catch (error) {
    wsLogger.error("Workspace authorization error", error, {
      userId,
      workspaceId: workspaceIdOrIdentifier,
    });
    return { authorized: false };
  }
}
