/**
 * Collaboration utilities for room naming and user cursor presence.
 */

export const CURSOR_COLORS = [
  "#2563eb", // Blue
  "#059669", // Emerald Green
  "#d97706", // Amber
  "#dc2626", // Red
  "#7c3aed", // Violet
  "#db2777", // Pink / Rose
  "#0891b2", // Cyan
  "#ea580c", // Orange
  "#0d9488", // Teal
  "#4f46e5", // Indigo
  "#16a34a", // Green
  "#9333ea", // Bright Purple
  "#c026d3", // Fuchsia
  "#0284c7", // Sky Blue
  "#e11d48", // Crimson
  "#ca8a04", // Dark Gold
  "#00838f", // Deep Teal
  "#512da8", // Deep Purple
  "#c2185b", // Raspberry
  "#303f9f", // Dark Indigo
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
 * Assigns a unique, randomized, vibrant color for the active browser session or user ID.
 * In a browser tab, stores the color in sessionStorage so it stays persistent for that tab session
 * while ensuring multiple users / tabs receive distinct, randomized colors.
 */
export function getRandomUserColor(userId?: string): string {
  if (typeof window !== "undefined") {
    try {
      const storageKey = `collab_cursor_color_${userId || "anon"}`;
      const saved = sessionStorage.getItem(storageKey);
      if (saved && CURSOR_COLORS.includes(saved)) {
        return saved;
      }
      const randomIndex = Math.floor(Math.random() * CURSOR_COLORS.length);
      const chosenColor = CURSOR_COLORS[randomIndex];
      sessionStorage.setItem(storageKey, chosenColor);
      return chosenColor;
    } catch {
      // Ignore storage errors in private browsing modes
    }
  }

  if (!userId) return CURSOR_COLORS[0];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }

  const index = Math.abs(hash) % CURSOR_COLORS.length;
  return CURSOR_COLORS[index];
}

/**
 * Computes a color for a user ID for live cursors and presence.
 */
export function getUserColor(userId?: string): string {
  return getRandomUserColor(userId);
}
