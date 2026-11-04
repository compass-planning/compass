// server/planning/engines/rrsp.ts
import type { RrspInputs, RrspAnalysis, RrspYearRow } from "../types";
import { getMarginalRate, RRSP_LIMIT_2024, RRSP_CONTRIBUTION_RATE } from "../data/taxData2024";

export function analyzeRrsp(inputs: RrspInputs): RrspAnalysis {
  const { currentAge, earnedIncome, currentBalance, unusedContributionRoom, pensionAdjustment, annualContribution, province, expectedRetirementAge, expectedReturnRate } = inputs;
  const newRoomThisYear = Math.max(0, Math.min(Math.round(earnedIncome * RRSP_CONTRIBUTION_RATE), RRSP_LIMIT_2024) - pensionAdjustment);
  const totalAvailableRoom = unusedContributionRoom + newRoomThisYear;
  const marginalRate = getMarginalRate(earnedIncome, province);
  const recommendedContribution = Math.min(annualContribution || totalAvailableRoom, totalAvailableRoom);
  const yearsToRetirement = expectedRetirementAge - currentAge;
  let balance = currentBalance;
  const yearByYear: RrspYearRow[] = [];
  let cumulativeContributions = 0, remainingRoom = totalAvailableRoom;
  for (let i = 0; i < yearsToRetirement; i++) {
    const age = currentAge + i, year = new Date().getFullYear() + i;
    const contribution = Math.min(annualContribution, remainingRoom + newRoomThisYear);
    const opening = balance, growth = (balance + contribution) * expectedReturnRate;
    balance = balance + contribution + growth;
    cumulativeContributions += contribution;
    remainingRoom = Math.max(0, remainingRoom + newRoomThisYear - contribution);
    yearByYear.push({ age, year, openingBalance:Math.round(opening), contribution:Math.round(contribution), growth:Math.round(growth), closingBalance:Math.round(balance), cumulativeContributions:Math.round(cumulativeContributions), taxRefund:Math.round(contribution*marginalRate) });
  }
  const yearsToMaximize = totalAvailableRoom > annualContribution ? Math.ceil(totalAvailableRoom / Math.max(annualContribution, 1)) : 1;
  const catchUpStrategy = unusedContributionRoom > annualContribution * 2 ? `You have significant unused room of $${unusedContributionRoom.toLocaleString()}. Consider a catch-up strategy using a short-term loan in a high-income year, then repay with the tax refund.` : unusedContributionRoom > annualContribution ? `Your unused room of $${unusedContributionRoom.toLocaleString()} can be eliminated in approximately ${yearsToMaximize} years at your current contribution pace.` : `You are maximizing your RRSP contributions efficiently. Maintain annual contributions of $${annualContribution.toLocaleString()}.`;
  return { currentRoom:unusedContributionRoom, newRoomThisYear, totalAvailableRoom, recommendedContribution, taxRefundAtMarginalRate:Math.round(recommendedContribution*marginalRate), effectiveCostAfterRefund:recommendedContribution-Math.round(recommendedContribution*marginalRate), projectedBalanceAtRetirement:Math.round(balance), projectedAnnualWithdrawal:Math.round(balance*0.04), yearsOfGrowth:yearsToRetirement, maximizeByAge:Math.min(currentAge+yearsToMaximize,71), catchUpStrategy, yearByYear, homeByersAmount:35000, lifelongLearningAmount:20000 };
}