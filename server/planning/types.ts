// server/planning/types.ts
export type Province =
  | "ontario" | "british_columbia" | "alberta" | "quebec"
  | "manitoba" | "saskatchewan" | "nova_scotia" | "new_brunswick"
  | "pei" | "newfoundland" | "yukon" | "northwest_territories" | "nunavut";

export interface PlanningClient {
  id: number; firstName: string; lastName: string; fullName: string;
  dateOfBirth: string; age: number; province: Province;
  maritalStatus: "single" | "married" | "common_law" | "divorced" | "widowed";
  spouseId?: number; spouseFirstName?: string; spouseLastName?: string;
  spouseDateOfBirth?: string; spouseAge?: number;
  employerName?: string; pensionPlan?: string;
  email: string; phone?: string; address?: string;
}
export interface PlanningAdvisor {
  firstName: string; lastName: string; fullName: string;
  email: string; phone?: string; companyName: string; licenseNumber?: string;
}
export interface RetirementInputs {
  currentAge: number; retirementAge: number; planToAge: number; province: Province;
  rrspBalance: number; tfsaBalance: number; nonRegBalance: number; pensionMonthly: number;
  annualRrspContribution: number; annualTfsaContribution: number; annualNonRegContribution: number;
  employmentIncome: number; spouseEmploymentIncome: number;
  desiredRetirementIncome: number;
  cppStartAge: number; oasStartAge: number; yearsInCanada: number;
  spouseAge?: number; spouseRrspBalance?: number; spouseTfsaBalance?: number; spouseCppStartAge?: number;
  equityReturn: number; bondReturn: number; inflationRate: number; equityAllocation: number;
  rrifConversionAge: number;
}
export interface RetirementProjection {
  yearsToRetirement: number; retirementSavingsAtRetirement: number;
  rrspAtRetirement: number; tfsaAtRetirement: number; nonRegAtRetirement: number;
  annualIncomeAtRetirement: number;
  incomeFromRrsp: number; incomeFromTfsa: number; incomeFromNonReg: number;
  incomeFromCpp: number; incomeFromOas: number; incomeFromPension: number;
  cppMonthlyBenefit: number; oasMonthlyBenefit: number;
  cppBreakevenAge: number; oasBreakevenAge: number;
  shortfallOrSurplus: number; fundingRatio: number;
  portfolioDepletionAge: number | null; successProbability: number;
  yearByYear: RetirementYearRow[];
  rrspVsTfsaRecommendation: "rrsp" | "tfsa" | "split"; rrspVsTfsaRationale: string;
}
export interface RetirementYearRow {
  age: number; year: number; rrspBalance: number; tfsaBalance: number;
  nonRegBalance: number; totalBalance: number; withdrawalAmount: number;
  cppIncome: number; oasIncome: number; pensionIncome: number;
  totalIncome: number; taxPayable: number; netIncome: number;
}
export interface TaxInputs {
  taxYear: number; province: Province; employmentIncome: number; selfEmploymentIncome: number;
  capitalGainsIncome: number; eligibleDividends: number; nonEligibleDividends: number;
  rrspDeduction: number; otherDeductions: number; pensionIncome: number;
  rentalIncome: number; otherIncome: number; rrspContributionRoom: number;
  spouseEmploymentIncome?: number; spousePensionIncome?: number;
}
export interface TaxProjection {
  grossIncome: number; totalDeductions: number; taxableIncome: number;
  federalTax: number; provincialTax: number; totalTax: number;
  effectiveRate: number; marginalRate: number; marginalFederalRate: number; marginalProvincialRate: number;
  cpp: number; ei: number; totalRemittances: number; netIncome: number; afterTaxIncome: number;
  bracketBreakdown: TaxBracketRow[];
  recommendations: TaxRecommendation[];
  fiveYearProjection: TaxYearRow[];
}
export interface TaxBracketRow { bracket: string; rate: number; incomeInBracket: number; taxInBracket: number; cumulative: number; }
export interface TaxRecommendation { priority: "high" | "medium" | "low"; category: string; recommendation: string; estimatedSaving: number; }
export interface TaxYearRow { year: number; projectedIncome: number; projectedTax: number; effectiveRate: number; marginalRate: number; }
export interface RrspInputs {
  currentAge: number; earnedIncome: number; currentBalance: number;
  unusedContributionRoom: number; pensionAdjustment: number; annualContribution: number;
  province: Province; expectedRetirementAge: number; expectedReturnRate: number;
}
export interface RrspAnalysis {
  currentRoom: number; newRoomThisYear: number; totalAvailableRoom: number;
  recommendedContribution: number; taxRefundAtMarginalRate: number; effectiveCostAfterRefund: number;
  projectedBalanceAtRetirement: number; projectedAnnualWithdrawal: number;
  yearsOfGrowth: number; maximizeByAge: number; catchUpStrategy: string;
  yearByYear: RrspYearRow[];
  homeByersAmount: number; lifelongLearningAmount: number;
}
export interface RrspYearRow { age: number; year: number; openingBalance: number; contribution: number; growth: number; closingBalance: number; cumulativeContributions: number; taxRefund: number; }
export interface TfsaInputs {
  currentAge: number; birthYear: number; currentBalance: number;
  contributionsMadeToDate?: number;
  withdrawalsThisYear: number; annualContribution: number;
  expectedReturnRate: number; province: Province;
}
export interface TfsaAnalysis {
  lifetimeRoomToDate: number; contributionsMadeToDate: number; withdrawalRoomRecovered: number;
  currentAvailableRoom: number; new2024Room: number;
  projectedBalance10Years: number; projectedBalance20Years: number; projectedBalanceAtRetirement: number;
  taxFreeSavingsVsTaxable: TfsaVsTaxableRow[];
  yearByYear: TfsaYearRow[];
  withdrawalStrategy: string; optimalWithdrawalAge: number;
}
export interface TfsaYearRow { age: number; year: number; annualLimit: number; cumulativeRoom: number; openingBalance: number; contribution: number; growth: number; closingBalance: number; }
export interface TfsaVsTaxableRow { year: number; tfsaBalance: number; taxableBalance: number; tfsaAdvantage: number; }
export interface CapitalGainsDisposal {
  description: string; assetType: "stocks" | "mutual_funds" | "real_estate" | "business" | "other";
  proceeds: number; acb: number; outlays: number;
  acquisitionDate: string; disposalDate: string; isQSBC?: boolean;
}
export interface CapitalGainsInputs {
  province: Province; taxYear: number; otherIncome: number;
  disposals: CapitalGainsDisposal[];
  currentYearLosses: number; carryForwardLosses: number; carryBackLosses: number;
  hasPrincipalResidence: boolean;
  principalResidenceYears?: number; principalResidenceFMV?: number; principalResidenceACB?: number;
}
export interface CapitalGainsDisposalResult extends CapitalGainsDisposal { gain: number; taxableGain: number; estimatedTax: number; holdingPeriodDays: number; }
export interface CapitalGainsAnalysis {
  totalProceeds: number; totalACB: number; totalGain: number; totalLoss: number; netGain: number;
  gainUnder250k: number; gainOver250k: number; inclusionRateUnder250k: number; inclusionRateOver250k: number;
  taxableGain: number; lossesApplied: number; netTaxableGain: number;
  federalTaxOnGains: number; provincialTaxOnGains: number; totalTaxOnGains: number; effectiveRateOnGains: number;
  lifetimeCapitalGainsExemption: number; lcgeUsed: number; lcgeRemaining: number;
  disposalBreakdown: CapitalGainsDisposalResult[];
  timingRecommendations: string[]; harvestingOpportunities: string[];
}
export interface IncomeSplittingInputs {
  province: Province; primaryAge: number;
  primaryEmploymentIncome: number; primaryPensionIncome: number;
  primaryRrspBalance: number; primaryRrifBalance: number; primaryOtherIncome: number;
  spouseAge: number; spouseEmploymentIncome: number; spousePensionIncome: number;
  spouseRrspBalance: number; spouseOtherIncome: number; yearsToRetirement: number;
}
export interface IncomeSplittingStrategy { name: string; annualSaving: number; eligible: boolean; description: string; actionRequired: string; }
export interface IncomeSplittingComparison {
  beforeSplitting: { primary: number; spouse: number; combined: number; effectivePrimary: number; effectiveSpouse: number };
  afterSplitting:  { primary: number; spouse: number; combined: number; effectivePrimary: number; effectiveSpouse: number };
  saving: number;
}
export interface IncomeSplittingAnalysis {
  currentCombinedTax: number; primaryCurrentTax: number; spouseCurrentTax: number;
  pensionSplitOptimalAmount: number; pensionSplitTaxSaving: number;
  primaryAfterSplitTax: number; spouseAfterSplitTax: number; combinedAfterSplitTax: number;
  spousalRrspRecommended: boolean; spousalRrspAnnualAmount: number; spousalRrspTotalSaving: number; spousalRrspRationale: string;
  cppSharingBenefit: number; prescribedRateLoanBenefit: number;
  totalAnnualSaving: number; totalLifetimeSaving: number;
  strategies: IncomeSplittingStrategy[]; comparison: IncomeSplittingComparison;
}
export interface InsuranceInputs {
  clientAge: number; spouseAge?: number; province: Province; maritalStatus: string;
  numberOfDependents: number; youngestDependentAge?: number;
  annualIncome: number; spouseAnnualIncome?: number; incomeReplacementYears: number;
  liquidAssets: number; rrspBalance: number; tfsaBalance: number;
  nonRegInvestments: number; realEstateEquity: number;
  mortgageBalance: number; otherDebt: number; finalExpenses: number;
  existingLifeInsurance: number; existingGroupBenefits: number;
  monthlyExpenses: number; existingDisabilityBenefit: number; waitingPeriod: number;
  existingCriticalIllness: number; province2: Province;
}
export interface InsuranceRecommendation { type: "life" | "disability" | "critical_illness" | "long_term_care"; priority: "immediate" | "high" | "medium" | "low"; coverageAmount: number; monthlyPremiumEstimate: number; rationale: string; }
export interface InsuranceAnalysis {
  dimeDebt: number; dimeIncome: number; dimeMortgage: number; dimeEducation: number;
  dimeTotalNeed: number; dimeExistingCoverage: number; dimeGap: number;
  hlvValue: number; hlvGap: number; needsBasedCapitalNeeded: number; needsBasedGap: number;
  recommendedLifeCoverage: number; recommendedCoverageType: "term_10" | "term_20" | "term_to_65" | "whole_life" | "universal_life";
  estimatedMonthlyPremium: number; monthlyDisabilityNeed: number; existingDisabilityCoverage: number;
  disabilityGap: number; recommendedDisabilityCoverage: number; estimatedDisabilityPremium: number;
  recommendedCICoverage: number; ciGap: number; estimatedCIPremium: number;
  recommendations: InsuranceRecommendation[]; priorityOrder: string[];
}
export interface EducationChild { name: string; birthYear: number; age: number; existingRespBalance: number; }
export interface EducationInputs {
  province: Province; familyIncome: number; numberOfChildren: number;
  children: EducationChild[]; existingRespBalance: number; annualContribution: number;
  expectedReturnRate: number; educationType: "college" | "university" | "trades"; programYears: number;
}
export interface RespYearRow { year: number; childAge: number; openingBalance: number; contribution: number; cesg: number; additionalCesg: number; clb: number; growth: number; closingBalance: number; }
export interface EducationChildAnalysis { name: string; age: number; yearsUntilPostSecondary: number; annualContributionRecommended: number; projectedRespBalance: number; totalCesgForChild: number; lifetimeCesgRemaining: number; estimatedEducationCost: number; shortfallOrSurplus: number; yearByYear: RespYearRow[]; }
export interface EducationAnalysis { children: EducationChildAnalysis[]; totalRecommendedAnnualContribution: number; totalProjectedRespValue: number; totalCesgReceived: number; totalEstimatedEducationCost: number; shortfallOrSurplus: number; familyCesgRate: number; additionalCesgPerChild: number; clbPerChild: number; }
export interface EstateInputs {
  province: Province; age: number; spouseAge?: number; maritalStatus: string;
  primaryResidence: number; cottageOrSecondProperty: number; rrspBalance: number; rrifBalance: number;
  tfsaBalance: number; nonRegInvestments: number; lifeInsurance: number; businessInterest: number; otherAssets: number;
  mortgage: number; otherDebt: number;
  hasWill: boolean; hasPOA: boolean; hasHCDirective: boolean;
  namedRrspBeneficiary: boolean; namedTfsaBeneficiary: boolean; namedInsuranceBeneficiary: boolean;
  rrspTaxableOnDeath: boolean; capitalGainsOnCottage: number; capitalGainsOnBusiness: number;
}
export interface EstateDocumentStatus { will: { hasDocument: boolean; recommendation: string }; poa: { hasDocument: boolean; recommendation: string }; hcDirective: { hasDocument: boolean; recommendation: string }; rrspBeneficiary: { hasDocument: boolean; recommendation: string }; tfsaBeneficiary: { hasDocument: boolean; recommendation: string }; insuranceBeneficiary: { hasDocument: boolean; recommendation: string }; }
export interface EstateRecommendation { priority: "immediate" | "high" | "medium" | "low"; category: string; recommendation: string; estimatedSaving: number; }
export interface EstateAnalysis { grossEstate: number; totalLiabilities: number; netEstate: number; probateFees: number; probateRate: number; assetsBypassingProbate: number; assetsSubjectToProbate: number; probateMinimizationSavings: number; taxOnRrsp: number; taxOnCapitalGains: number; totalTaxOnDeath: number; effectiveTaxRate: number; toSpouse: number; toEstate: number; estateAfterTaxAndProbate: number; documentStatus: EstateDocumentStatus; recommendations: EstateRecommendation[]; estimatedLiquidityNeeded: number; lifeInsuranceSuggested: number; }
export interface DebtItem { name: string; type: "mortgage" | "heloc" | "car_loan" | "student_loan" | "credit_card" | "line_of_credit" | "other"; balance: number; interestRate: number; minimumPayment: number; remainingTermMonths: number; }
export interface DebtInputs {
  province: Province; grossMonthlyIncome: number; spouseGrossMonthlyIncome: number;
  debts: DebtItem[];
  housingCosts: number; propertyTax: number; utilities: number; groceries: number;
  transportation: number; insurance: number; childcare: number; entertainment: number; otherExpenses: number;
  rrspMonthly: number; tfsaMonthly: number; otherSavings: number;
  emergencyFundBalance: number; emergencyFundTarget: number;
}
export interface DebtPayoffItem extends DebtItem { payoffOrder: number; monthsToPayoff: number; totalInterestPaid: number; payoffDate: string; }
export interface CashFlowBudget { grossIncome: number; taxes: number; netIncome: number; housing: number; transportation: number; food: number; insurance: number; childcare: number; debtPayments: number; savings: number; discretionary: number; total: number; surplus: number; }
export interface DebtRecommendation { priority: "high" | "medium" | "low"; category: string; recommendation: string; monthlyImpact: number; }
export interface DebtAnalysis { totalDebt: number; totalMonthlyDebt: number; totalMonthlyIncome: number; totalMonthlyExpenses: number; monthlySurplusOrDeficit: number; grossDebtServiceRatio: number; totalDebtServiceRatio: number; debtToIncomeRatio: number; avalancheOrder: DebtPayoffItem[]; snowballOrder: DebtPayoffItem[]; avalancheInterestSaved: number; avalancheMonthsSaved: number; snowballMotivationScore: number; recommendedStrategy: "avalanche" | "snowball"; monthlyBudget: CashFlowBudget; annualCashFlow: number; savingsRate: number; emergencyFundMonthsCovered: number; emergencyFundStatus: "adequate" | "building" | "critical"; recommendations: DebtRecommendation[]; debtFreeDate: string; }

export interface ReportMeta { client: PlanningClient; advisor: PlanningAdvisor; reportDate: string; reportTitle: string; disclaimer: string; confidential: boolean; planId?: number; locale?: string; }

// Raw data rows passed through for display-only sections (no engine calculation)
export interface RawNwEntry    { type: string; category: string; name: string; value: string; owner?: string | null; }
export interface RawExpenseRow { category: string; description?: string | null; monthlyAmount?: string | null; }
export interface RawGoalRow    { title: string; goalType?: string | null; targetAmount?: string | null; targetYear?: number | null; status?: string | null; priority?: string | null; cashflowType?: string | null; }

export interface ComprehensiveReportInputs {
  meta: ReportMeta;
  retirement?: RetirementInputs;
  tax?: TaxInputs;
  rrsp?: RrspInputs;
  tfsa?: TfsaInputs;
  capitalGains?: CapitalGainsInputs;
  incomeSplitting?: IncomeSplittingInputs;
  insurance?: InsuranceInputs;
  education?: EducationInputs;
  estate?: EstateInputs;
  debt?: DebtInputs;
  // Display-only sections — raw DB rows, no engine
  rawNetWorth?: RawNwEntry[];
  rawExpenses?: RawExpenseRow[];
  rawGoals?:    RawGoalRow[];
  annualIncome?: number;
}
