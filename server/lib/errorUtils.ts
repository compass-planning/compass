/**
 * server/lib/errorUtils.ts
 *
 * Safe error handling utilities for HTTP responses.
 *
 * In production, raw error messages are suppressed to prevent leaking
 * internal details (DB column names, constraint names, file paths, etc.).
 * In development, real messages pass through for easier debugging.
 *
 * Usage:
 *   import { safeMsg, AppError } from "../lib/errorUtils.js";
 *
 *   // In catch blocks:
 *   res.status(500).json({ message: safeMsg(e) });
 *
 *   // For intentional user-facing errors:
 *   throw new AppError("Client not found", 404);
 */

const IS_PROD = process.env.NODE_ENV === "production";

/**
 * AppError — throw this when you want a specific message to reach the client
 * even in production. All other errors get a generic fallback in prod.
 *
 * @example
 *   throw new AppError("Invalid subscription tier", 400);
 *   throw new AppError("Client not found", 404);
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Returns a safe error message suitable for HTTP responses.
 *
 * - AppError messages always pass through (they're intentionally user-facing).
 * - In development, all error messages pass through for easier debugging.
 * - In production, unknown errors return the fallback string only.
 */
export function safeMsg(
  e: unknown,
  fallback = "An internal error occurred. Please try again.",
): string {
  if (e instanceof AppError) return e.message;
  if (!IS_PROD && e instanceof Error) return e.message;
  return fallback;
}

/**
 * Returns the appropriate HTTP status code from an error.
 * Falls back to 500 for unknown errors.
 */
export function safeStatus(e: unknown): number {
  if (e instanceof AppError) return e.statusCode;
  return 500;
}
