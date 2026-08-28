import { z } from "zod";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { redisLogger } from "./redis-logger";

/**
 * Standard Redis Pub/Sub channel prefix for workspace-scoped events.
 */
export const WORKSPACE_CHANNEL_PREFIX = "workspace:";

/**
 * Formats the Redis channel name for a workspace.
 */
export function getWorkspaceChannel(workspaceId: string): string {
  return `${WORKSPACE_CHANNEL_PREFIX}${workspaceId}`;
}

/**
 * Extracts the workspace ID from a workspace Redis channel name.
 */
export function getWorkspaceIdFromChannel(channel: string): string | null {
  if (channel.startsWith(WORKSPACE_CHANNEL_PREFIX)) {
    return channel.slice(WORKSPACE_CHANNEL_PREFIX.length);
  }
  return null;
}

/**
 * Internal cross-instance Redis event envelope.
 */
export interface RedisEventEnvelope<T extends RealtimeDomainEvent = RealtimeDomainEvent> {
  eventId: string;
  type: T["type"];
  workspaceId: string;
  sourceInstanceId: string;
  timestamp: string;
  version: number;
  payload: T;
}

export const redisEventEnvelopeSchema = z.object({
  eventId: z.string().min(1),
  type: z.string().min(1),
  workspaceId: z.string().min(1),
  sourceInstanceId: z.string().min(1),
  timestamp: z.string().min(1),
  version: z.number().int().nonnegative(),
  payload: z.object({
    eventId: z.string().min(1),
    type: z.string().min(1),
    workspaceId: z.string().min(1),
    version: z.number().int().nonnegative(),
    timestamp: z.string().min(1),
  }).passthrough(),
});

/**
 * Constructs a typed RedisEventEnvelope wrapping a domain event.
 */
export function createRedisEnvelope<T extends RealtimeDomainEvent>(
  event: T,
  sourceInstanceId: string
): RedisEventEnvelope<T> {
  return {
    eventId: event.eventId,
    type: event.type,
    workspaceId: event.workspaceId,
    sourceInstanceId,
    timestamp: event.timestamp,
    version: event.version,
    payload: event,
  };
}

/**
 * Serializes a Redis event envelope to a JSON string.
 */
export function serializeRedisEnvelope(envelope: RedisEventEnvelope): string {
  return JSON.stringify(envelope);
}

/**
 * Safely deserializes and validates a raw string into a RedisEventEnvelope.
 * Returns null if the payload is invalid or malformed.
 */
export function deserializeRedisEnvelope(raw: string): RedisEventEnvelope | null {
  try {
    const parsed = JSON.parse(raw);
    const result = redisEventEnvelopeSchema.safeParse(parsed);
    if (!result.success) {
      redisLogger.warn("Malformed Redis event envelope received", {
        errors: result.error.flatten().fieldErrors,
      });
      return null;
    }
    return result.data as unknown as RedisEventEnvelope;
  } catch (err) {
    redisLogger.warn("Failed to parse raw Redis message as JSON", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
