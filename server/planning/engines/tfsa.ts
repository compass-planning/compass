// server/planning/engines/tfsa.ts
import type { TfsaInputs, TfsaAnalysis, TfsaYearRow, TfsaVsTaxableRow } from "../types.js";
import { TFSA_ANNUAL_LIMITS, getTfsaCumulativeRoom, getMarginalRate } from "../data/taxData2024.js";

export function analyzeTfsa(inputs: TfsaInputs, locale = "en"): TfsaAnalysis {
  const { currentAge, birthYear, currentBalance, withdrawalsThisYear, annualContribution, expectedReturnRate, province } = inputs;
  const currentYear = new Date().getFullYear();
  const lifetimeRoomToDate = getTfsaCumulativeRoom(birthYear, currentYear);
  const new2024Room = TFSA_ANNUAL_LIMITS[2024] ?? 7000;
  const currentAvailableRoom = Math.max(0, lifetimeRoomToDate - currentBalance + withdrawalsThisYear);
  const marginalRate = getMarginalRate(currentBalance, province);
  const yearByYear: TfsaYearRow[] = [], taxableVsComparison: TfsaVsTaxableRow[] = [];
  let tfsaBal = currentBalance, taxableBal = currentBalance, cumulativeRoom = lifetimeRoomToDate;
  for (let i = 0; i < 30; i++) {
    const age = currentAge + i, year = currentYear + i;
    const annualLimit = TFSA_ANNUAL_LIMITS[year] ?? 7000;
    cumulativeRoom += annualLimit;
    const contribution = Math.min(annualContribution, currentAvailableRoom + annualLimit * i);
    const growth = tfsaBal * expectedReturnRate, newBal = tfsaBal + contribution + growth;
    yearByYear.push({ age, year, annualLimit, cumulativeRoom:Math.round(cumulativeRoom), openingBalance:Math.round(tfsaBal), contribution:Math.round(contribution), growth:Math.round(growth), closingBalance:Math.round(newBal) });
    const taxableGrowth = taxableBal * expectedReturnRate * (1 - marginalRate * 0.5);
    taxableBal = taxableBal + contribution + taxableGrowth;
    taxableVsComparison.push({ year, tfsaBalance:Math.round(newBal), taxableBalance:Math.round(taxableBal), tfsaAdvantage:Math.round(newBal-taxableBal) });
    tfsaBal = newBal;
  }
  const retIdx = Math.min(29, Math.max(0, 65 - currentAge));
  return { lifetimeRoomToDate, contributionsMadeToDate:currentBalance, withdrawalRoomRecovered:withdrawalsThisYear, currentAvailableRoom, new2024Room, projectedBalance10Years:yearByYear[Math.min(9,yearByYear.length-1)]?.closingBalance??0, projectedBalance20Years:yearByYear[Math.min(19,yearByYear.length-1)]?.closingBalance??0, projectedBalanceAtRetirement:yearByYear[retIdx]?.closingBalance??0, taxFreeSavingsVsTaxable:taxableVsComparison, yearByYear, withdrawalStrategy: locale === "fr"
    ? (currentAge >= 55
        ? "Priorisez les retraits CELI pour compléter le revenu FERR et minimiser la récupération de la SV. Les retraits CELI n'augmentent pas le revenu net."
        : "Continuez à maximiser vos cotisations annuelles. Les retraits CELI créent des droits équivalents l'année civile suivante.")
    : (currentAge >= 55
        ? "Prioritize TFSA withdrawals to supplement RRIF income and minimize OAS clawback. TFSA withdrawals do not increase net income."
        : "Continue maximizing annual contributions. TFSA withdrawals create equivalent room the following calendar year."), optimalWithdrawalAge:65 };
}