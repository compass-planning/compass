export interface BudgetEntry {
  category: string;
  subcategory: string;
  monthlyAmount: number;
  isFixed: boolean;
}

export interface CashFlowProfile {
  monthlyGrossIncome: number;
  monthlyNetIncome: number;
  additionalIncome: number;
  budgetEntries: BudgetEntry[];
  currentEmergencyFund: number;
  monthlyDebtPayments: number;
}

export interface CashFlowAnalysis {
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  fixedExpenses: number;
  variableExpenses: number;
  monthlySurplusDeficit: number;
  annualSurplusDeficit: number;
  savingsRate: number;
  emergencyFund: {
    currentAmount: number;
    threeMonthTarget: number;
    sixMonthTarget: number;
    monthsCovered: number;
    adequacy: "inadequate" | "minimum" | "adequate" | "strong";
  };
  investmentCapacity: {
    monthlyAvailable: number;
    annualAvailable: number;
    afterEmergencyFundBuildup: number;
  };
  categoryBreakdown: {
    category: string;
    total: number;
    percentage: number;
  }[];
}

export const BUDGET_CATEGORIES = [
  "Housing",
  "Transportation",
  "Food & Groceries",
  "Insurance Premiums",
  "Utilities",
  "Healthcare",
  "Debt Payments",
  "Childcare & Education",
  "Entertainment & Recreation",
  "Personal Care",
  "Clothing",
  "Savings & Investments",
  "Charitable Giving",
  "Miscellaneous",
] as const;
