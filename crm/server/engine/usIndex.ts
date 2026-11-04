/**
 * US Financial Planning Engine — Public API
 * Drop these files into server/engine/ alongside the existing Canadian engine.
 */

// Reference data
export * from "./reference/usTaxData2025";
export * from "./reference/usBenefitRates2025";
export * from "./reference/usSocialSecurity";

// Projection engine
export { projectUsTaxYears }    from "./tax/usProjector";
export { analyzeUsCapitalGains, analyzeRothConversion } from "./tax/usCapitalGains";
export { analyzeSsTiming, analyzeSsSpousal } from "./reference/usSocialSecurity";

// Router
export { projectByJurisdiction } from "./jurisdictionRouter";
export type { Jurisdiction, JurisdictionProjectionResult } from "./jurisdictionRouter";

// Types
export type {
  UsTaxProjectionProfile,
  UsTaxYearProjection,
  SsTimingAnalysis,
  SsTimingOption,
  Us401kRoomSummary,
  UsIraRoomSummary,
  UsCapitalGainsAnalysis,
  UsCapitalGainsPosition,
  RothConversionAnalysis,
} from "./tax/usTypes";
