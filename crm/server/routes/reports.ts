import { isAuthenticated } from "../auth";
import { getCompanyId } from "./middleware";
import { Router, Response } from "express";
import { db } from "../db";
import { clients, netWorthEntries, insuranceAnalyses, debtEntries, educationSavings, retirementProjections, taxPlanningNotes, estatePlanningNotes, householdExpenses, pensionPlans } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { generateFnaReport, generateNetWorthReport, generateComprehensiveReport, generateRetirementReport, generateInsuranceReport, generateCashFlowReport, generateAssetAllocationReport, generateRetirementReadinessReport, generateGoalStatusReport, generateInsuranceAuditReport, generateEstateSummaryReport, generateTaxStrategyReport, generateOnePagePlan } from "../services/reportGenerator";
import { buildDeidentifiedPayload, generatePipedaCompliantNarrative } from "../services/pipedaReportingService";

const r = Router();
r.use((req: any, res: any, next: any) => {
  return isAuthenticated(req, res, next);
});

async function getClient(req: any, clientId: number) {
  const companyId = await getCompanyId(req);
  if (!companyId) return null;
  const [c] = await db.select().from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
  return c ?? null;
}

// GET /api/reports/:clientId/fna/:analysisId
r.get("/:clientId/fna/:analysisId", async (req: any, res: Response) => {
  try {
    const client = await getClient(req, +req.params.clientId);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [analysis] = await db.select().from(insuranceAnalyses)
      .where(and(eq(insuranceAnalyses.id, +req.params.analysisId), eq(insuranceAnalyses.clientId, +req.params.clientId)));
    if (!analysis) return res.status(404).json({ message: "Analysis not found" });

    const advisor = undefined;

    const html = generateFnaReport({ client, analysis, advisor, includeCover: req.query.cover === "true" });
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("FNA report error:", err);
    res.status(500).json({ message: "Failed to generate report" });
  }
});

// GET /api/reports/:clientId/net-worth
r.get("/:clientId/net-worth", async (req: any, res: Response) => {
  try {
    const client = await getClient(req, +req.params.clientId);
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
r.get("/:clientId/comprehensive", async (req: any, res: Response) => {
  try {
    const client = await getClient(req, +req.params.clientId);
    if (!client) return res.status(404).json({ message: "Not found" });

    const [netWorth, insuranceList, debts, education, advisor] = await Promise.all([
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, +req.params.clientId)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, +req.params.clientId)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, +req.params.clientId)),
      db.select().from(educationSavings).where(eq(educationSavings.clientId, +req.params.clientId)),
      Promise.resolve([] as { id: number; firstName: string | null; lastName: string | null }[]),
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
async function fetchClientFpData(req: any, clientId: number) {
  const client = await getClient(req, clientId);
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
    Promise.resolve([] as { id: number; firstName: string | null; lastName: string | null }[]),
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
r.get("/:clientId/retirement", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
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
      const rrsp  = Number(ret?.currentSavings ?? 0);
      const annualContrib = Number(ret?.annualContribution ?? 0);
      const cppMonthly = 900;
      const oasMonthly = 700;
      const cppAge = ret?.cppStartAge ?? 65;
      const oasAge = ret?.oasStartAge ?? 65;
      const portReturn = 0.065;
      const portStdDev = 0.10;
      const infl = 0.025;
      const totalYears = Math.max(1, lifeExpectancy - currentAge);
      const _yearsToRetirement = Math.max(0, retirementAge - currentAge);
      const simCount = 1000;
      const outcomes: number[] = [];
      const yearlyBands: number[][] = Array.from({ length: totalYears }, () => []);
      let successCount = 0;
      for (let s = 0; s < simCount; s++) {
        let bal = rrsp;
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

    // ── PIPEDA-compliant AI narrative ─────────────────────────────────────────
    // De-identify simulation results before sending to Anthropic.
    // Raw dollar amounts never leave the server — only ratios and flags are transmitted.
    let aiNarrative = null;
    if (simulation && process.env.ANTHROPIC_API_KEY) {
      try {
        const ret        = d.retirement as any;
        const clientData = d.client as any;
        const aiCurrentAge    = ret?.currentAge    ?? (new Date().getFullYear() - new Date(clientData.dateOfBirth ?? "1970-01-01").getFullYear());
        const aiRetirementAge = ret?.retirementAge ?? clientData.retirementAge ?? 65;
        const nwItems = d.netWorth as any[];
        const hasTfsa = nwItems.some((e: any) => (e.accountType ?? "").toUpperCase().includes("TFSA") || (e.name ?? "").toUpperCase().includes("TFSA"));
        const hasRrsp = nwItems.some((e: any) => (e.accountType ?? "").toUpperCase().includes("RRSP") || (e.name ?? "").toUpperCase().includes("RRSP"));
        const nonRegTotal   = nwItems.filter((e: any) => e.type === "asset" && (e.accountType ?? "").toLowerCase().includes("non-reg")).reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);
        const totalInvested = nwItems.filter((e: any) => e.type === "asset" && e.category === "Investments").reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);
        const pensionPlansData = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, +req.params.clientId));

        const payload = buildDeidentifiedPayload({
          successRate:             simulation.successRate,
          simulationCount:         simulation.simulationCount,
          guardrailTriggerRate:    0,
          guardrailFloor:          0.80,
          guardrailCeiling:        1.20,
          finalBalancePercentiles: simulation.finalBalancePercentiles,
          currentAge:              aiCurrentAge,
          retirementAge:           aiRetirementAge,
          lifeExpectancy:          ret?.lifeExpectancy ?? 90,
          startingPortfolio:       Number(ret?.currentSavings ?? 0),
          desiredAnnualIncome:     Number(ret?.desiredRetirementIncome ?? clientData.desiredRetirementIncome ?? 50000),
          annualContribution:      Number(ret?.annualContribution ?? 0),
          cppAnnual:               (ret?.cppStartAge ?? 65) <= aiRetirementAge ? 900 * 12 : 0,
          oasAnnual:               (ret?.oasStartAge ?? 65) <= aiRetirementAge ? 700 * 12 : 0,
          pensionAnnual:           simulation.pensionIncome ?? 0,
          equityAllocationPct:     60,
          bondAllocationPct:       40,
          equityReturnPct:         7.0,
          bondReturnPct:           4.0,
          inflationPct:            2.5,
          hasTfsa,
          hasRrsp,
          hasDbPension:            pensionPlansData.some((p: any) => p.pensionType === "dbpp"),
          hasDcPension:            pensionPlansData.some((p: any) => p.pensionType === "dcpp"),
          hasLifeInsurance:        !!d.insurance,
          hasDisabilityInsurance:  false,
          hasCriticalIllness:      false,
          tfsaUnderutilized:       !hasTfsa,
          rrspUnderutilized:       !hasRrsp,
          nonRegisteredConcentration: totalInvested > 0 && nonRegTotal / totalInvested > 0.5,
          insuranceGap:            !d.insurance,
          hasSpouse:               !!clientData.spouseFirstName,
          province:                clientData.province ?? "ON",
        });

        aiNarrative = await generatePipedaCompliantNarrative(payload, {
          clientId:   +req.params.clientId,
          companyId:  (d.client as any).companyId ?? undefined,
          reportType: "retirement",
        });
      } catch (aiErr) {
        console.error("[retirement report AI narrative]", aiErr);
        // Non-fatal — report renders without AI section if Anthropic is unreachable
      }
    }

    const html = generateRetirementReport({ client: d.client, retirement: d.retirement, sim: simulation, aiNarrative, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance
r.get("/:clientId/insurance", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceReport({ client: d.client, insurance: d.insurance, products: [], includeCover: req.query.cover === "true" });
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/cash-flow
r.get("/:clientId/cash-flow", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateCashFlowReport({ client: d.client, expenses: d.expenses, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/asset-allocation
r.get("/:clientId/asset-allocation", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateAssetAllocationReport({ client: d.client, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/retirement-readiness
r.get("/:clientId/retirement-readiness", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateRetirementReadinessReport({ client: d.client, retirement: d.retirement, expenses: d.expenses, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/goal-status
r.get("/:clientId/goal-status", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateGoalStatusReport({ client: d.client, plans: [], education: d.education, retirement: d.retirement, netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/insurance-audit
r.get("/:clientId/insurance-audit", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateInsuranceAuditReport({ client: d.client, insurance: d.insurance, products: [], netWorth: d.netWorth, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/estate-summary
r.get("/:clientId/estate-summary", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateEstateSummaryReport({ client: d.client, estateNotes: d.estateNotes, netWorth: d.netWorth, products: [], advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

// GET /api/reports/:clientId/tax-strategy
r.get("/:clientId/tax-strategy", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateTaxStrategyReport({ client: d.client, taxNotes: d.taxNotes, netWorth: d.netWorth, retirement: d.retirement, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err) { console.error(err); res.status(500).json({ message: "Failed" }); }
});

r.get("/:clientId/one-page", async (req: any, res: Response) => {
  try {
    const d = await fetchClientFpData(req, +req.params.clientId);
    if (!d) return res.status(404).json({ message: "Not found" });
    const html = generateOnePagePlan({ client: d.client, netWorth: d.netWorth, retirement: d.retirement, insurance: d.insurance, plans: [], education: d.education, aiRecs: [], expenses: d.expenses, advisor: d.advisor, generatedAt: new Date().toISOString(), includeCover: req.query.cover === "true" } as any);
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.send(html);
  } catch (err: any) { console.error("REPORT ERROR:", err?.message); res.status(500).json({ message: err?.message ?? "Failed" }); }
});

export { r as reportsRouter };
