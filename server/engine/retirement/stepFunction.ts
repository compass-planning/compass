import type { YearlyState } from "../monteCarlo";
import type { CorrelatedReturns } from "../cholesky";
import type { RetirementProfile, YearlyRetirementDetail } from "./types";
import { optimizeWithdrawals, reshelterToTfsa } from "./rrifOptimizer";
import { calculateRetirementTax } from "./taxCalculator";
import { optimizePensionSplit } from "./taxCalculator";
import { projectCpp, projectOas } from "../reference/cppOas";

export function createRetirementStepFn(profile: RetirementProfile, collectDetails: boolean = true): {
  stepFn: (state: YearlyState, returns: CorrelatedReturns, simIndex: number) => YearlyState;
  getDetails: () => YearlyRetirementDetail[];
  resetDetails: () => void;
} {
  let yearlyDetails: YearlyRetirementDetail[] = [];

  const stepFn = (
    state: YearlyState,
    returns: CorrelatedReturns,
    _simIndex: number
  ): YearlyState => {
    const age = profile.currentAge + state.year;
    const isRetired = age >= profile.retirementAge;

    const equityReturn = returns.equity;
    const bondReturn = returns.bond;
    const portfolioReturn =
      profile.equityAllocation * equityReturn +
      profile.bondAllocation * bondReturn;

    let rrspBalance = state.customData?.rrspBalance ?? profile.rrspBalance;
    let tfsaBalance = state.customData?.tfsaBalance ?? profile.tfsaBalance;
    let nonRegBalance = state.customData?.nonRegBalance ?? profile.nonRegBalance;

    let rrifWithdrawal = 0;
    let tfsaWithdrawal = 0;
    let nonRegWithdrawal = 0;
    let cppBenefit = 0;
    let oasBenefit = 0;
    let oasClawback = 0;
    let pensionIncome = 0;
    let contributions = 0;
    let taxableIncome = 0;
    let federalTax = 0;
    let provincialTax = 0;
    let totalTax = 0;
    let netIncome = 0;
    let grossIncome = 0;

    if (!isRetired) {
      const rrspContrib = profile.annualRrspContribution;
      const tfsaContrib = profile.annualTfsaContribution;
      const nonRegContrib = profile.annualNonRegContribution;
      contributions = rrspContrib + tfsaContrib + nonRegContrib;

      rrspBalance = (rrspBalance + rrspContrib) * (1 + portfolioReturn);
      tfsaBalance = (tfsaBalance + tfsaContrib) * (1 + portfolioReturn);
      nonRegBalance = (nonRegBalance + nonRegContrib) * (1 + portfolioReturn);

      taxableIncome = profile.employmentIncome;
      const taxResult = calculateRetirementTax(taxableIncome, profile.province);
      federalTax = taxResult.federalTax;
      provincialTax = taxResult.provincialTax;
      totalTax = taxResult.totalTax;
      grossIncome = profile.employmentIncome;
      netIncome = grossIncome - totalTax;
    } else {
      if (age >= profile.cppStartAge) {
        const cpp = projectCpp(profile.cppStartAge);
        cppBenefit = cpp.annualBenefit;
      }

      if (age >= profile.oasStartAge) {
        const estimatedIncome = profile.desiredRetirementIncome;
        const oas = projectOas(profile.oasStartAge, estimatedIncome, profile.yearsInCanada);
        oasBenefit = oas.annualBenefit;
      }

      pensionIncome = profile.pensionIncome;
      const desiredReal = profile.desiredRetirementIncome * state.inflationCumulative;

      const plan = optimizeWithdrawals(
        age,
        { rrspRrifBalance: rrspBalance, tfsaBalance, nonRegBalance },
        desiredReal,
        cppBenefit,
        oasBenefit,
        pensionIncome,
        profile.province,
        profile.rrifConversionAge
      );

      rrifWithdrawal = plan.rrifWithdrawal;
      tfsaWithdrawal = plan.tfsaWithdrawal;
      nonRegWithdrawal = plan.nonRegWithdrawal;
      oasClawback = plan.oasClawback;

      rrspBalance = Math.max(0, (rrspBalance - rrifWithdrawal) * (1 + portfolioReturn));
      tfsaBalance = Math.max(0, (tfsaBalance - tfsaWithdrawal) * (1 + portfolioReturn));
      nonRegBalance = Math.max(0, (nonRegBalance - nonRegWithdrawal) * (1 + portfolioReturn));

      taxableIncome = plan.taxableIncome;

      {
        const baseTaxResult = calculateRetirementTax(Math.max(0, taxableIncome), profile.province);
        federalTax = baseTaxResult.federalTax;
        provincialTax = baseTaxResult.provincialTax;
        totalTax = baseTaxResult.totalTax;

        if (profile.spouseIncome > 0 && pensionIncome > 0) {
          const splitResult = optimizePensionSplit(
            taxableIncome,
            pensionIncome + rrifWithdrawal,
            profile.spouseIncome,
            profile.province
          );
          if (splitResult.taxSavings > 0) {
            totalTax = Math.max(0, totalTax - splitResult.taxSavings);
            const taxReductionRatio = totalTax > 0 ? (baseTaxResult.totalTax - splitResult.taxSavings) / baseTaxResult.totalTax : 0;
            federalTax = baseTaxResult.federalTax * Math.max(0, taxReductionRatio);
            provincialTax = baseTaxResult.provincialTax * Math.max(0, taxReductionRatio);
          }
        }
      }

      grossIncome = cppBenefit + oasBenefit - oasClawback + pensionIncome + plan.totalWithdrawal;
      netIncome = grossIncome - totalTax;

      const excessCash = Math.max(0, netIncome - desiredReal);
      if (excessCash > 0) {
        const shelter = reshelterToTfsa(excessCash);
        tfsaBalance += shelter.tfsaContribution;
      }
    }

    const totalBalance = Math.max(0, rrspBalance) + Math.max(0, tfsaBalance) + Math.max(0, nonRegBalance);
    const success = totalBalance > 0 || !isRetired;

    if (collectDetails) {
      const detail: YearlyRetirementDetail = {
        age,
        phase: isRetired ? "distribution" : "accumulation",
        rrspBalance: Math.max(0, rrspBalance),
        tfsaBalance: Math.max(0, tfsaBalance),
        nonRegBalance: Math.max(0, nonRegBalance),
        totalBalance,
        rrifWithdrawal,
        tfsaWithdrawal,
        nonRegWithdrawal,
        cppBenefit,
        oasBenefit,
        oasClawback,
        pensionIncome,
        grossIncome,
        taxableIncome,
        federalTax,
        provincialTax,
        totalTax,
        netIncome,
        contributions,
        portfolioReturn,
      };
      yearlyDetails.push(detail);
    }

    return {
      ...state,
      balance: totalBalance,
      contributions,
      withdrawals: rrifWithdrawal + tfsaWithdrawal + nonRegWithdrawal,
      success,
      customData: {
        rrspBalance: Math.max(0, rrspBalance),
        tfsaBalance: Math.max(0, tfsaBalance),
        nonRegBalance: Math.max(0, nonRegBalance),
        age,
        netIncome,
        totalTax,
        oasClawback,
      },
    };
  };

  return {
    stepFn,
    getDetails: () => yearlyDetails,
    resetDetails: () => { yearlyDetails = []; },
  };
}
