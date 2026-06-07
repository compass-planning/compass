export {
  choleskyDecompose,
  generateCorrelatedNormals,
  generateCorrelatedReturns,
  logNormalReturn,
  createSeededRng,
  DEFAULT_CORRELATIONS,
  type CorrelationMatrix,
  type AssetAssumptions,
  type CorrelatedReturns,
} from "./cholesky";

export {
  runSimulation,
  MODERATE_ASSUMPTIONS,
  CONSERVATIVE_ASSUMPTIONS,
  AGGRESSIVE_ASSUMPTIONS,
  type SimulationAssumptions,
  type YearlyState,
  type YearlyStepFn,
  type SimulationPath,
  type SimulationResult,
  type PercentileBands,
  type SensitivityResult,
} from "./monteCarlo";

export {
  BENEFIT_RATES_2024,
  RRIF_MINIMUM_FACTORS,
  getRrifMinimumFactor,
  getRrifMinimumWithdrawal,
} from "./reference/benefitRates";

export {
  FEDERAL_TAX_BRACKETS_2025,
  ONTARIO_TAX_BRACKETS_2025,
  BC_TAX_BRACKETS_2025,
  ALBERTA_TAX_BRACKETS_2025,
  QUEBEC_TAX_BRACKETS_2025,
  ALL_PROVINCIAL_BRACKETS_2025,
  calculateTaxForBrackets,
  calculateCombinedTax,
  getMarginalRate,
  type TaxBracket,
} from "./reference/taxBrackets";

export {
  projectCpp,
  cppTimingComparison,
  projectOas,
  oasDeferralComparison,
  calculateOasClawback,
  calculateCapitalGainInclusion,
  type CppProjection,
  type OasProjection,
} from "./reference/cppOas";

export {
  loadReferenceDataFromDb,
  loadReferenceDataFromConstants,
  getReferenceData,
  getBenefitRate,
  getTaxBrackets,
  getAvailableProvinces,
  isCacheLoaded,
  getCachedRrifFactor,
  getCachedRrifWithdrawal,
  type DbTaxBracketRow,
  type DbBenefitRateRow,
} from "./reference/loader";

export {
  createRetirementStepFn,
  optimizeWithdrawals,
  reshelterToTfsa,
  calculateCapitalGainsTaxable,
  calculateRetirementTax,
  getRetirementMarginalRate,
  optimizePensionSplit,
  rrspVsTfsaDecision,
  resolveProvinceCode,
  type RetirementProfile,
  type YearlyRetirementDetail,
  type RetirementSimulationInput,
  type CppTimingResult,
  type RrspVsTfsaAdvice,
} from "./retirement";

export {
  calculateDime,
  calculateHumanLifeValue,
  calculateCapitalRetention,
  calculateDiGap,
  calculateCiGap,
  runFullInsuranceAnalysis,
  createInsuranceStepFn,
  type InsuranceProfile,
  type LifeInsuranceResult,
  type DiGapResult,
  type CiGapResult,
  type InsuranceAnalysisOutput,
} from "./insurance";

export {
  calculateCesg,
  calculateClb,
  createRespStepFn,
  calculateRequiredContribution,
  type FamilyIncomeBracket,
  type RespProfile,
  type CesgResult,
  type ClbResult,
  type RespYearProjection,
  type RespProjectionOutput,
} from "./education";

