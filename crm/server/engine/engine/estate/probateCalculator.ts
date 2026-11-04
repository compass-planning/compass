import type { EstateProfile, ProbateFeeResult } from "./types";
import { normalizeProvince } from "./provinceNormalizer";

const PROBATE_FEE_SCHEDULES: Record<string, (value: number) => number> = {
  ON: (v) => {
    if (v <= 50000) return v * 0.005;
    return 50000 * 0.005 + (v - 50000) * 0.015;
  },
  BC: (v) => {
    if (v <= 25000) return 0;
    if (v <= 50000) return (v - 25000) * 0.006;
    return 25000 * 0.006 + (v - 50000) * 0.014;
  },
  AB: (_v) => Math.min(525, 35 + 7 * Math.max(0, Math.ceil((_v - 10000) / 1000))),
  QC: (_v) => 0,
  SK: (v) => v * 0.007,
  MB: (v) => v * 0.007,
  NB: (v) => v * 0.005,
  NS: (v) => {
    if (v <= 10000) return 85.60;
    if (v <= 25000) return 215.20;
    if (v <= 50000) return 358.15;
    if (v <= 100000) return 1002.65;
    return 1002.65 + (v - 100000) * 0.0167;
  },
  PE: (v) => v * 0.004,
  NL: (v) => {
    if (v <= 1000) return 60;
    return 60 + (v - 1000) * 0.006;
  },
  NT: (v) => {
    if (v <= 10000) return 25;
    if (v <= 25000) return 100;
    if (v <= 100000) return 200;
    if (v <= 250000) return 300;
    return 400;
  },
  NU: (v) => {
    if (v <= 10000) return 25;
    if (v <= 25000) return 100;
    if (v <= 100000) return 200;
    if (v <= 250000) return 300;
    return 400;
  },
  YT: (v) => {
    if (v <= 25000) return 0;
    return (v - 25000) * 0.0069;
  },
};

export function calculateProbateFees(profile: EstateProfile): ProbateFeeResult {
  const exemptAssets = {
    registeredAccounts: profile.registeredAccountsWithBeneficiary,
    lifeInsurance: profile.lifeInsuranceWithBeneficiary,
    jointTenancy: profile.jointTenancyRealEstate,
    trustAssets: profile.trustAssets,
    total: profile.registeredAccountsWithBeneficiary +
           profile.lifeInsuranceWithBeneficiary +
           profile.jointTenancyRealEstate +
           profile.trustAssets,
  };

  const probateableEstate = Math.max(0, profile.grossEstateValue - exemptAssets.total);

  const province = normalizeProvince(profile.province);
  const feeCalculator = PROBATE_FEE_SCHEDULES[province] ?? PROBATE_FEE_SCHEDULES["ON"];
  const probateFee = feeCalculator(probateableEstate);

  return {
    province,
    probateableEstate,
    probateFee: Math.round(probateFee * 100) / 100,
    exemptAssets,
  };
}
