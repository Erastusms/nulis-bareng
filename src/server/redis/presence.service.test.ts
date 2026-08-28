import { beforeEach, describe, expect, it, vi } from "vitest";
import type Redis from "ioredis";
import { PresenceService, PRESENCE_TTL_SECONDS } from "./presence.service";

describe("PresenceService", () => {
  let mockRedisData: Map<string, string>;
  let mockRedisSets: Map<string, Set<string>>;
  let mockRedis: Partial<Redis>;
  let presenceService: PresenceService;

  beforeEach(() => {
    mockRedisData = new Map();
    mockRedisSets = new Map();

    const createPipeline = () => {
      const operations: (() => void)[] = [];
      const pipelineObj = {
        set: vi.fn((key: string, val: string) => {
          operations.push(() => mockRedisData.set(key, val));
          return pipelineObj;
        }),
        sadd: vi.fn((key: string, member: string) => {
          operations.push(() => {
            let set = mockRedisSets.get(key);
            if (!set) {
              set = new Set();
              mockRedisSets.set(key, set);
            }
            set.add(member);
          });
          return pipelineObj;
        }),
        expire: vi.fn(() => pipelineObj),
        exec: vi.fn(async () => {
          operations.forEach((op) => op());
          return [];
        }),
      };
      return pipelineObj;
    };

    mockRedis = {
      get: vi.fn(async (key: string) => mockRedisData.get(key) || null),
      set: vi.fn(async (key: string, val: string) => {
        mockRedisData.set(key, val);
        return "OK";
      }),
      del: vi.fn(async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (mockRedisData.delete(k) || mockRedisSets.delete(k)) count++;
        }
        return count;
      }),
      mget: vi.fn(async (...keys: string[]) => {
        return keys.map((k) => mockRedisData.get(k) || null);
      }),
      sadd: vi.fn(async (key: string, member: string) => {
        let set = mockRedisSets.get(key);
        if (!set) {
          set = new Set();
          mockRedisSets.set(key, set);
        }
        set.add(member);
        return 1;
      }),
      srem: vi.fn(async (key: string, member: string) => {
        const set = mockRedisSets.get(key);
        if (set) {
          const res = set.delete(member) ? 1 : 0;
          return res;
        }
        return 0;
      }),
      scard: vi.fn(async (key: string) => {
        const set = mockRedisSets.get(key);
        return set ? set.size : 0;
      }),
      expire: vi.fn(async () => 1),
      pipeline: vi.fn(createPipeline as any),
    } as unknown as Partial<Redis>;

    presenceService = new PresenceService(mockRedis as Redis, PRESENCE_TTL_SECONDS);
  });

  it("should set user presence to ONLINE and track connection", async () => {
    const { presence, isNewStatus } = await presenceService.setUserOnline("user_1", "conn_1");

    expect(isNewStatus).toBe(true);
    expect(presence.userId).toBe("user_1");
    expect(presence.status).toBe("ONLINE");
    expect(presence.lastSeenAt).toBeDefined();

    const storedUser = mockRedisData.get("presence:user:user_1");
    expect(storedUser).toBeDefined();
    expect(JSON.parse(storedUser!)).toEqual(
      expect.objectContaining({
        userId: "user_1",
        status: "ONLINE",
      })
    );

    const storedConns = mockRedisSets.get("presence:user:user_1:connections");
    expect(storedConns?.has("conn_1")).toBe(true);
  });

  it("should refresh heartbeat without changing status unnecessarily", async () => {
    await presenceService.setUserOnline("user_1", "conn_1", "AWAY");

    const refreshed = await presenceService.heartbeat("user_1", "conn_1");
    expect(refreshed.status).toBe("AWAY");

    const refreshedExplicit = await presenceService.heartbeat("user_1", "conn_1", "ONLINE");
    expect(refreshedExplicit.status).toBe("ONLINE");
  });

  it("should handle multi-tab connections correctly (closing tab 1 does NOT mark offline)", async () => {
    // Tab 1 connects
    await presenceService.setUserOnline("user_1", "tab_1");

    // Tab 2 connects
    await presenceService.setUserOnline("user_1", "tab_2");

    expect(mockRedisSets.get("presence:user:user_1:connections")?.size).toBe(2);

    // Close Tab 1
    const result1 = await presenceService.removeConnection("user_1", "tab_1");
    expect(result1.isOffline).toBe(false);
    expect(result1.remainingConnections).toBe(1);

    // User is still ONLINE in Redis
    const check1 = await presenceService.getUserPresence("user_1");
    expect(check1.status).toBe("ONLINE");

    // Close Tab 2
    const result2 = await presenceService.removeConnection("user_1", "tab_2");
    expect(result2.isOffline).toBe(true);
    expect(result2.remainingConnections).toBe(0);

    // User is now OFFLINE
    const check2 = await presenceService.getUserPresence("user_1");
    expect(check2.status).toBe("OFFLINE");
  });

  it("should batch query presence state for multiple users using MGET", async () => {
    await presenceService.setUserOnline("user_online_1", "conn_a");
    await presenceService.setUserOnline("user_away_2", "conn_b", "AWAY");

    const presenceMap = await presenceService.getMultipleUsersPresence([
      "user_online_1",
      "user_away_2",
      "user_offline_3",
    ]);

    expect(mockRedis.mget).toHaveBeenCalledWith(
      "presence:user:user_online_1",
      "presence:user:user_away_2",
      "presence:user:user_offline_3"
    );

    expect(presenceMap.get("user_online_1")?.status).toBe("ONLINE");
    expect(presenceMap.get("user_away_2")?.status).toBe("AWAY");
    expect(presenceMap.get("user_offline_3")?.status).toBe("OFFLINE");
  });

  it("should update user presence status explicitly (AWAY / ONLINE)", async () => {
    await presenceService.setUserOnline("user_1", "conn_1");

    const away = await presenceService.setUserStatus("user_1", "AWAY");
    expect(away.status).toBe("AWAY");

    const presence = await presenceService.getUserPresence("user_1");
    expect(presence.status).toBe("AWAY");
  });

  it("should work seamlessly in fallback in-memory mode when Redis is disabled", async () => {
    const fallbackService = new PresenceService(undefined);
    fallbackService.clear();

    await fallbackService.setUserOnline("usr_mem_1", "c1");
    await fallbackService.setUserOnline("usr_mem_1", "c2");

    const p1 = await fallbackService.getUserPresence("usr_mem_1");
    expect(p1.status).toBe("ONLINE");

    const r1 = await fallbackService.removeConnection("usr_mem_1", "c1");
    expect(r1.isOffline).toBe(false);

    const r2 = await fallbackService.removeConnection("usr_mem_1", "c2");
    expect(r2.isOffline).toBe(true);

    const p2 = await fallbackService.getUserPresence("usr_mem_1");
    expect(p2.status).toBe("OFFLINE");
  });
});
