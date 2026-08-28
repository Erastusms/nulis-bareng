import type Redis from "ioredis";
import { getRedisPublisherClient } from "./redis-client";
import { redisLogger } from "./redis-logger";
import type { PresenceStatus, UserPresence } from "@/types/domain";

export const PRESENCE_TTL_SECONDS = 30;
export const HEARTBEAT_INTERVAL_MS = 10000;

export interface PresenceRecord {
  userId: string;
  status: "ONLINE" | "AWAY";
  lastSeenAt: string;
}

export class PresenceService {
  private client: Redis | null = null;
  private isClientInitialized = false;
  private readonly ttlSeconds: number;

  // In-memory fallback tracking for test environments or when Redis is disabled
  private inMemoryPresence = new Map<string, PresenceRecord>();
  private inMemoryUserConnections = new Map<string, Set<string>>();

  constructor(customClient?: Redis, ttlSeconds = PRESENCE_TTL_SECONDS) {
    if (customClient) {
      this.client = customClient;
      this.isClientInitialized = true;
    }
    this.ttlSeconds = ttlSeconds;
  }

  private getClient(): Redis | null {
    if (this.client) {
      return this.client;
    }
    if (process.env.ENABLE_REDIS === "false") {
      return null;
    }
    if (!this.isClientInitialized) {
      try {
        this.client = getRedisPublisherClient();
      } catch (err) {
        redisLogger.error("Failed to get Redis client for PresenceService", err);
      }
    }
    return this.client;
  }


  private getUserKey(userId: string): string {
    return `presence:user:${userId}`;
  }

  private getUserConnectionsKey(userId: string): string {
    return `presence:user:${userId}:connections`;
  }

  private getConnectionKey(connectionId: string): string {
    return `presence:conn:${connectionId}`;
  }

  /**
   * Registers a connection as online and stores/refreshes the user's presence state in Redis.
   */
  async setUserOnline(
    userId: string,
    connectionId: string,
    status: "ONLINE" | "AWAY" = "ONLINE"
  ): Promise<{ presence: UserPresence; isNewStatus: boolean }> {
    const lastSeenAt = new Date().toISOString();
    const presenceData: PresenceRecord = {
      userId,
      status,
      lastSeenAt,
    };

    const client = this.getClient();
    let isNewStatus = true;

    if (client) {
      try {
        const userKey = this.getUserKey(userId);
        const connsKey = this.getUserConnectionsKey(userId);
        const connKey = this.getConnectionKey(connectionId);

        // Check previous status
        const prev = await client.get(userKey);
        if (prev) {
          try {
            const parsed = JSON.parse(prev) as PresenceRecord;
            if (parsed.status === status) {
              isNewStatus = false;
            }
          } catch {}
        }

        const serialized = JSON.stringify(presenceData);
        const pipeline = client.pipeline();

        pipeline.set(userKey, serialized, "EX", this.ttlSeconds);
        pipeline.sadd(connsKey, connectionId);
        pipeline.expire(connsKey, this.ttlSeconds);
        pipeline.set(connKey, userId, "EX", this.ttlSeconds);

        await pipeline.exec();
      } catch (err) {
        redisLogger.error("Failed to set user presence in Redis", err, { userId, connectionId });
      }
    } else {
      // In-memory fallback
      const prev = this.inMemoryPresence.get(userId);
      if (prev && prev.status === status) {
        isNewStatus = false;
      }
      this.inMemoryPresence.set(userId, presenceData);
      let conns = this.inMemoryUserConnections.get(userId);
      if (!conns) {
        conns = new Set();
        this.inMemoryUserConnections.set(userId, conns);
      }
      conns.add(connectionId);
    }

    return {
      presence: presenceData,
      isNewStatus,
    };
  }

  /**
   * Refreshes presence TTL and timestamp on client heartbeat.
   */
  async heartbeat(
    userId: string,
    connectionId: string,
    status?: "ONLINE" | "AWAY"
  ): Promise<UserPresence> {
    const lastSeenAt = new Date().toISOString();
    const client = this.getClient();

    let targetStatus: "ONLINE" | "AWAY" = status || "ONLINE";

    if (client) {
      try {
        const userKey = this.getUserKey(userId);
        const connsKey = this.getUserConnectionsKey(userId);
        const connKey = this.getConnectionKey(connectionId);

        if (!status) {
          const current = await client.get(userKey);
          if (current) {
            try {
              const parsed = JSON.parse(current) as PresenceRecord;
              targetStatus = parsed.status;
            } catch {}
          }
        }

        const presenceData: PresenceRecord = {
          userId,
          status: targetStatus,
          lastSeenAt,
        };

        const serialized = JSON.stringify(presenceData);
        const pipeline = client.pipeline();

        pipeline.set(userKey, serialized, "EX", this.ttlSeconds);
        pipeline.sadd(connsKey, connectionId);
        pipeline.expire(connsKey, this.ttlSeconds);
        pipeline.set(connKey, userId, "EX", this.ttlSeconds);

        await pipeline.exec();
        return presenceData;
      } catch (err) {
        redisLogger.error("Failed to execute heartbeat in Redis", err, { userId, connectionId });
      }
    } else {
      if (!status) {
        const cur = this.inMemoryPresence.get(userId);
        if (cur) targetStatus = cur.status;
      }
      const presenceData: PresenceRecord = {
        userId,
        status: targetStatus,
        lastSeenAt,
      };
      this.inMemoryPresence.set(userId, presenceData);
      let conns = this.inMemoryUserConnections.get(userId);
      if (!conns) {
        conns = new Set();
        this.inMemoryUserConnections.set(userId, conns);
      }
      conns.add(connectionId);
      return presenceData;
    }

    return {
      userId,
      status: targetStatus,
      lastSeenAt,
    };
  }

  /**
   * Explicitly updates a user's presence state (e.g. switching to AWAY or ONLINE).
   */
  async setUserStatus(userId: string, status: "ONLINE" | "AWAY"): Promise<UserPresence> {
    const lastSeenAt = new Date().toISOString();
    const presenceData: PresenceRecord = {
      userId,
      status,
      lastSeenAt,
    };

    const client = this.getClient();

    if (client) {
      try {
        const userKey = this.getUserKey(userId);
        const connsKey = this.getUserConnectionsKey(userId);
        const serialized = JSON.stringify(presenceData);

        const pipeline = client.pipeline();
        pipeline.set(userKey, serialized, "EX", this.ttlSeconds);
        pipeline.expire(connsKey, this.ttlSeconds);
        await pipeline.exec();
      } catch (err) {
        redisLogger.error("Failed to update user presence status in Redis", err, { userId, status });
      }
    } else {
      this.inMemoryPresence.set(userId, presenceData);
    }

    return presenceData;
  }

  /**
   * Removes a connection from user's active connection set.
   * If no active connections remain for this user, removes the presence key and transitions to OFFLINE.
   */
  async removeConnection(
    userId: string,
    connectionId: string
  ): Promise<{ isOffline: boolean; remainingConnections: number }> {
    const client = this.getClient();

    if (client) {
      try {
        const userKey = this.getUserKey(userId);
        const connsKey = this.getUserConnectionsKey(userId);
        const connKey = this.getConnectionKey(connectionId);

        await client.srem(connsKey, connectionId);
        await client.del(connKey);

        const remaining = await client.scard(connsKey);

        if (remaining === 0) {
          await client.del(userKey);
          await client.del(connsKey);
          return { isOffline: true, remainingConnections: 0 };
        }

        return { isOffline: false, remainingConnections: remaining };
      } catch (err) {
        redisLogger.error("Failed to remove connection from Redis", err, { userId, connectionId });
        return { isOffline: false, remainingConnections: 1 };
      }
    } else {
      const conns = this.inMemoryUserConnections.get(userId);
      if (conns) {
        conns.delete(connectionId);
        if (conns.size === 0) {
          this.inMemoryUserConnections.delete(userId);
          this.inMemoryPresence.delete(userId);
          return { isOffline: true, remainingConnections: 0 };
        }
        return { isOffline: false, remainingConnections: conns.size };
      }
      return { isOffline: true, remainingConnections: 0 };
    }
  }

  /**
   * Retrieves presence state for a single user. Defaults to OFFLINE if key is missing or expired.
   */
  async getUserPresence(userId: string): Promise<UserPresence> {
    const client = this.getClient();

    if (client) {
      try {
        const userKey = this.getUserKey(userId);
        const raw = await client.get(userKey);
        if (raw) {
          const parsed = JSON.parse(raw) as PresenceRecord;
          return {
            userId: parsed.userId,
            status: parsed.status,
            lastSeenAt: parsed.lastSeenAt,
          };
        }
      } catch (err) {
        redisLogger.error("Failed to get user presence from Redis", err, { userId });
      }
    } else {
      const mem = this.inMemoryPresence.get(userId);
      if (mem) {
        return {
          userId: mem.userId,
          status: mem.status,
          lastSeenAt: mem.lastSeenAt,
        };
      }
    }

    return {
      userId,
      status: "OFFLINE",
      lastSeenAt: new Date().toISOString(),
    };
  }

  /**
   * Batch queries presence state for multiple users using Redis MGET in a single round-trip.
   * Users without an active key default to OFFLINE.
   */
  async getMultipleUsersPresence(userIds: string[]): Promise<Map<string, UserPresence>> {
    const result = new Map<string, UserPresence>();
    if (userIds.length === 0) return result;

    const uniqueUserIds = Array.from(new Set(userIds));
    const client = this.getClient();

    if (client) {
      try {
        const keys = uniqueUserIds.map((id) => this.getUserKey(id));
        const values = await client.mget(...keys);

        for (let i = 0; i < uniqueUserIds.length; i++) {
          const userId = uniqueUserIds[i];
          const raw = values[i];
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as PresenceRecord;
              result.set(userId, {
                userId: parsed.userId,
                status: parsed.status,
                lastSeenAt: parsed.lastSeenAt,
              });
              continue;
            } catch {}
          }
          result.set(userId, {
            userId,
            status: "OFFLINE",
            lastSeenAt: new Date().toISOString(),
          });
        }
        return result;
      } catch (err) {
        redisLogger.error("Failed to batch get user presence from Redis", err);
      }
    }

    // Fallback: in-memory or default OFFLINE
    for (const userId of uniqueUserIds) {
      const mem = this.inMemoryPresence.get(userId);
      if (mem) {
        result.set(userId, {
          userId: mem.userId,
          status: mem.status,
          lastSeenAt: mem.lastSeenAt,
        });
      } else {
        result.set(userId, {
          userId,
          status: "OFFLINE",
          lastSeenAt: new Date().toISOString(),
        });
      }
    }

    return result;
  }

  /**
   * Retrieves presence for all member user IDs in a workspace.
   */
  async getWorkspacePresence(memberUserIds: string[]): Promise<UserPresence[]> {
    const presenceMap = await this.getMultipleUsersPresence(memberUserIds);
    return Array.from(presenceMap.values());
  }

  /**
   * Clears internal state (useful in tests).
   */
  clear(): void {
    this.inMemoryPresence.clear();
    this.inMemoryUserConnections.clear();
  }
}

export const presenceService = new PresenceService();
