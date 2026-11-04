import type { EstateProfile, FullEstateAnalysis, BeneficiaryFlag } from "./types";
import { calculateProbateFees } from "./probateCalculator";
import { calculateTerminalTax } from "./terminalTax";

export function checkBeneficiaryFlags(profile: EstateProfile): BeneficiaryFlag[] {
  const flags: BeneficiaryFlag[] = [];
  for (const policy of profile.policies) {
    const ben = policy.beneficiary.toLowerCase().trim();
    if (ben === "estate" || ben === "my estate" || ben === "the estate") {
      flags.push({
        policyId: policy.policyId,
        type: policy.type,
        provider: policy.provider,
        policyNumber: policy.policyNumber,
        value: policy.value,
        issue: "Policy names 'estate' as beneficiary — proceeds will be subject to probate fees and creditor claims. Consider naming a specific beneficiary.",
      });
    }
    if (!ben || ben === "none" || ben === "n/a" || ben === "unknown") {
      flags.push({
        policyId: policy.policyId,
        type: policy.type,
        provider: policy.provider,
        policyNumber: policy.policyNumber,
        value: policy.value,
        issue: "No beneficiary designated — proceeds will default to estate, subject to probate and delays.",
      });
    }
  }
  return flags;
}

export function runFullEstateAnalysis(profile: EstateProfile): FullEstateAnalysis {
  const probate = calculateProbateFees(profile);
  const terminalTax = calculateTerminalTax(profile);
  const beneficiaryFlags = checkBeneficiaryFlags(profile);

  const totalDeductions = probate.probateFee + terminalTax.estimatedTax;
  const netToBeneficiaries = Math.max(0, profile.grossEstateValue - totalDeductions);
  const efficiencyScore = profile.grossEstateValue > 0
    ? netToBeneficiaries / profile.grossEstateValue
    : 0;

  return {
    probate,
    terminalTax,
    efficiency: {
      grossEstate: profile.grossEstateValue,
      probateFees: probate.probateFee,
      terminalTax: terminalTax.estimatedTax,
      totalDeductions,
      netToBeneficiaries: Math.round(netToBeneficiaries * 100) / 100,
      efficiencyScore: Math.round(efficiencyScore * 10000) / 10000,
    },
    beneficiaryFlags,
    willStatus: profile.hasWill ? "Will on file" : "No will — intestacy rules apply",
    poaStatus: profile.hasPowerOfAttorney ? "POA on file" : "No POA — consider establishing",
  };
}

export { calculateProbateFees } from "./probateCalculator";
export { calculateTerminalTax } from "./terminalTax";
export type { EstateProfile, FullEstateAnalysis, ProbateFeeResult, TerminalTaxResult, EstateEfficiencyResult, BeneficiaryFlag } from "./types";
