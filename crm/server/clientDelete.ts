import { pool } from "./db";

const q = (id: string) => `"${id.replace(/"/g, '""')}"`;

/**
 * Permanently deletes a client and everything hanging off it, in one transaction.
 * Child tables are discovered from the live schema (every table with a client_id column), so tables added
 * later are covered automatically. Plan and meeting children are removed first; audit rows are kept with the
 * client reference cleared; links from other records (spouse, converted lead, linked staff) are nulled.
 */
export async function deleteClientCascade(clientId: number): Promise<void> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const cols = await c.query(
      `SELECT table_name, column_name FROM information_schema.columns
        WHERE table_schema = current_schema() AND column_name IN ('client_id','plan_id','meeting_id')`,
    );
    const byCol = (name: string) => cols.rows.filter(r => r.column_name === name).map(r => r.table_name as string);
    const clientTables = byCol("client_id").filter(t => !["clients", "ai_audit_log", "carrier_files"].includes(t));

    // Keep the audit trail, drop the link to the deleted client.
    if (byCol("client_id").includes("ai_audit_log")) await c.query("UPDATE ai_audit_log SET client_id = NULL WHERE client_id = $1", [clientId]);

    for (const t of byCol("plan_id")) {
      await c.query(`DELETE FROM ${q(t)} WHERE plan_id IN (SELECT id FROM financial_plans WHERE client_id = $1)`, [clientId]);
    }
    for (const t of byCol("meeting_id")) {
      await c.query(`DELETE FROM ${q(t)} WHERE meeting_id IN (SELECT id FROM meetings WHERE client_id = $1)`, [clientId]);
    }
    if (byCol("client_id").includes("carrier_files")) await c.query("DELETE FROM carrier_files WHERE client_id = $1", [clientId]);
    for (const t of clientTables) await c.query(`DELETE FROM ${q(t)} WHERE client_id = $1`, [clientId]);

    await c.query("UPDATE clients SET spouse_id = NULL WHERE spouse_id = $1", [clientId]);
    await c.query("UPDATE leads SET converted_client_id = NULL WHERE converted_client_id = $1", [clientId]);
    await c.query("UPDATE staff SET linked_client_id = NULL WHERE linked_client_id = $1", [clientId]);
    await c.query("UPDATE staff SET linked_spouse_client_id = NULL WHERE linked_spouse_client_id = $1", [clientId]);
    await c.query("DELETE FROM clients WHERE id = $1", [clientId]);
    await c.query("COMMIT");
  } catch (e) {
    try { await c.query("ROLLBACK"); } catch { /* already aborted */ }
    throw e;
  } finally {
    c.release();
  }
}
