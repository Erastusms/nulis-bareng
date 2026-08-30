import { NextRequest, NextResponse } from "next/server";
import { metrics } from "@/server/observability/metrics";
import { successResponse } from "@/server/api/route-handler";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "";
  const accept = request.headers.get("accept") || "";

  if (format === "prometheus" || accept.includes("text/plain")) {
    return new NextResponse(metrics.toPrometheus(), {
      status: 200,
      headers: {
        "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  const snapshot = metrics.getSnapshot();
  return successResponse(snapshot, 200);
}
