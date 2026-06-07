export interface TaxBracket {
  province: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  effectiveYear: number;
}

// ── 2025 Federal Brackets ──────────────────────────────────────────────────────
export const FEDERAL_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "federal", minIncome: 0,       maxIncome: 57375,  rate: 0.15,   effectiveYear: 2025 },
  { province: "federal", minIncome: 57375,   maxIncome: 114750, rate: 0.205,  effectiveYear: 2025 },
  { province: "federal", minIncome: 114750,  maxIncome: 177882, rate: 0.26,   effectiveYear: 2025 },
  { province: "federal", minIncome: 177882,  maxIncome: 253414, rate: 0.29,   effectiveYear: 2025 },
  { province: "federal", minIncome: 253414,  maxIncome: null,   rate: 0.33,   effectiveYear: 2025 },
];

// ── 2025 Provincial Brackets ──────────────────────────────────────────────────
export const BC_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "BC", minIncome: 0,       maxIncome: 49279,  rate: 0.0506,  effectiveYear: 2025 },
  { province: "BC", minIncome: 49279,   maxIncome: 98560,  rate: 0.077,   effectiveYear: 2025 },
  { province: "BC", minIncome: 98560,   maxIncome: 113158, rate: 0.105,   effectiveYear: 2025 },
  { province: "BC", minIncome: 113158,  maxIncome: 137407, rate: 0.1229,  effectiveYear: 2025 },
  { province: "BC", minIncome: 137407,  maxIncome: 186306, rate: 0.147,   effectiveYear: 2025 },
  { province: "BC", minIncome: 186306,  maxIncome: 259829, rate: 0.168,   effectiveYear: 2025 },
  { province: "BC", minIncome: 259829,  maxIncome: null,   rate: 0.205,   effectiveYear: 2025 },
];

export const ALBERTA_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "AB", minIncome: 0,       maxIncome: 60000,  rate: 0.08,   effectiveYear: 2025 },
  { province: "AB", minIncome: 60000,   maxIncome: 151234, rate: 0.10,   effectiveYear: 2025 },
  { province: "AB", minIncome: 151234,  maxIncome: 181481, rate: 0.12,   effectiveYear: 2025 },
  { province: "AB", minIncome: 181481,  maxIncome: 241974, rate: 0.13,   effectiveYear: 2025 },
  { province: "AB", minIncome: 241974,  maxIncome: 362961, rate: 0.14,   effectiveYear: 2025 },
  { province: "AB", minIncome: 362961,  maxIncome: null,   rate: 0.15,   effectiveYear: 2025 },
];

export const SASKATCHEWAN_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "SK", minIncome: 0,       maxIncome: 53463,  rate: 0.105,  effectiveYear: 2025 },
  { province: "SK", minIncome: 53463,   maxIncome: 152750, rate: 0.125,  effectiveYear: 2025 },
  { province: "SK", minIncome: 152750,  maxIncome: null,   rate: 0.145,  effectiveYear: 2025 },
];

export const MANITOBA_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "MB", minIncome: 0,       maxIncome: 47564,  rate: 0.108,  effectiveYear: 2025 },
  { province: "MB", minIncome: 47564,   maxIncome: 101200, rate: 0.1275, effectiveYear: 2025 },
  { province: "MB", minIncome: 101200,  maxIncome: null,   rate: 0.174,  effectiveYear: 2025 },
];

export const ONTARIO_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "ON", minIncome: 0,       maxIncome: 52886,  rate: 0.0505, effectiveYear: 2025 },
  { province: "ON", minIncome: 52886,   maxIncome: 105775, rate: 0.0915, effectiveYear: 2025 },
  { province: "ON", minIncome: 105775,  maxIncome: 150000, rate: 0.1116, effectiveYear: 2025 },
  { province: "ON", minIncome: 150000,  maxIncome: 220000, rate: 0.1216, effectiveYear: 2025 },
  { province: "ON", minIncome: 220000,  maxIncome: null,   rate: 0.1316, effectiveYear: 2025 },
];

export const QUEBEC_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "QC", minIncome: 0,       maxIncome: 53255,  rate: 0.14,   effectiveYear: 2025 },
  { province: "QC", minIncome: 53255,   maxIncome: 106495, rate: 0.19,   effectiveYear: 2025 },
  { province: "QC", minIncome: 106495,  maxIncome: 129590, rate: 0.24,   effectiveYear: 2025 },
  { province: "QC", minIncome: 129590,  maxIncome: null,   rate: 0.2575, effectiveYear: 2025 },
];

export const NEW_BRUNSWICK_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "NB", minIncome: 0,       maxIncome: 51306,  rate: 0.094,  effectiveYear: 2025 },
  { province: "NB", minIncome: 51306,   maxIncome: 102614, rate: 0.14,   effectiveYear: 2025 },
  { province: "NB", minIncome: 102614,  maxIncome: 190060, rate: 0.16,   effectiveYear: 2025 },
  { province: "NB", minIncome: 190060,  maxIncome: null,   rate: 0.195,  effectiveYear: 2025 },
];

export const NOVA_SCOTIA_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "NS", minIncome: 0,       maxIncome: 30507,  rate: 0.0879, effectiveYear: 2025 },
  { province: "NS", minIncome: 30507,   maxIncome: 61015,  rate: 0.1495, effectiveYear: 2025 },
  { province: "NS", minIncome: 61015,   maxIncome: 95883,  rate: 0.1667, effectiveYear: 2025 },
  { province: "NS", minIncome: 95883,   maxIncome: 154650, rate: 0.175,  effectiveYear: 2025 },
  { province: "NS", minIncome: 154650,  maxIncome: null,   rate: 0.21,   effectiveYear: 2025 },
];

export const PEI_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "PE", minIncome: 0,       maxIncome: 33328,  rate: 0.095,  effectiveYear: 2025 },
  { province: "PE", minIncome: 33328,   maxIncome: 64656,  rate: 0.1347, effectiveYear: 2025 },
  { province: "PE", minIncome: 64656,   maxIncome: 105000, rate: 0.166,  effectiveYear: 2025 },
  { province: "PE", minIncome: 105000,  maxIncome: 140000, rate: 0.1762, effectiveYear: 2025 },
  { province: "PE", minIncome: 140000,  maxIncome: null,   rate: 0.19,   effectiveYear: 2025 },
];

export const NEWFOUNDLAND_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "NL", minIncome: 0,       maxIncome: 44192,  rate: 0.087,  effectiveYear: 2025 },
  { province: "NL", minIncome: 44192,   maxIncome: 88382,  rate: 0.145,  effectiveYear: 2025 },
  { province: "NL", minIncome: 88382,   maxIncome: 157792, rate: 0.158,  effectiveYear: 2025 },
  { province: "NL", minIncome: 157792,  maxIncome: 220910, rate: 0.178,  effectiveYear: 2025 },
  { province: "NL", minIncome: 220910,  maxIncome: 282214, rate: 0.198,  effectiveYear: 2025 },
  { province: "NL", minIncome: 282214,  maxIncome: 564429, rate: 0.208,  effectiveYear: 2025 },
  { province: "NL", minIncome: 564429,  maxIncome: 1128858,rate: 0.213,  effectiveYear: 2025 },
  { province: "NL", minIncome: 1128858, maxIncome: null,   rate: 0.218,  effectiveYear: 2025 },
];

export const NUNAVUT_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "NU", minIncome: 0,       maxIncome: 54707,  rate: 0.04,   effectiveYear: 2025 },
  { province: "NU", minIncome: 54707,   maxIncome: 109413, rate: 0.07,   effectiveYear: 2025 },
  { province: "NU", minIncome: 109413,  maxIncome: 177881, rate: 0.09,   effectiveYear: 2025 },
  { province: "NU", minIncome: 177881,  maxIncome: null,   rate: 0.115,  effectiveYear: 2025 },
];

export const YUKON_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "YT", minIncome: 0,       maxIncome: 57375,  rate: 0.064,  effectiveYear: 2025 },
  { province: "YT", minIncome: 57375,   maxIncome: 114750, rate: 0.09,   effectiveYear: 2025 },
  { province: "YT", minIncome: 114750,  maxIncome: 177882, rate: 0.109,  effectiveYear: 2025 },
  { province: "YT", minIncome: 177882,  maxIncome: 500000, rate: 0.128,  effectiveYear: 2025 },
  { province: "YT", minIncome: 500000,  maxIncome: null,   rate: 0.15,   effectiveYear: 2025 },
];

export const NORTHWEST_TERRITORIES_TAX_BRACKETS_2025: TaxBracket[] = [
  { province: "NT", minIncome: 0,       maxIncome: 51964,  rate: 0.059,  effectiveYear: 2025 },
  { province: "NT", minIncome: 51964,   maxIncome: 103930, rate: 0.086,  effectiveYear: 2025 },
  { province: "NT", minIncome: 103930,  maxIncome: 168967, rate: 0.122,  effectiveYear: 2025 },
  { province: "NT", minIncome: 168967,  maxIncome: null,   rate: 0.1405, effectiveYear: 2025 },
];

// ── Keep 2024 for backward compatibility ──────────────────────────────────────
export const FEDERAL_TAX_BRACKETS_2024 = FEDERAL_TAX_BRACKETS_2025; // use 2025 as current

export const ALL_PROVINCIAL_BRACKETS_2025: Record<string, TaxBracket[]> = {
  federal: FEDERAL_TAX_BRACKETS_2025,
  BC: BC_TAX_BRACKETS_2025,
  AB: ALBERTA_TAX_BRACKETS_2025,
  SK: SASKATCHEWAN_TAX_BRACKETS_2025,
  MB: MANITOBA_TAX_BRACKETS_2025,
  ON: ONTARIO_TAX_BRACKETS_2025,
  QC: QUEBEC_TAX_BRACKETS_2025,
  NB: NEW_BRUNSWICK_TAX_BRACKETS_2025,
  NS: NOVA_SCOTIA_TAX_BRACKETS_2025,
  PE: PEI_TAX_BRACKETS_2025,
  NL: NEWFOUNDLAND_TAX_BRACKETS_2025,
  NU: NUNAVUT_TAX_BRACKETS_2025,
  YT: YUKON_TAX_BRACKETS_2025,
  NT: NORTHWEST_TERRITORIES_TAX_BRACKETS_2025,
};

// Alias for code that references 2024
export const ALL_PROVINCIAL_BRACKETS_2024 = ALL_PROVINCIAL_BRACKETS_2025;

export function calculateTaxForBrackets(income: number, brackets: TaxBracket[]): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.minIncome) break;
    const taxableInBracket = Math.min(
      income - bracket.minIncome,
      bracket.maxIncome !== null ? bracket.maxIncome - bracket.minIncome : Infinity
    );
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

export function calculateCombinedTax(
  income: number,
  province: string,
  bpaFederal: number = 16129  // 2025 BPA
): { federalTax: number; provincialTax: number; totalTax: number; effectiveRate: number; marginalRate: number } {
  const federalBrackets = FEDERAL_TAX_BRACKETS_2025;
  const provincialBrackets = ALL_PROVINCIAL_BRACKETS_2025[province];

  const taxableIncome = Math.max(0, income - bpaFederal);
  const federalTax = calculateTaxForBrackets(taxableIncome, federalBrackets);

  let provincialTax = 0;
  if (provincialBrackets) {
    provincialTax = calculateTaxForBrackets(income, provincialBrackets);
  }

  const totalTax = federalTax + provincialTax;
  const effectiveRate = income > 0 ? totalTax / income : 0;

  let marginalRate = 0;
  for (const bracket of federalBrackets) {
    if (taxableIncome > bracket.minIncome) {
      marginalRate = bracket.rate;
    }
  }
  if (provincialBrackets) {
    for (const bracket of provincialBrackets) {
      if (income > bracket.minIncome) {
        marginalRate += bracket.rate;
      }
    }
  }

  return { federalTax, provincialTax, totalTax, effectiveRate, marginalRate };
}

export function getMarginalRate(income: number, province: string): number {
  const result = calculateCombinedTax(income, province);
  return result.marginalRate;
}
