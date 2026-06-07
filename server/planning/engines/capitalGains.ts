// server/planning/engines/capitalGains.ts
import type { CapitalGainsInputs, CapitalGainsAnalysis, CapitalGainsDisposalResult } from "../types.js";
import { calculateFederalTax, calculateProvincialTax, CAPITAL_GAINS_THRESHOLD_2024, CAPITAL_GAINS_INCLUSION_RATE_UNDER_250K, CAPITAL_GAINS_INCLUSION_RATE_OVER_250K, LIFETIME_CAPITAL_GAINS_EXEMPTION_QSBC } from "../data/taxData2024.js";

export function analyzeCapitalGains(inputs: CapitalGainsInputs): CapitalGainsAnalysis {
  const { province, otherIncome, disposals, currentYearLosses, carryForwardLosses } = inputs;
  const disposalResults: CapitalGainsDisposalResult[] = disposals.map(d => {
    const gain = d.proceeds - d.acb - d.outlays;
    const holdingDays = Math.round((new Date(d.disposalDate).getTime() - new Date(d.acquisitionDate).getTime()) / (1000*60*60*24));
    let taxableGain = 0;
    if (gain > 0) { const u = Math.min(gain, CAPITAL_GAINS_THRESHOLD_2024), o = Math.max(0, gain - CAPITAL_GAINS_THRESHOLD_2024); taxableGain = u * CAPITAL_GAINS_INCLUSION_RATE_UNDER_250K + o * CAPITAL_GAINS_INCLUSION_RATE_OVER_250K; }
    const baseTax = calculateFederalTax(otherIncome) + calculateProvincialTax(otherIncome, province);
    const withTax = calculateFederalTax(otherIncome + taxableGain) + calculateProvincialTax(otherIncome + taxableGain, province);
    return { ...d, gain, taxableGain:Math.round(taxableGain), estimatedTax:Math.round(Math.max(0, withTax - baseTax)), holdingPeriodDays:holdingDays };
  });
  const totalProceeds = disposalResults.reduce((s,d)=>s+d.proceeds,0);
  const totalACB = disposalResults.reduce((s,d)=>s+d.acb+d.outlays,0);
  const totalGain = disposalResults.filter(d=>d.gain>0).reduce((s,d)=>s+d.gain,0);
  const totalLoss = disposalResults.filter(d=>d.gain<0).reduce((s,d)=>s+Math.abs(d.gain),0);
  const netGain = totalGain - totalLoss - currentYearLosses;
  const lossesApplied = Math.min(carryForwardLosses, Math.max(0, netGain));
  const netTaxable = Math.max(0, netGain - lossesApplied);
  const under250 = Math.min(netTaxable, CAPITAL_GAINS_THRESHOLD_2024), over250 = Math.max(0, netTaxable - CAPITAL_GAINS_THRESHOLD_2024);
  const taxableGain = under250 * CAPITAL_GAINS_INCLUSION_RATE_UNDER_250K + over250 * CAPITAL_GAINS_INCLUSION_RATE_OVER_250K;
  const baseTax = calculateFederalTax(otherIncome) + calculateProvincialTax(otherIncome, province);
  const withTax = calculateFederalTax(otherIncome + taxableGain) + calculateProvincialTax(otherIncome + taxableGain, province);
  const totalTaxOnGains = Math.max(0, withTax - baseTax);
  const qsbcGain = disposalResults.filter(d=>d.isQSBC).reduce((s,d)=>s+Math.max(0,d.gain),0);
  const lcgeUsed = Math.min(qsbcGain, LIFETIME_CAPITAL_GAINS_EXEMPTION_QSBC);
  const timingRecs: string[] = [], harvestRecs: string[] = [];
  if (netTaxable > CAPITAL_GAINS_THRESHOLD_2024) timingRecs.push(`You have gains exceeding $${CAPITAL_GAINS_THRESHOLD_2024.toLocaleString()}. Consider spreading disposals across tax years to keep annual gains under the $250,000 threshold and benefit from the lower 50% inclusion rate.`);
  if (carryForwardLosses > 0) timingRecs.push(`You have $${carryForwardLosses.toLocaleString()} in capital loss carry-forwards. Apply these against current year gains to reduce taxable income.`);
  if (totalLoss > 0 && totalGain > 0) harvestRecs.push(`Tax-loss harvesting: crystallize unrealized losses to offset gains realized this year. Losses can be applied to gains in the current year, or carried back 3 years / forward indefinitely.`);
  return { totalProceeds:Math.round(totalProceeds), totalACB:Math.round(totalACB), totalGain:Math.round(totalGain), totalLoss:Math.round(totalLoss), netGain:Math.round(netGain), gainUnder250k:Math.round(under250), gainOver250k:Math.round(over250), inclusionRateUnder250k:CAPITAL_GAINS_INCLUSION_RATE_UNDER_250K, inclusionRateOver250k:CAPITAL_GAINS_INCLUSION_RATE_OVER_250K, taxableGain:Math.round(taxableGain), lossesApplied:Math.round(lossesApplied), netTaxableGain:Math.round(netTaxable-lossesApplied), federalTaxOnGains:Math.round(totalTaxOnGains*0.55), provincialTaxOnGains:Math.round(totalTaxOnGains*0.45), totalTaxOnGains:Math.round(totalTaxOnGains), effectiveRateOnGains:netTaxable>0?Math.round(totalTaxOnGains/netTaxable*10000)/10000:0, lifetimeCapitalGainsExemption:LIFETIME_CAPITAL_GAINS_EXEMPTION_QSBC, lcgeUsed:Math.round(lcgeUsed), lcgeRemaining:Math.round(LIFETIME_CAPITAL_GAINS_EXEMPTION_QSBC-lcgeUsed), disposalBreakdown:disposalResults, timingRecommendations:timingRecs, harvestingOpportunities:harvestRecs };
}