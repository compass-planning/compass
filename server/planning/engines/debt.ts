// server/planning/engines/debt.ts
import type { DebtInputs, DebtAnalysis, DebtPayoffItem, DebtRecommendation, CashFlowBudget } from "../types.js";
import { calculateFederalTax, calculateProvincialTax } from "../data/taxData2024.js";

function calculatePayoffOrder(debts: DebtInputs["debts"], method: "avalanche"|"snowball", extraMonthly: number): DebtPayoffItem[] {
  const sorted = method==="avalanche" ? [...debts].sort((a,b)=>b.interestRate-a.interestRate) : [...debts].sort((a,b)=>a.balance-b.balance);
  const results: DebtPayoffItem[] = [];
  let extra = extraMonthly;
  for (let i = 0; i < sorted.length; i++) {
    const debt = sorted[i]; let balance = debt.balance, months = 0, totalInterest = 0;
    const payment = debt.minimumPayment + (i===0?extra:0);
    while (balance > 0 && months < 600) { const interest = balance*(debt.interestRate/12); totalInterest+=interest; balance=balance+interest-payment; months++; if(balance<0)balance=0; }
    extra += debt.minimumPayment;
    const payoffDate = new Date(); payoffDate.setMonth(payoffDate.getMonth()+months);
    results.push({ ...debt, payoffOrder:i+1, monthsToPayoff:months, totalInterestPaid:Math.round(totalInterest), payoffDate:payoffDate.toLocaleDateString("en-CA",{year:"numeric",month:"short"}) });
  }
  return results;
}
export function analyzeDebt(inputs: DebtInputs, locale = "en"): DebtAnalysis {
  const { province, grossMonthlyIncome, spouseGrossMonthlyIncome, debts, housingCosts, propertyTax, utilities, groceries, transportation, insurance, childcare, entertainment, otherExpenses, rrspMonthly, tfsaMonthly, otherSavings, emergencyFundBalance, emergencyFundTarget } = inputs;
  const totalMonthlyIncome = grossMonthlyIncome + spouseGrossMonthlyIncome;
  const annualIncome = totalMonthlyIncome * 12;
  const annualTax = calculateFederalTax(annualIncome) + calculateProvincialTax(annualIncome, province);
  const netMonthlyIncome = (annualIncome - annualTax) / 12;
  const totalDebt = debts.reduce((s,d)=>s+d.balance,0), totalMonthlyDebt = debts.reduce((s,d)=>s+d.minimumPayment,0);
  const monthlyExpenseTotal = housingCosts+propertyTax/12+utilities+groceries+transportation+insurance+childcare+entertainment+otherExpenses;
  const totalMonthlySavings = rrspMonthly+tfsaMonthly+otherSavings;
  const totalMonthlyExpenses = monthlyExpenseTotal + totalMonthlyDebt + totalMonthlySavings;
  const monthlySurplus = netMonthlyIncome - totalMonthlyExpenses;
  const gdsr = grossMonthlyIncome>0?(housingCosts+propertyTax/12+utilities*0.5)/grossMonthlyIncome:0;
  const tdsr = grossMonthlyIncome>0?(housingCosts+propertyTax/12+totalMonthlyDebt)/grossMonthlyIncome:0;
  const extra = Math.max(0, monthlySurplus);
  const avalancheOrder = calculatePayoffOrder(debts, "avalanche", extra);
  const snowballOrder  = calculatePayoffOrder(debts, "snowball",  extra);
  const avalancheInterest = avalancheOrder.reduce((s,d)=>s+d.totalInterestPaid,0);
  const snowballInterest  = snowballOrder.reduce((s,d)=>s+d.totalInterestPaid,0);
  const monthlyNecessities = housingCosts+utilities+groceries+insurance+totalMonthlyDebt;
  const emergencyTarget = emergencyFundTarget>0?emergencyFundTarget:monthlyNecessities*6;
  const emergencyMonths = emergencyTarget>0?emergencyFundBalance/monthlyNecessities:0;
  const emergencyStatus: "adequate"|"building"|"critical" = emergencyMonths>=3?"adequate":emergencyMonths>=1?"building":"critical";
  const budget: CashFlowBudget = { grossIncome:Math.round(totalMonthlyIncome), taxes:Math.round(annualTax/12), netIncome:Math.round(netMonthlyIncome), housing:Math.round(housingCosts+propertyTax/12), transportation:Math.round(transportation), food:Math.round(groceries), insurance:Math.round(insurance), childcare:Math.round(childcare), debtPayments:Math.round(totalMonthlyDebt), savings:Math.round(totalMonthlySavings), discretionary:Math.round(entertainment+otherExpenses), total:Math.round(totalMonthlyExpenses+annualTax/12), surplus:Math.round(monthlySurplus) };
  const recommendations: DebtRecommendation[] = [];
  if (tdsr>0.44) recommendations.push({priority:"high",category:"Debt Load",recommendation: locale==="fr"
            ? `Votre ratio ATD est de ${(tdsr*100).toFixed(1)}%, au-dessus du maximum recommandé de 44 %. Réduisez les dépenses non essentielles et priorisez le remboursement des dettes.`
            : `Your Total Debt Service Ratio is ${(tdsr*100).toFixed(1)}%, above the recommended maximum of 44%. Reduce non-essential spending and prioritize debt repayment.`,monthlyImpact:Math.round((tdsr-0.44)*grossMonthlyIncome)});
  if (emergencyStatus==="critical") recommendations.push({priority:"high",category:"Emergency Fund",recommendation: locale==="fr"
            ? `Votre fonds d'urgence couvre moins d'un mois de dépenses. Constituez un fonds de ${Math.round(monthlyNecessities*3).toLocaleString("fr-CA")} $ (3 mois) avant d'accélérer le remboursement des dettes.`
            : `Your emergency fund covers less than 1 month of expenses. Build to $${Math.round(monthlyNecessities*3).toLocaleString()} (3 months) before accelerating debt repayment.`,monthlyImpact:Math.round(monthlyNecessities*3/12)});
  const ccDebt = debts.find(d=>d.type==="credit_card");
  if (ccDebt) recommendations.push({priority:"high",category:"High-Interest Debt",recommendation: locale==="fr"
            ? `Le solde de carte de crédit de ${ccDebt.balance.toLocaleString("fr-CA")} $ à ${(ccDebt.interestRate*100).toFixed(1)}% est votre priorité absolue. Envisagez un transfert de solde vers un produit à taux plus bas.`
            : `Credit card balance of $${ccDebt.balance.toLocaleString()} at ${(ccDebt.interestRate*100).toFixed(1)}% is your highest priority. Consider a balance transfer to a lower-rate product.`,monthlyImpact:Math.round(ccDebt.balance*ccDebt.interestRate/12)});
  const longestPayoff = Math.max(...avalancheOrder.map(d=>d.monthsToPayoff),0);
  const debtFreeDate = new Date(); debtFreeDate.setMonth(debtFreeDate.getMonth()+longestPayoff);
  return { totalDebt:Math.round(totalDebt), totalMonthlyDebt:Math.round(totalMonthlyDebt), totalMonthlyIncome:Math.round(totalMonthlyIncome), totalMonthlyExpenses:Math.round(totalMonthlyExpenses), monthlySurplusOrDeficit:Math.round(monthlySurplus), grossDebtServiceRatio:Math.round(gdsr*10000)/10000, totalDebtServiceRatio:Math.round(tdsr*10000)/10000, debtToIncomeRatio:Math.round(totalMonthlyIncome>0?totalDebt/(totalMonthlyIncome*12)*100:0)/100, avalancheOrder, snowballOrder, avalancheInterestSaved:Math.round(snowballInterest-avalancheInterest), avalancheMonthsSaved:Math.max(0,Math.max(...snowballOrder.map(d=>d.monthsToPayoff))-Math.max(...avalancheOrder.map(d=>d.monthsToPayoff))), snowballMotivationScore:snowballOrder.filter((_,i)=>i<3).length, recommendedStrategy:snowballInterest-avalancheInterest>1000?"avalanche":"snowball", monthlyBudget:budget, annualCashFlow:Math.round(monthlySurplus*12), savingsRate:netMonthlyIncome>0?Math.round(totalMonthlySavings/netMonthlyIncome*10000)/10000:0, emergencyFundMonthsCovered:Math.round(emergencyMonths*10)/10, emergencyFundStatus:emergencyStatus, recommendations, debtFreeDate:debtFreeDate.toLocaleDateString(locale==="fr" ? "fr-CA" : "en-CA",{year:"numeric",month:"long"}) };
}