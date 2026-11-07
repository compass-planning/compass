import { getBenefitRate } from "./loader.js";

export interface CppProjection {
  startAge: number;
  monthlyBenefit: number;
  annualBenefit: number;
  adjustmentFactor: number;
  adjustmentLabel: string;
}

export function projectCpp(
  startAge: number,
  maxMonthlyBenefit?: number
): CppProjection {
  const cppMax = maxMonthlyBenefit ?? getBenefitRate("cpp_max_monthly");
  const clampedAge = Math.max(60, Math.min(70, startAge));

  let adjustmentFactor: number;
  let adjustmentLabel: string;

  if (clampedAge < 65) {
    const monthsEarly = (65 - clampedAge) * 12;
    adjustmentFactor = 1 - monthsEarly * 0.006;
    adjustmentLabel = `${(monthsEarly * 0.6).toFixed(1)}% reduction`;
  } else if (clampedAge > 65) {
    const monthsLate = (clampedAge - 65) * 12;
    adjustmentFactor = 1 + monthsLate * 0.007;
    adjustmentLabel = `${(monthsLate * 0.7).toFixed(1)}% increase`;
  } else {
    adjustmentFactor = 1.0;
    adjustmentLabel = "standard (no adjustment)";
  }

  const monthlyBenefit = cppMax * adjustmentFactor;
  const annualBenefit = monthlyBenefit * 12;

  return {
    startAge: clampedAge,
    monthlyBenefit,
    annualBenefit,
    adjustmentFactor,
    adjustmentLabel,
  };
}

export function cppTimingComparison(maxMonthlyBenefit?: number): {
  at60: CppProjection;
  at65: CppProjection;
  at70: CppProjection;
  breakEven60vs65: number;
  breakEven65vs70: number;
} {
  const at60 = projectCpp(60, maxMonthlyBenefit);
  const at65 = projectCpp(65, maxMonthlyBenefit);
  const at70 = projectCpp(70, maxMonthlyBenefit);

  const breakEven60vs65 = computeBreakEvenAge(60, at60.annualBenefit, 65, at65.annualBenefit);
  const breakEven65vs70 = computeBreakEvenAge(65, at65.annualBenefit, 70, at70.annualBenefit);

  return { at60, at65, at70, breakEven60vs65, breakEven65vs70 };
}

function computeBreakEvenAge(
  earlyAge: number,
  earlyAnnual: number,
  lateAge: number,
  lateAnnual: number
): number {
  let earlyCumulative = 0;
  let lateCumulative = 0;

  for (let age = earlyAge; age <= 100; age++) {
    if (age < lateAge) {
      earlyCumulative += earlyAnnual;
    } else {
      earlyCumulative += earlyAnnual;
      lateCumulative += lateAnnual;
    }

    if (lateCumulative > earlyCumulative && age >= lateAge) {
      return age;
    }
  }

  return 100;
}

export interface OasProjection {
  startAge: number;
  monthlyBenefit: number;
  annualBenefit: number;
  deferralIncrease: number;
  clawbackAmount: number;
  netAnnualBenefit: number;
}

export function projectOas(
  startAge: number,
  totalIncome: number,
  yearsInCanada: number = 40,
  maxMonthlyBenefit?: number
): OasProjection {
  const oasMax = maxMonthlyBenefit ?? getBenefitRate("oas_max_monthly");
  const clawbackThreshold = getBenefitRate("oas_clawback_threshold");
  const clawbackRate = getBenefitRate("oas_clawback_rate");

  const clampedAge = Math.max(65, Math.min(70, startAge));
  const residencyFraction = Math.min(yearsInCanada / 40, 1);
  const baseBenefit = oasMax * residencyFraction;

  let deferralIncrease = 0;
  if (clampedAge > 65) {
    const monthsDeferred = (clampedAge - 65) * 12;
    deferralIncrease = monthsDeferred * 0.006;
  }

  const monthlyBenefit = baseBenefit * (1 + deferralIncrease);
  const annualBenefit = monthlyBenefit * 12;

  let clawbackAmount = 0;
  if (totalIncome > clawbackThreshold) {
    clawbackAmount = Math.min(annualBenefit, (totalIncome - clawbackThreshold) * clawbackRate);
  }

  const netAnnualBenefit = annualBenefit - clawbackAmount;

  return {
    startAge: clampedAge,
    monthlyBenefit,
    annualBenefit,
    deferralIncrease,
    clawbackAmount,
    netAnnualBenefit,
  };
}

export function oasDeferralComparison(
  totalIncome: number,
  yearsInCanada: number = 40,
  maxMonthlyBenefit?: number
): {
  at65: OasProjection;
  at66: OasProjection;
  at67: OasProjection;
  at68: OasProjection;
  at69: OasProjection;
  at70: OasProjection;
} {
  return {
    at65: projectOas(65, totalIncome, yearsInCanada, maxMonthlyBenefit),
    at66: projectOas(66, totalIncome, yearsInCanada, maxMonthlyBenefit),
    at67: projectOas(67, totalIncome, yearsInCanada, maxMonthlyBenefit),
    at68: projectOas(68, totalIncome, yearsInCanada, maxMonthlyBenefit),
    at69: projectOas(69, totalIncome, yearsInCanada, maxMonthlyBenefit),
    at70: projectOas(70, totalIncome, yearsInCanada, maxMonthlyBenefit),
  };
}

export function calculateOasClawback(totalIncome: number, oasAnnual: number): number {
  const threshold = getBenefitRate("oas_clawback_threshold");
  const rate = getBenefitRate("oas_clawback_rate");

  if (totalIncome <= threshold) return 0;
  return Math.min(oasAnnual, (totalIncome - threshold) * rate);
}

export function calculateCapitalGainInclusion(capitalGain: number): number {
  if (capitalGain <= 250000) {
    return capitalGain * 0.5;
  }
  return 250000 * 0.5 + (capitalGain - 250000) * 0.6667;
}
