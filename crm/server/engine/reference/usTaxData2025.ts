/**
 * usTaxData2025.ts
 * US federal and state tax reference data for 2025.
 * Mirrors the structure of taxBrackets.ts (Canadian) so the same
 * calculateTaxForBrackets() helper works for both jurisdictions.
 */

// ── Shared bracket type (same interface as Canadian side) ────────────────────
export interface UsTaxBracket {
  state: string;        // "federal" | two-letter state code
  filingStatus: FilingStatus;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  effectiveYear: number;
}

export type FilingStatus =
  | "single"
  | "mfj"       // married filing jointly
  | "mfs"       // married filing separately
  | "hoh";      // head of household

// ── 2025 Standard Deductions ─────────────────────────────────────────────────
export const US_STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15_000,
  mfj:    30_000,
  mfs:    15_000,
  hoh:    22_500,
};

// Extra standard deduction for age 65+ / blind (per person)
export const US_ADDITIONAL_STANDARD_DEDUCTION_2025 = {
  single_or_hoh: 2_000,
  mfj_or_mfs:    1_600,
};

// ── 2025 Federal Ordinary Income Brackets ────────────────────────────────────
export const US_FEDERAL_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "federal", filingStatus: "single", minIncome: 0,       maxIncome: 11_925,  rate: 0.10,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 11_925,  maxIncome: 48_475,  rate: 0.12,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 48_475,  maxIncome: 103_350, rate: 0.22,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 103_350, maxIncome: 197_300, rate: 0.24,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 197_300, maxIncome: 250_525, rate: 0.32,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 250_525, maxIncome: 626_350, rate: 0.35,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 626_350, maxIncome: null,    rate: 0.37,  effectiveYear: 2025 },
];

export const US_FEDERAL_BRACKETS_2025_MFJ: UsTaxBracket[] = [
  { state: "federal", filingStatus: "mfj", minIncome: 0,        maxIncome: 23_850,  rate: 0.10,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 23_850,   maxIncome: 96_950,  rate: 0.12,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 96_950,   maxIncome: 206_700, rate: 0.22,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 206_700,  maxIncome: 394_600, rate: 0.24,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 394_600,  maxIncome: 501_050, rate: 0.32,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 501_050,  maxIncome: 751_600, rate: 0.35,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 751_600,  maxIncome: null,    rate: 0.37,  effectiveYear: 2025 },
];

export const US_FEDERAL_BRACKETS_2025_HOH: UsTaxBracket[] = [
  { state: "federal", filingStatus: "hoh", minIncome: 0,        maxIncome: 17_000,  rate: 0.10,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 17_000,   maxIncome: 64_850,  rate: 0.12,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 64_850,   maxIncome: 103_350, rate: 0.22,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 103_350,  maxIncome: 197_300, rate: 0.24,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 197_300,  maxIncome: 250_500, rate: 0.32,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 250_500,  maxIncome: 626_350, rate: 0.35,  effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 626_350,  maxIncome: null,    rate: 0.37,  effectiveYear: 2025 },
];

// MFS = same brackets as single but halved MFJ thresholds
export const US_FEDERAL_BRACKETS_2025_MFS = US_FEDERAL_BRACKETS_2025_SINGLE.map(b => ({
  ...b, filingStatus: "mfs" as FilingStatus,
}));

// ── 2025 Long-Term Capital Gains Rates ───────────────────────────────────────
export interface LtcgBracket {
  filingStatus: FilingStatus;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

export const US_LTCG_BRACKETS_2025: LtcgBracket[] = [
  // Single
  { filingStatus: "single", minIncome: 0,        maxIncome: 48_350,  rate: 0.00 },
  { filingStatus: "single", minIncome: 48_350,   maxIncome: 533_400, rate: 0.15 },
  { filingStatus: "single", minIncome: 533_400,  maxIncome: null,    rate: 0.20 },
  // MFJ
  { filingStatus: "mfj",    minIncome: 0,        maxIncome: 96_700,  rate: 0.00 },
  { filingStatus: "mfj",    minIncome: 96_700,   maxIncome: 600_050, rate: 0.15 },
  { filingStatus: "mfj",    minIncome: 600_050,  maxIncome: null,    rate: 0.20 },
  // HOH
  { filingStatus: "hoh",    minIncome: 0,        maxIncome: 64_750,  rate: 0.00 },
  { filingStatus: "hoh",    minIncome: 64_750,   maxIncome: 566_700, rate: 0.15 },
  { filingStatus: "hoh",    minIncome: 566_700,  maxIncome: null,    rate: 0.20 },
  // MFS
  { filingStatus: "mfs",    minIncome: 0,        maxIncome: 48_350,  rate: 0.00 },
  { filingStatus: "mfs",    minIncome: 48_350,   maxIncome: 300_000, rate: 0.15 },
  { filingStatus: "mfs",    minIncome: 300_000,  maxIncome: null,    rate: 0.20 },
];

// ── Net Investment Income Tax (NIIT) 3.8% ────────────────────────────────────
export const US_NIIT_THRESHOLDS_2025: Record<FilingStatus, number> = {
  single: 200_000,
  mfj:    250_000,
  mfs:    125_000,
  hoh:    200_000,
};
export const US_NIIT_RATE = 0.038;

// ── Additional Medicare Tax 0.9% ─────────────────────────────────────────────
export const US_ADDITIONAL_MEDICARE_TAX_THRESHOLDS: Record<FilingStatus, number> = {
  single: 200_000,
  mfj:    250_000,
  mfs:    125_000,
  hoh:    200_000,
};
export const US_ADDITIONAL_MEDICARE_RATE = 0.009;

// ── State Brackets 2025 ───────────────────────────────────────────────────────
// Flat-tax / no-income-tax states noted inline.
// We cover the most common advisor states; add others as needed.

// California – 2025 (single/MFS; MFJ thresholds doubled)
export const CA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "CA", filingStatus: "single", minIncome: 0,        maxIncome: 10_412,  rate: 0.01,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 10_412,   maxIncome: 24_684,  rate: 0.02,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 24_684,   maxIncome: 38_959,  rate: 0.04,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 38_959,   maxIncome: 54_081,  rate: 0.06,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 54_081,   maxIncome: 68_350,  rate: 0.08,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 68_350,   maxIncome: 349_137, rate: 0.093,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 349_137,  maxIncome: 418_961, rate: 0.103,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 418_961,  maxIncome: 698_274, rate: 0.113,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 698_274,  maxIncome: null,    rate: 0.123,  effectiveYear: 2025 },
];

// New York – 2025 single
export const NY_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NY", filingStatus: "single", minIncome: 0,        maxIncome: 17_150,  rate: 0.04,   effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 17_150,   maxIncome: 23_600,  rate: 0.045,  effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 23_600,   maxIncome: 27_900,  rate: 0.0525, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 27_900,   maxIncome: 161_550, rate: 0.0585, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 161_550,  maxIncome: 323_200, rate: 0.0625, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 323_200,  maxIncome: 2_155_350,rate: 0.0685,effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 2_155_350,maxIncome: 5_000_000,rate: 0.0965,effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 5_000_000,maxIncome: 25_000_000,rate: 0.103,effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 25_000_000,maxIncome: null,   rate: 0.109,  effectiveYear: 2025 },
];

// Texas – no state income tax
export const TX_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "TX", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Florida – no state income tax
export const FL_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "FL", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Washington – no state income tax (capital gains tax on gains >$250k added 2023, not modeled here)
export const WA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "WA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Illinois – flat 4.95%
export const IL_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "IL", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0495, effectiveYear: 2025 },
];

// Pennsylvania – flat 3.07%
export const PA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "PA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0307, effectiveYear: 2025 },
];

// Ohio – 2025
export const OH_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "OH", filingStatus: "single", minIncome: 0,       maxIncome: 26_050,  rate: 0,      effectiveYear: 2025 },
  { state: "OH", filingStatus: "single", minIncome: 26_050,  maxIncome: 100_000, rate: 0.02765, effectiveYear: 2025 },
  { state: "OH", filingStatus: "single", minIncome: 100_000, maxIncome: null,    rate: 0.035,  effectiveYear: 2025 },
];

// Georgia – 2025 flat 5.39%
export const GA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "GA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0539, effectiveYear: 2025 },
];

// North Carolina – flat 4.5%
export const NC_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NC", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.045, effectiveYear: 2025 },
];

// Virginia – 2025
export const VA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "VA", filingStatus: "single", minIncome: 0,       maxIncome: 3_000,   rate: 0.02,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 3_000,   maxIncome: 5_000,   rate: 0.03,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 5_000,   maxIncome: 17_000,  rate: 0.05,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 17_000,  maxIncome: null,    rate: 0.0575, effectiveYear: 2025 },
];

// Arizona – flat 2.5%
export const AZ_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "AZ", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.025, effectiveYear: 2025 },
];

// Colorado – flat 4.4%
export const CO_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "CO", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.044, effectiveYear: 2025 },
];

// Michigan – flat 4.05%
export const MI_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MI", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0405, effectiveYear: 2025 },
];

// Minnesota – 2025 single
export const MN_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MN", filingStatus: "single", minIncome: 0,       maxIncome: 31_690,  rate: 0.0535, effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 31_690,  maxIncome: 104_090, rate: 0.068,  effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 104_090, maxIncome: 183_340, rate: 0.0785, effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 183_340, maxIncome: null,    rate: 0.0985, effectiveYear: 2025 },
];

// Massachusetts – flat 5% (+ 4% surtax on income >$1M)
export const MA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MA", filingStatus: "single", minIncome: 0,         maxIncome: 1_000_000, rate: 0.05,  effectiveYear: 2025 },
  { state: "MA", filingStatus: "single", minIncome: 1_000_000, maxIncome: null,      rate: 0.09,  effectiveYear: 2025 },
];

// Nevada, Wyoming, South Dakota, Tennessee – no income tax
export const NO_TAX_STATES = ["NV", "WY", "SD", "TN", "NH", "AK"];
function noTaxBrackets(stateCode: string): UsTaxBracket[] {
  return [{ state: stateCode, filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 }];
}

// ── State bracket registry (single filer; MFJ usually doubles thresholds) ───
export const US_STATE_BRACKETS_2025: Record<string, UsTaxBracket[]> = {
  CA: CA_STATE_BRACKETS_2025_SINGLE,
  NY: NY_STATE_BRACKETS_2025_SINGLE,
  TX: TX_STATE_BRACKETS_2025_SINGLE,
  FL: FL_STATE_BRACKETS_2025_SINGLE,
  WA: WA_STATE_BRACKETS_2025_SINGLE,
  IL: IL_STATE_BRACKETS_2025_SINGLE,
  PA: PA_STATE_BRACKETS_2025_SINGLE,
  OH: OH_STATE_BRACKETS_2025_SINGLE,
  GA: GA_STATE_BRACKETS_2025_SINGLE,
  NC: NC_STATE_BRACKETS_2025_SINGLE,
  VA: VA_STATE_BRACKETS_2025_SINGLE,
  AZ: AZ_STATE_BRACKETS_2025_SINGLE,
  CO: CO_STATE_BRACKETS_2025_SINGLE,
  MI: MI_STATE_BRACKETS_2025_SINGLE,
  MN: MN_STATE_BRACKETS_2025_SINGLE,
  MA: MA_STATE_BRACKETS_2025_SINGLE,
  ...Object.fromEntries(NO_TAX_STATES.map(s => [s, noTaxBrackets(s)])),
};

// ── Federal bracket lookup by filing status ───────────────────────────────────
export function getFederalBrackets(filingStatus: FilingStatus): UsTaxBracket[] {
  switch (filingStatus) {
    case "mfj": return US_FEDERAL_BRACKETS_2025_MFJ;
    case "hoh": return US_FEDERAL_BRACKETS_2025_HOH;
    case "mfs": return US_FEDERAL_BRACKETS_2025_MFS;
    default:    return US_FEDERAL_BRACKETS_2025_SINGLE;
  }
}

// ── Core tax calculation helpers ──────────────────────────────────────────────

/** Apply progressive brackets to taxable income. */
export function calculateTaxForBracketsUS(income: number, brackets: UsTaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.minIncome) break;
    const taxableInBracket = Math.min(
      income - bracket.minIncome,
      bracket.maxIncome !== null ? bracket.maxIncome - bracket.minIncome : Infinity,
    );
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

export interface UsTaxResult {
  federalTax:      number;
  stateTax:        number;
  niit:            number;
  additionalMedicareTax: number;
  totalTax:        number;
  effectiveRate:   number;
  marginalRate:    number;  // combined federal + state ordinary
}

/**
 * Calculate combined US federal + state tax on ordinary income.
 * @param taxableIncome  Income after deductions (standard or itemized)
 * @param filingStatus
 * @param usState        Two-letter state code, e.g. "CA", "TX"
 * @param netInvestmentIncome  For NIIT calculation
 * @param wages              For additional Medicare tax
 * @param grossIncome        For effective rate denominator
 */
export function calculateCombinedTaxUS(
  taxableIncome:       number,
  filingStatus:        FilingStatus,
  usState:             string,
  netInvestmentIncome: number = 0,
  wages:               number = 0,
  grossIncome:         number = 0,
): UsTaxResult {
  const federalBrackets = getFederalBrackets(filingStatus);
  const stateBrackets   = US_STATE_BRACKETS_2025[usState.toUpperCase()]
                        ?? noTaxBrackets(usState.toUpperCase());

  const federalTax = calculateTaxForBracketsUS(taxableIncome, federalBrackets);
  const stateTax   = calculateTaxForBracketsUS(taxableIncome, stateBrackets);

  // NIIT
  const niitThreshold = US_NIIT_THRESHOLDS_2025[filingStatus];
  const niit = netInvestmentIncome > 0 && grossIncome > niitThreshold
    ? Math.min(netInvestmentIncome, grossIncome - niitThreshold) * US_NIIT_RATE
    : 0;

  // Additional 0.9% Medicare
  const medThreshold = US_ADDITIONAL_MEDICARE_TAX_THRESHOLDS[filingStatus];
  const addMedicare  = wages > medThreshold ? (wages - medThreshold) * US_ADDITIONAL_MEDICARE_RATE : 0;

  const totalTax     = federalTax + stateTax + niit + addMedicare;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  // Marginal rate: top federal + top state bracket hit
  let fedMarginal   = 0;
  for (const b of federalBrackets) { if (taxableIncome > b.minIncome) fedMarginal = b.rate; }
  let stateMarginal = 0;
  for (const b of stateBrackets)   { if (taxableIncome > b.minIncome) stateMarginal = b.rate; }

  return { federalTax, stateTax, niit, additionalMedicareTax: addMedicare,
           totalTax, effectiveRate, marginalRate: fedMarginal + stateMarginal };
}

/**
 * Calculate tax on long-term capital gains (stacked on top of ordinary income).
 * Gains are taxed at preferential LTCG rates, but the rate bracket is determined
 * by where total income (ordinary + gains) lands.
 */
export function calculateLtcgTax(
  ordinaryIncome: number,
  ltcgAmount:     number,
  filingStatus:   FilingStatus,
): number {
  if (ltcgAmount <= 0) return 0;
  const brackets = US_LTCG_BRACKETS_2025.filter(b => b.filingStatus === filingStatus);
  // Stack gains on top of ordinary income for bracket determination
  const topOfIncome = ordinaryIncome + ltcgAmount;
  let tax = 0;
  let gainsRemaining = ltcgAmount;

  for (const bracket of brackets) {
    if (gainsRemaining <= 0) break;
    if (topOfIncome <= bracket.minIncome) break;

    // Only tax the portion of gains that falls in this bracket
    const bracketTop    = bracket.maxIncome ?? Infinity;
    const bracketBottom = Math.max(bracket.minIncome, ordinaryIncome);
    if (bracketBottom >= bracketTop) continue;

    const taxableInBracket = Math.min(gainsRemaining, bracketTop - bracketBottom);
    if (taxableInBracket <= 0) continue;
    tax += taxableInBracket * bracket.rate;
    gainsRemaining -= taxableInBracket;
  }
  return tax;
}

/** Get US marginal ordinary-income rate. */
export function getUsMarginalRate(taxableIncome: number, filingStatus: FilingStatus, usState: string): number {
  const result = calculateCombinedTaxUS(taxableIncome, filingStatus, usState);
  return result.marginalRate;
}

/** Resolve common state name variants to two-letter code. */
export function resolveStateCode(input: string): string {
  const map: Record<string, string> = {
    california: "CA", "new york": "NY", texas: "TX", florida: "FL",
    washington: "WA", illinois: "IL", pennsylvania: "PA", ohio: "OH",
    georgia: "GA", "north carolina": "NC", virginia: "VA", arizona: "AZ",
    colorado: "CO", michigan: "MI", minnesota: "MN", massachusetts: "MA",
    nevada: "NV", wyoming: "WY", "south dakota": "SD", tennessee: "TN",
    "new hampshire": "NH", alaska: "AK",
  };
  const normalized = input.trim().toLowerCase();
  return map[normalized] ?? input.toUpperCase().slice(0, 2);
}
