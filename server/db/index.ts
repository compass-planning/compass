/**
 * server/db/index.ts
 *
 * Dual-jurisdiction database routing.
 *
 * Env vars:
 *   DATABASE_URL_CA  — Canadian Postgres (required)
 *   DATABASE_URL_US  — US Postgres (falls back to CA if unset — safe for local dev)
 *   DATABASE_URL     — legacy fallback for both (backwards compat)
 *
 * All existing route files continue to `import { db } from "../db/index.js"` unchanged.
 * The exported `db` is a Proxy that reads AsyncLocalStorage to route to the correct
 * drizzle instance on every method call — fully transparent.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle }            from "drizzle-orm/node-postgres";
import pg                     from "pg";
import * as schema            from "../../shared/schema.js";

// ── Connection strings ─────────────────────────────────────────────────────────
const urlCA = process.env.DATABASE_URL_CA ?? process.env.DATABASE_URL;
const urlUS = process.env.DATABASE_URL_US ?? urlCA;   // falls back to CA if US not provisioned yet

if (!urlCA) throw new Error("DATABASE_URL_CA (or DATABASE_URL) is required");

// ── Pools ──────────────────────────────────────────────────────────────────────
export const poolCA = new pg.Pool({ connectionString: urlCA });
export const poolUS = new pg.Pool({ connectionString: urlUS! });

// ── Drizzle instances ──────────────────────────────────────────────────────────
const _dbCA = drizzle(poolCA, { schema });
const _dbUS = drizzle(poolUS, { schema });

// ── Jurisdiction context (AsyncLocalStorage) ───────────────────────────────────
export const jurisdictionStore = new AsyncLocalStorage<"CA" | "US">();

/** Resolve the correct drizzle instance for a given jurisdiction. */
export function getDb(jurisdiction?: "CA" | "US") {
  const j = jurisdiction ?? jurisdictionStore.getStore() ?? "CA";
  return j === "US" ? _dbUS : _dbCA;
}

/**
 * Transparent proxy — all existing `import { db }` work with zero changes.
 * Every property access is intercepted and forwarded to the context-appropriate instance.
 */
export const db = new Proxy(_dbCA, {
  get(_target, prop) {
    return (getDb() as any)[prop as string];
  },
});

/** Legacy named export used by server/index.ts migrations */
export const pool = poolCA;
