/**
 * schemaAdapter.ts
 *
 * Translates between Planning Suite field names and Compass CRM column names
 * for the two tables that have mismatches:  insurance_analyses & education_savings.
 *
 * Use these functions wherever Planning Suite code reads/writes those tables
 * so neither side needs to know about the other's naming convention.
 */

// ─── Insurance Analyses ───────────────────────────────────────────────────────

/** Shape the Planning Suite engine uses */
export interface PSInsuranceAnalysis {
  id?: number;
  clientId: number;
  planId?: number | null;
  method?: string | null;
  primaryName?: string | null;
  primaryAge?: number | null;
  spouseName?: string | null;
  spouseAge?: number | null;
  annualIncome?: string | null;
  spouseAnnualIncome?: string | null;
  yearsToReplace?: number | null;
  existingLifeCoverage?: string | null;
  existingDisability?: string | null;
  existingCriticalIllness?: string | null;
  recommendedLife?: string | null;
  recommendedDisability?: string | null;
  recommendedCriticalIllness?: string | null;
  lifeGap?: string | null;
  disabilityGap?: string | null;
  criticalIllnessGap?: string | null;
  worksheetData?: unknown;
  notes?: string | null;
}

/** Shape Compass CRM stores (insurance_analyses columns) */
export interface BEInsuranceAnalysis {
  id?: number;
  clientId: number;
  annualIncome?: string | null;
  yearsOfIncomeNeeded?: number | null;
  existingLifeCoverage?: string | null;
  existingDisabilityCoverage?: string | null;
  existingCriticalIllnessCoverage?: string | null;
  recommendedLifeCoverage?: string | null;
  recommendedDisabilityCoverage?: string | null;
  recommendedCriticalIllnessCoverage?: string | null;
  lifeCoverageGap?: string | null;
  disabilityCoverageGap?: string | null;
  criticalIllnessCoverageGap?: string | null;
  calculationMethod?: string | null;
  primaryName?: string | null;
  primaryAge?: number | null;
  spouseName?: string | null;
  spouseAge?: number | null;
  spouseAnnualIncome?: string | null;
  worksheetData?: unknown;
  meetingNotes?: string | null;
  analysisResults?: unknown;
}

/** Convert PS insurance payload → BE columns before writing to DB */
export function insuranceToBE(ps: PSInsuranceAnalysis): BEInsuranceAnalysis {
  return {
    clientId:                           ps.clientId,
    annualIncome:                       ps.annualIncome ?? null,
    yearsOfIncomeNeeded:                ps.yearsToReplace ?? null,
    existingLifeCoverage:               ps.existingLifeCoverage ?? null,
    existingDisabilityCoverage:         ps.existingDisability ?? null,
    existingCriticalIllnessCoverage:    ps.existingCriticalIllness ?? null,
    recommendedLifeCoverage:            ps.recommendedLife ?? null,
    recommendedDisabilityCoverage:      ps.recommendedDisability ?? null,
    recommendedCriticalIllnessCoverage: ps.recommendedCriticalIllness ?? null,
    lifeCoverageGap:                    ps.lifeGap ?? null,
    disabilityCoverageGap:              ps.disabilityGap ?? null,
    criticalIllnessCoverageGap:         ps.criticalIllnessGap ?? null,
    calculationMethod:                  ps.method ?? null,
    primaryName:                        ps.primaryName ?? null,
    primaryAge:                         ps.primaryAge ?? null,
    spouseName:                         ps.spouseName ?? null,
    spouseAge:                          ps.spouseAge ?? null,
    spouseAnnualIncome:                 ps.spouseAnnualIncome ?? null,
    worksheetData:                      ps.worksheetData ?? null,
    meetingNotes:                       ps.notes ?? null,
  };
}

/** Convert BE DB row → PS field names before sending to the PS engine/UI */
export function insuranceToPS(be: BEInsuranceAnalysis): PSInsuranceAnalysis {
  return {
    id:                      be.id,
    clientId:                be.clientId,
    method:                  be.calculationMethod ?? null,
    primaryName:             be.primaryName ?? null,
    primaryAge:              be.primaryAge ?? null,
    spouseName:              be.spouseName ?? null,
    spouseAge:               be.spouseAge ?? null,
    annualIncome:            be.annualIncome ?? null,
    spouseAnnualIncome:      be.spouseAnnualIncome ?? null,
    yearsToReplace:          be.yearsOfIncomeNeeded ?? null,
    existingLifeCoverage:    be.existingLifeCoverage ?? null,
    existingDisability:      be.existingDisabilityCoverage ?? null,
    existingCriticalIllness: be.existingCriticalIllnessCoverage ?? null,
    recommendedLife:         be.recommendedLifeCoverage ?? null,
    recommendedDisability:   be.recommendedDisabilityCoverage ?? null,
    recommendedCriticalIllness: be.recommendedCriticalIllnessCoverage ?? null,
    lifeGap:                 be.lifeCoverageGap ?? null,
    disabilityGap:           be.disabilityCoverageGap ?? null,
    criticalIllnessGap:      be.criticalIllnessCoverageGap ?? null,
    worksheetData:           be.worksheetData ?? null,
    notes:                   be.meetingNotes ?? null,
  };
}

// ─── Education Savings ────────────────────────────────────────────────────────

/** Shape the Planning Suite engine uses */
export interface PSEducationSaving {
  id?: number;
  clientId: number;
  planId?: number | null;
  childName: string;
  childDob?: string | null;
  childAge?: number | null;
  targetAge?: number | null;
  currentRespBalance?: string | null;
  annualContribution?: string | null;
  monthlyContribution?: string | null;
  expectedReturn?: string | null;
  targetAmount?: string | null;
  estimatedCost?: string | null;
  projectedBalance?: string | null;
  cespGrant?: string | null;
  accountType?: string | null;
  notes?: string | null;
}

/** Convert PS education payload → BE columns before writing to DB */
export function educationToBE(ps: PSEducationSaving): Record<string, unknown> {
  return {
    clientId:             ps.clientId,
    childName:            ps.childName,
    childAge:             ps.childAge ?? null,
    childDob:             ps.childDob ?? null,           // new column
    targetAge:            ps.targetAge ?? null,
    currentBalance:       ps.currentRespBalance ?? null, // renamed
    annualContribution:   ps.annualContribution ?? null,
    monthlyContribution:  ps.monthlyContribution ?? null, // new column
    expectedReturn:       ps.expectedReturn ?? null,
    estimatedCost:        ps.estimatedCost ?? null,
    projectedBalance:     ps.projectedBalance ?? null,   // new column
    cesgReceivedToDate:   ps.cespGrant ?? null,          // mapped
    accountType:          ps.accountType ?? "RESP",
    notes:                ps.notes ?? null,
  };
}

/** Convert BE DB row → PS field names before sending to the PS engine/UI */
export function educationToPS(be: Record<string, unknown>): PSEducationSaving {
  return {
    id:                  be.id as number,
    clientId:            be.clientId as number,
    childName:           be.childName as string,
    childDob:            (be.childDob as string) ?? null,
    childAge:            (be.childAge as number) ?? null,
    targetAge:           (be.targetAge as number) ?? null,
    currentRespBalance:  (be.currentBalance as string) ?? null,
    annualContribution:  (be.annualContribution as string) ?? null,
    monthlyContribution: (be.monthlyContribution as string) ?? null,
    expectedReturn:      (be.expectedReturn as string) ?? null,
    targetAmount:        (be.estimatedCost as string) ?? null,
    estimatedCost:       (be.estimatedCost as string) ?? null,
    projectedBalance:    (be.projectedBalance as string) ?? null,
    cespGrant:           (be.cesgReceivedToDate as string) ?? null,
    accountType:         (be.accountType as string) ?? "RESP",
    notes:               (be.notes as string) ?? null,
  };
}

// ─── Retirement Projections ───────────────────────────────────────────────────
// BE already has all the PS fields after the schema additions in Phase 1.
// The only mapping needed is the new optional fields that may be missing.

export interface PSRetirementProjection {
  id?: number;
  clientId: number;
  planId?: number | null;
  person?: "primary" | "spouse" | null;
  label?: string | null;
  currentAge?: number | null;
  retirementAge?: number | null;
  lifeExpectancy?: number | null;
  currentSavings?: string | null;
  rrspBalance?: string | null;
  tfsaBalance?: string | null;
  nonRegBalance?: string | null;
  annualContribution?: string | null;
  annualTfsaContribution?: string | null;
  expectedReturn?: string | null;
  inflationRate?: string | null;
  desiredRetirementIncome?: string | null;
  pensionIncome?: string | null;
  cppStartAge?: number | null;
  oasStartAge?: number | null;
  cppMonthly?: string | null;
  oasMonthly?: string | null;
  projectedBalance?: string | null;
  shortfallSurplus?: string | null;
  successRate?: string | null;
  notes?: string | null;
}

/**
 * Convert PS retirement payload → BE columns.
 * All Planning Suite fields exist verbatim in BE after Phase 1 schema additions.
 */
export function retirementToBE(ps: PSRetirementProjection): Record<string, unknown> {
  return {
    clientId:                ps.clientId,
    person:                  ps.person ?? "primary",
    label:                   ps.label ?? null,
    currentAge:              ps.currentAge ?? null,
    retirementAge:           ps.retirementAge ?? null,
    lifeExpectancy:          ps.lifeExpectancy ?? null,
    currentSavings:          ps.currentSavings ?? null,
    rrspBalance:             ps.rrspBalance ?? null,
    tfsaBalance:             ps.tfsaBalance ?? null,
    nonRegBalance:           ps.nonRegBalance ?? null,
    annualContribution:      ps.annualContribution ?? null,
    annualTfsaContribution:  ps.annualTfsaContribution ?? null,
    expectedReturn:          ps.expectedReturn ?? null,
    inflationRate:           ps.inflationRate ?? null,
    desiredRetirementIncome: ps.desiredRetirementIncome ?? null,
    pensionIncome:           ps.pensionIncome ?? null,
    cppStartAge:             ps.cppStartAge ?? null,
    oasStartAge:             ps.oasStartAge ?? null,
    cppMonthly:              ps.cppMonthly ?? null,
    oasMonthly:              ps.oasMonthly ?? null,
    projectedBalance:        ps.projectedBalance ?? null,
    shortfallSurplus:        ps.shortfallSurplus ?? null,
    successRate:             ps.successRate ?? null,
    notes:                   ps.notes ?? null,
  };
}
