/**
 * server/routes/audit.ts
 *
 * PIPEDA audit log viewer — GA-only access.
 *
 *   GET  /api/audit                    — paginated audit log
 *   GET  /api/audit/transfers          — external AI transfers only
 *   GET  /api/audit/client/:clientId   — all events for a specific client
 *   GET  /api/audit/export             — CSV export (for breach response / OPC requests)
 */
import type { Response }   from "express";
import { Router }           from "express";
import { db }               from "../db/index.js";
import { auditLog, users }  from "../../shared/schema.js";
import { desc, eq, and, gte, lte, inArray } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";

const r = Router();
r.use(isAuthenticated);

// ── GA-only guard ─────────────────────────────────────────────────────────────
async function requireGA(req: AuthRequest, res: Response): Promise<boolean> {
  const [me] = await db.select({ role: users.role }).from(users).where(eq(users.id, req.userId!)).limit(1);
  if (!me || me.role !== "ga") {
    res.status(403).json({ message: "Audit log access requires GA role" });
    return false;
  }
  return true;
}

// ── GET /api/audit ────────────────────────────────────────────────────────────
// Paginated full audit log. Query params: page, limit, action, processor, from, to
r.get("/", async (req: AuthRequest, res: Response) => {
  if (!await requireGA(req, res)) return;
  try {
    const page      = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit     = Math.min(100, parseInt(req.query.limit as string) || 50);
    const offset    = (page - 1) * limit;

    const rows = await (db.select() as any)
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ page, limit, rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/audit/transfers ──────────────────────────────────────────────────
// External AI transfers only — the PIPEDA-critical ones
r.get("/transfers", async (req: AuthRequest, res: Response) => {
  if (!await requireGA(req, res)) return;
  try {
    const limit  = Math.min(200, parseInt(req.query.limit as string) || 100);

    const rows = await (db.select() as any)
      .from(auditLog)
      .where(inArray(auditLog.externalProcessor as any, ["anthropic", "openai"]))
      .orderBy(desc(auditLog.createdAt))
      .limit(limit);

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/audit/client/:clientId ──────────────────────────────────────────
// All audit events for a specific client
r.get("/client/:clientId", async (req: AuthRequest, res: Response) => {
  if (!await requireGA(req, res)) return;
  try {
    const rows = await (db.select() as any)
      .from(auditLog)
      .where(eq(auditLog.clientId as any, +req.params.clientId))
      .orderBy(desc(auditLog.createdAt))
      .limit(500);

    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/audit/export ─────────────────────────────────────────────────────
// CSV export — for PIPEDA breach response / OPC audit requests
// Query params: from (YYYY-MM-DD), to (YYYY-MM-DD)
r.get("/export", async (req: AuthRequest, res: Response) => {
  if (!await requireGA(req, res)) return;
  try {
    const rows = await (db.select() as any)
      .from(auditLog)
      .orderBy(desc(auditLog.createdAt))
      .limit(10000);   // max 10k rows per export

    const headers = [
      "id","created_at","user_id","user_email","action","resource_type",
      "client_id","external_processor","data_categories","purpose_code",
      "record_count","ip_address","correlation_id","outcome","error_message"
    ];

    const escape = (v: any) => {
      if (v === null || v === undefined) return "";
      const s = String(v).replace(/"/g, '""');
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
    };

    const csv = [
      headers.join(","),
      ...rows.map((r: any) => headers.map(h => escape(r[h.replace(/_([a-z])/g, (_: any, c: string) => c.toUpperCase())])).join(","))
    ].join("\n");

    const date = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="pipeda-audit-${date}.csv"`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

export { r as auditRouter };
