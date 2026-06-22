/**
 * server/routes/financial.ts
 *
 * Single source of truth for all client financial data routes.
 * Replaces fp.ts + fp-aliases.ts + fp-full.ts.
 *
 * Mount in server/index.ts:
 *   import { financialRouter } from "./routes/financial.js";
 *   app.use("/api", financialRouter);
 */
import { runRetirementProjection } from "../engine/retirementProjection.js";
import { safeMsg, AppError } from "../lib/errorUtils.js";
import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import {
  clients, financialPlans, financialGoals,
  netWorthEntries, retirementProjections,
  insuranceAnalyses, educationSavings as educationPlans,
  debtEntries, clientPolicies, householdExpenses,
  taxPlanningNotes, estatePlanningNotes, aiRecommendations,
  planAssumptions, simulationResults, planSnapshots,
  planStaleFlags, planActionItems, pensionPlans,
  scenarioComparisons,
  ltcAnalyses,
  diAnalyses,
  savedReports,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { safe, ownsClient, ownsPlan } from "../fpUtils.js";
import { auditAnthropicCall, auditWrite, AuditAction, DataCategory } from "../services/pipedaAuditService.js";
import { eq, and, sql } from "drizzle-orm";
import { runDrawdownStrategies, type DrawdownInput } from "../engine/drawdown.js";

const r = Router();
r.use((req: any, res: any, next: any) => {
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return isAuthenticated(req, res, next);
});

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [nw, ret, ins, edu, debt, tax, estate, ai, clientPlans] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
    db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)),
    db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)),
    db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)),
    db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)),
  ]);
  const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt   = debt.reduce((s, d) => s + Number(d.balance), 0);
  res.json({
    netWorth: assets - liabilities, totalAssets: assets, totalLiabilities: liabilities, totalDebt,
    retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length, pendingAi: ai.filter(a => a.status === "pending").length,
    plans: clientPlans.length,
  });
});

r.get("/clients/:clientId/financial-planning-overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [nw, ret, ins, edu, debt, tax, estate, ai, fp] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
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
    goals: fp.length, retirementProjections: ret.length, insuranceAnalyses: ins.length,
    educationPlans: edu.length, taxNotes: tax.length, estateNotes: estate.length,
    aiRecommendations: ai.length, pendingRecommendations: ai.filter((a: any) => a.status === "pending").length,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NET WORTH
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)));
});

r.post("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const payload = req.body.data ?? req.body;
    const { type, category, name, value, owner, notes, metadata } = payload;
    const [row] = await db.insert(netWorthEntries)
      .values({ clientId: cid, type, category, name, value, owner, notes, metadata } as any)
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    console.error("[net-worth/post]", e.message);
    res.status(500).json({ message: safeMsg(e) });
  }
});

r.put("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId })
    .from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(netWorthEntries).set(safe(req.body)).where(eq(netWorthEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/net-worth/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId })
    .from(netWorthEntries).where(eq(netWorthEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(netWorthEntries).where(eq(netWorthEntries.id, ex.id));
  res.json({ ok: true });
});

r.get("/clients/:clientId/liabilities", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [nwRows, debtRows] = await Promise.all([
    db.select({ id: netWorthEntries.id, name: netWorthEntries.name, category: netWorthEntries.category, value: netWorthEntries.value, metadata: netWorthEntries.metadata })
      .from(netWorthEntries).where(and(eq(netWorthEntries.clientId, cid), eq(netWorthEntries.type, "liability"))),
    db.select({ id: debtEntries.id, name: debtEntries.name, category: debtEntries.category, balance: debtEntries.balance, interestRate: debtEntries.interestRate, minimumPayment: debtEntries.minimumPayment })
      .from(debtEntries).where(eq(debtEntries.clientId, cid)),
  ]);
  const merged = nwRows.map(nw => {
    const match = debtRows.find(d => d.name?.toLowerCase() === nw.name?.toLowerCase() || d.category?.toLowerCase() === nw.category?.toLowerCase());
    const nwMonthly = (nw as any).metadata?.monthlyPayment ? Number((nw as any).metadata.monthlyPayment) : null;
    const monthlyPayment = nwMonthly ?? (match ? Number(match.minimumPayment) : null);
    return { id: nw.id, name: nw.name, category: nw.category, balance: Number(nw.value), interestRate: match ? Number(match.interestRate) : null, minimumPayment: monthlyPayment, annualCost: monthlyPayment ? monthlyPayment * 12 : null, source: match ? "debt_entries" : "net_worth" };
  });
  debtRows.forEach(d => {
    if (!merged.find(m => m.name?.toLowerCase() === d.name?.toLowerCase() || m.category?.toLowerCase() === d.category?.toLowerCase()))
      merged.push({ id: d.id, name: d.name, category: d.category, balance: Number(d.balance), interestRate: Number(d.interestRate), minimumPayment: Number(d.minimumPayment), annualCost: Number(d.minimumPayment) * 12, source: "debt_entries" });
  });
  res.json(merged);
});

// ─────────────────────────────────────────────────────────────────────────────
// RETIREMENT  (canonical: /clients/:id/retirement | alias: /retirement-projections)
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const person = req.query.person as string | undefined;
  const rows = await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  const filtered = person ? rows.filter(r => (r.person ?? "primary") === person) : rows;
  res.json(filtered.map(row => ({
    ...row,
    person: row.person ?? "primary",
    currentSavings: row.currentSavings ?? String((Number(row.rrspBalance ?? 0) + Number(row.tfsaBalance ?? 0) + Number(row.nonRegBalance ?? 0)) || 0),
    annualContribution: row.annualContribution ?? "0",
    expectedReturn: row.expectedReturn ?? "7",
    inflationRate: row.inflationRate ?? "2",
    desiredRetirementIncome: row.desiredRetirementIncome ?? "0",
    projectedBalance: row.projectedBalance ?? "0",
    shortfallSurplus: row.shortfallSurplus ?? "0",
  })));
});

r.post("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const data = safe(req.body.data ?? req.body);
    if (data.currentSavings && !data.rrspBalance) data.rrspBalance = data.currentSavings;
    const [row] = await (db.insert(retirementProjections) as any).values({ clientId: cid, person: data.person ?? "primary", currentAge: data.currentAge || 35, retirementAge: data.retirementAge || 65, ...data }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    console.error("[retirement POST]", err.message);
    res.status(500).json({ message: safeMsg(err) });
  }
});

r.post("/clients/:id/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const body = req.body;
  try {
    const plans = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
    const pensionIncome = plans.reduce((sum: number, p: any) => {
      if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
        return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
      if (p.pensionType === "dcpp" && p.currentBalance) return sum + (Number(p.currentBalance) * 0.04);
      return sum;
    }, 0);
    
const result = runRetirementProjection({
  currentAge:         Number(body.currentAge ?? 40),
  retirementAge:      Number(body.retirementAge ?? 65),
  lifeExpectancy:     Number(body.lifeExpectancy ?? 90),
  currentSavings:     Number(body.currentSavings ?? 0),
  annualContribution: Number(body.annualContribution ?? 0),
  desiredIncome:      Number(body.desiredRetirementIncome ?? 50000),
  expectedReturn:     Number(body.expectedReturn ?? 7) / 100,
  inflationRate:      Number(body.inflationRate ?? 2) / 100,
  cppStartAge:        Number(body.cppStartAge ?? 65),
  pensionIncome,
  isCouple:           body.householdType === "couple",
  spouseAge:          Number(body.spouseAge ?? body.currentAge ?? 40),
  spouseRetirementAge:  Number(body.spouseRetirementAge ?? 65),
  spouseLifeExpectancy: Number(body.spouseLifeExpectancy ?? 90),
  spouseSavings:        Number(body.spouseSavings ?? 0),
  spouseContribution:   Number(body.spouseContribution ?? 0),
  spousePensionIncome:  Number(body.spousePensionIncome ?? 0),
  spouseCppStartAge:    Number(body.spouseCppStartAge ?? 65),
});

const [row] = await (db.insert(retirementProjections) as any).values({
  clientId: cid, ...safe(body),
  projectedBalance: String(result.medianBalance),
  shortfallSurplus: String(result.shortfallSurplus),
  successRate:      String(result.successRate),
  pensionIncome:    String(Math.round(result.pensionIncome)),
}).returning();

res.json(row);

  } catch (e: any) {
    console.error("[retirement projection sim]", e.message);
    const [row] = await (db.insert(retirementProjections) as any).values({ clientId: cid, ...safe(body) }).returning();
    res.json(row);
  }
});

r.get("/clients/:id/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)));
});

r.patch("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId })
    .from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(retirementProjections).set(safe(req.body)).where(eq(retirementProjections.id, ex.id)).returning();
  res.json(u);
});

r.delete("/retirement/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId })
    .from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

r.delete("/retirement-projections/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId })
    .from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// INSURANCE
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});

r.get("/clients/:id/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});

r.post("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.post("/clients/:id/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});

r.post("/clients/:clientId/insurance-worksheet", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const formData = req.body.data ?? req.body;
    const [row] = await (db.insert(insuranceAnalyses) as any).values({
      clientId: cid,
      primaryName: formData.primaryName ?? null, primaryAge: formData.primaryAge ? parseInt(formData.primaryAge) : null,
      spouseName: formData.spouseName ?? null, spouseAge: formData.spouseAge ? parseInt(formData.spouseAge) : null,
      spouseAnnualIncome: formData.spouseAnnualIncome ?? "0", annualIncome: formData.primaryAnnualIncome ?? "0",
      worksheetData: formData,
    }).returning();
    res.status(201).json(row);
  } catch (err) { console.error("[insurance-worksheet]", err); res.status(500).json({ message: "Failed to save" }); }
});

r.patch("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId })
    .from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(insuranceAnalyses).set(safe(req.body)).where(eq(insuranceAnalyses.id, ex.id)).returning();
  res.json(u);
});

r.delete("/insurance/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId })
    .from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

r.delete("/insurance-analyses/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId })
    .from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// EDUCATION / RESP
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)));
});

r.get("/clients/:id/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)));
});

r.post("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(educationPlans) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.post("/clients/:id/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(educationPlans) as any).values({ clientId: cid, childAge: data.childAge || 0, ...data }).returning();
  res.status(201).json(row);
});

r.patch("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationPlans).set(safe(req.body)).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});

r.put("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(educationPlans).set(safe(req.body)).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});

r.delete("/education/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

r.delete("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId })
    .from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DEBT
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});

r.get("/clients/:id/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});

r.post("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.post("/clients/:id/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(debtEntries).set(safe(req.body)).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});

r.put("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(debtEntries).set(safe(req.body)).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});

r.delete("/debt/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

r.delete("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId })
    .from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// TAX PLANNING NOTES  (canonical: /tax | alias: /tax-planning-notes)
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});

r.get("/clients/:id/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)));
});

r.post("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(taxPlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});

r.post("/clients/:id/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(taxPlanningNotes) as any).values({ clientId: cid, title: data.title || "Note", content: data.content || "", taxYear: data.taxYear || new Date().getFullYear(), category: data.category || "general", ...data }).returning();
  res.status(201).json(row);
});

r.patch("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});

r.put("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxPlanningNotes).set(safe(req.body)).where(eq(taxPlanningNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, ex.id));
  res.json({ ok: true });
});

r.delete("/tax-planning-notes/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxPlanningNotes.id, clientId: taxPlanningNotes.clientId })
    .from(taxPlanningNotes).where(eq(taxPlanningNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxPlanningNotes).where(eq(taxPlanningNotes.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// ESTATE PLANNING NOTES
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)).limit(1);
  res.json(row ?? null);
});

r.put("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [ex] = await db.select({ id: estatePlanningNotes.id }).from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)).limit(1);
  if (ex) {
    const [u] = await db.update(estatePlanningNotes).set(safe(req.body)).where(eq(estatePlanningNotes.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await (db.insert(estatePlanningNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.get("/clients/:id/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)));
});

r.post("/clients/:id/estate-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
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

// ─────────────────────────────────────────────────────────────────────────────
// AI RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/ai", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});

r.get("/clients/:id/ai-recommendations", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});

r.post("/clients/:id/ai/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const [nw, debt] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
  ]);
  const assets    = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);
  const runId = new Date().toISOString();
  const recs: any[] = [];
  if (!client.retirementAge)  recs.push({ clientId: cid, runId, category: "retirement", priority: "high",   title: "Set Retirement Target Age",  content: "Define a target retirement age to enable accurate projections and CPP/OAS timing optimization." });
  if (assets < 50000)         recs.push({ clientId: cid, runId, category: "savings",    priority: "high",   title: "Build Emergency Fund",        content: "Recommend building 3-6 months of expenses in liquid savings before aggressive investing." });
  if (totalDebt > 50000)      recs.push({ clientId: cid, runId, category: "debt",       priority: "high",   title: "Debt Reduction Strategy",     content: `Total debt of $${totalDebt.toLocaleString()} is significant. Review avalanche vs snowball strategy.` });
  recs.push({ clientId: cid, runId, category: "tax",       priority: "medium", title: "Annual RRSP/TFSA Review",    content: "Review contribution room and optimize between RRSP and TFSA based on current and expected future marginal tax rates." });
  recs.push({ clientId: cid, runId, category: "insurance", priority: "medium", title: "Insurance Needs Review",     content: "Conduct annual review of life, disability, and critical illness coverage gaps." });
  if (!client.retirementAge || assets > 100000) recs.push({ clientId: cid, runId, category: "retirement", priority: "medium", title: "Review CPP/OAS Timing", content: "Model the impact of deferring CPP to age 70 (+42%) and OAS to age 70 (+36%) versus taking at 65. Break-even typically age 82-85." });
  if (assets > 0 && totalDebt === 0)            recs.push({ clientId: cid, runId, category: "tax",       priority: "low",    title: "Estate & Tax Efficiency", content: "Review beneficiary designations, TFSA maximization, and potential for spousal RRSP income splitting in retirement." });
  const inserted = await Promise.all(recs.map(rec => (db.insert(aiRecommendations) as any).values(rec).returning().then(([x]: any) => x)));
  res.status(201).json(inserted);
});

// ─────────────────────────────────────────────────────────────────────────────

r.post("/clients/:id/ai-recommendations/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });

  const runId = new Date().toISOString();

  try {
    // ── Gather client data ──────────────────────────────────────────────────
    const [[client], nw, debt, ret, ins, goals] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)),
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)).limit(1),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)).limit(1),
      db.select().from(financialGoals).where(eq(financialGoals.clientId, cid)),
    ]);

    const assets    = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
    const liabs     = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
    const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);
    const retProj   = ret[0] as any;
    const insRow    = ins[0] as any;

    const context = {
      client: {
        name:              `${client.firstName} ${client.lastName}`,
        age:               client.dateOfBirth ? new Date().getFullYear() - new Date(client.dateOfBirth as string).getFullYear() : null,
        province:          (client as any).province ?? "ON",
        annualIncome:      Number((client as any).annualIncome ?? 0),
        spouseIncome:      Number((client as any).spouseAnnualIncome ?? 0),
        hasSpouse:         !!client.spouseFirstName,
        retirementAge:     (client as any).retirementAge ?? null,
        employmentStatus:  (client as any).employmentStatus ?? null,
      },
      netWorth: {
        totalAssets:      assets,
        totalLiabilities: liabs,
        netWorth:         assets - liabs,
        rrsp:             nw.filter(e => e.category === "RRSP").reduce((s, e) => s + Number(e.value), 0),
        tfsa:             nw.filter(e => e.category === "TFSA").reduce((s, e) => s + Number(e.value), 0),
        nonReg:           nw.filter(e => e.category === "Non-Registered").reduce((s, e) => s + Number(e.value), 0),
        realEstate:       nw.filter(e => ["Principal Residence","Real Estate (other)"].includes(e.category ?? "")).reduce((s, e) => s + Number(e.value), 0),
      },
      retirement: retProj ? {
        currentAge:        retProj.currentAge,
        retirementAge:     retProj.retirementAge,
        rrspBalance:       Number(retProj.rrspBalance ?? 0),
        tfsaBalance:       Number(retProj.tfsaBalance ?? 0),
        annualContrib:     Number(retProj.annualContribution ?? 0),
        desiredIncome:     Number(retProj.desiredRetirementIncome ?? 0),
        successRate:       Number(retProj.successRate ?? 0),
        shortfall:         Number(retProj.shortfallSurplus ?? 0),
        cppMonthly:        Number(retProj.cppMonthly ?? 0),
        oasMonthly:        Number(retProj.oasMonthly ?? 0),
        pensionIncome:     Number(retProj.pensionIncome ?? 0),
      } : null,
      debt: {
        totalDebt,
        items: debt.map(d => ({ name: d.name, balance: Number(d.balance), rate: Number(d.interestRate ?? 0) })),
      },
      insurance: insRow ? {
        lifeGap:       Number(insRow.lifeGap ?? 0),
        disabilityGap: Number(insRow.disabilityGap ?? 0),
        ciGap:         Number(insRow.criticalIllnessGap ?? 0),
      } : null,
      goals: goals.map(g => ({ title: g.title, type: g.goalType, priority: g.priority, targetAmount: Number(g.targetAmount ?? 0), targetYear: g.targetYear })),
    };

    // ── Call Claude ─────────────────────────────────────────────────────────
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback to smart rule-based recs if no API key
      
      throw new Error("NO_API_KEY");
    }

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:  "claude-sonnet-4-6",
        max_tokens: 2000,
        system: `You are a senior Canadian Certified Financial Planner (CFP). Generate specific, actionable financial planning recommendations for a Canadian client based on their actual data. Each recommendation must be specific to their situation — not generic advice.

Respond ONLY with a valid JSON array. No preamble, no markdown, no explanation outside the JSON.

Each recommendation object must have:
- category: one of "retirement" | "tax" | "insurance" | "estate" | "savings" | "debt" | "investment"  
- priority: one of "high" | "medium" | "low"
- title: concise action title (max 60 chars)
- content: specific advice referencing their actual numbers (2-3 sentences)

Generate 4-7 recommendations. Prioritize the most impactful issues first.`,
        messages: [{
          role: "user",
          content: `Generate financial planning recommendations for this Canadian client:\n\n${JSON.stringify(context, null, 2)}`,
        }],
      }),
    });

    if (!claudeRes.ok) {
  const errBody = await claudeRes.text();
  console.error("[generate-plan] Claude error:", claudeRes.status, errBody.slice(0, 300));
  return res.status(500).json({ message: `Claude API error: ${claudeRes.status}` });
}

    const claudeData = await claudeRes.json() as any;
   const rawText = claudeData.content?.[0]?.text ?? "[]";
const startObj = rawText.indexOf("{");
const startArr = rawText.indexOf("[");
const start = startObj !== -1 && (startArr === -1 || startObj < startArr) ? startObj : startArr;
const end = start !== -1 && rawText[start] === "[" ? rawText.lastIndexOf("]") : rawText.lastIndexOf("}");
const cleaned = start !== -1 && end !== -1 ? rawText.slice(start, end + 1) : rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let aiRecs: any[];
    try {
      console.log("[ai-recs] cleaned:", cleaned.slice(0, 300));
      aiRecs = JSON.parse(cleaned);
      if (!Array.isArray(aiRecs)) throw new Error("Not an array");
    } catch (parseErr: any) {
      console.error("[ai-recs] raw response:", rawText.slice(0, 500));
      throw new Error("Failed to parse AI response");
    }

    // Validate and sanitize each rec
    const validCategories = ["retirement", "tax", "insurance", "estate", "savings", "debt", "investment"];
    const validPriorities = ["high", "medium", "low"];
    const sanitized = aiRecs
      .filter(r => r.title && r.content)
      .slice(0, 8)
      .map(r => ({
        clientId: cid,
        runId,
        category: validCategories.includes(r.category) ? r.category : "tax",
        priority: validPriorities.includes(r.priority) ? r.priority : "medium",
        title:    String(r.title).slice(0, 100),
        content:  String(r.content).slice(0, 500),
        status:   "pending",
      }));

    const inserted = await Promise.all(
      sanitized.map(rec => db.insert(aiRecommendations).values(rec).returning().then(([x]) => x))
    );
    res.json(inserted);

  } catch (e: any) {
    if (e.message === "NO_API_KEY" || e.message.includes("parse")) {
      // Smart rule-based fallback
      console.log("[ai generate] falling back to rule-based recs:", e.message);
      const recs = [
        { clientId: cid, runId, category: "retirement", priority: "high",   title: "Review Retirement Projections",  content: "Ensure CPP/OAS timing and RRSP/TFSA drawdown strategy are optimized for your province.", status: "pending" },
        { clientId: cid, runId, category: "tax",        priority: "medium", title: "Annual RRSP/TFSA Review",         content: "Review contribution room and optimize between RRSP and TFSA based on marginal rates.", status: "pending" },
        { clientId: cid, runId, category: "insurance",  priority: "medium", title: "Insurance Needs Analysis",        content: "Conduct annual review of life, disability, and critical illness coverage gaps.", status: "pending" },
        { clientId: cid, runId, category: "estate",     priority: "low",    title: "Estate Document Review",          content: "Verify will, POA, and healthcare directive are current and reflect your wishes.", status: "pending" },
      ];
      try {
        const inserted = await Promise.all(recs.map(rec => db.insert(aiRecommendations).values(rec).returning().then(([x]) => x)));
        return res.json(inserted);
      } catch (dbErr: any) {
        return res.status(500).json({ message: dbErr.message });
      }
    }
    console.error("[ai generate]", e.message);
    res.status(500).json({ message: safeMsg(e) });
  }
});

r.patch("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(aiRecommendations).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.put("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await (db.update(aiRecommendations) as any).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.delete("/clients/:id/ai/session/*", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  try {
    let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  } catch (e: any) { return res.status(500).json({ message: safeMsg(e) }); }
  const runId = decodeURIComponent((req.params as any)[0]);
  try {
    await db.delete(aiRecommendations).where(and(eq(aiRecommendations.clientId, cid), eq(aiRecommendations.runId, runId)));
    res.json({ ok: true });
  } catch (e: any) { console.error("[delete session]", e.message); res.status(500).json({ message: safeMsg(e) }); }
});

r.delete("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

r.delete("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// CLIENT POLICIES
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(clientPolicies).where(eq(clientPolicies.clientId, cid)));
});

r.post("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(clientPolicies) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[policies POST]", err.message); res.status(500).json({ message: safeMsg(err) }); }
});

r.patch("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(clientPolicies).set(safe(req.body))
    .where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid))).returning();
  res.json(row);
});

r.delete("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  await db.delete(clientPolicies).where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid)));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// HOUSEHOLD EXPENSES
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(householdExpenses).where(eq(householdExpenses.clientId, cid)));
});

r.post("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(householdExpenses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[expenses POST]", err.message); res.status(500).json({ message: safeMsg(err) }); }
});

r.patch("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(householdExpenses).set(safe(req.body))
    .where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid))).returning();
  res.json(row);
});

r.delete("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  await db.delete(householdExpenses).where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid)));
  res.json({ ok: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// DRAWDOWN
// ─────────────────────────────────────────────────────────────────────────────

r.post("/clients/:clientId/drawdown", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try { res.json(runDrawdownStrategies(req.body as DrawdownInput)); }
  catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.get("/clients/:clientId/drawdown", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const { pensionPlans } = await import("../../shared/schema.js");
    const [[client], projRows, pensions] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)).limit(1),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)).limit(1),
      db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid)),
    ]);
    if (!client) return res.status(404).json({ message: "Client not found" });
    const proj = projRows[0] ?? null;
    const dobYear        = new Date(client.dateOfBirth ?? "1970-01-01").getFullYear();
    const currentAge     = proj?.currentAge    ?? (new Date().getFullYear() - dobYear);
    const retirementAge  = proj?.retirementAge ?? Number(client.retirementAge ?? 65);
    const lifeExpectancy = proj?.lifeExpectancy ?? 90;
    const rawRrsp   = Number(proj?.rrspBalance   ?? 0);
    const rawTfsa   = Number(proj?.tfsaBalance   ?? 0);
    const rawNonReg = Number(proj?.nonRegBalance ?? 0);
    const rawTotal  = rawRrsp + rawTfsa + rawNonReg;
    const projectedTotal = Number(proj?.projectedBalance ?? 0);
    const useProjected   = projectedTotal > 0 && rawTotal > 0;
    const scale          = useProjected ? projectedTotal / rawTotal : 1;
    const pensionIncome  = pensions.reduce((sum, p) => {
      if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
        return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
      if (p.pensionType === "dcpp" && p.currentBalance) return sum + Number(p.currentBalance) * 0.04;
      return sum;
    }, 0);
    const inp: DrawdownInput = {
      currentAge, retirementAge, lifeExpectancy, province: client.province ?? "ON",
      rrspBalance: Math.round(rawRrsp * scale), tfsaBalance: Math.round(rawTfsa * scale), nonRegBalance: Math.round(rawNonReg * scale),
      nonRegAcb: Math.round(rawNonReg * scale * 0.5),
      desiredAnnualIncome: Number(proj?.desiredRetirementIncome ?? client.desiredRetirementIncome ?? 50000),
      cppAnnual: Number(proj?.cppMonthly ?? 900) * 12, oasAnnual: Number(proj?.oasMonthly ?? 700) * 12,
      cppStartAge: proj?.cppStartAge ?? 65, oasStartAge: proj?.oasStartAge ?? 65,
      pensionIncome: Math.round(pensionIncome + Number(proj?.pensionIncome ?? 0)),
      expectedReturn: Number(proj?.expectedReturn ?? 6) / 100, inflationRate: Number(proj?.inflationRate ?? 2) / 100,
      bpa: 16129,
    };
    const results = runDrawdownStrategies(inp);
    res.json({ inputs: inp, useProjected, projectedTotal, nonregFirst: results.nonregFirst, meltdown: results.meltdown, blended: results.blended });
  } catch (e: any) { console.error("[drawdown GET]", e.message); res.status(500).json({ message: safeMsg(e) }); }
});

// ─────────────────────────────────────────────────────────────────────────────
// FINANCIAL PLANS
// ─────────────────────────────────────────────────────────────────────────────

r.get("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid)));
});

r.post("/clients/:clientId/plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
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

// ─────────────────────────────────────────────────────────────────────────────
// PLAN ASSUMPTIONS, SIMULATIONS, SNAPSHOTS, ACTION ITEMS
// ─────────────────────────────────────────────────────────────────────────────

r.get("/plans/:planId/assumptions", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  const pid = +req.params.planId;
  const defaults = [
    { planId: pid, scenario: "base",       equityReturn: "0.07", equityVolatility: "0.15", bondReturn: "0.04", bondVolatility: "0.05", inflationMean: "0.02",  inflationVolatility: "0.01",  corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "optimistic", equityReturn: "0.09", equityVolatility: "0.12", bondReturn: "0.05", bondVolatility: "0.04", inflationMean: "0.015", inflationVolatility: "0.008", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
    { planId: pid, scenario: "stress",     equityReturn: "0.05", equityVolatility: "0.20", bondReturn: "0.03", bondVolatility: "0.07", inflationMean: "0.03",  inflationVolatility: "0.015", corrEquityBond: "-0.15", corrEquityInflation: "0.10", corrBondInflation: "0.30", planToAge: 95, simulationCount: 1000 },
  ];
  for (const d of defaults) {
    const [ex] = await db.select({ id: planAssumptions.id }).from(planAssumptions).where(and(eq(planAssumptions.planId, pid), eq(planAssumptions.scenario, d.scenario)));
    if (!ex) await (db.insert(planAssumptions) as any).values(d);
  }
  res.json(await db.select().from(planAssumptions).where(eq(planAssumptions.planId, pid)));
});

r.get("/plans/:planId/simulation-results", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(simulationResults).where(eq(simulationResults.planId, +req.params.planId)));
});

r.post("/plans/:planId/run-simulation", async (req: AuthRequest, res: Response) => {
  const p = await ownsPlan(+req.params.planId, req.userId!);
  if (!p) return res.status(404).json({ message: "Not found" });
  try {
    const [projRow] = await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, p.clientId));
    if (!projRow) return res.status(404).json({ message: "No retirement projection found" });
    const assumptions = await db.select().from(planAssumptions).where(eq(planAssumptions.planId, +req.params.planId));
    const baseAssum = assumptions.find(a => a.scenario === "base") ?? assumptions[0];
    const goals = await db.select().from(financialGoals).where(eq(financialGoals.clientId, p.clientId));
    const currentYear = new Date().getFullYear();
    const currentAge  = projRow.currentAge ?? 35;
    const goalEvents: Array<{ yearOffset: number; amount: number; label: string }> = [];
    for (const g of goals) {
      if (!g.projectionImpact) continue;
      const targetYear = g.targetYear ?? (g.targetDate ? new Date(g.targetDate).getFullYear() : null);
      if (!targetYear) continue;
      const yearOffset = targetYear - currentYear;
      if (yearOffset < 1) continue;
      if ((g.cashflowType === "outflow" || g.cashflowType === "inflow") && g.targetAmount)
        goalEvents.push({ yearOffset, amount: (g.cashflowType === "outflow" ? -1 : 1) * Math.abs(parseFloat(String(g.targetAmount))), label: g.title });
      else if (g.cashflowType === "recurring_expense" && g.startYear && g.endYear && g.annualAmount)
        for (let yr = g.startYear; yr <= g.endYear; yr++)
          if (yr - currentYear >= 1) goalEvents.push({ yearOffset: yr - currentYear, amount: -Math.abs(parseFloat(String(g.annualAmount))), label: g.title });
    }
    const { runMonteCarloSimulation, PRESET_ALLOCATIONS } = await import("../engine/simulation/monteCarlo.js") as any;
    const result = runMonteCarloSimulation({
      initialBalance: Number(projRow.rrspBalance ?? 0) + Number(projRow.tfsaBalance ?? 0) + Number(projRow.nonRegBalance ?? 0),
      allocation: PRESET_ALLOCATIONS["MODERATE"],
      annualContribution: Number(projRow.annualContribution ?? 0),
      yearsToSimulate: Math.max(1, (projRow.lifeExpectancy ?? 90) - currentAge),
      numberOfPaths: baseAssum?.simulationCount ?? 1000,
      inflationRate: Number(projRow.inflationRate ?? 2) / 100,
      goalEvents: goalEvents.length > 0 ? goalEvents : undefined,
    });
    (result as any).goalEventCount = goalEvents.length;
    (result as any).goalEventSummary = goalEvents.map(e => ({ label: e.label, yearOffset: e.yearOffset, year: currentYear + e.yearOffset, amount: e.amount }));
    res.json(result);
  } catch (e: any) { console.error("[run-simulation]", e.message); res.status(500).json({ message: safeMsg(e) }); }
});

r.get("/plans/:planId/stale-flags",          async (req: AuthRequest, res: Response) => { const p = await ownsPlan(+req.params.planId, req.userId!); if (!p) return res.status(404).json({ message: "Not found" }); res.json(await db.select().from(planStaleFlags).where(eq(planStaleFlags.planId, +req.params.planId))); });
r.get("/plans/:planId/snapshots",            async (req: AuthRequest, res: Response) => { const p = await ownsPlan(+req.params.planId, req.userId!); if (!p) return res.status(404).json({ message: "Not found" }); res.json(await db.select().from(planSnapshots).where(eq(planSnapshots.planId, +req.params.planId))); });
r.post("/plans/:planId/snapshots",           async (req: AuthRequest, res: Response) => { const p = await ownsPlan(+req.params.planId, req.userId!); if (!p) return res.status(404).json({ message: "Not found" }); const [row] = await (db.insert(planSnapshots) as any).values({ planId: +req.params.planId, snapshotData: req.body, trigger: req.body.trigger ?? "manual" }).returning(); res.status(201).json(row); });
r.get("/plans/:planId/snapshot-comparison",  async (_req, res) => res.json([]));
r.get("/plans/:planId/scenario-comparison",  async (_req, res) => res.json([]));
r.get("/plans/:planId/action-items",         async (req: AuthRequest, res: Response) => { const p = await ownsPlan(+req.params.planId, req.userId!); if (!p) return res.status(404).json({ message: "Not found" }); res.json(await db.select().from(planActionItems).where(eq(planActionItems.planId, +req.params.planId))); });
r.post("/plans/:planId/action-items",        async (req: AuthRequest, res: Response) => { const p = await ownsPlan(+req.params.planId, req.userId!); if (!p) return res.status(404).json({ message: "Not found" }); const [row] = await (db.insert(planActionItems) as any).values({ planId: +req.params.planId, ...safe(req.body) }).returning(); res.status(201).json(row); });
r.put("/action-items/:id",                   async (req: AuthRequest, res: Response) => { const [ex] = await db.select().from(planActionItems).where(eq(planActionItems.id, +req.params.id)); if (!ex) return res.status(404).json({ message: "Not found" }); const [u] = await db.update(planActionItems).set(safe(req.body)).where(eq(planActionItems.id, ex.id)).returning(); res.json(u); });
r.delete("/action-items/:id",                async (req: AuthRequest, res: Response) => { const [ex] = await db.select({ id: planActionItems.id, planId: planActionItems.planId }).from(planActionItems).where(eq(planActionItems.id, +req.params.id)); if (!ex) return res.status(404).json({ message: "Not found" }); if (!await ownsPlan(ex.planId, req.userId!)) return res.status(404).json({ message: "Not found" }); await db.delete(planActionItems).where(eq(planActionItems.id, ex.id)); res.json({ ok: true }); });

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS & PLAN GENERATION
// ─────────────────────────────────────────────────────────────────────────────

r.get("/reports/:clientId/available", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const [ret] = await db.select({ id: retirementProjections.id }).from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  const [ins] = await db.select({ id: insuranceAnalyses.id }).from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid));
  res.json({ retirement: !!ret, insurance: !!ins, netWorth: true });
});

r.get("/clients/:clientId/financial-planning-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.clientId, cid));
    const [client] = await db.select().from(clients).where(eq(clients.id, cid));
    const { generateComprehensiveReport } = await import("../services/reportGenerator.js") as any;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(generateComprehensiveReport({ plan, client } as any));
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.post("/clients/:clientId/financial-plan-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const { plan } = req.body;
    if (!plan) return res.status(400).json({ message: "plan is required" });
    const [clientRow] = await db.select().from(clients).where(eq(clients.id, cid));
    if (!clientRow) return res.status(404).json({ message: "Client not found" });

    // PIPEDA: log report generation (client data rendered and sent to browser)
    await auditWrite({
      userId:       req.userId,
      action:       AuditAction.REPORT_PRINTED,
      resourceType: "financial_plan_report",
      clientId:     cid,
      dataCategories: [
        DataCategory.PERSONAL_INFO, DataCategory.INCOME, DataCategory.NET_WORTH,
        DataCategory.RETIREMENT,    DataCategory.INSURANCE,
      ].join(",") as any,
      purposeCode:    "financial_plan_report",
      ipAddress:      req.ip,
      correlationId:  (req as any).id,
      jurisdiction:   req.userJurisdiction ?? "CA",
    });

    const { generateFinancialPlanReport } = await import("../services/reportGenerator.js") as any;
    const html = generateFinancialPlanReport({ plan, client: clientRow, locale: (clientRow.preferredLanguage ?? "en") as any });

    // Generate PDF via headless Chromium and stream directly to browser
    const { generatePdfFromHtml } = await import("../services/pdfService.js") as any;
    console.log("[financial-plan-report] starting PDF generation");
    const pdfBuffer = await generatePdfFromHtml(html).catch((err: any) => {
      console.error("[financial-plan-report] PDF generation error:", err?.message ?? err);
      console.error("[financial-plan-report] PDF stack:", err?.stack ?? "no stack");
      throw err;
    });
    console.log("[financial-plan-report] PDF generated, size:", pdfBuffer.length);
    const safeName = `${(clientRow.firstName ?? "client").replace(/[^a-z0-9]/gi, "_")}_Financial_Plan_${new Date().toISOString().slice(0,10)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Content-Length", pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (e: any) { console.error("[financial-plan-report] FULL ERROR:", e?.stack ?? e); res.status(500).json({ message: e?.message ?? "Unknown error", detail: e?.stack?.split("\n")[1] ?? "" }); }
});

// ── Streaming generate-plan (SSE) — fixes Cloudflare 524 timeout ─────────────
// Streams Anthropic chunks to the browser so Cloudflare sees activity immediately.
// Sends: data: <base64-chunk>\n\n  per text delta
//        data: [DONE]::<base64-full-plan-json>\n\n  when complete
//        data: [ERROR]::<message>\n\n  on failure
r.post("/clients/:clientId/generate-plan-stream", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
  try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });

  // Set SSE headers immediately — Cloudflare sees an active response right away
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Heartbeat every 15s to keep proxies from closing an idle connection
  const heartbeat = setInterval(() => { res.write(": heartbeat\n\n"); }, 15_000);

  const sendEvent = (data: string) => res.write(`data: ${data}\n\n`);
  const sendError = (msg: string) => { sendEvent(`[ERROR]::${msg}`); clearInterval(heartbeat); res.end(); };

  try {
    await auditAnthropicCall({
      req, action: AuditAction.AI_FINANCIAL_PLAN,
      clientId: cid,
      dataCategories: [
        DataCategory.PERSONAL_INFO, DataCategory.INCOME, DataCategory.NET_WORTH,
        DataCategory.RETIREMENT,    DataCategory.INSURANCE, DataCategory.DEBT,
        DataCategory.TAX,           DataCategory.ESTATE,    DataCategory.EDUCATION,
        DataCategory.GOALS,         DataCategory.PENSION,
      ],
      purposeCode: "financial_plan",
    });

    const [clientRows, nw, ret, ins, edu, debt, tax, estate, goals, pensions] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)),
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
      db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
      db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, cid)),
      db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, cid)),
      db.select().from(financialGoals).where(eq(financialGoals.clientId, cid)),
      (db as any).select().from((await import("../../shared/schema.js") as any).pensionPlans)
        .where(eq((await import("../../shared/schema.js") as any).pensionPlans.clientId, cid))
        .catch(() => []),
    ]);

    const client = clientRows[0];
    if (!client) return sendError("Client not found");

    const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
    const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
    const retProj     = ret[0] as any;
    const insData     = ins[0] as any;

    const context = {
      client: {
        name: `${client.firstName} ${client.lastName}`,
        age: client.dateOfBirth ? new Date().getFullYear() - new Date(client.dateOfBirth as string).getFullYear() : null,
        spouseName: client.spouseFirstName ? `${client.spouseFirstName} ${(client as any).spouseLastName ?? ""}`.trim() : null,
        province: (client as any).province ?? "ON",
        annualIncome: Number((client as any).annualIncome ?? 0),
        spouseIncome: Number((client as any).spouseAnnualIncome ?? 0),
        retirementAge: (client as any).retirementAge ?? 65,
        maritalStatus: (client as any).maritalStatus ?? "unknown",
        employmentStatus: (client as any).employmentStatus ?? "unknown",
      },
      netWorth: {
        totalAssets: assets, totalLiabilities: liabilities, netWorth: assets - liabilities,
        assets:      nw.filter(e => e.type === "asset").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })),
        liabilities: nw.filter(e => e.type === "liability").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })),
      },
      retirement: retProj ? {
        currentAge: retProj.currentAge, retirementAge: retProj.retirementAge, lifeExpectancy: retProj.lifeExpectancy,
        rrspBalance: Number(retProj.rrspBalance ?? 0), tfsaBalance: Number(retProj.tfsaBalance ?? 0),
        nonRegBalance: Number(retProj.nonRegBalance ?? 0), annualContribution: Number(retProj.annualContribution ?? 0),
        desiredIncome: Number(retProj.desiredRetirementIncome ?? 0), pensionIncome: Number(retProj.pensionIncome ?? 0),
        cppMonthly: Number(retProj.cppMonthly ?? 0), oasMonthly: Number(retProj.oasMonthly ?? 0),
        successRate: Number(retProj.successRate ?? 0), projectedBalance: Number(retProj.projectedBalance ?? 0),
        shortfallSurplus: Number(retProj.shortfallSurplus ?? 0),
      } : null,
      insurance: insData ? {
        lifeInsuranceGap: Number((insData as any).lifeInsuranceGap ?? 0),
        disabilityGap:    Number((insData as any).disabilityGap ?? 0),
        criticalIllnessGap: Number((insData as any).criticalIllnessGap ?? 0),
      } : null,
      debt: [
        ...debt.map(d => ({ name: d.name, category: d.category, balance: Number(d.balance), interestRate: Number(d.interestRate), minimumPayment: Number(d.minimumPayment) })),
        ...nw.filter(e => e.type === "liability" && !debt.find(d => d.name?.toLowerCase() === e.name?.toLowerCase()))
           .map(e => ({ name: e.name, category: e.category, balance: Number(e.value), interestRate: null, minimumPayment: null })),
      ],
      education: edu.map(e => ({ childName: (e as any).childName, targetAmount: Number((e as any).targetAmount ?? 0), currentBalance: Number((e as any).currentBalance ?? 0), targetAge: (e as any).targetAge, childAge: (e as any).childAge })),
      goals:     goals.slice(0, 5).map(g => ({ title: g.title, goalType: g.goalType, targetAmount: Number(g.targetAmount ?? 0), targetYear: g.targetYear, priority: g.priority, status: g.status })),
      tax:       tax.slice(0, 3).map(t => ({ category: (t as any).category, title: (t as any).title, content: (t as any).content })),
      estate:    estate.slice(0, 3).map(e => ({ category: (e as any).category, title: (e as any).title, content: (e as any).content })),
      pensions,
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return sendError("ANTHROPIC_API_KEY not configured");

    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        stream: true,
        system: `You are a senior Canadian Certified Financial Planner (CFP) with 20 years of experience. Generate a comprehensive written financial plan for a Canadian client. Your analysis must be specific, quantitative where data is available, and written in clear advisor language suitable for client presentation. Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.`,
        messages: [{ role: "user", content: `Generate a comprehensive financial plan. Client data:\n\n${JSON.stringify(context, null, 2)}\n\nReturn JSON with: executiveSummary (score 1-5, headline, narrative 3-4 paragraphs, keyStrengths[], keyGaps[]), sections[] (id, title, score 1-5, status, narrative, recommendations[{priority, action, impact, timeline}]), priorityActions[] (rank 1-5, title, description, section, priority, timeline), disclaimer string.` }],
      }),
    });

    if (!claudeRes.ok || !claudeRes.body) {
      const errText = await claudeRes.text().catch(() => "unknown");
      return sendError(`Anthropic error ${claudeRes.status}: ${errText}`);
    }

    // Stream chunks to the browser
    let fullText = "";
    const reader  = claudeRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") continue;
        try {
          const evt = JSON.parse(raw);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const chunk = evt.delta.text ?? "";
            fullText += chunk;
            sendEvent(Buffer.from(chunk).toString("base64"));
          }
        } catch { /* ignore malformed SSE lines */ }
      }
    }

    // Parse completed JSON
    const startObj = fullText.indexOf("{");
    const startArr = fullText.indexOf("[");
    const start    = startObj !== -1 && (startArr === -1 || startObj < startArr) ? startObj : startArr;
    const end      = start !== -1 && fullText[start] === "[" ? fullText.lastIndexOf("]") : fullText.lastIndexOf("}");
    const cleaned  = start !== -1 && end !== -1
      ? fullText.slice(start, end + 1)
      : fullText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

    let plan: any;
    try { plan = JSON.parse(cleaned); }
    catch (parseErr: any) {
      console.error("[generate-plan-stream] JSON parse failed. First 500 chars:", fullText.slice(0, 500));
      console.error("[generate-plan-stream] Last 500 chars:", fullText.slice(-500));
      console.error("[generate-plan-stream] cleaned first 200:", cleaned.slice(0, 200));
      return sendError("Failed to parse AI response — JSON was malformed");
    }

    plan.generatedAt  = new Date().toISOString();
    plan.clientId     = cid;
    plan.clientName   = `${client.firstName} ${client.lastName}`;
    plan.dataSnapshot = {
      netWorth:    assets - liabilities,
      totalDebt:   debt.length > 0 ? debt.reduce((s, d) => s + Number(d.balance), 0) : liabilities,
      successRate: retProj ? Number(retProj.successRate ?? 0) : null,
    };

    await (db.insert(aiRecommendations) as any).values({
      clientId: cid,
      title:    "Financial Plan — " + new Date().toLocaleDateString("en-CA"),
      content:  JSON.stringify(plan),
      category: "financial_plan",
      priority: "high",
      status:   "active",
    }).catch(() => {});

    sendEvent(`[DONE]::${Buffer.from(JSON.stringify(plan)).toString("base64")}`);
    clearInterval(heartbeat);
    res.end();

  } catch (e: any) {
    console.error("[generate-plan-stream]", e.message);
    sendError(e.message);
  }
});

r.post("/clients/:clientId/generate-plan", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    // PIPEDA: log before sending data to Anthropic
    await auditAnthropicCall({
      req, action: AuditAction.AI_FINANCIAL_PLAN,
      clientId:       cid,
      dataCategories: [
        DataCategory.PERSONAL_INFO, DataCategory.INCOME, DataCategory.NET_WORTH,
        DataCategory.RETIREMENT,    DataCategory.INSURANCE, DataCategory.DEBT,
        DataCategory.TAX,           DataCategory.ESTATE,    DataCategory.EDUCATION,
        DataCategory.GOALS,         DataCategory.PENSION,
      ],
      purposeCode: "financial_plan",
    });

    const [clientRows, nw, ret, ins, edu, debt, tax, estate, goals, pensions] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)),
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
      db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
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
    const retProj = ret[0] as any;
    const insData = ins[0] as any;
    const context = {
      client: { name: `${client.firstName} ${client.lastName}`, age: client.dateOfBirth ? new Date().getFullYear() - new Date(client.dateOfBirth as string).getFullYear() : null, spouseName: client.spouseFirstName ? `${client.spouseFirstName} ${(client as any).spouseLastName ?? ""}`.trim() : null, province: (client as any).province ?? "ON", annualIncome: Number((client as any).annualIncome ?? 0), spouseIncome: Number((client as any).spouseAnnualIncome ?? 0), retirementAge: (client as any).retirementAge ?? 65, maritalStatus: (client as any).maritalStatus ?? "unknown", employmentStatus: (client as any).employmentStatus ?? "unknown" },
      netWorth: { totalAssets: assets, totalLiabilities: liabilities, netWorth: assets - liabilities, assets: nw.filter(e => e.type === "asset").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })), liabilities: nw.filter(e => e.type === "liability").map(e => ({ name: e.name, category: e.category, value: Number(e.value) })) },
      retirement: retProj ? { currentAge: retProj.currentAge, retirementAge: retProj.retirementAge, lifeExpectancy: retProj.lifeExpectancy, rrspBalance: Number(retProj.rrspBalance ?? 0), tfsaBalance: Number(retProj.tfsaBalance ?? 0), nonRegBalance: Number(retProj.nonRegBalance ?? 0), annualContribution: Number(retProj.annualContribution ?? 0), desiredIncome: Number(retProj.desiredRetirementIncome ?? 0), pensionIncome: Number(retProj.pensionIncome ?? 0), cppMonthly: Number(retProj.cppMonthly ?? 0), oasMonthly: Number(retProj.oasMonthly ?? 0), successRate: Number(retProj.successRate ?? 0), projectedBalance: Number(retProj.projectedBalance ?? 0), shortfallSurplus: Number(retProj.shortfallSurplus ?? 0) } : null,
      insurance: insData ? { lifeInsuranceGap: Number((insData as any).lifeInsuranceGap ?? 0), disabilityGap: Number((insData as any).disabilityGap ?? 0), criticalIllnessGap: Number((insData as any).criticalIllnessGap ?? 0) } : null,
      debt: [
        ...debt.map(d => ({ name: d.name, category: d.category, balance: Number(d.balance), interestRate: Number(d.interestRate), minimumPayment: Number(d.minimumPayment), source: "debt_entries" })),
        ...nw.filter(e => e.type === "liability" && !debt.find(d => d.name?.toLowerCase() === e.name?.toLowerCase()))
           .map(e => ({ name: e.name, category: e.category, balance: Number(e.value), interestRate: null, minimumPayment: null, source: "net_worth" })),
      ],
      education: edu.map(e => ({ childName: (e as any).childName, targetAmount: Number((e as any).targetAmount ?? 0), currentBalance: Number((e as any).currentBalance ?? 0), targetAge: (e as any).targetAge, childAge: (e as any).childAge })),
      goals: goals.map(g => ({ title: g.title, goalType: g.goalType, cashflowType: g.cashflowType, targetAmount: Number(g.targetAmount ?? 0), targetYear: g.targetYear, priority: g.priority, projectionImpact: g.projectionImpact, status: g.status })),
      tax: tax.map(t => ({ category: (t as any).category, title: (t as any).title, content: (t as any).content })),
      estate: estate.map(e => ({ category: (e as any).category, title: (e as any).title, content: (e as any).content })),
      pensions,
    };
    const trimmedContext = {
  ...context,
  tax: context.tax.slice(0, 3),
  estate: context.estate.slice(0, 3),
  goals: context.goals.slice(0, 5),
};
const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ message: "ANTHROPIC_API_KEY not configured" });
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model:  "claude-sonnet-4-6", max_tokens: 12000,
        system: `You are a senior Canadian Certified Financial Planner (CFP) with 20 years of experience. Generate a comprehensive written financial plan for a Canadian client. Your analysis must be specific, quantitative where data is available, and written in clear advisor language suitable for client presentation. Respond ONLY with a valid JSON object — no preamble, no markdown fences, no explanation outside the JSON.`,
        messages: [{ role: "user", content: `Generate a comprehensive financial plan. Client data:\n\n${JSON.stringify(context, null, 2)}\n\nReturn JSON with: executiveSummary (score 1-5, headline, narrative 3-4 paragraphs, keyStrengths[], keyGaps[]), sections[] (id, title, score 1-5, status, narrative, recommendations[{priority, action, impact, timeline}]), priorityActions[] (rank 1-5, title, description, section, priority, timeline), disclaimer string.` }],
      }),
    });
    if (!claudeRes.ok) return res.status(500).json({ message: "AI generation failed" });
    const claudeData = await claudeRes.json() as any;
    const rawText = claudeData.content?.[0]?.text ?? "[]";
const startObj = rawText.indexOf("{");
const startArr = rawText.indexOf("[");
const start = startObj !== -1 && (startArr === -1 || startObj < startArr) ? startObj : startArr;
const end = start !== -1 && rawText[start] === "[" ? rawText.lastIndexOf("]") : rawText.lastIndexOf("}");
const cleaned = start !== -1 && end !== -1 ? rawText.slice(start, end + 1) : rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let plan: any;
    try { plan = JSON.parse(cleaned); }
    catch { return res.status(500).json({ message: "Failed to parse AI response" }); }
    plan.generatedAt = new Date().toISOString(); plan.clientId = cid; plan.clientName = `${client.firstName} ${client.lastName}`;
    plan.dataSnapshot = { netWorth: assets - liabilities, totalDebt: debt.length > 0 ? debt.reduce((s, d) => s + Number(d.balance), 0) : liabilities, successRate: retProj ? Number(retProj.successRate ?? 0) : null };
    await (db.insert(aiRecommendations) as any).values({ clientId: cid, title: "Financial Plan — " + new Date().toLocaleDateString("en-CA"), content: JSON.stringify(plan), category: "financial_plan", priority: "high", status: "active" }).catch(() => {});
    res.json(plan);
  } catch (e: any) { console.error("[generate-plan]", e.message); res.status(500).json({ message: safeMsg(e) }); }
});

r.get("/clients/:clientId/saved-plans", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const rows = await db.select({ id: aiRecommendations.id, title: aiRecommendations.title, createdAt: aiRecommendations.createdAt, content: aiRecommendations.content }).from(aiRecommendations)
    .where(and(eq(aiRecommendations.clientId, cid), eq(aiRecommendations.category, "financial_plan")));
  res.json(rows.map(r => ({ ...r, plan: (() => { try { return JSON.parse(r.content ?? "{}"); } catch { return null; } })() })));
});

r.delete("/saved-plans/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});


// ── Saved Reports ─────────────────────────────────────────────────────────────

r.post("/clients/:clientId/saved-reports", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
  try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  try {
    const { title, locale = "en", sections = "all", htmlContent } = req.body;
    if (!htmlContent) return res.status(400).json({ message: "htmlContent required" });
    const [row] = await db.insert(savedReports).values({
      clientId: cid, title: title || "Report", locale, sections,
      htmlContent, advisorId: req.userId ?? null,
    }).returning({ id: savedReports.id, generatedAt: savedReports.generatedAt });
    res.json(row);
  } catch (e: any) { res.status(500).json({ message: safeMsg(e) }); }
});

r.get("/clients/:clientId/saved-reports", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  let _owns = false;
  try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  const rows = await db.select({
    id: savedReports.id, title: savedReports.title, locale: savedReports.locale,
    sections: savedReports.sections, generatedAt: savedReports.generatedAt,
  }).from(savedReports).where(eq(savedReports.clientId, cid))
    .orderBy(savedReports.generatedAt);
  res.json(rows);
});

r.get("/saved-reports/:id", async (req: AuthRequest, res: Response) => {
  const [row] = await db.select().from(savedReports).where(eq(savedReports.id, +req.params.id));
  if (!row) return res.status(404).json({ message: "Not found" });
  let _owns = false;
  try { _owns = await ownsClient(row.clientId, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  res.json(row);
});

r.delete("/saved-reports/:id", async (req: AuthRequest, res: Response) => {
  const [row] = await db.select({ id: savedReports.id, clientId: savedReports.clientId })
    .from(savedReports).where(eq(savedReports.id, +req.params.id));
  if (!row) return res.status(404).json({ message: "Not found" });
  let _owns = false;
  try { _owns = await ownsClient(row.clientId, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
  if (!_owns) return res.status(404).json({ message: "Not found" });
  await db.delete(savedReports).where(eq(savedReports.id, row.id));
  res.json({ ok: true });
});

export { r as financialRouter };

// ── Scenario Comparisons ──────────────────────────────────────────────────────

r.get("/clients/:id/scenario-comparisons", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(scenarioComparisons)
    .where(eq(scenarioComparisons.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/scenario-comparisons", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const { label, scenarioIds, notes } = req.body;
  if (!Array.isArray(scenarioIds) || scenarioIds.length < 2) {
    return res.status(400).json({ message: "scenarioIds must be an array of 2–3 projection IDs" });
  }
  const [row] = await (db.insert(scenarioComparisons) as any).values({
    clientId: cid, label: label || "Scenario Comparison",
    scenarioIds, notes: notes || null,
  }).returning();
  res.status(201).json(row);
});

r.delete("/scenario-comparisons/:id", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const id = +req.params.id;
  const [row] = await db.select().from(scenarioComparisons)
    .where(eq(scenarioComparisons.id, id));
  if (!row) return res.status(404).json({ message: "Not found" });
  if (!await ownsClient(row.clientId, req.userId!))
    return res.status(403).json({ message: "Forbidden" });
  await db.delete(scenarioComparisons).where(eq(scenarioComparisons.id, id));
  res.json({ deleted: true });
});

// ── New projection engine — year-by-year data ──────────────────────────────────

r.post("/clients/:id/retirement/:projId/project", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid    = +req.params.id;
  const projId = +req.params.projId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });

  const [proj] = await db.select().from(retirementProjections)
    .where(eq(retirementProjections.id, projId));
  if (!proj) return res.status(404).json({ message: "Projection not found" });

  // Get client province
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const province = (proj as any).province || client?.province || "ON";

  try {
    const { runCanadianProjection } = await import("../engine/canadianRetirementEngine.js");
    const result = runCanadianProjection({
      currentAge:              Number((proj as any).currentAge   || 40),
      retirementAge:           Number((proj as any).retirementAge || 65),
      lifeExpectancy:          Number((proj as any).lifeExpectancy || 90),
      province:                province as any,
      rrspBalance:             Number((proj as any).rrspBalance   || 0),
      tfsaBalance:             Number((proj as any).tfsaBalance   || 0),
      nonRegBalance:           Number((proj as any).nonRegBalance  || 0),
      nonRegTaxType:           ((proj as any).nonRegTaxType || "mixed") as any,
      nonRegAcb:               Number((proj as any).nonRegAcb      || 0),
      annualRrspContrib:       Number((proj as any).annualContribution || 0),
      annualTfsaContrib:       Number((proj as any).annualTfsaContribution || 0),
      desiredRetirementIncome: Number((proj as any).desiredRetirementIncome || 0),
      pensionAnnual:           Number((proj as any).pensionIncome  || 0),
      pensionStartAge:         Number((proj as any).pensionStartAge || 65),
      pensionIndexed:          Boolean((proj as any).pensionIndexed),
      bridgeBenefitAnnual:     Number((proj as any).bridgeBenefit  || 0),
      bridgeBenefitEndAge:     Number((proj as any).bridgeEndAge   || 65),
      cppMonthly:              Number((proj as any).cppMonthly     || 0),
      cppStartAge:             Number((proj as any).cppStartAge    || 65),
      oasMonthly:              Number((proj as any).oasMonthly     || 0),
      oasStartAge:             Number((proj as any).oasStartAge    || 65),
      expectedReturnPct:       Number((proj as any).expectedReturn  || 6.5),
      inflationPct:            Number((proj as any).inflationRate   || 2.0),
    });

    // Store year-by-year data on the projection record
    await db.execute(
      sql`UPDATE retirement_projections SET projection_data = ${JSON.stringify(result)}::jsonb, updated_at = NOW() WHERE id = ${projId}`
    );

    res.json(result);
  } catch (err: any) {
    console.error("Engine error:", err);
    res.status(500).json({ message: "Engine error", detail: safeMsg(err) });
  }
});

// Fetch stored year-by-year data for a projection
r.get("/clients/:id/retirement/:projId/projection-data", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid    = +req.params.id;
  const projId = +req.params.projId;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });

  const [proj] = await db.select().from(retirementProjections)
    .where(eq(retirementProjections.id, projId));
  if (!proj) return res.status(404).json({ message: "Not found" });

  const data = (proj as any).projectionData;
  if (!data) return res.status(404).json({ message: "No projection data — run the engine first" });
  res.json(data);
});

// ── LTC Analyses ─────────────────────────────────────────────────────────────

r.get("/clients/:id/ltc-analyses", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(ltcAnalyses).where(eq(ltcAnalyses.clientId, cid));
  res.json(rows);
});

r.post("/clients/:id/ltc-analyses", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const b = req.body;
  const { runLTCEngine } = await import("../engine/ltcEngine.js");
  const result = runLTCEngine({
    currentAge: +b.currentAge||55, province: b.province||"ON",
    dailyBenefit: +b.dailyBenefit||200, poolYears: (+b.poolYears||5) as any,
    eliminationDays: (+b.eliminationDays||90) as any, inflationProtection: (b.inflationProtection||"none") as any,
    estAnnualPremium: +b.estAnnualPremium||0, careCostInflation: +b.careCostInflation||0.04,
    estClaimAge: +b.estClaimAge||80, careLevel: (b.careLevel||"semi_private") as any,
    hybridLifeBenefit: b.hybridLifeBenefit ? +b.hybridLifeBenefit : undefined,
    hybridLtcPct: b.hybridLtcPct ? +b.hybridLtcPct : undefined,
  });
  const [row] = await (db.insert(ltcAnalyses) as any).values({
    clientId: cid, person: b.person||"primary", label: b.label||null,
    currentAge: +b.currentAge||55, province: b.province||"ON",
    dailyBenefit: String(+b.dailyBenefit||200), poolYears: +b.poolYears||5,
    eliminationDays: +b.eliminationDays||90, inflationProtection: b.inflationProtection||"none",
    estAnnualPremium: b.estAnnualPremium ? String(b.estAnnualPremium) : null,
    careCostInflation: String(+b.careCostInflation||0.04), estClaimAge: +b.estClaimAge||80,
    careLevel: b.careLevel||"semi_private",
    hybridLifeBenefit: b.hybridLifeBenefit ? String(b.hybridLifeBenefit) : null,
    hybridLtcPct: b.hybridLtcPct ? String(b.hybridLtcPct) : null,
    notes: b.notes||null, resultData: result,
  }).returning();
  res.status(201).json({ ...row, result });
});

r.patch("/clients/:id/ltc-analyses/:aid", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id; const aid = +req.params.aid;
  if (!await ownsClient(cid, req.userId!)) return res.status(403).json({ message: "Forbidden" });
  const b = req.body;
  const { runLTCEngine } = await import("../engine/ltcEngine.js");
  const result = runLTCEngine({
    currentAge: +b.currentAge||55, province: b.province||"ON",
    dailyBenefit: +b.dailyBenefit||200, poolYears: (+b.poolYears||5) as any,
    eliminationDays: (+b.eliminationDays||90) as any, inflationProtection: (b.inflationProtection||"none") as any,
    estAnnualPremium: +b.estAnnualPremium||0, careCostInflation: +b.careCostInflation||0.04,
    estClaimAge: +b.estClaimAge||80, careLevel: (b.careLevel||"semi_private") as any,
    hybridLifeBenefit: b.hybridLifeBenefit ? +b.hybridLifeBenefit : undefined,
    hybridLtcPct: b.hybridLtcPct ? +b.hybridLtcPct : undefined,
  });
  await (db.update(ltcAnalyses) as any).set({
    label: b.label||null, currentAge: +b.currentAge||55, province: b.province||"ON",
    dailyBenefit: String(+b.dailyBenefit||200), poolYears: +b.poolYears||5,
    eliminationDays: +b.eliminationDays||90, inflationProtection: b.inflationProtection||"none",
    estAnnualPremium: b.estAnnualPremium ? String(b.estAnnualPremium) : null,
    careCostInflation: String(+b.careCostInflation||0.04), estClaimAge: +b.estClaimAge||80,
    careLevel: b.careLevel||"semi_private",
    hybridLifeBenefit: b.hybridLifeBenefit ? String(b.hybridLifeBenefit) : null,
    hybridLtcPct: b.hybridLtcPct ? String(b.hybridLtcPct) : null,
    notes: b.notes||null, resultData: result, updatedAt: new Date(),
  }).where(eq(ltcAnalyses.id, aid));
  const [row] = await db.select().from(ltcAnalyses).where(eq(ltcAnalyses.id, aid));
  res.json({ ...row, result });
});

r.delete("/clients/:id/ltc-analyses/:aid", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id; const aid = +req.params.aid;
  if (!await ownsClient(cid, req.userId!)) return res.status(403).json({ message: "Forbidden" });
  await db.delete(ltcAnalyses).where(eq(ltcAnalyses.id, aid));
  res.json({ deleted: true });
});

export default r;

// ── DI Analyses ───────────────────────────────────────────────────────────────

r.get("/clients/:id/di-analyses", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const rows = await db.select().from(diAnalyses).where(eq(diAnalyses.clientId, cid));
  res.json(rows);
});

async function runDI(b: any) {
  const { runDIEngine } = await import("../engine/diEngine.js");
  return runDIEngine({
    currentAge:           +b.currentAge||40,
    province:             b.province||"ON",
    grossMonthlyIncome:   +b.grossMonthlyIncome||0,
    occupationClass:      (b.occupationClass||"3A") as any,
    definition:           (b.definition||"own_occ") as any,
    waitingPeriodDays:    +b.waitingPeriodDays||90,
    benefitPeriod:        (b.benefitPeriod||"age65") as any,
    groupDiMonthly:       +b.groupDiMonthly||0,
    groupDiEmployerPaid:  b.groupDiEmployerPaid !== false,
    individualDiMonthly:  +b.individualDiMonthly||0,
    cppDisabilityMonthly: +b.cppDisabilityMonthly||0,
    partialDisabilityPct: +b.partialDisabilityPct||0.5,
    colaPct:              +b.colaPct||0.02,
  });
}

r.post("/clients/:id/di-analyses", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  let _owns = false;
    try { _owns = await ownsClient(cid, req.userId!); } catch (e: any) { return res.status(500).json({ message: safeMsg(e, "Auth check failed: ") }); }
    if (!_owns) return res.status(404).json({ message: "Not found" });
  const b = req.body;
  const result = await runDI(b);
  const [row] = await (db.insert(diAnalyses) as any).values({
    clientId: cid, person: b.person||"primary", label: b.label||null,
    grossMonthlyIncome: String(+b.grossMonthlyIncome||0),
    occupationClass: b.occupationClass||"3A", definition: b.definition||"own_occ",
    waitingPeriodDays: +b.waitingPeriodDays||90, benefitPeriod: b.benefitPeriod||"age65",
    groupDiMonthly: String(+b.groupDiMonthly||0),
    groupDiEmployerPaid: b.groupDiEmployerPaid !== false,
    individualDiMonthly: String(+b.individualDiMonthly||0),
    cppDisabilityMonthly: String(+b.cppDisabilityMonthly||0),
    partialDisabilityPct: String(+b.partialDisabilityPct||0.5),
    colaPct: String(+b.colaPct||0.02), province: b.province||"ON",
    notes: b.notes||null, resultData: result,
  }).returning();
  res.status(201).json({ ...row, result });
});

r.patch("/clients/:id/di-analyses/:aid", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id; const aid = +req.params.aid;
  if (!await ownsClient(cid, req.userId!)) return res.status(403).json({ message: "Forbidden" });
  const b = req.body;
  const result = await runDI(b);
  await (db.update(diAnalyses) as any).set({
    label: b.label||null, grossMonthlyIncome: String(+b.grossMonthlyIncome||0),
    occupationClass: b.occupationClass||"3A", definition: b.definition||"own_occ",
    waitingPeriodDays: +b.waitingPeriodDays||90, benefitPeriod: b.benefitPeriod||"age65",
    groupDiMonthly: String(+b.groupDiMonthly||0),
    groupDiEmployerPaid: b.groupDiEmployerPaid !== false,
    individualDiMonthly: String(+b.individualDiMonthly||0),
    cppDisabilityMonthly: String(+b.cppDisabilityMonthly||0),
    partialDisabilityPct: String(+b.partialDisabilityPct||0.5),
    colaPct: String(+b.colaPct||0.02), province: b.province||"ON",
    notes: b.notes||null, resultData: result, updatedAt: new Date(),
  }).where(eq(diAnalyses.id, aid));
  const [row] = await db.select().from(diAnalyses).where(eq(diAnalyses.id, aid));
  res.json({ ...row, result });
});

r.delete("/clients/:id/di-analyses/:aid", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id; const aid = +req.params.aid;
  if (!await ownsClient(cid, req.userId!)) return res.status(403).json({ message: "Forbidden" });
  await db.delete(diAnalyses).where(eq(diAnalyses.id, aid));
  res.json({ deleted: true });
});
