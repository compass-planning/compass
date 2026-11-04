export interface DebtItem {
  id: number;
  name: string;
  category: string;
  balance: number;
  interestRate: number;
  minimumPayment: number;
  isVariableRate?: boolean;
  rateSpread?: number;
}

export interface PayoffScheduleEntry {
  month: number;
  debtId: number;
  debtName: string;
  payment: number;
  interestPaid: number;
  principalPaid: number;
  remainingBalance: number;
}

export interface PayoffStrategyResult {
  strategy: "avalanche" | "snowball";
  totalInterestPaid: number;
  totalPaid: number;
  debtFreeMonth: number;
  debtFreeDate: string;
  payoffOrder: { debtId: number; debtName: string; paidOffMonth: number }[];
}

export interface DebtPayoffComparison {
  avalanche: PayoffStrategyResult;
  snowball: PayoffStrategyResult;
  interestSavings: number;
  monthsSaved: number;
  investableSurplus: number;
  totalMinimumPayments: number;
  totalMonthlyBudget: number;
}
