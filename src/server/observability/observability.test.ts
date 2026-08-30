import { describe, it, expect, beforeEach, vi } from "vitest";
import { MetricsRegistry, Histogram, Counter, Gauge } from "./metrics";
import {
  extractOrGenerateRequestId,
  getCurrentRequestId,
  runWithRequestContext,
} from "./request-context";
import { sanitizeLogData, StructuredLogger } from "./logger";
import { PrismaWorkspaceMemberRepository } from "../db/repositories/workspace-member.repository";
import { PrismaWorkspaceRepository } from "../db/repositories/workspace.repository";
import { BoardAuthorizationService } from "../modules/boards/board-authorization";

describe("Metrics Engine", () => {
  let metrics: MetricsRegistry;

  beforeEach(() => {
    metrics = new MetricsRegistry();
  });

  describe("Histogram & Percentiles", () => {
    it("should accurately compute p50, p95, and p99 percentiles", () => {
      const hist = new Histogram();

      // Record 100 samples from 1 to 100
      for (let i = 1; i <= 100; i++) {
        hist.record(i);
      }

      const summary = hist.getSummary();
      expect(summary.count).toBe(100);
      expect(summary.min).toBe(1);
      expect(summary.max).toBe(100);
      expect(summary.avg).toBe(50.5);
      expect(summary.p50).toBe(51);
      expect(summary.p95).toBe(96);
      expect(summary.p99).toBe(100);
    });

    it("should handle empty histograms gracefully", () => {
      const hist = new Histogram();
      const summary = hist.getSummary();
      expect(summary.count).toBe(0);
      expect(summary.p50).toBe(0);
      expect(summary.avg).toBe(0);
    });
  });

  describe("Counter & Gauge", () => {
    it("should increment counter correctly", () => {
      const counter = new Counter();
      expect(counter.get()).toBe(0);
      counter.inc();
      counter.inc(5);
      expect(counter.get()).toBe(6);
      counter.reset();
      expect(counter.get()).toBe(0);
    });

    it("should set and adjust gauge correctly", () => {
      const gauge = new Gauge();
      gauge.set(10);
      expect(gauge.get()).toBe(10);
      gauge.inc(2);
      expect(gauge.get()).toBe(12);
      gauge.dec(5);
      expect(gauge.get()).toBe(7);
      gauge.dec(20); // Should clamp to 0
      expect(gauge.get()).toBe(0);
    });
  });

  describe("Metrics Registry Snapshot & Prometheus Export", () => {
    it("should track API request status classes and latency", () => {
      metrics.recordApiRequest("GET", "/api/workspaces", 200, 15);
      metrics.recordApiRequest("POST", "/api/workspaces", 201, 30);
      metrics.recordApiRequest("GET", "/api/workspaces/:id", 404, 5);
      metrics.recordApiRequest("POST", "/api/cards", 500, 120);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.api.totalRequests).toBe(4);
      expect(snapshot.api.statusCodes["2xx"]).toBe(2);
      expect(snapshot.api.statusCodes["4xx"]).toBe(1);
      expect(snapshot.api.statusCodes["5xx"]).toBe(1);
      expect(snapshot.api.errorRatePercent).toBe(50);
      expect(snapshot.api.endpoints["GET /api/workspaces"].count).toBe(1);
    });

    it("should track WebSocket lifecycle and reconnects", () => {
      metrics.recordWsConnectionAttempt();
      metrics.recordWsConnectionSuccess();
      metrics.recordWsReconnect();
      metrics.recordWsDisconnect("normal");

      const snapshot = metrics.getSnapshot();
      expect(snapshot.websocket.connectionAttempts).toBe(1);
      expect(snapshot.websocket.successfulConnections).toBe(1);
      expect(snapshot.websocket.reconnectAttempts).toBe(1);
      expect(snapshot.websocket.disconnects).toBe(1);
      expect(snapshot.websocket.disconnectReasons["normal"]).toBe(1);
    });

    it("should track Redis Pub/Sub latency and database query latency", () => {
      metrics.recordRedisPublish(true);
      metrics.recordRedisMessageReceived(8);
      metrics.recordDbQuery("Card", "findUnique", 12, false, false);
      metrics.recordDbQuery("Board", "findMany", 110, true, false);

      const snapshot = metrics.getSnapshot();
      expect(snapshot.redis.publishedTotal).toBe(1);
      expect(snapshot.redis.messagesReceivedTotal).toBe(1);
      expect(snapshot.redis.propagationLatencyMs.p50).toBe(8);

      expect(snapshot.database.totalQueries).toBe(2);
      expect(snapshot.database.slowQueries).toBe(1);
      expect(snapshot.database.modelQueries["Board.findMany"]).toBe(1);
    });

    it("should format metrics in Prometheus exposition format", () => {
      metrics.recordApiRequest("GET", "/api/health", 200, 4);
      const prom = metrics.toPrometheus();
      expect(prom).toContain("http_requests_total{status=\"2xx\"} 1");
      expect(prom).toContain("http_request_duration_ms");
      expect(prom).toContain("process_uptime_seconds");
    });
  });
});

describe("Request Correlation & Context", () => {
  it("should extract valid client-provided x-request-id", () => {
    const headers = new Headers({ "x-request-id": "client-req-12345" });
    const reqId = extractOrGenerateRequestId(headers);
    expect(reqId).toBe("client-req-12345");
  });

  it("should reject malicious or invalid headers and generate a safe fallback ID", () => {
    const headers = new Headers({ "x-request-id": "<script>alert(1)</script>" });
    const reqId = extractOrGenerateRequestId(headers);
    expect(reqId).toMatch(/^req_[a-f0-9]{32}$/);
    expect(reqId).not.toContain("<script>");
  });

  it("should generate a unique requestId when header is missing", () => {
    const reqId1 = extractOrGenerateRequestId();
    const reqId2 = extractOrGenerateRequestId();
    expect(reqId1).toMatch(/^req_[a-f0-9]{32}$/);
    expect(reqId2).toMatch(/^req_[a-f0-9]{32}$/);
    expect(reqId1).not.toBe(reqId2);
  });

  it("should propagate context through async execution chain", async () => {
    await runWithRequestContext(
      {
        requestId: "req_test_context_999",
        userId: "usr_alice",
        startTime: Date.now(),
      },
      async () => {
        expect(getCurrentRequestId()).toBe("req_test_context_999");
        await new Promise((r) => setTimeout(r, 10));
        expect(getCurrentRequestId()).toBe("req_test_context_999");
      }
    );
  });
});

describe("Structured Logging & Sensitive Data Sanitization", () => {
  it("should scrub sensitive keys recursively", () => {
    const rawData = {
      user: {
        id: "usr_123",
        email: "alice@example.com",
        password: "SuperSecretPassword123!",
        passwordHash: "$2b$10$abcdefghijklmnopqrstuvwxyz",
        sessionToken: "sess_secret_token_val",
      },
      headers: {
        authorization: "Bearer secret_jwt_token",
        cookie: "session=xyz123",
      },
      databaseUrl: "postgresql://postgres:secret@localhost:5432/db",
      nonSensitiveField: "safe_value",
    };

    const sanitized = sanitizeLogData(rawData) as Record<string, any>;
    expect(sanitized.user.id).toBe("usr_123");
    expect(sanitized.user.email).toBe("alice@example.com");
    expect(sanitized.user.password).toBe("[REDACTED]");
    expect(sanitized.user.passwordHash).toBe("[REDACTED]");
    expect(sanitized.user.sessionToken).toBe("[REDACTED]");
    expect(sanitized.headers.authorization).toBe("[REDACTED]");
    expect(sanitized.headers.cookie).toBe("[REDACTED]");
    expect(sanitized.databaseUrl).toBe("[REDACTED]");
    expect(sanitized.nonSensitiveField).toBe("safe_value");
  });

  it("should format logs as JSON when NODE_ENV is production", () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const logger = new StructuredLogger();

    logger.info("card.moved", {
      requestId: "req_abc",
      userId: "usr_1",
      workspaceId: "ws_10",
      boardId: "board_1",
      duration: 35,
      meta: { password: "hidden", columnId: "col_2" },
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);
    const logStr = consoleSpy.mock.calls[0][0];
    const parsed = JSON.parse(logStr);

    expect(parsed.event).toBe("card.moved");
    expect(parsed.requestId).toBe("req_abc");
    expect(parsed.userId).toBe("usr_1");
    expect(parsed.workspaceId).toBe("ws_10");
    expect(parsed.duration).toBe(35);
    expect(parsed.meta.password).toBe("[REDACTED]");
    expect(parsed.meta.columnId).toBe("col_2");

    consoleSpy.mockRestore();
    (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
  });
});

describe("Database Optimizations & Query Batching", () => {
  it("should batch assignee membership lookups into a single query", async () => {
    const mockFindMany = vi.fn().mockResolvedValue([
      { id: "m1", workspaceId: "ws_1", userId: "u1", role: "MEMBER" },
      { id: "m2", workspaceId: "ws_1", userId: "u2", role: "MEMBER" },
    ]);

    const mockPrisma = {
      workspaceMember: {
        findMany: mockFindMany,
      },
    } as any;

    const memberRepo = new PrismaWorkspaceMemberRepository(mockPrisma);
    const mockWorkspaceRepo = {
      findByIdOrUrlIdentifier: vi.fn().mockResolvedValue({ id: "ws_1" }),
    } as any;

    const boardAuth = new BoardAuthorizationService(
      mockWorkspaceRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      memberRepo
    );

    await boardAuth.validateAssigneesInWorkspace(["u1", "u2"], "ws_1");

    // Must execute exactly 1 query with userIds in array
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws_1",
        userId: { in: ["u1", "u2"] },
      },
    });
  });

  it("should optimize findByIdOrUrlIdentifier with single OR query", async () => {
    const mockFindFirst = vi.fn().mockResolvedValue({
      id: "ws_1",
      name: "Acme",
      slug: "acme",
      urlIdentifier: "acme-1",
      description: null,
      ownerId: "u_1",
      createdAt: new Date(),
      updatedAt: new Date(),
      _count: { members: 2 },
    });

    const mockPrisma = {
      workspace: {
        findFirst: mockFindFirst,
      },
    } as any;

    const repo = new PrismaWorkspaceRepository(mockPrisma);
    const result = await repo.findByIdOrUrlIdentifier("acme-1");

    expect(mockFindFirst).toHaveBeenCalledTimes(1);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { id: "acme-1" },
          { urlIdentifier: "acme-1" },
          { slug: "acme-1" },
        ],
      },
      include: {
        _count: { select: { members: true } },
      },
    });
    expect(result?.id).toBe("ws_1");
  });
});
