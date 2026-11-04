import { pool, CRM_SCHEMA } from "./db";
import { logger } from "./logger";
import { BASELINE_SQL } from "./baselineSql";

/**
 * Creates the "crm" Postgres schema and (on first run only) all CRM tables inside it.
 * Idempotent and safe with several machines starting at once (advisory lock).
 * Additive changes after the first run belong in `scripts/reconcile-schema.ts`.
 */
export async function ensureCrmSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(7461001)");
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${CRM_SCHEMA}`);
    const { rows } = await client.query(
      `SELECT to_regclass('${CRM_SCHEMA}.staff') AS t`,
    );
    if (rows[0]?.t) {
      // One-time upgrade: Pipeline and Analytics used to be off by default. Switch them on for
      // existing companies once (detected by the old column default), then never touch them again.
      const d = await client.query(
        `SELECT column_default FROM information_schema.columns
         WHERE table_schema='${CRM_SCHEMA}' AND table_name='companies' AND column_name='module_pipeline'`,
      );
      if (d.rows[0]?.column_default === "false") {
        await client.query(`ALTER TABLE ${CRM_SCHEMA}.companies ALTER COLUMN module_pipeline SET DEFAULT true`);
        await client.query(`ALTER TABLE ${CRM_SCHEMA}.companies ALTER COLUMN module_analytics SET DEFAULT true`);
        await client.query(`UPDATE ${CRM_SCHEMA}.companies SET module_pipeline = true, module_analytics = true`);
        logger.info("[crm] enabled Pipeline and Analytics modules for existing companies");
      }
      return;
    }
    logger.info("[crm] first run — creating CRM tables in schema 'crm'");
    await client.query("BEGIN");
    try {
      await client.query(`SET LOCAL search_path TO ${CRM_SCHEMA}, public`);
      await client.query(BASELINE_SQL);
      await client.query("COMMIT");
      logger.info("[crm] schema created");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(7461001)").catch(() => {});
    client.release();
  }
}
