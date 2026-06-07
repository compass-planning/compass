/**
 * RRSP/TFSA/Non-Reg Drawdown Strategy Engine
 *
 * Three Canadian tax-optimized retirement decumulation strategies:
 *
 *  1. nonreg_first  — Standard order: non-reg → RRSP/RRIF → TFSA last.
 *                     TFSA compounds tax-free as long as possible.
 *                     Pension income splitting applied at 65+ when hasSpouse.
 *
 *  2. meltdown      — Proactive RRSP withdrawals from meltdownStartAge,
 *                     filling the federal bracket-1 ceiling each year.
 *                     Excess beyond living expenses reinvested after-tax into TFSA.
 *                     Shrinks RRIF balance and terminal tax on death.
 *
 *  3. blended       — Bracket-optimal each year: RRSP to bracket ceiling,
 *                     non-reg and TFSA split proportionally for the remainder.
 *                     Pension income splitting applied post-65 with spouse.
 */

export interface DrawdownInput {
  currentAge:              number;
  retirementAge:           number;
  lifeExpectancy:          number;
  province:                string;
  rrspBalance:             number;
  tfsaBalance:             number;
  nonRegBalance:           number;
  nonRegAcb:               number;
  desiredAnnualIncome:     number;
  cppAnnual:               number;
  oasAnnual:               number;
  cppStartAge:             number;
  oasStartAge:             number;
  pensionIncome:           number;
  expectedReturn:          number;
  inflationRate:           number;
  bpa:                     number;
  meltdownStartAge?:       number;    // default: retirementAge
  meltdownBracketCeiling?: number;    // default: 57375 (top fed bracket 1)
  hasSpouse?:              boolean;
  spouseIncome?:           number;
  rrifConversionAge?:      number;    // 65-71, default 71
}

export interface DrawdownYear {
  age:                  number;
  year:                 number;
  rrspBalance:          number;
  tfsaBalance:          number;
  nonRegBalance:        number;
  totalWealth:          number;
  rrspWithdrawal:       number;
  tfsaWithdrawal:       number;
  nonRegWithdrawal:     number;
  tfsaReinvestment:     number;
  cppIncome:            number;
  oasIncome:            number;
  pensionIncome:        number;
  totalIncome:          number;
  taxableIncome:        number;
  federalTax:           number;
  provincialTax:        number;
  totalTax:             number;
  effectiveRate:        number;
  afterTaxIncome:       number;
  rrifMinimum:          number;
  pensionSplitAmount:   number;
  pensionSplitSaving:   number;
  isMeltdownYear:       boolean;
}

export interface DrawdownResult {
  strategy:               "nonreg_first" | "meltdown" | "blended";
  strategyLabel:          string;
  strategyDescription:    string;
  years:                  DrawdownYear[];
  totalLifetimeTax:       number;
  totalAfterTax:          number;
  finalWealth:            number;
  wealthAtAge90:          number;
  portfolioLasts:         number | null;
  averageEffRate:         number;
  rrspAtRrifConversion:   number;
  tfsaReinvestment:       number;
  totalPensionSplitSaving: number;
  taxSavingsVsWorst?:     number;
  meltdownSummary?: {
    windowStartAge:             number;
    windowEndAge:               number;
    totalProactiveWithdrawals:  number;
    totalReinvestedToTfsa:      number;
    rrspReductionVsNoMeltdown:  number;
  };
}

// ── 2025 Federal brackets ─────────────────────────────────────────────────────

const FED = [
  { min: 0,      max: 57375,    rate: 0.15   },
  { min: 57375,  max: 114750,   rate: 0.205  },
  { min: 114750, max: 177882,   rate: 0.26   },
  { min: 177882, max: 253414,   rate: 0.29   },
  { min: 253414, max: Infinity, rate: 0.33   },
];

// ── 2025 Provincial brackets ──────────────────────────────────────────────────

const PROV: Record<string, { min: number; max: number; rate: number }[]> = {
  ON: [
    { min: 0,      max: 52886,    rate: 0.0505 },
    { min: 52886,  max: 105775,   rate: 0.0915 },
    { min: 105775, max: 150000,   rate: 0.1116 },
    { min: 150000, max: 220000,   rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ],
  BC: [
    { min: 0,      max: 49279,    rate: 0.0506 },
    { min: 49279,  max: 98560,    rate: 0.077  },
    { min: 98560,  max: 113158,   rate: 0.105  },
    { min: 113158, max: 137407,   rate: 0.1229 },
    { min: 137407, max: 186306,   rate: 0.147  },
    { min: 186306, max: 259829,   rate: 0.168  },
    { min: 259829, max: Infinity, rate: 0.205  },
  ],
  AB: [
    { min: 0,      max: 60000,    rate: 0.08  },
    { min: 60000,  max: 151234,   rate: 0.10  },
    { min: 151234, max: 181481,   rate: 0.12  },
    { min: 181481, max: 241974,   rate: 0.13  },
    { min: 241974, max: 362961,   rate: 0.14  },
    { min: 362961, max: Infinity, rate: 0.15  },
  ],
  QC: [
    { min: 0,      max: 53255,    rate: 0.14   },
    { min: 53255,  max: 106495,   rate: 0.19   },
    { min: 106495, max: 129590,   rate: 0.24   },
    { min: 129590, max: Infinity, rate: 0.2575 },
  ],
  MB: [
    { min: 0,      max: 47000,    rate: 0.108  },
    { min: 47000,  max: 100000,   rate: 0.1275 },
    { min: 100000, max: Infinity, rate: 0.174  },
  ],
  SK: [
    { min: 0,      max: 49720,    rate: 0.105  },
    { min: 49720,  max: 142058,   rate: 0.125  },
    { min: 142058, max: Infinity, rate: 0.145  },
  ],
  NS: [
    { min: 0,      max: 29590,    rate: 0.0879 },
    { min: 29590,  max: 59180,    rate: 0.1495 },
    { min: 59180,  max: 93000,    rate: 0.1667 },
    { min: 93000,  max: 150000,   rate: 0.175  },
    { min: 150000, max: Infinity, rate: 0.21   },
  ],
  NB: [
    { min: 0,      max: 49958,    rate: 0.094  },
    { min: 49958,  max: 99916,    rate: 0.14   },
    { min: 99916,  max: 185064,   rate: 0.16   },
    { min: 185064, max: Infinity, rate: 0.195  },
  ],
};
const DEFAULT_PROV_RATE = 0.10;

// ── Helpers ───────────────────────────────────────────────────────────────────

function taxFromBrackets(income: number, brackets: { min: number; max: number; rate: number }[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

function calcTax(taxableIncome: number, province: string, bpa: number) {
  const fedTaxable = Math.max(0, taxableIncome - bpa);
  const federal    = taxFromBrackets(fedTaxable, FED);
  const provKey    = province.toUpperCase().substring(0, 2);
  const provData   = PROV[provKey];
  const provincial = provData
    ? taxFromBrackets(taxableIncome, provData)
    : taxableIncome * DEFAULT_PROV_RATE;
  const marginalFed = FED.find(b => fedTaxable >= b.min && fedTaxable < b.max)?.rate ?? 0.33;
  return { federal, provincial, marginalFed };
}

function getMarginalProv(taxableIncome: number, province: string): number {
  const provKey  = province.toUpperCase().substring(0, 2);
  const brackets = PROV[provKey];
  if (!brackets) return DEFAULT_PROV_RATE;
  return brackets.find(b => taxableIncome >= b.min && taxableIncome < b.max)?.rate ?? DEFAULT_PROV_RATE;
}

/** Max RRSP withdrawal to stay at or below bracketCeiling after bpa */
function meltdownRoom(govIncome: number, bracketCeiling: number, bpa: number): number {
  return Math.max(0, bracketCeiling + bpa - govIncome);
}

function rrifMinFactor(age: number): number {
  if (age < 71) return 1 / Math.max(1, 90 - age);
  const f: Record<number, number> = {
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567,
    75: 0.0582, 76: 0.0598, 77: 0.0617, 78: 0.0636,
    79: 0.0658, 80: 0.0682, 81: 0.0708, 82: 0.0738,
    83: 0.0771, 84: 0.0808, 85: 0.0851, 86: 0.0899,
    87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879,
  };
  return f[Math.min(age, 94)] ?? 0.20;
}

/** Estimate pension income split saving — T1032 eligible at 65+, up to 50% of RRIF */
function calcPensionSplit(
  rrspW: number, age: number, hasSpouse: boolean,
  marginalFed: number, spouseIncome: number,
): { splitAmount: number; saving: number } {
  if (!hasSpouse || age < 65 || rrspW <= 0) return { splitAmount: 0, saving: 0 };
  const eligible       = rrspW * 0.5;
  const spouseMarginal = spouseIncome < 57375 ? 0.15 : 0.205;
  const saving         = Math.max(0, eligible * (marginalFed - spouseMarginal));
  return { splitAmount: Math.round(eligible), saving: Math.round(saving) };
}

// ── Simulation ────────────────────────────────────────────────────────────────

function simulate(inp: DrawdownInput, strategy: "nonreg_first" | "meltdown" | "blended"): DrawdownResult {
  const years: DrawdownYear[] = [];
  const retireYear      = new Date().getFullYear() + (inp.retirementAge - inp.currentAge);
  const rrifAge         = Math.max(65, Math.min(71, inp.rrifConversionAge ?? 71));
  const meltdownStart   = inp.meltdownStartAge ?? inp.retirementAge;
  const bracketCeiling  = inp.meltdownBracketCeiling ?? 57375;
  const hasSpouse       = inp.hasSpouse ?? false;
  const spouseIncome    = inp.spouseIncome ?? 0;

  let rrsp       = inp.rrspBalance;
  let tfsa       = inp.tfsaBalance;
  let nonReg     = inp.nonRegBalance;
  let nonRegAcb  = inp.nonRegAcb;

  let totalTax         = 0;
  let totalAfterTax    = 0;
  let totalTfsaReInvest = 0;
  let totalPensionSplit = 0;
  let totalMeltdownW   = 0;
  let totalMeltdownTfsa = 0;
  let rrspAtRrif       = 0;

  for (let age = inp.retirementAge; age <= inp.lifeExpectancy; age++) {
    const year  = retireYear + (age - inp.retirementAge);
    const yearsIn = age - inp.retirementAge;

    rrsp   *= (1 + inp.expectedReturn);
    tfsa   *= (1 + inp.expectedReturn);
    nonReg *= (1 + inp.expectedReturn);

    if (age === rrifAge) rrspAtRrif = Math.round(rrsp);

    const cpp = age >= inp.cppStartAge
      ? inp.cppAnnual * Math.pow(1 + inp.inflationRate, Math.max(0, age - inp.cppStartAge)) : 0;
    const oas = age >= inp.oasStartAge
      ? inp.oasAnnual * Math.pow(1 + inp.inflationRate, Math.max(0, age - inp.oasStartAge)) : 0;
    const pen = inp.pensionIncome * Math.pow(1 + inp.inflationRate, yearsIn);
    const govIncome = cpp + oas + pen;

    const rrifMin   = age >= rrifAge ? rrsp * rrifMinFactor(age) : 0;
    const incomeNeed = inp.desiredAnnualIncome * Math.pow(1 + inp.inflationRate, yearsIn);
    const gap        = Math.max(0, incomeNeed - govIncome);
    const nonRegGainRatio = nonReg > 0 ? Math.max(0, 1 - nonRegAcb / nonReg) : 0;

    let rrspW = 0, tfsaW = 0, nonRegW = 0, tfsaReInvest = 0;
    let isMeltdown = false;

    if (strategy === "nonreg_first") {
      // Non-reg → RRSP/RRIF (min enforced) → TFSA last
      rrspW   = rrifMin;
      nonRegW = Math.min(nonReg, Math.max(0, gap - rrspW));
      tfsaW   = Math.min(tfsa,   Math.max(0, gap - rrspW - nonRegW));
      rrspW   = Math.min(rrsp,   rrspW + Math.max(0, gap - rrspW - nonRegW - tfsaW));

    } else if (strategy === "meltdown") {
      isMeltdown = age >= meltdownStart && age < rrifAge;
      if (isMeltdown) {
        // Proactive withdrawal to bracket ceiling
        const room = meltdownRoom(govIncome, bracketCeiling, inp.bpa);
        rrspW   = Math.min(rrsp, Math.max(rrifMin, room));
        nonRegW = Math.min(nonReg, Math.max(0, gap - rrspW));
        tfsaW   = Math.min(tfsa,   Math.max(0, gap - rrspW - nonRegW));
        // After-tax excess → TFSA reinvestment
        const excess = Math.max(0, rrspW - gap + nonRegW + tfsaW);
        if (excess > 0) {
          const { marginalFed } = calcTax(govIncome + rrspW, inp.province, inp.bpa);
          const marginalProv     = getMarginalProv(govIncome + rrspW, inp.province);
          tfsaReInvest = Math.round(excess * (1 - marginalFed - marginalProv));
          tfsa += tfsaReInvest;
          totalMeltdownW    += rrspW;
          totalMeltdownTfsa += tfsaReInvest;
        }
      } else {
        // Post-meltdown: RRIF min → non-reg → TFSA → more RRSP if needed
        rrspW   = rrifMin;
        nonRegW = Math.min(nonReg, Math.max(0, gap - rrspW));
        tfsaW   = Math.min(tfsa,   Math.max(0, gap - rrspW - nonRegW));
        rrspW   = Math.min(rrsp,   rrspW + Math.max(0, gap - rrspW - nonRegW - tfsaW));
      }

    } else {
      // Blended: RRSP to bracket ceiling, non-reg + TFSA proportionally for rest
      const optRrsp = Math.min(rrsp, Math.max(rrifMin, meltdownRoom(govIncome, bracketCeiling, inp.bpa)));
      rrspW = Math.min(optRrsp, Math.max(rrifMin, gap));
      const remaining    = Math.max(0, gap - rrspW);
      const nonRegShare  = nonReg / Math.max(1, nonReg + tfsa);
      nonRegW = Math.min(nonReg, Math.round(remaining * nonRegShare));
      tfsaW   = Math.min(tfsa,   Math.max(0, remaining - nonRegW));
      rrspW   = Math.min(rrsp,   rrspW + Math.max(0, gap - rrspW - nonRegW - tfsaW));
    }

    rrsp   = Math.max(0, rrsp   - rrspW);
    tfsa   = Math.max(0, tfsa   - tfsaW);
    nonReg = Math.max(0, nonReg - nonRegW);

    const nonRegTaxable  = nonRegW > 0 ? nonRegW * 0.5 * nonRegGainRatio : 0;
    const taxableIncome  = govIncome + rrspW + nonRegTaxable;
    const { federal, provincial, marginalFed } = calcTax(taxableIncome, inp.province, inp.bpa);
    const { splitAmount, saving } = calcPensionSplit(rrspW, age, hasSpouse, marginalFed, spouseIncome);
    const tax       = Math.max(0, federal + provincial - saving);
    const totalInc  = govIncome + rrspW + tfsaW + nonRegW;
    const afterTax  = totalInc - tax;

    totalTax          += tax;
    totalAfterTax     += afterTax;
    totalTfsaReInvest += tfsaReInvest;
    totalPensionSplit += saving;

    if (nonRegW > 0 && nonReg + nonRegW > 0)
      nonRegAcb = Math.max(0, nonRegAcb * (1 - nonRegW / (nonReg + nonRegW)));

    years.push({
      age, year,
      rrspBalance:      Math.round(rrsp),
      tfsaBalance:      Math.round(tfsa),
      nonRegBalance:    Math.round(nonReg),
      totalWealth:      Math.round(rrsp + tfsa + nonReg),
      rrspWithdrawal:   Math.round(rrspW),
      tfsaWithdrawal:   Math.round(tfsaW),
      nonRegWithdrawal: Math.round(nonRegW),
      tfsaReinvestment: Math.round(tfsaReInvest),
      cppIncome:        Math.round(cpp),
      oasIncome:        Math.round(oas),
      pensionIncome:    Math.round(pen),
      totalIncome:      Math.round(totalInc),
      taxableIncome:    Math.round(taxableIncome),
      federalTax:       Math.round(federal),
      provincialTax:    Math.round(provincial),
      totalTax:         Math.round(tax),
      effectiveRate:    totalInc > 0 ? tax / totalInc : 0,
      afterTaxIncome:   Math.round(afterTax),
      rrifMinimum:      Math.round(rrifMin),
      pensionSplitAmount: splitAmount,
      pensionSplitSaving: saving,
      isMeltdownYear:   isMeltdown,
    });

    if (rrsp + tfsa + nonReg <= 0) break;
  }

  const portfolioLasts = years.find(y => y.totalWealth <= 0)?.age ?? null;
  const atAge90   = years.find(y => y.age >= 90);
  const finalYear = years[years.length - 1];
  const meltdownYears = years.filter(y => y.isMeltdownYear);

  const META: Record<string, { label: string; description: string }> = {
    nonreg_first: {
      label: "Non-Reg First (TFSA Last)",
      description: "Depletes non-registered accounts first, then RRSP/RRIF. " +
        "TFSA preserved to compound tax-free as long as possible. " +
        "Pension income splitting at 65+ with spouse.",
    },
    meltdown: {
      label: "RRSP Meltdown",
      description: "Proactively draws RRSP from age " + meltdownStart + " to fill " +
        "the federal bracket-1 ceiling ($" + (inp.meltdownBracketCeiling ?? 57375).toLocaleString() + "). " +
        "After-tax excess is reinvested into TFSA. " +
        "Shrinks RRIF mandatories and estate tax on death.",
    },
    blended: {
      label: "Blended / Bracket-Optimal",
      description: "Each year draws RRSP to the bracket-1 ceiling, then splits " +
        "remaining need proportionally across non-reg and TFSA. " +
        "Pension income splitting at 65+ with spouse.",
    },
  };

  return {
    strategy,
    strategyLabel:       META[strategy].label,
    strategyDescription: META[strategy].description,
    years,
    totalLifetimeTax:    Math.round(totalTax),
    totalAfterTax:       Math.round(totalAfterTax),
    finalWealth:         finalYear?.totalWealth ?? 0,
    wealthAtAge90:       atAge90?.totalWealth ?? 0,
    portfolioLasts,
    averageEffRate:      years.length > 0
      ? years.reduce((s, y) => s + y.effectiveRate, 0) / years.length : 0,
    rrspAtRrifConversion:    rrspAtRrif,
    tfsaReinvestment:        Math.round(totalTfsaReInvest),
    totalPensionSplitSaving: Math.round(totalPensionSplit),
    ...(strategy === "meltdown" && meltdownYears.length > 0 ? {
      meltdownSummary: {
        windowStartAge:            meltdownYears[0]?.age ?? meltdownStart,
        windowEndAge:              meltdownYears[meltdownYears.length - 1]?.age ?? meltdownStart,
        totalProactiveWithdrawals: Math.round(totalMeltdownW),
        totalReinvestedToTfsa:     Math.round(totalMeltdownTfsa),
        rrspReductionVsNoMeltdown: 0,   // patched after all three run
      },
    } : {}),
  };
}

// ── Public Export ─────────────────────────────────────────────────────────────

export function runDrawdownStrategies(inp: DrawdownInput): {
  nonregFirst: DrawdownResult;
  meltdown:    DrawdownResult;
  blended:     DrawdownResult;
} {
  const nonregFirst = simulate(inp, "nonreg_first");
  const meltdown    = simulate(inp, "meltdown");
  const blended     = simulate(inp, "blended");

  const worstTax = Math.max(
    nonregFirst.totalLifetimeTax,
    meltdown.totalLifetimeTax,
    blended.totalLifetimeTax,
  );
  nonregFirst.taxSavingsVsWorst = worstTax - nonregFirst.totalLifetimeTax;
  meltdown.taxSavingsVsWorst    = worstTax - meltdown.totalLifetimeTax;
  blended.taxSavingsVsWorst     = worstTax - blended.totalLifetimeTax;

  if (meltdown.meltdownSummary) {
    meltdown.meltdownSummary.rrspReductionVsNoMeltdown =
      Math.max(0, nonregFirst.rrspAtRrifConversion - meltdown.rrspAtRrifConversion);
  }

  return { nonregFirst, meltdown, blended };
}
