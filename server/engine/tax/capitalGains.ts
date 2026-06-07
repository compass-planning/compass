import { calculateCombinedTax } from "../reference/taxBrackets.js";
import { getBenefitRate } from "../reference/loader.js";
import { resolveProvinceCode } from "../retirement/provinceMap.js";
import type {
  CapitalGainsPosition,
  CapitalGainsAnalysis,
  CapitalGainsScenario,
  IncomeSplittingAnalysis,
} from "./types.js";
import type { TaxYearProjection } from "./types.js";

// 2024: Flat 50% inclusion rate (dual-rate proposal scrapped)
const INCLUSION_RATE = 0.50;


// ── Capital Gains Analysis ────────────────────────────────────────────────────

export function analyzeCapitalGains(
  positions:       CapitalGainsPosition[],
  currentIncome:   number,
  province:        string,
  projectedYears?: TaxYearProjection[],
): CapitalGainsAnalysis {
  const provinceCode = resolveProvinceCode(province);
  const bpa          = getBenefitRate("bpa_federal");

  const gains = positions.filter(p => !p.isLoss);
  const losses = positions.filter(p => p.isLoss);

  const totalUnrealizedGain = gains.reduce((s, p) => s + p.unrealizedGain, 0);
  const totalUnrealizedLoss = Math.abs(losses.reduce((s, p) => s + p.unrealizedGain, 0));
  const netUnrealized       = totalUnrealizedGain - totalUnrealizedLoss;

  // Build scenarios
  const scenarios: CapitalGainsScenario[] = [];

  const buildScenario = (label: string, amount: number): CapitalGainsScenario => {
    const netAmount      = Math.max(0, amount - totalUnrealizedLoss); // offset losses
    const inclusionRate  = INCLUSION_RATE; // Flat 50% - 2/3 increase cancelled
    const taxableGain    = netAmount * inclusionRate;
    const incomeWithGain = currentIncome + taxableGain;
    const taxWithGain    = calculateCombinedTax(incomeWithGain, provinceCode, bpa).totalTax;
    const taxWithout     = calculateCombinedTax(currentIncome, provinceCode, bpa).totalTax;
    const estimatedTax   = Math.max(0, taxWithGain - taxWithout);
    return {
      label,
      amountRealized:        amount,
      taxableGain,
      inclusionRate,
      estimatedTax,
      netProceeds:           amount - estimatedTax,
      effectiveGainsTaxRate: amount > 0 ? estimatedTax / amount : 0,
    };
  };

  if (netUnrealized > 0) {
    scenarios.push(buildScenario("Realize 25%",  netUnrealized * 0.25));
    scenarios.push(buildScenario("Realize 50%",  netUnrealized * 0.50));
    scenarios.push(buildScenario("Realize 100%", netUnrealized));
    scenarios.push(buildScenario("Realize $50k", Math.min(50_000, netUnrealized)));
    scenarios.push(buildScenario("Realize $100k", Math.min(100_000, netUnrealized)));
  }

  // Find optimal year if we have projections (lowest marginal rate year)
  let recommendedYear   = new Date().getFullYear();
  let reasoning         = "No year-by-year projection provided — realizing in current year.";

  if (projectedYears && projectedYears.length > 0) {
    const lowestRateRow = projectedYears.reduce((best, row) => {
      // Prefer accumulation years with lower income, or first retirement year before RRIF kicks in
      if (row.marginalRate < best.marginalRate) return row;
      return best;
    }, projectedYears[0]);

    recommendedYear = lowestRateRow.year;
    reasoning = [
      `Year ${lowestRateRow.year} (age ${lowestRateRow.age}) projects the lowest marginal rate `,
      `of ${(lowestRateRow.marginalRate * 100).toFixed(1)}% with taxable income `,
      `of $${lowestRateRow.totalTaxableIncome.toLocaleString()}.`,
    ].join("");
  }

  return {
    positions,
    totalUnrealizedGain,
    totalUnrealizedLoss,
    netUnrealized,
    scenarios,
    harvestingOpportunity: totalUnrealizedLoss,
    recommendedYear,
    reasoning,
  };
}

// ── Income Splitting ──────────────────────────────────────────────────────────

export function analyzeIncomeSplitting(
  selfIncome:           number,
  spouseIncome:         number,
  eligiblePensionIncome: number,
  selfRrspBalance:      number,
  spouseRrspBalance:    number,
  yearsToRetirement:    number,
  province:             string,
): IncomeSplittingAnalysis {
  const provinceCode = resolveProvinceCode(province);
  const bpa          = getBenefitRate("bpa_federal");

  const currentSelf   = calculateCombinedTax(selfIncome,   provinceCode, bpa).totalTax;
  const currentSpouse = calculateCombinedTax(spouseIncome, provinceCode, bpa).totalTax;
  const currentTotal  = currentSelf + currentSpouse;

  // Try pension splitting (50% of eligible pension income)
  if (eligiblePensionIncome > 0) {
    const transferred      = eligiblePensionIncome * 0.5;
    const adjSelf          = selfIncome   - transferred;
    const adjSpouse        = spouseIncome + transferred;
    const splitSelf        = calculateCombinedTax(Math.max(0, adjSelf),   provinceCode, bpa).totalTax;
    const splitSpouse      = calculateCombinedTax(adjSpouse, provinceCode, bpa).totalTax;
    const optimizedTotal   = splitSelf + splitSpouse;
    const annualSavings    = currentTotal - optimizedTotal;

    if (annualSavings > 500) {
      return {
        strategy:             "pension_split",
        currentCombinedTax:   currentTotal,
        optimizedCombinedTax: optimizedTotal,
        annualTaxSavings:     annualSavings,
        lifetimeTaxSavings:   annualSavings * Math.max(0, yearsToRetirement),
        details: `Transferring $${transferred.toLocaleString()} (50% of eligible pension income) ` +
                 `to spouse reduces combined tax by $${annualSavings.toLocaleString()} per year. ` +
                 `File T1032 Election jointly on both returns.`,
      };
    }
  }

  // Try spousal RRSP (shift income to lower-earning spouse in retirement)
  const incomeGap = Math.abs(selfIncome - spouseIncome);
  if (incomeGap > 20_000 && selfRrspBalance > 0) {
    const highEarner        = selfIncome > spouseIncome ? selfIncome : spouseIncome;
    const lowEarner         = selfIncome > spouseIncome ? spouseIncome : selfIncome;
    const shiftAmount       = Math.min(incomeGap * 0.5, highEarner * 0.15);
    const adjHigh           = highEarner  - shiftAmount;
    const adjLow            = lowEarner   + shiftAmount;
    const spousalSelf       = calculateCombinedTax(adjHigh, provinceCode, bpa).totalTax;
    const spousalSpouse     = calculateCombinedTax(adjLow,  provinceCode, bpa).totalTax;
    const optimizedTotal    = spousalSelf + spousalSpouse;
    const annualSavings     = currentTotal - optimizedTotal;

    if (annualSavings > 200) {
      return {
        strategy:             "spousal_rrsp",
        currentCombinedTax:   currentTotal,
        optimizedCombinedTax: optimizedTotal,
        annualTaxSavings:     annualSavings,
        lifetimeTaxSavings:   annualSavings * Math.max(0, yearsToRetirement),
        details: `Contributing to a spousal RRSP now shifts approximately $${shiftAmount.toLocaleString()} ` +
                 `of future retirement income to the lower-earning spouse, saving an estimated ` +
                 `$${annualSavings.toLocaleString()}/yr in combined taxes after the 3-year attribution rule.`,
      };
    }
  }

  return {
    strategy:             "none",
    currentCombinedTax:   currentTotal,
    optimizedCombinedTax: currentTotal,
    annualTaxSavings:     0,
    lifetimeTaxSavings:   0,
    details: "Incomes are similar enough that splitting strategies offer minimal benefit at current levels.",
  };
}


