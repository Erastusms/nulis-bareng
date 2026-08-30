/**
 * In-memory, bounded-cardinality metrics engine for application observability.
 * Provides latency histograms (p50, p95, p99), error rates, WebSocket metrics,
 * Redis Pub/Sub latency, and PostgreSQL query timings.
 */

export interface HistogramSummary {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export class Histogram {
  private samples: number[] = [];
  private readonly maxSamples: number;
  private totalCount = 0;
  private totalSum = 0;
  private minValue = Number.POSITIVE_INFINITY;
  private maxValue = 0;

  constructor(maxSamples = 1000) {
    this.maxSamples = maxSamples;
  }

  record(value: number): void {
    if (value < 0) return;
    this.totalCount++;
    this.totalSum += value;
    if (value < this.minValue) this.minValue = value;
    if (value > this.maxValue) this.maxValue = value;

    if (this.samples.length < this.maxSamples) {
      this.samples.push(value);
    } else {
      // Reservoir sampling / replace random element to maintain representative distribution
      const idx = Math.floor(Math.random() * this.totalCount);
      if (idx < this.maxSamples) {
        this.samples[idx] = value;
      }
    }
  }

  getSummary(): HistogramSummary {
    if (this.totalCount === 0) {
      return {
        count: 0,
        sum: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0,
      };
    }

    const sorted = [...this.samples].sort((a, b) => a - b);
    const len = sorted.length;

    const getPercentile = (p: number): number => {
      if (len === 0) return 0;
      const index = Math.min(Math.floor((p / 100) * len), len - 1);
      return sorted[index];
    };

    return {
      count: this.totalCount,
      sum: Math.round(this.totalSum * 100) / 100,
      min: this.minValue === Number.POSITIVE_INFINITY ? 0 : this.minValue,
      max: this.maxValue,
      avg: Math.round((this.totalSum / this.totalCount) * 100) / 100,
      p50: getPercentile(50),
      p95: getPercentile(95),
      p99: getPercentile(99),
    };
  }

  reset(): void {
    this.samples = [];
    this.totalCount = 0;
    this.totalSum = 0;
    this.minValue = Number.POSITIVE_INFINITY;
    this.maxValue = 0;
  }
}

export class Counter {
  private count = 0;

  inc(val = 1): void {
    this.count += val;
  }

  get(): number {
    return this.count;
  }

  reset(): void {
    this.count = 0;
  }
}

export class Gauge {
  private value = 0;

  set(val: number): void {
    this.value = val;
  }

  inc(val = 1): void {
    this.value += val;
  }

  dec(val = 1): void {
    this.value = Math.max(0, this.value - val);
  }

  get(): number {
    return this.value;
  }

  reset(): void {
    this.value = 0;
  }
}

export class MetricsRegistry {
  // --- API Request Metrics ---
  private apiLatency = new Histogram();
  private apiRequestsTotal = new Counter();
  private apiRequests2xx = new Counter();
  private apiRequests3xx = new Counter();
  private apiRequests4xx = new Counter();
  private apiRequests5xx = new Counter();
  private endpointLatency = new Map<string, Histogram>();

  // --- WebSocket Metrics ---
  private wsActiveConnections = new Gauge();
  private wsConnectionAttempts = new Counter();
  private wsSuccessfulConnections = new Counter();
  private wsRejectedConnections = new Counter();
  private wsDisconnects = new Counter();
  private wsReconnectAttempts = new Counter();
  private wsDisconnectReasons = new Map<string, Counter>();

  // --- Redis Pub/Sub Metrics ---
  private redisPubSubLatency = new Histogram();
  private redisPublishedTotal = new Counter();
  private redisPublishFailures = new Counter();
  private redisMessagesReceivedTotal = new Counter();

  // --- Database (PostgreSQL) Metrics ---
  private dbQueryLatency = new Histogram();
  private dbQueriesTotal = new Counter();
  private dbSlowQueries = new Counter();
  private dbQueryErrors = new Counter();
  private dbModelQueries = new Map<string, Counter>();

  private startTime = Date.now();

  /**
   * Records an API HTTP request.
   */
  recordApiRequest(
    method: string,
    routeTemplate: string,
    statusCode: number,
    durationMs: number
  ): void {
    this.apiRequestsTotal.inc();
    this.apiLatency.record(durationMs);

    if (statusCode >= 200 && statusCode < 300) {
      this.apiRequests2xx.inc();
    } else if (statusCode >= 300 && statusCode < 400) {
      this.apiRequests3xx.inc();
    } else if (statusCode >= 400 && statusCode < 500) {
      this.apiRequests4xx.inc();
    } else if (statusCode >= 500) {
      this.apiRequests5xx.inc();
    }

    const endpointKey = `${method.toUpperCase()} ${routeTemplate}`;
    if (!this.endpointLatency.has(endpointKey)) {
      // Keep map bounded to prevent memory leaks from arbitrary paths
      if (this.endpointLatency.size < 100) {
        this.endpointLatency.set(endpointKey, new Histogram(200));
      }
    }
    this.endpointLatency.get(endpointKey)?.record(durationMs);
  }

  /**
   * Records WebSocket connection lifecycle events.
   */
  recordWsConnectionAttempt(): void {
    this.wsConnectionAttempts.inc();
  }

  recordWsConnectionSuccess(): void {
    this.wsSuccessfulConnections.inc();
    this.wsActiveConnections.inc();
  }

  recordWsConnectionRejected(): void {
    this.wsRejectedConnections.inc();
  }

  recordWsDisconnect(reason = "normal"): void {
    this.wsActiveConnections.dec();
    this.wsDisconnects.inc();

    const boundedReason = reason.substring(0, 32);
    if (!this.wsDisconnectReasons.has(boundedReason)) {
      if (this.wsDisconnectReasons.size < 20) {
        this.wsDisconnectReasons.set(boundedReason, new Counter());
      }
    }
    this.wsDisconnectReasons.get(boundedReason)?.inc();
  }

  recordWsReconnect(): void {
    this.wsReconnectAttempts.inc();
  }

  setWsActiveConnections(count: number): void {
    this.wsActiveConnections.set(count);
  }

  /**
   * Records Redis Pub/Sub events and propagation latency.
   */
  recordRedisPublish(success: boolean): void {
    this.redisPublishedTotal.inc();
    if (!success) {
      this.redisPublishFailures.inc();
    }
  }

  recordRedisMessageReceived(propagationLatencyMs?: number): void {
    this.redisMessagesReceivedTotal.inc();
    if (propagationLatencyMs !== undefined && propagationLatencyMs >= 0) {
      this.redisPubSubLatency.record(propagationLatencyMs);
    }
  }

  /**
   * Records PostgreSQL database query metrics.
   */
  recordDbQuery(
    model: string,
    action: string,
    durationMs: number,
    isSlow = false,
    hasError = false
  ): void {
    this.dbQueriesTotal.inc();
    this.dbQueryLatency.record(durationMs);

    if (isSlow) {
      this.dbSlowQueries.inc();
    }
    if (hasError) {
      this.dbQueryErrors.inc();
    }

    const key = `${model}.${action}`;
    if (!this.dbModelQueries.has(key)) {
      if (this.dbModelQueries.size < 50) {
        this.dbModelQueries.set(key, new Counter());
      }
    }
    this.dbModelQueries.get(key)?.inc();
  }

  /**
   * Returns a complete JSON snapshot of all application metrics.
   */
  getSnapshot() {
    const totalRequests = this.apiRequestsTotal.get();
    const clientErrors = this.apiRequests4xx.get();
    const serverErrors = this.apiRequests5xx.get();
    const totalErrors = clientErrors + serverErrors;
    const errorRate =
      totalRequests > 0
        ? Math.round((totalErrors / totalRequests) * 10000) / 100
        : 0;

    const endpoints: Record<string, HistogramSummary> = {};
    for (const [key, hist] of this.endpointLatency.entries()) {
      endpoints[key] = hist.getSummary();
    }

    const disconnectReasons: Record<string, number> = {};
    for (const [key, counter] of this.wsDisconnectReasons.entries()) {
      disconnectReasons[key] = counter.get();
    }

    const modelQueries: Record<string, number> = {};
    for (const [key, counter] of this.dbModelQueries.entries()) {
      modelQueries[key] = counter.get();
    }

    return {
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      timestamp: new Date().toISOString(),
      api: {
        totalRequests,
        statusCodes: {
          "2xx": this.apiRequests2xx.get(),
          "3xx": this.apiRequests3xx.get(),
          "4xx": clientErrors,
          "5xx": serverErrors,
        },
        errorRatePercent: errorRate,
        latencyMs: this.apiLatency.getSummary(),
        endpoints,
      },
      websocket: {
        activeConnections: this.wsActiveConnections.get(),
        connectionAttempts: this.wsConnectionAttempts.get(),
        successfulConnections: this.wsSuccessfulConnections.get(),
        rejectedConnections: this.wsRejectedConnections.get(),
        disconnects: this.wsDisconnects.get(),
        reconnectAttempts: this.wsReconnectAttempts.get(),
        disconnectReasons,
      },
      redis: {
        publishedTotal: this.redisPublishedTotal.get(),
        publishFailures: this.redisPublishFailures.get(),
        messagesReceivedTotal: this.redisMessagesReceivedTotal.get(),
        propagationLatencyMs: this.redisPubSubLatency.getSummary(),
      },
      database: {
        totalQueries: this.dbQueriesTotal.get(),
        slowQueries: this.dbSlowQueries.get(),
        queryErrors: this.dbQueryErrors.get(),
        queryLatencyMs: this.dbQueryLatency.getSummary(),
        modelQueries,
      },
    };
  }

  /**
   * Formats metrics in Prometheus exposition format.
   */
  toPrometheus(): string {
    const s = this.getSnapshot();
    const lines: string[] = [
      `# HELP process_uptime_seconds Total application uptime in seconds.`,
      `# TYPE process_uptime_seconds gauge`,
      `process_uptime_seconds ${s.uptimeSeconds}`,
      ``,
      `# HELP http_requests_total Total number of HTTP requests.`,
      `# TYPE http_requests_total counter`,
      `http_requests_total{status="2xx"} ${s.api.statusCodes["2xx"]}`,
      `http_requests_total{status="3xx"} ${s.api.statusCodes["3xx"]}`,
      `http_requests_total{status="4xx"} ${s.api.statusCodes["4xx"]}`,
      `http_requests_total{status="5xx"} ${s.api.statusCodes["5xx"]}`,
      ``,
      `# HELP http_request_duration_ms API request latency summary.`,
      `# TYPE http_request_duration_ms summary`,
      `http_request_duration_ms{quantile="0.5"} ${s.api.latencyMs.p50}`,
      `http_request_duration_ms{quantile="0.95"} ${s.api.latencyMs.p95}`,
      `http_request_duration_ms{quantile="0.99"} ${s.api.latencyMs.p99}`,
      `http_request_duration_ms_count ${s.api.latencyMs.count}`,
      `http_request_duration_ms_sum ${s.api.latencyMs.sum}`,
      ``,
      `# HELP ws_active_connections Current active WebSocket connections.`,
      `# TYPE ws_active_connections gauge`,
      `ws_active_connections ${s.websocket.activeConnections}`,
      ``,
      `# HELP ws_connections_total Total WebSocket connections established.`,
      `# TYPE ws_connections_total counter`,
      `ws_connections_total ${s.websocket.successfulConnections}`,
      ``,
      `# HELP redis_pubsub_propagation_ms Latency between publish and receive.`,
      `# TYPE redis_pubsub_propagation_ms summary`,
      `redis_pubsub_propagation_ms{quantile="0.5"} ${s.redis.propagationLatencyMs.p50}`,
      `redis_pubsub_propagation_ms{quantile="0.95"} ${s.redis.propagationLatencyMs.p95}`,
      `redis_pubsub_propagation_ms{quantile="0.99"} ${s.redis.propagationLatencyMs.p99}`,
      ``,
      `# HELP db_queries_total Total database queries executed.`,
      `# TYPE db_queries_total counter`,
      `db_queries_total ${s.database.totalQueries}`,
      `db_slow_queries_total ${s.database.slowQueries}`,
      `db_query_duration_ms{quantile="0.5"} ${s.database.queryLatencyMs.p50}`,
      `db_query_duration_ms{quantile="0.95"} ${s.database.queryLatencyMs.p95}`,
      `db_query_duration_ms{quantile="0.99"} ${s.database.queryLatencyMs.p99}`,
    ];
    return lines.join("\n") + "\n";
  }

  reset(): void {
    this.apiLatency.reset();
    this.apiRequestsTotal.reset();
    this.apiRequests2xx.reset();
    this.apiRequests3xx.reset();
    this.apiRequests4xx.reset();
    this.apiRequests5xx.reset();
    this.endpointLatency.clear();

    this.wsActiveConnections.reset();
    this.wsConnectionAttempts.reset();
    this.wsSuccessfulConnections.reset();
    this.wsRejectedConnections.reset();
    this.wsDisconnects.reset();
    this.wsReconnectAttempts.reset();
    this.wsDisconnectReasons.clear();

    this.redisPubSubLatency.reset();
    this.redisPublishedTotal.reset();
    this.redisPublishFailures.reset();
    this.redisMessagesReceivedTotal.reset();

    this.dbQueryLatency.reset();
    this.dbQueriesTotal.reset();
    this.dbSlowQueries.reset();
    this.dbQueryErrors.reset();
    this.dbModelQueries.clear();

    this.startTime = Date.now();
  }
}

export const metrics = new MetricsRegistry();
