import type { DebtItem } from "./types";

export interface DebtStepState {
  year: number;
  balance: number;
  contributions: number;
  withdrawals: number;
  returns: { equity: number; bond: number; inflation: number };
  inflationCumulative: number;
  success: boolean;
  customData?: Record<string, number>;
}

export function createDebtStepFn(
  debts: DebtItem[],
  monthlyIncome: number,
  monthlyExpenses: number
) {
  const totalBalance = debts.reduce((s, d) => s + d.balance, 0);
  const totalMinPayments = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const weightedRate = totalBalance > 0
    ? debts.reduce((s, d) => s + d.interestRate * d.balance, 0) / totalBalance / 100
    : 0;
  const hasVariableRate = debts.some(d => d.isVariableRate);

  const stepFn = (
    state: DebtStepState,
    returns: { equity: number; bond: number; inflation: number },
    _simIndex: number
  ): DebtStepState => {
    const year = state.year;
    const currentBalance = state.balance;

    let effectiveRate = weightedRate;
    if (hasVariableRate) {
      const rateShock = returns.bond * 0.5;
      effectiveRate = Math.max(0, weightedRate + rateShock);
    }

    const annualInterest = currentBalance * effectiveRate;
    const annualPayments = Math.min(totalMinPayments * 12, currentBalance + annualInterest);
    const surplus = Math.max(0, (monthlyIncome - monthlyExpenses) * 12 - annualPayments);

    const totalPayment = annualPayments + surplus;
    const newBalance = Math.max(0, currentBalance + annualInterest - totalPayment);
    const isPaidOff = newBalance <= 0.01;

    return {
      ...state,
      year,
      balance: newBalance,
      contributions: state.contributions + totalPayment,
      withdrawals: annualInterest,
      returns,
      success: isPaidOff,
      customData: {
        ...state.customData,
        annualInterest,
        annualPayment: totalPayment,
        effectiveRate,
        remainingBalance: newBalance,
      },
    };
  };

  const initialState: DebtStepState = {
    year: 0,
    balance: totalBalance,
    contributions: 0,
    withdrawals: 0,
    returns: { equity: 0, bond: 0, inflation: 0 },
    inflationCumulative: 1.0,
    success: false,
    customData: { totalDebtBalance: totalBalance, weightedRate: weightedRate * 100 },
  };

  const maxYears = Math.ceil(totalBalance / Math.max(1, totalMinPayments * 12)) + 5;

  return { stepFn, initialState, yearsToProject: Math.min(maxYears, 30) };
}
