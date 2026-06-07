/**
 * server/logger.ts
 * Structured logging with pino + request correlation IDs.
 * Every log line includes: level, time, correlationId, msg, and any extra fields.
 * Correlation ID is available on req.id throughout the request lifecycle.
 */
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "node:crypto";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "production" ? "info" : "debug"),
  // Pretty-print in dev, JSON in prod (picked up by Fly.io log aggregator)
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
    : undefined,
  redact: {
    // Never log these fields — PIPEDA PII protection
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.newPassword",
      "req.body.currentPassword",
      "req.body.securityAnswer",
      "req.body.securityAnswerHash",
    ],
    censor: "[REDACTED]",
  },
});

export const httpLogger = pinoHttp({
  logger,
  // Assign a UUID correlation ID to every request
  genReqId: (req, res) => {
    const existing = req.headers["x-correlation-id"];
    const id = (Array.isArray(existing) ? existing[0] : existing) ?? randomUUID();
    res.setHeader("X-Correlation-ID", id);
    return id;
  },
  // Suppress noisy health check logs
  autoLogging: {
    ignore: (req) => req.url === "/api/health",
  },
  // Sanitize what gets logged from requests
  serializers: {
    req: (req) => ({
      id:     req.id,
      method: req.method,
      url:    req.url,
      // Never log body — may contain PII
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400)        return "warn";
    return "info";
  },
});

/** Convenience: get correlation ID from request for use in route-level logs */
export function correlationId(req: any): string {
  return req.id ?? "no-correlation-id";
}
