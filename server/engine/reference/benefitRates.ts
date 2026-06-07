export interface GovernmentBenefitRate {
  key: string;
  label: string;
  value: number;
  effectiveYear: number;
  category: string;
}

export const BENEFIT_RATES_2024: GovernmentBenefitRate[] = [
  { key: "cpp_max_monthly", label: "CPP Maximum Monthly Benefit", value: 1364.60, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_max_annual", label: "CPP Maximum Annual Benefit", value: 16375.20, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_disability_monthly", label: "CPP Disability Maximum Monthly", value: 1606.78, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_early_reduction_per_month", label: "CPP Early Reduction per Month", value: 0.006, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_late_increase_per_month", label: "CPP Late Increase per Month", value: 0.007, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_early_total_reduction", label: "CPP Total Early Reduction (age 60)", value: 0.36, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_late_total_increase", label: "CPP Total Late Increase (age 70)", value: 0.42, effectiveYear: 2024, category: "cpp" },

  { key: "oas_max_monthly", label: "OAS Maximum Monthly Benefit", value: 707.68, effectiveYear: 2024, category: "oas" },
  { key: "oas_max_annual", label: "OAS Maximum Annual Benefit", value: 8492.16, effectiveYear: 2024, category: "oas" },
  { key: "oas_deferral_increase_per_month", label: "OAS Deferral Increase per Month", value: 0.006, effectiveYear: 2024, category: "oas" },
  { key: "oas_clawback_threshold", label: "OAS Clawback Threshold", value: 90997, effectiveYear: 2024, category: "oas" },
  { key: "oas_clawback_rate", label: "OAS Clawback Rate", value: 0.15, effectiveYear: 2024, category: "oas" },
  { key: "oas_full_clawback_threshold", label: "OAS Full Clawback Threshold", value: 148065, effectiveYear: 2024, category: "oas" },

  { key: "ympe", label: "Year's Maximum Pensionable Earnings", value: 68500, effectiveYear: 2024, category: "cpp" },
  { key: "ympe2", label: "Second Ceiling (CPP2)", value: 73200, effectiveYear: 2024, category: "cpp" },
  { key: "ybe", label: "Year's Basic Exemption", value: 3500, effectiveYear: 2024, category: "cpp" },
  { key: "cpp_employee_rate", label: "CPP Employee Contribution Rate", value: 0.0595, effectiveYear: 2024, category: "cpp" },
  { key: "cpp2_employee_rate", label: "CPP2 Employee Contribution Rate", value: 0.04, effectiveYear: 2024, category: "cpp" },

  { key: "cesg_annual_max", label: "CESG Annual Maximum", value: 500, effectiveYear: 2024, category: "resp" },
  { key: "cesg_match_rate", label: "CESG Match Rate", value: 0.20, effectiveYear: 2024, category: "resp" },
  { key: "cesg_annual_contribution_max", label: "CESG Eligible Contribution", value: 2500, effectiveYear: 2024, category: "resp" },
  { key: "cesg_lifetime_max", label: "CESG Lifetime Maximum", value: 7200, effectiveYear: 2024, category: "resp" },
  { key: "acesg_low_income_threshold", label: "ACESG Low Income Threshold", value: 53359, effectiveYear: 2024, category: "resp" },
  { key: "acesg_low_income_extra_rate", label: "ACESG Low Income Extra Rate", value: 0.20, effectiveYear: 2024, category: "resp" },
  { key: "acesg_low_income_extra_amount", label: "ACESG Low Income Extra Amount", value: 100, effectiveYear: 2024, category: "resp" },
  { key: "acesg_mid_income_threshold", label: "ACESG Mid Income Threshold", value: 106717, effectiveYear: 2024, category: "resp" },
  { key: "acesg_mid_income_extra_rate", label: "ACESG Mid Income Extra Rate", value: 0.10, effectiveYear: 2024, category: "resp" },
  { key: "acesg_mid_income_extra_amount", label: "ACESG Mid Income Extra Amount", value: 50, effectiveYear: 2024, category: "resp" },
  { key: "clb_initial", label: "CLB Initial Amount", value: 500, effectiveYear: 2024, category: "resp" },
  { key: "clb_annual", label: "CLB Annual Amount", value: 100, effectiveYear: 2024, category: "resp" },
  { key: "clb_lifetime_max", label: "CLB Lifetime Maximum", value: 2000, effectiveYear: 2024, category: "resp" },

  { key: "tfsa_annual_room", label: "TFSA Annual Contribution Room", value: 7000, effectiveYear: 2024, category: "tfsa" },
  { key: "tfsa_cumulative_2024", label: "TFSA Cumulative Room (since 2009)", value: 95000, effectiveYear: 2024, category: "tfsa" },

  { key: "rrsp_contribution_rate", label: "RRSP Contribution Rate", value: 0.18, effectiveYear: 2024, category: "rrsp" },
  { key: "rrsp_annual_max", label: "RRSP Annual Maximum", value: 31560, effectiveYear: 2024, category: "rrsp" },

  { key: "ei_max_insurable", label: "EI Maximum Insurable Earnings", value: 63200, effectiveYear: 2024, category: "ei" },
  { key: "ei_employee_rate", label: "EI Employee Premium Rate", value: 0.0166, effectiveYear: 2024, category: "ei" },
  { key: "ei_max_annual_premium", label: "EI Maximum Annual Premium", value: 1049.12, effectiveYear: 2024, category: "ei" },

  { key: "bpa_federal", label: "Federal Basic Personal Amount", value: 15705, effectiveYear: 2024, category: "tax" },
];

export const RRIF_MINIMUM_FACTORS: Record<number, number> = {
  71: 0.0528,
  72: 0.0540,
  73: 0.0553,
  74: 0.0567,
  75: 0.0582,
  76: 0.0598,
  77: 0.0617,
  78: 0.0636,
  79: 0.0658,
  80: 0.0682,
  81: 0.0708,
  82: 0.0738,
  83: 0.0771,
  84: 0.0808,
  85: 0.0851,
  86: 0.0899,
  87: 0.0955,
  88: 0.1021,
  89: 0.1099,
  90: 0.1192,
  91: 0.1306,
  92: 0.1449,
  93: 0.1634,
  94: 0.1879,
  95: 0.2000,
};

export function getRrifMinimumFactor(age: number, factorsOverride?: Record<number, number>): number {
  const factors = factorsOverride ?? RRIF_MINIMUM_FACTORS;
  if (age < 71) return 0;
  if (age >= 95) return factors[95] ?? 0.20;
  return factors[age] ?? 0;
}

export function getRrifMinimumWithdrawal(age: number, balance: number, factorsOverride?: Record<number, number>): number {
  return balance * getRrifMinimumFactor(age, factorsOverride);
}

