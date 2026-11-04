/**
 * server/services/pipedaReportingService.ts
 *
 * PIPEDA-COMPLIANT AI REPORT NARRATIVE SERVICE
 * ─────────────────────────────────────────────
 * PIPEDA (Personal Information Protection and Electronic Documents Act) prohibits
 * sending identifiable financial data to third-party processors without explicit
 * consent and a data processing agreement. This service ensures:
 *
 *   1. Monte Carlo simulations run entirely on the Compass CRM server (Fly.io/yyz).
 *   2. Only de-identified STATISTICAL SUMMARIES reach the Anthropic API.
 *   3. Raw dollar amounts, names, SINs, DOBs, and account balances never leave
 *      the server boundary.
 *   4. The Anthropic API returns NARRATIVE TEXT ONLY — no financial data is echoed
 *      back in the response that could be logged by Anthropic's systems.
 *   5. The server merges AI narrative with real client data server-side when
 *      building the final HTML report.
 *
 * Data Flow:
 *   DB → Monte Carlo (server) → De-identified payload → Anthropic API
 *          ↓                                                    ↓
 *       Real data                                         Narrative text
 *          └──────────────────────────────────────────────────→ HTML report
 *                                   (merged server-side, never sent to AI)
 */

import Anthropic from "@anthropic-ai/sdk";
import { db } from "../db";
import { aiAuditLog } from "@shared/schema";

// ── Anthropic client ─────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── De-identified payload types ───────────────────────────────────────────────
// These are the ONLY types that may be sent to an external AI service.
// No names, no exact balances, no account numbers, no SINs, no DOBs.

export interface DeidentifiedSimulationPayload {
  /** Plan horizon — durations only, no calendar years or birth years */
  horizon: {
    yearsToRetirement: number;
    yearsInRetirement: number;
    totalYears: number;
    retirementAge: number;      // Age is acceptable; DOB is not
    lifeExpectancy: number;
  };

  /** Simulation quality — pure statistics, no balances */
  monteCarlo: {
    successRate: number;          // 0–1
    simulationCount: number;
    guardrailTriggerRate: number; // fraction of sims that hit a guardrail
    guardrailFloor: number;
    guardrailCeiling: number;
  };

  /** Expressed as RATIOS relative to the retirement income target — no dollar amounts */
  portfolioReadiness: {
    /** projected portfolio / required portfolio (4% rule) — e.g. 0.84 = 84% funded */
    fundingRatio: number;
    /** surplus (+) or shortfall (–) as a MULTIPLE of annual desired income — no $ */
    surplusMultiple: number;
    /** final balance percentiles as multiples of annual income target */
    outcomeMultiples: {
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
    };
  };

  /** Income sources as fractions of total retirement income — no dollar amounts */
  incomeComposition: {
    portfolioWithdrawalFraction: number;
    cppFraction: number;
    oasFraction: number;
    pensionFraction: number;
    governmentBenefitFraction: number; // cpp + oas + pension combined
  };

  /** Risk and allocation — no balances */
  portfolio: {
    equityAllocationPct: number;
    bondAllocationPct: number;
    equityReturnAssumptionPct: number;
    bondReturnAssumptionPct: number;
    inflationAssumptionPct: number;
    impliedPortfolioReturnPct: number;
  };

  /** Structural flags — boolean insights the AI can comment on */
  planFlags: {
    hasTfsa: boolean;
    hasRrsp: boolean;
    hasDbPension: boolean;
    hasDcPension: boolean;
    hasDisabilityInsurance: boolean;
    hasCriticalIllness: boolean;
    hasLifeInsurance: boolean;
    isOnTrack: boolean;           // successRate >= 0.80
    needsAttention: boolean;      // 0.60 <= successRate < 0.80
    atRisk: boolean;              // successRate < 0.60
    tfsaUnderutilized: boolean;
    rrspUnderutilized: boolean;
    nonRegisteredConcentration: boolean; // >50% of assets in non-reg
    insuranceGap: boolean;
    cppDeferralBenefit: boolean;  // CPP at 70 vs 65 analysis
  };

  /** Canadian regulatory context — province only, no names */
  context: {
    province: string;             // "ON", "BC", etc. — not PII
    planningYear: number;         // Calendar year for tax rules
    hasSpouse: boolean;           // Boolean only
  };
}

// ── AI narrative response type ────────────────────────────────────────────────
export interface AiNarrativeResult {
  executiveSummary: string;
  retirementOutlook: string;
  keyStrengths: string[];
  keyRisks: string[];
  priorityRecommendations: Array<{
    title: string;
    rationale: string;
    priority: "high" | "medium" | "low";
    timeline: string;
  }>;
  monteCarloInterpretation: string;
  incomeStrategyNarrative: string;
  disclaimerSupplement: string;
  /** Raw model used — for audit logging */
  _meta: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    generatedAt: string;
    payloadHash: string; // SHA-256 of the de-identified payload for audit trail
  };
}

// ── De-identification function ────────────────────────────────────────────────
/**
 * Takes raw simulation inputs (with real dollar amounts) and produces a
 * de-identified payload safe for transmission to the Anthropic API.
 *
 * Called server-side only. The `rawInputs` object must never be sent anywhere.
 */
export function buildDeidentifiedPayload(rawInputs: {
  // Monte Carlo results (already computed on-server)
  successRate: number;
  simulationCount: number;
  guardrailTriggerRate: number;
  guardrailFloor: number;
  guardrailCeiling: number;
  finalBalancePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  // Plan parameters (real dollar amounts — NEVER sent to AI)
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  startingPortfolio: number;
  desiredAnnualIncome: number;
  annualContribution: number;
  cppAnnual: number;
  oasAnnual: number;
  pensionAnnual: number;
  // Portfolio
  equityAllocationPct: number;
  bondAllocationPct: number;
  equityReturnPct: number;
  bondReturnPct: number;
  inflationPct: number;
  // Plan flags (boolean — safe to send)
  hasTfsa: boolean;
  hasRrsp: boolean;
  hasDbPension: boolean;
  hasDcPension: boolean;
  hasDisabilityInsurance: boolean;
  hasCriticalIllness: boolean;
  hasLifeInsurance: boolean;
  tfsaUnderutilized: boolean;
  rrspUnderutilized: boolean;
  nonRegisteredConcentration: boolean;
  insuranceGap: boolean;
  hasSpouse: boolean;
  province: string;
}): DeidentifiedSimulationPayload {

  const yearsToRetirement  = Math.max(0, rawInputs.retirementAge - rawInputs.currentAge);
  const yearsInRetirement  = Math.max(1, rawInputs.lifeExpectancy - rawInputs.retirementAge);

  // All dollar amounts converted to RATIOS using desired income as the unit
  const incomeUnit = rawInputs.desiredAnnualIncome || 1;

  // Projected portfolio at retirement (deterministic, using median)
  const projectedPortfolio  = rawInputs.finalBalancePercentiles.p50;
  const requiredPortfolio   = incomeUnit / 0.04;  // 4% rule
  const fundingRatio        = requiredPortfolio > 0 ? projectedPortfolio / requiredPortfolio : 0;
  const surplusMultiple     = (projectedPortfolio - requiredPortfolio) / incomeUnit;

  // Government and pension income fractions
  const govTotal     = rawInputs.cppAnnual + rawInputs.oasAnnual + rawInputs.pensionAnnual;
  const portWithdraw = Math.max(0, incomeUnit - govTotal);
  const totalIncome  = incomeUnit || 1;

  const impliedReturn = (rawInputs.equityAllocationPct / 100) * rawInputs.equityReturnPct
                      + (rawInputs.bondAllocationPct   / 100) * rawInputs.bondReturnPct;

  return {
    horizon: {
      yearsToRetirement,
      yearsInRetirement,
      totalYears:    yearsToRetirement + yearsInRetirement,
      retirementAge: rawInputs.retirementAge,
      lifeExpectancy: rawInputs.lifeExpectancy,
    },
    monteCarlo: {
      successRate:         rawInputs.successRate,
      simulationCount:     rawInputs.simulationCount,
      guardrailTriggerRate: rawInputs.guardrailTriggerRate,
      guardrailFloor:      rawInputs.guardrailFloor,
      guardrailCeiling:    rawInputs.guardrailCeiling,
    },
    portfolioReadiness: {
      fundingRatio,
      surplusMultiple: Math.round(surplusMultiple * 10) / 10,
      outcomeMultiples: {
        p10: Math.round((rawInputs.finalBalancePercentiles.p10 / incomeUnit) * 10) / 10,
        p25: Math.round((rawInputs.finalBalancePercentiles.p25 / incomeUnit) * 10) / 10,
        p50: Math.round((rawInputs.finalBalancePercentiles.p50 / incomeUnit) * 10) / 10,
        p75: Math.round((rawInputs.finalBalancePercentiles.p75 / incomeUnit) * 10) / 10,
        p90: Math.round((rawInputs.finalBalancePercentiles.p90 / incomeUnit) * 10) / 10,
      },
    },
    incomeComposition: {
      portfolioWithdrawalFraction: portWithdraw / totalIncome,
      cppFraction:                 rawInputs.cppAnnual    / totalIncome,
      oasFraction:                 rawInputs.oasAnnual    / totalIncome,
      pensionFraction:             rawInputs.pensionAnnual / totalIncome,
      governmentBenefitFraction:   govTotal / totalIncome,
    },
    portfolio: {
      equityAllocationPct:        rawInputs.equityAllocationPct,
      bondAllocationPct:          rawInputs.bondAllocationPct,
      equityReturnAssumptionPct:  rawInputs.equityReturnPct,
      bondReturnAssumptionPct:    rawInputs.bondReturnPct,
      inflationAssumptionPct:     rawInputs.inflationPct,
      impliedPortfolioReturnPct:  Math.round(impliedReturn * 10) / 10,
    },
    planFlags: {
      hasTfsa:                    rawInputs.hasTfsa,
      hasRrsp:                    rawInputs.hasRrsp,
      hasDbPension:               rawInputs.hasDbPension,
      hasDcPension:               rawInputs.hasDcPension,
      hasDisabilityInsurance:     rawInputs.hasDisabilityInsurance,
      hasCriticalIllness:         rawInputs.hasCriticalIllness,
      hasLifeInsurance:           rawInputs.hasLifeInsurance,
      isOnTrack:                  rawInputs.successRate >= 0.80,
      needsAttention:             rawInputs.successRate >= 0.60 && rawInputs.successRate < 0.80,
      atRisk:                     rawInputs.successRate < 0.60,
      tfsaUnderutilized:          rawInputs.tfsaUnderutilized,
      rrspUnderutilized:          rawInputs.rrspUnderutilized,
      nonRegisteredConcentration: rawInputs.nonRegisteredConcentration,
      insuranceGap:               rawInputs.insuranceGap,
      cppDeferralBenefit:         rawInputs.retirementAge <= 65,
    },
    context: {
      province:     rawInputs.province || "ON",
      planningYear: new Date().getFullYear(),
      hasSpouse:    rawInputs.hasSpouse,
    },
  };
}

// ── Prompt builder ────────────────────────────────────────────────────────────
function buildPrompt(payload: DeidentifiedSimulationPayload): string {
  const { horizon, monteCarlo, portfolioReadiness, incomeComposition, portfolio, planFlags, context } = payload;
  const sr = (monteCarlo.successRate * 100).toFixed(0);
  const fr = (portfolioReadiness.fundingRatio * 100).toFixed(0);

  return `You are a senior Canadian financial planning analyst. You are writing narrative commentary for a CONFIDENTIAL client financial plan prepared by a licensed advisor. The plan is governed by Canadian regulations including PIPEDA and provincial securities rules.

IMPORTANT: You have received ONLY de-identified statistical data — no client names, no dollar amounts, and no personally identifiable information. Your response must contain ZERO dollar amounts and ZERO identifying information. Write entirely in percentages, ratios, years, and qualitative descriptions. The advisor's report system will insert real figures from the database after you respond.

══ DE-IDENTIFIED SIMULATION DATA ══

Retirement Horizon:
  • Years to retirement: ${horizon.yearsToRetirement}
  • Years in retirement: ${horizon.yearsInRetirement}
  • Target retirement age: ${horizon.retirementAge}
  • Life expectancy modelled: ${horizon.lifeExpectancy}

Monte Carlo Results (${monteCarlo.simulationCount.toLocaleString()} simulations):
  • Success rate: ${sr}% (portfolio lasts through ${horizon.lifeExpectancy})
  • Guardrail trigger rate: ${(monteCarlo.guardrailTriggerRate * 100).toFixed(0)}% of simulations hit a spending adjustment
  • Guardrail floor: ${(monteCarlo.guardrailFloor * 100).toFixed(0)}% of glide path triggers spending reduction
  • Guardrail ceiling: ${(monteCarlo.guardrailCeiling * 100).toFixed(0)}% of glide path allows spending increase

Portfolio Funding (expressed as multiples of annual income target):
  • Funding ratio: ${fr}% of required portfolio (4% withdrawal rule)
  • Surplus/shortfall: ${portfolioReadiness.surplusMultiple > 0 ? "+" : ""}${portfolioReadiness.surplusMultiple}× annual income
  • Outcome range (multiples of annual income):
      Best 10% (p90): ${portfolioReadiness.outcomeMultiples.p90}×
      Upper range (p75): ${portfolioReadiness.outcomeMultiples.p75}×
      Median (p50): ${portfolioReadiness.outcomeMultiples.p50}×
      Lower range (p25): ${portfolioReadiness.outcomeMultiples.p25}×
      Worst 10% (p10): ${portfolioReadiness.outcomeMultiples.p10}×

Income Composition at Retirement (fractions of total desired income):
  • Portfolio withdrawals: ${(incomeComposition.portfolioWithdrawalFraction * 100).toFixed(0)}%
  • CPP/QPP: ${(incomeComposition.cppFraction * 100).toFixed(0)}%
  • OAS: ${(incomeComposition.oasFraction * 100).toFixed(0)}%
  • Employer pension: ${(incomeComposition.pensionFraction * 100).toFixed(0)}%
  • Total government/pension benefits: ${(incomeComposition.governmentBenefitFraction * 100).toFixed(0)}%

Portfolio Assumptions:
  • Asset mix: ${portfolio.equityAllocationPct}% equity / ${portfolio.bondAllocationPct}% fixed income
  • Assumed equity return: ${portfolio.equityReturnAssumptionPct}%
  • Assumed bond return: ${portfolio.bondReturnAssumptionPct}%
  • Inflation assumption: ${portfolio.inflationAssumptionPct}%
  • Blended portfolio return: ${portfolio.impliedPortfolioReturnPct}%

Plan Structure Flags:
  • TFSA in use: ${planFlags.hasTfsa ? "Yes" : "No"}${planFlags.tfsaUnderutilized ? " (underutilized)" : ""}
  • RRSP in use: ${planFlags.hasRrsp ? "Yes" : "No"}${planFlags.rrspUnderutilized ? " (underutilized)" : ""}
  • Defined benefit pension: ${planFlags.hasDbPension ? "Yes" : "No"}
  • Defined contribution pension: ${planFlags.hasDcPension ? "Yes" : "No"}
  • Life insurance: ${planFlags.hasLifeInsurance ? "Yes" : "No"}${planFlags.insuranceGap ? " (gap identified)" : ""}
  • Disability insurance: ${planFlags.hasDisabilityInsurance ? "Yes" : "No"}
  • Critical illness coverage: ${planFlags.hasCriticalIllness ? "Yes" : "No"}
  • Non-registered concentration risk: ${planFlags.nonRegisteredConcentration ? "Yes" : "No"}
  • CPP deferral analysis relevant: ${planFlags.cppDeferralBenefit ? "Yes" : "No"}
  • Has spouse: ${context.hasSpouse ? "Yes" : "No"}
  • Province: ${context.province}
  • Planning year: ${context.planningYear}

Status: ${planFlags.isOnTrack ? "ON TRACK" : planFlags.needsAttention ? "NEEDS ATTENTION" : "AT RISK"}

══ RESPONSE FORMAT ══

Respond with valid JSON only. No markdown fences. No preamble. No dollar signs. No specific dollar amounts.

{
  "executiveSummary": "2–3 sentence narrative paragraph. Describe overall plan health using percentages and qualitative language only.",
  "retirementOutlook": "2–3 sentence paragraph describing retirement readiness using funding ratio and success rate language.",
  "keyStrengths": ["3–5 short strength statements. Use ratios/percentages, no dollar figures."],
  "keyRisks": ["3–5 short risk statements. Use ratios/percentages, no dollar figures."],
  "priorityRecommendations": [
    {
      "title": "Short action title",
      "rationale": "1–2 sentences. Why this matters for this plan specifically. Reference percentages from the data.",
      "priority": "high|medium|low",
      "timeline": "e.g. Immediate, Within 12 months, Annual review"
    }
  ],
  "monteCarloInterpretation": "2–3 sentences interpreting the Monte Carlo results in plain language for a client. Reference the success rate percentage and what the guardrail trigger rate implies.",
  "incomeStrategyNarrative": "2–3 sentences on the income composition and any CPP/OAS optimization considerations relevant to this province.",
  "disclaimerSupplement": "1 sentence noting that projections are based on assumptions and actual results will vary."
}`;
}

// ── SHA-256 hash for audit logging ────────────────────────────────────────────
async function hashPayload(payload: DeidentifiedSimulationPayload): Promise<string> {
  const data = new TextEncoder().encode(JSON.stringify(payload));
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
  }
  // Fallback: simple checksum for environments without webcrypto
  return String(JSON.stringify(payload).length) + "_" + Date.now();
}

// ── Main export: generate AI narrative ────────────────────────────────────────
/**
 * Generates AI narrative for a financial planning report.
 *
 * @param payload    - A de-identified payload (no PII). Build with buildDeidentifiedPayload().
 * @param auditMeta  - Optional metadata for the audit log (clientId, companyId, reportType).
 * @returns Structured narrative suitable for injection into the HTML report.
 *
 * PIPEDA compliance: Only the de-identified payload is transmitted. The real
 * client data (names, balances, account numbers) must be merged by the caller
 * AFTER this function returns, entirely within the server boundary.
 *
 * Every call — success or failure — is written to ai_audit_log automatically.
 */
export async function generatePipedaCompliantNarrative(
  payload:   DeidentifiedSimulationPayload,
  auditMeta: { clientId?: number; companyId?: number; reportType?: string } = {}
): Promise<AiNarrativeResult> {
  const prompt      = buildPrompt(payload);
  const hash        = await hashPayload(payload);
  const reportType  = auditMeta.reportType ?? "retirement";
  const startMs     = Date.now();

  let success      = true;
  let errorMessage: string | undefined;
  let model        = "claude-sonnet-4-20250514";
  let inputTokens  = 0;
  let outputTokens = 0;

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 2000,
      messages:   [{ role: "user", content: prompt }],
      system: `You are a licensed Canadian financial planning assistant writing report narratives. 
You MUST respond with valid JSON only. 
You MUST NOT include any dollar amounts — use percentages, ratios, and multiples only.
You MUST NOT include any client names or identifying information.
All financial figures in your response must be expressed as ratios or percentages.`,
    });

    model        = message.model;
    inputTokens  = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;

    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map(b => b.text)
      .join("");

    const cleaned = rawText.replace(/```json\n?|```\n?/g, "").trim();

    let parsed: Omit<AiNarrativeResult, "_meta">;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = {
        executiveSummary:         "This plan has been analysed using Monte Carlo simulation across multiple market scenarios.",
        retirementOutlook:        `With a ${(payload.monteCarlo.successRate * 100).toFixed(0)}% probability of success across ${payload.monteCarlo.simulationCount.toLocaleString()} simulations, this plan ${payload.planFlags.isOnTrack ? "appears on track" : "requires attention"} to meet retirement income objectives.`,
        keyStrengths:             [],
        keyRisks:                 [],
        priorityRecommendations:  [],
        monteCarloInterpretation: `The simulation indicates a ${(payload.monteCarlo.successRate * 100).toFixed(0)}% success rate.`,
        incomeStrategyNarrative:  "Review income composition with your advisor annually.",
        disclaimerSupplement:     "All projections are based on assumptions and actual results will vary.",
      };
    }

    return {
      ...parsed,
      _meta: {
        model,
        inputTokens,
        outputTokens,
        generatedAt:  new Date().toISOString(),
        payloadHash:  hash,
      },
    };

  } catch (err: any) {
    success      = false;
    errorMessage = err?.message ?? "Unknown error";
    throw err;

  } finally {
    // ── Auto-write PIPEDA audit record ────────────────────────────────────────
    // Runs whether the call succeeded or failed.
    // Contains ZERO PII — only hashes, token counts, and metadata.
    const durationMs = Date.now() - startMs;
    db.insert(aiAuditLog).values({
      clientId:     auditMeta.clientId  ?? null,
      companyId:    auditMeta.companyId ?? null,
      reportType,
      payloadHash:  hash,
      model,
      inputTokens,
      outputTokens,
      success,
      errorMessage: errorMessage ?? null,
      durationMs,
    }).catch(logErr => {
      // Log but never let an audit write failure surface to the caller
      console.error("[pipeda-audit] Failed to write audit log:", logErr?.message);
    });
  }
}

// ── Report assembly ───────────────────────────────────────────────────────────
/**
 * Merges the AI narrative with real client data SERVER-SIDE.
 *
 * This is the only place where PII and AI output meet.
 * It runs entirely within the Fly.io server — nothing is transmitted.
 *
 * @param narrative  - AI-generated narrative (no PII)
 * @param realData   - Real client data from the database (never sent to AI)
 */
export function assembleReportContext(
  narrative: AiNarrativeResult,
  realData: {
    clientName:     string;
    advisorName:    string;
    successRate:    number;
    fundingRatio:   number;
    finalBalanceP50: number;
    requiredPortfolio: number;
    desiredAnnualIncome: number;
    retirementAge:  number;
    province:       string;
    firmName?:      string;
  }
) {
  return {
    // Real data (used in HTML templates, stays on server)
    client:   { name: realData.clientName },
    advisor:  { name: realData.advisorName },
    firm:     realData.firmName ?? "Compass CRM",
    metrics:  {
      successRatePct:     (realData.successRate * 100).toFixed(0),
      fundingRatioPct:    (realData.fundingRatio * 100).toFixed(0),
      finalBalanceP50:    realData.finalBalanceP50,
      requiredPortfolio:  realData.requiredPortfolio,
      desiredIncome:      realData.desiredAnnualIncome,
      retirementAge:      realData.retirementAge,
      province:           realData.province,
    },
    // AI narrative (no PII, safe to log)
    narrative,
  };
}
