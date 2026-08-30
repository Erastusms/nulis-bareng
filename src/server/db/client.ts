import { PrismaClient } from "@prisma/client";
import { env } from "@/config/env";
import { appLogger } from "../observability/logger";
import { metrics } from "../observability/metrics";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Query performance instrumentation middleware
  client.$use(async (params, next) => {
    const start = Date.now();
    const model = params.model || "raw";
    const action = params.action;
    let hasError = false;

    try {
      return await next(params);
    } catch (err) {
      hasError = true;
      throw err;
    } finally {
      const duration = Date.now() - start;
      const isSlow = duration > 100; // Slow query threshold: 100ms
      metrics.recordDbQuery(model, action, duration, isSlow, hasError);

      if (isSlow) {
        appLogger.warn("db.query.slow", {
          duration,
          meta: { model, action },
        });
      }
    }
  });

  return client;
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export type DatabaseClient = typeof db;

/**
 * Gracefully disconnects the Prisma database client.
 */
export async function disconnectDb(): Promise<void> {
  try {
    await db.$disconnect();
    appLogger.info("Database client disconnected cleanly");
  } catch (err) {
    appLogger.error("Error disconnecting database client", err);
  }
}
