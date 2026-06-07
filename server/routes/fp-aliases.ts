// Auto-generated path aliases — maps use-plans.ts paths to fp.ts handlers
import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import {
  netWorthEntries, retirementProjections, insuranceAnalyses,
  educationSavings as educationPlans, debtEntries,
  taxPlanningNotes as taxNotes, estatePlanningNotes as estateNotes,
  aiRecommendations, clients,
} from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { safe, ownsClient } from "../fpUtils.js";
import { eq, and } from "drizzle-orm";

const r = Router();
r.use(isAuthenticated);

// ── Retirement Projections ────────────────────────────────────────────────────
r.get("/clients/:id/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(retirementProjections).where(eq(retirementProjections.clientId, cid)));
});
r.post("/clients/:id/retirement-projections", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const body = req.body;

  // Run Monte Carlo to calculate projectedBalance, shortfallSurplus, successRate
  try {
    const { pensionPlans } = await import("../../shared/schema.js");
    const plans = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
    const pensionIncome = plans.reduce((sum: number, p: any) => {
      if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
        return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
      if (p.pensionType === "dcpp" && p.currentBalance)
        return sum + (Number(p.currentBalance) * 0.04);
      return sum;
    }, 0);

    const isCouple       = body.householdType === "couple";
    const currentAge     = Number(body.currentAge ?? 40);
    const retirementAge  = Number(body.retirementAge ?? 65);
    const lifeExpectancy = Number(body.lifeExpectancy ?? 90);
    const currentSavings = Number(body.currentSavings ?? 0);
    const annualContrib  = Number(body.annualContribution ?? 0);
    const desiredIncome  = Number(body.desiredRetirementIncome ?? 50000);
    const expectedReturn = Number(body.expectedReturn ?? 7) / 100;
    const stdDev         = 0.10;
    const infl           = Number(body.inflationRate ?? 2) / 100;
    const cppAge         = Number(body.cppStartAge ?? 65);
    const cppAnnual      = 900 * 12;
    const oasAnnual      = 700 * 12;

    // Spouse fields
    const spouseAge      = Number(body.spouseAge ?? currentAge);
    const spouseRetAge   = Number(body.spouseRetirementAge ?? retirementAge);
    const spouseLifeExp  = Number(body.spouseLifeExpectancy ?? lifeExpectancy);
    const spouseSavings  = Number(body.spouseSavings ?? 0);
    const spouseContrib  = Number(body.spouseContribution ?? 0);
    const spousePension  = Number(body.spousePensionIncome ?? 0);
    const spouseCppAge   = Number(body.spouseCppStartAge ?? 65);

    const planToAge  = isCouple ? Math.max(lifeExpectancy, spouseLifeExp) : lifeExpectancy;
    const totalYears = Math.max(1, planToAge - currentAge);
    const simCount   = 1000;
    const outcomes: number[] = [];
    let successCount = 0;

    for (let s = 0; s < simCount; s++) {
      let balPrimary = currentSavings;
      let balSpouse  = isCouple ? spouseSavings : 0;
      let spending   = desiredIncome;
      for (let yr = 0; yr < totalYears; yr++) {
        const age   = currentAge + yr;
        const spAge = spouseAge + yr;
        const z = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
        const rr = expectedReturn + stdDev * z;
        const primRetired   = age >= retirementAge;
        const spouseRetired = isCouple && spAge >= spouseRetAge;
        if (!primRetired) balPrimary = (balPrimary + annualContrib) * (1 + rr);
        else              balPrimary = Math.max(0, balPrimary * (1 + rr));
        if (isCouple) {
          if (!spouseRetired) balSpouse = (balSpouse + spouseContrib) * (1 + rr);
          else                balSpouse = Math.max(0, balSpouse * (1 + rr));
        }
        const bothRetired = primRetired && (!isCouple || spouseRetired);
        if (bothRetired) {
          const cpp  = age >= cppAge     ? cppAnnual : 0;
          const oas  = age >= cppAge     ? oasAnnual : 0;
          const scpp = isCouple && spAge >= spouseCppAge ? cppAnnual : 0;
          const soas = isCouple && spAge >= spouseCppAge ? oasAnnual : 0;
          const totalGov = cpp + oas + scpp + soas + pensionIncome + (isCouple ? spousePension : 0);
          const combinedPool = balPrimary + balSpouse;
          const netW = Math.max(0, spending - totalGov);
          const ratio = combinedPool > 0 ? balPrimary / combinedPool : 0.5;
          balPrimary = Math.max(0, balPrimary - netW * ratio);
          balSpouse  = Math.max(0, balSpouse  - netW * (1 - ratio));
          spending  *= (1 + infl);
        }
      }
      const finalBal = balPrimary + (isCouple ? balSpouse : 0);
      outcomes.push(finalBal);
      if (finalBal > 0) successCount++;
    }
    const sorted = [...outcomes].sort((a, b) => a - b);
    const pct = (p: number) => sorted[Math.floor(sorted.length * p)] ?? 0;
    const successRate   = successCount / simCount;
    const medianBalance = Math.round(pct(0.5));
    const retYears      = planToAge - retirementAge;
    const totalCpp      = isCouple ? cppAnnual * 2 : cppAnnual;
    const totalOas      = isCouple ? oasAnnual * 2 : oasAnnual;
    const totalPension  = pensionIncome + (isCouple ? spousePension : 0);
    const projectedTotal = medianBalance + (totalCpp + totalOas + totalPension) * retYears;
    const desiredTotal   = desiredIncome * retYears;
    const shortfall      = Math.round(projectedTotal - desiredTotal);

    const [row] = await (db.insert(retirementProjections) as any).values({
      clientId: cid,
      ...safe(body),
      projectedBalance:   String(medianBalance),
      shortfallSurplus:   String(shortfall),
      successRate:        String(Math.round(successRate * 100)),
      pensionIncome:      String(Math.round(pensionIncome)),
    }).returning();
    res.json(row);
  } catch (e: any) {
    // Fallback to raw insert if simulation fails
    console.error("[retirement projection sim]", e.message);
    const [row] = await (db.insert(retirementProjections) as any).values({ clientId: cid, ...safe(body) }).returning();
    res.json(row);
  }
});
r.delete("/retirement-projections/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: retirementProjections.id, clientId: retirementProjections.clientId }).from(retirementProjections).where(eq(retirementProjections.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(retirementProjections).where(eq(retirementProjections.id, ex.id));
  res.json({ ok: true });
});

// ── Insurance Analyses ────────────────────────────────────────────────────────
r.get("/clients/:id/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, cid)));
});
r.post("/clients/:id/insurance-analyses", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(insuranceAnalyses) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.delete("/insurance-analyses/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: insuranceAnalyses.id, clientId: insuranceAnalyses.clientId }).from(insuranceAnalyses).where(eq(insuranceAnalyses.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(insuranceAnalyses).where(eq(insuranceAnalyses.id, ex.id));
  res.json({ ok: true });
});

// ── Education Savings ─────────────────────────────────────────────────────────
r.get("/clients/:id/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(educationPlans).where(eq(educationPlans.clientId, cid)));
});
r.post("/clients/:id/education-savings", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const data = safe(req.body.data ?? req.body) as any;
  const [row] = await (db.insert(educationPlans) as any).values({ clientId: cid, childAge: data.childAge || 0, ...data }).returning();
  res.status(201).json(row);
});
r.put("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await (db.update(educationPlans) as any).set(safe(req.body)).where(eq(educationPlans.id, ex.id)).returning();
  res.json(u);
});
r.delete("/education-savings/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: educationPlans.id, clientId: educationPlans.clientId }).from(educationPlans).where(eq(educationPlans.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(educationPlans).where(eq(educationPlans.id, ex.id));
  res.json({ ok: true });
});

// ── Debt Entries ──────────────────────────────────────────────────────────────
r.get("/clients/:id/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(debtEntries).where(eq(debtEntries.clientId, cid)));
});
r.post("/clients/:id/debt-entries", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [row] = await (db.insert(debtEntries) as any).values({ clientId: cid, ...safe(req.body.data ?? req.body) }).returning();
  res.status(201).json(row);
});
r.put("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await (db.update(debtEntries) as any).set(safe(req.body)).where(eq(debtEntries.id, ex.id)).returning();
  res.json(u);
});
r.delete("/debt-entries/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: debtEntries.id, clientId: debtEntries.clientId }).from(debtEntries).where(eq(debtEntries.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(debtEntries).where(eq(debtEntries.id, ex.id));
  res.json({ ok: true });
});

// ── AI Recommendations ────────────────────────────────────────────────────────
r.get("/clients/:id/ai-recommendations", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  res.json(await db.select().from(aiRecommendations).where(eq(aiRecommendations.clientId, cid)));
});

r.post("/clients/:id/ai-recommendations/generate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });
  const runId = new Date().toISOString();
  const recs = [
    { clientId: cid, runId, category: "retirement", priority: "high",   title: "Review Retirement Projections", content: "Ensure CPP/OAS timing and RRSP/TFSA drawdown strategy are optimized for your province." },
    { clientId: cid, runId, category: "tax",        priority: "medium", title: "Annual RRSP/TFSA Review",       content: "Review contribution room and optimize between RRSP and TFSA based on marginal rates." },
    { clientId: cid, runId, category: "insurance",  priority: "medium", title: "Insurance Needs Analysis",      content: "Conduct annual review of life, disability, and critical illness coverage gaps." },
    { clientId: cid, runId, category: "estate",     priority: "low",    title: "Estate Document Review",        content: "Verify will, POA, and healthcare directive are current and reflect your wishes." },
  ];
  try {
    const inserted = await Promise.all(recs.map(rec =>
      db.insert(aiRecommendations).values(rec).returning().then(([x]) => x)
    ));
    res.json(inserted);
  } catch (e: any) {
    console.error("[ai generate]", e.message);
    res.status(500).json({ message: e.message });
  }
});

r.put("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  const [u] = await (db.update(aiRecommendations) as any).set(safe(req.body)).where(eq(aiRecommendations.id, ex.id)).returning();
  res.json(u);
});

r.delete("/ai-recommendations/:id", async (req: AuthRequest, res: Response) => {
  const [ex] = await db.select({ id: aiRecommendations.id, clientId: aiRecommendations.clientId }).from(aiRecommendations).where(eq(aiRecommendations.id, +req.params.id));
  if (!ex || !await ownsClient(ex.clientId, req.userId!)) return res.status(404).json({ message: "Not found" });
  await db.delete(aiRecommendations).where(eq(aiRecommendations.id, ex.id));
  res.json({ ok: true });
});

export { r as fpAliasesRouter };
