import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

/**
 * Compass CRM shares the Compass Postgres database but keeps every table in its own
 * Postgres schema ("crm"), so its tables (clients, staff, sessions, ...) never collide
 * with Compass Planning's tables in "public".
 *
 * Connection string: CRM_DATABASE_URL, else Compass's DATABASE_URL_CA / DATABASE_URL.
 */
export const CRM_SCHEMA = "crm";

export const crmDatabaseUrl =
  process.env.CRM_DATABASE_URL ?? process.env.DATABASE_URL_CA ?? process.env.DATABASE_URL;

if (!crmDatabaseUrl) {
  throw new Error("CRM_DATABASE_URL (or DATABASE_URL_CA / DATABASE_URL) must be set.");
}

/** Pool whose every connection resolves unqualified table names in the "crm" schema first. */
export function createCrmPool(max = 5) {
  const p = new Pool({
    connectionString: crmDatabaseUrl,
    max,                    // Conservative — Fly pgBouncer limits connections
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  // Set per connection (not via the startup "options" parameter, which poolers can reject).
  p.on("connect", (client) => {
    client.query(`SET search_path TO ${CRM_SCHEMA}, public`).catch(() => {});
  });
  return p;
}

export const pool = createCrmPool(5);
export const db = drizzle(pool, { schema });
