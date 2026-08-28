import Redis, { RedisOptions } from "ioredis";
import { redisLogger } from "./redis-logger";

let publisherClient: Redis | null = null;
let subscriberClient: Redis | null = null;

let instanceIdCache: string | null = null;

/**
 * Returns a consistent unique instance ID for this backend process.
 */
export function getInstanceId(): string {
  if (!instanceIdCache) {
    instanceIdCache =
      process.env.INSTANCE_ID ||
      `instance_${process.pid}_${Math.random().toString(36).substring(2, 9)}`;
  }
  return instanceIdCache;
}

/**
 * Sets or overrides the instance ID (useful for testing multi-instance scenarios).
 */
export function setInstanceId(id: string): void {
  instanceIdCache = id;
}

/**
 * Default retry strategy for Redis connection recovery.
 * Stops after 3 attempts if Redis is not running to avoid terminal noise.
 */
export function defaultRetryStrategy(times: number): number | null {
  if (process.env.ENABLE_REDIS === "false" || (process.env.NODE_ENV === "test" && times > 1)) {
    return null;
  }
  if (times > 3) {
    redisLogger.warn(
      `Redis server is unreachable after 3 attempts. Stopped reconnecting; operating in local real-time mode.`
    );
    return null; // Stop retrying indefinitely
  }
  const delay = Math.min(times * 300, 1000);
  redisLogger.info(`Redis connection retry attempt #${times}, retrying in ${delay}ms`);
  return delay;
}

/**
 * Creates a configured Redis client instance.
 */
export function createRedisClient(
  customUrl?: string,
  customOptions?: RedisOptions,
  role: "publisher" | "subscriber" | "general" = "general"
): Redis {
  const url = customUrl || process.env.REDIS_URL || "redis://localhost:6379";
  const isTest = process.env.NODE_ENV === "test" || process.env.ENABLE_REDIS === "false";

  const options: RedisOptions = {
    lazyConnect: isTest,
    enableOfflineQueue: !isTest,
    retryStrategy: defaultRetryStrategy,
    maxRetriesPerRequest: role === "subscriber" ? null : 1,
    enableReadyCheck: true,
    autoResubscribe: false, // We manage workspace re-subscriptions explicitly in RedisSubscriber
    ...customOptions,
  };

  const client = new Redis(url, options);

  // Suppress uncaught error crashes in event loop
  client.on("error", (err) => {
    if (client.status === "reconnecting" || client.status === "connecting") {
      redisLogger.debug(`Redis [${role}] connection attempt failed: ${(err as Error).message || "Connection refused"}`);
    } else {
      redisLogger.error(`Redis [${role}] client connection error`, err);
    }
  });

  client.on("connect", () => {
    redisLogger.info(`Redis [${role}] client connected`);
  });

  client.on("ready", () => {
    redisLogger.info(`Redis [${role}] client ready`);
  });

  client.on("close", () => {
    redisLogger.debug(`Redis [${role}] client connection closed`);
  });

  client.on("reconnecting", (delay: number) => {
    redisLogger.debug(`Redis [${role}] client reconnecting in ${delay}ms`);
  });

  return client;
}

/**
 * Gets or initializes the shared publisher Redis client.
 */
export function getRedisPublisherClient(customUrl?: string): Redis {
  if (!publisherClient) {
    publisherClient = createRedisClient(customUrl, undefined, "publisher");
  }
  return publisherClient;
}

/**
 * Gets or initializes the shared subscriber Redis client.
 */
export function getRedisSubscriberClient(customUrl?: string): Redis {
  if (!subscriberClient) {
    subscriberClient = createRedisClient(customUrl, undefined, "subscriber");
  }
  return subscriberClient;
}

/**
 * Gracefully disconnects all singleton Redis client connections.
 */
export async function closeRedisClients(): Promise<void> {
  const promises: Promise<string>[] = [];

  if (publisherClient) {
    promises.push(publisherClient.quit().catch(() => publisherClient?.disconnect() as unknown as string));
    publisherClient = null;
  }

  if (subscriberClient) {
    promises.push(subscriberClient.quit().catch(() => subscriberClient?.disconnect() as unknown as string));
    subscriberClient = null;
  }

  await Promise.allSettled(promises);
  redisLogger.info("Redis singleton clients disconnected cleanly");
}
