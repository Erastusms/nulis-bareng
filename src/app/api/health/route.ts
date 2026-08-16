import { NextResponse } from "next/server";
import { env } from "@/config/env";
import { siteConfig } from "@/config/site";
import type { ApiSuccessResponse } from "@/lib/api/types";

interface HealthStatus {
  status: "ok" | "degraded" | "error";
  service: string;
  timestamp: string;
  environment: string;
  uptimeSeconds: number;
}

export async function GET() {
  const healthData: HealthStatus = {
    status: "ok",
    service: siteConfig.name,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    uptimeSeconds: Math.floor(process.uptime()),
  };

  const response: ApiSuccessResponse<HealthStatus> = {
    success: true,
    data: healthData,
  };

  return NextResponse.json(response, { status: 200 });
}
