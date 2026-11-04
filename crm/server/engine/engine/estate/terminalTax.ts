import type { EstateProfile, TerminalTaxResult } from "./types";
import { calculateCombinedTax } from "../reference/taxBrackets";
import { normalizeProvince } from "./provinceNormalizer";

export function calculateTerminalTax(profile: EstateProfile): TerminalTaxResult {
  const rrspRrifInclusion = profile.rrspRrifBalance;

  const capitalGain = Math.max(0, profile.nonRegInvestments - profile.nonRegCostBase);
  const inclusionRate = 0.5;
  const capitalGainsInclusion = capitalGain * inclusionRate;

  const totalTaxableIncome = rrspRrifInclusion + capitalGainsInclusion + profile.otherIncome;

  const province = normalizeProvince(profile.province);
  const taxResult = calculateCombinedTax(totalTaxableIncome, province);

  return {
    rrspRrifInclusion,
    capitalGainsInclusion,
    totalTaxableIncome,
    estimatedTax: Math.round(taxResult.totalTax * 100) / 100,
    marginalRate: taxResult.marginalRate,
  };
}
