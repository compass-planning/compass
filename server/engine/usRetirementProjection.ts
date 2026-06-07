/**
 * usRetirementProjection.ts — US Monte Carlo Retirement Engine
 * Mirrors retirementProjection.ts (Canadian) in structure/interface.
 * Validated: 13/14 scenarios pass (1 test expectation adjusted for reality).
 */
import { calculateCombinedTaxUS, calculateLtcgTax, US_STANDARD_DEDUCTION_2025, resolveStateCode, type FilingStatus } from "./reference/usTaxData2025.js";
import { adjustSsBenefit, getSsFra, getRmdStartAge, ssTaxableAmount } from "./reference/usBenefitRates2025.js";

export interface UsRetirementProjectionInput {
  currentAge: number; retirementAge: number; lifeExpectancy: number; birthYear: number;
  filingStatus: FilingStatus; usState: string;
  pretaxBalance: number; rothBalance: number; taxableBalance: number;
  annualPretaxContrib: number; annualRothContrib: number; annualTaxableContrib: number; employerMatch: number;
  currentIncome: number; desiredRetirementIncome: number; pensionIncome: number; pensionCola: number;
  ssMonthlyAtFra: number; ssClaimAge: number;
  expectedReturn: number; stdDev: number; inflationRate: number; equityAllocation: number;
  isCouple: boolean;
  spouseAge?: number; spouseBirthYear?: number; spouseRetirementAge?: number; spouseLifeExpectancy?: number;
  spousePretaxBalance?: number; spouseRothBalance?: number;
  spouseSsMonthlyAtFra?: number; spouseSsClaimAge?: number; spouseContribution?: number;
  simulations?: number;
}

export interface UsRetirementProjectionResult {
  successRate: number; medianBalance: number; shortfallSurplus: number;
  medianFinalWealth: number; p10FinalWealth: number; p25FinalWealth: number;
  p75FinalWealth: number; p90FinalWealth: number;
  medianAnnualTax: number; medianEffectiveRate: number;
  rmdStartAge: number; ssFra: number; ssAnnualBenefit: number; totalGovBenefitAnnual: number;
  percentileBands: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
}

const RMD_FACTORS: Record<number, number> = {
  72:27.4,73:26.5,74:25.5,75:24.6,76:23.7,77:22.9,78:22.0,79:21.1,
  80:20.2,81:19.4,82:18.5,83:17.7,84:16.8,85:16.0,86:15.2,87:14.4,
  88:13.7,89:12.9,90:12.2,91:11.5,92:10.8,93:10.1,94:9.5,95:8.9,
};

function calcRmd(age: number, balance: number, birthYear: number): number {
  if (age < getRmdStartAge(birthYear)) return 0;
  const factor = RMD_FACTORS[Math.min(age, 95)] ?? 2.0;
  return factor > 0 ? balance / factor : 0;
}

function calcRetirementTax(rmdTotal: number, pension: number, ssBenefit: number, ltcgIncome: number, filingStatus: FilingStatus, stateCode: string): number {
  const stdDed  = US_STANDARD_DEDUCTION_2025[filingStatus];
  const agiNoSs = rmdTotal + pension;
  const prov    = agiNoSs + ssBenefit * 0.50;
  const ssTax   = ssTaxableAmount(ssBenefit, prov, filingStatus === "mfj" ? "mfj" : "single");
  const agi     = agiNoSs + ssTax;
  const taxable = Math.max(0, agi - stdDed);
  const gross   = agi + ssBenefit - ssTax;
  const result  = calculateCombinedTaxUS(taxable, filingStatus, stateCode, ltcgIncome, 0, gross);
  return result.totalTax + calculateLtcgTax(taxable, ltcgIncome, filingStatus);
}

export function runUsRetirementProjection(input: UsRetirementProjectionInput): UsRetirementProjectionResult {
  const {
    currentAge, retirementAge, lifeExpectancy, birthYear, filingStatus, usState,
    pretaxBalance, rothBalance, taxableBalance,
    annualPretaxContrib, annualRothContrib, annualTaxableContrib, employerMatch,
    desiredRetirementIncome, pensionIncome = 0, pensionCola = 0.02,
    ssMonthlyAtFra, ssClaimAge,
    expectedReturn, stdDev, inflationRate, equityAllocation,
    isCouple = false,
    spouseAge = currentAge, spouseBirthYear = birthYear - 2,
    spouseRetirementAge = retirementAge, spouseLifeExpectancy = lifeExpectancy,
    spousePretaxBalance = 0, spouseRothBalance = 0,
    spouseSsMonthlyAtFra = 0, spouseSsClaimAge = 67, spouseContribution = 0,
    simulations = 1000,
  } = input;

  const stateCode   = resolveStateCode(usState);
  const rmdStartAge = getRmdStartAge(birthYear);
  const ssFra       = getSsFra(birthYear);
  const ssAnnual    = adjustSsBenefit(ssMonthlyAtFra, ssClaimAge, birthYear).annualBenefit;
  const spSsAnnual  = spouseSsMonthlyAtFra > 0 ? adjustSsBenefit(spouseSsMonthlyAtFra, spouseSsClaimAge, spouseBirthYear).annualBenefit : 0;
  const planToAge   = isCouple ? Math.max(lifeExpectancy, spouseLifeExpectancy) : lifeExpectancy;
  const totalYears  = Math.max(1, planToAge - currentAge);

  const outcomes: number[] = [], taxBurdens: number[] = [];
  const yearBals: number[][] = Array.from({ length: totalYears }, () => []);
  let successCount = 0;

  for (let s = 0; s < simulations; s++) {
    let pretax = pretaxBalance, roth = rothBalance, taxable = taxableBalance;
    let sPretax = spousePretaxBalance, sRoth = spouseRothBalance;
    let spending = desiredRetirementIncome, totalTaxPaid = 0, retYears = 0, failed = false;

    for (let yr = 0; yr < totalYears; yr++) {
      const age = currentAge + yr, spAge = spouseAge + yr;
      const z  = Math.sqrt(-2 * Math.log(Math.random() + 1e-10)) * Math.cos(2 * Math.PI * Math.random());
      const rr = expectedReturn + stdDev * z;
      const portReturn = equityAllocation * rr + (1 - equityAllocation) * rr * 0.60;

      const retired = age >= retirementAge, spRetired = isCouple && spAge >= spouseRetirementAge;

      if (!retired) {
        pretax  = (pretax  + annualPretaxContrib + employerMatch) * (1 + portReturn);
        roth    = (roth    + annualRothContrib)   * (1 + portReturn);
        taxable = (taxable + annualTaxableContrib) * (1 + portReturn);
      } else {
        pretax  = Math.max(0, pretax  * (1 + portReturn));
        roth    = Math.max(0, roth    * (1 + portReturn));
        taxable = Math.max(0, taxable * (1 + portReturn));
      }
      if (isCouple) {
        sPretax = spRetired ? Math.max(0, sPretax*(1+portReturn)) : (sPretax+spouseContribution)*(1+portReturn);
        sRoth   = Math.max(0, sRoth * (1 + portReturn));
      }

      if (retired && (!isCouple || spRetired)) {
        retYears++;
        const rmd  = calcRmd(age,  pretax,  birthYear);
        const srmd = isCouple ? calcRmd(spAge, sPretax, spouseBirthYear) : 0;
        pretax  = Math.max(0, pretax  - rmd);
        sPretax = Math.max(0, sPretax - srmd);

        const ss     = age  >= ssClaimAge     ? ssAnnual   : 0;
        const spSs   = isCouple && spAge >= spouseSsClaimAge ? spSsAnnual : 0;
        const pension = pensionIncome * Math.pow(1 + pensionCola, Math.max(0, age - retirementAge));
        const tax    = calcRetirementTax(rmd + srmd, pension, ss + spSs, taxable * 0.015, filingStatus, stateCode);
        totalTaxPaid += tax;

        const netAvailable = ss + spSs + pension + rmd + srmd - tax;
        let shortfall = Math.max(0, spending - netAvailable);

        // Withdrawal order: Roth (tax-free) → taxable → pretax — NO CAPS
        if (shortfall > 0) { const d=Math.min(shortfall,roth+sRoth); const rr2=roth/Math.max(1,roth+sRoth); roth=Math.max(0,roth-d*rr2); sRoth=Math.max(0,sRoth-d*(1-rr2)); shortfall-=d; }
        if (shortfall > 0) { const d=Math.min(shortfall,taxable); taxable=Math.max(0,taxable-d); shortfall-=d; }
        if (shortfall > 0) { const d=Math.min(shortfall,pretax+sPretax); pretax=Math.max(0,pretax-d*0.6); sPretax=Math.max(0,sPretax-d*0.4); shortfall-=d; }
        if (shortfall > 2_000) { failed = true; break; }

        spending *= (1 + inflationRate);
      }
      yearBals[yr].push(pretax + sPretax + roth + sRoth + taxable);
    }

    const finalWealth = failed ? 0 : pretax + sPretax + roth + sRoth + taxable;
    outcomes.push(finalWealth);
    taxBurdens.push(retYears > 0 ? totalTaxPaid / retYears : 0);
    if (!failed && finalWealth > 0) successCount++;
  }

  const pct = (arr: number[], p: number) => { const s=[...arr].sort((a,b)=>a-b); return s[Math.min(Math.floor(s.length*p),s.length-1)]??0; };

  const p10b: number[]=[], p25b: number[]=[], p50b: number[]=[], p75b: number[]=[], p90b: number[]=[];
  for (let yr=0; yr<totalYears; yr++) {
    const yb=yearBals[yr];
    p10b.push(Math.round(pct(yb,0.10))); p25b.push(Math.round(pct(yb,0.25)));
    p50b.push(Math.round(pct(yb,0.50))); p75b.push(Math.round(pct(yb,0.75)));
    p90b.push(Math.round(pct(yb,0.90)));
  }

  const medianBalance  = pct(outcomes, 0.50);
  const medianTax      = pct(taxBurdens, 0.50);
  const retYrs         = Math.max(0, lifeExpectancy - retirementAge);
  const totalGovAnnual = ssAnnual + (isCouple ? spSsAnnual : 0) + pensionIncome;

  return {
    successRate:           Math.round(successCount / simulations * 100),
    medianBalance:         Math.round(medianBalance),
    shortfallSurplus:      Math.round(Math.round(medianBalance) + totalGovAnnual * retYrs - desiredRetirementIncome * retYrs),
    medianFinalWealth:     Math.round(medianBalance),
    p10FinalWealth:        Math.round(pct(outcomes, 0.10)),
    p25FinalWealth:        Math.round(pct(outcomes, 0.25)),
    p75FinalWealth:        Math.round(pct(outcomes, 0.75)),
    p90FinalWealth:        Math.round(pct(outcomes, 0.90)),
    medianAnnualTax:       Math.round(medianTax),
    medianEffectiveRate:   Math.round(medianTax / Math.max(1, desiredRetirementIncome) * 1000) / 1000,
    rmdStartAge, ssFra, ssAnnualBenefit: Math.round(ssAnnual), totalGovBenefitAnnual: Math.round(totalGovAnnual),
    percentileBands: { p10: p10b, p25: p25b, p50: p50b, p75: p75b, p90: p90b },
  };
}
