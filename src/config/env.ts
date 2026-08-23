import { z } from "zod";

/**
 * Server-only environment variables schema.
 */
export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters long"),
  AUTH_URL: z.string().url().optional(),
  APP_URL: z.string().url().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  INVITATION_EMAIL_FROM: z.string().min(1).default("NulisBareng <no-reply@example.com>"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_SECURE: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

/**
 * Client-accessible environment variables schema.
 * All variables MUST be prefixed with `NEXT_PUBLIC_`.
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_NAME: z.string().min(1).default("NulisBareng"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:3000/api"),
  NEXT_PUBLIC_ENABLE_REALTIME: z
    .string()
    .transform((val) => val === "true")
    .default("false"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type AppEnv = ClientEnv & Partial<ServerEnv>;

export function validateEnv(isServerOverride?: boolean): ClientEnv & ServerEnv {
  const isServer = isServerOverride ?? typeof window === "undefined";

  const clientParsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000",
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_ENABLE_REALTIME: process.env.NEXT_PUBLIC_ENABLE_REALTIME,
  });

  if (!clientParsed.success) {
    console.error(
      "❌ Invalid client environment variables:",
      clientParsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid client environment configuration.");
  }

  if (isServer) {
    const serverParsed = serverEnvSchema.safeParse({
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL,
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_URL: process.env.AUTH_URL,
      APP_URL: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
      LOG_LEVEL: process.env.LOG_LEVEL,
      INVITATION_EMAIL_FROM: process.env.INVITATION_EMAIL_FROM,
      SMTP_HOST: process.env.SMTP_HOST,
      SMTP_PORT: process.env.SMTP_PORT,
      SMTP_USER: process.env.SMTP_USER,
      SMTP_PASSWORD: process.env.SMTP_PASSWORD,
      SMTP_SECURE: process.env.SMTP_SECURE,
    });

    if (!serverParsed.success) {
      console.error(
        "❌ Invalid server environment variables:",
        serverParsed.error.flatten().fieldErrors
      );
      throw new Error("Invalid server environment configuration.");
    }

    return {
      ...clientParsed.data,
      ...serverParsed.data,
    };
  }

  // On client, mock/empty server values that won't be accessible
  return {
    ...clientParsed.data,
    NODE_ENV: (process.env.NODE_ENV as "development" | "test" | "production") || "development",
    DATABASE_URL: "",
    AUTH_SECRET: "",
    LOG_LEVEL: "info",
    INVITATION_EMAIL_FROM: "NulisBareng <no-reply@example.com>",
    SMTP_HOST: "localhost",
    SMTP_PORT: 1025,
    SMTP_USER: undefined,
    SMTP_PASSWORD: undefined,
    SMTP_SECURE: false,
  };
}

export const env = validateEnv();
