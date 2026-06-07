/**
 * usTypes.ts
 * TypeScript types for the US financial planning engine.
 * Mirrors the structure of server/engine/tax/types.ts (Canadian side)
 * so shared UI components can handle both jurisdictions uniformly.
 */

import type { FilingStatus } from "../reference/usTaxData2025.js";

// ── US Tax Projection Profile ─────────────────────────────────────────────────

export interface UsTaxProjectionProfile {
  // Demographics
  currentAge:            number;
  retirementAge:         number;
  planToAge:             number;
  birthYear:             number;        // needed for SS FRA and RMD start age
  filingStatus:          FilingStatus;
  usState:               string;        // two-letter code e.g. "CA"

  // Current income
  wagesIncome:           number;        // W-2 wages / salary
  selfEmploymentIncome:  number;        // Schedule C
  otherOrdinaryIncome:   number;        // rental, alimony, etc.
  qualifiedDividends:    number;        // taxed at LTCG rates
  ordinaryDividends:     number;        // taxed as ordinary income
  incomeGrowthRate:      number;        // annual growth to retirement

  // Pre-tax retirement accounts (401k / 403b / 457b / SEP-IRA / SIMPLE)
  pretaxBalance:         number;        // combined balance
  pretaxAnnualContrib:   number;        // employee deferrals
  employerMatch:         number;        // annual employer contribution
  pretaxGrowthRate:      number;

  // Roth accounts (Roth 401k + Roth IRA)
  rothBalance:           number;
  rothAnnualContrib:     number;        // includes backdoor Roth if applicable
  rothGrowthRate:        number;

  // Traditional IRA (separate from 401k for RMD / deductibility tracking)
  tradIraBalance:        number;
  tradIraAnnualContrib:  number;

  // Taxable brokerage / non-qualified
  taxableBalance:        number;
  taxableCostBasis:      number;        // aggregate adjusted cost basis
  taxableAnnualContrib:  number;
  taxableGrowthRate:     number;        // total return
  dividendYield:         number;        // portion of taxable return paid as dividends

  // HSA
  hsaBalance:            number;
  hsaAnnualContrib:      number;
  hsaGrowthRate:         number;

  // Social Security
  ssMonthlyBenefitAtFra: number;        // PIA estimate from SSA statement
  ssClaimAge:            number;        // planned claiming age (62–70)
  spouseSsMonthlyAtFra?: number;        // for spousal benefit analysis

  // Pension / annuity income (if any)
  pensionAnnualIncome:   number;        // annual gross; starts at retirement
  pensionCola:           number;        // COLA rate e.g. 0.02

  // Desired retirement spending
  desiredRetirementIncome: number;      // after-tax annual spending goal
  retirementIncomeGrowth:  number;      // inflation rate for spending

  // Spouse (optional)
  hasSpouse?:            boolean;
  spouseAge?:            number;
  spouseBirthYear?:      number;
  spouseWages?:          number;
  spousePretaxBalance?:  number;
  spouseRothBalance?:    number;

  // Deduction strategy
  useStandardDeduction?: boolean;       // default true; false = itemized
  itemizedDeductions?:   number;        // if useStandard = false
}

// ── Year-by-Year Projection Row ───────────────────────────────────────────────

export interface UsTaxYearProjection {
  year:                  number;
  age:                   number;
  phase:                 "accumulation" | "retirement";

  // Income sources
  wagesIncome:           number;
  selfEmploymentIncome:  number;
  pensionIncome:         number;
  rmdWithdrawal:         number;        // Required Minimum Distribution (401k/trad IRA)
  rothWithdrawal:        number;        // tax-free
  taxableWithdrawal:     number;
  ssBenefit:             number;        // gross; portion may be taxable
  ssTaxableAmount:       number;        // included in taxable income
  qualifiedDividends:    number;
  ordinaryDividends:     number;
  ltcgRealized:          number;        // long-term capital gains realized
  otherIncome:           number;

  // Deduction
  standardDeduction:     number;
  itemizedDeductions:    number;
  deductionUsed:         number;        // whichever is greater

  // Taxable income components
  totalAgi:              number;        // Adjusted Gross Income
  totalTaxableIncome:    number;        // AGI – deductions
  netInvestmentIncome:   number;        // for NIIT

  // Tax
  federalTax:            number;
  stateTax:              number;
  niit:                  number;
  additionalMedicareTax: number;
  selfEmploymentTax:     number;
  ltcgTax:               number;
  totalTax:              number;
  effectiveRate:         number;
  marginalRate:          number;        // combined fed + state ordinary

  // After-tax
  netIncome:             number;
  disposableIncome:      number;

  // Account balances (year-end)
  pretaxBalance:         number;        // 401k / trad IRA
  rothBalance:           number;
  taxableBalance:        number;
  hsaBalance:            number;
  totalWealth:           number;

  // Medicare
  medicarePremiumMonthly: number;       // Part B IRMAA

  // Notes / flags
  rmdRequired:           boolean;
  rmdStartAge:           number;
  inRothConversionWindow: boolean;      // low-income years before SS/RMD begin
}

// ── Social Security Analysis ──────────────────────────────────────────────────

export interface SsTimingOption {
  claimAge:              number;
  monthlyBenefit:        number;
  annualBenefit:         number;
  adjustmentFactor:      number;
  adjustmentLabel:       string;
  lifetimeBenefitTo85:   number;
  lifetimeBenefitTo90:   number;
  breakEvenVsPriorAge:   number | null; // age at which this timing beats previous option
}

export interface SsTimingAnalysis {
  pia:                   number;
  fra:                   number;
  options:               SsTimingOption[];
  recommendedAge:        number;
  recommendedReasoning:  string;
  spouseAnalysis?:       SsSpouseAnalysis;
}

export interface SsSpouseAnalysis {
  spouseOwnBenefit:      number;        // based on own earnings
  spousalBenefit:        number;        // 50% of higher earner's PIA
  survivorBenefit:       number;        // 100% of higher earner's benefit
  recommendedStrategy:   string;
}

// ── 401k / IRA Room ───────────────────────────────────────────────────────────

export interface Us401kRoomInput {
  currentAge:            number;
  currentYearContribs:   number;
  employerMatch:         number;
  hasCatchupEligibility: boolean;      // age >= 50
  isSuperCatchupEligible: boolean;     // age 60-63
  year:                  number;
}

export interface Us401kRoomSummary {
  employeeLimit:         number;
  catchupAllowed:        number;
  totalEmployeeLimit:    number;
  employerMatchActual:   number;
  totalLimit:            number;       // §415 combined limit
  contributionsMade:     number;
  remainingRoom:         number;
}

export interface UsIraRoomInput {
  currentAge:            number;
  currentYearContribs:   number;
  magi:                  number;
  filingStatus:          FilingStatus;
  hasCoverageByWorkplacePlan: boolean;
  year:                  number;
}

export interface UsIraRoomSummary {
  baseLimit:             number;
  catchupAllowed:        number;
  totalLimit:            number;
  rothContribAllowed:    number;       // 0 if income too high
  tradDeductibleAllowed: number;       // may be 0 if covered by plan + high income
  contributionsMade:     number;
  remainingRoom:         number;
  isBackdoorRothAdvised: boolean;
}

// ── Capital Gains (US) ────────────────────────────────────────────────────────

export interface UsCapitalGainsPosition {
  name:             string;
  marketValue:      number;
  costBasis:        number;
  unrealizedGain:   number;
  isLongTerm:       boolean;   // held > 1 year
  isLoss:           boolean;
}

export interface UsCapitalGainsScenario {
  label:                  string;
  amountRealized:         number;
  isLongTerm:             boolean;
  ltcgTax:                number;
  niit:                   number;
  stateTax:               number;
  totalTax:               number;
  netProceeds:            number;
  effectiveTaxRate:       number;
}

export interface UsCapitalGainsAnalysis {
  positions:              UsCapitalGainsPosition[];
  totalUnrealizedLtcg:    number;
  totalUnrealizedStcg:    number;
  totalUnrealizedLoss:    number;
  netUnrealizedLtcg:      number;
  harvestingOpportunity:  number;
  stepUpOpportunity:      string;     // narrative
  scenarios:              UsCapitalGainsScenario[];
  recommendedYear:        number;
  reasoning:              string;
  rothConversionInterplay: string;    // notes on gains vs. Roth conversion tradeoff
}

// ── Roth Conversion Analysis ──────────────────────────────────────────────────

export interface RothConversionScenario {
  label:                  string;
  conversionAmount:       number;
  additionalTax:          number;
  marginalRateOnConversion: number;
  netTaxSavingsLifetime:  number;     // projected; positive = conversion worthwhile
  breakEvenYears:         number;
}

export interface RothConversionAnalysis {
  currentTradIraBalance:  number;
  currentRothBalance:     number;
  rmdStartAge:            number;
  yearsInConversionWindow: number;    // years before SS + RMD both kick in
  scenarios:              RothConversionScenario[];
  recommendedAnnualConversion: number;
  reasoning:              string;
}
