import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import {
  clients, financialPlans as plans, netWorthEntries, retirementProjections,
  insuranceAnalyses, educationSavings as educationPlans, debtEntries, clientPolicies, householdExpenses,
  taxPlanningNotes as taxNotes, estatePlanningNotes as estateNotes, aiRecommendations,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { safe, ownsClient } from "../fpUtils.js";   // Item 3: shared utils
import { eq, and } from "drizzle-orm";
import { runDrawdownStrategies, type DrawdownInput } from "../engine/drawdown.js";

const r = Router();
r.use(isAuthenticated);

// ── Overview ──────────────────────────────────────────────────────────────────
r.get("/clients/:id/overview", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });

  const [nw, ret, ins, edu, debt, tax, estate, ai, clientPlans] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)),
    db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
    db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)),
    db.select().from(estateNotes).where(eq(estateNotes.clientId, cid)),
    db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)),
    db.select().from(plans).where(eq(plans.clientId, cid)),
  ]);

  const assets      = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const liabilities = nw.filter(e => e.type === "liability").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt   = debt.reduce((s, d) => s + Number(d.balance), 0);

  res.json({
    netWorth: assets - liabilities,
    totalAssets: assets,
    totalLiabilities: liabilities,
    totalDebt,
    retirementProjections: ret.length,
    insuranceAnalyses: ins.length,
    educationPlans: edu.length,
    taxNotes: tax.length,
    estateNotes: estate.length,
    aiRecommendations: ai.length,
    pendingAi: ai.filter(a => a.status === "pending").length,
    plans: clientPlans.length,
  });
});

// ── Net Worth ─────────────────────────────────────────────────────────────────
// Canonical net worth CRUD — fp-full.ts net worth handlers removed (Items 1 & 2).
// Frontend uses: GET, POST /clients/:id/net-worth  |  PUT, DELETE /net-worth/:id

r.get("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)));
});

r.post("/clients/:id/net-worth", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    // Accept either wrapped { data: {...} } or flat body (Item 1: match fp-full.ts contract)
    const payload = req.body.data ?? req.body;
    const { type, category, name, value, owner, notes, metadata } = payload;
    const [row] = await db.insert(netWorthEntries)
      .values({ clientId: cid, type, category, name, value, owner, notes, metadata } as any)
      .returning();
    res.status(201).json(row);
  } catch (e: any) {
    console.error("[net-worth/post]", e.message);  // body omitted — may contain PII
    res.status(500).json({ message: e.message });
  }
});

// PUT — used by frontend for updates (was only in fp-full.ts before consolidation)
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

// ── Retirement ────────────────────────────────────────────────────────────────
// Canonical retirement CRUD — supports ?person=primary|spouse query param.

r.get("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const person = req.query.person as string | undefined;
  const query = db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid));
  const rows = await query;
  const filtered = person
    ? rows.filter(r => (r.person ?? "primary") === person)
    : rows;
  res.json(filtered.map(row => ({
    ...row,
    person: row.person ?? "primary",
    currentSavings: row.currentSavings ?? String(
      (Number(row.rrspBalance ?? 0) + Number(row.tfsaBalance ?? 0) + Number(row.nonRegBalance ?? 0)) || 0
    ),
    annualContribution:      row.annualContribution      ?? "0",
    expectedReturn:          row.expectedReturn          ?? "7",
    inflationRate:           row.inflationRate           ?? "2",
    desiredRetirementIncome: row.desiredRetirementIncome ?? "0",
    projectedBalance:        row.projectedBalance        ?? "0",
    shortfallSurplus:        row.shortfallSurplus        ?? "0",
  })));
});

r.post("/clients/:id/retirement", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const data = safe(req.body.data ?? req.body);
    if (data.currentSavings && !data.rrspBalance) data.rrspBalance = data.currentSavings;
    const [row] = await (db.insert(retirementProjections) as any).values({
      clientId:      cid,
      person:        data.person ?? "primary",
      currentAge:    data.currentAge    || 35,
      retirementAge: data.retirementAge || 65,
      ...data,
    }).returning();
    res.status(201).json(row);
  } catch (err: any) {
    console.error("[retirement POST ERROR]", err.message);
    res.status(500).json({ message: err.message });
  }
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

// ── Insurance ─────────────────────────────────────────────────────────────────
r.get("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});

r.post("/clients/:id/insurance", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
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

// ── Education / RESP ──────────────────────────────────────────────────────────
r.get("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)));
});

r.post("/clients/:id/education", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(educationPlans) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/education/:id", async (req: AuthRequest, res: Response) => {
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

// ── Debt ──────────────────────────────────────────────────────────────────────
r.get("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});

r.post("/clients/:id/debt", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

r.patch("/debt/:id", async (req: AuthRequest, res: Response) => {
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

// ── Tax Notes ─────────────────────────────────────────────────────────────────
r.get("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)));
});

r.post("/clients/:id/tax", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(taxNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

// Alias paths used by some frontend versions
r.get("/clients/:id/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(taxNotes).where(eq(taxNotes.clientId, cid)));
});
r.post("/clients/:id/tax-planning-notes", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(taxNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.json(row);
});

r.patch("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId })
    .from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(taxNotes).set(safe(req.body)).where(eq(taxNotes.id, ex.id)).returning();
  res.json(u);
});

r.delete("/tax/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: taxNotes.id, clientId: taxNotes.clientId })
    .from(taxNotes).where(eq(taxNotes.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(taxNotes).where(eq(taxNotes.id, ex.id));
  res.json({ ok: true });
});

// ── Estate Notes ──────────────────────────────────────────────────────────────
r.get("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.select().from(estateNotes).where(eq(estateNotes.clientId, cid)).limit(1);
  res.json(row ?? null);
});

r.put("/clients/:id/estate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [ex] = await db.select({ id: estateNotes.id }).from(estateNotes).where(eq(estateNotes.clientId, cid)).limit(1);
  if (ex) {
    const [u] = await db.update(estateNotes).set(safe(req.body)).where(eq(estateNotes.id, ex.id)).returning();
    return res.json(u);
  }
  const [row] = await (db.insert(estateNotes) as any).values({ clientId: cid, ...safe(req.body) }).returning();
  res.status(201).json(row);
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:id/ai", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});

r.post("/clients/:id/ai/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const [nw, debt] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)),
  ]);
  const assets    = nw.filter(e => e.type === "asset").reduce((s, e) => s + Number(e.value), 0);
  const totalDebt = debt.reduce((s, d) => s + Number(d.balance), 0);

  // Every generate call gets a unique runId — ISO timestamp groups the session
  const runId = new Date().toISOString();
  const recs = [];

  if (!client.retirementAge)  recs.push({ clientId: cid, runId, category: "retirement", priority: "high",   title: "Set Retirement Target Age",  content: "Define a target retirement age to enable accurate projections and CPP/OAS timing optimization." });
  if (assets < 50000)         recs.push({ clientId: cid, runId, category: "savings",    priority: "high",   title: "Build Emergency Fund",        content: "Recommend building 3-6 months of expenses in liquid savings before aggressive investing." });
  if (totalDebt > 50000)      recs.push({ clientId: cid, runId, category: "debt",       priority: "high",   title: "Debt Reduction Strategy",     content: `Total debt of $${totalDebt.toLocaleString()} is significant. Review avalanche vs snowball strategy.` });
  recs.push({ clientId: cid, runId, category: "tax",       priority: "medium", title: "Annual RRSP/TFSA Review",    content: "Review contribution room and optimize between RRSP and TFSA based on current and expected future marginal tax rates." });
  recs.push({ clientId: cid, runId, category: "insurance", priority: "medium", title: "Insurance Needs Review",     content: "Conduct annual review of life, disability, and critical illness coverage gaps." });
  if (!client.retirementAge || assets > 100000) recs.push({ clientId: cid, runId, category: "retirement", priority: "medium", title: "Review CPP/OAS Timing",      content: "Model the impact of deferring CPP to age 70 (+42%) and OAS to age 70 (+36%) versus taking at 65. Break-even typically age 82-85." });
  if (assets > 0 && totalDebt === 0)            recs.push({ clientId: cid, runId, category: "tax",       priority: "low",    title: "Estate & Tax Efficiency",    content: "Review beneficiary designations, TFSA maximization, and potential for spousal RRSP income splitting in retirement." });

  const inserted = await Promise.all(recs.map(rec => (db.insert(aiRecommendations) as any).values(rec).returning().then(([x]: any) => x)));
  res.status(201).json(inserted);
});

r.patch("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await db.update(aiRecommendations).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.delete("/clients/:id/ai/session/*", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  try {
    if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  } catch (e: any) {
    console.error("[delete session] ownsClient error:", e.message);
    return res.status(500).json({ message: e.message });
  }
  const runId = decodeURIComponent((req.params as any)[0]);
  try {
    await db.delete(aiRecommendations).where(
      and(eq(aiRecommendations.clientId, cid), eq(aiRecommendations.runId, runId))
    );
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[delete session] db error:", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.delete("/ai/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId })
    .from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

// ── Client Policies ───────────────────────────────────────────────────────────
r.get("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(clientPolicies).where(eq(clientPolicies.clientId, cid)));
});
r.post("/clients/:id/policies", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(clientPolicies) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[policies POST]", err.message); res.status(500).json({ message: err.message }); }
});
r.patch("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(clientPolicies).set(safe(req.body))
    .where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid))).returning();
  res.json(row);
});
r.delete("/clients/:id/policies/:pid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(clientPolicies).where(and(eq(clientPolicies.id, +req.params.pid), eq(clientPolicies.clientId, cid)));
  res.json({ ok: true });
});

// ── Household Expenses ────────────────────────────────────────────────────────
r.get("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(householdExpenses).where(eq(householdExpenses.clientId, cid)));
});
r.post("/clients/:id/expenses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const [row] = await (db.insert(householdExpenses) as any).values({ clientId: cid, ...safe(req.body) }).returning();
    res.status(201).json(row);
  } catch (err: any) { console.error("[expenses POST]", err.message); res.status(500).json({ message: err.message }); }
});
r.patch("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await db.update(householdExpenses).set(safe(req.body))
    .where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid))).returning();
  res.json(row);
});
r.delete("/clients/:id/expenses/:eid", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(householdExpenses).where(and(eq(householdExpenses.id, +req.params.eid), eq(householdExpenses.clientId, cid)));
  res.json({ ok: true });
});

// POST — manual override (all fields supplied by caller)
r.post("/clients/:clientId/drawdown", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const results = runDrawdownStrategies(req.body as DrawdownInput);
    res.json(results);
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// GET — auto-assembled from stored projection + client + pension data (no re-entry needed)
r.get("/clients/:clientId/drawdown", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.clientId;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  try {
    const { pensionPlans } = await import("../../shared/schema.js");

    const [[client], projRows, pensions] = await Promise.all([
      db.select().from(clients).where(eq(clients.id, cid)).limit(1),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)).limit(1),
      db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid)),
    ]);

    if (!client) return res.status(404).json({ message: "Client not found" });

    const proj = projRows[0] ?? null;

    // Derive age from DOB if not stored on projection
    const dobYear   = new Date(client.dateOfBirth ?? "1970-01-01").getFullYear();
    const currentAge     = proj?.currentAge    ?? (new Date().getFullYear() - dobYear);
    const retirementAge  = proj?.retirementAge ?? Number(client.retirementAge ?? 65);
    const lifeExpectancy = proj?.lifeExpectancy ?? 90;

    // Account balances — use projectedBalance split proportionally if available,
    // otherwise fall back to stored individual balances
    const rawRrsp   = Number(proj?.rrspBalance    ?? 0);
    const rawTfsa   = Number(proj?.tfsaBalance    ?? 0);
    const rawNonReg = Number(proj?.nonRegBalance  ?? 0);
    const rawTotal  = rawRrsp + rawTfsa + rawNonReg;

    const projectedTotal = Number(proj?.projectedBalance ?? 0);
    const useProjected   = projectedTotal > 0 && rawTotal > 0;

    // If we have a Monte Carlo projected balance, scale balances proportionally
    const scale      = useProjected ? projectedTotal / rawTotal : 1;
    const rrspBalance   = Math.round(rawRrsp   * scale);
    const tfsaBalance   = Math.round(rawTfsa   * scale);
    const nonRegBalance = Math.round(rawNonReg * scale);

    // Pension income from stored pension plans
    const pensionIncome = pensions.reduce((sum, p) => {
      if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
        return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
      if (p.pensionType === "dcpp" && p.currentBalance)
        return sum + Number(p.currentBalance) * 0.04;
      return sum;
    }, 0);

    const inp: DrawdownInput = {
      currentAge,
      retirementAge,
      lifeExpectancy,
      province:          client.province ?? "ON",
      rrspBalance,
      tfsaBalance,
      nonRegBalance,
      nonRegAcb:         Math.round(nonRegBalance * 0.5),  // conservative ACB estimate
      desiredAnnualIncome: Number(proj?.desiredRetirementIncome ?? client.desiredRetirementIncome ?? 50000),
      cppAnnual:         Number(proj?.cppMonthly  ?? 900)  * 12,
      oasAnnual:         Number(proj?.oasMonthly  ?? 700)  * 12,
      cppStartAge:       proj?.cppStartAge ?? 65,
      oasStartAge:       proj?.oasStartAge ?? 65,
      pensionIncome:     Math.round(pensionIncome + Number(proj?.pensionIncome ?? 0)),
      expectedReturn:    Number(proj?.expectedReturn  ?? 6) / 100,
      inflationRate:     Number(proj?.inflationRate   ?? 2) / 100,
      bpa:               16129,  // 2025 federal Basic Personal Amount
    };

    const results = runDrawdownStrategies(inp);

    res.json({
      inputs: inp,
      useProjected,
      projectedTotal,
      nonregFirst: results.nonregFirst,
      meltdown:    results.meltdown,
      blended:     results.blended,
    });
  } catch (e: any) {
    console.error("[drawdown GET]", e.message);
    res.status(500).json({ message: e.message });
  }
});

export { r as fpRouter };

