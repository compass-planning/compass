export { calculateRrspRoom, calculateTfsaRoom, getRrspAnnualLimit, getTfsaAnnualLimit,
         cumulativeTfsaRoom, projectRrspRoom, projectTfsaRoom } from "./roomTracker.js";

export { projectTaxYears } from "./projector.js";

export { analyzeCapitalGains, analyzeIncomeSplitting } from "./capitalGains.js";

export type {
  TaxProjectionProfile, TaxYearProjection,
  RrspRoomInput, RrspRoomSummary,
  TfsaRoomInput, TfsaRoomSummary,
  CapitalGainsPosition, CapitalGainsAnalysis, CapitalGainsScenario,
  IncomeSplittingAnalysis,
} from "./types.js";
