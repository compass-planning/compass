import { calculateCombinedTax, getMarginalRate } from "../reference/taxBrackets.js";
import { getBenefitRate } from "../reference/loader.js";
import { projectCpp, projectOas } from "../reference/cppOas.js";
import { resolveProvinceCode } from "../retirement/provinceMap.js";
import { getRrspAnnualLimit, getTfsaAnnualLimit } from "./roomTracker.js";
import type { TaxProjectionProfile, TaxYearProjection } from "./types.js";

// ── 2024 capital gains inclusion rates ───────────────────────────────────────
const INCLUSION_RATE_LOW  = 0.50;  // ≤ $250,000 personal annual gain
const INCLUSION_RATE = 0.50;


// ── RRIF minimum withdrawal factors (from benefitRates) ──────────────────────
// Simplified: use 1/(90-age) until age 65, then CRA schedule
function rrifMinFactor(age: number): number {
  if (age < 65) return 1 / Math.max(1, 90 - age);
  // CRA published factors — approximate schedule
  const factors: Record<number, number> = {
    65: 0.0400, 66: 0.0417, 67: 0.0435, 68: 0.0453, 69: 0.0473,
    70: 0.0500, 71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567,
    75: 0.0582, 76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658,
    80: 0.0682, 81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808,
    85: 0.0851, 86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099,
    90: 0.1192, 91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879,
    95: 0.2000,
  };
  return factors[Math.min(age, 95)] ?? 0.20;
}

// ── Main projection function ──────────────────────────────────────────────────

export function projectTaxYears(profile: TaxProjectionProfile): TaxYearProjection[] {
  const provinceCode  = resolveProvinceCode(profile.province);
  const bpa           = getBenefitRate("bpa_federal");
  const currentYear   = new Date().getFullYear();
  const years         = profile.planToAge - profile.currentAge;

  const rows: TaxYearProjection[] = [];

  let rrspBalance    = profile.rrspBalance;
  let tfsaBalance    = profile.tfsaBalance;
  let nonRegBalance  = profile.nonRegBalance;
  let nonRegAcb      = profile.nonRegAcb;
  let rrspRoom       = profile.rrspContributionRoom;
  let tfsaRoom       = profile.tfsaContributionRoom;

  for (let i = 0; i < years; i++) {
    const year  = currentYear + i;
    const age   = profile.currentAge + i;
    const phase = age < profile.retirementAge ? "accumulation" : "retirement";

    let employmentIncome  = 0;
    let pensionIncome     = 0;
    let rrifWithdrawal    = 0;
    let tfsaWithdrawal    = 0;
    let capitalGainsIncome = 0;
    let cppBenefit        = 0;
    let oasBenefit        = 0;

    // ── Annual RRSP / TFSA room ───────────────────────────────────────────────
    const rrspLimitThisYear = getRrspAnnualLimit(year);
    const tfsaLimitThisYear = getTfsaAnnualLimit(year);

    // ── Accumulation phase ────────────────────────────────────────────────────
    if (phase === "accumulation") {
      const yearsWorked = i;
      employmentIncome =
        profile.employmentIncome * Math.pow(1 + profile.incomeGrowthRate, yearsWorked)
        + profile.selfEmploymentIncome
        + profile.otherIncome;

      // RRSP contributions
      const newRrspRoom     = Math.min(0.18 * employmentIncome, rrspLimitThisYear);
      rrspRoom              = Math.max(0, rrspRoom + newRrspRoom - profile.rrspAnnualContribution);
      rrspBalance           = (rrspBalance + profile.rrspAnnualContribution) * (1 + profile.portfolioYield);

      // TFSA contributions
      tfsaRoom              = Math.max(0, tfsaRoom + tfsaLimitThisYear - profile.tfsaAnnualContribution);
      tfsaBalance           = (tfsaBalance + profile.tfsaAnnualContribution) * (1 + profile.portfolioYield);

      // Non-reg growth
      const nonRegReturn    = nonRegBalance * profile.portfolioYield;
      const nonRegDividends = nonRegReturn * 0.30;  // 30% of return as eligible dividends
      const capitalReturn   = nonRegReturn * 0.70;  // 70% as capital appreciation
      nonRegBalance         = (nonRegBalance + profile.nonRegAnnualContrib) * (1 + profile.portfolioYield);
      nonRegAcb            += profile.nonRegAnnualContrib;
      capitalGainsIncome    = capitalReturn * 0.05; // modest annual crystallization

    // ── Retirement phase ──────────────────────────────────────────────────────
    } else {
      // CPP
      if (age >= profile.cppStartAge) {
        const cpp   = projectCpp(profile.cppStartAge);
        cppBenefit  = cpp.annualBenefit;
      }

      // OAS
      if (age >= profile.oasStartAge) {
        const oas   = projectOas(profile.oasStartAge, profile.desiredRetirementIncome, 40);
        oasBenefit  = oas.annualBenefit;
      }

      pensionIncome = profile.pensionIncome;

      // RRIF minimum withdrawal (RRSP converts at 71)
      if (age >= 72) {
        rrifWithdrawal = rrspBalance * rrifMinFactor(age);
        rrspBalance    = Math.max(0, rrspBalance - rrifWithdrawal) * (1 + profile.portfolioYield);
      } else {
        rrspBalance = rrspBalance * (1 + profile.portfolioYield);
      }

      // Determine if TFSA withdrawal needed to top up income
      const incomeFromRegistered =
        cppBenefit + oasBenefit + pensionIncome + rrifWithdrawal;
      const desiredAfterTax     = profile.desiredRetirementIncome;
      const shortfall           = Math.max(0, desiredAfterTax - incomeFromRegistered * 0.75); // rough after-tax
      tfsaWithdrawal            = Math.min(shortfall, tfsaBalance * 0.10);
      tfsaBalance               = Math.max(0, tfsaBalance - tfsaWithdrawal) * (1 + profile.portfolioYield);
      tfsaRoom                 += tfsaLimitThisYear + tfsaWithdrawal; // withdrawals re-added

      // Non-reg growth
      nonRegBalance             = nonRegBalance * (1 + profile.portfolioYield);
      capitalGainsIncome        = nonRegBalance * 0.02; // modest crystallization
    }

    // ── Taxable income calculation ────────────────────────────────────────────
    const totalGrossIncome = employmentIncome + pensionIncome + rrifWithdrawal
      + cppBenefit + oasBenefit;

    // Capital gains inclusion (2024+ rates)
    const inclusionRate = INCLUSION_RATE;
    const taxableCapGains   = capitalGainsIncome * inclusionRate;

    const totalTaxableIncome = Math.max(0, totalGrossIncome + taxableCapGains);

    // ── Tax calculation ───────────────────────────────────────────────────────
    const taxResult = calculateCombinedTax(totalTaxableIncome, provinceCode, bpa);
    const marginal  = getMarginalRate(totalTaxableIncome, provinceCode);

    const netIncome       = totalGrossIncome + tfsaWithdrawal - taxResult.totalTax;
    const desiredSpend    = phase === "retirement" ? profile.desiredRetirementIncome : 0;
    const disposableIncome = netIncome - desiredSpend;

    const totalWealth = rrspBalance + tfsaBalance + nonRegBalance;

    rows.push({
      year,
      age,
      phase,
      employmentIncome,
      pensionIncome,
      rrifWithdrawal,
      tfsaWithdrawal,
      capitalGainsIncome,
      cppBenefit,
      oasBenefit,
      otherIncome: profile.otherIncome,
      totalGrossIncome,
      totalTaxableIncome,
      federalTax:     taxResult.federalTax,
      provincialTax:  taxResult.provincialTax,
      totalTax:       taxResult.totalTax,
      effectiveRate:  taxResult.effectiveRate,
      marginalRate:   marginal,
      netIncome,
      disposableIncome,
      rrspBalance:    Math.max(0, rrspBalance),
      tfsaBalance:    Math.max(0, tfsaBalance),
      nonRegBalance:  Math.max(0, nonRegBalance),
      totalWealth:    Math.max(0, totalWealth),
      rrspRoomAvailable: Math.max(0, rrspRoom),
      tfsaRoomAvailable: Math.max(0, tfsaRoom),
    });
  }

  return rows;
}
