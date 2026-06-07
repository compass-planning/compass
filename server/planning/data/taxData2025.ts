// 2025 Canadian Tax Data
// Federal brackets updated: $57,375 / $114,750 / $177,882 / $253,414
// BPA 2025: $16,129 federal

export type Province = "ontario"|"british_columbia"|"alberta"|"quebec"|"manitoba"|"saskatchewan"|"nova_scotia"|"new_brunswick"|"pei"|"newfoundland"|"yukon"|"northwest_territories"|"nunavut";
type B = {min:number;max:number;rate:number};

export const FEDERAL_BRACKETS_2025: B[] = [
  {min:0,      max:57375,  rate:0.15},
  {min:57375,  max:114750, rate:0.205},
  {min:114750, max:177882, rate:0.26},
  {min:177882, max:253414, rate:0.29},
  {min:253414, max:Infinity, rate:0.33},
];

export const FEDERAL_BASIC_PERSONAL_2025 = 16129;

export const PROVINCIAL_BASIC_PERSONAL_2025: Record<Province, number> = {
  ontario:              11865,
  british_columbia:     11981,
  alberta:              21003,
  quebec:               17183,
  manitoba:             15780,
  saskatchewan:         17661,
  nova_scotia:           8481,
  new_brunswick:        12458,
  pei:                  12000,
  newfoundland:         10818,
  yukon:                16129,
  northwest_territories:16593,
  nunavut:              17925,
};

export const PROVINCIAL_BRACKETS_2025: Record<Province, B[]> = {
  ontario: [
    {min:0,      max:52886,  rate:0.0505},
    {min:52886,  max:105775, rate:0.0915},
    {min:105775, max:150000, rate:0.1116},
    {min:150000, max:220000, rate:0.1216},
    {min:220000, max:Infinity, rate:0.1316},
  ],
  british_columbia: [
    {min:0,      max:49279,  rate:0.0506},
    {min:49279,  max:98560,  rate:0.0770},
    {min:98560,  max:113158, rate:0.1050},
    {min:113158, max:137407, rate:0.1229},
    {min:137407, max:186306, rate:0.1470},
    {min:186306, max:259829, rate:0.1680},
    {min:259829, max:Infinity, rate:0.2050},
  ],
  alberta: [
    {min:0,      max:60000,  rate:0.08},
    {min:60000,  max:151234, rate:0.10},
    {min:151234, max:181481, rate:0.12},
    {min:181481, max:241974, rate:0.13},
    {min:241974, max:362961, rate:0.14},
    {min:362961, max:Infinity, rate:0.15},
  ],
  quebec: [
    {min:0,      max:53255,  rate:0.14},
    {min:53255,  max:106495, rate:0.19},
    {min:106495, max:129590, rate:0.24},
    {min:129590, max:Infinity, rate:0.2575},
  ],
  manitoba: [
    {min:0,      max:47564,  rate:0.108},
    {min:47564,  max:101200, rate:0.1275},
    {min:101200, max:Infinity, rate:0.174},
  ],
  saskatchewan: [
    {min:0,      max:53463,  rate:0.105},
    {min:53463,  max:152750, rate:0.125},
    {min:152750, max:Infinity, rate:0.145},
  ],
  nova_scotia: [
    {min:0,      max:30507,  rate:0.0879},
    {min:30507,  max:61015,  rate:0.1495},
    {min:61015,  max:95883,  rate:0.1667},
    {min:95883,  max:154650, rate:0.1750},
    {min:154650, max:Infinity, rate:0.2100},
  ],
  new_brunswick: [
    {min:0,      max:51306,  rate:0.094},
    {min:51306,  max:102614, rate:0.14},
    {min:102614, max:190060, rate:0.16},
    {min:190060, max:Infinity, rate:0.195},
  ],
  pei: [
    {min:0,      max:33328,  rate:0.0950},
    {min:33328,  max:64656,  rate:0.1347},
    {min:64656,  max:105000, rate:0.1660},
    {min:105000, max:140000, rate:0.1762},
    {min:140000, max:Infinity, rate:0.1900},
  ],
  newfoundland: [
    {min:0,       max:44192,   rate:0.087},
    {min:44192,   max:88382,   rate:0.145},
    {min:88382,   max:157792,  rate:0.158},
    {min:157792,  max:220910,  rate:0.178},
    {min:220910,  max:282214,  rate:0.198},
    {min:282214,  max:564429,  rate:0.208},
    {min:564429,  max:1128858, rate:0.213},
    {min:1128858, max:Infinity, rate:0.218},
  ],
  yukon: [
    {min:0,      max:57375,  rate:0.064},
    {min:57375,  max:114750, rate:0.090},
    {min:114750, max:177882, rate:0.109},
    {min:177882, max:500000, rate:0.128},
    {min:500000, max:Infinity, rate:0.150},
  ],
  northwest_territories: [
    {min:0,      max:51964,  rate:0.059},
    {min:51964,  max:103930, rate:0.086},
    {min:103930, max:168967, rate:0.122},
    {min:168967, max:Infinity, rate:0.1405},
  ],
  nunavut: [
    {min:0,      max:54707,  rate:0.040},
    {min:54707,  max:109413, rate:0.070},
    {min:109413, max:177881, rate:0.090},
    {min:177881, max:Infinity, rate:0.115},
  ],
};

// Dividend tax credit rates (2025 — unchanged from 2024)
export const ELIGIBLE_DIVIDEND_GROSSUP         = 0.38;
export const ELIGIBLE_DIVIDEND_FED_CREDIT      = 0.150198;
export const NONELIGIBLE_DIVIDEND_GROSSUP      = 0.15;
export const NONELIGIBLE_DIVIDEND_FED_CREDIT   = 0.090301;

// CPP & EI 2025
export const CPP_MAX_EARNINGS_2025   = 73200;
export const CPP_BASIC_EXEMPTION     = 3500;
export const CPP_RATE_2025           = 0.0595;
export const EI_MAX_INSURABLE_2025   = 65700;
export const EI_RATE_2025            = 0.0166;

function calculateTaxFromBrackets(income: number, brackets: B[]): number {
  let tax = 0;
  for (const b of brackets) {
    if (income <= b.min) break;
    tax += (Math.min(income, b.max) - b.min) * b.rate;
  }
  return tax;
}

export function getBracketRate(income: number, brackets: B[]): number {
  let rate = brackets[0].rate;
  for (const b of brackets) {
    if (income > b.min) rate = b.rate;
  }
  return rate;
}

export function calculateCPP(employment: number): number {
  const insurable = Math.min(employment, CPP_MAX_EARNINGS_2025) - CPP_BASIC_EXEMPTION;
  return Math.max(0, insurable * CPP_RATE_2025);
}

export function calculateEI(employment: number): number {
  return Math.min(employment, EI_MAX_INSURABLE_2025) * EI_RATE_2025;
}

export function calculateFederalTax(taxableIncome: number): number {
  return Math.max(0, calculateTaxFromBrackets(taxableIncome, FEDERAL_BRACKETS_2025)
    - FEDERAL_BRACKETS_2025[0].rate * Math.min(FEDERAL_BASIC_PERSONAL_2025, taxableIncome));
}

export function calculateProvincialTax(taxableIncome: number, province: Province): number {
  const brackets = PROVINCIAL_BRACKETS_2025[province];
  const bpa = PROVINCIAL_BASIC_PERSONAL_2025[province];
  let tax = calculateTaxFromBrackets(taxableIncome, brackets)
    - brackets[0].rate * Math.min(bpa, taxableIncome);
  // Ontario surtax
  if (province === "ontario" && tax > 5315) {
    tax += Math.max(0, tax - 5315) * 0.20 + Math.max(0, tax - 6802) * 0.36;
  }
  return Math.max(0, tax);
}

export function getMarginalRate(income: number, province: Province): number {
  return getBracketRate(income, FEDERAL_BRACKETS_2025)
    + getBracketRate(income, PROVINCIAL_BRACKETS_2025[province]);
}

// ── Backward-compatible 2024 aliases ─────────────────────────────────────────
export const FEDERAL_BRACKETS_2024       = FEDERAL_BRACKETS_2025;
export const FEDERAL_BASIC_PERSONAL_2024 = FEDERAL_BASIC_PERSONAL_2025;
export const PROVINCIAL_BRACKETS_2024    = PROVINCIAL_BRACKETS_2025;
export const PROVINCIAL_BASIC_PERSONAL_2024 = PROVINCIAL_BASIC_PERSONAL_2025;
