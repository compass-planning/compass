export {
  calculateRrspRoom,
  calculateTfsaRoom,
  getRrspAnnualLimit,
  getTfsaAnnualLimit,
  cumulativeTfsaRoom,
  projectRrspRoom,
  projectTfsaRoom,
} from "./roomTracker";

export { projectTaxYears } from "./projector";

export { analyzeCapitalGains, analyzeIncomeSplitting } from "./capitalGains";

export type {
  TaxProjectionProfile,
  TaxYearProjection,
  RrspRoomInput,
  RrspRoomSummary,
  TfsaRoomInput,
  TfsaRoomSummary,
  CapitalGainsPosition,
  CapitalGainsAnalysis,
  CapitalGainsScenario,
  IncomeSplittingAnalysis,
} from "./types";
