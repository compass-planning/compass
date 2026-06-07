/**
 * usTaxData2025.ts
 * US federal and state tax reference data for 2025 and 2026.
 * Reflects OBBBA (July 2025) and SECURE 2.0 phase-ins.
 * Mirrors the structure of taxBrackets.ts (Canadian) so the same
 * calculateTaxForBrackets() helper works for both jurisdictions.
 *
 * Sources: Rev. Proc. 2024-40 (2025), Rev. Proc. 2025-32 (2026),
 *          IRS Notice 2024-80 / 2025-67, SSA Fact Sheet 10/2025,
 *          CMS 2025 Medicare premiums, OBBBA (P.L. 119-21).
 */

// ── Shared bracket type (same interface as Canadian side) ──────────────────────
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

// ── Standard Deductions ────────────────────────────────────────────────────────

export const US_STANDARD_DEDUCTION_2025: Record<FilingStatus, number> = {
  single: 15_000,
  mfj:    30_000,
  mfs:    15_000,
  hoh:    22_500,
};

export const US_STANDARD_DEDUCTION_2026: Record<FilingStatus, number> = {
  single: 16_100,
  mfj:    32_200,
  mfs:    16_100,
  hoh:    24_150,
};

// Extra standard deduction for age 65+ / blind (per qualifying condition)
export const US_ADDITIONAL_STANDARD_DEDUCTION_2025 = {
  single_or_hoh: 2_000,
  mfj_or_mfs:    1_600,   // per spouse / per condition
};

// OBBBA senior bonus deduction (age 65+, above-the-line, 2025–2028)
// Phases out $75K–$175K MAGI single / $150K–$250K MFJ
export const US_SENIOR_BONUS_DEDUCTION_2025 = {
  amount:           6_000,  // per spouse age 65+
  phaseoutStart: { single: 75_000,  mfj: 150_000 },
  phaseoutEnd:   { single: 175_000, mfj: 250_000 },
};

// ── 2025 Federal Ordinary-Income Brackets ─────────────────────────────────────

export const US_FEDERAL_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "federal", filingStatus: "single", minIncome: 0,       maxIncome: 11_925,  rate: 0.10, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 11_925,  maxIncome: 48_475,  rate: 0.12, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 48_475,  maxIncome: 103_350, rate: 0.22, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 103_350, maxIncome: 197_300, rate: 0.24, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 197_300, maxIncome: 250_525, rate: 0.32, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 250_525, maxIncome: 626_350, rate: 0.35, effectiveYear: 2025 },
  { state: "federal", filingStatus: "single", minIncome: 626_350, maxIncome: null,    rate: 0.37, effectiveYear: 2025 },
];

export const US_FEDERAL_BRACKETS_2025_MFJ: UsTaxBracket[] = [
  { state: "federal", filingStatus: "mfj", minIncome: 0,        maxIncome: 23_850,  rate: 0.10, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 23_850,   maxIncome: 96_950,  rate: 0.12, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 96_950,   maxIncome: 206_700, rate: 0.22, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 206_700,  maxIncome: 394_600, rate: 0.24, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 394_600,  maxIncome: 501_050, rate: 0.32, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 501_050,  maxIncome: 751_600, rate: 0.35, effectiveYear: 2025 },
  { state: "federal", filingStatus: "mfj", minIncome: 751_600,  maxIncome: null,    rate: 0.37, effectiveYear: 2025 },
];

export const US_FEDERAL_BRACKETS_2025_HOH: UsTaxBracket[] = [
  { state: "federal", filingStatus: "hoh", minIncome: 0,        maxIncome: 17_000,  rate: 0.10, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 17_000,   maxIncome: 64_850,  rate: 0.12, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 64_850,   maxIncome: 103_350, rate: 0.22, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 103_350,  maxIncome: 197_300, rate: 0.24, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 197_300,  maxIncome: 250_500, rate: 0.32, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 250_500,  maxIncome: 626_350, rate: 0.35, effectiveYear: 2025 },
  { state: "federal", filingStatus: "hoh", minIncome: 626_350,  maxIncome: null,    rate: 0.37, effectiveYear: 2025 },
];

// MFS — same breakpoints as single
export const US_FEDERAL_BRACKETS_2025_MFS = US_FEDERAL_BRACKETS_2025_SINGLE.map(b => ({
  ...b, filingStatus: "mfs" as FilingStatus,
}));

// ── 2026 Federal Ordinary-Income Brackets (Rev. Proc. 2025-32) ────────────────

export const US_FEDERAL_BRACKETS_2026_SINGLE: UsTaxBracket[] = [
  { state: "federal", filingStatus: "single", minIncome: 0,        maxIncome: 12_400,  rate: 0.10, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 12_400,   maxIncome: 50_400,  rate: 0.12, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 50_400,   maxIncome: 107_400, rate: 0.22, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 107_400,  maxIncome: 205_050, rate: 0.24, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 205_050,  maxIncome: 260_350, rate: 0.32, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 260_350,  maxIncome: 651_050, rate: 0.35, effectiveYear: 2026 },
  { state: "federal", filingStatus: "single", minIncome: 651_050,  maxIncome: null,    rate: 0.37, effectiveYear: 2026 },
];

export const US_FEDERAL_BRACKETS_2026_MFJ: UsTaxBracket[] = [
  { state: "federal", filingStatus: "mfj", minIncome: 0,        maxIncome: 24_800,  rate: 0.10, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 24_800,   maxIncome: 100_800, rate: 0.12, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 100_800,  maxIncome: 214_800, rate: 0.22, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 214_800,  maxIncome: 410_100, rate: 0.24, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 410_100,  maxIncome: 520_700, rate: 0.32, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 520_700,  maxIncome: 781_250, rate: 0.35, effectiveYear: 2026 },
  { state: "federal", filingStatus: "mfj", minIncome: 781_250,  maxIncome: null,    rate: 0.37, effectiveYear: 2026 },
];

export const US_FEDERAL_BRACKETS_2026_HOH: UsTaxBracket[] = [
  { state: "federal", filingStatus: "hoh", minIncome: 0,        maxIncome: 17_700,  rate: 0.10, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 17_700,   maxIncome: 67_450,  rate: 0.12, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 67_450,   maxIncome: 107_400, rate: 0.22, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 107_400,  maxIncome: 205_050, rate: 0.24, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 205_050,  maxIncome: 260_350, rate: 0.32, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 260_350,  maxIncome: 651_050, rate: 0.35, effectiveYear: 2026 },
  { state: "federal", filingStatus: "hoh", minIncome: 651_050,  maxIncome: null,    rate: 0.37, effectiveYear: 2026 },
];

export const US_FEDERAL_BRACKETS_2026_MFS = US_FEDERAL_BRACKETS_2026_SINGLE.map(b => ({
  ...b, filingStatus: "mfs" as FilingStatus,
}));

// ── Long-Term Capital Gains Brackets ──────────────────────────────────────────

export interface LtcgBracket {
  filingStatus: FilingStatus;
  minIncome: number;
  maxIncome: number | null;
  rate: number;
}

// 2025 LTCG (taxable income thresholds — gains stack on top of ordinary income)
export const US_LTCG_BRACKETS_2025: LtcgBracket[] = [
  { filingStatus: "single", minIncome: 0,        maxIncome: 48_350,  rate: 0.00 },
  { filingStatus: "single", minIncome: 48_350,   maxIncome: 533_400, rate: 0.15 },
  { filingStatus: "single", minIncome: 533_400,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "mfj",    minIncome: 0,        maxIncome: 96_700,  rate: 0.00 },
  { filingStatus: "mfj",    minIncome: 96_700,   maxIncome: 600_050, rate: 0.15 },
  { filingStatus: "mfj",    minIncome: 600_050,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "hoh",    minIncome: 0,        maxIncome: 64_750,  rate: 0.00 },
  { filingStatus: "hoh",    minIncome: 64_750,   maxIncome: 566_700, rate: 0.15 },
  { filingStatus: "hoh",    minIncome: 566_700,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "mfs",    minIncome: 0,        maxIncome: 48_350,  rate: 0.00 },
  { filingStatus: "mfs",    minIncome: 48_350,   maxIncome: 300_000, rate: 0.15 },
  { filingStatus: "mfs",    minIncome: 300_000,  maxIncome: null,    rate: 0.20 },
];

// 2026 LTCG (Rev. Proc. 2025-32)
export const US_LTCG_BRACKETS_2026: LtcgBracket[] = [
  { filingStatus: "single", minIncome: 0,        maxIncome: 49_450,  rate: 0.00 },
  { filingStatus: "single", minIncome: 49_450,   maxIncome: 552_300, rate: 0.15 },
  { filingStatus: "single", minIncome: 552_300,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "mfj",    minIncome: 0,        maxIncome: 98_900,  rate: 0.00 },
  { filingStatus: "mfj",    minIncome: 98_900,   maxIncome: 621_400, rate: 0.15 },
  { filingStatus: "mfj",    minIncome: 621_400,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "hoh",    minIncome: 0,        maxIncome: 66_200,  rate: 0.00 },
  { filingStatus: "hoh",    minIncome: 66_200,   maxIncome: 586_850, rate: 0.15 },
  { filingStatus: "hoh",    minIncome: 586_850,  maxIncome: null,    rate: 0.20 },
  { filingStatus: "mfs",    minIncome: 0,        maxIncome: 49_450,  rate: 0.00 },
  { filingStatus: "mfs",    minIncome: 49_450,   maxIncome: 310_700, rate: 0.15 },
  { filingStatus: "mfs",    minIncome: 310_700,  maxIncome: null,    rate: 0.20 },
];

// ── Net Investment Income Tax (NIIT) 3.8% ─────────────────────────────────────
// NOT indexed — thresholds unchanged since 2013

export const US_NIIT_THRESHOLDS_2025: Record<FilingStatus, number> = {
  single: 200_000,
  mfj:    250_000,
  mfs:    125_000,
  hoh:    200_000,
};
// 2026 thresholds are identical (unindexed by statute)
export const US_NIIT_THRESHOLDS_2026 = US_NIIT_THRESHOLDS_2025;
export const US_NIIT_RATE = 0.038;

// ── Additional Medicare Tax 0.9% ──────────────────────────────────────────────
// NOT indexed

export const US_ADDITIONAL_MEDICARE_TAX_THRESHOLDS: Record<FilingStatus, number> = {
  single: 200_000,
  mfj:    250_000,
  mfs:    125_000,
  hoh:    200_000,
};
export const US_ADDITIONAL_MEDICARE_RATE = 0.009;

// ── Social Security Wage Base ──────────────────────────────────────────────────

// US_SS_EMPLOYEE_RATE and US_MEDICARE_RATE are defined in usBenefitRates2025.ts
export const US_SS_WAGE_BASE = {
  2025: 176_100,
  2026: 183_600,
};

// ── IRMAA Tiers 2025 (Medicare Part B + D surcharges) ─────────────────────────
// Uses MAGI from 2 years prior (2025 IRMAA uses 2023 MAGI).
// Amounts are per beneficiary per month, additional above base premium ($185.00/mo Part B).

export interface IrmaaTier {
  tier:          number;
  magiSingle:    number;   // upper threshold (exclusive); null = no limit
  magiMfj:       number;
  partBExtra:    number;   // $/month additional per person
  partDExtra:    number;   // $/month additional per person
}

export const US_IRMAA_TIERS_2025: IrmaaTier[] = [
  { tier: 0, magiSingle: 106_000, magiMfj: 212_000, partBExtra: 0,      partDExtra: 0     },
  { tier: 1, magiSingle: 133_000, magiMfj: 266_000, partBExtra: 74.00,  partDExtra: 13.70 },
  { tier: 2, magiSingle: 167_000, magiMfj: 334_000, partBExtra: 185.00, partDExtra: 35.30 },
  { tier: 3, magiSingle: 200_000, magiMfj: 400_000, partBExtra: 295.90, partDExtra: 57.00 },
  { tier: 4, magiSingle: 500_000, magiMfj: 750_000, partBExtra: 406.90, partDExtra: 78.60 },
  { tier: 5, magiSingle: Infinity, magiMfj: Infinity, partBExtra: 443.90, partDExtra: 85.80 },
];

export const US_IRMAA_BASE_PART_B_2025 = 185.00; // per person per month

/** Return annual IRMAA surcharge per person for a given MAGI and filing status. */
export function calculateIrmaa(magi: number, filingStatus: FilingStatus): {
  annualPartBExtra: number;
  annualPartDExtra: number;
  tier: number;
} {
  const isMfj = filingStatus === "mfj";
  for (const t of US_IRMAA_TIERS_2025) {
    const threshold = isMfj ? t.magiMfj : t.magiSingle;
    if (magi <= threshold) {
      return {
        annualPartBExtra: t.partBExtra * 12,
        annualPartDExtra: t.partDExtra * 12,
        tier: t.tier,
      };
    }
  }
  const top = US_IRMAA_TIERS_2025[US_IRMAA_TIERS_2025.length - 1];
  return { annualPartBExtra: top.partBExtra * 12, annualPartDExtra: top.partDExtra * 12, tier: top.tier };
}

// ── Retirement Contribution Limits ────────────────────────────────────────────

export const US_RETIREMENT_LIMITS = {
  2025: {
    k401_deferral:            23_500,
    k401_catchup_50:           7_500,
    k401_catchup_60_63:       11_250,  // SECURE 2.0 — greater of $10K or 150% of regular catch-up
    k401_total_additions:     70_000,  // §415(c)
    ira_contribution:          7_000,
    ira_catchup_50:            1_000,
    roth_phaseout_single_lo: 150_000,
    roth_phaseout_single_hi: 165_000,
    roth_phaseout_mfj_lo:    236_000,
    roth_phaseout_mfj_hi:    246_000,
    trad_ira_deduct_single_lo:  79_000,
    trad_ira_deduct_single_hi:  89_000,
    trad_ira_deduct_mfj_lo:    126_000,
    trad_ira_deduct_mfj_hi:    146_000,
    simple_deferral:          16_500,
    simple_catchup_50:         3_500,
    simple_catchup_60_63:      5_250,
    sep_total:                70_000,  // same as §415(c)
    hsa_single:                4_300,
    hsa_family:                8_550,
    hsa_catchup_55:            1_000,
    fsa_health:                3_300,
    db_annual_benefit:       280_000,
    comp_cap:                350_000,  // §401(a)(17)
    hce_threshold:           160_000,
    qcd_limit:               108_000,
    annual_gift_exclusion:    19_000,
    estate_exemption:      13_990_000,
    ss_wage_base:            176_100,
  },
  2026: {
    k401_deferral:            24_500,
    k401_catchup_50:           8_000,
    k401_catchup_60_63:       11_250,  // estimated; at least 150% of $8K = $12K — use conservative $11,250 until IRS confirms
    k401_total_additions:     72_000,
    ira_contribution:          7_000,
    ira_catchup_50:            1_000,
    roth_phaseout_single_lo: 153_000,
    roth_phaseout_single_hi: 168_000,
    roth_phaseout_mfj_lo:    242_000,
    roth_phaseout_mfj_hi:    252_000,
    trad_ira_deduct_single_lo:  81_000,
    trad_ira_deduct_single_hi:  91_000,
    trad_ira_deduct_mfj_lo:    130_000,
    trad_ira_deduct_mfj_hi:    150_000,
    simple_deferral:          17_000,
    simple_catchup_50:         4_000,
    simple_catchup_60_63:      5_250,
    sep_total:                72_000,
    hsa_single:                4_400,
    hsa_family:                8_750,
    hsa_catchup_55:            1_000,
    fsa_health:                3_400,
    db_annual_benefit:       290_000,
    comp_cap:                360_000,
    hce_threshold:           165_000,
    qcd_limit:               110_000,
    annual_gift_exclusion:    19_000,  // rounds in $1K increments; may move to $20K
    estate_exemption:      15_000_000, // estimated with chained CPI
    ss_wage_base:            183_600,
  },
} as const;

// getRmdStartAge() is defined in usBenefitRates2025.ts

// ── Social Security Benefit Taxation Thresholds (§86) ─────────────────────────
// NOT indexed since 1984/1993 — same for 2025 and 2026

export const US_SS_TAXATION = {
  // Provisional income = AGI + tax-exempt interest + 50% of SS benefits
  mfj: { tier1Start: 32_000, tier2Start: 44_000 },
  single: { tier1Start: 25_000, tier2Start: 34_000 },
  // Below tier1: 0% of SS taxable
  // tier1–tier2: up to 50% of SS taxable
  // Above tier2: up to 85% of SS taxable (maximum)
};

// ── AMT Parameters ────────────────────────────────────────────────────────────

export const US_AMT = {
  2025: {
    exemption_single: 88_100,
    exemption_mfj:   137_000,
    phaseout_single: 626_350,
    phaseout_mfj:  1_252_700,
    rate1: 0.26,   // on AMTI up to $239,100 above exemption
    rate2: 0.28,   // above $239,100
    rate1_threshold: 239_100,
  },
  2026: {
    exemption_single: 90_500,
    exemption_mfj:   140_700,
    phaseout_single: 649_000,   // estimated
    phaseout_mfj:  1_298_000,
    rate1: 0.26,
    rate2: 0.28,
    rate1_threshold: 246_000,
  },
};

// ── QBI Deduction Phaseout (§199A, OBBBA-permanent) ──────────────────────────

export const US_QBI_SSTB_PHASEOUT = {
  2025: {
    single_lo: 241_950,
    single_hi: 291_950,
    mfj_lo:    483_900,
    mfj_hi:    583_900,
  },
  2026: {
    single_lo: 248_000,
    single_hi: 298_000,
    mfj_lo:    496_000,
    mfj_hi:    596_000,
  },
};

// ── State Brackets 2025 ───────────────────────────────────────────────────────
// Single-filer rates; MFJ typically doubles thresholds unless noted.
// Sources: state DOR publications, Tax Foundation 2025 tables.

// California — 1%–12.3% (+ 1% Mental Health Services Tax > $1M = 13.3% top)
export const CA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "CA", filingStatus: "single", minIncome: 0,          maxIncome: 10_412,    rate: 0.01,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 10_412,     maxIncome: 24_684,    rate: 0.02,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 24_684,     maxIncome: 38_959,    rate: 0.04,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 38_959,     maxIncome: 54_081,    rate: 0.06,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 54_081,     maxIncome: 68_350,    rate: 0.08,   effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 68_350,     maxIncome: 349_137,   rate: 0.093,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 349_137,    maxIncome: 418_961,   rate: 0.103,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 418_961,    maxIncome: 698_274,   rate: 0.113,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 698_274,    maxIncome: 1_000_000, rate: 0.123,  effectiveYear: 2025 },
  { state: "CA", filingStatus: "single", minIncome: 1_000_000,  maxIncome: null,      rate: 0.133,  effectiveYear: 2025 },
];

// New York — 2025 single (top 10.9% above $25M)
export const NY_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NY", filingStatus: "single", minIncome: 0,           maxIncome: 17_150,    rate: 0.04,   effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 17_150,      maxIncome: 23_600,    rate: 0.045,  effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 23_600,      maxIncome: 27_900,    rate: 0.0525, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 27_900,      maxIncome: 161_550,   rate: 0.0585, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 161_550,     maxIncome: 323_200,   rate: 0.0625, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 323_200,     maxIncome: 2_155_350, rate: 0.0685, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 2_155_350,   maxIncome: 5_000_000, rate: 0.0965, effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 5_000_000,   maxIncome: 25_000_000,rate: 0.103,  effectiveYear: 2025 },
  { state: "NY", filingStatus: "single", minIncome: 25_000_000,  maxIncome: null,      rate: 0.109,  effectiveYear: 2025 },
];

// Texas — no state income tax
export const TX_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "TX", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Florida — no state income tax
export const FL_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "FL", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Washington — no wage income tax (7% LTCG excise on gains > ~$270K not modeled here)
export const WA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "WA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 },
];

// Illinois — flat 4.95%
export const IL_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "IL", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0495, effectiveYear: 2025 },
];

// Pennsylvania — flat 3.07%
export const PA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "PA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0307, effectiveYear: 2025 },
];

// Ohio — 2025: 0% / 2.765% / 3.5% (two taxable brackets; 0% up to $26,050)
export const OH_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "OH", filingStatus: "single", minIncome: 0,        maxIncome: 26_050,  rate: 0,       effectiveYear: 2025 },
  { state: "OH", filingStatus: "single", minIncome: 26_050,   maxIncome: 100_000, rate: 0.02765, effectiveYear: 2025 },
  { state: "OH", filingStatus: "single", minIncome: 100_000,  maxIncome: null,    rate: 0.035,   effectiveYear: 2025 },
];

// Georgia — flat 5.19% (2025; scheduled to 4.99% by 2028)
export const GA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "GA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0519, effectiveYear: 2025 },
];

// North Carolina — flat 4.25% (2025; scheduled to 3.99% in 2026)
export const NC_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NC", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0425, effectiveYear: 2025 },
];

// Virginia — graduated; effectively near-flat above $17K
export const VA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "VA", filingStatus: "single", minIncome: 0,      maxIncome: 3_000,  rate: 0.02,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 3_000,  maxIncome: 5_000,  rate: 0.03,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 5_000,  maxIncome: 17_000, rate: 0.05,   effectiveYear: 2025 },
  { state: "VA", filingStatus: "single", minIncome: 17_000, maxIncome: null,   rate: 0.0575, effectiveYear: 2025 },
];

// Arizona — flat 2.5%
export const AZ_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "AZ", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.025, effectiveYear: 2025 },
];

// Colorado — flat 4.4%
export const CO_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "CO", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.044, effectiveYear: 2025 },
];

// Michigan — flat 4.25% (2025; was briefly 4.05% in 2023 only — reverted)
export const MI_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MI", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0425, effectiveYear: 2025 },
];

// Minnesota — graduated; + 1% surcharge on NII > $1M (not modeled here)
export const MN_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MN", filingStatus: "single", minIncome: 0,        maxIncome: 31_690,  rate: 0.0535, effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 31_690,   maxIncome: 104_090, rate: 0.068,  effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 104_090,  maxIncome: 183_340, rate: 0.0785, effectiveYear: 2025 },
  { state: "MN", filingStatus: "single", minIncome: 183_340,  maxIncome: null,    rate: 0.0985, effectiveYear: 2025 },
];

// Massachusetts — flat 5% + 4% millionaire's surtax above ~$1.083M (indexed)
export const MA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MA", filingStatus: "single", minIncome: 0,         maxIncome: 1_083_150, rate: 0.05, effectiveYear: 2025 },
  { state: "MA", filingStatus: "single", minIncome: 1_083_150, maxIncome: null,      rate: 0.09, effectiveYear: 2025 },
];

// New Jersey — graduated; top 10.75% above $1M
export const NJ_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NJ", filingStatus: "single", minIncome: 0,         maxIncome: 20_000,  rate: 0.014,  effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 20_000,    maxIncome: 35_000,  rate: 0.0175, effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 35_000,    maxIncome: 40_000,  rate: 0.035,  effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 40_000,    maxIncome: 75_000,  rate: 0.05525,effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 75_000,    maxIncome: 500_000, rate: 0.0637, effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 500_000,   maxIncome: 1_000_000,rate: 0.0897,effectiveYear: 2025 },
  { state: "NJ", filingStatus: "single", minIncome: 1_000_000, maxIncome: null,    rate: 0.1075, effectiveYear: 2025 },
];

// Oregon — graduated; top 9.9% above $125K single
export const OR_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "OR", filingStatus: "single", minIncome: 0,        maxIncome: 4_050,   rate: 0.0475, effectiveYear: 2025 },
  { state: "OR", filingStatus: "single", minIncome: 4_050,    maxIncome: 10_200,  rate: 0.0675, effectiveYear: 2025 },
  { state: "OR", filingStatus: "single", minIncome: 10_200,   maxIncome: 125_000, rate: 0.0875, effectiveYear: 2025 },
  { state: "OR", filingStatus: "single", minIncome: 125_000,  maxIncome: null,    rate: 0.099,  effectiveYear: 2025 },
];

// Maryland — graduated; does NOT include county tax (2.25%–3.20% added separately)
export const MD_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MD", filingStatus: "single", minIncome: 0,        maxIncome: 1_000,   rate: 0.02,   effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 1_000,    maxIncome: 2_000,   rate: 0.03,   effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 2_000,    maxIncome: 3_000,   rate: 0.04,   effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 3_000,    maxIncome: 100_000, rate: 0.0475, effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 100_000,  maxIncome: 125_000, rate: 0.05,   effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 125_000,  maxIncome: 150_000, rate: 0.0525, effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 150_000,  maxIncome: 250_000, rate: 0.055,  effectiveYear: 2025 },
  { state: "MD", filingStatus: "single", minIncome: 250_000,  maxIncome: null,    rate: 0.0575, effectiveYear: 2025 },
];

// Connecticut — graduated; top 6.99%
export const CT_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "CT", filingStatus: "single", minIncome: 0,        maxIncome: 10_000,  rate: 0.02,   effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 10_000,   maxIncome: 50_000,  rate: 0.045,  effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 50_000,   maxIncome: 100_000, rate: 0.055,  effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 100_000,  maxIncome: 200_000, rate: 0.06,   effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 200_000,  maxIncome: 250_000, rate: 0.065,  effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 250_000,  maxIncome: 500_000, rate: 0.069,  effectiveYear: 2025 },
  { state: "CT", filingStatus: "single", minIncome: 500_000,  maxIncome: null,    rate: 0.0699, effectiveYear: 2025 },
];

// Wisconsin — graduated; top 7.65%
export const WI_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "WI", filingStatus: "single", minIncome: 0,        maxIncome: 14_320,  rate: 0.035,  effectiveYear: 2025 },
  { state: "WI", filingStatus: "single", minIncome: 14_320,   maxIncome: 28_640,  rate: 0.044,  effectiveYear: 2025 },
  { state: "WI", filingStatus: "single", minIncome: 28_640,   maxIncome: 315_310, rate: 0.053,  effectiveYear: 2025 },
  { state: "WI", filingStatus: "single", minIncome: 315_310,  maxIncome: null,    rate: 0.0765, effectiveYear: 2025 },
];

// Iowa — flat 3.8% (2025)
export const IA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "IA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.038, effectiveYear: 2025 },
];

// Kentucky — flat 4.0% (2025; scheduled 3.5% in 2026)
export const KY_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "KY", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.04, effectiveYear: 2025 },
];

// Indiana — flat 3.0% (2025; + county LIT not modeled here)
export const IN_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "IN", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.03, effectiveYear: 2025 },
];

// Missouri — graduated; top 4.7%
export const MO_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MO", filingStatus: "single", minIncome: 0,       maxIncome: 1_207,   rate: 0,      effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 1_207,   maxIncome: 2_414,   rate: 0.015,  effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 2_414,   maxIncome: 3_621,   rate: 0.02,   effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 3_621,   maxIncome: 4_828,   rate: 0.025,  effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 4_828,   maxIncome: 6_035,   rate: 0.03,   effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 6_035,   maxIncome: 7_242,   rate: 0.035,  effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 7_242,   maxIncome: 8_449,   rate: 0.04,   effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 8_449,   maxIncome: 9_656,   rate: 0.045,  effectiveYear: 2025 },
  { state: "MO", filingStatus: "single", minIncome: 9_656,   maxIncome: null,    rate: 0.047,  effectiveYear: 2025 },
];

// Utah — flat 4.55%
export const UT_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "UT", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.0455, effectiveYear: 2025 },
];

// Louisiana — flat 3.0% (2025; reformed from graduated)
export const LA_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "LA", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.03, effectiveYear: 2025 },
];

// Mississippi — flat 4.4% (2025; phasing to 3.0% by 2030)
export const MS_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MS", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.044, effectiveYear: 2025 },
];

// Arkansas — graduated; top 3.9%
export const AR_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "AR", filingStatus: "single", minIncome: 0,       maxIncome: 4_300,   rate: 0.02,  effectiveYear: 2025 },
  { state: "AR", filingStatus: "single", minIncome: 4_300,   maxIncome: 8_500,   rate: 0.04,  effectiveYear: 2025 },
  { state: "AR", filingStatus: "single", minIncome: 8_500,   maxIncome: null,    rate: 0.039, effectiveYear: 2025 },
];

// South Carolina — graduated; top 6.2%
export const SC_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "SC", filingStatus: "single", minIncome: 0,       maxIncome: 3_460,   rate: 0,     effectiveYear: 2025 },
  { state: "SC", filingStatus: "single", minIncome: 3_460,   maxIncome: 17_330,  rate: 0.03,  effectiveYear: 2025 },
  { state: "SC", filingStatus: "single", minIncome: 17_330,  maxIncome: null,    rate: 0.062, effectiveYear: 2025 },
];

// Idaho — flat 5.3%
export const ID_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "ID", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.053, effectiveYear: 2025 },
];

// Nebraska — graduated; top 5.20% (phasing to 3.99% by 2027)
export const NE_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NE", filingStatus: "single", minIncome: 0,       maxIncome: 3_700,   rate: 0.0246, effectiveYear: 2025 },
  { state: "NE", filingStatus: "single", minIncome: 3_700,   maxIncome: 22_170,  rate: 0.0351, effectiveYear: 2025 },
  { state: "NE", filingStatus: "single", minIncome: 22_170,  maxIncome: 35_730,  rate: 0.0501, effectiveYear: 2025 },
  { state: "NE", filingStatus: "single", minIncome: 35_730,  maxIncome: null,    rate: 0.052,  effectiveYear: 2025 },
];

// Kansas — graduated; top 5.58%
export const KS_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "KS", filingStatus: "single", minIncome: 0,       maxIncome: 15_000,  rate: 0.031,  effectiveYear: 2025 },
  { state: "KS", filingStatus: "single", minIncome: 15_000,  maxIncome: 30_000,  rate: 0.0525, effectiveYear: 2025 },
  { state: "KS", filingStatus: "single", minIncome: 30_000,  maxIncome: null,    rate: 0.057,  effectiveYear: 2025 },
];

// Hawaii — graduated; top 11%
export const HI_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "HI", filingStatus: "single", minIncome: 0,        maxIncome: 2_400,   rate: 0.014,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 2_400,    maxIncome: 4_800,   rate: 0.032,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 4_800,    maxIncome: 9_600,   rate: 0.055,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 9_600,    maxIncome: 14_400,  rate: 0.064,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 14_400,   maxIncome: 19_200,  rate: 0.068,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 19_200,   maxIncome: 24_000,  rate: 0.072,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 24_000,   maxIncome: 36_000,  rate: 0.076,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 36_000,   maxIncome: 48_000,  rate: 0.079,  effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 48_000,   maxIncome: 150_000, rate: 0.0825, effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 150_000,  maxIncome: 175_000, rate: 0.09,   effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 175_000,  maxIncome: 200_000, rate: 0.10,   effectiveYear: 2025 },
  { state: "HI", filingStatus: "single", minIncome: 200_000,  maxIncome: null,    rate: 0.11,   effectiveYear: 2025 },
];

// Vermont — graduated; top 8.75%
export const VT_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "VT", filingStatus: "single", minIncome: 0,        maxIncome: 45_400,  rate: 0.0335, effectiveYear: 2025 },
  { state: "VT", filingStatus: "single", minIncome: 45_400,   maxIncome: 110_050, rate: 0.066,  effectiveYear: 2025 },
  { state: "VT", filingStatus: "single", minIncome: 110_050,  maxIncome: 229_550, rate: 0.076,  effectiveYear: 2025 },
  { state: "VT", filingStatus: "single", minIncome: 229_550,  maxIncome: null,    rate: 0.0875, effectiveYear: 2025 },
];

// Maine — graduated; top 7.15%
export const ME_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "ME", filingStatus: "single", minIncome: 0,       maxIncome: 26_050,  rate: 0.058,  effectiveYear: 2025 },
  { state: "ME", filingStatus: "single", minIncome: 26_050,  maxIncome: 61_600,  rate: 0.0675, effectiveYear: 2025 },
  { state: "ME", filingStatus: "single", minIncome: 61_600,  maxIncome: null,    rate: 0.0715, effectiveYear: 2025 },
];

// Rhode Island — graduated; top 5.99%
export const RI_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "RI", filingStatus: "single", minIncome: 0,        maxIncome: 77_450,  rate: 0.0375, effectiveYear: 2025 },
  { state: "RI", filingStatus: "single", minIncome: 77_450,   maxIncome: 176_050, rate: 0.0475, effectiveYear: 2025 },
  { state: "RI", filingStatus: "single", minIncome: 176_050,  maxIncome: null,    rate: 0.0599, effectiveYear: 2025 },
];

// Oklahoma — graduated; top 4.75%
export const OK_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "OK", filingStatus: "single", minIncome: 0,      maxIncome: 1_000,   rate: 0.0025, effectiveYear: 2025 },
  { state: "OK", filingStatus: "single", minIncome: 1_000,  maxIncome: 2_500,   rate: 0.0075, effectiveYear: 2025 },
  { state: "OK", filingStatus: "single", minIncome: 2_500,  maxIncome: 3_750,   rate: 0.0175, effectiveYear: 2025 },
  { state: "OK", filingStatus: "single", minIncome: 3_750,  maxIncome: 4_900,   rate: 0.0275, effectiveYear: 2025 },
  { state: "OK", filingStatus: "single", minIncome: 4_900,  maxIncome: 7_200,   rate: 0.0375, effectiveYear: 2025 },
  { state: "OK", filingStatus: "single", minIncome: 7_200,  maxIncome: null,    rate: 0.0475, effectiveYear: 2025 },
];

// Montana — two-bracket; top 5.9%
export const MT_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "MT", filingStatus: "single", minIncome: 0,       maxIncome: 20_500,  rate: 0.047,  effectiveYear: 2025 },
  { state: "MT", filingStatus: "single", minIncome: 20_500,  maxIncome: null,    rate: 0.059,  effectiveYear: 2025 },
];

// North Dakota — graduated; top 2.5%
export const ND_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "ND", filingStatus: "single", minIncome: 0,        maxIncome: 44_725,  rate: 0,      effectiveYear: 2025 },
  { state: "ND", filingStatus: "single", minIncome: 44_725,   maxIncome: 225_975, rate: 0.0195, effectiveYear: 2025 },
  { state: "ND", filingStatus: "single", minIncome: 225_975,  maxIncome: null,    rate: 0.025,  effectiveYear: 2025 },
];

// West Virginia — graduated; top ~4.82% (continuing phase-down)
export const WV_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "WV", filingStatus: "single", minIncome: 0,       maxIncome: 10_000,  rate: 0.0236, effectiveYear: 2025 },
  { state: "WV", filingStatus: "single", minIncome: 10_000,  maxIncome: 25_000,  rate: 0.0315, effectiveYear: 2025 },
  { state: "WV", filingStatus: "single", minIncome: 25_000,  maxIncome: 40_000,  rate: 0.0354, effectiveYear: 2025 },
  { state: "WV", filingStatus: "single", minIncome: 40_000,  maxIncome: 60_000,  rate: 0.0472, effectiveYear: 2025 },
  { state: "WV", filingStatus: "single", minIncome: 60_000,  maxIncome: null,    rate: 0.0482, effectiveYear: 2025 },
];

// New Mexico — graduated; top 5.9%
export const NM_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "NM", filingStatus: "single", minIncome: 0,        maxIncome: 5_500,   rate: 0.017,  effectiveYear: 2025 },
  { state: "NM", filingStatus: "single", minIncome: 5_500,    maxIncome: 11_000,  rate: 0.032,  effectiveYear: 2025 },
  { state: "NM", filingStatus: "single", minIncome: 11_000,   maxIncome: 16_000,  rate: 0.047,  effectiveYear: 2025 },
  { state: "NM", filingStatus: "single", minIncome: 16_000,   maxIncome: 210_000, rate: 0.049,  effectiveYear: 2025 },
  { state: "NM", filingStatus: "single", minIncome: 210_000,  maxIncome: null,    rate: 0.059,  effectiveYear: 2025 },
];

// Delaware — graduated; top 6.6%
export const DE_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "DE", filingStatus: "single", minIncome: 0,       maxIncome: 2_000,   rate: 0,      effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 2_000,   maxIncome: 5_000,   rate: 0.022,  effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 5_000,   maxIncome: 10_000,  rate: 0.039,  effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 10_000,  maxIncome: 20_000,  rate: 0.048,  effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 20_000,  maxIncome: 25_000,  rate: 0.052,  effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 25_000,  maxIncome: 60_000,  rate: 0.0555, effectiveYear: 2025 },
  { state: "DE", filingStatus: "single", minIncome: 60_000,  maxIncome: null,    rate: 0.066,  effectiveYear: 2025 },
];

// DC — graduated; top 10.75%
export const DC_STATE_BRACKETS_2025_SINGLE: UsTaxBracket[] = [
  { state: "DC", filingStatus: "single", minIncome: 0,         maxIncome: 10_000,  rate: 0.04,   effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 10_000,    maxIncome: 40_000,  rate: 0.06,   effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 40_000,    maxIncome: 60_000,  rate: 0.065,  effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 60_000,    maxIncome: 250_000, rate: 0.085,  effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 250_000,   maxIncome: 500_000, rate: 0.0925, effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 500_000,   maxIncome: 1_000_000,rate: 0.0975,effectiveYear: 2025 },
  { state: "DC", filingStatus: "single", minIncome: 1_000_000, maxIncome: null,    rate: 0.1075, effectiveYear: 2025 },
];

// No-income-tax states
export const NO_TAX_STATES = ["NV", "WY", "SD", "TN", "NH", "AK"];
function noTaxBrackets(stateCode: string): UsTaxBracket[] {
  return [{ state: stateCode, filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0, effectiveYear: 2025 }];
}

// ── State bracket registry ─────────────────────────────────────────────────────

export const US_STATE_BRACKETS_2025: Record<string, UsTaxBracket[]> = {
  AL: [{ state: "AL", filingStatus: "single", minIncome: 0, maxIncome: null, rate: 0.05, effectiveYear: 2025 }], // effectively flat at 5% for most
  AK: noTaxBrackets("AK"),
  AZ: AZ_STATE_BRACKETS_2025_SINGLE,
  AR: AR_STATE_BRACKETS_2025_SINGLE,
  CA: CA_STATE_BRACKETS_2025_SINGLE,
  CO: CO_STATE_BRACKETS_2025_SINGLE,
  CT: CT_STATE_BRACKETS_2025_SINGLE,
  DE: DE_STATE_BRACKETS_2025_SINGLE,
  FL: FL_STATE_BRACKETS_2025_SINGLE,
  GA: GA_STATE_BRACKETS_2025_SINGLE,
  HI: HI_STATE_BRACKETS_2025_SINGLE,
  ID: ID_STATE_BRACKETS_2025_SINGLE,
  IL: IL_STATE_BRACKETS_2025_SINGLE,
  IN: IN_STATE_BRACKETS_2025_SINGLE,
  IA: IA_STATE_BRACKETS_2025_SINGLE,
  KS: KS_STATE_BRACKETS_2025_SINGLE,
  KY: KY_STATE_BRACKETS_2025_SINGLE,
  LA: LA_STATE_BRACKETS_2025_SINGLE,
  ME: ME_STATE_BRACKETS_2025_SINGLE,
  MD: MD_STATE_BRACKETS_2025_SINGLE,
  MA: MA_STATE_BRACKETS_2025_SINGLE,
  MI: MI_STATE_BRACKETS_2025_SINGLE,
  MN: MN_STATE_BRACKETS_2025_SINGLE,
  MS: MS_STATE_BRACKETS_2025_SINGLE,
  MO: MO_STATE_BRACKETS_2025_SINGLE,
  MT: MT_STATE_BRACKETS_2025_SINGLE,
  NE: NE_STATE_BRACKETS_2025_SINGLE,
  NV: noTaxBrackets("NV"),
  NH: noTaxBrackets("NH"),
  NJ: NJ_STATE_BRACKETS_2025_SINGLE,
  NM: NM_STATE_BRACKETS_2025_SINGLE,
  NY: NY_STATE_BRACKETS_2025_SINGLE,
  NC: NC_STATE_BRACKETS_2025_SINGLE,
  ND: ND_STATE_BRACKETS_2025_SINGLE,
  OH: OH_STATE_BRACKETS_2025_SINGLE,
  OK: OK_STATE_BRACKETS_2025_SINGLE,
  OR: OR_STATE_BRACKETS_2025_SINGLE,
  PA: PA_STATE_BRACKETS_2025_SINGLE,
  RI: RI_STATE_BRACKETS_2025_SINGLE,
  SC: SC_STATE_BRACKETS_2025_SINGLE,
  SD: noTaxBrackets("SD"),
  TN: noTaxBrackets("TN"),
  TX: TX_STATE_BRACKETS_2025_SINGLE,
  UT: UT_STATE_BRACKETS_2025_SINGLE,
  VT: VT_STATE_BRACKETS_2025_SINGLE,
  VA: VA_STATE_BRACKETS_2025_SINGLE,
  WA: WA_STATE_BRACKETS_2025_SINGLE,
  WV: WV_STATE_BRACKETS_2025_SINGLE,
  WI: WI_STATE_BRACKETS_2025_SINGLE,
  WY: noTaxBrackets("WY"),
  DC: DC_STATE_BRACKETS_2025_SINGLE,
};

// ── Federal bracket lookup ─────────────────────────────────────────────────────

export function getFederalBrackets(
  filingStatus: FilingStatus,
  taxYear: 2025 | 2026 = 2025,
): UsTaxBracket[] {
  if (taxYear === 2026) {
    switch (filingStatus) {
      case "mfj": return US_FEDERAL_BRACKETS_2026_MFJ;
      case "hoh": return US_FEDERAL_BRACKETS_2026_HOH;
      case "mfs": return US_FEDERAL_BRACKETS_2026_MFS;
      default:    return US_FEDERAL_BRACKETS_2026_SINGLE;
    }
  }
  switch (filingStatus) {
    case "mfj": return US_FEDERAL_BRACKETS_2025_MFJ;
    case "hoh": return US_FEDERAL_BRACKETS_2025_HOH;
    case "mfs": return US_FEDERAL_BRACKETS_2025_MFS;
    default:    return US_FEDERAL_BRACKETS_2025_SINGLE;
  }
}

export function getLtcgBrackets(taxYear: 2025 | 2026 = 2025): LtcgBracket[] {
  return taxYear === 2026 ? US_LTCG_BRACKETS_2026 : US_LTCG_BRACKETS_2025;
}

export function getStandardDeduction(
  filingStatus: FilingStatus,
  taxYear: 2025 | 2026 = 2025,
): number {
  const table = taxYear === 2026 ? US_STANDARD_DEDUCTION_2026 : US_STANDARD_DEDUCTION_2025;
  return table[filingStatus];
}

export function getRetirementLimits(taxYear: 2025 | 2026 = 2025) {
  return US_RETIREMENT_LIMITS[taxYear];
}

// ── Core tax calculation helpers ───────────────────────────────────────────────

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
  federalTax:            number;
  stateTax:              number;
  niit:                  number;
  additionalMedicareTax: number;
  totalTax:              number;
  effectiveRate:         number;
  marginalRate:          number;  // combined federal + state ordinary
}

/**
 * Calculate combined US federal + state tax on ordinary income.
 * @param taxableIncome       Income after deductions
 * @param filingStatus
 * @param usState             Two-letter state code
 * @param netInvestmentIncome For NIIT calculation
 * @param wages               For Additional Medicare Tax
 * @param grossIncome         For effective rate denominator
 * @param taxYear             2025 (default) or 2026
 */
export function calculateCombinedTaxUS(
  taxableIncome:       number,
  filingStatus:        FilingStatus,
  usState:             string,
  netInvestmentIncome: number = 0,
  wages:               number = 0,
  grossIncome:         number = 0,
  taxYear:             2025 | 2026 = 2025,
): UsTaxResult {
  const federalBrackets = getFederalBrackets(filingStatus, taxYear);
  const stateBrackets   = US_STATE_BRACKETS_2025[usState.toUpperCase()]
                        ?? noTaxBrackets(usState.toUpperCase());

  const federalTax = calculateTaxForBracketsUS(taxableIncome, federalBrackets);
  const stateTax   = calculateTaxForBracketsUS(taxableIncome, stateBrackets);

  // NIIT — thresholds unindexed; same 2025/2026
  const niitThreshold = US_NIIT_THRESHOLDS_2025[filingStatus];
  const niit = netInvestmentIncome > 0 && grossIncome > niitThreshold
    ? Math.min(netInvestmentIncome, grossIncome - niitThreshold) * US_NIIT_RATE
    : 0;

  // Additional 0.9% Medicare
  const medThreshold = US_ADDITIONAL_MEDICARE_TAX_THRESHOLDS[filingStatus];
  const addMedicare  = wages > medThreshold ? (wages - medThreshold) * US_ADDITIONAL_MEDICARE_RATE : 0;

  const totalTax      = federalTax + stateTax + niit + addMedicare;
  const effectiveRate = grossIncome > 0 ? totalTax / grossIncome : 0;

  let fedMarginal   = 0;
  for (const b of federalBrackets) { if (taxableIncome > b.minIncome) fedMarginal = b.rate; }
  let stateMarginal = 0;
  for (const b of stateBrackets)   { if (taxableIncome > b.minIncome) stateMarginal = b.rate; }

  return {
    federalTax, stateTax, niit, additionalMedicareTax: addMedicare,
    totalTax, effectiveRate, marginalRate: fedMarginal + stateMarginal,
  };
}

/**
 * Calculate tax on long-term capital gains (stacked on top of ordinary income).
 */
export function calculateLtcgTax(
  ordinaryIncome: number,
  ltcgAmount:     number,
  filingStatus:   FilingStatus,
  taxYear:        2025 | 2026 = 2025,
): number {
  if (ltcgAmount <= 0) return 0;
  const brackets = getLtcgBrackets(taxYear).filter(b => b.filingStatus === filingStatus);
  const topOfIncome  = ordinaryIncome + ltcgAmount;
  let tax            = 0;
  let gainsRemaining = ltcgAmount;

  for (const bracket of brackets) {
    if (gainsRemaining <= 0) break;
    if (topOfIncome <= bracket.minIncome) break;

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
export function getUsMarginalRate(
  taxableIncome: number,
  filingStatus:  FilingStatus,
  usState:       string,
  taxYear:       2025 | 2026 = 2025,
): number {
  return calculateCombinedTaxUS(taxableIncome, filingStatus, usState, 0, 0, taxableIncome, taxYear).marginalRate;
}

/** Resolve common state name variants to two-letter code. */
export function resolveStateCode(input: string): string {
  const map: Record<string, string> = {
    alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR",
    california: "CA", colorado: "CO", connecticut: "CT", delaware: "DE",
    florida: "FL", georgia: "GA", hawaii: "HI", idaho: "ID",
    illinois: "IL", indiana: "IN", iowa: "IA", kansas: "KS",
    kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
    massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
    missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
    "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND",
    ohio: "OH", oklahoma: "OK", oregon: "OR", pennsylvania: "PA",
    "rhode island": "RI", "south carolina": "SC", "south dakota": "SD",
    tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
    virginia: "VA", washington: "WA", "west virginia": "WV",
    wisconsin: "WI", wyoming: "WY",
    "district of columbia": "DC", dc: "DC",
  };
  const normalized = input.trim().toLowerCase();
  return map[normalized] ?? input.toUpperCase().slice(0, 2);
}
