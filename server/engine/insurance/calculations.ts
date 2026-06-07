import type { InsuranceProfile, LifeInsuranceResult, DiGapResult, CiGapResult, InsuranceAnalysisOutput } from "./types";

export function calculateDime(profile: InsuranceProfile): LifeInsuranceResult {
  const debt = profile.totalDebts;
  const income = profile.annualIncome * profile.workingYearsRemaining;
  const mortgage = profile.mortgageBalance;
  const education = profile.educationFundTarget;
  const finalExp = profile.finalExpenses;
  const totalNeed = debt + income + mortgage + education + finalExp;
  const gap = Math.max(0, totalNeed - profile.existingLifeCoverage - profile.existingAssets);

  return {
    method: "dime",
    totalNeed,
    existingCoverage: profile.existingLifeCoverage + profile.existingAssets,
    gap,
    breakdown: { debt, incomeReplacement: income, mortgage, education, finalExpenses: finalExp },
  };
}

export function calculateHumanLifeValue(profile: InsuranceProfile): LifeInsuranceResult {
  const annualEconomicValue = profile.annualIncome * (1 - profile.personalConsumptionRate);
  const rate = profile.discountRate;
  const years = profile.workingYearsRemaining;

  let pv = 0;
  for (let y = 1; y <= years; y++) {
    pv += annualEconomicValue / Math.pow(1 + rate, y);
  }

  const totalNeed = Math.round(pv);
  const gap = Math.max(0, totalNeed - profile.existingLifeCoverage - profile.existingAssets);

  return {
    method: "humanLifeValue",
    totalNeed,
    existingCoverage: profile.existingLifeCoverage + profile.existingAssets,
    gap,
    breakdown: {
      annualEconomicValue,
      discountRate: rate,
      workingYears: years,
      presentValue: pv,
    },
  };
}

export function calculateCapitalRetention(profile: InsuranceProfile): LifeInsuranceResult {
  const annualShortfall = profile.annualIncome * (1 - profile.personalConsumptionRate);
  const totalNeed = Math.round(annualShortfall / profile.withdrawalRate);
  const gap = Math.max(0, totalNeed - profile.existingLifeCoverage - profile.existingAssets);

  return {
    method: "capitalRetention",
    totalNeed,
    existingCoverage: profile.existingLifeCoverage + profile.existingAssets,
    gap,
    breakdown: {
      annualShortfall,
      withdrawalRate: profile.withdrawalRate,
      capitalRequired: totalNeed,
    },
  };
}

export function calculateDiGap(profile: InsuranceProfile): DiGapResult {
  const monthlyGrossIncome = profile.annualIncome / 12;
  const targetReplacement = monthlyGrossIncome * profile.diReplacementRate;
  const monthlyGap = Math.max(0, targetReplacement - profile.existingDisabilityCoverage - profile.cppDisabilityBenefit);

  return {
    monthlyGrossIncome,
    targetReplacement,
    existingDiBenefit: profile.existingDisabilityCoverage,
    cppDisabilityOffset: profile.cppDisabilityBenefit,
    monthlyGap,
    annualGap: monthlyGap * 12,
  };
}

export function calculateCiGap(profile: InsuranceProfile): CiGapResult {
  const incomeReplacement = profile.annualIncome * 1.5;
  const totalNeed = profile.mortgageBalance + incomeReplacement + profile.uncoveredTreatmentCosts;
  const gap = Math.max(0, totalNeed - profile.existingCriticalIllnessCoverage);

  return {
    mortgageBalance: profile.mortgageBalance,
    incomeReplacement,
    uncoveredTreatment: profile.uncoveredTreatmentCosts,
    totalNeed,
    existingCoverage: profile.existingCriticalIllnessCoverage,
    gap,
  };
}

export function runFullInsuranceAnalysis(
  profile: InsuranceProfile,
  preferredMethod: "dime" | "humanLifeValue" | "capitalRetention" = "dime"
): InsuranceAnalysisOutput {
  const dime = calculateDime(profile);
  const hlv = calculateHumanLifeValue(profile);
  const cr = calculateCapitalRetention(profile);
  const diGap = calculateDiGap(profile);
  const ciGap = calculateCiGap(profile);

  const selected = preferredMethod === "humanLifeValue" ? hlv : preferredMethod === "capitalRetention" ? cr : dime;

  return {
    dime,
    humanLifeValue: hlv,
    capitalRetention: cr,
    diGap,
    ciGap,
    selectedMethod: preferredMethod,
    recommendedLifeCoverage: selected.totalNeed,
    lifeCoverageGap: selected.gap,
  };
}
