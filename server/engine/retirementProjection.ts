/**
 * server/engine/retirementProjection.ts
 *
 * Canadian retirement projection engine — Monte Carlo simulation for
 * household retirement planning including CPP/OAS, pension income,
 * and spouse/couple support.
 *
 * Used by:
 *   - POST /api/clients/:id/retirement-projections  (financial.ts)
 *   - POST /api/reports/:id/retirement              (reports.ts)
 */

export interface RetirementProjectionInput {
  // Primary member
  currentAge:           number;
  retirementAge:        number;
  lifeExpectancy:       number;
  currentSavings:       number;
  annualContribution:   number;
  desiredIncome:        number;
  expectedReturn:       number;   // as decimal e.g. 0.07
  inflationRate:        number;   // as decimal e.g. 0.02
  cppStartAge:          number;
  pensionIncome:        number;   // annual DB/DC pension income

  // Spouse (optional — set isCouple = false to ignore)
  isCouple:             boolean;
  spouseAge?:           number;
  spouseRetirementAge?: number;
  spouseLifeExpectancy?:number;
  spouseSavings?:       number;
  spouseContribution?:  number;
  spousePensionIncome?: number;
  spouseCppStartAge?:   number;

  // Simulation parameters
  simulations?:         number;   // default 1000
  stdDev?:              number;   // annual return std dev, default 0.10
}

export interface RetirementProjectionResult {
  successRate:      number;   // 0-100 percentage
  medianBalance:    number;   // median projected portfolio balance at retirement
  shortfallSurplus: number;   // positive = surplus, negative = shortfall
  pensionIncome:    number;   // annual pension income used in simulation
}

const CPP_ANNUAL_DEFAULT = 900 * 12;   // $10,800/yr — approximate average CPP
const OAS_ANNUAL_DEFAULT = 700 * 12;   // $8,400/yr  — approximate OAS

export function runRetirementProjection(
  input: RetirementProjectionInput
): RetirementProjectionResult {
  const {
    currentAge, retirementAge, lifeExpectancy,
    currentSavings, annualContribution, desiredIncome,
    expectedReturn, inflationRate, cppStartAge, pensionIncome,
    isCouple,
    spouseAge       = currentAge,
    spouseRetirementAge   = retirementAge,
    spouseLifeExpectancy  = lifeExpectancy,
    spouseSavings         = 0,
    spouseContribution    = 0,
    spousePensionIncome   = 0,
    spouseCppStartAge     = 65,
    simulations           = 1000,
    stdDev                = 0.10,
  } = input;

  const planToAge  = isCouple ? Math.max(lifeExpectancy, spouseLifeExpectancy) : lifeExpectancy;
  const totalYears = Math.max(1, planToAge - currentAge);

  const outcomes: number[] = [];
  let successCount = 0;

  for (let s = 0; s < simulations; s++) {
    let balPrimary = currentSavings;
    let balSpouse  = isCouple ? spouseSavings : 0;
    let spending   = desiredIncome;

    for (let yr = 0; yr < totalYears; yr++) {
      const age   = currentAge + yr;
      const spAge = spouseAge  + yr;

      // Box-Muller normal variate for return
      const z  = Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
      const rr = expectedReturn + stdDev * z;

      const primRetired   = age  >= retirementAge;
      const spouseRetired = isCouple && spAge >= spouseRetirementAge;

      // Accumulation / decumulation
      if (!primRetired) balPrimary = (balPrimary + annualContribution) * (1 + rr);
      else              balPrimary = Math.max(0, balPrimary * (1 + rr));

      if (isCouple) {
        if (!spouseRetired) balSpouse = (balSpouse + spouseContribution) * (1 + rr);
        else                balSpouse = Math.max(0, balSpouse * (1 + rr));
      }

      const bothRetired = primRetired && (!isCouple || spouseRetired);
      if (bothRetired) {
        const cpp  = age  >= cppStartAge      ? CPP_ANNUAL_DEFAULT : 0;
        const oas  = age  >= cppStartAge      ? OAS_ANNUAL_DEFAULT : 0;
        const scpp = isCouple && spAge >= spouseCppStartAge ? CPP_ANNUAL_DEFAULT : 0;
        const soas = isCouple && spAge >= spouseCppStartAge ? OAS_ANNUAL_DEFAULT : 0;

        const totalGov    = cpp + oas + scpp + soas + pensionIncome + (isCouple ? spousePensionIncome : 0);
        const combinedPool = balPrimary + balSpouse;
        const netWithdraw  = Math.max(0, spending - totalGov);
        const ratio        = combinedPool > 0 ? balPrimary / combinedPool : 0.5;

        balPrimary = Math.max(0, balPrimary - netWithdraw * ratio);
        balSpouse  = Math.max(0, balSpouse  - netWithdraw * (1 - ratio));
        spending  *= (1 + inflationRate);
      }
    }

    const finalBal = balPrimary + (isCouple ? balSpouse : 0);
    outcomes.push(finalBal);
    if (finalBal > 0) successCount++;
  }

  // Results
  const sorted        = [...outcomes].sort((a, b) => a - b);
  const median        = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const retYears      = Math.max(0, planToAge - retirementAge);
  const totalCpp      = (isCouple ? 2 : 1) * CPP_ANNUAL_DEFAULT;
  const totalOas      = (isCouple ? 2 : 1) * OAS_ANNUAL_DEFAULT;
  const totalPension  = pensionIncome + (isCouple ? spousePensionIncome : 0);
  const projectedTotal = Math.round(median) + (totalCpp + totalOas + totalPension) * retYears;
  const desiredTotal   = desiredIncome * retYears;

  return {
    successRate:      Math.round((successCount / simulations) * 100),
    medianBalance:    Math.round(median),
    shortfallSurplus: Math.round(projectedTotal - desiredTotal),
    pensionIncome,
  };
}
