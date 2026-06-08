import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { clients, netWorthEntries, insuranceAnalyses, debtEntries, educationSavings, retirementProjections, taxPlanningNotes, estatePlanningNotes, householdExpenses, pensionPlans } from "../../shared/schema.js";
import { eq, and, inArray } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { generateFnaReport, generateNetWorthReport, generateComprehensiveReport, generateRetirementReport, generateInsuranceReport, generateCashFlowReport, generateAssetAllocationReport, generateRetirementReadinessReport, generateGoalStatusReport, generateInsuranceAuditReport, generateEstateSummaryReport, generateTaxStrategyReport, generateOnePagePlan } from "../services/reportGenerator.js";

const r = Router();
r.use((req: any, res: any, next: any) => {
  // Allow token via query param for report downloads
  if (req.query.token && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${req.query.token}`;
  }
  return isAuthenticated(req, res, next);
});

async function accessibleUserIds(userId: number): Promise<number[]> {
  return [userId];
}

async function getClient(clientId: number, userId: number) {
  const ids = await accessibleUserIds(userId);
  const [c] = await db.select().from(clients).where(and(eq(clients.id, clientId), inArray(clients.userId, ids)));
  return c ?? null;
}

// GET /api/reports/:clientId/fna/:analysisId
r.get("/:clientId/fna/:analysisId", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [analysis] = await db.select().from(insuranceAnalyses)
      .where(and(eq(insuranceAnalyses.id, +req.params.analysisId), eq(insuranceAnalyses.clientId, +req.params.clientId)));
    if (!analysis) return res.status(404).json({ message: "Analysis not found" });

    const [advisor] = await db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users).where(eq(users.id, req.userId!)).limit(1);

    const html = generateFnaReport({ client, analysis, advisor, includeCover: req.query.cover === "true" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("FNA report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/reports/:clientId/net-worth
r.get("/:clientId/net-worth", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const netWorth = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId));
    const html = generateNetWorthReport({ client, netWorth, includeCover: req.query.cover === "true" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Net worth report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/reports/:clientId/comprehensive
r.get("/:clientId/comprehensive", async (req: AuthRequest, res: Response) => {
  try {
    const client = await getClient(+req.params.clientId, req.userId!);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [netWorth, insuranceList, debts, education, advisor] = await Promise.all([
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, +req.params.clientId)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, +req.params.clientId)),
      db.select().from(educationSavings).where(eq(educationSavings.clientId, +req.params.clientId)),
      db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, req.userId!)).limit(1),
    ]);

    const insurance = insuranceList[0] ?? null;
    const html = generateComprehensiveReport({ client, advisor: advisor[0], netWorth, insurance, debts, education });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Comprehensive report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});



// ── Helper: fetch all FP data ─────────────────────────────────────────────────
async function fetchClientFpData(clientId: number, userId: number) {
  const client = await getClient(clientId, userId);
  if (!client) return null;
  const [netWorth, insuranceList, debts, education, retirementList, taxNotesList, estateNotesList, expensesList, advisor] = await Promise.all([
    db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, clientId)),
    db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, clientId)),
    db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId)),
    db.select().from(educationSavings).where(eq(educationSavings.clientId, clientId)),
    db.select().from(retirementProjections).where(eq(retirementProjections.clientId, clientId)),
    db.select().from(taxPlanningNotes).where(eq(taxPlanningNotes.clientId, clientId)),
    db.select().from(estatePlanningNotes).where(eq(estatePlanningNotes.clientId, clientId)),
    db.select().from(householdExpenses).where(eq(householdExpenses.clientId, clientId)),
    db.select({ id: users.id, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, userId)).limit(1),
  ]);
  return {
    client: client as any,
    netWorth: netWorth as any,
    debts, education,
    expenses: expensesList as any,
    insurance: insuranceList[0] ?? null,
    retirement: retirementList[0] ?? null,
    taxNotes: taxNotesList,
    estateNotes: estateNotesList,
    advisor: advisor[0] ?? null,
  };
}

// GET /api/reports/:clientId/retirement
r.get("/:clientId/retirement", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });

    // Run live Monte Carlo so report reflects current data
    let simulation = null;
    try {
      const plans = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, +req.params.clientId));
      const pensionIncome = plans.reduce((sum: number, p: any) => {
        if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
          return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
        if (p.pensionType === "dcpp" && p.currentBalance)
          return sum + (Number(p.currentBalance) * 0.04);
        return sum;
      }, 0);

      const ret = d.retirement;
      const client = d.client;
      const currentAge    = ret?.currentAge    ?? (new Date().getFullYear() - new Date(client.dateOfBirth ?? "1970-01-01").getFullYear());
      const retirementAge = ret?.retirementAge ?? client.retirementAge ?? 65;
      const lifeExpectancy = ret?.lifeExpectancy ?? 90;
      const desiredIncome  = Number(ret?.desiredRetirementIncome ?? client.desiredRetirementIncome ?? 50000);
      const nwRows = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId));
const rrsp = nwRows.filter((e: any) => e.type === "asset" && e.category === "RRSP")
  .reduce((s: number, e: any) => s + Number(e.value || 0), 0)
  + Number(ret?.rrspBalance ?? ret?.currentSavings ?? 0);
const tfsa = nwRows.filter((e: any) => e.type === "asset" && e.category === "TFSA")
  .reduce((s: number, e: any) => s + Number(e.value || 0), 0)
  + Number(ret?.tfsaBalance ?? 0);
const nonReg = nwRows.filter((e: any) => e.type === "asset" && e.category === "Non-Registered")
  .reduce((s: number, e: any) => s + Number(e.value || 0), 0)
  + Number(ret?.nonRegBalance ?? 0);
const totalPortfolio = rrsp + tfsa + nonReg;
const annualContrib = Number(ret?.annualContribution ?? 0);
      const cppMonthly = 900;
      const oasMonthly = 700;
      const cppAge = ret?.cppStartAge ?? 65;
      const oasAge = ret?.oasStartAge ?? 65;
      const portReturn = 0.065;
      const portStdDev = 0.10;
      const infl = 0.025;
      const totalYears = Math.max(1, lifeExpectancy - currentAge);
      const yearsToRetirement = Math.max(0, retirementAge - currentAge);
      const simCount = 1000;
      const outcomes: number[] = [];
      const yearlyBands: number[][] = Array.from({ length: totalYears }, () => []);
      let successCount = 0;
      for (let s = 0; s < simCount; s++) {
        let bal = totalPortfolio;
        let spending = desiredIncome;
        for (let yr = 0; yr < totalYears; yr++) {
          const age = currentAge + yr;
          const z = Math.sqrt(-2*Math.log(Math.random())) * Math.cos(2*Math.PI*Math.random());
          const r = portReturn + portStdDev * z;
          if (age < retirementAge) {
            bal = (bal + annualContrib) * (1 + r);
          } else {
            const cpp = age >= cppAge ? cppMonthly * 12 : 0;
            const oas = age >= oasAge ? oasMonthly * 12 : 0;
            const netW = Math.max(0, spending - cpp - oas - pensionIncome);
            bal = Math.max(0, (bal - netW) * (1 + r));
            spending *= (1 + infl);
          }
          yearlyBands[yr].push(bal);
        }
        outcomes.push(bal);
        if (bal > 0) successCount++;
      }
      const sorted = (arr: number[]) => [...arr].sort((a, b) => a - b);
      const pct = (arr: number[], p: number) => { const s = sorted(arr); return s[Math.floor(s.length * p)] ?? 0; };
      const p10  = yearlyBands.map(b => Math.round(pct(b, 0.1)));
      const p25  = yearlyBands.map(b => Math.round(pct(b, 0.25)));
      const p50  = yearlyBands.map(b => Math.round(pct(b, 0.5)));
      const p75  = yearlyBands.map(b => Math.round(pct(b, 0.75)));
      const p90  = yearlyBands.map(b => Math.round(pct(b, 0.9)));
      simulation = {
        successRate: (successCount / simCount),
        simulationCount: simCount,
        yearsProjected: totalYears,
        pensionIncome: Math.round(pensionIncome),
        percentileBands: { p10, p25, p50, p75, p90 },
        finalBalancePercentiles: {
          p10: Math.round(pct(outcomes, 0.1)),
          p25: Math.round(pct(outcomes, 0.25)),
          p50: Math.round(pct(outcomes, 0.5)),
          p75: Math.round(pct(outcomes, 0.75)),
          p90: Math.round(pct(outcomes, 0.9)),
        },
      };
    } catch (simErr) {
      console.error("[retirement report sim]", simErr);
    }

    const html = generateRetirementReport({ client: d.client, retirement: d.retirement, sim: simulation, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance
r.get("/:clientId/insurance", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceReport({ client: d.client, insurance: d.insurance, products: [], includeCover: req.query.cover === "true" });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/cash-flow
r.get("/:clientId/cash-flow", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateCashFlowReport({ client: d.client, expenses: d.expenses, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/asset-allocation
r.get("/:clientId/asset-allocation", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateAssetAllocationReport({ client: d.client, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/retirement-readiness
r.get("/:clientId/retirement-readiness", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateRetirementReadinessReport({ client: d.client, retirement: d.retirement, expenses: d.expenses, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/goal-status
r.get("/:clientId/goal-status", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateGoalStatusReport({ client: d.client, plans: [], education: d.education, retirement: d.retirement, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance-audit
r.get("/:clientId/insurance-audit", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceAuditReport({ client: d.client, insurance: d.insurance, products: [], netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/estate-summary
r.get("/:clientId/estate-summary", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateEstateSummaryReport({ client: d.client, estateNotes: d.estateNotes, netWorth: d.netWorth, products: [], advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/tax-strategy
r.get("/:clientId/tax-strategy", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateTaxStrategyReport({ client: d.client, taxNotes: d.taxNotes, netWorth: d.netWorth, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

r.get("/:clientId/one-page", async (req: AuthRequest, res: Response) => {
  try {
    const d = await fetchClientFpData(+req.params.clientId, req.userId!);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateOnePagePlan({ client: d.client, netWorth: d.netWorth, retirement: d.retirement, insurance: d.insurance, plans: [], education: d.education, aiRecs: [], expenses: d.expenses, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err: any) { console.error("REPORT ERROR:", err?.message); res.status(500).json({ message: err?.message ?? "Failed" }); }
});

export { r as reportsRouter };
