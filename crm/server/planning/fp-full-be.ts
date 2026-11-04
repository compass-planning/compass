/**
 * fp-full-be.ts — Compass CRM port of Planning Suite's fp-full.ts
 *
 * Changes from Planning Suite original:
 *  1. Auth: req.userId → (req as any).user.staffId + companyId
 *  2. ownsClient(): replaced with companyId check against clients.companyId
 *  3. ownsPlan(): replaced with companyId check via financialPlans → clients
 *  4. financialPlans INSERT: removed userId field (not in BE schema)
 *  5. Import path: ../auth/index.js → BE auth middleware (isAuthenticated, denyHostUsers)
 *  6. financialGoals referenced — imported from BE schema (already exists)
 *
 * Mount in server/routes.ts:
 *   import { fpFullRouter } from "./planning/fp-full-be.js";
 *   app.use("/api", isAuthenticated, denyHostUsers, fpFullRouter);
 */

import { Router, Response, Request } from "express";
import { db } from "../db.js";
import {
  clients, financialPlans, financialGoals,
  netWorthEntries, retirementProjections, insuranceAnalyses,
  educationSavings, debtEntries, taxPlanningNotes, estatePlanningNotes,
  aiRecommendations, planAssumptions, simulationResults,
  planSnapshots, planStaleFlags, planActionItems,
} from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";

// ── BE auth helpers ───────────────────────────────────────────────────────────

function getUser(req: Request) {
  const u = (req as any).user;
  if (!u) throw Object.assign(new Error("Unauthenticated"), { status: 401 });
  return { staffId: u.staffId as number, companyId: u.companyId as number };
}

/** Verify a client belongs to the requesting user's company. Returns clientId or null. */
async function ownsClient(clientId: number, companyId: number): Promise<boolean> {
  const [row] = await db.select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
  return !!row;
}

/** Verify a plan belongs to the requesting user's company (via client). Returns plan row or null. */
async function ownsPlan(planId: number, companyId: number) {
  const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.id, planId));
  if (!plan) return null;
  const ok = await ownsClient(plan.clientId, companyId);
  return ok ? plan : null;
}

/** Strip undefined/null keys and dangerous fields before DB insert/update */
function safe(body: Record<string, unknown>): Record<string, unknown> {
  const DENY = new Set(["id", "clientId", "companyId", "advisorId", "userId", "createdAt", "updatedAt"]);
  return Object.fromEntries(
    Object.entries(body).filter(([k, v]) => !DENY.has(k) && v !== undefined)
  );
}

const r = Router();

// ── Plans ─────────────────────────────────────────────────────────────────────

r.get("/clients/:clientId/plans", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)));
});

r.post("/clients/:clientId/plans", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const [p] = await (db.insert(financialPlans) as any).values({
    clientId: cid,
    title: req.body.name ?? req.body.title ?? "Financial Plan",
    ...safe(req.body),
  }).returning();
  res.status(201).json(p);
});

r.get("/plans/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.id, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  res.json(p);
});

r.put("/plans/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  if (!await ownsPlan(+req.params.id, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const [u] = await db.update(financialPlans).set(safe(req.body)).where(eq(financialPlans.id, +req.params.id)).returning();
  res.json(u);
});

r.delete("/plans/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  if (!await ownsPlan(+req.params.id, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  await db.delete(financialPlans).where(eq(financialPlans.id, +req.params.id));
  res.json({ ok: true });
});

// ── Insurance Worksheet ───────────────────────────────────────────────────────

r.post("/clients/:clientId/insurance-worksheet", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  try {
    const formData = req.body.data ?? req.body;
    const [row] = await (db.insert(insuranceAnalyses) as any).values({
      clientId:                          cid,
      primaryName:                       formData.primaryName    ?? null,
      primaryAge:                        formData.primaryAge     ? parseInt(formData.primaryAge)  : null,
      spouseName:                        formData.spouseName     ?? null,
      spouseAge:                         formData.spouseAge      ? parseInt(formData.spouseAge)   : null,
      spouseAnnualIncome:                formData.spouseAnnualIncome ?? "0",
      annualIncome:                      formData.primaryAnnualIncome ?? "0",
      // BE column name mapping (via schemaAdapter)
      yearsOfIncomeNeeded:               formData.yearsToReplace   ? parseInt(formData.yearsToReplace)  : null,
      existingDisabilityCoverage:        formData.existingDisability         ?? "0",
      existingCriticalIllnessCoverage:   formData.existingCriticalIllness    ?? "0",
      calculationMethod:                 formData.method ?? "dime",
      worksheetData:                     formData,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[insurance-worksheet]", err);
    res.status(500).json({ message: "Failed to save" });
  }
});

// ── Tax Planning Notes ────────────────────────────────────────────────────────

r.get("/clients/:clientId/tax-planning-notes", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});

r.post("/clients/:clientId/tax-planning-notes", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(taxPlanningNotes) as any).values({
    clientId: cid, title: data.title || "Note", content: data.content || "",
    taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data,
  }).returning();
  res.status(201).json(row);
});

r.put("/tax-planning-notes/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/tax-planning-notes/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Planning Notes ─────────────────────────────────────────────────────

r.get("/clients/:clientId/estate-planning-notes", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)));
});

r.post("/clients/:clientId/estate-planning-notes", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(estatePlanningNotes) as any).values({
    clientId: cid, title: data.title || "Note", content: data.content || "",
    category: data.category || "general", ...data,
  }).returning();
  res.status(201).json(row);
});

r.put("/estate-planning-notes/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const [u] = await db.update(estatePlanningNotes).set(safe(req.body)).where(eq(estatePlanningNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/estate-planning-notes/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  await db.delete(estatePlanningNotes).where(eq(estatePlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Financial Planning Overview ───────────────────────────────────────────────

r.get("/clients/:clientId/financial-planning-overview", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const [nw, ret, ins, edu, debt, tax, estate, ai, fp] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationSavings).where(eq(educationSavings.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
    db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)),
    db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)),
    db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)),
    db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)),
  ]);
  const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  res.json({
    netWorth: assets - liabilities, totalAssets: assets, totalLiabilities: liabilities,
    totalDebt: debt.reduce((s, d) => s + Number(d.balance), 0),
    goals: fp.length,
    retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length,
    pendingRecommendations: ai.filter((a: any) => a.status === "pending").length,
  });
});

// ── Plan Assumptions ──────────────────────────────────────────────────────────

r.get("/plans/:planId/assumptions", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  const pid = +req.params.planId;
  const defaults = [
    { planId: pid, scenario: "base",       equityReturn: "0.07", equityVolatility: "0.15", bondReturn: "0.04", bondVolatility: "0.05", inflationMean: "0.02", inflationVolatility: "0.01", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "optimistic", equityReturn: "0.09", equityVolatility: "0.12", bondReturn: "0.05", bondVolatility: "0.04", inflationMean: "0.015", inflationVolatility: "0.008", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "stress",     equityReturn: "0.05", equityVolatility: "0.20", bondReturn: "0.03", bondVolatility: "0.07", inflationMean: "0.03",  inflationVolatility: "0.015", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
  ];
  for (const d of defaults) {
    const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions)
      .where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, d.scenario)));
    if (!ex) await (db.insert(planAssumptions) as any).values(d);
  }
  res.json(await db.select().from(planAssumptions).where(eq(planAssumptions.planId, pid)));
});

r.post("/plans/:planId/assumptions", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  const pid = +req.params.planId;
  const scenario = req.body.scenario ?? "base";
  const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions)
    .where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, scenario)));
  if (ex) {
    const [u] = await db.update(planAssumptions).set(safe(req.body)).where(eq(planAssumptions.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await (db.insert(planAssumptions) as any).values({ planId: pid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

// ── Simulation Results ────────────────────────────────────────────────────────

r.get("/plans/:planId/simulation-results", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(simulationResults).where(eq(simulationResults.planId, +req.params.planId)));
});

r.post("/plans/:planId/run-simulation", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  try {
    const [projRow] = await db.select().from(retirementProjections)
      .where(eq(retirementProjections.clientId, p.clientId));
    if (!projRow) return res.status(404).json({ message: "No retirement projection found for this client" }) as any;

    const assumptions = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, +req.params.planId));
    const baseAssum = assumptions.find(a => a.scenario === "base") ?? assumptions[0];

    const goals = await db.select().from(financialGoals).where(eq(financialGoals.clientId, p.clientId));
    const currentYear = new Date().getFullYear();

    const goalEvents: Array<{ yearOffset: number; amount: number; label: string }> = [];
    for (const g of goals) {
      if (!g.projectionImpact) continue;
      const targetYear = g.targetYear ?? (g.targetDate ? new Date(g.targetDate).getFullYear() : null);
      if (!targetYear) continue;
      const yearOffset = targetYear - currentYear;
      if (yearOffset < 1) continue;

      if ((g.cashflowType === "outflow" || g.cashflowType === "inflow") && g.targetAmount) {
        const sign = g.cashflowType === "outflow" ? -1 : 1;
        goalEvents.push({ yearOffset, amount: sign * Math.abs(parseFloat(String(g.targetAmount))), label: g.title });
      } else if (g.cashflowType === "recurring_expense" && g.startYear && g.endYear && g.annualAmount) {
        for (let yr = g.startYear; yr <= g.endYear; yr++) {
          const offset = yr - currentYear;
          if (offset >= 1) goalEvents.push({ yearOffset: offset, amount: -Math.abs(parseFloat(String(g.annualAmount))), label: g.title });
        }
      }
    }

    const { runMonteCarloSimulation, PRESET_ALLOCATIONS } = await import("../engine/simulation/monteCarlo.js") as any;
    const params = {
      initialBalance:     Number(projRow.rrspBalance ?? 0) + Number(projRow.tfsaBalance ?? 0) + Number(projRow.nonRegBalance ?? 0),
      allocation:         PRESET_ALLOCATIONS["MODERATE"],
      annualContribution: Number(projRow.annualContribution ?? 0),
      yearsToSimulate:    Math.max(1, (projRow.lifeExpectancy ?? 90) - (projRow.currentAge ?? 35)),
      numberOfPaths:      baseAssum?.simulationCount ?? 1000,
      inflationRate:      Number(projRow.inflationRate ?? 2) / 100,
      goalEvents:         goalEvents.length > 0 ? goalEvents : undefined,
    };
    const result = runMonteCarloSimulation(params);
    (result as any).goalEventCount   = goalEvents.length;
    (result as any).goalEventSummary = goalEvents.map(e => ({ label: e.label, yearOffset: e.yearOffset, year: currentYear + e.yearOffset, amount: e.amount }));
    res.json(result);
  } catch (e: any) {
    console.error("[run-simulation]", e.message);
    res.status(500).json({ message: e.message });
  }
});

// ── Stale Flags ───────────────────────────────────────────────────────────────

r.get("/plans/:planId/stale-flags", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(planStaleFlags).where(eq(planStaleFlags.planId, +req.params.planId)));
});

// ── Snapshots ─────────────────────────────────────────────────────────────────

r.get("/plans/:planId/snapshots", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(planSnapshots).where(eq(planSnapshots.planId, +req.params.planId)));
});

r.post("/plans/:planId/snapshots", async (req: Request, res: Response) => {
  const { companyId, staffId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  const pid = +req.params.planId;
  const [row] = await (db.insert(planSnapshots) as any).values({
    planId: pid, snapshotData: req.body.data ?? {}, trigger: req.body.trigger ?? "manual",
    notes: req.body.notes ?? null, createdBy: staffId,
  }).returning();
  res.status(201).json(row);
});

// ── Action Items ──────────────────────────────────────────────────────────────

r.get("/plans/:planId/action-items", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  res.json(await db.select().from(planActionItems).where(eq(planActionItems.planId, +req.params.planId)));
});

r.post("/plans/:planId/action-items", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const p = await ownsPlan(+req.params.planId, companyId);
  if (!p) return res.status(404).json({ message: "Not found" }) as any;
  const [row] = await (db.insert(planActionItems) as any).values({
    planId: +req.params.planId, ...safe(req.body),
    title: req.body.title ?? "Action item", description: req.body.description ?? "",
    module: req.body.module ?? "general", priority: req.body.priority ?? "medium",
  }).returning();
  res.status(201).json(row);
});

r.put("/action-items/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: planActionItems.id, planId: planActionItems.planId })
    .from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" }) as any;
  const plan = await ownsPlan(ex.planId, companyId);
  if (!plan) return res.status(404).json({ message: "Not found" }) as any;
  const [u] = await db.update(planActionItems).set(safe(req.body)).where(eq(planActionItems.id, ex.id)).returning();
  res.json(u);
});

r.delete("/action-items/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: planActionItems.id, planId: planActionItems.planId })
    .from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" }) as any;
  const plan = await ownsPlan(ex.planId, companyId);
  if (!plan) return res.status(404).json({ message: "Not found" }) as any;
  await db.delete(planActionItems).where(eq(planActionItems.id, ex.id));
  res.json({ ok: true });
});

// ── Saved Plans (AI-generated full plans) ─────────────────────────────────────

r.get("/clients/:clientId/saved-plans", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  const rows = await db.select({
    id: aiRecommendations.id, title: aiRecommendations.title,
    createdAt: aiRecommendations.createdAt, content: aiRecommendations.content,
  }).from(aiRecommendations)
    .where(and(eq(aiRecommendations.clientId, cid), eq(aiRecommendations.category, "financial_plan")));
  res.json(rows.map(r => ({
    ...r,
    plan: (() => { try { return JSON.parse(r.content ?? "{}"); } catch { return null; } })(),
  })));
});

r.delete("/saved-plans/:id", async (req: Request, res: Response) => {
  const { companyId } = getUser(req);
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, companyId)) return res.status(404).json({ message: "Not found" }) as any;
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

export { r as fpFullRouter };
