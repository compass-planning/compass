// server/planning/engines/tax.ts
import type { TaxInputs, TaxProjection, TaxBracketRow, TaxRecommendation } from "../types.js";
import { FEDERAL_BRACKETS_2025 as FEDERAL_BRACKETS_2024, PROVINCIAL_BRACKETS_2025 as PROVINCIAL_BRACKETS_2024, calculateFederalTax, calculateProvincialTax, calculateCPP, calculateEI, getBracketRate, getMarginalRate, ELIGIBLE_DIVIDEND_GROSSUP, ELIGIBLE_DIVIDEND_FED_CREDIT, NONELIGIBLE_DIVIDEND_GROSSUP, NONELIGIBLE_DIVIDEND_FED_CREDIT } from "../data/taxData2025.js";

export function projectTax(inputs: TaxInputs, locale = "en"): TaxProjection {
  const { taxYear, province, employmentIncome, selfEmploymentIncome, capitalGainsIncome, eligibleDividends, nonEligibleDividends, rrspDeduction, otherDeductions, pensionIncome, rentalIncome, otherIncome, rrspContributionRoom } = inputs;
  const grossedUpEligible    = eligibleDividends    * (1 + ELIGIBLE_DIVIDEND_GROSSUP);
  const grossedUpNonEligible = nonEligibleDividends * (1 + NONELIGIBLE_DIVIDEND_GROSSUP);
  const capGainsUnder250k = Math.min(capitalGainsIncome, 250000), capGainsOver250k = Math.max(0, capitalGainsIncome - 250000);
  const taxableCapGains = capGainsUnder250k * 0.50 + capGainsOver250k * 0.6667;
  const grossIncome = employmentIncome + selfEmploymentIncome + pensionIncome + rentalIncome + otherIncome + grossedUpEligible + grossedUpNonEligible + taxableCapGains;
  const totalDeductions = rrspDeduction + otherDeductions;
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);
  let federalTax = calculateFederalTax(taxableIncome);
  federalTax -= eligibleDividends * ELIGIBLE_DIVIDEND_FED_CREDIT + nonEligibleDividends * NONELIGIBLE_DIVIDEND_FED_CREDIT;
  federalTax = Math.max(0, federalTax);
  const provincialTax = Math.max(0, calculateProvincialTax(taxableIncome, province));
  const totalTax = federalTax + provincialTax;
  const cpp = calculateCPP(employmentIncome + selfEmploymentIncome), ei = calculateEI(employmentIncome);
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;
  const marginalRate = getMarginalRate(taxableIncome, province);
  const bracketBreakdown: TaxBracketRow[] = [];
  let cumulative = 0;
  for (const b of FEDERAL_BRACKETS_2024) {
    if (taxableIncome <= b.min) break;
    const inBracket = (Math.min(taxableIncome, b.max) - b.min) * b.rate;
    cumulative += inBracket;
    bracketBreakdown.push({ bracket: b.max === Infinity ? `Over $${b.min.toLocaleString()}` : `$${b.min.toLocaleString()} – $${b.max.toLocaleString()}`, rate: b.rate, incomeInBracket: Math.min(taxableIncome, b.max) - b.min, taxInBracket: Math.round(inBracket), cumulative: Math.round(cumulative) });
  }
  const fiveYearProjection = Array.from({length:5},(_,i)=>{const pi=grossIncome*Math.pow(1.02,i),pt=Math.max(0,pi-totalDeductions),pf=Math.max(0,calculateFederalTax(pt)),pp=Math.max(0,calculateProvincialTax(pt,province));return{year:taxYear+i,projectedIncome:Math.round(pi),projectedTax:Math.round(pf+pp),effectiveRate:pi>0?(pf+pp)/pi:0,marginalRate:getMarginalRate(pt,province)};});
  const recommendations: TaxRecommendation[] = [];
  if (rrspContributionRoom > 0 && rrspDeduction < rrspContributionRoom) { const additional = rrspContributionRoom - rrspDeduction; recommendations.push({ priority:"high", category: locale==="fr" ? "Optimisation REER" : "RRSP Optimization",
          recommendation: locale==="fr"
            ? `Vous disposez de ${additional.toLocaleString("fr-CA")} $ en droits REER inutilisés. Cotiser le montant total permettrait d'économiser environ ${Math.round(additional*marginalRate).toLocaleString("fr-CA")} $ en impôt à votre taux marginal de ${(marginalRate*100).toFixed(1)}%.`
            : `You have $${additional.toLocaleString()} in unused RRSP room. Contributing the full amount would save approximately $${Math.round(additional*marginalRate).toLocaleString()} in taxes at your marginal rate of ${(marginalRate*100).toFixed(1)}%.`,
          estimatedSaving: Math.round(additional*marginalRate) }); }
  if (inputs.spouseEmploymentIncome !== undefined && inputs.spouseEmploymentIncome < employmentIncome * 0.5) { recommendations.push({ priority:"high", category: locale==="fr" ? "Fractionnement du revenu" : "Income Splitting",
          recommendation: locale==="fr"
            ? "Une disparité de revenus importante offre des occasions de fractionnement : REER de conjoint et fractionnement du revenu de pension."
            : "Significant income disparity presents an opportunity for income-splitting strategies including spousal RRSP contributions and pension income splitting.",
          estimatedSaving: Math.round((employmentIncome - (inputs.spouseEmploymentIncome??0)) * 0.03 * marginalRate) }); }
  return { grossIncome:Math.round(grossIncome), totalDeductions:Math.round(totalDeductions), taxableIncome:Math.round(taxableIncome), federalTax:Math.round(federalTax), provincialTax:Math.round(provincialTax), totalTax:Math.round(totalTax), effectiveRate:Math.round(effectiveRate*10000)/10000, marginalRate:Math.round(marginalRate*10000)/10000, marginalFederalRate:getBracketRate(taxableIncome,FEDERAL_BRACKETS_2024), marginalProvincialRate:getBracketRate(taxableIncome,PROVINCIAL_BRACKETS_2024[province]), cpp:Math.round(cpp), ei:Math.round(ei), totalRemittances:Math.round(totalTax+cpp+ei), netIncome:Math.round(grossIncome-totalDeductions), afterTaxIncome:Math.round(grossIncome-totalTax-cpp-ei), bracketBreakdown, recommendations, fiveYearProjection };
}