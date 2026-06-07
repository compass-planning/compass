/**
 * pipedaReportingService.ts
 *
 * PIPEDA-compliant AI narrative generation for retirement planning reports.
 *
 * Architecture:
 *   1. Receive full SimulationResult (contains real $ balances)
 *   2. De-identify → strip all dollar amounts, produce ratios/flags only
 *   3. Call Anthropic with de-identified payload only (no PII crosses the boundary)
 *   4. Assemble final report context server-side (merge AI narrative + real $ data)
 *   5. Return assembled context + audit trail (narrativeMeta) to caller
 *
 * What is NEVER sent to Anthropic:
 *   - Dollar balances (RRSP, TFSA, non-reg, portfolio totals)
 *   - Exact income figures
 *   - Client names, SIN, DOB, account numbers
 *   - Advisor information
 *
 * What IS sent (de-identified statistical data):
 *   - successRate (0–1 ratio)
 *   - fundingRatio (median terminal balance / income multiple target)
 *   - outcomeMultiples (p10/p25/p50/p75/p90 × annual income — no $ values)
 *   - yearsToRetirement, yearsInRetirement
 *   - equityAllocationPct
 *   - province (2-letter code, not PII on its own)
 *   - Plan boolean flags (hasTfsa, hasRrsp, hasCpp, hasOas, hasPension)
 *   - Guardrail trigger rate
 *   - CPP/OAS start ages
 */

import crypto from "crypto";
import Anthropic from "@anthropic-ai/sdk";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Shape returned by POST /api/clients/:id/simulate */
export interface SimulationResult {
  successRate: number;
  successCount: number;
  simulations: number;
  yearsProjected: number;
  retirementAge: number;
  lifeExpectancy: number;
  percentileBands: {
    p10: number[];
    p25: number[];
    p50: number[];
    p75: number[];
    p90: number[];
    labels: number[];
  };
  finalBalancePercentiles: {
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  };
  guardrails: {
    floor: number;
    ceiling: number;
    spendingFlexDown: number;
    spendingFlexUp: number;
    triggerRate: number;
  };
  inputs: {
    currentAge: number;
    retirementAge: number;
    lifeExpectancy: number;
    startingPortfolio: number;
    annualContrib: number;
    desiredIncome: number;
    equityAllocation: number;
    equityReturn: number;
    equityStdDev: number;
    bondReturn: number;
    bondStdDev: number;
    inflationRate: number;
    cppMonthly: number;
    oasMonthly: number;
    cppAge: number;
    oasAge: number;
  };
}

/** Auxiliary plan context from the database (no dollar amounts) */
export interface PlanContext {
  province: string;           // e.g. "ON"
  hasRrsp: boolean;
  hasTfsa: boolean;
  hasPension: boolean;        // any employer pension plan
  hasSpouse: boolean;
}

/** De-identified payload — the only data that crosses to Anthropic */
interface DeidentifiedPayload {
  successRate: number;
  fundingRatio: number;
  outcomeMultiples: { p10: number; p25: number; p50: number; p75: number; p90: number };
  yearsToRetirement: number;
  yearsInRetirement: number;
  equityAllocationPct: number;
  guardrailTriggerRate: number;
  cppAge: number;
  oasAge: number;
  hasCpp: boolean;
  hasOas: boolean;
  province: string;
  hasRrsp: boolean;
  hasTfsa: boolean;
  hasPension: boolean;
  hasSpouse: boolean;
  riskProfile: "conservative" | "moderate" | "growth" | "aggressive";
}

/** Real metrics merged server-side (NOT from AI output) */
export interface ReportMetrics {
  successRate: number;
  successCount: number;
  simulations: number;
  finalBalancePercentiles: SimulationResult["finalBalancePercentiles"];
  percentileBands: SimulationResult["percentileBands"];
  inputs: SimulationResult["inputs"];
  guardrails: SimulationResult["guardrails"];
}

/** Audit trail produced for every AI call (PIPEDA s. 10.1) */
export interface NarrativeMeta {
  model: string;
  inputTokens: number;
  outputTokens: number;
  generatedAt: string;   // ISO 8601
  payloadHash: string;   // SHA-256 of the de-identified JSON payload
}

/** Full assembled report context returned to the caller */
export interface ReportContext {
  narrative: string;          // AI-generated text (no PII)
  metrics: ReportMetrics;     // Real data (stays on server, sent to authenticated browser session)
  narrativeMeta: NarrativeMeta;
}

// ── De-identification layer ───────────────────────────────────────────────────

function deidentify(
  sim: SimulationResult,
  plan: PlanContext,
): DeidentifiedPayload {
  const { inputs, finalBalancePercentiles, guardrails } = sim;

  const yearsToRetirement = Math.max(0, inputs.retirementAge - inputs.currentAge);
  const yearsInRetirement = Math.max(1, inputs.lifeExpectancy - inputs.retirementAge);

  // Income target over retirement horizon (used as denominator for multiples)
  const incomeTarget = inputs.desiredIncome * yearsInRetirement;

  // fundingRatio: median terminal balance vs what's needed — stays a ratio
  const fundingRatio = incomeTarget > 0
    ? finalBalancePercentiles.p50 / incomeTarget
    : 0;

  // outcomeMultiples: express terminal balances as × annual desired income
  const toMultiple = (v: number) =>
    inputs.desiredIncome > 0
      ? Math.round((v / inputs.desiredIncome) * 10) / 10
      : 0;

  // Classify risk profile from equity allocation
  const eq = inputs.equityAllocation;
  const riskProfile: DeidentifiedPayload["riskProfile"] =
    eq >= 80 ? "aggressive"
    : eq >= 65 ? "growth"
    : eq >= 45 ? "moderate"
    : "conservative";

  return {
    successRate:          Math.round(sim.successRate * 1000) / 1000,
    fundingRatio:         Math.round(fundingRatio * 100) / 100,
    outcomeMultiples: {
      p10: toMultiple(finalBalancePercentiles.p10),
      p25: toMultiple(finalBalancePercentiles.p25),
      p50: toMultiple(finalBalancePercentiles.p50),
      p75: toMultiple(finalBalancePercentiles.p75),
      p90: toMultiple(finalBalancePercentiles.p90),
    },
    yearsToRetirement,
    yearsInRetirement,
    equityAllocationPct:  inputs.equityAllocation,
    guardrailTriggerRate: Math.round(guardrails.triggerRate * 1000) / 1000,
    cppAge:               inputs.cppAge,
    oasAge:               inputs.oasAge,
    hasCpp:               inputs.cppMonthly > 0,
    hasOas:               inputs.oasMonthly > 0,
    province:             plan.province,
    hasRrsp:              plan.hasRrsp,
    hasTfsa:              plan.hasTfsa,
    hasPension:           plan.hasPension,
    hasSpouse:            plan.hasSpouse,
    riskProfile,
  };
}

// ── Anthropic call (de-identified payload only) ───────────────────────────────

const SYSTEM_PROMPT = `You are a senior Canadian financial planning analyst writing sections of a 
retirement readiness report for a licensed financial advisor. Your audience is the advisor — 
not the client directly.

CRITICAL RULES:
1. NEVER include dollar amounts, balances, or specific income figures in your response. 
   Use ratios, multiples, and qualitative descriptors only.
2. NEVER make up or infer specific personal details (name, age, employer, account numbers).
3. Refer to "the client" generically, never by name.
4. Use plain Canadian English. Be direct and professional, not sales-y.
5. Structure your response as JSON with exactly these keys:
   - "executiveSummary": 2-3 sentence high-level readiness assessment (string)
   - "strengthsAndRisks": object with "strengths" (array of strings) and "risks" (array of strings)
   - "keyObservations": array of 3-5 concise analytical observations (strings)
   - "advisorTalkingPoints": array of 3-4 talking points the advisor can use with the client (strings)
   - "priorityActions": array of up to 4 recommended next steps (strings), ordered by priority
6. Never mention Anthropic, AI, Claude, or language models in your output.
7. Every observation must be grounded in the statistical data provided — no generic advice.`;

async function callAnthropicWithDeidentifiedPayload(
  payload: DeidentifiedPayload,
): Promise<{ narrative: string; inputTokens: number; outputTokens: number }> {
  const client = new Anthropic();

  const userMessage = `Analyze this retirement simulation data and produce the advisor report sections.

SIMULATION DATA (de-identified):
${JSON.stringify(payload, null, 2)}

CONTEXT:
- successRate: proportion of 1,000 Monte Carlo simulations where the client does not run out of 
  money before life expectancy
- fundingRatio: median terminal portfolio value divided by total income needed over retirement 
  (>1.0 = surplus, <1.0 = shortfall)
- outcomeMultiples: terminal portfolio as a multiple of one year's desired retirement income 
  across percentile bands
- guardrailTriggerRate: proportion of simulations where spending guardrails were activated
- riskProfile is derived from equityAllocationPct

Produce your analysis as valid JSON matching the schema in your instructions. 
Include no dollar amounts anywhere in your response.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  return {
    narrative: text,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// ── SHA-256 payload hash (for audit trail) ────────────────────────────────────

function hashPayload(payload: DeidentifiedPayload): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Generate a PIPEDA-compliant AI narrative for a retirement simulation result.
 *
 * @param simulationResult  Full result from POST /api/clients/:id/simulate
 * @param planContext       Plan boolean flags + province (no dollar amounts)
 * @returns ReportContext with AI narrative, real metrics, and audit meta
 */
export async function generatePipedaCompliantNarrative(
  simulationResult: SimulationResult,
  planContext: PlanContext,
): Promise<ReportContext> {
  // Step 1: De-identify (strips all dollar amounts)
  const deidentifiedPayload = deidentify(simulationResult, planContext);

  // Step 2: Hash the payload before sending (for audit trail)
  const payloadHash = hashPayload(deidentifiedPayload);

  // Step 3: Call Anthropic with de-identified data only
  const { narrative, inputTokens, outputTokens } =
    await callAnthropicWithDeidentifiedPayload(deidentifiedPayload);

  // Step 4: Assemble real metrics server-side (never from AI output)
  const metrics: ReportMetrics = {
    successRate:             simulationResult.successRate,
    successCount:            simulationResult.successCount,
    simulations:             simulationResult.simulations,
    finalBalancePercentiles: simulationResult.finalBalancePercentiles,
    percentileBands:         simulationResult.percentileBands,
    inputs:                  simulationResult.inputs,
    guardrails:              simulationResult.guardrails,
  };

  // Step 5: Build audit trail
  const narrativeMeta: NarrativeMeta = {
    model:        "claude-sonnet-4-20250514",
    inputTokens,
    outputTokens,
    generatedAt:  new Date().toISOString(),
    payloadHash,
  };

  return {
    narrative,
    metrics,
    narrativeMeta,
  };
}
