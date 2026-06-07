/**
 * usBenefitRates2025.ts
 * US government benefit rates, account limits, and actuarial tables for 2025.
 * Mirrors benefitRates.ts (Canadian side) in pattern.
 */

// ── Account Contribution Limits ───────────────────────────────────────────────

export const US_401K_LIMIT_2025           = 23_500;  // employee elective deferral
export const US_401K_CATCHUP_50_2025      =  7_500;  // age 50–59 and 64+
export const US_401K_CATCHUP_6063_2025    = 11_250;  // SECURE 2.0: age 60-63 super catch-up
export const US_401K_TOTAL_LIMIT_2025     = 70_000;  // combined employee + employer (§415)

export const US_403B_LIMIT_2025           = 23_500;  // same as 401k
export const US_403B_CATCHUP_50_2025      =  7_500;

export const US_457B_LIMIT_2025           = 23_500;
export const US_457B_CATCHUP_50_2025      =  7_500;

export const US_IRA_LIMIT_2025            =  7_000;
export const US_IRA_CATCHUP_50_2025       =  1_000;  // not inflation-indexed until 2024+

export const US_HSA_LIMIT_INDIVIDUAL_2025 =  4_300;
export const US_HSA_LIMIT_FAMILY_2025     =  8_550;
export const US_HSA_CATCHUP_55_2025       =  1_000;  // age 55+

export const US_FSA_LIMIT_2025            =  3_300;  // health FSA

// SIMPLE IRA
export const US_SIMPLE_IRA_LIMIT_2025     = 16_500;
export const US_SIMPLE_IRA_CATCHUP_50_2025=  3_500;

// SEP-IRA: lesser of 25% of compensation or $70,000
export const US_SEP_IRA_LIMIT_2025        = 70_000;

// Social Security wage base
export const US_SS_WAGE_BASE_2025         = 176_100;
export const US_SS_EMPLOYEE_RATE          = 0.062;   // 6.2%
export const US_SS_EMPLOYER_RATE          = 0.062;
export const US_MEDICARE_RATE             = 0.0145;  // 1.45% each

// ── Roth IRA Income Phase-Out Ranges 2025 ────────────────────────────────────
export const US_ROTH_IRA_PHASEOUT_2025 = {
  single:    { lower: 150_000, upper: 165_000 },
  mfj:       { lower: 236_000, upper: 246_000 },
  mfs:       { lower: 0,       upper: 10_000  }, // MFS living with spouse
  hoh:    { lower: 150000, upper: 165000 },
};

// ── Traditional IRA Deductibility Phase-Out (covered by workplace plan) ──────
export const US_TRAD_IRA_DEDUCTIBLE_PHASEOUT_2025 = {
  single:    { lower: 79_000,  upper: 89_000  },
  mfj:       { lower: 126_000, upper: 146_000 },
  mfs:       { lower: 0,       upper: 10_000  },
  hoh:    { lower: 150000, upper: 165000 },
  // No workplace plan but spouse has one (MFJ):
  mfj_spouse_covered: { lower: 236_000, upper: 246_000 },
    };

// ── Social Security Full Retirement Age (FRA) by birth year ──────────────────
export const SS_FRA_BY_BIRTH_YEAR: Record<number, number> = {
  1937: 65,   1938: 65.17, 1939: 65.33, 1940: 65.5,
  1941: 65.67,1942: 65.83, 1943: 66,    1944: 66,
  1945: 66,   1946: 66,    1947: 66,    1948: 66,
  1949: 66,   1950: 66,    1951: 66,    1952: 66,
  1953: 66,   1954: 66,    1955: 66.17, 1956: 66.33,
  1957: 66.5, 1958: 66.67, 1959: 66.83,
  // 1960 and later:
};
export const SS_FRA_DEFAULT = 67; // birth year 1960+

export function getSsFra(birthYear: number): number {
  if (birthYear >= 1960) return SS_FRA_DEFAULT;
  return SS_FRA_BY_BIRTH_YEAR[birthYear] ?? SS_FRA_DEFAULT;
}

// ── Social Security Bend Points 2025 (PIA formula) ───────────────────────────
// PIA = 90% × (AIME up to first bend) + 32% × (next tier) + 15% × (above second bend)
export const SS_BEND_POINT_1_2025 = 1_226;   // first  bend point (monthly AIME)
export const SS_BEND_POINT_2_2025 = 7_391;   // second bend point

export const SS_PIA_RATES = [0.90, 0.32, 0.15];

/**
 * Estimate Primary Insurance Amount (PIA) from Average Indexed Monthly Earnings (AIME).
 * Uses 2025 bend points.
 */
export function estimatePia(aime: number): number {
  const tier1 = Math.min(aime, SS_BEND_POINT_1_2025) * 0.90;
  const tier2 = Math.max(0, Math.min(aime, SS_BEND_POINT_2_2025) - SS_BEND_POINT_1_2025) * 0.32;
  const tier3 = Math.max(0, aime - SS_BEND_POINT_2_2025) * 0.15;
  return Math.round((tier1 + tier2 + tier3) * 10) / 10; // round to nearest $0.10
}

/**
 * Adjust PIA for early or delayed claiming.
 * - Early (62–FRA): reduces benefit; rate depends on months before FRA
 * - Delayed (FRA–70): adds 8%/year (0.667%/month) Delayed Retirement Credits
 */
export function adjustSsBenefit(
  pia: number,
  claimAge: number,
  birthYear: number,
): { monthlyBenefit: number; annualBenefit: number; adjustmentFactor: number; adjustmentLabel: string } {
  const fra = getSsFra(birthYear);
  const monthsFromFra = (claimAge - fra) * 12;

  let factor: number;
  let label: string;

  if (monthsFromFra === 0) {
    factor = 1.0;
    label  = "Standard benefit at FRA";
  } else if (monthsFromFra > 0) {
    // Delayed retirement credits: 8%/year
    factor = 1 + monthsFromFra * (0.08 / 12);
    label  = `+${(monthsFromFra * (0.08 / 12) * 100).toFixed(1)}% (delayed ${(monthsFromFra / 12).toFixed(1)} yrs)`;
  } else {
    // Early claiming reduction
    // First 36 months before FRA: 5/9 of 1% per month
    // Beyond 36 months: 5/12 of 1% per month
    const monthsEarly = Math.abs(monthsFromFra);
    const firstTier   = Math.min(monthsEarly, 36);
    const secondTier  = Math.max(0, monthsEarly - 36);
    const reduction   = firstTier * (5 / 900) + secondTier * (5 / 1200);
    factor = 1 - reduction;
    label  = `-${(reduction * 100).toFixed(1)}% (${(monthsEarly / 12).toFixed(1)} yrs early)`;
  }

  const monthlyBenefit = pia * factor;
  return {
    monthlyBenefit,
    annualBenefit: monthlyBenefit * 12,
    adjustmentFactor: factor,
    adjustmentLabel: label,
  };
}

// ── Social Security Taxability (Provisional Income) ──────────────────────────
export const SS_TAXABILITY_THRESHOLDS = {
  single: { tier1: 25_000, tier2: 34_000 },
  mfj:    { tier1: 32_000, tier2: 44_000 },
};

/**
 * Calculate how much of annual SS benefit is included in taxable income.
 * Provisional income = AGI + tax-exempt interest + 50% of SS benefits.
 * Up to 50% or 85% of benefits may be taxable.
 */
export function ssTaxableAmount(
  annualSsBenefit: number,
  provisionalIncome: number,
  filingStatus: "single" | "mfj",
): number {
  const { tier1, tier2 } = SS_TAXABILITY_THRESHOLDS[filingStatus];

  if (provisionalIncome <= tier1) return 0;
  if (provisionalIncome <= tier2) {
    return Math.min(annualSsBenefit * 0.50, (provisionalIncome - tier1) * 0.50);
  }
  const tier1Taxable = Math.min(annualSsBenefit * 0.50, (tier2 - tier1) * 0.50);
  const tier2Taxable = Math.min(
    annualSsBenefit * 0.85 - tier1Taxable,
    (provisionalIncome - tier2) * 0.85,
  );
  return Math.min(annualSsBenefit * 0.85, tier1Taxable + tier2Taxable);
}

// ── Required Minimum Distributions (RMD) ─────────────────────────────────────
// IRS Uniform Lifetime Table (2022+ SECURE 2.0 table) – age 72 start
// (SECURE 2.0 raised RMD age to 73 for those born 1951–1959; 75 for 1960+)
export const IRS_UNIFORM_LIFETIME_TABLE: Record<number, number> = {
  72: 27.4, 73: 26.5, 74: 25.5, 75: 24.6,
  76: 23.7, 77: 22.9, 78: 22.0, 79: 21.1,
  80: 20.2, 81: 19.4, 82: 18.5, 83: 17.7,
  84: 16.8, 85: 16.0, 86: 15.2, 87: 14.4,
  88: 13.7, 89: 12.9, 90: 12.2, 91: 11.5,
  92: 10.8, 93: 10.1, 94:  9.5, 95:  8.9,
  96:  8.4, 97:  7.8, 98:  7.3, 99:  6.8,
  100: 6.4, 101: 6.0, 102: 5.6, 103: 5.2,
  104: 4.9, 105: 4.6, 106: 4.3, 107: 4.1,
  108: 3.9, 109: 3.7, 110: 3.5, 111: 3.4,
  112: 3.3, 113: 3.1, 114: 3.0, 115: 2.9,
  116: 2.8, 117: 2.7, 118: 2.5, 119: 2.3,
  120: 2.0,
};

export function getRmdStartAge(birthYear: number): number {
  if (birthYear <= 1950) return 72; // old law
  if (birthYear <= 1959) return 73; // SECURE 2.0
  return 75;                        // born 1960+
}

export function calculateRmd(age: number, balance: number, birthYear: number): number {
  const startAge = getRmdStartAge(birthYear);
  if (age < startAge) return 0;
  const lifeExpectancy = IRS_UNIFORM_LIFETIME_TABLE[Math.min(age, 120)] ?? 2.0;
  return balance / lifeExpectancy;
}

// ── Historical 401(k) / IRA Limits (for carry-forward context) ───────────────
export const US_401K_ANNUAL_LIMITS: Record<number, number> = {
  2010: 16_500, 2011: 16_500, 2012: 17_000, 2013: 17_500,
  2014: 17_500, 2015: 18_000, 2016: 18_000, 2017: 18_000,
  2018: 18_500, 2019: 19_000, 2020: 19_500, 2021: 19_500,
  2022: 20_500, 2023: 22_500, 2024: 23_000, 2025: 23_500,
};

export const US_IRA_ANNUAL_LIMITS: Record<number, number> = {
  2010: 5_000, 2011: 5_000, 2012: 5_000, 2013: 5_500,
  2014: 5_500, 2015: 5_500, 2016: 5_500, 2017: 5_500,
  2018: 5_500, 2019: 6_000, 2020: 6_000, 2021: 6_000,
  2022: 6_000, 2023: 6_500, 2024: 7_000, 2025: 7_000,
};

export function get401kLimit(year: number): number {
  if (US_401K_ANNUAL_LIMITS[year]) return US_401K_ANNUAL_LIMITS[year];
  const last = Math.max(...Object.keys(US_401K_ANNUAL_LIMITS).map(Number));
  return Math.round((US_401K_ANNUAL_LIMITS[last] * Math.pow(1.025, year - last)) / 500) * 500;
}

export function getIraLimit(year: number): number {
  if (US_IRA_ANNUAL_LIMITS[year]) return US_IRA_ANNUAL_LIMITS[year];
  const last = Math.max(...Object.keys(US_IRA_ANNUAL_LIMITS).map(Number));
  return Math.round((US_IRA_ANNUAL_LIMITS[last] * Math.pow(1.02, year - last)) / 500) * 500;
}

// ── Medicare Part B / IRMAA Thresholds 2025 (for retirement income planning) ─
export const MEDICARE_PART_B_BASE_2025 = 185.00; // per month standard premium

export const IRMAA_THRESHOLDS_2025 = [
  { singleMax: 106_000, mfjMax: 212_000, premium: 185.00   },
  { singleMax: 133_000, mfjMax: 266_000, premium: 259.00   },
  { singleMax: 167_000, mfjMax: 334_000, premium: 370.00   },
  { singleMax: 200_000, mfjMax: 400_000, premium: 480.90   },
  { singleMax: 500_000, mfjMax: 750_000, premium: 591.90   },
  { singleMax: Infinity, mfjMax: Infinity, premium: 628.90 },
];

export function getMedicarePremium(magi: number, filingStatus: "single" | "mfj"): number {
  for (const tier of IRMAA_THRESHOLDS_2025) {
    const threshold = filingStatus === "mfj" ? tier.mfjMax : tier.singleMax;
    if (magi <= threshold) return tier.premium;
  }
  return IRMAA_THRESHOLDS_2025[IRMAA_THRESHOLDS_2025.length - 1].premium;
}

// ── Federal Estate Tax 2025 ───────────────────────────────────────────────────
export const US_ESTATE_TAX_EXEMPTION_2025   = 13_990_000; // per person
export const US_ESTATE_TAX_EXEMPTION_MFJ    = 27_980_000; // with portability
export const US_ESTATE_TAX_RATE             = 0.40;        // top marginal rate
export const US_ANNUAL_GIFT_EXCLUSION_2025  = 19_000;      // per recipient

export function calculateFederalEstateTax(grossEstate: number, exemption: number = US_ESTATE_TAX_EXEMPTION_2025): number {
  const taxableEstate = Math.max(0, grossEstate - exemption);
  return taxableEstate * US_ESTATE_TAX_RATE;
}

// ── Step-Up in Basis ──────────────────────────────────────────────────────────
/** Appreciated assets held until death receive a step-up in cost basis to FMV. */
export function estimateStepUpBenefit(
  unrealizedGain: number,
  estimatedLtcgRate: number = 0.20,
): number {
  return unrealizedGain * estimatedLtcgRate; // tax permanently avoided
}
