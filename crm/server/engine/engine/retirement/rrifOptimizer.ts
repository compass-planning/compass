import { getCachedRrifFactor } from "../reference/loader";
import { calculateOasClawback } from "../reference/cppOas";

export interface WithdrawalPlan {
  rrifWithdrawal: number;
  tfsaWithdrawal: number;
  nonRegWithdrawal: number;
  totalWithdrawal: number;
  taxableIncome: number;
  oasClawback: number;
  mandatoryRrifMin: number;
  capitalGainInclusion: number;
  clawbackTriggered: boolean;
}

export interface AccountBalances {
  rrspRrifBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
}

export function calculateCapitalGainsTaxable(capitalGain: number): number {
  if (capitalGain <= 0) return 0;
  if (capitalGain <= 250000) {
    return capitalGain * 0.5;
  }
  return 250000 * 0.5 + (capitalGain - 250000) * 0.6667;
}

export function optimizeWithdrawals(
  age: number,
  balances: AccountBalances,
  desiredIncome: number,
  cppAnnual: number,
  oasAnnual: number,
  pensionIncome: number,
  _province: string,
  rrifConversionAge: number = 71
): WithdrawalPlan {
  const isRrifAge = age >= rrifConversionAge;
  const rrifFactor = isRrifAge ? getCachedRrifFactor(age) : 0;
  const mandatoryRrifMin = balances.rrspRrifBalance * rrifFactor;

  const guaranteedIncome = cppAnnual + oasAnnual + pensionIncome;
  const incomeNeeded = Math.max(0, desiredIncome - guaranteedIncome);

  let rrifWithdrawal = mandatoryRrifMin;
  let tfsaWithdrawal = 0;
  let nonRegWithdrawal = 0;

  let remaining = Math.max(0, incomeNeeded - rrifWithdrawal);

  const taxableAfterMandatory = guaranteedIncome + mandatoryRrifMin;
  const clawbackFromMandatory = calculateOasClawback(taxableAfterMandatory, oasAnnual);
  const clawbackTriggered = clawbackFromMandatory > 0;

  if (remaining > 0) {
    const tfsaDraw = Math.min(remaining, balances.tfsaBalance);
    tfsaWithdrawal = tfsaDraw;
    remaining -= tfsaDraw;
  }

  if (remaining > 0) {
    const nonRegDraw = Math.min(remaining, balances.nonRegBalance);
    nonRegWithdrawal = nonRegDraw;
    remaining -= nonRegDraw;
  }

  if (remaining > 0) {
    const extraRrif = Math.min(remaining, Math.max(0, balances.rrspRrifBalance - rrifWithdrawal));
    rrifWithdrawal += extraRrif;
    remaining -= extraRrif;
  }

  rrifWithdrawal = Math.min(rrifWithdrawal, balances.rrspRrifBalance);
  tfsaWithdrawal = Math.min(tfsaWithdrawal, balances.tfsaBalance);
  nonRegWithdrawal = Math.min(nonRegWithdrawal, balances.nonRegBalance);

  const totalWithdrawal = rrifWithdrawal + tfsaWithdrawal + nonRegWithdrawal;
  const capitalGainInclusion = calculateCapitalGainsTaxable(nonRegWithdrawal);
  const taxableIncome = guaranteedIncome + rrifWithdrawal + capitalGainInclusion;
  const oasClawback = calculateOasClawback(taxableIncome, oasAnnual);

  return {
    rrifWithdrawal,
    tfsaWithdrawal,
    nonRegWithdrawal,
    totalWithdrawal,
    taxableIncome,
    oasClawback,
    mandatoryRrifMin,
    capitalGainInclusion,
    clawbackTriggered,
  };
}

export function reshelterToTfsa(
  excessCash: number,
  tfsaAnnualRoom: number = 7000
): { tfsaContribution: number; remainingCash: number } {
  const contribution = Math.min(excessCash, tfsaAnnualRoom);
  return {
    tfsaContribution: contribution,
    remainingCash: excessCash - contribution,
  };
}
