/**
 * server/logger.ts
 *
 * Central pino logger for Compass CRM.
 *
 * Production (NODE_ENV=production):
 *   JSON output to stdout — consumed by Fly.io log aggregator or CloudWatch.
 *   Structured JSON enables log querying, alerting, and correlation.
 *
 * Development:
 *   Pretty-printed output via pino-pretty — human-readable with colours.
 *
 * Security:
 *   `redact` strips sensitive fields even if accidentally passed to a log call.
 *   Never log passwords, hashes, TOTP secrets, or session secrets.
 *
 * Usage:
 *   import { logger } from "../logger";
 *
 *   logger.info("Client loaded");
 *   logger.info({ clientId: 42 }, "Client loaded");
 *   logger.error({ err }, "Failed to save projection");
 *   logger.warn({ staffId }, "Login attempt with no password set");
 *
 * Request-scoped child logger (attach to req in middleware):
 *   const reqLogger = logger.child({ requestId, method, path });
 *   req.log = reqLogger;
 */

import pino from "pino";
import { randomUUID } from "crypto";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: isDev ? "debug" : "info",

  // Production: clean JSON with ISO timestamps for log aggregators
  // Development: pretty-printed with colours via pino-pretty
  ...(isDev
    ? {
        transport: {
          target:  "pino-pretty",
          options: {
            colorize:      true,
            translateTime: "SYS:HH:MM:ss",
            ignore:        "pid,hostname,service,env",
            messageFormat: "[{service}] {msg}",
          },
        },
      }
    : {
        formatters: {
          level: (label: string) => ({ level: label }),
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),

  // Base fields included in every log line
  base: {
    service: "compass-crm",
    env:     process.env.NODE_ENV ?? "development",
  },

  // Redact sensitive fields — these are stripped even if accidentally logged.
  // PIPEDA compliance: passwords and secrets must never appear in log storage.
  redact: {
    paths: [
      "password",
      "passwordHash",
      "newPassword",
      "currentPassword",
      "totpSecret",
      "codeHash",
      "sessionSecret",
      "authorization",
      "cookie",
      "*.password",
      "*.passwordHash",
      "*.totpSecret",
    ],
    censor: "[REDACTED]",
  },
});

// ── Request-scoped child logger factory ───────────────────────────────────────
// Creates a child logger with request metadata bound to every line.
// Use in the request middleware in index.ts:
//   req.log = createRequestLogger(req);
export function createRequestLogger(req: {
  method:  string;
  path:    string;
  ip?:     string;
  headers: Record<string, string | string[] | undefined>;
}): pino.Logger {
  return logger.child({
    requestId: randomUUID(),
    method:    req.method,
    path:      req.path,
    ip:        req.ip,
    // Never log User-Agent (PII risk) or Authorization header
  });
}

// ── Augment Express Request type ──────────────────────────────────────────────
declare global {
  namespace Express {
    interface Request {
      log: pino.Logger;
      requestId: string;
    }
  }
}
