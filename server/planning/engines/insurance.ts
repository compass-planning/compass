// server/planning/engines/insurance.ts
import type { InsuranceInputs, InsuranceAnalysis, InsuranceRecommendation } from "../types.js";

export function analyzeInsurance(inputs: InsuranceInputs, locale = "en"): InsuranceAnalysis {
  const { clientAge, numberOfDependents, youngestDependentAge, annualIncome, spouseAnnualIncome, incomeReplacementYears, liquidAssets, rrspBalance, tfsaBalance, nonRegInvestments, realEstateEquity, mortgageBalance, otherDebt, finalExpenses, existingLifeInsurance, existingGroupBenefits, monthlyExpenses, existingDisabilityBenefit, existingCriticalIllness } = inputs;
  const totalLiabilities = mortgageBalance + otherDebt;
  const dimeDebt = totalLiabilities + finalExpenses, dimeIncome = annualIncome * incomeReplacementYears, dimeMortgage = mortgageBalance;
  const yearsToEdu = Math.max(0, (youngestDependentAge??0)<18?18-(youngestDependentAge??0):0), dimeEducation = numberOfDependents * yearsToEdu * 15000;
  const dimeTotalNeed = dimeDebt + dimeIncome + dimeEducation;
  const existingTotal = existingLifeInsurance + existingGroupBenefits + nonRegInvestments + liquidAssets;
  const dimeGap = Math.max(0, dimeTotalNeed - existingTotal);
  const workingYears = Math.max(0, 65 - clientAge), annualNet = annualIncome * 0.70;
  const hlvValue = annualNet > 0 ? Math.round(annualNet * ((1 - Math.pow(1.04, -workingYears)) / 0.04)) : 0;
  const hlvGap = Math.max(0, hlvValue - existingTotal);
  const incomeForFamily = Math.max(0, monthlyExpenses * 12 - (spouseAnnualIncome??0));
  const needsBasedCapital = incomeForFamily / 0.04 + totalLiabilities + finalExpenses + dimeEducation;
  const needsBasedGap = Math.max(0, needsBasedCapital - existingTotal);
  const avgRecommended = (dimeGap + hlvGap) / 2;
  const recommendedLife = Math.ceil(avgRecommended / 25000) * 25000;
  const coverageType: InsuranceAnalysis["recommendedCoverageType"] = clientAge < 40 ? "term_20" : clientAge < 50 ? "term_to_65" : clientAge < 60 ? "term_to_65" : "whole_life";
  const ratesPer1000: Record<string,number> = {term_10:1.2,term_20:1.8,term_to_65:2.8,whole_life:8.5,universal_life:6.0};
  const monthlyLifePremium = Math.round((recommendedLife/1000)*(ratesPer1000[coverageType]??2));
  const monthlyDisabilityNeed = Math.round(monthlyExpenses * 0.85), disabilityGap = Math.max(0, monthlyDisabilityNeed - existingDisabilityBenefit);
  const recommendedCI = Math.round(annualIncome * 2), ciGap = Math.max(0, recommendedCI - existingCriticalIllness);
  const recommendations: InsuranceRecommendation[] = [];
  if (recommendedLife > 0) recommendations.push({ type:"life", priority:dimeGap>500000?"immediate":"high", coverageAmount:recommendedLife, monthlyPremiumEstimate:monthlyLifePremium, rationale: locale==="fr"
            ? `Selon l'analyse DIME, vous avez un déficit d'assurance vie de ${dimeGap.toLocaleString("fr-CA")} $. Une police de type ${coverageType.replace(/_/g," ")} de ${recommendedLife.toLocaleString("fr-CA")} $ est recommandée.`
            : `Based on DIME analysis, you have a life insurance gap of $${dimeGap.toLocaleString()}. A ${coverageType.replace(/_/g," ")} policy of $${recommendedLife.toLocaleString()} is recommended.` });
  if (disabilityGap > 0) recommendations.push({ type:"disability", priority:"high", coverageAmount:disabilityGap, monthlyPremiumEstimate:Math.round(disabilityGap*0.03), rationale: locale==="fr"
            ? `Votre déficit de couverture invalidité de ${disabilityGap.toLocaleString("fr-CA")} $/mois représente le revenu perdu en cas d'incapacité de travail. L'invalidité est la principale cause de défaut hypothécaire au Canada.`
            : `Your disability coverage gap of $${disabilityGap.toLocaleString()}/month represents income that would be lost if you were unable to work. Disability is the leading cause of mortgage default in Canada.` });
  if (ciGap > 0) recommendations.push({ type:"critical_illness", priority:"medium", coverageAmount:ciGap, monthlyPremiumEstimate:Math.round(recommendedCI/1000*4.5), rationale: locale==="fr"
            ? `L'assurance maladies graves de ${recommendedCI.toLocaleString("fr-CA")} $ fournit un capital forfaitaire pour couvrir les frais non remboursés par les régimes de santé provinciaux durant la convalescence.`
            : `Critical illness insurance of $${recommendedCI.toLocaleString()} provides a lump sum to cover expenses not covered by provincial health plans during recovery.` });
  return { dimeDebt:Math.round(dimeDebt), dimeIncome:Math.round(dimeIncome), dimeMortgage:Math.round(dimeMortgage), dimeEducation:Math.round(dimeEducation), dimeTotalNeed:Math.round(dimeTotalNeed), dimeExistingCoverage:Math.round(existingTotal), dimeGap:Math.round(dimeGap), hlvValue, hlvGap:Math.round(hlvGap), needsBasedCapitalNeeded:Math.round(needsBasedCapital), needsBasedGap:Math.round(needsBasedGap), recommendedLifeCoverage:recommendedLife, recommendedCoverageType:coverageType, estimatedMonthlyPremium:monthlyLifePremium, monthlyDisabilityNeed, existingDisabilityCoverage:existingDisabilityBenefit, disabilityGap, recommendedDisabilityCoverage:disabilityGap, estimatedDisabilityPremium:Math.round(disabilityGap*0.03), recommendedCICoverage:recommendedCI, ciGap, estimatedCIPremium:Math.round(recommendedCI/1000*4.5), recommendations, priorityOrder:recommendations.sort((a,b)=>({immediate:0,high:1,medium:2,low:3}[a.priority]-{immediate:0,high:1,medium:2,low:3}[b.priority])).map(r=>r.type) };
}