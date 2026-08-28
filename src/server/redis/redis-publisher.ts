import type Redis from "ioredis";
import type { RealtimeDomainEvent } from "@/lib/realtime/events";
import { getRedisPublisherClient, getInstanceId } from "./redis-client";
import {
  createRedisEnvelope,
  getWorkspaceChannel,
  serializeRedisEnvelope,
} from "./redis-envelope";
import { redisLogger } from "./redis-logger";

export interface PublishOptions {
  isForwarded?: boolean;
}

export interface IEventPublisher {
  publish(event: RealtimeDomainEvent, options?: PublishOptions): Promise<void | boolean>;
}

export class RedisPublisher implements IEventPublisher {
  private client: Redis | null = null;
  private readonly instanceId: string;
  private isClientInitialized = false;

  constructor(
    customClient?: Redis,
    instanceId?: string
  ) {
    if (customClient) {
      this.client = customClient;
      this.isClientInitialized = true;
    }
    this.instanceId = instanceId || getInstanceId();
  }

  private getClient(): Redis {
    if (!this.client && !this.isClientInitialized) {
      try {
        this.client = getRedisPublisherClient();
      } catch (err) {
        redisLogger.error("Failed to initialize Redis publisher client", err);
      }
    }
    return this.client!;
  }

  /**
   * Publishes a granular domain event to the workspace-scoped Redis channel.
   */
  async publish(event: RealtimeDomainEvent, _options?: PublishOptions): Promise<boolean> {
    const channel = getWorkspaceChannel(event.workspaceId);
    const envelope = createRedisEnvelope(event, this.instanceId);
    const serialized = serializeRedisEnvelope(envelope);

    try {
      const client = this.getClient();
      if (!client) {
        throw new Error("Redis publisher client unavailable");
      }

      await client.publish(channel, serialized);

      redisLogger.info(`Published event ${event.type} to ${channel}`, {
        eventId: event.eventId,
        workspaceId: event.workspaceId,
        sourceInstanceId: this.instanceId,
      });
      return true;
    } catch (err) {
      redisLogger.error(`Redis publish failed for event ${event.type} on ${channel}`, err, {
        eventId: event.eventId,
        workspaceId: event.workspaceId,
        sourceInstanceId: this.instanceId,
      });
      return false;
    }
  }
}

export const redisPublisher = new RedisPublisher();
