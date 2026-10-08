/**
 * server/routes/privacy.ts
 *
 * PIPEDA user-facing privacy controls.
 *
 *   GET  /api/privacy/consent     — current consent preferences
 *   PUT  /api/privacy/consent     — update consent preferences
 *   GET  /api/privacy/export      — right-to-access: full JSON export of caller's data
 *   POST /api/privacy/erasure     — right-to-erasure: schedule 30-day purge
 *   GET  /api/privacy/retention   — data retention policy for this account
 *
 * All routes require authentication. The audit log is written for every
 * consent change and for data export / erasure requests.
 */

import { Router, type Response } from "express";
import { db } from "../db/index.js";
import {
  users,
  clients,
  financialPlans,
  auditLog,
} from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { z } from "zod";

const r = Router();
r.use(isAuthenticated);

// ── helpers ───────────────────────────────────────────────────────────────────

async function writeAudit(
  userId: number,
  userEmail: string,
  action: string,
  resourceType: string,
  req: AuthRequest,
) {
  try {
    await db.insert(auditLog).values({
      userId,
      userEmail,
      action,
      resourceType,
      ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      userAgent: req.headers["user-agent"],
      outcome: "success",
    } as any);
  } catch {
    // audit failures must never block the user-facing operation
  }
}

const consentSchema = z.object({
  consentDataProcessing: z.boolean().optional(),
  consentMarketing: z.boolean().optional(),
  consentCrmSharing: z.boolean().optional(),
});

const erasureSchema = z.object({
  reason: z.string().max(1000).optional(),
});

// ── GET /api/privacy/consent ──────────────────────────────────────────────────
r.get("/consent", async (req: AuthRequest, res: Response) => {
  const [u] = await db
    .select({
      consentDataProcessing: users.consentDataProcessing,
      consentMarketing: users.consentMarketing,
      consentCrmSharing: users.consentCrmSharing,
      consentUpdatedAt: users.consentUpdatedAt,
    })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });
  res.json(u);
});

// ── PUT /api/privacy/consent ──────────────────────────────────────────────────
r.put("/consent", async (req: AuthRequest, res: Response) => {
  const parsed = consentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload", errors: parsed.error.issues });

  const patch: Record<string, unknown> = { consentUpdatedAt: new Date() };
  const { consentDataProcessing, consentMarketing, consentCrmSharing } = parsed.data;
  if (consentDataProcessing !== undefined) patch.consentDataProcessing = consentDataProcessing;
  if (consentMarketing !== undefined) patch.consentMarketing = consentMarketing;
  if (consentCrmSharing !== undefined) patch.consentCrmSharing = consentCrmSharing;

  await db.update(users).set(patch as any).where(eq(users.id, req.userId!));

  const [u] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  await writeAudit(
    req.userId!,
    u?.email ?? "",
    "consent.update",
    "consent",
    req,
  );

  res.json({ ...patch, ok: true });
});

// ── GET /api/privacy/export ───────────────────────────────────────────────────
// PIPEDA s.4.9 Right of Access — returns all data held about the caller.
r.get("/export", async (req: AuthRequest, res: Response) => {
  const [u] = await db
    .select()
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });

  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.userId, req.userId!));

  const planRows = await db
    .select()
    .from(financialPlans)
    .where(eq(financialPlans.userId, req.userId!));

  // Strip sensitive server-side columns before export
  const { passwordHash, totpSecret, securityAnswerHash, ...publicUser } = u as any;

  await writeAudit(req.userId!, u.email, "pipeda.export", "account", req);

  res.json({
    generatedAt: new Date().toISOString(),
    account: publicUser,
    clients: clientRows,
    financialPlans: planRows,
    consent: {
      dataProcessing: u.consentDataProcessing,
      marketing: u.consentMarketing,
      crmSharing: u.consentCrmSharing,
      updatedAt: u.consentUpdatedAt,
    },
  });
});

// ── POST /api/privacy/erasure ─────────────────────────────────────────────────
// PIPEDA s.4.3.8 Right to erasure — schedules a 30-day hard purge.
r.post("/erasure", async (req: AuthRequest, res: Response) => {
  const parsed = erasureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid payload" });

  const now = new Date();
  const purgeAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

  const [u] = await db
    .select({ email: users.email, purgeRequestedAt: users.purgeRequestedAt })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });

  if (u.purgeRequestedAt) {
    return res.status(409).json({
      message: "An erasure request is already on file.",
      purgeAt: u.purgeRequestedAt,
    });
  }

  await db
    .update(users)
    .set({ purgeRequestedAt: now, purgeAt } as any)
    .where(eq(users.id, req.userId!));

  await writeAudit(req.userId!, u.email, "pipeda.erasure", "account", req);

  res.json({
    ok: true,
    purgeAt: purgeAt.toISOString(),
    message:
      "Erasure request recorded. Your account and all associated data will be permanently deleted after the 30-day retention window.",
  });
});

// ── GET /api/privacy/retention ────────────────────────────────────────────────
r.get("/retention", async (req: AuthRequest, res: Response) => {
  const [u] = await db
    .select({
      purgeRequestedAt: users.purgeRequestedAt,
      purgeAt: users.purgeAt,
    })
    .from(users)
    .where(eq(users.id, req.userId!))
    .limit(1);

  if (!u) return res.status(404).json({ message: "User not found" });

  res.json({
    policy: "30_day_purge_on_request",
    controller: "self",
    status: u.purgeRequestedAt ? "pending_purge" : "active",
    purgeRequestedAt: u.purgeRequestedAt ?? null,
    purgeAt: u.purgeAt ?? null,
  });
});

export { r as privacyRouter };
