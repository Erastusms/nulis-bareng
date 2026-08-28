/**
 * Collaboration utilities for room naming and user cursor presence.
 */

const CURSOR_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Red
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#14b8a6", // Teal
  "#6366f1", // Indigo
];

/**
 * Builds a standardized collaborative room name scoped by workspace and page.
 */
export function getCollabRoomName(workspaceId: string, pageId: string): string {
  return `workspace:${workspaceId}:page:${pageId}`;
}

/**
 * Parses a collaborative room name back into workspaceId and pageId.
 * Format: `workspace:${workspaceId}:page:${pageId}`
 */
export function parseCollabRoomName(
  roomName: string
): { workspaceId: string; pageId: string } | null {
  if (!roomName || typeof roomName !== "string") return null;

  const parts = roomName.split(":");
  if (parts.length === 4 && parts[0] === "workspace" && parts[2] === "page") {
    const workspaceId = parts[1].trim();
    const pageId = parts[3].trim();
    if (workspaceId && pageId) {
      return { workspaceId, pageId };
    }
  }

  return null;
}

/**
 * Computes a deterministic, distinct color for a user ID for live cursors and presence.
 */
export function getUserColor(userId: string): string {
  if (!userId) return CURSOR_COLORS[0];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }

  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}
