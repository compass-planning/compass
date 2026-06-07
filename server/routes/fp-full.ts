import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import {
  clients, financialPlans, financialGoals,
  netWorthEntries, retirementProjections, insuranceAnalyses,
  educationSavings, debtEntries, taxPlanningNotes, estatePlanningNotes,
  aiRecommendations, planAssumptions, simulationResults,
  planSnapshots, planStaleFlags, planActionItems,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { safe, ownsClient, ownsPlan } from "../fpUtils.js";   // Item 3: shared utils
import { eq, and } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

// ── Plans ─────────────────────────────────────────────────────────────────────
r.get("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)));
});
r.post("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [p] = await (db.insert(financialPlans) as any).values({ clientId: cid, userId: req.userId!, title: req.body.name ?? req.body.title ?? "Financial Plan", ...safe(req.body) }).returning();
  res.status(201).json(p);
});
r.get("/plans/:id", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.id, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.id, +req.params.id));
  res.json(plan);
});
r.put("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(financialPlans).set(safe(req.body)).where(eq(financialPlans.id, +req.params.id)).returning();
  res.json(u);
});
r.delete("/plans/:id", async (req: AuthRequest, res: Response) => {
  if (!await ownsPlan(+req.params.id, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(financialPlans).where(eq(financialPlans.id, +req.params.id));
  res.json({ ok: true });
});

// ── Net Worth — REMOVED (Item 1) ──────────────────────────────────────────────
// All net worth CRUD is now canonical in fp.ts:
//   GET/POST  /api/clients/:id/net-worth
//   PUT/DELETE /api/net-worth/:id

// ── Retirement — REMOVED (Item 2) ────────────────────────────────────────────
// /retirement-projections paths were unused by the frontend.
// Canonical retirement CRUD is in fp.ts at /clients/:id/retirement.

// ── Insurance Worksheet (unique to fp-full) ───────────────────────────────────
// insurance-analyses GET / POST / DELETE are handled by fpAliasesRouter (mounted first)
r.post("/clients/:clientId/insurance-worksheet", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const formData = req.body.data ?? req.body;
    const [row] = await (db.insert(insuranceAnalyses) as any).values({
      clientId: cid,
      primaryName:        formData.primaryName    ?? null,
      primaryAge:         formData.primaryAge     ? parseInt(formData.primaryAge)  : null,
      spouseName:         formData.spouseName     ?? null,
      spouseAge:          formData.spouseAge      ? parseInt(formData.spouseAge)   : null,
      spouseAnnualIncome: formData.spouseAnnualIncome ?? "0",
      annualIncome:       formData.primaryAnnualIncome ?? "0",
      worksheetData:      formData,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    console.error("[insurance-worksheet]", err);
    res.status(500).json({ message: "Failed to save" });
  }
});

// education-savings, debt-entries, ai-recommendations GET/POST/PUT/DELETE
// are handled by fpAliasesRouter (mounted first) — removed from here to avoid dead code

// ── Tax Planning Notes ────────────────────────────────────────────────────────
r.get("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});
r.post("/clients/:clientId/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(taxPlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Planning Notes ─────────────────────────────────────────────────────
r.get("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)));
});
r.post("/clients/:clientId/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(estatePlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});
r.put("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(estatePlanningNotes).set(safe(req.body)).where(eq(estatePlanningNotes.id, ex.id)).returning();
  res.json(u);
});
r.delete("/estate-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: estatePlanningNotes.id, clientId: estatePlanningNotes.clientId })
    .from(estatePlanningNotes).where(eq(estatePlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(estatePlanningNotes).where(eq(estatePlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Financial Planning Overview ───────────────────────────────────────────────
r.get("/clients/:clientId/financial-planning-overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
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
r.get("/plans/:planId/assumptions", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const pid = +req.params.planId;
  const defaults = [
    { planId: pid, scenario: "base",      equityReturn: "0.07", equityVolatility: "0.15", bondReturn: "0.04", bondVolatility: "0.05", inflationMean: "0.02", inflationVolatility: "0.01", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "optimistic",equityReturn: "0.09", equityVolatility: "0.12", bondReturn: "0.05", bondVolatility: "0.04", inflationMean: "0.015",inflationVolatility: "0.008",corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "stress",    equityReturn: "0.05", equityVolatility: "0.20", bondReturn: "0.03", bondVolatility: "0.07", inflationMean: "0.03", inflationVolatility: "0.015",corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
  ];
  for (const d of defaults) {
    const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions)
      .where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, d.scenario)));
    if (!ex) await (db.insert(planAssumptions) as any).values(d);
  }
  res.json(await db.select().from(planAssumptions).where(eq(planAssumptions.planId, pid)));
});

// ── Simulation Results ────────────────────────────────────────────────────────
r.get("/plans/:planId/simulation-results", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(simulationResults).where(eq(simulationResults.planId, +req.params.planId)));
});

r.post("/plans/:planId/run-simulation", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  try {
    const [projRow] = await db.select().from(retirementProjections)
      .where(eq(retirementProjections.clientId, p.clientId));
    if (!projRow) return res.status(404).json({ message: "No retirement projection found for this client" });

    const assumptions = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, +req.params.planId));
    const baseAssum = assumptions.find(a => a.scenario === "base") ?? assumptions[0];

    // ── Pull goals with projection impact ──────────────────────────────
    const goals = await db.select().from(financialGoals)
      .where(eq(financialGoals.clientId, p.clientId));

    const currentYear  = new Date().getFullYear();
    const retireAge    = projRow.retirementAge ?? 65;
    const currentAge   = projRow.currentAge   ?? 35;
    const yearsToRetire = Math.max(0, retireAge - currentAge);

    // Convert goals to simulation-start-relative year offsets
    const goalEvents: Array<{ yearOffset: number; amount: number; label: string }> = [];
    for (const g of goals) {
      if (!g.projectionImpact) continue;
      const targetYear = g.targetYear ?? (g.targetDate ? new Date(g.targetDate).getFullYear() : null);
      if (!targetYear) continue;
      const yearOffset = targetYear - currentYear;
      if (yearOffset < 1) continue; // already passed

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
    // Attach goal summary to result for frontend display
    (result as any).goalEventCount = goalEvents.length;
    (result as any).goalEventSummary = goalEvents.map(e => ({
      label: e.label,
      yearOffset: e.yearOffset,
      year: currentYear + e.yearOffset,
      amount: e.amount,
    }));
    res.json(result);
  } catch (e: any) {
    console.error("[run-simulation]", e.message);
    res.status(500).json({ message: e.message });
  }
});

// ── Stale Flags ───────────────────────────────────────────────────────────────
r.get("/plans/:planId/stale-flags", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planStaleFlags).where(eq(planStaleFlags.planId, +req.params.planId)));
});

// ── Snapshots ─────────────────────────────────────────────────────────────────
r.get("/plans/:planId/snapshots", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planSnapshots).where(eq(planSnapshots.planId, +req.params.planId)));
});
r.post("/plans/:planId/snapshots", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(planSnapshots) as any).values({ planId: +req.params.planId, snapshotData: req.body, trigger: req.body.trigger ?? "manual" }).returning();
  res.status(201).json(row);
});
r.get("/plans/:planId/snapshot-comparison", async (_req, res) => res.json([]));
r.get("/plans/:planId/scenario-comparison",  async (_req, res) => res.json([]));

// ── Action Items ──────────────────────────────────────────────────────────────
r.get("/plans/:planId/action-items", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(planActionItems).where(eq(planActionItems.planId, +req.params.planId)));
});
r.post("/plans/:planId/action-items", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(planActionItems) as any).values({ planId: +req.params.planId, ...safe(req.body) }).returning();
  res.status(201).json(row);
});
r.put("/action-items/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select().from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(planActionItems).set(safe(req.body)).where(eq(planActionItems.id, ex.id)).returning();
  res.json(u);
});
r.delete("/action-items/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: planActionItems.id, planId: planActionItems.planId })
    .from(planActionItems).where(eq(planActionItems.id, +req.params.id));
  if (!ex) return res.status(404).json({ message: "Not found" });
  if (!await ownsPlan(ex.planId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(planActionItems).where(eq(planActionItems.id, ex.id));
  res.json({ ok: true });
});

// ── Reports ───────────────────────────────────────────────────────────────────
r.get("/reports/:clientId/available", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [ret] = await db.select({ id: retirementProjections.id }).from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  const [ins] = await db.select({ id: insuranceAnalyses.id }).from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid));
  res.json({ retirement: !!ret, insurance: !!ins, netWorth: true });
});

r.get("/clients/:clientId/financial-planning-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [plan]   = await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid));
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { generateComprehensiveReport } = await import("../services/reportGenerator.js") as any;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generateComprehensiveReport({ plan, client } as any));
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── Liabilities list (for goal debt-payoff dropdown) ─────────────────────────
r.get("/clients/:clientId/liabilities", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });

  // Pull both net worth liabilities and debt entries in parallel
  const [nwRows, debtRows] = await Promise.all([
    db.select({
      id:       netWorthEntries.id,
      name:     netWorthEntries.name,
      category: netWorthEntries.category,
      value:    netWorthEntries.value,
      metadata: netWorthEntries.metadata,
    }).from(netWorthEntries)
      .where(and(eq(netWorthEntries.clientId, cid), eq(netWorthEntries.type, "liability"))),
    db.select({
      id:             debtEntries.id,
      name:           debtEntries.name,
      category:       debtEntries.category,
      balance:        debtEntries.balance,
      interestRate:   debtEntries.interestRate,
      minimumPayment: debtEntries.minimumPayment,
    }).from(debtEntries)
      .where(eq(debtEntries.clientId, cid)),
  ]);

  // Merge: for each NW liability, find a matching debt entry by name/category
  const merged = nwRows.map(nw => {
    const match = debtRows.find(d =>
      d.name?.toLowerCase() === nw.name?.toLowerCase() ||
      d.category?.toLowerCase() === nw.category?.toLowerCase()
    );
    // Monthly payment: prefer NW metadata, fall back to debt_entries minimum_payment
    const nwMonthly = (nw as any).metadata?.monthlyPayment
      ? Number((nw as any).metadata.monthlyPayment)
      : null;
    const monthlyPayment = nwMonthly ?? (match ? Number(match.minimumPayment) : null);
    return {
      id:             nw.id,
      name:           nw.name,
      category:       nw.category,
      balance:        Number(nw.value),
      interestRate:   match ? Number(match.interestRate) : null,
      minimumPayment: monthlyPayment,
      annualCost:     monthlyPayment ? monthlyPayment * 12 : null,
      source:         match ? "debt_entries" : "net_worth",
    };
  });

  // Also include any debt entries not already in NW liabilities
  debtRows.forEach(d => {
    const already = merged.find(m =>
      m.name?.toLowerCase() === d.name?.toLowerCase() ||
      m.category?.toLowerCase() === d.category?.toLowerCase()
    );
    if (!already) {
      merged.push({
        id:             d.id,
        name:           d.name,
        category:       d.category,
        balance:        Number(d.balance),
        interestRate:   Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
        annualCost:     Number(d.minimumPayment) * 12,
        source:         "debt_entries",
      });
    }
  });

  res.json(merged);
});

// ── Financial Plan HTML Report ────────────────────────────────────────────────
r.post("/clients/:clientId/financial-plan-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ message: "plan is required" });
    const [clientRow] = await db.select().from(clients).where(eq(clients.id, cid));
    if (!clientRow) return res.status(404).json({ message: "Client not found" });
    const { generateFinancialPlanReport } = await import("../services/reportGenerator.js") as any;
    const html = generateFinancialPlanReport({ plan, client: clientRow });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e: any) {
    console.error("[financial-plan-report]", e.message);
    res.status(500).json({ message: e.message });
  }
});
r.post("/clients/:clientId/generate-plan", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });

  try {
    // ── Aggregate all client data ────────────────────────────────────────────
    const [
      clientRows, nw, ret, ins, edu, debt, tax, estate, goals, pensions,
    ] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)),
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
      db.select().from(educationSavings).where(eq(educationSavings.clientId, cid)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
      db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)),
      db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)),
      db.select().from(financialGoals).where(eq(financialGoals.clientId, cid)),
      (db as any).select().from((await import("../../shared/schema.js") as any).pensionPlans).where(eq((await import("../../shared/schema.js") as any).pensionPlans.clientId, cid)).catch(() => []),
    ]);

    const client = clientRows[0];
    if (!client) return res.status(404).json({ message: "Client not found" });

    const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
    const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
    const retProj     = ret[0] as any;
    const insData     = ins[0] as any;

    // ── Build structured context for Claude ──────────────────────────────────
    const context = {
      client: {
        name:            `${client.firstName} ${client.lastName}`,
        age:             client.dateOfBirth ? new Date().getFullYear() - new Date(client.dateOfBirth as string).getFullYear() : null,
        spouseName:      client.spouseFirstName ? `${client.spouseFirstName} ${(client as any).spouseLastName ?? ""}`.trim() : null,
        province:        (client as any).province ?? "ON",
        annualIncome:    Number((client as any).annualIncome ?? 0),
        spouseIncome:    Number((client as any).spouseAnnualIncome ?? 0),
        retirementAge:   (client as any).retirementAge ?? 65,
        maritalStatus:   (client as any).maritalStatus ?? "unknown",
        employmentStatus:(client as any).employmentStatus ?? "unknown",
      },
      netWorth: {
        totalAssets:     assets,
        totalLiabilities: liabilities,
        netWorth:        assets - liabilities,
        assets:          nw.filter(e => e.type === "asset").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })),
        liabilities:     nw.filter(e => e.type === "liability").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })),
      },
      retirement: retProj ? {
        currentAge:         retProj.currentAge,
        retirementAge:      retProj.retirementAge,
        lifeExpectancy:     retProj.lifeExpectancy,
        rrspBalance:        Number(retProj.rrspBalance ?? 0),
        tfsaBalance:        Number(retProj.tfsaBalance ?? 0),
        nonRegBalance:      Number(retProj.nonRegBalance ?? 0),
        annualContribution: Number(retProj.annualContribution ?? 0),
        desiredIncome:      Number(retProj.desiredRetirementIncome ?? 0),
        pensionIncome:      Number(retProj.pensionIncome ?? 0),
        cppMonthly:         Number(retProj.cppMonthly ?? 0),
        oasMonthly:         Number(retProj.oasMonthly ?? 0),
        successRate:        Number(retProj.successRate ?? 0),
        projectedBalance:   Number(retProj.projectedBalance ?? 0),
        shortfallSurplus:   Number(retProj.shortfallSurplus ?? 0),
      } : null,
      insurance: insData ? {
        lifeInsuranceGap:     Number((insData as any).lifeInsuranceGap ?? 0),
        disabilityGap:        Number((insData as any).disabilityGap ?? 0),
        criticalIllnessGap:   Number((insData as any).criticalIllnessGap ?? 0),
        existingCoverage:     (insData as any).worksheetData?.existingCoverage ?? null,
      } : null,
      debt: debt.map(d => ({
        name:           d.name,
        category:       d.category,
        balance:        Number(d.balance),
        interestRate:   Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
      })),
      education: edu.map(e => ({
        childName:     (e as any).childName,
        targetAmount:  Number((e as any).targetAmount ?? 0),
        currentBalance:Number((e as any).currentBalance ?? 0),
        targetAge:     (e as any).targetAge,
        childAge:      (e as any).childAge,
      })),
      goals: goals.map(g => ({
        title:          g.title,
        goalType:       g.goalType,
        cashflowType:   g.cashflowType,
        targetAmount:   Number(g.targetAmount ?? 0),
        targetYear:     g.targetYear,
        priority:       g.priority,
        projectionImpact: g.projectionImpact,
        status:         g.status,
      })),
      tax:   tax.map(t => ({ category: (t as any).category, title: (t as any).title, content: (t as any).content })),
      estate: estate.map(e => ({ category: (e as any).category, title: (e as any).title, content: (e as any).content })),
      pensions,
    };

    // ── Call Claude ──────────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "ANTHROPIC_API_KEY not configured" });

    const systemPrompt = `You are a senior Canadian Certified Financial Planner (CFP) with 20 years of experience. 
You are generating a comprehensive written financial plan for a Canadian client. 
Your analysis must be specific, quantitative where data is available, and written in clear advisor language suitable for client presentation.
Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.`;

    const userPrompt = `Generate a comprehensive financial plan for this Canadian client. Here is their complete financial data:

${JSON.stringify(context, null, 2)}

Return a JSON object with EXACTLY this structure:
{
  "executiveSummary": {
    "score": <1-5 integer overall health score>,
    "headline": "<one compelling sentence summarizing the client's financial position>",
    "narrative": "<3-4 paragraph written overview covering the client's current position, key strengths, key gaps, and the single most important priority. Be specific with numbers from the data.>",
    "keyStrengths": ["<specific strength with numbers>", "<specific strength>", "<specific strength>"],
    "keyGaps": ["<specific gap with numbers>", "<specific gap>", "<specific gap>"]
  },
  "sections": [
    {
      "id": "retirement",
      "title": "Retirement Planning",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs with specific analysis. Include current trajectory, gaps, CPP/OAS optimization if relevant, RRSP vs TFSA strategy. Use actual numbers from the data.>",
      "recommendations": [
        { "priority": "<high|medium|low>", "action": "<specific actionable recommendation>", "impact": "<quantified impact if possible>", "timeline": "<immediate|3_months|6_months|1_year|ongoing>" }
      ]
    },
    {
      "id": "risk_management",
      "title": "Risk Management & Insurance",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs covering life, disability, critical illness coverage gaps. Be specific about dollar gaps.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "debt_cashflow",
      "title": "Debt & Cash Flow Management",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs. Analyze total debt load, interest costs, repayment strategy, cash flow optimization.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "tax_efficiency",
      "title": "Tax Efficiency",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs. Cover RRSP/TFSA optimization, income splitting opportunities for couples, capital gains planning, withdrawal sequencing in retirement.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "investment_strategy",
      "title": "Investment Strategy",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs covering asset allocation, registered vs non-registered positioning, portfolio construction relative to goals and timeline.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "estate_planning",
      "title": "Estate & Beneficiary Planning",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<2-3 paragraphs covering will status, beneficiary designations, power of attorney, probate exposure, any tax on death concerns.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "education",
      "title": "Education Savings",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<1-2 paragraphs. If no education data, note this is not applicable or data not provided.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    },
    {
      "id": "goals",
      "title": "Goals & Milestones",
      "score": <1-5>,
      "status": "<on_track|needs_attention|at_risk|not_started>",
      "narrative": "<1-2 paragraphs covering the client's stated goals, their feasibility, and how they interact with the overall plan.>",
      "recommendations": [{ "priority": "string", "action": "string", "impact": "string", "timeline": "string" }]
    }
  ],
  "priorityActions": [
    { "rank": 1, "title": "<short action title>", "description": "<one clear sentence>", "section": "<section id>", "priority": "high", "timeline": "<string>" },
    { "rank": 2, "title": "string", "description": "string", "section": "string", "priority": "high", "timeline": "string" },
    { "rank": 3, "title": "string", "description": "string", "section": "string", "priority": "high", "timeline": "string" },
    { "rank": 4, "title": "string", "description": "string", "section": "string", "priority": "medium", "timeline": "string" },
    { "rank": 5, "title": "string", "description": "string", "section": "string", "priority": "medium", "timeline": "string" }
  ],
  "disclaimer": "This financial plan has been prepared based on information provided as of ${new Date().toLocaleDateString("en-CA")}. It is intended as a guide and does not constitute legal, tax, or investment advice. Please consult qualified professionals before implementing any strategies."
}`;

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:  "claude-sonnet-4-6",
        max_tokens: 8000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      console.error("[generate-plan] Claude error:", err);
      return res.status(500).json({ message: "AI generation failed", detail: err });
    }

    const claudeData = await claudeRes.json() as any;
    const rawText = claudeData.content?.[0]?.text ?? "";

    // Parse JSON — strip any accidental markdown fences
    const cleaned = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let plan: any;
    try {
      plan = JSON.parse(cleaned);
    } catch (e) {
      console.error("[generate-plan] JSON parse failed:", cleaned.slice(0, 300));
      return res.status(500).json({ message: "Failed to parse AI response", raw: cleaned.slice(0, 500) });
    }

    // Attach metadata
    plan.generatedAt  = new Date().toISOString();
    plan.clientId     = cid;
    plan.clientName   = `${client.firstName} ${client.lastName}`;
    plan.dataSnapshot = {
      netWorth:    assets - liabilities,
      totalDebt:   debt.reduce((s, d) => s + Number(d.balance), 0),
      successRate: retProj ? Number(retProj.successRate ?? 0) : null,
    };

    // Store as AI recommendation for history
    await (db.insert(aiRecommendations) as any).values({
      clientId:   cid,
      title:      "Financial Plan — " + new Date().toLocaleDateString("en-CA"),
      content:    JSON.stringify(plan),
      category:   "financial_plan",
      priority:   "high",
      status:     "active",
    }).catch(() => {}); // non-fatal if storage fails

    res.json(plan);
  } catch (e: any) {
    console.error("[generate-plan]", e.message);
    res.status(500).json({ message: e.message });
  }
});

// ── Retrieve saved plans ──────────────────────────────────────────────────────
r.get("/clients/:clientId/saved-plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const rows = await db.select({
    id:        aiRecommendations.id,
    title:     aiRecommendations.title,
    createdAt: aiRecommendations.createdAt,
    content:   aiRecommendations.content,
  }).from(aiRecommendations)
    .where(and(eq(aiRecommendations.clientId, cid), eq(aiRecommendations.category, "financial_plan")));
  res.json(rows.map(r => ({
    ...r,
    plan: (() => { try { return JSON.parse(r.content ?? "{}"); } catch { return null; } })(),
  })));
});

r.delete("/saved-plans/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});
export { r as fpFullRouter };
