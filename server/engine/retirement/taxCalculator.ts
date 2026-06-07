import { calculateCombinedTax, getMarginalRate } from "../reference/taxBrackets";
import { getBenefitRate } from "../reference/loader";
import { resolveProvinceCode } from "./provinceMap";

export interface TaxResult {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
}

export function calculateRetirementTax(
  taxableIncome: number,
  province: string
): TaxResult {
  const provinceCode = resolveProvinceCode(province);
  const bpa = getBenefitRate("bpa_federal");
  return calculateCombinedTax(taxableIncome, provinceCode, bpa);
}

export function getRetirementMarginalRate(taxableIncome: number, province: string): number {
  const provinceCode = resolveProvinceCode(province);
  return getMarginalRate(taxableIncome, provinceCode);
}

export interface PensionSplitResult {
  selfTaxableIncome: number;
  spouseTaxableIncome: number;
  selfTax: number;
  spouseTax: number;
  combinedTax: number;
  taxSavings: number;
}

export function optimizePensionSplit(
  selfIncome: number,
  eligiblePensionIncome: number,
  spouseIncome: number,
  province: string,
  maxSplitRate: number = 0.5
): PensionSplitResult {
  const provinceCode = resolveProvinceCode(province);
  const bpa = getBenefitRate("bpa_federal");

  const noSplitSelfTax = calculateCombinedTax(selfIncome, provinceCode, bpa).totalTax;
  const noSplitSpouseTax = calculateCombinedTax(spouseIncome, provinceCode, bpa).totalTax;
  const noSplitTotal = noSplitSelfTax + noSplitSpouseTax;

  let bestSplit = 0;
  let bestCombined = noSplitTotal;

  for (let splitPct = 0.05; splitPct <= maxSplitRate; splitPct += 0.05) {
    const transferred = eligiblePensionIncome * splitPct;
    const adjSelfIncome = selfIncome - transferred;
    const adjSpouseIncome = spouseIncome + transferred;
    const selfTax = calculateCombinedTax(adjSelfIncome, provinceCode, bpa).totalTax;
    const spouseTax = calculateCombinedTax(adjSpouseIncome, provinceCode, bpa).totalTax;
    const combined = selfTax + spouseTax;
    if (combined < bestCombined) {
      bestCombined = combined;
      bestSplit = splitPct;
    }
  }

  const transferred = eligiblePensionIncome * bestSplit;
  const selfTaxableIncome = selfIncome - transferred;
  const spouseTaxableIncome = spouseIncome + transferred;
  const selfTax = calculateCombinedTax(selfTaxableIncome, provinceCode, bpa).totalTax;
  const spouseTax = calculateCombinedTax(spouseTaxableIncome, provinceCode, bpa).totalTax;

  return {
    selfTaxableIncome,
    spouseTaxableIncome,
    selfTax,
    spouseTax,
    combinedTax: selfTax + spouseTax,
    taxSavings: noSplitTotal - (selfTax + spouseTax),
  };
}

export function rrspVsTfsaDecision(
  currentIncome: number,
  expectedRetirementIncome: number,
  province: string
): { recommendation: "rrsp" | "tfsa" | "balanced"; currentMarginalRate: number; projectedRetirementRate: number; rationale: string } {
  const currentRate = getRetirementMarginalRate(currentIncome, province);
  const retirementRate = getRetirementMarginalRate(expectedRetirementIncome, province);
  const diff = currentRate - retirementRate;

  if (diff > 0.05) {
    return {
      recommendation: "rrsp",
      currentMarginalRate: currentRate,
      projectedRetirementRate: retirementRate,
      rationale: `Current marginal rate (${(currentRate * 100).toFixed(1)}%) is significantly higher than projected retirement rate (${(retirementRate * 100).toFixed(1)}%). RRSP contributions provide greater tax benefit now.`,
    };
  } else if (diff < -0.05) {
    return {
      recommendation: "tfsa",
      currentMarginalRate: currentRate,
      projectedRetirementRate: retirementRate,
      rationale: `Projected retirement marginal rate (${(retirementRate * 100).toFixed(1)}%) is higher than current rate (${(currentRate * 100).toFixed(1)}%). TFSA avoids tax on withdrawals in retirement.`,
    };
  }

  return {
    recommendation: "balanced",
    currentMarginalRate: currentRate,
    projectedRetirementRate: retirementRate,
    rationale: `Marginal rates are similar (current ${(currentRate * 100).toFixed(1)}% vs retirement ${(retirementRate * 100).toFixed(1)}%). Split contributions between RRSP and TFSA for flexibility.`,
  };
}
