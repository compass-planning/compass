/**
 * usSocialSecurity.ts
 * Social Security timing analysis for the US engine.
 * Mirrors server/engine/reference/cppOas.ts in interface shape.
 */

import {
  getSsFra,
  adjustSsBenefit,
  estimatePia,
  ssTaxableAmount,
  SS_BEND_POINT_1_2025,
  SS_BEND_POINT_2_2025,
} from "../reference/usBenefitRates2025.js";
import type { SsTimingAnalysis, SsTimingOption, SsSpouseAnalysis } from "../tax/usTypes.js";

// ── Timing analysis (ages 62–70) ─────────────────────────────────────────────

export function analyzeSsTiming(
  pia: number,
  birthYear: number,
  provisionalIncomeAtRetirement?: number,
  filingStatus: "single" | "mfj" = "single",
): SsTimingAnalysis {
  const fra = getSsFra(birthYear);
  const claimAges = [62, 63, 64, 65, 66, 67, 68, 69, 70];
  const options: SsTimingOption[] = [];

  for (const age of claimAges) {
    const adj = adjustSsBenefit(pia, age, birthYear);
    const annual = adj.annualBenefit;

    // Lifetime to 85 and 90 (naive — no discounting; useful for simple break-even)
    const yearsTo85 = Math.max(0, 85 - age);
    const yearsTo90 = Math.max(0, 90 - age);
    const lifetimeTo85 = annual * yearsTo85;
    const lifetimeTo90 = annual * yearsTo90;

    options.push({
      claimAge:             age,
      monthlyBenefit:       adj.monthlyBenefit,
      annualBenefit:        annual,
      adjustmentFactor:     adj.adjustmentFactor,
      adjustmentLabel:      adj.adjustmentLabel,
      lifetimeBenefitTo85:  lifetimeTo85,
      lifetimeBenefitTo90:  lifetimeTo90,
      breakEvenVsPriorAge:  null, // filled in below
    });
  }

  // Calculate break-even ages between adjacent options
  for (let i = 1; i < options.length; i++) {
    const early = options[i - 1];
    const late  = options[i];
    const be    = computeBreakEvenAge(
      early.claimAge, early.annualBenefit,
      late.claimAge,  late.annualBenefit,
    );
    options[i].breakEvenVsPriorAge = be;
  }

  // Recommended age: simple heuristic
  // - If in good health and no liquidity need: 70
  // - If married: higher earner delays for survivor benefit
  // - If health concerns or need income: FRA or earlier
  let recommendedAge = 70;
  let recommendedReasoning =
    "Delaying to age 70 maximises lifetime benefit and provides the highest " +
    "survivor benefit for a spouse. Break-even vs. claiming at FRA is typically " +
    `age ${options.find(o => o.claimAge > fra)?.breakEvenVsPriorAge ?? 81}. ` +
    "Consider claiming earlier if health is a concern or liquidity is needed.";

  if (provisionalIncomeAtRetirement !== undefined && provisionalIncomeAtRetirement < 30_000) {
    recommendedAge = Math.round(fra);
    recommendedReasoning =
      "Low projected provisional income means SS benefits will be largely or fully tax-free. " +
      "Claiming at FRA balances total lifetime benefit with earlier cash flow.";
  }

  return { pia, fra, options, recommendedAge, recommendedReasoning };
}

// ── Spousal benefit analysis ──────────────────────────────────────────────────

export function analyzeSsSpousal(
  higherEarnerPia:   number,
  lowerEarnerPia:    number,
  higherEarnerAge:   number,
  lowerEarnerAge:    number,
  higherBirthYear:   number,
  lowerBirthYear:    number,
): SsSpouseAnalysis {
  // Spousal benefit = 50% of higher earner's PIA (reduced if taken before FRA)
  const spousalBenefit = Math.max(0, higherEarnerPia * 0.50 - lowerEarnerPia);

  // Survivor benefit = 100% of higher earner's benefit (including any DRC)
  const higherEarnerAdj = adjustSsBenefit(higherEarnerPia, 70, higherBirthYear);
  const survivorBenefit = higherEarnerAdj.monthlyBenefit * 12;

  const lowerEarnerFra  = getSsFra(lowerBirthYear);
  const higherEarnerFra = getSsFra(higherBirthYear);

  let strategy: string;
  if (lowerEarnerPia > higherEarnerPia * 0.50) {
    strategy =
      "Both spouses benefit from their own earnings record. Higher earner should " +
      `delay to age 70 to maximise the survivor benefit ($${survivorBenefit.toLocaleString()}/yr). ` +
      `Lower earner can claim at age ${Math.round(lowerEarnerFra)} (FRA).`;
  } else {
    strategy =
      `Lower earner qualifies for a spousal benefit of ~$${Math.round(spousalBenefit * 12).toLocaleString()}/yr ` +
      `(50% of higher earner's PIA minus own benefit). ` +
      `Higher earner should delay to 70 to maximise the survivor benefit ($${survivorBenefit.toLocaleString()}/yr). ` +
      `Lower earner should wait until their own FRA (${Math.round(lowerEarnerFra)}) to claim the spousal benefit.`;
  }

  return {
    spouseOwnBenefit:    lowerEarnerPia * 12,
    spousalBenefit:      spousalBenefit * 12,
    survivorBenefit,
    recommendedStrategy: strategy,
  };
}

// ── Provisional income / taxability ──────────────────────────────────────────

export function ssBenefitTaxable(
  grossAnnualBenefit: number,
  agi:                number,
  taxExemptInterest:  number,
  filingStatus:       "single" | "mfj",
): number {
  const provisionalIncome = agi + taxExemptInterest + grossAnnualBenefit * 0.50;
  return ssTaxableAmount(grossAnnualBenefit, provisionalIncome, filingStatus);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeBreakEvenAge(
  earlyAge:   number,
  earlyAnnual: number,
  lateAge:    number,
  lateAnnual: number,
): number {
  let earlyCumulative = 0;
  let lateCumulative  = 0;

  for (let age = earlyAge; age <= 100; age++) {
    earlyCumulative += earlyAnnual;
    if (age >= lateAge) lateCumulative += lateAnnual;
    if (lateCumulative > earlyCumulative && age >= lateAge) return age;
  }
  return 100;
}

/** Estimate PIA from career earnings summary (simplified). */
export function estimatePiaFromCareerEarnings(
  highestEarningsYears: number[],  // up to 35 actual earnings years (indexed)
): number {
  const sorted = [...highestEarningsYears].sort((a, b) => b - a).slice(0, 35);
  while (sorted.length < 35) sorted.push(0); // pad to 35
  const totalIndexed = sorted.reduce((s, n) => s + n, 0);
  const aime = Math.floor(totalIndexed / 420); // 35 yrs × 12 months
  return estimatePia(aime);
}

export { adjustSsBenefit, getSsFra, estimatePia, ssTaxableAmount };
