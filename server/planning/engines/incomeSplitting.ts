// server/planning/engines/incomeSplitting.ts
import type { IncomeSplittingInputs, IncomeSplittingAnalysis, IncomeSplittingStrategy } from "../types.js";
import { calculateFederalTax, calculateProvincialTax, getMarginalRate } from "../data/taxData2024.js";

function calcTax(income: number, province: IncomeSplittingInputs["province"]): number {
  return Math.max(0, calculateFederalTax(income) + calculateProvincialTax(income, province));
}
export function analyzeIncomeSplitting(inputs: IncomeSplittingInputs, locale = "en"): IncomeSplittingAnalysis {
  const { province, primaryAge, primaryEmploymentIncome, primaryPensionIncome, primaryRrspBalance, primaryRrifBalance, primaryOtherIncome, spouseAge, spouseEmploymentIncome, spousePensionIncome, spouseRrspBalance, spouseOtherIncome, yearsToRetirement } = inputs;
  const primaryTotal = primaryEmploymentIncome + primaryPensionIncome + primaryOtherIncome;
  const spouseTotal  = spouseEmploymentIncome  + spousePensionIncome  + spouseOtherIncome;
  const primaryCurrentTax = calcTax(primaryTotal, province), spouseCurrentTax = calcTax(spouseTotal, province);
  const currentCombinedTax = primaryCurrentTax + spouseCurrentTax;
  const eligiblePension = primaryPensionIncome;
  let bestSplit = 0, bestTax = currentCombinedTax;
  for (let f = 0.1; f <= 0.5; f += 0.05) {
    const amt = eligiblePension * f, combined = calcTax(primaryTotal - amt, province) + calcTax(spouseTotal + amt, province);
    if (combined < bestTax) { bestTax = combined; bestSplit = amt; }
  }
  const primaryAfterSplitTax = calcTax(primaryTotal - bestSplit, province), spouseAfterSplitTax = calcTax(spouseTotal + bestSplit, province);
  const combinedAfterSplitTax = primaryAfterSplitTax + spouseAfterSplitTax, pensionSplitTaxSaving = Math.max(0, currentCombinedTax - combinedAfterSplitTax);
  const primaryMarginal = getMarginalRate(primaryTotal, province), spouseMarginal = getMarginalRate(spouseTotal, province);
  const spousalRrspRecommended = primaryMarginal > spouseMarginal + 0.05;
  const annualSpousalRrsp = spousalRrspRecommended ? Math.min(primaryRrspBalance * 0.1, 10000) : 0;
  const rateDiff = Math.max(0, primaryMarginal - spouseMarginal);
  const spousalRrspAnnualBenefit = annualSpousalRrsp * rateDiff;
  const strategies: IncomeSplittingStrategy[] = [
    { name:"Pension Income Splitting (T1032)", annualSaving:Math.round(pensionSplitTaxSaving), eligible:eligiblePension>0&&primaryAge>=65, description:"Allocate up to 50% of eligible pension income to the lower-income spouse on your tax return.", actionRequired:"File Form T1032 with your annual tax return. No cash actually changes hands." },
    { name:"Spousal RRSP Contributions", annualSaving:Math.round(spousalRrspAnnualBenefit), eligible:spousalRrspRecommended, description:"Higher-income spouse contributes to a Spousal RRSP. Deduction at higher rate; future withdrawals taxed at lower rate.", actionRequired:`Open a Spousal RRSP account. Contribute up to $${Math.round(annualSpousalRrsp).toLocaleString()}/year. Observe 3-year attribution rule before withdrawing.` },
    { name:"CPP Pension Sharing", annualSaving:primaryAge>=60&&spouseAge>=60?Math.round((primaryTotal-spouseTotal)*0.01):0, eligible:primaryAge>=60&&spouseAge>=60, description:"Share CPP retirement pension between spouses to equalize income.", actionRequired:"Apply through Service Canada (ISP-1002 form)." },
    { name:"Prescribed Rate Loan", annualSaving:Math.round(primaryTotal*0.005), eligible:primaryMarginal>spouseMarginal+0.03, description:"Loan investment capital to the lower-income spouse at the CRA prescribed rate.", actionRequired:"Document the loan in writing. Charge at least the CRA prescribed rate. Interest must be paid by January 30 each year." },
  ];
  const totalAnnualSaving = Math.round(pensionSplitTaxSaving + spousalRrspAnnualBenefit);
  return { currentCombinedTax:Math.round(currentCombinedTax), primaryCurrentTax:Math.round(primaryCurrentTax), spouseCurrentTax:Math.round(spouseCurrentTax), pensionSplitOptimalAmount:Math.round(bestSplit), pensionSplitTaxSaving:Math.round(pensionSplitTaxSaving), primaryAfterSplitTax:Math.round(primaryAfterSplitTax), spouseAfterSplitTax:Math.round(spouseAfterSplitTax), combinedAfterSplitTax:Math.round(combinedAfterSplitTax), spousalRrspRecommended, spousalRrspAnnualAmount:Math.round(annualSpousalRrsp), spousalRrspTotalSaving:Math.round(spousalRrspAnnualBenefit*Math.max(yearsToRetirement,1)), spousalRrspRationale: spousalRrspRecommended
    ? locale === "fr"
        ? `Les cotisations à un REER de conjoint économisent ${(rateDiff*100).toFixed(1)}% sur les retraits. Le conjoint à revenu élevé cotise à ${(primaryMarginal*100).toFixed(1)}%, l'autre conjoint retire à la retraite à ${(spouseMarginal*100).toFixed(1)}%.`
        : `Contributing to a spousal RRSP saves ${(rateDiff*100).toFixed(1)}% on withdrawals. Higher-income spouse contributes at ${(primaryMarginal*100).toFixed(1)}%, spouse withdraws in retirement at ${(spouseMarginal*100).toFixed(1)}%.`
    : locale === "fr"
        ? "L'écart de revenus n'est pas suffisant pour justifier un REER de conjoint en ce moment."
        : "The income gap is not large enough to justify spousal RRSP at this time.", cppSharingBenefit:primaryAge>=60&&spouseAge>=60?Math.round((primaryTotal-spouseTotal)*0.01):0, prescribedRateLoanBenefit:Math.round(primaryTotal*0.005), totalAnnualSaving, totalLifetimeSaving:Math.round(totalAnnualSaving*Math.max(yearsToRetirement,1)), strategies, comparison:{beforeSplitting:{primary:Math.round(primaryCurrentTax),spouse:Math.round(spouseCurrentTax),combined:Math.round(currentCombinedTax),effectivePrimary:primaryTotal>0?Math.round(primaryCurrentTax/primaryTotal*10000)/100:0,effectiveSpouse:spouseTotal>0?Math.round(spouseCurrentTax/spouseTotal*10000)/100:0},afterSplitting:{primary:Math.round(primaryAfterSplitTax),spouse:Math.round(spouseAfterSplitTax),combined:Math.round(combinedAfterSplitTax),effectivePrimary:(primaryTotal-bestSplit)>0?Math.round(primaryAfterSplitTax/(primaryTotal-bestSplit)*10000)/100:0,effectiveSpouse:(spouseTotal+bestSplit)>0?Math.round(spouseAfterSplitTax/(spouseTotal+bestSplit)*10000)/100:0},saving:Math.round(pensionSplitTaxSaving)} };
}