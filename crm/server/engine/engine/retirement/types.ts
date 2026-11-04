export interface RetirementProfile {
  currentAge: number;
  retirementAge: number;
  planToAge: number;
  province: string;

  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;

  annualRrspContribution: number;
  annualTfsaContribution: number;
  annualNonRegContribution: number;

  employmentIncome: number;
  pensionIncome: number;
  spouseIncome: number;
  desiredRetirementIncome: number;

  cppStartAge: number;
  oasStartAge: number;
  rrifConversionAge: number;
  yearsInCanada: number;

  equityAllocation: number;
  bondAllocation: number;
  desiredIncomeSourceMix?: {
    cpp?: number;
    oas?: number;
    pension?: number;
    rrif?: number;
    tfsa?: number;
    nonReg?: number;
  };
}

export interface YearlyRetirementDetail {
  age: number;
  phase: "accumulation" | "distribution";
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalBalance: number;

  rrifWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;

  cppBenefit: number;
  oasBenefit: number;
  oasClawback: number;
  pensionIncome: number;

  grossIncome: number;
  taxableIncome: number;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  netIncome: number;

  contributions: number;
  portfolioReturn: number;
}

export interface RetirementSimulationInput {
  profile: RetirementProfile;
  cppMaxMonthly?: number;
  oasMaxMonthly?: number;
}

export interface CppTimingResult {
  at60: { annualBenefit: number; adjustmentFactor: number };
  at65: { annualBenefit: number; adjustmentFactor: number };
  at70: { annualBenefit: number; adjustmentFactor: number };
  breakEven60vs65: number;
  breakEven65vs70: number;
}

export interface RrspVsTfsaAdvice {
  recommendation: "rrsp" | "tfsa" | "balanced";
  currentMarginalRate: number;
  projectedRetirementRate: number;
  rationale: string;
}
