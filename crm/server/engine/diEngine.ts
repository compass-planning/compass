/**
 * diEngine.ts — Disability Income Planning Engine
 *
 * Models:
 *  - Income replacement ratio vs 70–85% Canadian standard
 *  - Own-occupation vs any-occupation claim probability by class
 *  - Group DI tax treatment (employer-paid = taxable benefit)
 *  - Individual DI tax treatment (personally-paid = tax-free)
 *  - CPP Disability benefit integration
 *  - Waiting period out-of-pocket cost
 *  - Partial disability / return-to-work benefit
 *  - COLA rider projection
 *  - Coverage gap calculation
 */

export type OccupationClass = '4A' | '3A' | '2A' | 'A' | 'B';
export type Definition      = 'own_occ' | 'any_occ' | 'regular';
export type BenefitPeriod   = '2yr' | '5yr' | '10yr' | 'age65' | 'age70';

export interface DIInput {
  // Personal
  currentAge:            number;
  province:              string;

  // Income
  grossMonthlyIncome:    number;

  // Occupation
  occupationClass:       OccupationClass;
  definition:            Definition;

  // Policy terms
  waitingPeriodDays:     number;
  benefitPeriod:         BenefitPeriod;

  // Existing coverage
  groupDiMonthly:        number;   // existing group DI monthly benefit
  groupDiEmployerPaid:   boolean;  // true = taxable on claim
  individualDiMonthly:   number;   // existing individual DI (tax-free if personally paid)
  cppDisabilityMonthly:  number;   // CPP-D benefit if applicable

  // Riders
  partialDisabilityPct:  number;   // income threshold for partial claim (e.g. 0.50)
  colaPct:               number;   // COLA rider annual rate (e.g. 0.02)
}

export interface DIResult {
  // Income targets
  grossMonthlyIncome:       number;
  targetMonthlyBenefit:     number;   // 70% of gross (Canadian standard floor)
  targetMonthlyBenefitHigh: number;   // 85% of gross (upper bound)

  // Existing coverage (after-tax)
  existing: {
    groupGross:             number;   // group DI monthly (gross)
    groupAfterTax:          number;   // group DI after provincial marginal tax
    individual:             number;   // individual DI (already tax-free)
    cppDisability:          number;   // CPP-D (taxable, net shown)
    totalAfterTax:          number;   // combined after-tax monthly benefit
  };

  // Gap analysis
  coverageGap:              number;   // target (70%) - existing after-tax (0 = adequate)
  coverageGapHigh:          number;   // target (85%) - existing after-tax
  replacementRatio:         number;   // existing / gross as percentage
  replacementRatioTarget:   number;   // 70% standard
  isAdequate:               boolean;  // replacement ratio >= 70%

  // Waiting period
  waitingPeriodCost:        number;   // monthly × (waiting days / 30)
  emergencyFundMonths:      number;   // months of emergency fund needed

  // Claim probability by definition
  claimProbability: {
    ownOcc:                 number;   // lifetime own-occ claim probability
    anyOcc:                 number;   // lifetime any-occ claim probability
    ownVsAnyGap:            number;   // income at risk if only any-occ covered
  };

  // Benefit period payout
  maxBenefit: {
    totalAtTarget:          number;   // total payout over benefit period at target rate
    yearsOfCoverage:        number;   // benefit period in years
  };

  // COLA projection
  cola: {
    benefitAtYear5:         number;   // monthly benefit after 5yr COLA
    benefitAtYear10:        number;   // monthly benefit after 10yr COLA
    addedValueAtYear10:     number;   // extra cumulative value from COLA vs no COLA
  };

  // Partial disability
  partialDisability: {
    triggerIncomeThreshold: number;   // monthly income below which partial triggers
    partialBenefit:         number;   // proportional monthly benefit during partial claim
  };

  // Tax treatment narrative
  taxTreatment: {
    groupTaxable:           boolean;
    groupEffectiveRate:     number;   // provincial marginal rate on group benefit
    individualTaxFree:      boolean;
    recommendation:         string;   // advisor talking point
  };
}

// ── Occupation class data ─────────────────────────────────────────────────────
// Source: CLHIA claims experience, Canadian insurance industry actuarial tables

const OCC_DATA: Record<OccupationClass, {
  ownOccProb: number; anyOccProb: number; typical: string;
}> = {
  '4A': { ownOccProb: 0.32, anyOccProb: 0.12, typical: "Physicians, dentists, lawyers, accountants" },
  '3A': { ownOccProb: 0.35, anyOccProb: 0.15, typical: "Financial advisors, engineers, managers, pharmacists" },
  '2A': { ownOccProb: 0.38, anyOccProb: 0.18, typical: "Teachers, nurses, office supervisors" },
  'A':  { ownOccProb: 0.44, anyOccProb: 0.24, typical: "Skilled trades, technicians, mechanics" },
  'B':  { ownOccProb: 0.52, anyOccProb: 0.32, typical: "Heavy labour, construction, manual workers" },
};

// ── Benefit period in years ───────────────────────────────────────────────────

function benefitPeriodYears(period: BenefitPeriod, currentAge: number): number {
  switch (period) {
    case '2yr':   return 2;
    case '5yr':   return 5;
    case '10yr':  return 10;
    case 'age65': return Math.max(1, 65 - currentAge);
    case 'age70': return Math.max(1, 70 - currentAge);
    default:      return 5;
  }
}

// ── Provincial marginal tax rate (simplified, for group DI tax calc) ──────────
// Using combined federal + provincial top marginal rate on ~$60-80K income

function marginalTaxRate(province: string): number {
  const rates: Record<string, number> = {
    AB: 0.30, BC: 0.33, MB: 0.37, NB: 0.35, NL: 0.35,
    NS: 0.37, NT: 0.29, NU: 0.29, ON: 0.33, PE: 0.35,
    QC: 0.40, SK: 0.33, YT: 0.30,
  };
  return rates[province.toUpperCase()] ?? 0.33;
}

// ── Main engine ───────────────────────────────────────────────────────────────

export function runDIEngine(input: DIInput): DIResult {
  const {
    currentAge, province, grossMonthlyIncome,
    occupationClass, definition,
    waitingPeriodDays, benefitPeriod,
    groupDiMonthly, groupDiEmployerPaid,
    individualDiMonthly, cppDisabilityMonthly,
    partialDisabilityPct, colaPct,
  } = input;

  const mtr = marginalTaxRate(province);

  // ── Income targets ────────────────────────────────────────────────────────
  const targetMonthlyBenefit     = Math.round(grossMonthlyIncome * 0.70);
  const targetMonthlyBenefitHigh = Math.round(grossMonthlyIncome * 0.85);

  // ── Existing coverage — after-tax ─────────────────────────────────────────
  // Group DI: taxable if employer paid premiums
  const groupAfterTax    = groupDiEmployerPaid
    ? Math.round(groupDiMonthly * (1 - mtr))
    : groupDiMonthly;  // employee-paid = tax-free

  // CPP-D: taxable income, apply marginal rate
  const cppDAfterTax     = Math.round(cppDisabilityMonthly * (1 - mtr));

  // Individual DI: tax-free if personally paid (the norm for individual policies)
  const totalAfterTax    = groupAfterTax + individualDiMonthly + cppDAfterTax;

  // ── Gap analysis ──────────────────────────────────────────────────────────
  const coverageGap      = Math.max(0, targetMonthlyBenefit     - totalAfterTax);
  const coverageGapHigh  = Math.max(0, targetMonthlyBenefitHigh - totalAfterTax);
  const replacementRatio = grossMonthlyIncome > 0
    ? Math.round((totalAfterTax / grossMonthlyIncome) * 100) : 0;
  const isAdequate       = replacementRatio >= 70;

  // ── Waiting period out-of-pocket ──────────────────────────────────────────
  const waitingMonths       = waitingPeriodDays / 30;
  const waitingPeriodCost   = Math.round(grossMonthlyIncome * waitingMonths);
  const emergencyFundMonths = Math.ceil(waitingMonths + 1);  // +1 buffer month

  // ── Claim probability ─────────────────────────────────────────────────────
  const occData = OCC_DATA[occupationClass] ?? OCC_DATA['3A'];
  const activeProb = definition === 'own_occ' ? occData.ownOccProb : occData.anyOccProb;
  const ownVsAnyGap = definition === 'own_occ'
    ? 0
    : Math.round(grossMonthlyIncome * (occData.ownOccProb - occData.anyOccProb) * 12); // annualized income at risk

  // ── Benefit period payout ─────────────────────────────────────────────────
  const bpYears        = benefitPeriodYears(benefitPeriod, currentAge);
  const totalAtTarget  = Math.round(coverageGap * 12 * bpYears);

  // ── COLA projection ───────────────────────────────────────────────────────
  const benefitAtYear5  = Math.round(coverageGap * Math.pow(1 + colaPct, 5));
  const benefitAtYear10 = Math.round(coverageGap * Math.pow(1 + colaPct, 10));
  // Extra value: sum of COLA increases over 10 years vs flat benefit
  let addedValue = 0;
  for (let yr = 1; yr <= 10; yr++) {
    addedValue += Math.round(coverageGap * Math.pow(1 + colaPct, yr)) - coverageGap;
  }
  addedValue = Math.round(addedValue * 12); // annualized × 12 months

  // ── Partial disability ────────────────────────────────────────────────────
  const triggerIncomeThreshold = Math.round(grossMonthlyIncome * partialDisabilityPct);
  // Proportional benefit: (lost income / gross) × full benefit
  const partialBenefit = Math.round(
    ((grossMonthlyIncome - triggerIncomeThreshold) / grossMonthlyIncome) * coverageGap
  );

  // ── Tax treatment recommendation ──────────────────────────────────────────
  let recommendation = "";
  if (groupDiMonthly > 0 && groupDiEmployerPaid && individualDiMonthly === 0) {
    recommendation = `Group DI benefit of $${groupDiMonthly.toLocaleString()}/mo is fully taxable on claim `
      + `(employer-paid premiums). After ${Math.round(mtr * 100)}% tax the net benefit is `
      + `$${groupAfterTax.toLocaleString()}/mo — ${Math.round(100 - (groupAfterTax / groupDiMonthly) * 100)}% less `
      + `than the face amount. Individual DI is recommended to fill this gap tax-free.`;
  } else if (individualDiMonthly > 0 && groupDiMonthly === 0) {
    recommendation = `Individual DI of $${individualDiMonthly.toLocaleString()}/mo is tax-free on claim `
      + `(personally-paid premiums). This provides full value without any tax erosion.`;
  } else if (groupDiMonthly > 0 && !groupDiEmployerPaid) {
    recommendation = `Group DI premiums are employee-paid, so the benefit is tax-free on claim. `
      + `This is the most favourable group DI arrangement.`;
  } else {
    recommendation = `Review whether group DI premiums are employer or employee-paid — this `
      + `determines whether the benefit is taxable, which can reduce effective coverage by `
      + `${Math.round(mtr * 100)}% in ${province}.`;
  }

  return {
    grossMonthlyIncome,
    targetMonthlyBenefit,
    targetMonthlyBenefitHigh,
    existing: {
      groupGross:    groupDiMonthly,
      groupAfterTax,
      individual:    individualDiMonthly,
      cppDisability: cppDAfterTax,
      totalAfterTax,
    },
    coverageGap,
    coverageGapHigh,
    replacementRatio,
    replacementRatioTarget: 70,
    isAdequate,
    waitingPeriodCost,
    emergencyFundMonths,
    claimProbability: {
      ownOcc:       occData.ownOccProb,
      anyOcc:       occData.anyOccProb,
      ownVsAnyGap,
    },
    maxBenefit: {
      totalAtTarget,
      yearsOfCoverage: bpYears,
    },
    cola: {
      benefitAtYear5,
      benefitAtYear10,
      addedValueAtYear10: addedValue,
    },
    partialDisability: {
      triggerIncomeThreshold,
      partialBenefit,
    },
    taxTreatment: {
      groupTaxable:       groupDiMonthly > 0 && groupDiEmployerPaid,
      groupEffectiveRate: mtr,
      individualTaxFree:  true,
      recommendation,
    },
  };
}
