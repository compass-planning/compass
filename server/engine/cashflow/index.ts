import type { CashFlowProfile, CashFlowAnalysis } from "./types";

export function analyzeCashFlow(profile: CashFlowProfile): CashFlowAnalysis {
  const totalMonthlyIncome = profile.monthlyNetIncome + profile.additionalIncome;

  const fixedExpenses = profile.budgetEntries
    .filter(e => e.isFixed)
    .reduce((s, e) => s + e.monthlyAmount, 0);

  const variableExpenses = profile.budgetEntries
    .filter(e => !e.isFixed)
    .reduce((s, e) => s + e.monthlyAmount, 0);

  const debtInBudget = profile.budgetEntries
    .filter(e => e.category.toLowerCase().includes("debt"))
    .reduce((s, e) => s + e.monthlyAmount, 0);
  const debtToAdd = Math.max(0, profile.monthlyDebtPayments - debtInBudget);
  const totalMonthlyExpenses = fixedExpenses + variableExpenses + debtToAdd;
  const monthlySurplusDeficit = totalMonthlyIncome - totalMonthlyExpenses;
  const annualSurplusDeficit = monthlySurplusDeficit * 12;
  const savingsRate = totalMonthlyIncome > 0
    ? Math.max(0, monthlySurplusDeficit) / totalMonthlyIncome
    : 0;

  const totalExpensesForEmergency = totalMonthlyExpenses;
  const threeMonthTarget = totalExpensesForEmergency * 3;
  const sixMonthTarget = totalExpensesForEmergency * 6;
  const monthsCovered = totalExpensesForEmergency > 0
    ? profile.currentEmergencyFund / totalExpensesForEmergency
    : 0;

  let adequacy: "inadequate" | "minimum" | "adequate" | "strong";
  if (monthsCovered < 3) adequacy = "inadequate";
  else if (monthsCovered < 4) adequacy = "minimum";
  else if (monthsCovered < 6) adequacy = "adequate";
  else adequacy = "strong";

  const emergencyFundGap = Math.max(0, threeMonthTarget - profile.currentEmergencyFund);
  const monthsToFillGap = monthlySurplusDeficit > 0 && emergencyFundGap > 0
    ? Math.ceil(emergencyFundGap / monthlySurplusDeficit)
    : 0;
  const afterEmergencyFundBuildup = monthlySurplusDeficit > 0 && monthsToFillGap > 0
    ? monthlySurplusDeficit
    : Math.max(0, monthlySurplusDeficit);

  const categoryMap = new Map<string, number>();
  for (const entry of profile.budgetEntries) {
    const current = categoryMap.get(entry.category) ?? 0;
    categoryMap.set(entry.category, current + entry.monthlyAmount);
  }
  if (debtToAdd > 0) {
    const debtCurrent = categoryMap.get("Debt Payments") ?? 0;
    categoryMap.set("Debt Payments", debtCurrent + debtToAdd);
  }

  const categoryBreakdown = [...categoryMap.entries()].map(([category, total]) => ({
    category,
    total,
    percentage: totalMonthlyExpenses > 0 ? Math.round((total / totalMonthlyExpenses) * 10000) / 100 : 0,
  })).sort((a, b) => b.total - a.total);

  return {
    totalMonthlyIncome,
    totalMonthlyExpenses,
    fixedExpenses,
    variableExpenses,
    monthlySurplusDeficit: Math.round(monthlySurplusDeficit * 100) / 100,
    annualSurplusDeficit: Math.round(annualSurplusDeficit * 100) / 100,
    savingsRate: Math.round(savingsRate * 10000) / 10000,
    emergencyFund: {
      currentAmount: profile.currentEmergencyFund,
      threeMonthTarget: Math.round(threeMonthTarget * 100) / 100,
      sixMonthTarget: Math.round(sixMonthTarget * 100) / 100,
      monthsCovered: Math.round(monthsCovered * 10) / 10,
      adequacy,
    },
    investmentCapacity: {
      monthlyAvailable: Math.max(0, Math.round(monthlySurplusDeficit * 100) / 100),
      annualAvailable: Math.max(0, Math.round(annualSurplusDeficit * 100) / 100),
      afterEmergencyFundBuildup: Math.round(afterEmergencyFundBuildup * 100) / 100,
    },
    categoryBreakdown,
  };
}

export type { CashFlowProfile, CashFlowAnalysis, BudgetEntry } from "./types";
export { BUDGET_CATEGORIES } from "./types";
