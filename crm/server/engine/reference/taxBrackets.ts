export interface TaxBracket {
  province: string;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
  effectiveYear: number;
}

export const FEDERAL_TAX_BRACKETS_2024: TaxBracket[] = [
  {
    province: "federal",
    minIncome: 0,
    maxIncome: 55867,
    rate: 0.15,
    effectiveYear: 2024,
  },
  {
    province: "federal",
    minIncome: 55867,
    maxIncome: 111733,
    rate: 0.205,
    effectiveYear: 2024,
  },
  {
    province: "federal",
    minIncome: 111733,
    maxIncome: 154906,
    rate: 0.26,
    effectiveYear: 2024,
  },
  {
    province: "federal",
    minIncome: 154906,
    maxIncome: 220000,
    rate: 0.29,
    effectiveYear: 2024,
  },
  {
    province: "federal",
    minIncome: 220000,
    maxIncome: null,
    rate: 0.33,
    effectiveYear: 2024,
  },
];

export const ONTARIO_TAX_BRACKETS_2024: TaxBracket[] = [
  {
    province: "ON",
    minIncome: 0,
    maxIncome: 51446,
    rate: 0.0505,
    effectiveYear: 2024,
  },
  {
    province: "ON",
    minIncome: 51446,
    maxIncome: 102894,
    rate: 0.0915,
    effectiveYear: 2024,
  },
  {
    province: "ON",
    minIncome: 102894,
    maxIncome: 150000,
    rate: 0.1116,
    effectiveYear: 2024,
  },
  {
    province: "ON",
    minIncome: 150000,
    maxIncome: 220000,
    rate: 0.1216,
    effectiveYear: 2024,
  },
  {
    province: "ON",
    minIncome: 220000,
    maxIncome: null,
    rate: 0.1316,
    effectiveYear: 2024,
  },
];

export const BC_TAX_BRACKETS_2024: TaxBracket[] = [
  {
    province: "BC",
    minIncome: 0,
    maxIncome: 45654,
    rate: 0.0506,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 45654,
    maxIncome: 91310,
    rate: 0.077,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 91310,
    maxIncome: 104835,
    rate: 0.105,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 104835,
    maxIncome: 127299,
    rate: 0.1229,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 127299,
    maxIncome: 172602,
    rate: 0.147,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 172602,
    maxIncome: 240716,
    rate: 0.168,
    effectiveYear: 2024,
  },
  {
    province: "BC",
    minIncome: 240716,
    maxIncome: null,
    rate: 0.205,
    effectiveYear: 2024,
  },
];

export const ALBERTA_TAX_BRACKETS_2024: TaxBracket[] = [
  {
    province: "AB",
    minIncome: 0,
    maxIncome: 148269,
    rate: 0.1,
    effectiveYear: 2024,
  },
  {
    province: "AB",
    minIncome: 148269,
    maxIncome: 177922,
    rate: 0.12,
    effectiveYear: 2024,
  },
  {
    province: "AB",
    minIncome: 177922,
    maxIncome: 237230,
    rate: 0.13,
    effectiveYear: 2024,
  },
  {
    province: "AB",
    minIncome: 237230,
    maxIncome: 355845,
    rate: 0.14,
    effectiveYear: 2024,
  },
  {
    province: "AB",
    minIncome: 355845,
    maxIncome: null,
    rate: 0.15,
    effectiveYear: 2024,
  },
];

export const QUEBEC_TAX_BRACKETS_2024: TaxBracket[] = [
  {
    province: "QC",
    minIncome: 0,
    maxIncome: 51780,
    rate: 0.14,
    effectiveYear: 2024,
  },
  {
    province: "QC",
    minIncome: 51780,
    maxIncome: 103545,
    rate: 0.19,
    effectiveYear: 2024,
  },
  {
    province: "QC",
    minIncome: 103545,
    maxIncome: 126000,
    rate: 0.24,
    effectiveYear: 2024,
  },
  {
    province: "QC",
    minIncome: 126000,
    maxIncome: null,
    rate: 0.2575,
    effectiveYear: 2024,
  },
];

export const ALL_PROVINCIAL_BRACKETS_2024: Record<string, TaxBracket[]> = {
  federal: FEDERAL_TAX_BRACKETS_2024,
  ON: ONTARIO_TAX_BRACKETS_2024,
  BC: BC_TAX_BRACKETS_2024,
  AB: ALBERTA_TAX_BRACKETS_2024,
  QC: QUEBEC_TAX_BRACKETS_2024,
};

export function calculateTaxForBrackets(
  income: number,
  brackets: TaxBracket[],
): number {
  let tax = 0;
  for (const bracket of brackets) {
    if (income <= bracket.minIncome) break;
    const taxableInBracket = Math.min(
      income - bracket.minIncome,
      bracket.maxIncome !== null
        ? bracket.maxIncome - bracket.minIncome
        : Infinity,
    );
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

export function calculateCombinedTax(
  income: number,
  province: string,
  bpaFederal: number = 15705,
): {
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  effectiveRate: number;
  marginalRate: number;
} {
  const federalBrackets = FEDERAL_TAX_BRACKETS_2024;
  const provincialBrackets = ALL_PROVINCIAL_BRACKETS_2024[province];

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
