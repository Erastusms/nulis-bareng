import { NextRequest, NextResponse } from "next/server";
import { env } from "@/config/env";
import { siteConfig } from "@/config/site";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { db } from "@/server/db/client";
import { getRedisClient } from "@/server/redis/redis-client";

interface HealthCheckDetails {
  database: "healthy" | "unhealthy";
  redis: "healthy" | "unhealthy" | "disabled";
}

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  service: string;
  timestamp: string;
  environment: string;
  uptimeSeconds: number;
  checks?: HealthCheckDetails;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const checkType = searchParams.get("type") || "readiness";

  const baseData: HealthStatus = {
    status: "ok",
    service: siteConfig.name,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
  };

  // Simple Liveness probe: returns immediate 200 if process is responsive
  if (checkType === "liveness") {
    const response: ApiSuccessResponse<HealthStatus> = {
      success: true,
      data: baseData,
    };
    return NextResponse.json(response, { status: 200 });
  }

  // Readiness probe: verifies critical dependencies (PostgreSQL & Redis)
  const checks: HealthCheckDetails = {
    database: "healthy",
    redis: "disabled",
  };

  let isHealthy = true;

  // 1. Check PostgreSQL
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "healthy";
  } catch {
    checks.database = "unhealthy";
    isHealthy = false;
  }

  // 2. Check Redis (if enabled)
  if (process.env.ENABLE_REDIS === "true") {
    try {
      const redis = getRedisClient();
      if (redis) {
        const pingResult = await Promise.race([
          redis.ping(),
          new Promise<string>((_, reject) =>
            setTimeout(() => reject(new Error("Redis ping timeout")), 2000)
          ),
        ]);
        checks.redis = pingResult === "PONG" ? "healthy" : "unhealthy";
      } else {
        checks.redis = "unhealthy";
      }
    } catch {
      checks.redis = "unhealthy";
      // If Redis is configured as required, mark readiness degraded/unhealthy
      isHealthy = false;
    }
  }

  const healthData: HealthStatus = {
    ...baseData,
    status: isHealthy ? "ok" : "error",
    checks,
  };

  const statusCode = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      success: isHealthy,
      data: healthData,
    },
    { status: statusCode }
  );
}
