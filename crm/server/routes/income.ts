/**
 * server/routes/income.ts
 * CRUD routes for structured income sources.
 * Mounted under /api in server/routes.ts.
 */
import { Router, Response } from "express";
import { db } from "../db";
import { incomeSources, insertIncomeSourceSchema } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { ownsClient } from "../fpUtils";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const r = Router();
r.use(isAuthenticated);

// ── GET all income sources for a client ─────────────────────────────────────
r.get("/clients/:id/income-sources", async (req: any, res: Response) => {
  const cid = +req.params.id;
  const staffId = req.session?.staffId ?? 0;
  if (!(await ownsClient(cid, staffId))) return res.status(404).json({ message: "Not found" });
  try {
    const rows = await db.select().from(incomeSources).where(eq(incomeSources.clientId, cid));
    return res.json(rows);
  } catch (e: any) {
    // Table may not exist yet — return empty array so UI doesn't crash
    if (e?.message?.includes("income_sources") || e?.code === "42P01") return res.json([]);
    return res.status(500).json({ message: e?.message ?? "Internal error" });
  }
});

// ── POST create a new income source ─────────────────────────────────────────
r.post("/clients/:id/income-sources", async (req: any, res: Response) => {
  const cid = +req.params.id;
  const staffId = req.session?.staffId ?? 0;
  if (!(await ownsClient(cid, staffId))) return res.status(404).json({ message: "Not found" });

  const parsed = insertIncomeSourceSchema.safeParse({ ...req.body, clientId: cid });
  if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

  try {
    const [row] = await db.insert(incomeSources).values(parsed.data).returning();
    return res.status(201).json(row);
  } catch (e: any) {
    if (e?.code === "42P01") return res.status(503).json({ message: "Migration pending — run add_income_sources.sql first" });
    return res.status(500).json({ message: e?.message ?? "Internal error" });
  }
});

// ── PUT update an existing income source ─────────────────────────────────────
r.put("/clients/:id/income-sources/:sourceId", async (req: any, res: Response) => {
  const cid      = +req.params.id;
  const sourceId = +req.params.sourceId;
  const staffId  = req.session?.staffId ?? 0;
  if (!(await ownsClient(cid, staffId))) return res.status(404).json({ message: "Not found" });

  const patchSchema = insertIncomeSourceSchema.partial().omit({ clientId: true });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.flatten() });

  try {
    const [updated] = await db
      .update(incomeSources)
      .set(parsed.data)
      .where(and(eq(incomeSources.id, sourceId), eq(incomeSources.clientId, cid)))
      .returning();

    if (!updated) return res.status(404).json({ message: "Income source not found" });
    return res.json(updated);
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? "Internal error" });
  }
});

// ── DELETE an income source ───────────────────────────────────────────────────
r.delete("/clients/:id/income-sources/:sourceId", async (req: any, res: Response) => {
  const cid      = +req.params.id;
  const sourceId = +req.params.sourceId;
  const staffId  = req.session?.staffId ?? 0;
  if (!(await ownsClient(cid, staffId))) return res.status(404).json({ message: "Not found" });

  try {
    await db
      .delete(incomeSources)
      .where(and(eq(incomeSources.id, sourceId), eq(incomeSources.clientId, cid)));
    return res.status(204).end();
  } catch (e: any) {
    return res.status(500).json({ message: e?.message ?? "Internal error" });
  }
});

export { r as incomeRouter };
