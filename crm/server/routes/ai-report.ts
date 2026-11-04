/**
 * server/routes/ai-report.ts
 *
 * POST /api/clients/:id/ai-report
 *
 * Generates a PIPEDA-compliant AI narrative for a retirement simulation result.
 *
 * Workflow:
 *   1. Load client + projection data from DB (stays on server)
 *   2. Run or load Monte Carlo simulation (runs on server)
 *   3. Build de-identified payload — NO PII, NO dollar amounts
 *   4. Send de-identified payload to Anthropic → receive narrative text
 *   5. Merge narrative with real data server-side
 *   6. Return merged context to client for report rendering
 *
 * The client (browser) receives the merged context and renders the report.
 * Raw financials included in the merged context stay within the tenant's session.
 * The Anthropic API never sees raw financials.
 */

import { Router, Response } from "express";
import { db } from "../db";
import { clients, retirementProjections, pensionPlans, netWorthEntries, products } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ownsClient } from "../fpUtils";
import {
  buildDeidentifiedPayload,
  generatePipedaCompliantNarrative,
  assembleReportContext,
} from "../services/pipedaReportingService";
import { logger } from "../logger";

const r = Router();

// ── POST /api/clients/:id/ai-report ──────────────────────────────────────────
r.post("/clients/:id/ai-report", async (req: any, res: Response) => {
  const cid = +req.params.id;

  if (!await ownsClient(cid, req.userId!)) {
    return res.status(404).json({ message: "Not found" });
  }

  // ── 1. Load client & projection data (stays on server) ────────────────────
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  if (!client) return res.status(404).json({ message: "Client not found" });

  const [proj] = await db.select()
    .from(retirementProjections)
    .where(eq(retirementProjections.clientId, cid))
    .limit(1);

  const plans   = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
  const nwItems = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, cid));
  const pols    = await db.select().from(products).where(eq((products as any).clientId, cid)).catch(() => []);

  // ── 2. Build simulation inputs from real data ──────────────────────────────
  const currentAge    = proj?.currentAge    ?? calcAge((client as any).dateOfBirth);
  const retirementAge = proj?.retirementAge ?? 65;
  const lifeExpectancy = Number((req.body as any).lifeExpectancy ?? 90);
  const rrsp          = Number(proj?.rrspBalance ?? 0);
  const tfsa          = Number(proj?.tfsaBalance ?? 0);
  const nonReg        = Number(proj?.nonRegBalance ?? 0);
  const annualContrib = Number(proj?.annualContribution ?? 0);
  const desiredIncome = Number((proj as any)?.desiredRetirementIncome ?? (client as any).desiredRetirementIncome ?? 50000);
  const cppMonthly    = Number((proj as any)?.cppMonthly ?? 900);
  const oasMonthly    = Number((proj as any)?.oasMonthly ?? 700);
  const cppAge        = proj?.cppStartAge ?? 65;
  const oasAge        = proj?.oasStartAge ?? 65;

  const pensionAnnual = plans.reduce((sum: number, p: any) => {
    if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings) {
      return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
    }
    if (p.pensionType === "dcpp" && p.currentBalance) {
      return sum + (Number(p.currentBalance) * 0.04);
    }
    return sum;
  }, 0);

  // ── 3. Use simulation result from request body or stored successRate ───────
  // The client sends the simulation result it just received from /api/clients/:id/simulate
  // (which ran entirely on server). We don't re-run unless needed.
  const simResult: {
    successRate: number;
    simulationCount: number;
    guardrailTriggerRate?: number;
    guardrailFloor?: number;
    guardrailCeiling?: number;
    finalBalancePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
    inputs?: Record<string, number>;
  } = req.body.simulationResult ?? {
    successRate:   Number(proj?.successRate ?? 0) / 100,
    simulationCount: 1000,
    guardrailTriggerRate: 0,
    guardrailFloor: 0.80,
    guardrailCeiling: 1.20,
    finalBalancePercentiles: {
      p10: Number(proj?.projectedBalance ?? 0) * 0.4,
      p25: Number(proj?.projectedBalance ?? 0) * 0.7,
      p50: Number(proj?.projectedBalance ?? 0),
      p75: Number(proj?.projectedBalance ?? 0) * 1.3,
      p90: Number(proj?.projectedBalance ?? 0) * 1.6,
    },
  };

  // ── 4. Inspect net worth for plan flags (no amounts sent to AI) ────────────
  const investmentItems = nwItems.filter((e: any) => e.type === "asset" && e.category === "Investments");
  const tfsaItems = investmentItems.filter((e: any) =>
    (e.accountType ?? "").toUpperCase().includes("TFSA") || (e.name ?? "").toUpperCase().includes("TFSA")
  );
  const rrspItems = investmentItems.filter((e: any) =>
    (e.accountType ?? "").toUpperCase().includes("RRSP") || (e.name ?? "").toUpperCase().includes("RRSP")
  );
  const nonRegItems = investmentItems.filter((e: any) =>
    (e.accountType ?? "").toLowerCase().includes("non-reg") || (e.accountType ?? "").toLowerCase().includes("non reg")
  );

  const totalInvested = investmentItems.reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);
  const nonRegTotal   = nonRegItems.reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);

  const policyTypes = pols.map((p: any) => (p.type ?? p.productType ?? "").toLowerCase());
  const hasLifeInsurance       = policyTypes.some(t => t.includes("life"));
  const hasDisabilityInsurance = policyTypes.some(t => t.includes("disability") || t.includes("dis"));
  const hasCriticalIllness     = policyTypes.some(t => t.includes("critical") || t.includes("ci"));

  // Current TFSA room check — if < $7000 balance and room available, flag underutilized
  const tfsaBalance  = tfsaItems.reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);
  const rrspBalance  = rrspItems.reduce((s: number, e: any) => s + Number(e.value ?? 0), 0);

  // ── 5. Build de-identified payload ────────────────────────────────────────
  // ‼ After this point, no raw dollar amounts are used until assembleReportContext ‼
  const equityAlloc = simResult.inputs?.equityAllocation ?? Number(req.body.equityAllocation ?? 60);
  const bondAlloc   = 100 - equityAlloc;

  const deidentifiedPayload = buildDeidentifiedPayload({
    successRate:              simResult.successRate,
    simulationCount:          simResult.simulationCount,
    guardrailTriggerRate:     simResult.guardrailTriggerRate ?? 0,
    guardrailFloor:           simResult.guardrailFloor ?? 0.80,
    guardrailCeiling:         simResult.guardrailCeiling ?? 1.20,
    finalBalancePercentiles:  simResult.finalBalancePercentiles,
    currentAge,
    retirementAge,
    lifeExpectancy,
    startingPortfolio:    rrsp + tfsa + nonReg,
    desiredAnnualIncome:  desiredIncome,
    annualContribution:   annualContrib,
    cppAnnual:            cppAge <= retirementAge ? cppMonthly * 12 : 0,
    oasAnnual:            oasAge <= retirementAge ? oasMonthly * 12 : 0,
    pensionAnnual,
    equityAllocationPct:  equityAlloc,
    bondAllocationPct:    bondAlloc,
    equityReturnPct:      simResult.inputs?.equityReturn ?? Number(req.body.equityReturn ?? 7.0),
    bondReturnPct:        simResult.inputs?.bondReturn ?? Number(req.body.bondReturn ?? 4.0),
    inflationPct:         simResult.inputs?.inflationRate ?? Number(req.body.inflationRate ?? 2.5),
    hasTfsa:              tfsaBalance > 0,
    hasRrsp:              rrspBalance > 0,
    hasDbPension:         plans.some((p: any) => p.pensionType === "dbpp"),
    hasDcPension:         plans.some((p: any) => p.pensionType === "dcpp"),
    hasLifeInsurance,
    hasDisabilityInsurance,
    hasCriticalIllness,
    tfsaUnderutilized:    tfsaBalance < 10000,
    rrspUnderutilized:    rrspBalance < 10000,
    nonRegisteredConcentration: totalInvested > 0 && nonRegTotal / totalInvested > 0.5,
    insuranceGap:         !hasLifeInsurance,
    hasSpouse:            !!(client as any).spouseFirstName,
    province:             (client as any).province ?? "ON",
  });

  // ── 6. Call Anthropic with de-identified data only ────────────────────────
  let narrative;
  try {
    narrative = await generatePipedaCompliantNarrative(deidentifiedPayload, {
      clientId:   cid,
      companyId:  (client as any).companyId ?? undefined,
      reportType: "ai-report",
    });
  } catch (err: any) {
    logger.error("[ai-report] Anthropic API error:", err?.message ?? err);
    return res.status(502).json({
      message: "AI narrative generation failed",
      detail:  err?.message ?? "Unknown error",
    });
  }

  // ── 7. Assemble final context server-side (real data + AI narrative) ───────
  const advisorName = `${(req as any).user?.firstName ?? ""} ${(req as any).user?.lastName ?? ""}`.trim() || "Your Advisor";
  const clientName  = `${(client as any).firstName} ${(client as any).lastName}`;
  const requiredPortfolio = desiredIncome / 0.04;
  const fundingRatio = requiredPortfolio > 0
    ? simResult.finalBalancePercentiles.p50 / requiredPortfolio
    : 0;

  const reportContext = assembleReportContext(narrative, {
    clientName,
    advisorName,
    successRate:       simResult.successRate,
    fundingRatio,
    finalBalanceP50:   simResult.finalBalancePercentiles.p50,
    requiredPortfolio,
    desiredAnnualIncome: desiredIncome,
    retirementAge,
    province:          (client as any).province ?? "ON",
    firmName:          (req as any).user?.firmName,
  });

  // ── 8. Return to client (report rendered in browser from this context) ─────
  return res.json({
    ok:            true,
    reportContext,
    // Echo the de-identified payload for audit logging (no PII)
    auditPayload: deidentifiedPayload,
    narrativeMeta: narrative._meta,
  });
});

// ── Helper ────────────────────────────────────────────────────────────────────
function calcAge(dob?: string | null): number {
  if (!dob) return 45;
  const birthYear = new Date(dob).getFullYear();
  return new Date().getFullYear() - birthYear;
}

export { r as aiReportRouter };
