import {
  BENEFIT_RATES_2024,
  RRIF_MINIMUM_FACTORS,
  type GovernmentBenefitRate,
} from "./benefitRates.js";
import {
  ALL_PROVINCIAL_BRACKETS_2024,
  type TaxBracket,
} from "./taxBrackets.js";

export interface ReferenceDataCache {
  benefitRates: Map<string, GovernmentBenefitRate>;
  taxBrackets: Map<string, TaxBracket[]>;
  rrifFactors: Record<number, number>;
  loadedAt: Date;
}

let cachedData: ReferenceDataCache | null = null;

export interface DbTaxBracketRow {
  province: string;
  minIncome: string;
  maxIncome: string | null;
  rate: string;
  effectiveYear: number;
}

export interface DbBenefitRateRow {
  rateKey: string;
  label: string;
  value: string;
  category: string;
  effectiveYear: number;
}

export function loadReferenceDataFromDb(
  dbBrackets: DbTaxBracketRow[],
  dbRates: DbBenefitRateRow[]
): ReferenceDataCache {
  const benefitRates = new Map<string, GovernmentBenefitRate>();
  for (const row of dbRates) {
    benefitRates.set(row.rateKey, {
      key: row.rateKey,
      label: row.label,
      value: parseFloat(row.value),
      effectiveYear: row.effectiveYear,
      category: row.category,
    });
  }

  const taxBrackets = new Map<string, TaxBracket[]>();
  for (const row of dbBrackets) {
    const bracket: TaxBracket = {
      province: row.province,
      minIncome: parseFloat(row.minIncome),
      maxIncome: row.maxIncome !== null ? parseFloat(row.maxIncome) : null,
      rate: parseFloat(row.rate),
      effectiveYear: row.effectiveYear,
    };
    const existing = taxBrackets.get(row.province) ?? [];
    existing.push(bracket);
    taxBrackets.set(row.province, existing);
  }

  const provinces = Array.from(taxBrackets.keys());
  for (const province of provinces) {
    const brackets = taxBrackets.get(province)!;
    taxBrackets.set(province, brackets.sort((a, b) => a.minIncome - b.minIncome));
  }

  cachedData = {
    benefitRates,
    taxBrackets,
    rrifFactors: { ...RRIF_MINIMUM_FACTORS },
    loadedAt: new Date(),
  };

  return cachedData;
}

export function loadReferenceDataFromConstants(): ReferenceDataCache {
  const benefitRates = new Map<string, GovernmentBenefitRate>();
  for (const rate of BENEFIT_RATES_2024) {
    benefitRates.set(rate.key, rate);
  }

  const taxBrackets = new Map<string, TaxBracket[]>();
  for (const [province, brackets] of Object.entries(ALL_PROVINCIAL_BRACKETS_2024)) {
    taxBrackets.set(province, [...brackets]);
  }

  cachedData = {
    benefitRates,
    taxBrackets,
    rrifFactors: { ...RRIF_MINIMUM_FACTORS },
    loadedAt: new Date(),
  };

  return cachedData;
}

export function getReferenceData(): ReferenceDataCache {
  if (!cachedData) {
    return loadReferenceDataFromConstants();
  }
  return cachedData;
}

export function getBenefitRate(key: string): number {
  const cache = getReferenceData();
  const rate = cache.benefitRates.get(key);
  if (!rate) {
    throw new Error(`Benefit rate not found in cache: ${key}`);
  }
  return rate.value;
}

export function getTaxBrackets(province: string): TaxBracket[] {
  const cache = getReferenceData();
  const brackets = cache.taxBrackets.get(province);
  if (!brackets) {
    return cache.taxBrackets.get("ON") ?? [];
  }
  return brackets;
}

export function getAvailableProvinces(): string[] {
  const cache = getReferenceData();
  return Array.from(cache.taxBrackets.keys()).filter((k) => k !== "federal");
}

export function isCacheLoaded(): boolean {
  return cachedData !== null;
}

export function getCachedRrifFactor(age: number): number {
  const cache = getReferenceData();
  if (age < 71) return 0;
  if (age >= 95) return cache.rrifFactors[95] ?? 0.20;
  return cache.rrifFactors[age] ?? 0;
}

export function getCachedRrifWithdrawal(age: number, balance: number): number {
  return balance * getCachedRrifFactor(age);
}
