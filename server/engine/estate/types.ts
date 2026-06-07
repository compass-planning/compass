export interface EstateProfile {
  province: string;
  grossEstateValue: number;
  realEstateValue: number;
  jointTenancyRealEstate: number;
  registeredAccountsWithBeneficiary: number;
  lifeInsuranceWithBeneficiary: number;
  trustAssets: number;
  rrspRrifBalance: number;
  nonRegInvestments: number;
  nonRegCostBase: number;
  primaryResidenceValue: number;
  otherIncome: number;
  hasWill: boolean;
  hasPowerOfAttorney: boolean;
  policies: PolicyBeneficiaryCheck[];
}

export interface PolicyBeneficiaryCheck {
  policyId: number;
  type: string;
  provider: string;
  policyNumber: string;
  value: number;
  beneficiary: string;
}

export interface ProbateFeeResult {
  province: string;
  probateableEstate: number;
  probateFee: number;
  exemptAssets: {
    registeredAccounts: number;
    lifeInsurance: number;
    jointTenancy: number;
    trustAssets: number;
    total: number;
  };
}

export interface TerminalTaxResult {
  rrspRrifInclusion: number;
  capitalGainsInclusion: number;
  totalTaxableIncome: number;
  estimatedTax: number;
  marginalRate: number;
}

export interface EstateEfficiencyResult {
  grossEstate: number;
  probateFees: number;
  terminalTax: number;
  totalDeductions: number;
  netToBeneficiaries: number;
  efficiencyScore: number;
}

export interface BeneficiaryFlag {
  policyId: number;
  type: string;
  provider: string;
  policyNumber: string;
  value: number;
  issue: string;
}

export interface FullEstateAnalysis {
  probate: ProbateFeeResult;
  terminalTax: TerminalTaxResult;
  efficiency: EstateEfficiencyResult;
  beneficiaryFlags: BeneficiaryFlag[];
  willStatus: string;
  poaStatus: string;
}
