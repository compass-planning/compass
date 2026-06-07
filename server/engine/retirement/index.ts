export { createRetirementStepFn } from "./stepFunction";
export { optimizeWithdrawals, reshelterToTfsa, calculateCapitalGainsTaxable } from "./rrifOptimizer";
export { calculateRetirementTax, getRetirementMarginalRate, optimizePensionSplit, rrspVsTfsaDecision } from "./taxCalculator";
export { resolveProvinceCode } from "./provinceMap";
export type {
  RetirementProfile,
  YearlyRetirementDetail,
  RetirementSimulationInput,
  CppTimingResult,
  RrspVsTfsaAdvice,
} from "./types";
