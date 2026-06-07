export interface InsuranceProfile {
  annualIncome: number;
  personalConsumptionRate: number;
  workingYearsRemaining: number;
  mortgageBalance: number;
  totalDebts: number;
  educationFundTarget: number;
  finalExpenses: number;
  existingLifeCoverage: number;
  existingAssets: number;
  monthlyExpenses: number;
  existingDisabilityCoverage: number;
  cppDisabilityBenefit: number;
  diReplacementRate: number;
  criticalIllnessLumpSum: number;
  existingCriticalIllnessCoverage: number;
  uncoveredTreatmentCosts: number;
  discountRate: number;
  withdrawalRate: number;
  incomeVolatility: number;
  isVariableIncome: boolean;
}

export interface LifeInsuranceResult {
  method: "dime" | "humanLifeValue" | "capitalRetention";
  totalNeed: number;
  existingCoverage: number;
  gap: number;
  breakdown: Record<string, number>;
}

export interface DiGapResult {
  monthlyGrossIncome: number;
  targetReplacement: number;
  existingDiBenefit: number;
  cppDisabilityOffset: number;
  monthlyGap: number;
  annualGap: number;
}

export interface CiGapResult {
  mortgageBalance: number;
  incomeReplacement: number;
  uncoveredTreatment: number;
  totalNeed: number;
  existingCoverage: number;
  gap: number;
}

export interface InsuranceAnalysisOutput {
  dime: LifeInsuranceResult;
  humanLifeValue: LifeInsuranceResult;
  capitalRetention: LifeInsuranceResult;
  diGap: DiGapResult;
  ciGap: CiGapResult;
  selectedMethod: "dime" | "humanLifeValue" | "capitalRetention";
  recommendedLifeCoverage: number;
  lifeCoverageGap: number;
}
