export {
  calculateDime,
  calculateHumanLifeValue,
  calculateCapitalRetention,
  calculateDiGap,
  calculateCiGap,
  runFullInsuranceAnalysis,
} from "./calculations";

export { createInsuranceStepFn } from "./stepFunction";

export type {
  InsuranceProfile,
  LifeInsuranceResult,
  DiGapResult,
  CiGapResult,
  InsuranceAnalysisOutput,
} from "./types";
