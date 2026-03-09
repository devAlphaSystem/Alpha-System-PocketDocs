import "dotenv/config";
import { z } from "zod";

function parseTrustProxy(value) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "false") {
    return false;
  }

  if (normalized === "true") {
    return true;
  }

  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  const parts = String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return parts.length <= 1 ? parts[0] || false : parts;
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HOST: z.string().min(1).default("0.0.0.0"),
  TRUST_PROXY: z.string().default("1"),

  POCKETBASE_URL: z.string().url(),
  POCKETBASE_ADMIN_EMAIL: z.string().email(),
  POCKETBASE_ADMIN_PASSWORD: z.string().min(8),

  SESSION_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().optional().default(""),

  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "debug"]).default("info"),
  LOG_DIR: z.string().min(1).default("logs"),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(100),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900000),
  AUTH_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(1).default(10),

  SITE_NAME: z.string().min(1).default("PocketDocs"),
  SITE_URL: z.string().url().default("http://localhost:3000"),

  GITHUB_TOKEN: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const formatted = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n");
  throw new Error(`Environment validation failed:\n${formatted}`);
}

export const env = Object.freeze(parsed.data);
export const trustProxy = parseTrustProxy(parsed.data.TRUST_PROXY);
