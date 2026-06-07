import { goalCreateSchema, goalPatchSchema } from "../../shared/validators.js";
import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";
import { eq, and } from "drizzle-orm";
import { financialGoals } from "../../shared/schema.js";

const r = Router();
r.use(isAuthenticated);

// ── Helper: extract all goal fields from request body ─────────────────────
function pickGoalFields(body: any) {
  const {
    goalType = "custom", title, targetAmount, currentAmount, targetDate,
    status = "in_progress", notes,
    // new projection fields
    cashflowType, targetYear, projectionImpact, priority,
    monthlyContribution, inflationAdjust, startYear, endYear,
    annualAmount, fundingSource,
  } = body;
  return {
    goalType,
    title,
    targetAmount:        (targetAmount != null && targetAmount !== "") ? String(targetAmount) : null,
    currentAmount:       (currentAmount != null && currentAmount !== "") ? String(currentAmount) : null,
    targetDate:          targetDate          || null,
    status,
    notes:               notes               || null,
    cashflowType:        cashflowType        || "savings_target",
    targetYear:          targetYear          ? Number(targetYear)          : null,
    projectionImpact:    projectionImpact    != null ? Boolean(projectionImpact)   : false,
    priority:            priority            ? Number(priority)            : 3,
    monthlyContribution: (monthlyContribution != null && monthlyContribution !== "") ? String(monthlyContribution) : null,
    inflationAdjust:     inflationAdjust     != null ? Boolean(inflationAdjust)    : true,
    startYear:           startYear           ? Number(startYear)           : null,
    endYear:             endYear             ? Number(endYear)             : null,
    annualAmount:        (annualAmount != null && annualAmount !== "") ? String(annualAmount) : null,
    fundingSource:       fundingSource       || "non_reg",
  };
}

r.get("/clients/:id/goals", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(financialGoals).where(eq(financialGoals.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/goals", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const fields = pickGoalFields(req.body);
  if (!fields.title) return res.status(400).json({ message: "Title is required" });
  const [row] = await (db.insert(financialGoals) as any).values({ clientId: cid, ...fields }).returning();
  res.status(201).json(row);
});

r.patch("/goals/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const fields = pickGoalFields(req.body);
  const [u] = await db.update(financialGoals)
    .set({ ...fields, updatedAt: new Date() } as any)
    .where(eq(financialGoals.id, ex.id)).returning();
  res.json(u);
});

r.delete("/goals/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(financialGoals).where(eq(financialGoals.id, ex.id));
  res.json({ ok: true });
});

// ── Goals projection impact summary ──────────────────────────────────────
// Returns all goals with projectionImpact=true, formatted as cashflow events
r.get("/clients/:id/goals/projection-events", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const goals = await db.select().from(financialGoals)
    .where(eq(financialGoals.clientId, cid));
  const events = goals
    .filter(g => g.projectionImpact)
    .flatMap(g => buildCashflowEvents(g));
  res.json(events);
});

function buildCashflowEvents(g: any): Array<{ year: number; amount: number; label: string }> {
  const events: Array<{ year: number; amount: number; label: string }> = [];
  const currentYear = new Date().getFullYear();

  if (g.cashflowType === "outflow" && g.targetYear) {
    events.push({ year: g.targetYear, amount: -Math.abs(parseFloat(g.targetAmount || "0")), label: g.title });
  } else if (g.cashflowType === "inflow" && g.targetYear) {
    events.push({ year: g.targetYear, amount: Math.abs(parseFloat(g.targetAmount || "0")), label: g.title });
  } else if (g.cashflowType === "recurring_expense" && g.startYear && g.endYear && g.annualAmount) {
    for (let yr = g.startYear; yr <= g.endYear; yr++) {
      events.push({ year: yr, amount: -Math.abs(parseFloat(g.annualAmount)), label: g.title });
    }
  }
  return events;
}

export { r as goalsRouter, buildCashflowEvents };

r.get("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(goalCheckIns)
    .where(eq(goalCheckIns.goalId, goal.id));
  res.json(rows);
});

r.post("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { currentAmount, notes, checkInDate } = req.body;
  const [row] = await (db.insert(goalCheckIns) as any).values({
    goalId: goal.id,
    currentAmount: currentAmount ?? "0",
    notes: notes ?? null,
    checkInDate: checkInDate ?? new Date().toISOString().split("T")[0],
  }).returning();
  // Update the goal's currentAmount to latest check-in
  await db.update(financialGoals)
    .set({ currentAmount, updatedAt: new Date() } as any)
    .where(eq(financialGoals.id, goal.id));
  res.status(201).json(row);
});

r.delete("/goal-check-ins/:id", async (req: AuthRequest, res: Response) => {
  await db.delete(goalCheckIns).where(eq(goalCheckIns.id, +req.params.id));
  res.json({ ok: true });
});

// ── Goal Check-ins ────────────────────────────────────────────────────────────
import { goalCheckIns } from "../../shared/schema.js";

r.get("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(goalCheckIns).where(eq(goalCheckIns.goalId, goal.id));
  res.json(rows);
});

r.post("/goals/:id/check-ins", async (req: AuthRequest, res: Response) => {
  const [goal] = await db.select({ id: financialGoals.id, clientId: financialGoals.clientId })
    .from(financialGoals).where(eq(financialGoals.id, +req.params.id));
  if (!goal || !await ownsClient(goal.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const { currentAmount, notes, checkInDate } = req.body;
  const [row] = await (db.insert(goalCheckIns) as any).values({
    goalId: goal.id,
    currentAmount: currentAmount ?? "0",
    notes: notes ?? null,
    checkInDate: checkInDate ?? new Date().toISOString().split("T")[0],
  }).returning();
  await db.update(financialGoals)
    .set({ currentAmount, updatedAt: new Date() } as any)
    .where(eq(financialGoals.id, goal.id));
  res.status(201).json(row);
});

r.delete("/goal-check-ins/:id", async (req: AuthRequest, res: Response) => {
  await db.delete(goalCheckIns).where(eq(goalCheckIns.id, +req.params.id));
  res.json({ ok: true });
});
