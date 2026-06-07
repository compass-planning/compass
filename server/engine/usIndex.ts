/**
 * US Financial Planning Engine — Public API
 * Drop these files into server/engine/ alongside the existing Canadian engine.
 */

// Reference data
export * from "./reference/usTaxData2025.js";
export * from "./reference/usBenefitRates2025.js";
export * from "./reference/usSocialSecurity.js";

// Projection engine
export { projectUsTaxYears }    from "./tax/usProjector.js";
export { analyzeUsCapitalGains, analyzeRothConversion } from "./tax/usCapitalGains.js";
export { analyzeSsTiming, analyzeSsSpousal } from "./reference/usSocialSecurity.js";

// Router
export { projectByJurisdiction } from "./jurisdictionRouter.js";
export type { Jurisdiction, JurisdictionProjectionResult } from "./jurisdictionRouter.js";

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
} from "./tax/usTypes.js";
