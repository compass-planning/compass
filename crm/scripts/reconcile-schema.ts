/**
 * scripts/reconcile-schema.ts
 *
 * Additive-only schema reconciliation. Reads every column defined in the
 * Drizzle schema and runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for each.
 *
 * - Existing columns are skipped (IF NOT EXISTS).
 * - NEVER drops, renames, or retypes anything — safe to run against prod.
 * - NOT NULL is only applied when a literal default exists (so it can't fail
 *   on tables that already contain rows).
 * - Tables that don't exist in the DB are reported, not created.
 *
 * Run:  npx tsx scripts/reconcile-schema.ts
 *       npx tsx scripts/reconcile-schema.ts --dry-run   (print SQL only)
 */
import { createCrmPool } from "../server/db";
import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const DRY_RUN = process.argv.includes("--dry-run");

function literalDefault(col: any): string | null {
  if (!col.hasDefault) return null;
  const d = col.default;
  if (typeof d === "string") return `'${d.replace(/'/g, "''")}'`;
  if (typeof d === "number" || typeof d === "boolean") return String(d);
  // SQL/function defaults (e.g. now(), gen_random_uuid()) — skip; add nullable.
  return null;
}

function buildAlter(tableName: string, col: any): string {
  const type = col.getSQLType();
  const def = literalDefault(col);
  let stmt = `ALTER TABLE "${tableName}" ADD COLUMN IF NOT EXISTS "${col.name}" ${type}`;
  if (def !== null) stmt += ` DEFAULT ${def}`;
  // Only enforce NOT NULL when we can backfill existing rows via a default.
  if (col.notNull && def !== null) stmt += ` NOT NULL`;
  return stmt + ";";
}

async function main() {
  const pool = DRY_RUN ? null : createCrmPool(2);

  const tables = Object.values(schema).filter((v) => is(v, PgTable)) as PgTable[];
  console.log(`Found ${tables.length} tables in schema.\n`);

  let added = 0;
  const missingTables: string[] = [];

  for (const table of tables) {
    const { name, columns } = getTableConfig(table);
    for (const col of columns) {
      const sql = buildAlter(name, col);
      if (DRY_RUN) {
        console.log(sql);
        continue;
      }
      try {
        await pool!.query(sql);
        added++; // counts attempts; IF NOT EXISTS makes existing ones no-ops
      } catch (err: any) {
        if (err?.code === "42P01") {
          // undefined_table — the table itself is missing
          if (!missingTables.includes(name)) {
            missingTables.push(name);
            console.warn(`  ⚠ table "${name}" does not exist — needs db:push`);
          }
        } else {
          console.warn(`  ⚠ ${name}.${col.name}: ${err?.message}`);
        }
      }
    }
  }

  if (!DRY_RUN) {
    console.log(`\nReconcile complete. Processed ${added} column statements.`);
    if (missingTables.length) {
      console.log(`\nMissing tables (run \`npm run db:push\` to create these):`);
      missingTables.forEach((t) => console.log(`  - ${t}`));
    }
    await pool!.end();
  }
  process.exit(0);
}

main().catch((err) => {
  // Never block server startup — log and continue (mirrors migrate.ts philosophy).
  console.error("Reconcile warning (non-fatal):", err?.message || err);
  process.exit(0);
});
