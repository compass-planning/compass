export type FamilyIncomeBracket = "low" | "mid" | "high";

export interface RespProfile {
  childAge: number;
  targetAge: number;
  currentBalance: number;
  annualContribution: number;
  familyIncomeBracket: FamilyIncomeBracket;
  cesgReceivedToDate: number;
  clbEligible: boolean;
  clbReceivedToDate: number;
  targetEducationCost: number;
  educationCostInflation: number;
  equityAllocation: number;
  bondAllocation: number;
}

export interface CesgResult {
  basicCesg: number;
  additionalCesg: number;
  totalCesg: number;
  lifetimeCesgUsed: number;
  lifetimeRemaining: number;
}

export interface ClbResult {
  amount: number;
  lifetimeUsed: number;
  lifetimeRemaining: number;
  eligible: boolean;
}

export interface RespYearProjection {
  year: number;
  age: number;
  contribution: number;
  cesg: number;
  clb: number;
  investmentReturn: number;
  balance: number;
  inflationAdjustedCost: number;
}

export interface RespProjectionOutput {
  yearlyProjections: RespYearProjection[];
  finalBalance: number;
  inflationAdjustedCost: number;
  shortfall: number;
  surplus: number;
  totalContributions: number;
  totalCesg: number;
  totalClb: number;
  totalReturns: number;
}
