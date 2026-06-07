import type { InsuranceProfile } from "./types";

export interface InsuranceStepState {
  year: number;
  balance: number;
  contributions: number;
  withdrawals: number;
  returns: { equity: number; bond: number; inflation: number };
  inflationCumulative: number;
  success: boolean;
  customData?: Record<string, number>;
}

export function createInsuranceStepFn(profile: InsuranceProfile) {
  const baseIncome = profile.annualIncome;
  const volatility = profile.incomeVolatility;
  const consumptionRate = profile.personalConsumptionRate;
  const mortgageBalance = profile.mortgageBalance;
  const totalDebts = profile.totalDebts;
  const educationTarget = profile.educationFundTarget;
  const finalExpenses = profile.finalExpenses;
  const existingCoverage = profile.existingLifeCoverage + profile.existingAssets;
  const workingYears = profile.workingYearsRemaining;

  const stepFn = (
    state: InsuranceStepState,
    returns: { equity: number; bond: number; inflation: number },
    _simIndex: number
  ): InsuranceStepState => {
    const year = state.year;

    const incomeMultiplier = profile.isVariableIncome
      ? 1 + (returns.equity * volatility * 2)
      : 1;
    const yearIncome = Math.max(0, baseIncome * incomeMultiplier);

    const remainingYears = Math.max(0, workingYears - (year - 1));
    const incomeNeed = yearIncome * (1 - consumptionRate) * remainingYears;
    const inflatedMortgage = mortgageBalance * state.inflationCumulative;
    const inflatedDebts = totalDebts * state.inflationCumulative;
    const inflatedEducation = educationTarget * state.inflationCumulative;
    const inflatedFinal = finalExpenses * state.inflationCumulative;

    const totalNeed = incomeNeed + inflatedMortgage + inflatedDebts + inflatedEducation + inflatedFinal;
    const gap = Math.max(0, totalNeed - existingCoverage);

    const prevMaxGap = state.customData?.maxGap ?? 0;
    const maxGap = Math.max(prevMaxGap, gap);

    return {
      ...state,
      year,
      balance: maxGap,
      contributions: yearIncome,
      withdrawals: 0,
      returns,
      success: maxGap <= 0,
      customData: {
        ...state.customData,
        yearIncome,
        totalNeed,
        gap,
        maxGap,
        incomeNeed,
        remainingYears,
      },
    };
  };

  const initialState: InsuranceStepState = {
    year: 0,
    balance: 0,
    contributions: 0,
    withdrawals: 0,
    returns: { equity: 0, bond: 0, inflation: 0 },
    inflationCumulative: 1.0,
    success: true,
    customData: { maxGap: 0 },
  };

  return { stepFn, initialState };
}
