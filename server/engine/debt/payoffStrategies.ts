import type { DebtItem, PayoffStrategyResult, DebtPayoffComparison } from "./types";

function runPayoffStrategy(
  debts: DebtItem[],
  extraMonthlyBudget: number,
  strategy: "avalanche" | "snowball"
): PayoffStrategyResult {
  const balances = new Map<number, number>();
  const rates = new Map<number, number>();
  for (const d of debts) {
    balances.set(d.id, d.balance);
    rates.set(d.id, d.interestRate / 100 / 12);
  }

  let totalInterestPaid = 0;
  let totalPaid = 0;
  const payoffOrder: { debtId: number; debtName: string; paidOffMonth: number }[] = [];
  const paidOff = new Set<number>();
  const maxMonths = 600;

  for (let month = 1; month <= maxMonths; month++) {
    const activeDebts = debts.filter(d => !paidOff.has(d.id) && (balances.get(d.id) ?? 0) > 0.01);
    if (activeDebts.length === 0) break;

    const freedMinimums = debts
      .filter(d => paidOff.has(d.id))
      .reduce((s, d) => s + d.minimumPayment, 0);
    let availableExtra = extraMonthlyBudget + freedMinimums;

    for (const d of activeDebts) {
      const bal = balances.get(d.id) ?? 0;
      const monthlyRate = rates.get(d.id) ?? 0;
      const interest = bal * monthlyRate;
      totalInterestPaid += interest;
      balances.set(d.id, bal + interest);
    }

    for (const d of activeDebts) {
      const bal = balances.get(d.id) ?? 0;
      const payment = Math.min(d.minimumPayment, bal);
      balances.set(d.id, bal - payment);
      totalPaid += payment;
      if ((balances.get(d.id) ?? 0) <= 0.01) {
        availableExtra += d.minimumPayment - payment;
      }
    }

    const sorted = activeDebts
      .filter(d => !paidOff.has(d.id) && (balances.get(d.id) ?? 0) > 0.01)
      .sort((a, b) => {
        if (strategy === "avalanche") return b.interestRate - a.interestRate;
        return (balances.get(a.id) ?? 0) - (balances.get(b.id) ?? 0);
      });

    for (const d of sorted) {
      if (availableExtra <= 0) break;
      const bal = balances.get(d.id) ?? 0;
      const extraPayment = Math.min(availableExtra, bal);
      balances.set(d.id, bal - extraPayment);
      totalPaid += extraPayment;
      availableExtra -= extraPayment;
    }

    for (const d of activeDebts) {
      if ((balances.get(d.id) ?? 0) <= 0.01 && !paidOff.has(d.id)) {
        paidOff.add(d.id);
        payoffOrder.push({ debtId: d.id, debtName: d.name, paidOffMonth: month });
        balances.set(d.id, 0);
      }
    }

    if ([...balances.values()].every(b => b <= 0.01)) {
      const now = new Date();
      const debtFreeDate = new Date(now.getFullYear(), now.getMonth() + month, 1);
      return {
        strategy,
        totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        debtFreeMonth: month,
        debtFreeDate: debtFreeDate.toISOString().split("T")[0],
        payoffOrder,
      };
    }
  }

  const now = new Date();
  const debtFreeDate = new Date(now.getFullYear(), now.getMonth() + maxMonths, 1);
  return {
    strategy,
    totalInterestPaid: Math.round(totalInterestPaid * 100) / 100,
    totalPaid: Math.round(totalPaid * 100) / 100,
    debtFreeMonth: maxMonths,
    debtFreeDate: debtFreeDate.toISOString().split("T")[0],
    payoffOrder,
  };
}

export function comparePayoffStrategies(
  debts: DebtItem[],
  monthlyIncome: number,
  monthlyExpenses: number
): DebtPayoffComparison {
  const totalMinimumPayments = debts.reduce((s, d) => s + d.minimumPayment, 0);
  const totalMonthlyBudget = monthlyIncome - monthlyExpenses;
  const extraBudget = Math.max(0, totalMonthlyBudget - totalMinimumPayments);

  const avalanche = runPayoffStrategy(debts, extraBudget, "avalanche");
  const snowball = runPayoffStrategy(debts, extraBudget, "snowball");

  return {
    avalanche,
    snowball,
    interestSavings: Math.round((snowball.totalInterestPaid - avalanche.totalInterestPaid) * 100) / 100,
    monthsSaved: snowball.debtFreeMonth - avalanche.debtFreeMonth,
    investableSurplus: Math.max(0, totalMonthlyBudget - totalMinimumPayments),
    totalMinimumPayments,
    totalMonthlyBudget,
  };
}
