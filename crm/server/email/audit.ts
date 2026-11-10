import crypto from "crypto";
import { pool } from "../db";
import { logger } from "../logger";

export type EmailAuditAction =
  | "message.view"
  | "message.send"
  | "message.reply"
  | "message.forward"
  | "message.delete"
  | "attachment.download"
  | "account.connect"
  | "account.disconnect"
  | "zoom.connect"
  | "zoom.disconnect";

export interface EmailAuditEntry {
  companyId: number | null;
  actorType: "staff" | "host";
  actorId: number;
  action: EmailAuditAction;
  provider?: string | null;
  targetId?: string | null;
  /** Metadata only. Never put message bodies, tokens or attachment contents here. */
  detail?: Record<string, unknown>;
  ip?: string | null;
}

/**
 * Append-only, tamper-evident audit trail: each row stores the hash of the previous row for the
 * same company, so editing or deleting a row breaks the chain (see verifyEmailAuditChain).
 * Failures are logged but never block the user's action.
 */
export async function logEmailAudit(e: EmailAuditEntry): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialise writers per company so the chain stays linear.
    await client.query("SELECT pg_advisory_xact_lock($1)", [900000 + (e.companyId ?? 0)]);
    const prev = await client.query(
      "SELECT hash FROM email_audit_logs WHERE company_id IS NOT DISTINCT FROM $1 ORDER BY id DESC LIMIT 1",
      [e.companyId],
    );
    const prevHash: string = prev.rows[0]?.hash ?? "GENESIS";
    const createdAt = new Date().toISOString();
    const detail = e.detail ?? {};
    const hash = crypto
      .createHash("sha256")
      .update(
        JSON.stringify([prevHash, e.companyId, e.actorType, e.actorId, e.action, e.provider ?? null, e.targetId ?? null, detail, createdAt]),
      )
      .digest("hex");
    await client.query(
      `INSERT INTO email_audit_logs (company_id, actor_type, actor_id, action, provider, target_id, detail, ip, prev_hash, hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [e.companyId, e.actorType, e.actorId, e.action, e.provider ?? null, e.targetId ?? null, JSON.stringify(detail), e.ip ?? null, prevHash, hash, createdAt],
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err: err instanceof Error ? err.message : String(err), action: e.action }, "email audit write failed");
  } finally {
    client.release();
  }
}

function chainHash(prevHash: string, r: Record<string, any>, createdAtIso: string): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify([prevHash, r.company_id, r.actor_type, r.actor_id, r.action, r.provider ?? null, r.target_id ?? null, r.detail ?? {}, createdAtIso]))
    .digest("hex");
}

/** Recomputes a company's audit chain. Returns the id of the first broken row, or null if intact. */
export async function verifyEmailAuditChain(companyId: number | null): Promise<{ rows: number; brokenAtId: number | null }> {
  const { rows } = await pool.query(
    "SELECT * FROM email_audit_logs WHERE company_id IS NOT DISTINCT FROM $1 ORDER BY id",
    [companyId],
  );
  let prev = "GENESIS";
  for (const r of rows) {
    if (r.prev_hash !== prev || chainHash(prev, r, new Date(r.created_at).toISOString()) !== r.hash) {
      return { rows: rows.length, brokenAtId: r.id };
    }
    prev = r.hash;
  }
  return { rows: rows.length, brokenAtId: null };
}
