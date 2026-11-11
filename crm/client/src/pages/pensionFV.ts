/**
 * pensionFV.ts — future-value estimate for defined-contribution style plans
 * (DCPP, Group RRSP, DPSP).
 *
 * Current balance grows at the average annual return until retirement. While the member
 * is still contributing, each year's contribution (employee + employer) is added at year
 * end from the contribution start age (or today, if that age is already past) until
 * retirement. Ticking "No longer contributing" stops future contributions and just grows
 * the existing balance.
 */
export interface DcInputs {
  balance: number;
  annualContribution: number;
  contributionStartAge: number | null;
  noLongerContributing: boolean;
  avgReturnPct: number | null;
  currentAge: number | null;
  retirementAge: number;
}

export interface DcResult {
  fv: number;
  yearsToRetirement: number;
  contributionYears: number;
}

export function ageFromDob(dob?: string | null): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (!Number.isFinite(t)) return null;
  const a = Math.floor((Date.now() - t) / (365.25 * 24 * 60 * 60 * 1000));
  return a > 0 && a < 120 ? a : null;
}

export function dcFutureValue(i: DcInputs): DcResult | null {
  if (i.avgReturnPct == null || !Number.isFinite(i.avgReturnPct) || i.currentAge == null) return null;
  const years = Math.max(0, i.retirementAge - i.currentAge);
  const r = i.avgReturnPct / 100;
  const grow = (n: number) => Math.pow(1 + r, n);
  let fv = (i.balance || 0) * grow(years);
  let cYears = 0;
  if (!i.noLongerContributing && i.annualContribution > 0) {
    const start = Math.max(i.contributionStartAge ?? i.currentAge, i.currentAge);
    cYears = Math.max(0, i.retirementAge - start);
    fv += r === 0 ? i.annualContribution * cYears : (i.annualContribution * (grow(cYears) - 1)) / r;
  }
  return { fv: Math.round(fv), yearsToRetirement: years, contributionYears: cYears };
}

/** Plan-row + client helper. Returns null when there isn't enough data (no return % or no DOB). */
export function planFutureValue(plan: any, client: any): DcResult | null {
  if (!plan || !["dcpp", "group_rrsp", "dpsp"].includes(plan.pensionType)) return null;
  if (plan.avgAnnualReturn == null || plan.avgAnnualReturn === "") return null;
  const spouse = plan.subscriberOwner === "spouse";
  const age = ageFromDob(spouse ? client?.spouseDateOfBirth : client?.dateOfBirth);
  return dcFutureValue({
    balance: Number(plan.currentBalance || 0),
    annualContribution: Number(plan.annualContribution || 0),
    contributionStartAge: plan.contributionStartAge ? Number(plan.contributionStartAge) : null,
    noLongerContributing: !!plan.noLongerContributing,
    avgReturnPct: Number(plan.avgAnnualReturn),
    currentAge: age,
    retirementAge: Number(plan.retirementAge || 65),
  });
}
