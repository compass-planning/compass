/**
 * usCapitalGains.ts
 * US capital gains and Roth conversion analysis.
 * Mirrors server/engine/tax/capitalGains.ts (Canadian side).
 */

import {
  calculateCombinedTaxUS,
  calculateLtcgTax,
  type FilingStatus,
} from "../reference/usTaxData2025.js";
import {
  US_NIIT_THRESHOLDS_2025,
  US_NIIT_RATE,
} from "../reference/usTaxData2025.js";
import {
  getRmdStartAge,
  US_ESTATE_TAX_EXEMPTION_2025,
  estimateStepUpBenefit,
} from "../reference/usBenefitRates2025.js";
import type {
  UsCapitalGainsPosition,
  UsCapitalGainsAnalysis,
  UsCapitalGainsScenario,
  RothConversionAnalysis,
  RothConversionScenario,
  UsTaxYearProjection,
} from "./usTypes.js";

// ── Capital Gains Analysis ────────────────────────────────────────────────────

export function analyzeUsCapitalGains(
  positions:          UsCapitalGainsPosition[],
  ordinaryIncome:     number,    // taxable income before gains
  filingStatus:       FilingStatus,
  usState:            string,
  projectedYears?:    UsTaxYearProjection[],
): UsCapitalGainsAnalysis {
  const ltcgPositions  = positions.filter(p => p.isLongTerm && !p.isLoss);
  const stcgPositions  = positions.filter(p => !p.isLongTerm && !p.isLoss);
  const lossPositions  = positions.filter(p => p.isLoss);

  const totalLtcg      = ltcgPositions.reduce((s, p) => s + p.unrealizedGain, 0);
  const totalStcg      = stcgPositions.reduce((s, p) => s + p.unrealizedGain, 0);
  const totalLoss      = Math.abs(lossPositions.reduce((s, p) => s + p.unrealizedGain, 0));
  const netLtcg        = Math.max(0, totalLtcg - totalLoss);

  // Annual loss harvesting: $3k ordinary income deduction per year; unlimited vs. gains
  const harvestingOpp  = totalLoss;

  // Step-up-in-basis narrative
  const stepUpBenefit  = estimateStepUpBenefit(totalLtcg + totalStcg, 0.20);
  const stepUpOpportunity =
    totalLtcg + totalStcg > 50_000
      ? `Holding appreciated assets until death could save ~$${stepUpBenefit.toLocaleString(undefined, { maximumFractionDigits: 0 })} ` +
        `in LTCG tax through step-up in basis. Consider bequest vs. gifting strategy.`
      : "Step-up in basis benefit is modest at current gain levels.";

  // Build scenarios (LTCG only — STCG taxed as ordinary)
  const scenarios: UsCapitalGainsScenario[] = [];

  const buildLtcgScenario = (label: string, ltcgAmount: number): UsCapitalGainsScenario => {
    const netAmount     = Math.max(0, ltcgAmount - totalLoss);
    const ltcgTax       = calculateLtcgTax(ordinaryIncome, netAmount, filingStatus);
    const totalIncome   = ordinaryIncome + netAmount;
    const niitThreshold = US_NIIT_THRESHOLDS_2025[filingStatus];
    const niit          = totalIncome > niitThreshold
      ? Math.min(netAmount, totalIncome - niitThreshold) * US_NIIT_RATE
      : 0;
    // State taxes gains as ordinary in most states (CA has no preferential rate)
    const stateResult   = calculateCombinedTaxUS(ordinaryIncome + netAmount, filingStatus, usState);
    const baseStateResult = calculateCombinedTaxUS(ordinaryIncome, filingStatus, usState);
    const stateTax      = Math.max(0, stateResult.stateTax - baseStateResult.stateTax);
    const totalTax      = ltcgTax + niit + stateTax;
    return {
      label,
      amountRealized:    ltcgAmount,
      isLongTerm:        true,
      ltcgTax,
      niit,
      stateTax,
      totalTax,
      netProceeds:       ltcgAmount - totalTax,
      effectiveTaxRate:  ltcgAmount > 0 ? totalTax / ltcgAmount : 0,
    };
  };

  if (netLtcg > 0) {
    scenarios.push(buildLtcgScenario("Realize 25%",   netLtcg * 0.25));
    scenarios.push(buildLtcgScenario("Realize 50%",   netLtcg * 0.50));
    scenarios.push(buildLtcgScenario("Realize 100%",  netLtcg));
    scenarios.push(buildLtcgScenario("Realize $50k",  Math.min(50_000, netLtcg)));
    scenarios.push(buildLtcgScenario("Realize $100k", Math.min(100_000, netLtcg)));
  }

  // STCG scenarios (taxed as ordinary income)
  if (totalStcg > 0) {
    const stcgLabel = "Short-term gain (ordinary rate)";
    const stcgTaxResult = calculateCombinedTaxUS(ordinaryIncome + totalStcg, filingStatus, usState);
    const baseTaxResult = calculateCombinedTaxUS(ordinaryIncome, filingStatus, usState);
    const stcgTax       = stcgTaxResult.totalTax - baseTaxResult.totalTax;
    scenarios.push({
      label:           stcgLabel,
      amountRealized:  totalStcg,
      isLongTerm:      false,
      ltcgTax:         0,
      niit:            0,
      stateTax:        stcgTaxResult.stateTax - baseTaxResult.stateTax,
      totalTax:        stcgTax,
      netProceeds:     totalStcg - stcgTax,
      effectiveTaxRate: totalStcg > 0 ? stcgTax / totalStcg : 0,
    });
  }

  // Recommended year (lowest marginal rate)
  let recommendedYear = new Date().getFullYear();
  let reasoning       = "No year-by-year projection provided — realizing in current year.";

  if (projectedYears && projectedYears.length > 0) {
    const best = projectedYears.reduce((prev, row) => {
      if (row.marginalRate < prev.marginalRate) return row;
      return prev;
    }, projectedYears[0]);

    recommendedYear = best.year;
    reasoning =
      `Year ${best.year} (age ${best.age}) projects the lowest combined marginal rate of ` +
      `${(best.marginalRate * 100).toFixed(1)}% with taxable income of ` +
      `$${best.totalTaxableIncome.toLocaleString()}. ` +
      best.inRothConversionWindow
        ? "This is also a Roth conversion window — coordinate gains with any conversion planning."
        : "";
  }

  const rothConversionInterplay =
    totalLtcg > 0
      ? "Realizing LTCG in the same year as a Roth conversion can push combined income into a higher " +
        "ordinary bracket, reducing the benefit of both. Model each year carefully."
      : "No significant LTCG noted; Roth conversion planning can proceed without gains conflict.";

  return {
    positions,
    totalUnrealizedLtcg: totalLtcg,
    totalUnrealizedStcg: totalStcg,
    totalUnrealizedLoss: totalLoss,
    netUnrealizedLtcg:   netLtcg,
    harvestingOpportunity: harvestingOpp,
    stepUpOpportunity,
    scenarios,
    recommendedYear,
    reasoning,
    rothConversionInterplay,
  };
}

// ── Roth Conversion Analysis ──────────────────────────────────────────────────

export function analyzeRothConversion(
  tradIraBalance:     number,
  rothBalance:        number,
  currentAge:         number,
  birthYear:          number,
  ssClaimAge:         number,
  retirementAge:      number,
  ordinaryIncome:     number,     // current-year before conversion
  filingStatus:       FilingStatus,
  usState:            string,
  projectedYears?:    UsTaxYearProjection[],
): RothConversionAnalysis {
  const rmdStartAge    = getRmdStartAge(birthYear);
  const yearsToRmd     = Math.max(0, rmdStartAge - currentAge);
  const yearsToSs      = Math.max(0, ssClaimAge - currentAge);
  // Conversion window = before both SS and RMDs kick in
  const windowEnd      = Math.min(rmdStartAge, ssClaimAge);
  const yearsInWindow  = Math.max(0, windowEnd - Math.max(currentAge, retirementAge));

  const conversionAmounts = [10_000, 25_000, 50_000, 75_000, 100_000];
  const scenarios: RothConversionScenario[] = [];

  for (const amount of conversionAmounts) {
    if (amount > tradIraBalance) break;

    // Tax cost of conversion
    const taxWithout  = calculateCombinedTaxUS(ordinaryIncome, filingStatus, usState).totalTax;
    const taxWith     = calculateCombinedTaxUS(ordinaryIncome + amount, filingStatus, usState).totalTax;
    const addlTax     = taxWith - taxWithout;
    const marginalRate = addlTax / amount;

    // Projected benefit: avoid future RMDs taxed at potentially higher rates
    // Simplified: assume future tax rate is marginalRate + 0.03 (SS + RMD stacking effect)
    const futureMarginal = Math.min(marginalRate + 0.03, 0.37);
    const futureRmdTax   = amount * futureMarginal; // tax avoided
    const growthYears    = Math.max(0, 85 - currentAge);
    const growthFactor   = Math.pow(1.06, growthYears); // 6% assumed growth
    const taxFreeBenefit = amount * growthFactor * futureMarginal;
    const netLifetime    = taxFreeBenefit - addlTax;

    // Break-even: years for Roth growth to exceed upfront tax cost
    let breakEven = 0;
    let diff = -addlTax;
    for (let yr = 1; yr <= 40; yr++) {
      diff += amount * 0.06 * (futureMarginal - marginalRate); // annual tax differential
      if (diff >= 0) { breakEven = yr; break; }
    }

    scenarios.push({
      label:                   `Convert $${amount.toLocaleString()}`,
      conversionAmount:        amount,
      additionalTax:           addlTax,
      marginalRateOnConversion: marginalRate,
      netTaxSavingsLifetime:   netLifetime,
      breakEvenYears:          breakEven || 40,
    });
  }

  // Recommended conversion: fill up current bracket without hitting next one
  // Find how much headroom exists before hitting the next bracket
  const currentTaxable   = ordinaryIncome;
  const BRACKET_TOPS     = filingStatus === "mfj"
    ? [23_850, 96_950, 206_700, 394_600, 501_050, 751_600]
    : [11_925, 48_475, 103_350, 197_300, 250_525, 626_350];

  let recommendedConversion = 0;
  for (const top of BRACKET_TOPS) {
    if (currentTaxable < top) {
      recommendedConversion = Math.min(top - currentTaxable, tradIraBalance);
      break;
    }
  }

  const reasoning = yearsInWindow > 0
    ? `There is a ${yearsInWindow}-year Roth conversion window (ages ${Math.max(currentAge, retirementAge)}–${windowEnd}) ` +
      `before both Social Security and RMDs begin stacking income. ` +
      `Converting ~$${recommendedConversion.toLocaleString()} per year fills the current bracket ` +
      `without crossing into the next. This reduces future RMD amounts and maximises tax-free growth.`
    : "The Roth conversion window has passed or is very short. Conversions may still be beneficial " +
      "if current marginal rate is lower than expected future rate, but coordinate carefully with " +
      "SS provisional income and IRMAA thresholds.";

  return {
    currentTradIraBalance:       tradIraBalance,
    currentRothBalance:          rothBalance,
    rmdStartAge,
    yearsInConversionWindow:     yearsInWindow,
    scenarios,
    recommendedAnnualConversion: recommendedConversion,
    reasoning,
  };
}
