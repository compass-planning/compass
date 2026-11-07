/**
 * canadianRetirementEngine.ts
 *
 * Proper Canadian retirement projection engine:
 *  - RRSP → RRIF mandatory conversion at 71 with CRA minimum withdrawal rates
 *  - Separate RRSP / TFSA / Non-Registered account tracking
 *  - Non-registered income type handling (capital gains vs interest vs insurance annuity)
 *  - CPP actuarial adjustment (−0.6%/mo before 65, +0.7%/mo after 65)
 *  - OAS actuarial adjustment (+0.6%/mo after 65, max deferral 70)
 *  - OAS clawback above $90,997 net income
 *  - Federal + provincial tax by province (2024 rates)
 *  - Year-by-year output for comparison panel and reporting
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type NonRegTaxType =
  | 'capital_gains'       // Stocks, ETFs, real estate → 50% inclusion on realized gains
  | 'interest'            // GICs, bonds, savings → 100% taxable income each year
  | 'mutual_fund'         // Mutual funds, no capital gains treatment → 100% taxable on growth
  | 'insurance_annuity'   // Prescribed annuity from insurer → only interest portion taxable
  | 'mixed';              // Default blend: 60% interest, 40% capital gains treatment

export type Province = 'AB' | 'BC' | 'MB' | 'NB' | 'NL' | 'NS' | 'ON' | 'PE' | 'QC' | 'SK' | 'NT' | 'NU' | 'YT';

export interface EngineInput {
  // Personal
  currentAge:              number;
  retirementAge:           number;
  lifeExpectancy:          number;
  province:                Province;

  // Account balances TODAY (start of projection)
  rrspBalance:             number;
  tfsaBalance:             number;
  nonRegBalance:           number;
  nonRegTaxType:           NonRegTaxType;
  nonRegAcb:               number;   // adjusted cost base (for capital_gains type)

  // Contributions (annual, in today's $)
  annualRrspContrib:       number;
  annualTfsaContrib:       number;

  // Income sources (in today's $)
  desiredRetirementIncome: number;   // after-tax annual income desired
  pensionAnnual:           number;   // DB/DC pension annual income
  pensionStartAge:         number;
  pensionIndexed:          boolean;  // true = CPI-indexed
  bridgeBenefitAnnual:     number;
  bridgeBenefitEndAge:     number;

  // CPP & OAS (today's monthly amounts at their respective start ages)
  cppMonthly:              number;
  cppStartAge:             number;   // 60-70
  oasMonthly:              number;
  oasStartAge:             number;   // 65-70

  // Assumptions
  expectedReturnPct:       number;   // e.g. 6.5 (stored as 6.5, not 0.065)
  inflationPct:            number;   // e.g. 2.0
}

export interface YearResult {
  age:               number;
  year:              number;
  phase:             'accumulation' | 'early_retirement' | 'rrif';

  // Account balances (end of year)
  rrspBalance:       number;
  tfsaBalance:       number;
  nonRegBalance:     number;
  totalPortfolio:    number;

  // Income (in nominal/future $)
  employmentIncome:  number;
  cppIncome:         number;
  oasIncome:         number;
  oasClawback:       number;
  pensionIncome:     number;
  bridgeIncome:      number;
  rrifWithdrawal:    number;   // mandatory minimum
  rrifExtra:         number;   // voluntary above minimum
  tfsaWithdrawal:    number;
  nonRegWithdrawal:  number;
  totalGrossIncome:  number;

  // Tax (in nominal $)
  taxableIncome:     number;
  federalTax:        number;
  provincialTax:     number;
  totalTax:          number;
  netAfterTaxIncome: number;

  // Plan metrics
  desiredSpendingNominal: number;
  surplus:           number;   // netAfterTaxIncome − desiredSpendingNominal
  fundingPct:        number;   // netAfterTaxIncome / desiredSpendingNominal × 100
}

export interface EngineResult {
  yearByYear:        YearResult[];
  summary: {
    portfolioAtRetirement:   number;
    rrspAtRetirement:        number;
    tfsaAtRetirement:        number;
    nonRegAtRetirement:      number;
    estateValueAtDeath:      number;
    lifetimeTaxPaid:         number;
    avgAnnualTaxInRetirement:number;
    annualSurplusAtRetirement: number;
    fundingRateAtRetirement: number;
    rrifStartBalance:        number;
    rrifMinYear1:            number;
    cppAnnualAtStart:        number;
    oasAnnualAtStart:        number;
    guaranteedIncomeAtRet:   number;  // CPP+OAS+Pension at retirement
  };
}

// ── CRA RRIF Minimum Withdrawal Rates (2024) ──────────────────────────────────

const RRIF_FACTORS: Record<number, number> = {
  65: 0.04000,  66: 0.04167,  67: 0.04348,  68: 0.04545,  69: 0.04762,
  70: 0.05000,
  71: 0.05280,  72: 0.05400,  73: 0.05530,  74: 0.05670,  75: 0.05820,
  76: 0.05980,  77: 0.06170,  78: 0.06360,  79: 0.06580,  80: 0.06820,
  81: 0.07080,  82: 0.07380,  83: 0.07710,  84: 0.08080,  85: 0.08510,
  86: 0.08990,  87: 0.09550,  88: 0.10210,  89: 0.10990,  90: 0.11920,
  91: 0.13060,  92: 0.14490,  93: 0.16340,  94: 0.18790,
};

function getRRIFRate(age: number): number {
  if (age < 65) return 1 / Math.max(1, 90 - age);  // pre-RRIF formula
  if (age >= 95) return 0.2000;
  return RRIF_FACTORS[age] ?? 0.2000;
}

// ── CPP & OAS Actuarial Adjustments ──────────────────────────────────────────

function cppFactor(startAge: number): number {
  // Before 65: -0.6% per month (max at 60: -36%)
  // After 65: +0.7% per month (max at 70: +42%)
  if (startAge <= 60) return 0.64;
  if (startAge < 65)  return 1 - 0.006 * (65 - startAge) * 12;
  if (startAge >= 70) return 1.42;
  return 1 + 0.007 * (startAge - 65) * 12;
}

function oasFactor(startAge: number): number {
  // Before 65: not available
  // After 65: +0.6% per month (max at 70: +36%)
  if (startAge <= 65) return 1.0;
  if (startAge >= 70) return 1.36;
  return 1 + 0.006 * (startAge - 65) * 12;
}

// ── Tax Calculation (2024 Rates) ──────────────────────────────────────────────

interface TaxBracket { ceiling: number; rate: number; }

const FEDERAL_BRACKETS: TaxBracket[] = [
  { ceiling:  55867, rate: 0.1500 },
  { ceiling: 111733, rate: 0.2050 },
  { ceiling: 154906, rate: 0.2600 },
  { ceiling: 220000, rate: 0.2900 },
  { ceiling: Infinity, rate: 0.3300 },
];

const PROVINCIAL_BRACKETS: Record<Province, TaxBracket[]> = {
  ON: [
    { ceiling:  51446, rate: 0.0505 },
    { ceiling: 102894, rate: 0.0915 },
    { ceiling: 150000, rate: 0.1116 },
    { ceiling: 220000, rate: 0.1216 },
    { ceiling: Infinity, rate: 0.1316 },
  ],
  QC: [
    { ceiling:  51780, rate: 0.1400 },
    { ceiling: 103545, rate: 0.1900 },
    { ceiling: 126000, rate: 0.2400 },
    { ceiling: Infinity, rate: 0.2575 },
  ],
  BC: [
    { ceiling:  45654, rate: 0.0506 },
    { ceiling:  91310, rate: 0.0770 },
    { ceiling: 104835, rate: 0.1050 },
    { ceiling: 127299, rate: 0.1229 },
    { ceiling: 172602, rate: 0.1470 },
    { ceiling: 240716, rate: 0.1680 },
    { ceiling: Infinity, rate: 0.2050 },
  ],
  AB: [
    { ceiling: 148269, rate: 0.1000 },
    { ceiling: 177922, rate: 0.1200 },
    { ceiling: 237230, rate: 0.1300 },
    { ceiling: 355845, rate: 0.1400 },
    { ceiling: Infinity, rate: 0.1500 },
  ],
  SK: [
    { ceiling:  49720, rate: 0.1050 },
    { ceiling: 142058, rate: 0.1250 },
    { ceiling: Infinity, rate: 0.1450 },
  ],
  MB: [
    { ceiling:  36842, rate: 0.1080 },
    { ceiling:  79625, rate: 0.1275 },
    { ceiling: Infinity, rate: 0.1740 },
  ],
  NB: [
    { ceiling:  47715, rate: 0.0940 },
    { ceiling:  95431, rate: 0.1482 },
    { ceiling: 176756, rate: 0.1652 },
    { ceiling: Infinity, rate: 0.1984 },
  ],
  NS: [
    { ceiling:  29590, rate: 0.0879 },
    { ceiling:  59180, rate: 0.1495 },
    { ceiling:  93000, rate: 0.1667 },
    { ceiling: 150000, rate: 0.1750 },
    { ceiling: Infinity, rate: 0.2100 },
  ],
  NL: [
    { ceiling:  43198, rate: 0.0870 },
    { ceiling:  86395, rate: 0.1450 },
    { ceiling: 154244, rate: 0.1580 },
    { ceiling: 215943, rate: 0.1780 },
    { ceiling: 275870, rate: 0.1980 },
    { ceiling: Infinity, rate: 0.2080 },
  ],
  PE: [
    { ceiling:  32656, rate: 0.0965 },
    { ceiling:  64313, rate: 0.1363 },
    { ceiling: 105000, rate: 0.1665 },
    { ceiling: 140000, rate: 0.1800 },
    { ceiling: Infinity, rate: 0.1875 },
  ],
  NT: [{ ceiling:  50597, rate: 0.0590 }, { ceiling: 101198, rate: 0.0860 }, { ceiling: 164525, rate: 0.1220 }, { ceiling: Infinity, rate: 0.1405 }],
  NU: [{ ceiling:  53268, rate: 0.0400 }, { ceiling: 106537, rate: 0.0700 }, { ceiling: 173205, rate: 0.0900 }, { ceiling: Infinity, rate: 0.1150 }],
  YT: [{ ceiling:  55867, rate: 0.0640 }, { ceiling: 111733, rate: 0.0900 }, { ceiling: 500000, rate: 0.1090 }, { ceiling: Infinity, rate: 0.1280 }],
};

function applyBrackets(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  let prev = 0;
  for (const b of brackets) {
    if (income <= prev) break;
    const taxable = Math.min(income, b.ceiling) - prev;
    tax += taxable * b.rate;
    prev = b.ceiling;
  }
  return tax;
}

function federalPersonalCredit(age: number, income: number): number {
  const bpa = 15705;
  let credit = bpa * 0.15;  // basic personal amount
  // Age credit: $8,790 at 15%, reduced above $42,335 at 15%
  if (age >= 65) {
    const ageAmount = Math.max(0, 8790 - Math.max(0, (income - 42335) * 0.15));
    credit += ageAmount * 0.15;
  }
  // Pension income credit (up to $2,000 × 15%)
  return credit;
}

function provincialPersonalCredit(province: Province, age: number): number {
  const bpa: Record<Province, number> = {
    ON: 11865, QC: 17183, BC: 11981, AB: 21003, SK: 17661, MB: 15780,
    NB: 12458, NS: 8481, NL: 10818, PE: 12000, NT: 16593, NU: 17925, YT: 15705,
  };
  const rate: Record<Province, number> = {
    ON: 0.0505, QC: 0.14, BC: 0.0506, AB: 0.10, SK: 0.105, MB: 0.108,
    NB: 0.094, NS: 0.0879, NL: 0.087, PE: 0.0965, NT: 0.059, NU: 0.04, YT: 0.064,
  };
  const b = bpa[province] ?? 12000;
  const r = rate[province] ?? 0.10;
  let credit = b * r;
  // Age credit for most provinces (simplified: 50% of federal age credit value)
  if (age >= 65) credit += 800 * r;
  return credit;
}

/** Full income tax: federal + provincial, after basic/age credits */
function calcTax(taxableIncome: number, age: number, province: Province): {
  federal: number; provincial: number; total: number;
} {
  if (taxableIncome <= 0) return { federal: 0, provincial: 0, total: 0 };

  const fedGross = applyBrackets(taxableIncome, FEDERAL_BRACKETS);
  const fedCredit = federalPersonalCredit(age, taxableIncome);
  const federal = Math.max(0, fedGross - fedCredit);

  const provBrackets = PROVINCIAL_BRACKETS[province] ?? PROVINCIAL_BRACKETS.ON;
  const provGross = applyBrackets(taxableIncome, provBrackets);
  const provCredit = provincialPersonalCredit(province, age);

  // Ontario surtax
  let provExtra = 0;
  if (province === 'ON') {
    const basicTax = Math.max(0, provGross - provCredit);
    if (basicTax > 6802) provExtra = (basicTax - 6802) * 0.36 + (Math.min(basicTax, 6802) - 5315) * 0.20;
    else if (basicTax > 5315) provExtra = (basicTax - 5315) * 0.20;
  }

  const provincial = Math.max(0, provGross - provCredit) + provExtra;
  return { federal, provincial, total: federal + provincial };
}

// ── OAS Clawback (2024) ───────────────────────────────────────────────────────

const OAS_CLAWBACK_THRESHOLD = 90997;  // 2024 threshold, net income
const OAS_CLAWBACK_RATE      = 0.15;

function oasClawback(netIncome: number, oasGross: number): number {
  if (netIncome <= OAS_CLAWBACK_THRESHOLD) return 0;
  return Math.min(oasGross, (netIncome - OAS_CLAWBACK_THRESHOLD) * OAS_CLAWBACK_RATE);
}

// ── Non-Registered Tax Logic ──────────────────────────────────────────────────

/**
 * Returns annual taxable income attributable to non-reg growth.
 * For capital gains: taxes on REALIZED gains at withdrawal only (not annual).
 * For interest/mutual_fund: taxes on growth each year (annual accrual).
 * For insurance_annuity: only the "income" portion is taxable (CRA prescribed annuity).
 */
function nonRegAnnualTaxableIncome(
  growth:      number,   // nominal growth this year
  withdrawal:  number,   // amount withdrawn from non-reg
  balance:     number,   // balance at start of year
  acb:         number,   // adjusted cost base
  type:        NonRegTaxType,
): { taxableIncome: number; newAcb: number } {
  switch (type) {
    case 'capital_gains': {
      // Growth is NOT taxed annually — only realized at disposition
      // When withdrawing, capital gain = withdrawal × (balance - acb) / balance
      if (withdrawal <= 0 || balance <= 0) return { taxableIncome: 0, newAcb: acb };
      const gainRatio    = Math.max(0, balance - acb) / balance;
      const capitalGain  = withdrawal * gainRatio;
      const taxable      = capitalGain * 0.5;  // 50% inclusion
      const newAcb       = acb * (1 - withdrawal / balance); // reduce ACB proportionally
      return { taxableIncome: Math.round(taxable), newAcb: Math.round(Math.max(0, newAcb)) };
    }
    case 'interest':
    case 'mutual_fund': {
      // Annual income accrual — 100% of growth is taxable each year
      return { taxableIncome: Math.round(Math.max(0, growth)), newAcb: acb };
    }
    case 'insurance_annuity': {
      // Prescribed annuity: approximately 50% of payment is return of capital (tax-free)
      // Only the income portion (50%) is taxable — regardless of growth rate
      const taxable = Math.round(Math.max(0, growth) * 0.50);
      return { taxableIncome: taxable, newAcb: acb };
    }
    case 'mixed':
    default: {
      // Blend: 60% interest treatment, 40% capital gains
      const interestTaxable = growth * 0.60;
      if (withdrawal > 0 && balance > 0) {
        const gainRatio   = Math.max(0, balance - acb) / balance;
        const capGainTax  = withdrawal * gainRatio * 0.4 * 0.5;
        const newAcb      = acb * (1 - withdrawal / balance);
        return {
          taxableIncome: Math.round(interestTaxable + capGainTax),
          newAcb: Math.round(Math.max(0, newAcb)),
        };
      }
      return { taxableIncome: Math.round(interestTaxable), newAcb: acb };
    }
  }
}

// ── Main Projection Engine ────────────────────────────────────────────────────

export function runCanadianProjection(input: EngineInput): EngineResult {
  const {
    currentAge, retirementAge, lifeExpectancy, province,
    rrspBalance, tfsaBalance, nonRegBalance, nonRegTaxType, nonRegAcb: initialAcb,
    annualRrspContrib, annualTfsaContrib,
    desiredRetirementIncome,
    pensionAnnual, pensionStartAge, pensionIndexed,
    bridgeBenefitAnnual, bridgeBenefitEndAge,
    cppMonthly, cppStartAge,
    oasMonthly, oasStartAge,
    expectedReturnPct, inflationPct,
  } = input;

  const rate = expectedReturnPct / 100;
  const infl = inflationPct      / 100;
  const currentYear = new Date().getFullYear();

  // Actuarially adjusted CPP/OAS in today's dollars at their start ages
  const cppAdjMonthly = cppMonthly * cppFactor(cppStartAge);
  const oasAdjMonthly = oasMonthly * oasFactor(oasStartAge);
  const cppAdjAnnual  = cppAdjMonthly * 12;
  const oasAdjAnnual  = oasAdjMonthly * 12;

  let rrsp   = rrspBalance;
  let tfsa   = tfsaBalance;
  let nonReg = nonRegBalance;
  let acb    = initialAcb;
  let isRRIF = false;

  // Track RRIF mandatory withdrawals vs optional
  const yearByYear: YearResult[] = [];

  // Summary accumulators
  let lifetimeTax = 0;
  let retirementPortfolio = 0;
  let rrspAtRet = 0, tfsaAtRet = 0, nonRegAtRet = 0;
  let surplusAtRet = 0, fundingAtRet = 0;
  let taxInRetirement = 0, retirementYearCount = 0;
  let rrifStartBal = 0, rrifMinY1 = 0;
  let cppAtRet = 0, oasAtRet = 0, guaranteedAtRet = 0;

  for (let yr = 0; yr <= lifeExpectancy - currentAge; yr++) {
    const age  = currentAge + yr;
    const year = currentYear + yr;
    const yearsFromNow = yr;

    // Inflation multiplier (nominal values) — how much a today's-$ amount is worth in this year
    const nominalMult = Math.pow(1 + infl, yearsFromNow);

    const isRetired = age >= retirementAge;
    const phase: YearResult['phase'] = !isRetired ? 'accumulation'
      : age < 71 ? 'early_retirement' : 'rrif';

    // ── Convert RRSP to RRIF at 71 ──────────────────────────────────────────
    if (age === 71 && !isRRIF) {
      isRRIF     = true;
      rrifStartBal = Math.round(rrsp);
      rrifMinY1    = Math.round(rrsp * getRRIFRate(71));
    }

    // ── Government & pension income (nominal $) ──────────────────────────────
    const cppNom = age >= cppStartAge
      ? cppAdjAnnual * nominalMult : 0;
    const oasNomGross = age >= oasStartAge
      ? oasAdjAnnual * nominalMult : 0;
    const pensionNom = age >= pensionStartAge
      ? pensionAnnual * (pensionIndexed ? nominalMult : 1) : 0;
    const bridgeNom = age < bridgeBenefitEndAge && bridgeBenefitAnnual > 0
      ? bridgeBenefitAnnual * nominalMult : 0;

    // ── Employment income ───────────────────────────────────────────────────
    const empNom = !isRetired ? 0 : 0;  // no employment income in retirement for projection

    // ── RRIF mandatory withdrawal ────────────────────────────────────────────
    let rrifMin    = 0;
    let rrifExtra  = 0;
    let tfsaDraw   = 0;
    let nonRegDraw = 0;

    // ── Desired spending in nominal $ ────────────────────────────────────────
    const desiredNom = isRetired ? desiredRetirementIncome * nominalMult : 0;

    if (isRetired) {
      if (isRRIF) {
        rrifMin = Math.min(rrsp, rrsp * getRRIFRate(age));  // mandatory
      }

      // Total guaranteed income at this year
      const guaranteedNom = cppNom + oasNomGross + pensionNom + bridgeNom + rrifMin;

      // Desired after-tax spending → gross up to estimate needed gross income
      // Use effective tax rate approximation: for most retirees ~20-28% effective rate
      const approxEffectiveRate = province === 'QC' ? 0.28 : 0.22;
      const desiredGross = desiredNom / (1 - approxEffectiveRate);

      // If guaranteed income > desired gross: no additional drawdown needed
      // If guaranteed income < desired gross: draw from portfolio
      const portfolioNeeded = Math.max(0, desiredGross - guaranteedNom);

      if (portfolioNeeded > 0) {
        // Draw order: TFSA first (tax-free) → Non-Reg → voluntary RRSP (pre-71) or RRIF extra (post-71)
        const tfsaAvail = Math.max(0, tfsa);
        tfsaDraw   = Math.min(tfsaAvail, portfolioNeeded);
        let remaining  = portfolioNeeded - tfsaDraw;

        // Non-reg next
        const nonRegAvail = Math.max(0, nonReg);
        nonRegDraw = Math.min(nonRegAvail, remaining);
        remaining -= nonRegDraw;

        // If still short and pre-RRIF: voluntary RRSP withdrawal to cover gap
        // This models early-retirement RRSP drawdown (also reduces RRIF mass at 71)
        if (remaining > 0 && !isRRIF && rrsp > 0) {
          rrifExtra = Math.min(rrsp, remaining);  // reuse rrifExtra field for voluntary RRSP draw
        }
        // If post-RRIF and still short: additional RRIF above minimum
        if (remaining > 0 && isRRIF && rrsp > rrifMin) {
          rrifExtra = Math.min(rrsp - rrifMin, remaining);
        }
      } else if (rrifMin > desiredGross && tfsa >= 0) {
        // Excess mandatory RRIF — park in TFSA up to annual room ($7,000 in 2024)
        const annualTfsaRoom = 7000;
        const excess = Math.min(annualTfsaRoom, rrifMin - desiredGross);
        tfsa = tfsa + excess;
      }
    }

    // ── Non-reg annual tax treatment ─────────────────────────────────────────
    const nonRegGrowth = nonReg * rate;
    const { taxableIncome: nonRegTaxInc, newAcb } = nonRegAnnualTaxableIncome(
      nonRegGrowth, nonRegDraw, nonReg, acb, nonRegTaxType
    );
    acb = newAcb;

    // ── Compute taxable income ────────────────────────────────────────────────
    const rrifTotal    = rrifMin + rrifExtra;
    const taxableInc   = empNom + cppNom + oasNomGross + pensionNom + bridgeNom + rrifTotal + nonRegTaxInc;
    // OAS clawback based on net income (before clawback)
    const clawback     = isRetired ? oasClawback(taxableInc, oasNomGross) : 0;
    const netIncomeTax = Math.max(0, taxableInc - clawback);  // reduce OAS for clawback

    const { federal, provincial, total: totalTax } = calcTax(netIncomeTax, age, province);
    const netIncome  = Math.max(0,
      empNom + cppNom + (oasNomGross - clawback) + pensionNom + bridgeNom
      + rrifTotal + tfsaDraw + nonRegDraw - totalTax
    );

    const surplus   = isRetired ? Math.round(netIncome - desiredNom) : 0;
    const funding   = isRetired && desiredNom > 0
      ? Math.min(200, Math.round((netIncome / desiredNom) * 100)) : 0;

    // ── Capture pre-update balances (used for retirement portfolio snapshot) ────
    const rrspBeforeUpdate   = rrsp;
    const tfsaBeforeUpdate   = tfsa;
    const nonRegBeforeUpdate = nonReg;

    // ── Update account balances ───────────────────────────────────────────────
    if (!isRetired) {
      // Accumulation
      rrsp   = (rrsp   + annualRrspContrib) * (1 + rate);
      tfsa   = (tfsa   + annualTfsaContrib) * (1 + rate);
      nonReg = (nonReg * (1 + rate));
    } else {
      // Retirement: apply withdrawals THEN growth
      rrsp   = Math.max(0, rrsp - rrifTotal) * (1 + rate);
      tfsa   = Math.max(0, tfsa - tfsaDraw)  * (1 + rate);
      nonReg = Math.max(0, nonReg - nonRegDraw) * (1 + rate);
    }

    const totalPortfolio = Math.round(rrsp + tfsa + nonReg);
    lifetimeTax += totalTax;

    // ── Capture retirement-start metrics ─────────────────────────────────────
    // Use pre-update balances for "portfolio at retirement" — reflects the actual
    // accumulated portfolio the day the client stops working, before any year 1
    // withdrawals or growth. This is what the client "walks in with."
    if (age === retirementAge) {
      rrspAtRet    = Math.round(rrspBeforeUpdate);
      tfsaAtRet    = Math.round(tfsaBeforeUpdate);
      nonRegAtRet  = Math.round(nonRegBeforeUpdate);
      retirementPortfolio = rrspAtRet + tfsaAtRet + nonRegAtRet;
      surplusAtRet = surplus;
      fundingAtRet = funding;
      cppAtRet     = Math.round(cppNom);
      oasAtRet     = Math.round(oasNomGross - clawback);
      // If CPP/OAS not yet started at retirement, guaranteedAtRet will be updated
      // when they first activate (see below)
      guaranteedAtRet = Math.round(cppNom + (oasNomGross - clawback) + pensionNom + bridgeNom);
    }

    // Update guaranteedAtRet to the first year ALL government sources are active
    // (handles case where CPP/OAS deferred past retirement age)
    if (isRetired && cppNom > 0 && oasNomGross > 0 && guaranteedAtRet === 0) {
      guaranteedAtRet = Math.round(cppNom + (oasNomGross - clawback) + pensionNom + bridgeNom);
    }

    if (isRetired) {
      taxInRetirement += totalTax;
      retirementYearCount++;
    }

    yearByYear.push({
      age, year, phase,
      rrspBalance:   Math.round(rrsp),
      tfsaBalance:   Math.round(tfsa),
      nonRegBalance: Math.round(nonReg),
      totalPortfolio,
      employmentIncome: Math.round(empNom),
      cppIncome:     Math.round(cppNom),
      oasIncome:     Math.round(oasNomGross - clawback),
      oasClawback:   Math.round(clawback),
      pensionIncome: Math.round(pensionNom + bridgeNom),
      bridgeIncome:  Math.round(bridgeNom),
      rrifWithdrawal:Math.round(rrifMin),
      rrifExtra:     Math.round(rrifExtra),
      tfsaWithdrawal:Math.round(tfsaDraw),
      nonRegWithdrawal: Math.round(nonRegDraw),
      totalGrossIncome: Math.round(empNom + cppNom + oasNomGross + pensionNom + bridgeNom + rrifTotal + tfsaDraw + nonRegDraw),
      taxableIncome: Math.round(taxableInc),
      federalTax:    Math.round(federal),
      provincialTax: Math.round(provincial),
      totalTax:      Math.round(totalTax),
      netAfterTaxIncome: Math.round(netIncome),
      desiredSpendingNominal: Math.round(desiredNom),
      surplus, fundingPct: funding,
    });
  }

  const lastYear = yearByYear[yearByYear.length - 1];
  const estateValue = lastYear?.totalPortfolio ?? 0;
  const avgTaxInRet = retirementYearCount > 0 ? Math.round(taxInRetirement / retirementYearCount) : 0;

  return {
    yearByYear,
    summary: {
      portfolioAtRetirement:   retirementPortfolio,
      rrspAtRetirement:        rrspAtRet,
      tfsaAtRetirement:        tfsaAtRet,
      nonRegAtRetirement:      nonRegAtRet,
      estateValueAtDeath:      estateValue,
      lifetimeTaxPaid:         Math.round(lifetimeTax),
      avgAnnualTaxInRetirement: avgTaxInRet,
      annualSurplusAtRetirement: surplusAtRet,
      fundingRateAtRetirement: fundingAtRet,
      rrifStartBalance:        rrifStartBal,
      rrifMinYear1:            rrifMinY1,
      cppAnnualAtStart:        cppAtRet,
      oasAnnualAtStart:        oasAtRet,
      guaranteedIncomeAtRet:   guaranteedAtRet,
    },
  };
}
