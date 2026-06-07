/**
 * usProjector.ts
 * Year-by-year US financial planning projection.
 * Mirrors server/engine/tax/projector.ts (Canadian side).
 *
 * Key differences from Canadian engine:
 *   - Pre-tax 401k/403b → RMDs (IRS Uniform Lifetime Table)
 *   - Roth accounts (tax-free growth + withdrawals)
 *   - Social Security (provisional income taxability up to 85%)
 *   - LTCG rates instead of 50% inclusion
 *   - NIIT 3.8% on NII above threshold
 *   - Standard deduction vs. itemized
 *   - Roth conversion window detection
 *   - IRMAA Medicare surcharge
 */

import {
  calculateCombinedTaxUS,
  calculateLtcgTax,
  getUsMarginalRate,
  US_STANDARD_DEDUCTION_2025,
  resolveStateCode,
  type FilingStatus,
} from "../reference/usTaxData2025.js";
import {
  adjustSsBenefit,
  getSsFra,
  calculateRmd,
  getRmdStartAge,
  get401kLimit,
  getIraLimit,
  US_401K_CATCHUP_50_2025,
  US_401K_CATCHUP_6063_2025,
  US_IRA_CATCHUP_50_2025,
  getMedicarePremium,
} from "../reference/usBenefitRates2025.js";
import { ssBenefitTaxable } from "../reference/usSocialSecurity.js";
import type { UsTaxProjectionProfile, UsTaxYearProjection } from "./usTypes.js";

// ── Main projection ───────────────────────────────────────────────────────────

export function projectUsTaxYears(profile: UsTaxProjectionProfile): UsTaxYearProjection[] {
  const stateCode    = resolveStateCode(profile.usState);
  const filingStatus = profile.filingStatus;
  const currentYear  = new Date().getFullYear();
  const years        = profile.planToAge - profile.currentAge;
  const fra          = getSsFra(profile.birthYear);
  const rmdStartAge  = getRmdStartAge(profile.birthYear);

  const rows: UsTaxYearProjection[] = [];

  // Mutable account balances
  let pretaxBal   = profile.pretaxBalance;
  let rothBal     = profile.rothBalance;
  let taxableBal  = profile.taxableBalance;
  let taxableBasis = profile.taxableCostBasis;
  let hsaBal      = profile.hsaBalance;
  let tradIraBal  = profile.tradIraBalance;

  for (let i = 0; i < years; i++) {
    const year  = currentYear + i;
    const age   = profile.currentAge + i;
    const phase = age < profile.retirementAge ? "accumulation" : "retirement";

    // ── Income ─────────────────────────────────────────────────────────────
    let wages                = 0;
    let selfEmp              = 0;
    let pensionIncome        = 0;
    let rmdWithdrawal        = 0;
    let rothWithdrawal       = 0;
    let taxableWithdrawal    = 0;
    let ssBenefit            = 0;
    let qualDividends        = 0;
    let ordDividends         = 0;
    let ltcgRealized         = 0;
    let selfEmpTax           = 0;

    // ── Accumulation phase ─────────────────────────────────────────────────
    if (phase === "accumulation") {
      const yearsIn   = i;
      wages           = profile.wagesIncome * Math.pow(1 + profile.incomeGrowthRate, yearsIn);
      selfEmp         = profile.selfEmploymentIncome;
      selfEmpTax      = selfEmp * 0.1413; // SE tax = 92.35% of SE income × 15.3%, deduct half

      // 401k contributions (pre-tax)
      const empLimit  = get401kLimit(year);
      const catchup   = age >= 60 && age <= 63 ? US_401K_CATCHUP_6063_2025
                      : age >= 50              ? US_401K_CATCHUP_50_2025
                      : 0;
      const contribLimit = empLimit + catchup;
      const actualContrib = Math.min(profile.pretaxAnnualContrib, contribLimit);
      pretaxBal       = (pretaxBal + actualContrib + profile.employerMatch) * (1 + profile.pretaxGrowthRate);

      // Roth contributions
      const iraLimit  = getIraLimit(year) + (age >= 50 ? US_IRA_CATCHUP_50_2025 : 0);
      const rothContrib = Math.min(profile.rothAnnualContrib, iraLimit);
      rothBal         = (rothBal + rothContrib) * (1 + profile.rothGrowthRate);

      // Taxable account growth
      const taxableReturn  = taxableBal * profile.taxableGrowthRate;
      qualDividends        = taxableReturn * profile.dividendYield * 0.70; // 70% qualified
      ordDividends         = taxableReturn * profile.dividendYield * 0.30;
      ltcgRealized         = taxableReturn * (1 - profile.dividendYield) * 0.05; // modest crystallization
      taxableBal           = (taxableBal + profile.taxableAnnualContrib) * (1 + profile.taxableGrowthRate);
      taxableBasis        += profile.taxableAnnualContrib;

      // HSA
      const hsaLimit = age >= 55 ? 4_300 + 1_000 : 4_300; // simplified
      hsaBal = (hsaBal + Math.min(profile.hsaAnnualContrib, hsaLimit)) * (1 + profile.hsaGrowthRate);

      // IRA
      tradIraBal = (tradIraBal + profile.tradIraAnnualContrib) * (1 + profile.pretaxGrowthRate);

    // ── Retirement phase ───────────────────────────────────────────────────
    } else {
      // Social Security
      if (age >= profile.ssClaimAge) {
        const ssAdj   = adjustSsBenefit(profile.ssMonthlyBenefitAtFra, profile.ssClaimAge, profile.birthYear);
        ssBenefit     = ssAdj.annualBenefit;
      }

      pensionIncome   = profile.pensionAnnualIncome *
        Math.pow(1 + profile.pensionCola, Math.max(0, age - profile.retirementAge));

      // RMD from 401k + traditional IRA
      const rmdRequired = age >= rmdStartAge;
      if (rmdRequired) {
        const rmdFromPretax = calculateRmd(age, pretaxBal, profile.birthYear);
        const rmdFromIra    = calculateRmd(age, tradIraBal, profile.birthYear);
        rmdWithdrawal       = rmdFromPretax + rmdFromIra;
        pretaxBal           = Math.max(0, pretaxBal - rmdFromPretax) * (1 + profile.pretaxGrowthRate);
        tradIraBal          = Math.max(0, tradIraBal - rmdFromIra) * (1 + profile.pretaxGrowthRate);
      } else {
        pretaxBal           = pretaxBal * (1 + profile.pretaxGrowthRate);
        tradIraBal          = tradIraBal * (1 + profile.pretaxGrowthRate);
      }

      // Taxable account dividends + modest crystallization
      const taxableReturn  = taxableBal * profile.taxableGrowthRate;
      qualDividends        = taxableReturn * profile.dividendYield * 0.70;
      ordDividends         = taxableReturn * profile.dividendYield * 0.30;
      ltcgRealized         = taxableReturn * (1 - profile.dividendYield) * 0.03;
      taxableBal           = taxableBal * (1 + profile.taxableGrowthRate);

      // Roth growth (tax-free; no RMD)
      rothBal = rothBal * (1 + profile.rothGrowthRate);

      // Determine if Roth or taxable withdrawal needed to top up income
      const grossFromRegistered = ssBenefit + pensionIncome + rmdWithdrawal;
      const roughAfterTax = grossFromRegistered * 0.78;
      const desiredSpend  = profile.desiredRetirementIncome *
        Math.pow(1 + profile.retirementIncomeGrowth, Math.max(0, age - profile.retirementAge));
      const shortfall     = Math.max(0, desiredSpend - roughAfterTax);

      // Prefer Roth (tax-free) over taxable to minimize current-year tax
      if (shortfall > 0 && rothBal > 0) {
        rothWithdrawal = Math.min(shortfall * 1.2, rothBal * 0.12);
        rothBal        = Math.max(0, rothBal - rothWithdrawal);
      }
      if (shortfall > rothWithdrawal * 0.8 && taxableBal > 0) {
        taxableWithdrawal = Math.min(shortfall - rothWithdrawal, taxableBal * 0.08);
        taxableBal        = Math.max(0, taxableBal - taxableWithdrawal);
        // Proportional basis recovery
        const basisRatio   = taxableBasis / Math.max(1, taxableBal + taxableWithdrawal);
        const basisRecovered = taxableWithdrawal * basisRatio;
        ltcgRealized      += Math.max(0, taxableWithdrawal - basisRecovered);
        taxableBasis       = Math.max(0, taxableBasis - basisRecovered);
      }

      hsaBal = hsaBal * (1 + profile.hsaGrowthRate);
    }

    // ── AGI / Taxable Income ───────────────────────────────────────────────
    const halfSelfEmpTax = selfEmpTax * 0.50; // deductible above the line
    const agiBeforeSs    = wages + selfEmp - halfSelfEmpTax + pensionIncome
                         + rmdWithdrawal + ordDividends
                         + (profile.otherOrdinaryIncome ?? 0);

    // SS provisional income
    const provisionalIncome = agiBeforeSs + ssBenefit * 0.50;
    const ssTaxableAmt = ssBenefit > 0
      ? ssBenefitTaxable(
          ssBenefit,
          agiBeforeSs,
          0, // tax-exempt interest (not modeled separately)
          filingStatus === "mfj" ? "mfj" : "single",
        )
      : 0;

    const totalAgi = agiBeforeSs + ssTaxableAmt;

    // Deduction
    const standardDed = US_STANDARD_DEDUCTION_2025[filingStatus];
    const itemizedDed  = profile.itemizedDeductions ?? 0;
    const deductionUsed = (profile.useStandardDeduction === false && itemizedDed > standardDed)
      ? itemizedDed
      : standardDed;

    const totalTaxableIncome = Math.max(0, totalAgi - deductionUsed);

    // Net investment income (for NIIT)
    const nii = qualDividends + ordDividends + ltcgRealized
              + (totalTaxableIncome > 0 ? 0 : 0); // interest income not broken out

    // ── Tax calculation ────────────────────────────────────────────────────
    const grossIncome  = totalAgi + ssBenefit - ssTaxableAmt; // approx gross
    const taxResult    = calculateCombinedTaxUS(
      totalTaxableIncome,
      filingStatus,
      stateCode,
      nii,
      wages + selfEmp,
      grossIncome,
    );

    const ltcgTaxAmt   = calculateLtcgTax(totalTaxableIncome, ltcgRealized + qualDividends, filingStatus);

    const totalTax     = taxResult.totalTax + selfEmpTax + ltcgTaxAmt;
    const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
    const marginalRate  = getUsMarginalRate(totalTaxableIncome, filingStatus, stateCode);

    // Medicare IRMAA
    const medicarePremium = getMedicarePremium(
      totalAgi,
      filingStatus === "mfj" ? "mfj" : "single",
    );

    // ── After-tax ──────────────────────────────────────────────────────────
    const netIncome        = grossIncome + rothWithdrawal - totalTax;
    const desiredSpend     = phase === "retirement"
      ? profile.desiredRetirementIncome * Math.pow(1 + profile.retirementIncomeGrowth, Math.max(0, age - profile.retirementAge))
      : 0;
    const disposableIncome = netIncome - desiredSpend;

    // Roth conversion window: years before SS + RMD both in play
    const ssStarted     = age >= profile.ssClaimAge;
    const rmdStarted    = age >= rmdStartAge;
    const inConvWindow  = phase === "retirement" && !ssStarted && !rmdStarted;

    const totalWealth = pretaxBal + rothBal + taxableBal + hsaBal + tradIraBal;

    rows.push({
      year,
      age,
      phase,
      wagesIncome:          wages,
      selfEmploymentIncome: selfEmp,
      pensionIncome,
      rmdWithdrawal,
      rothWithdrawal,
      taxableWithdrawal,
      ssBenefit,
      ssTaxableAmount:      ssTaxableAmt,
      qualifiedDividends:   qualDividends,
      ordinaryDividends:    ordDividends,
      ltcgRealized,
      otherIncome:          profile.otherOrdinaryIncome ?? 0,
      standardDeduction:    standardDed,
      itemizedDeductions:   itemizedDed,
      deductionUsed,
      totalAgi,
      totalTaxableIncome,
      netInvestmentIncome:  nii,
      federalTax:           taxResult.federalTax,
      stateTax:             taxResult.stateTax,
      niit:                 taxResult.niit,
      additionalMedicareTax: taxResult.additionalMedicareTax,
      selfEmploymentTax:    selfEmpTax,
      ltcgTax:              ltcgTaxAmt,
      totalTax,
      effectiveRate,
      marginalRate,
      netIncome,
      disposableIncome,
      pretaxBalance:        Math.max(0, pretaxBal + tradIraBal),
      rothBalance:          Math.max(0, rothBal),
      taxableBalance:       Math.max(0, taxableBal),
      hsaBalance:           Math.max(0, hsaBal),
      totalWealth:          Math.max(0, totalWealth),
      medicarePremiumMonthly: medicarePremium,
      rmdRequired:          age >= rmdStartAge,
      rmdStartAge,
      inRothConversionWindow: inConvWindow,
    });
  }

  return rows;
}
