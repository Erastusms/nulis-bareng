import type Redis from "ioredis";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { metrics } from "../observability/metrics";
import { getRedisSubscriberClient } from "./redis-client";
import {
  deserializeRedisEnvelope,
  getWorkspaceChannel,
  getWorkspaceIdFromChannel,
  RedisEventEnvelope,
} from "./redis-envelope";
import { redisLogger } from "./redis-logger";

export type RedisMessageHandler = (
  workspaceId: string,
  event: RealtimeDomainEvent,
  envelope: RedisEventEnvelope
) => void;

export class RedisSubscriber {
  private client: Redis | null = null;
  private readonly activeWorkspaces = new Set<string>();
  private messageHandlers = new Set<RedisMessageHandler>();
  private isListening = false;
  private isClientInitialized = false;

  constructor(customClient?: Redis) {
    if (customClient) {
      this.client = customClient;
      this.isClientInitialized = true;
      this.setupListeners();
    }
  }

  private getClient(): Redis {
    if (!this.client && !this.isClientInitialized) {
      try {
        this.client = getRedisSubscriberClient();
        this.setupListeners();
      } catch (err) {
        redisLogger.error("Failed to initialize Redis subscriber client", err);
      }
    }
    return this.client!;
  }

  private setupListeners(): void {
    if (this.isListening || !this.client) return;
    this.isListening = true;

    this.client.on("message", (channel: string, message: string) => {
      this.handleIncomingMessage(channel, message);
    });

    // On reconnect/ready, restore subscriptions for all currently active workspace rooms
    this.client.on("ready", () => {
      if (this.activeWorkspaces.size > 0) {
        const channels = Array.from(this.activeWorkspaces).map((wsId) =>
          getWorkspaceChannel(wsId)
        );
        redisLogger.info(
          `Redis subscriber restored; re-subscribing to ${channels.length} active channels`,
          { channels }
        );
        this.client?.subscribe(...channels).catch((err) => {
          redisLogger.error("Failed to restore Redis channel subscriptions on ready", err);
        });
      }
    });
  }

  /**
   * Registers a message listener for incoming distributed real-time events.
   */
  onMessage(handler: RedisMessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  /**
   * Subscribes this backend instance to a workspace Redis channel.
   */
  async subscribeToWorkspace(workspaceId: string): Promise<void> {
    if (this.activeWorkspaces.has(workspaceId)) {
      return; // Already tracked and subscribed
    }

    this.activeWorkspaces.add(workspaceId);
    const channel = getWorkspaceChannel(workspaceId);

    try {
      const client = this.getClient();
      if (!client) {
        throw new Error("Redis subscriber client unavailable");
      }

      await client.subscribe(channel);
      redisLogger.info(`Subscribed to Redis channel ${channel}`, {
        workspaceId,
        totalActiveChannels: this.activeWorkspaces.size,
      });
    } catch (err) {
      redisLogger.error(`Failed to subscribe to Redis channel ${channel}`, err, {
        workspaceId,
      });
    }
  }

  /**
   * Unsubscribes this backend instance from a workspace Redis channel.
   */
  async unsubscribeFromWorkspace(workspaceId: string): Promise<void> {
    if (!this.activeWorkspaces.has(workspaceId)) {
      return;
    }

    this.activeWorkspaces.delete(workspaceId);
    const channel = getWorkspaceChannel(workspaceId);

    try {
      const client = this.getClient();
      if (!client) {
        throw new Error("Redis subscriber client unavailable");
      }

      await client.unsubscribe(channel);
      redisLogger.info(`Unsubscribed from Redis channel ${channel}`, {
        workspaceId,
        remainingActiveChannels: this.activeWorkspaces.size,
      });
    } catch (err) {
      redisLogger.error(`Failed to unsubscribe from Redis channel ${channel}`, err, {
        workspaceId,
      });
    }
  }

  /**
   * Processes incoming raw Redis messages and measures propagation latency.
   */
  private handleIncomingMessage(channel: string, rawPayload: string): void {
    const envelope = deserializeRedisEnvelope(rawPayload);
    if (!envelope) {
      redisLogger.warn("Ignored invalid or unparseable Redis message", { channel });
      return;
    }

    const workspaceId =
      getWorkspaceIdFromChannel(channel) || envelope.workspaceId;

    const publishedAt = new Date(envelope.timestamp).getTime();
    const propagationLatencyMs =
      !isNaN(publishedAt) && publishedAt > 0
        ? Math.max(0, Date.now() - publishedAt)
        : undefined;

    metrics.recordRedisMessageReceived(propagationLatencyMs);

    redisLogger.info(`Received event ${envelope.type} from ${channel}`, {
      eventId: envelope.eventId,
      workspaceId,
      sourceInstanceId: envelope.sourceInstanceId,
      ...(propagationLatencyMs !== undefined && { propagationLatencyMs }),
    });

    for (const handler of this.messageHandlers) {
      try {
        handler(workspaceId, envelope.payload, envelope);
      } catch (err) {
        redisLogger.error("Error in Redis message handler", err, {
          channel,
          eventId: envelope.eventId,
        });
      }
    }
  }

  /**
   * Gets list of all currently tracked active workspace IDs.
   */
  getActiveWorkspaces(): string[] {
    return Array.from(this.activeWorkspaces);
  }

  /**
   * Unsubscribes from all active workspace channels.
   */
  async unsubscribeAll(): Promise<void> {
    if (this.activeWorkspaces.size === 0) return;

    const channels = Array.from(this.activeWorkspaces).map((wsId) =>
      getWorkspaceChannel(wsId)
    );
    this.activeWorkspaces.clear();

    try {
      const client = this.getClient();
      if (client) {
        await client.unsubscribe(...channels);
      }
      redisLogger.info("Unsubscribed from all Redis workspace channels");
    } catch (err) {
      redisLogger.error("Error unsubscribing all channels", err);
    }
  }

  /**
   * Closes the subscriber and cleans up handlers.
   */
  async close(): Promise<void> {
    await this.unsubscribeAll();
    this.messageHandlers.clear();
  }
}

export const redisSubscriber = new RedisSubscriber();
