// ============================================================================
// FINANCIAL PLAN GUARDRAIL SYSTEM
// ============================================================================
// Continuously validates financial plans using Monte Carlo stress testing
// Flags plans that need recalculation or have low probability of success

import type { PortfolioAllocation} from "./monteCarlo.js";
import { runMonteCarloSimulation, PRESET_ALLOCATIONS } from "./monteCarlo.js";
import type { Client } from "../../../shared/schema.js";

// ── Guardrail Thresholds ───────────────────────────────────────────────────

export const GUARDRAIL_THRESHOLDS = {
  // Probability of success thresholds
  CRITICAL: 0.50,      // Below 50% = critical risk
  WARNING: 0.70,       // Below 70% = warning
  GOOD: 0.85,          // Above 85% = good shape
  EXCELLENT: 0.95,     // Above 95% = excellent
  
  // Deviation thresholds for triggering recalculation
  INCOME_CHANGE: 0.10,         // 10% change in income
  ASSET_CHANGE: 0.15,          // 15% change in assets
  AGE_CHANGE: 1,               // 1 year passed
  CONTRIBUTION_CHANGE: 0.20,   // 20% change in contributions
};

// ── Plan Health Status ─────────────────────────────────────────────────────

export type PlanHealth = "excellent" | "good" | "warning" | "critical";

export interface GuardrailCheck {
  health: PlanHealth;
  probabilityOfSuccess: number;
  issues: string[];
  recommendations: string[];
  lastChecked: Date;
  nextCheckDue: Date;
}

// ── Guardrail Flags ────────────────────────────────────────────────────────

export type GuardrailFlagType =
  | "income_changed"
  | "assets_changed"
  | "age_milestone"
  | "contribution_changed"
  | "low_probability"
  | "market_volatility"
  | "goal_at_risk";

export interface GuardrailFlag {
  id: string;
  type: GuardrailFlagType;
  severity: "info" | "warning" | "critical";
  message: string;
  createdAt: Date;
  resolvedAt?: Date;
  metadata?: Record<string, any>;
}

// ── Run Guardrail Check ────────────────────────────────────────────────────

export interface GuardrailInput {
  clientId: number;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
  
  // Current assets
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  
  // Income & contributions
  annualIncome: number;
  rrspContribution: number;
  tfsaContribution: number;
  nonRegContribution: number;
  
  // Retirement needs
  desiredRetirementIncome: number;
  pensionIncome: number;
  cppAmount: number;
  oasAmount: number;
  
  // Portfolio allocation
  allocation?: PortfolioAllocation;
  
  // Previous simulation (for comparison)
  previousSimulation?: {
    probabilityOfSuccess: number;
    expectedValue: number[];
  };
}

export async function runGuardrailCheck(
  input: GuardrailInput
): Promise<GuardrailCheck> {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const flags: GuardrailFlag[] = [];
  
  // Determine portfolio allocation
  const allocation = input.allocation || determineAllocation(input.currentAge, input.retirementAge);
  
  // Years to retirement
  const yearsToRetirement = input.retirementAge - input.currentAge;
  const yearsInRetirement = input.lifeExpectancy - input.retirementAge;
  
  // ── Accumulation Phase Simulation ────────────────────────────────────────
  
  const totalAssets = input.rrspBalance + input.tfsaBalance + input.nonRegBalance;
  const totalContributions = 
    input.rrspContribution + input.tfsaContribution + input.nonRegContribution;
  
  const accumulationSim = runMonteCarloSimulation({
    initialBalance: totalAssets,
    allocation,
    annualContribution: totalContributions,
    yearsToSimulate: yearsToRetirement,
    numberOfPaths: 5000,
  });
  
  // ── Retirement Phase Simulation ──────────────────────────────────────────
  
  // Calculate required withdrawals in retirement
  const totalGuaranteedIncome = input.pensionIncome + input.cppAmount + input.oasAmount;
  const requiredWithdrawal = Math.max(0, input.desiredRetirementIncome - totalGuaranteedIncome);
  
  // Use median accumulation result as starting point
  const retirementStartBalance = accumulationSim.percentiles.p50[yearsToRetirement];
  
  // Shift to more conservative allocation in retirement
  const retirementAllocation = shiftToConservative(allocation);
  
  const retirementSim = runMonteCarloSimulation({
    initialBalance: retirementStartBalance,
    allocation: retirementAllocation,
    annualContribution: -requiredWithdrawal,  // Negative = withdrawal
    yearsToSimulate: yearsInRetirement,
    numberOfPaths: 5000,
  });
  
  const probabilityOfSuccess = retirementSim.probabilityOfSuccess;
  
  // ── Analyze Results ──────────────────────────────────────────────────────
  
  // Check probability thresholds
  if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.CRITICAL) {
    issues.push(`Critical: Only ${(probabilityOfSuccess * 100).toFixed(0)}% chance of funding retirement`);
    recommendations.push("Increase savings rate immediately or reduce retirement income target");
    recommendations.push("Consider working 2-3 years longer to improve odds");
  } else if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.WARNING) {
    issues.push(`Warning: ${(probabilityOfSuccess * 100).toFixed(0)}% chance of meeting retirement goals`);
    recommendations.push("Increase monthly contributions by 10-20%");
    recommendations.push("Review portfolio allocation for age-appropriate risk");
  } else if (probabilityOfSuccess < GUARDRAIL_THRESHOLDS.GOOD) {
    issues.push(`Moderate risk: ${(probabilityOfSuccess * 100).toFixed(0)}% success probability`);
    recommendations.push("Consider small increases to savings to improve margin of safety");
  }
  
  // Check if assets are on track
  const yearsElapsed = Math.min(5, yearsToRetirement);
  const expectedValue = accumulationSim.expectedValue[yearsElapsed];
  const tenthPercentile = accumulationSim.percentiles.p10[yearsElapsed];
  
  if (totalAssets < tenthPercentile * 0.8) {
    issues.push("Assets below 10th percentile projection - behind target");
    recommendations.push("Review spending and increase savings rate");
  }
  
  // Check contribution adequacy
  const savingsRate = totalContributions / input.annualIncome;
  const recommendedRate = yearsToRetirement > 20 ? 0.15 : 0.20;
  
  if (savingsRate < recommendedRate) {
    issues.push(
      `Savings rate of ${(savingsRate * 100).toFixed(0)}% is below ` +
      `recommended ${(recommendedRate * 100).toFixed(0)}%`
    );
    recommendations.push(`Increase annual savings by $${((recommendedRate - savingsRate) * input.annualIncome).toFixed(0)}`);
  }
  
  // Check allocation appropriateness
  const equityAllocation = 
    allocation.canEquity + allocation.usEquity + allocation.intlEquity;
  const recommendedEquity = Math.max(0.20, Math.min(0.90, (100 - input.currentAge) / 100));
  
  if (Math.abs(equityAllocation - recommendedEquity) > 0.15) {
    issues.push(
      `Equity allocation of ${(equityAllocation * 100).toFixed(0)}% may not be ` +
      `age-appropriate (recommended: ${(recommendedEquity * 100).toFixed(0)}%)`
    );
    if (equityAllocation < recommendedEquity) {
      recommendations.push("Consider increasing equity allocation for better growth potential");
    } else {
      recommendations.push("Consider reducing equity allocation to lower volatility risk");
    }
  }
  
  // Determine overall health
  let health: PlanHealth;
  if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.EXCELLENT) {
    health = "excellent";
  } else if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.GOOD) {
    health = "good";
  } else if (probabilityOfSuccess >= GUARDRAIL_THRESHOLDS.WARNING) {
    health = "warning";
  } else {
    health = "critical";
  }
  
  return {
    health,
    probabilityOfSuccess,
    issues,
    recommendations,
    lastChecked: new Date(),
    nextCheckDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
  };
}

// ── Allocation Helpers ─────────────────────────────────────────────────────

function determineAllocation(currentAge: number, retirementAge: number): PortfolioAllocation {
  const yearsToRetirement = retirementAge - currentAge;
  
  if (yearsToRetirement > 20) {
    return PRESET_ALLOCATIONS.AGGRESSIVE;
  } else if (yearsToRetirement > 10) {
    return PRESET_ALLOCATIONS.BALANCED;
  } else if (yearsToRetirement > 5) {
    return PRESET_ALLOCATIONS.MODERATE;
  } else {
    return PRESET_ALLOCATIONS.CONSERVATIVE;
  }
}

function shiftToConservative(allocation: PortfolioAllocation): PortfolioAllocation {
  // Reduce equity by 20 percentage points, increase fixed income
  const equityReduction = 0.20;
  const totalEquity = allocation.canEquity + allocation.usEquity + allocation.intlEquity;
  const scaleFactor = Math.max(0, totalEquity - equityReduction) / totalEquity;
  
  return {
    canEquity: allocation.canEquity * scaleFactor,
    usEquity: allocation.usEquity * scaleFactor,
    intlEquity: allocation.intlEquity * scaleFactor,
    fixedIncome: allocation.fixedIncome + equityReduction,
    cash: allocation.cash,
  };
}

// ── Detect Changes Requiring Recalculation ────────────────────────────────

export interface PlanSnapshot {
  income: number;
  assets: number;
  age: number;
  contributions: number;
}

export function detectSignificantChanges(
  previous: PlanSnapshot,
  current: PlanSnapshot
): GuardrailFlag[] {
  const flags: GuardrailFlag[] = [];
  
  // Income change
  const incomeChange = Math.abs(current.income - previous.income) / previous.income;
  if (incomeChange > GUARDRAIL_THRESHOLDS.INCOME_CHANGE) {
    flags.push({
      id: `income_${Date.now()}`,
      type: "income_changed",
      severity: "warning",
      message: `Income changed by ${(incomeChange * 100).toFixed(0)}% - plan should be recalculated`,
      createdAt: new Date(),
      metadata: { previous: previous.income, current: current.income },
    });
  }
  
  // Asset change
  const assetChange = Math.abs(current.assets - previous.assets) / previous.assets;
  if (assetChange > GUARDRAIL_THRESHOLDS.ASSET_CHANGE) {
    flags.push({
      id: `assets_${Date.now()}`,
      type: "assets_changed",
      severity: "info",
      message: `Assets changed by ${(assetChange * 100).toFixed(0)}% - consider updating plan`,
      createdAt: new Date(),
      metadata: { previous: previous.assets, current: current.assets },
    });
  }
  
  // Age milestone
  if (current.age - previous.age >= GUARDRAIL_THRESHOLDS.AGE_CHANGE) {
    flags.push({
      id: `age_${Date.now()}`,
      type: "age_milestone",
      severity: "info",
      message: "Annual review recommended - age has changed",
      createdAt: new Date(),
      metadata: { previous: previous.age, current: current.age },
    });
  }
  
  // Contribution change
  const contribChange = Math.abs(current.contributions - previous.contributions) / previous.contributions;
  if (contribChange > GUARDRAIL_THRESHOLDS.CONTRIBUTION_CHANGE) {
    flags.push({
      id: `contrib_${Date.now()}`,
      type: "contribution_changed",
      severity: "warning",
      message: `Contributions changed by ${(contribChange * 100).toFixed(0)}% - recalculation recommended`,
      createdAt: new Date(),
      metadata: { previous: previous.contributions, current: current.contributions },
    });
  }
  
  return flags;
}

// ── Spending Flexibility Guardrail Engine ─────────────────────────────────────
// The core guardrail model: if portfolio drops below the "floor" threshold,
// reduce spending by flexDown%. If portfolio rises above "ceiling", increase
// spending by flexUp%. This converts a probability number into actionable advice.

export interface GuardrailParams {
  // Portfolio thresholds (as fraction of "on-track" balance)
  floorPct:    number;   // e.g. 0.80 = cut spending when portfolio < 80% of target path
  ceilingPct:  number;   // e.g. 1.20 = increase spending when portfolio > 120% of target
  flexDown:    number;   // e.g. 0.10 = reduce spending by 10% when floor triggered
  flexUp:      number;   // e.g. 0.10 = increase spending by 10% when ceiling triggered
}

export interface GuardrailTrigger {
  year:              number;   // calendar year
  age:               number;
  targetPathBalance: number;   // what the median path shows
  floorBalance:      number;   // floor trigger level
  ceilingBalance:    number;   // ceiling trigger level
  reducedSpending:   number;   // spending if floor triggered
  increasedSpending: number;   // spending if ceiling triggered
  baseSpending:      number;
}

export interface GuardrailResult {
  baseSuccessRate:     number;
  adjustedSuccessRate: number;
  successRateGain:     number;
  params:              GuardrailParams;
  triggerTable:        GuardrailTrigger[];
  recommendation:      string;
}

export function applySpendingFlexibility(
  // Base simulation result (from runMonteCarloSimulation)
  basePaths:          number[][],       // [pathIndex][year] = balance
  medianPath:         number[],         // p50 by year (the "target path")
  baseAnnualWithdrawal: number,         // base retirement spending net of guaranteed income
  retirementYear:     number,           // index in paths where retirement starts
  params:             GuardrailParams,
  retirementAge:      number,
  inflationRate:      number = 0.02,
): GuardrailResult {

  const N = basePaths.length;
  const years = basePaths[0].length - 1;

  // ── Calculate adjusted success with spending flexibility ──────────────────
  let adjustedSuccessCount = 0;
  let baseSuccessCount = 0;

  for (const path of basePaths) {
    // Base success: does portfolio survive retirement without touching spending?
    const baseEnds = path[path.length - 1];
    if (baseEnds > 0) baseSuccessCount++;

    // Adjusted: simulate with dynamic spending adjustments
    let balance = path[retirementYear] ?? path[Math.min(retirementYear, path.length - 1)];
    let spending = baseAnnualWithdrawal;
    let survived = true;

    for (let yr = retirementYear; yr < path.length - 1; yr++) {
      // Get return for this year from the path
      const prevBal = path[yr];
      const nextBal = path[yr + 1];
      // Infer return: nextBal = prevBal * (1+r) - spending
      // r = (nextBal + spending - prevBal) / prevBal (approximate)
      const impliedReturn = prevBal > 0 ? (nextBal + baseAnnualWithdrawal - prevBal) / prevBal : 0;

      // Apply return to our adjusted balance
      balance = balance * (1 + impliedReturn);

      // Guardrail check against median path at this year
      const targetBalance = medianPath[yr] ?? medianPath[medianPath.length - 1];
      if (targetBalance > 0) {
        if (balance < targetBalance * params.floorPct) {
          spending = baseAnnualWithdrawal * (1 - params.flexDown);
        } else if (balance > targetBalance * params.ceilingPct) {
          spending = baseAnnualWithdrawal * (1 + params.flexUp);
        } else {
          spending = baseAnnualWithdrawal;
        }
      }

      balance -= spending;
      if (balance <= 0) { survived = false; break; }
    }

    if (survived && balance > 0) adjustedSuccessCount++;
  }

  const baseSuccessRate     = baseSuccessCount / N;
  const adjustedSuccessRate = adjustedSuccessCount / N;
  const gain                = adjustedSuccessRate - baseSuccessRate;

  // ── Build trigger table ────────────────────────────────────────────────────
  const triggerTable: GuardrailTrigger[] = [];
  const retirementYears = years - retirementYear;

  for (let i = 0; i < Math.min(retirementYears, 30); i++) {
    const pathIdx = retirementYear + i;
    const targetPathBalance = medianPath[pathIdx] ?? 0;
    const inflAdj = Math.pow(1 + inflationRate, i);
    const baseSpending = baseAnnualWithdrawal * inflAdj;

    triggerTable.push({
      year:              new Date().getFullYear() + i,
      age:               retirementAge + i,
      targetPathBalance: Math.round(targetPathBalance),
      floorBalance:      Math.round(targetPathBalance * params.floorPct),
      ceilingBalance:    Math.round(targetPathBalance * params.ceilingPct),
      baseSpending:      Math.round(baseSpending),
      reducedSpending:   Math.round(baseSpending * (1 - params.flexDown)),
      increasedSpending: Math.round(baseSpending * (1 + params.flexUp)),
    });
  }

  // ── Plain-English recommendation ──────────────────────────────────────────
  const gainPct  = (gain * 100).toFixed(0);
  const flexPct  = (params.flexDown * 100).toFixed(0);
  const reducedAmt = Math.round(baseAnnualWithdrawal * (1 - params.flexDown)).toLocaleString("en-CA");
  let recommendation = "";

  if (gain > 0.05) {
    recommendation = `Applying a ${flexPct}% spending flexibility guardrail increases your plan success rate from ${(baseSuccessRate * 100).toFixed(0)}% to ${(adjustedSuccessRate * 100).toFixed(0)}% — a ${gainPct}-point improvement. In years when your portfolio falls below the floor trigger, reduce annual withdrawals from $${Math.round(baseAnnualWithdrawal).toLocaleString("en-CA")} to $${reducedAmt}. This is the single highest-impact adjustment available.`;
  } else if (gain > 0.01) {
    recommendation = `Spending flexibility adds ${gainPct} percentage points to your success rate (${(baseSuccessRate * 100).toFixed(0)}% → ${(adjustedSuccessRate * 100).toFixed(0)}%). The plan is already reasonably strong; guardrails provide a useful safety margin but are not urgently required.`;
  } else {
    recommendation = `Your plan has a ${(baseSuccessRate * 100).toFixed(0)}% base success rate. Spending flexibility adds minimal uplift in this scenario, suggesting the plan is either already very robust or that flexibility alone cannot compensate for the underlying shortfall — consider also increasing contributions or delaying retirement.`;
  }

  return {
    baseSuccessRate,
    adjustedSuccessRate,
    successRateGain: gain,
    params,
    triggerTable,
    recommendation,
  };
}
