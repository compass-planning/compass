// ── Tax Projection Types ──────────────────────────────────────────────────────

export interface TaxProjectionProfile {
  currentAge:             number;
  retirementAge:          number;
  planToAge:              number;
  province:               string;

  // Current year income
  employmentIncome:       number;
  selfEmploymentIncome:   number;
  otherIncome:            number;           // rental, dividends, etc.
  incomeGrowthRate:       number;           // e.g. 0.03 = 3%/yr until retirement

  // Registered accounts
  rrspBalance:            number;
  rrspContributionRoom:   number;           // carry-forward room today
  rrspAnnualContribution: number;
  tfsaBalance:            number;
  tfsaContributionRoom:   number;           // carry-forward room today
  tfsaAnnualContribution: number;

  // Non-registered
  nonRegBalance:          number;
  nonRegAcb:              number;           // adjusted cost base
  nonRegAnnualContrib:    number;
  portfolioYield:         number;           // expected annual return rate

  // Retirement income
  desiredRetirementIncome: number;
  pensionIncome:           number;
  cppStartAge:             number;
  oasStartAge:             number;

  // Spouse (optional)
  hasSpouse?:              boolean;
  spouseAge?:              number;
  spouseEmploymentIncome?: number;
  spouseRrspBalance?:      number;
  spouseTfsaBalance?:      number;
}

export interface TaxYearProjection {
  year:                 number;
  age:                  number;
  phase:                "accumulation" | "retirement";

  // Income
  employmentIncome:     number;
  pensionIncome:        number;
  rrifWithdrawal:       number;
  tfsaWithdrawal:       number;
  capitalGainsIncome:   number;
  cppBenefit:           number;
  oasBenefit:           number;
  otherIncome:          number;
  totalGrossIncome:     number;
  totalTaxableIncome:   number;

  // Tax
  federalTax:           number;
  provincialTax:        number;
  totalTax:             number;
  effectiveRate:        number;
  marginalRate:         number;

  // After-tax
  netIncome:            number;
  disposableIncome:     number;  // netIncome – retirement spending

  // Account balances at year-end
  rrspBalance:          number;
  tfsaBalance:          number;
  nonRegBalance:        number;
  totalWealth:          number;

  // Room remaining
  rrspRoomAvailable:    number;
  tfsaRoomAvailable:    number;
}

// ── RRSP Room ─────────────────────────────────────────────────────────────────

export interface RrspRoomInput {
  currentCarryForwardRoom:    number;
  priorYearEarnedIncome:      number;
  currentYearContributions:   number;
  pensionAdjustment?:         number;
  retirementYear?:            number;   // RRSP must be converted by Dec 31 of age-71 year
  currentAge?:                number;
}

export interface RrspRoomSummary {
  newRoomThisYear:            number;
  carryForwardBroughtIn:      number;
  totalAvailableRoom:         number;
  contributionsMade:          number;
  pensionAdjustment:          number;
  closingRoom:                number;
  yearsUntilConversion:       number | null;
  annualLimitUsed:            number;
}

// ── TFSA Room ─────────────────────────────────────────────────────────────────

export interface TfsaRoomInput {
  yearTurned18:             number;   // e.g. 1995 → eligible since 2009
  currentCarryForwardRoom:  number;
  currentYearContributions: number;
  currentYearWithdrawals:   number;   // re-added next year
}

export interface TfsaRoomSummary {
  cumulativeRoomEarned:     number;
  carryForwardBroughtIn:    number;
  contributionsMade:        number;
  withdrawalsLastYear:      number;   // re-added
  totalAvailableRoom:       number;
  closingRoom:              number;
  annualLimitThisYear:      number;
}

// ── Capital Gains ─────────────────────────────────────────────────────────────

export interface CapitalGainsPosition {
  name:             string;
  marketValue:      number;
  adjustedCostBase: number;
  unrealizedGain:   number;
  isLoss:           boolean;
}

export interface CapitalGainsScenario {
  label:                 string;
  amountRealized:        number;
  taxableGain:           number;
  inclusionRate:         number;
  estimatedTax:          number;
  netProceeds:           number;
  effectiveGainsTaxRate: number;
}

export interface CapitalGainsAnalysis {
  positions:             CapitalGainsPosition[];
  totalUnrealizedGain:   number;
  totalUnrealizedLoss:   number;
  netUnrealized:         number;
  scenarios:             CapitalGainsScenario[];
  harvestingOpportunity: number;   // loss available to offset gains
  recommendedYear:       number;   // optimal year to realize based on projected income
  reasoning:             string;
}

// ── Income Splitting ──────────────────────────────────────────────────────────

export interface IncomeSplittingAnalysis {
  strategy:              "pension_split" | "spousal_rrsp" | "tfsa_shift" | "none";
  currentCombinedTax:    number;
  optimizedCombinedTax:  number;
  annualTaxSavings:      number;
  lifetimeTaxSavings:    number;   // projected years remaining × annual savings
  details:               string;
}
