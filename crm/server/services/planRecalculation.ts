import { storage } from "../storage";
import { planModules, simulatableModules } from "@shared/schema";

interface RecalculationResult {
  planId: number;
  modulesRecalculated: string[];
  staleFlagsResolved: number;
  actionItemsGenerated: number;
  errors: string[];
}

export async function insertStaleFlagsForClient(
  clientId: number,
  triggeredBy: string
): Promise<number> {
  const plans = await storage.getPlansByClient(clientId);
  let flagCount = 0;

  for (const plan of plans) {
    for (const mod of planModules) {
      await storage.createPlanStaleFlag({
        planId: plan.id,
        module: mod,
        triggeredBy,
      });
      flagCount++;
    }
  }

  return flagCount;
}

export async function recalculatePlan(planId: number): Promise<RecalculationResult> {
  const result: RecalculationResult = {
    planId,
    modulesRecalculated: [],
    staleFlagsResolved: 0,
    actionItemsGenerated: 0,
    errors: [],
  };

  const unresolvedFlags = await storage.getUnresolvedStaleFlags(planId);
  if (unresolvedFlags.length === 0) return result;

  const assumptions = await storage.getPlanAssumptions(planId);
  if (assumptions.length === 0) {
    result.errors.push("No plan assumptions found — skipping recalculation");
    return result;
  }

  const staleModules = [...new Set(unresolvedFlags.map(f => f.module))];

  const simulatableStale = staleModules.filter(
    m => (simulatableModules as readonly string[]).includes(m)
  );

  const plan = await getFirstPlan(planId);
  if (!plan) {
    result.errors.push("Plan not found");
    return result;
  }

  const clientId = plan.clientId;

  const noDataModules = new Set<string>();
  for (const mod of simulatableStale) {
    try {
      const moduleResult = await recalculateModule(planId, clientId, mod, assumptions);
      if (moduleResult.success) {
        result.modulesRecalculated.push(mod);
        result.actionItemsGenerated += moduleResult.actionItemsCreated;
      } else if (moduleResult.noData) {
        noDataModules.add(mod);
      } else {
        result.errors.push(`${mod}: ${moduleResult.error}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`${mod}: ${msg}`);
    }
  }

  try {
    const insGapItems = await generateInsuranceCoverageGapItems(planId, clientId);
    result.actionItemsGenerated += insGapItems;
  } catch (err: unknown) {
    result.errors.push(`insurance coverage gap check: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  try {
    const beneficiaryItems = await generateBeneficiaryActionItems(planId, clientId);
    result.actionItemsGenerated += beneficiaryItems;
  } catch (err: unknown) {
    result.errors.push(`beneficiary check: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  try {
    const rebalItems = await generateRebalancingActionItems(planId, clientId);
    result.actionItemsGenerated += rebalItems;
  } catch (err: unknown) {
    result.errors.push(`rebalancing check: ${err instanceof Error ? err.message : "Unknown error"}`);
  }

  const nonSimulatableModules = new Set(
    (planModules as readonly string[]).filter(m => !(simulatableModules as readonly string[]).includes(m))
  );
  const successfulModules = new Set(result.modulesRecalculated);

  for (const flag of unresolvedFlags) {
    if (
      successfulModules.has(flag.module) ||
      nonSimulatableModules.has(flag.module) ||
      noDataModules.has(flag.module)
    ) {
      await storage.resolvePlanStaleFlag(flag.id);
      result.staleFlagsResolved++;
    }
  }

  return result;
}

async function getFirstPlan(planId: number) {
  const { db } = await import("../db");
  const { financialPlans } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");
  const [plan] = await db.select().from(financialPlans).where(eq(financialPlans.id, planId));
  return plan;
}

async function recalculateModule(
  planId: number,
  clientId: number,
  mod: string,
  assumptions: Awaited<ReturnType<typeof storage.getPlanAssumptions>>
): Promise<{ success: boolean; noData: boolean; actionItemsCreated: number; error?: string }> {
  let actionItemsCreated = 0;

  const existingItems = await storage.getPlanActionItems(planId);

  for (const assumption of assumptions) {
    const scenario = assumption.scenario;

    const simAssumptions = {
      equity: {
        mean: Number(assumption.equityReturn),
        volatility: Number(assumption.equityVolatility),
      },
      bond: {
        mean: Number(assumption.bondReturn),
        volatility: Number(assumption.bondVolatility),
      },
      inflation: {
        mean: Number(assumption.inflationMean),
        volatility: Number(assumption.inflationVolatility),
      },
      correlations: {
        size: 3,
        data: [
          [1, Number(assumption.corrEquityBond), Number(assumption.corrEquityInflation)],
          [Number(assumption.corrEquityBond), 1, Number(assumption.corrBondInflation)],
          [Number(assumption.corrEquityInflation), Number(assumption.corrBondInflation), 1],
        ],
      },
      simulationCount: assumption.simulationCount,
      yearsToProject: Math.max(1, assumption.planToAge - 30),
      seed: planId * 1000,
    };

    let initialState: { balance: number; contributions: number; withdrawals: number; customData?: Record<string, number> } = { balance: 100000, contributions: 10000, withdrawals: 0 };
    let stepFn: ((state: { year: number; balance: number; contributions: number; withdrawals: number; returns: { equity: number; bond: number; inflation: number }; inflationCumulative: number; success: boolean; customData?: Record<string, number> }, returns: { equity: number; bond: number; inflation: number }, simIndex: number) => { year: number; balance: number; contributions: number; withdrawals: number; returns: { equity: number; bond: number; inflation: number }; inflationCumulative: number; success: boolean; customData?: Record<string, number> }) | null = null;

    if (mod === "retirement") {
      const projections = await storage.getRetirementProjections(clientId);
      const latestProj = projections.length > 0 ? projections[projections.length - 1] : null;
      if (!latestProj) return { success: false, noData: true, actionItemsCreated: 0, error: "No retirement projection found" };

      const { createRetirementStepFn } = await import("../engine/retirement");
      const rrspBal = Number(latestProj.rrspBalance ?? latestProj.currentSavings);
      const tfsaBal = Number(latestProj.tfsaBalance ?? 0);
      const nonRegBal = Number(latestProj.nonRegBalance ?? 0);

      const profile = {
        currentAge: latestProj.currentAge,
        retirementAge: latestProj.retirementAge,
        planToAge: Number(assumption.planToAge),
        province: latestProj.province ?? assumption.province,
        rrspBalance: rrspBal,
        tfsaBalance: tfsaBal,
        nonRegBalance: nonRegBal,
        annualRrspContribution: Number(latestProj.annualContribution),
        annualTfsaContribution: Number(latestProj.annualTfsaContribution ?? 0),
        annualNonRegContribution: Number(latestProj.annualNonRegContribution ?? 0),
        employmentIncome: Number(latestProj.employmentIncome ?? 80000),
        desiredRetirementIncome: Number(latestProj.desiredRetirementIncome),
        cppStartAge: latestProj.cppStartAge ?? assumption.cppStartAge,
        oasStartAge: latestProj.oasStartAge ?? assumption.oasStartAge,
        yearsInCanada: latestProj.yearsInCanada ?? 40,
        pensionIncome: Number(latestProj.pensionIncome ?? 0),
        spouseIncome: Number(latestProj.spouseIncome ?? 0),
        rrifConversionAge: latestProj.rrifConversionAge ?? 71,
        equityAllocation: Number(latestProj.equityAllocation ?? 0.6),
        bondAllocation: Number(latestProj.bondAllocation ?? 0.4),
      };

      const engine = createRetirementStepFn(profile, false);
      initialState = {
        balance: rrspBal + tfsaBal + nonRegBal,
        contributions: Number(latestProj.annualContribution),
        withdrawals: 0,
        customData: {
          rrspBalance: rrspBal,
          tfsaBalance: tfsaBal,
          nonRegBalance: nonRegBal,
        },
      };
      stepFn = engine.stepFn;
      simAssumptions.yearsToProject = Math.max(1, profile.planToAge - profile.currentAge);
    } else if (mod === "insurance") {
      const analyses = await storage.getInsuranceAnalyses(clientId);
      const latestIns = analyses.length > 0 ? analyses[analyses.length - 1] : null;
      if (!latestIns) return { success: false, noData: true, actionItemsCreated: 0, error: "No insurance analysis found" };

      const { createInsuranceStepFn } = await import("../engine/insurance");

      const insProfile = {
        annualIncome: Number(latestIns.annualIncome),
        personalConsumptionRate: Number(latestIns.personalConsumptionRate ?? 0.30),
        workingYearsRemaining: latestIns.yearsOfIncomeNeeded,
        mortgageBalance: Number(latestIns.mortgageBalance ?? 0),
        totalDebts: Number(latestIns.totalDebts ?? 0),
        educationFundTarget: Number(latestIns.educationFundTarget ?? 0),
        finalExpenses: Number(latestIns.finalExpenses ?? 15000),
        existingLifeCoverage: Number(latestIns.existingLifeCoverage),
        existingAssets: Number(latestIns.existingAssets),
        monthlyExpenses: Number(latestIns.monthlyExpenses),
        existingDisabilityCoverage: Number(latestIns.existingDisabilityCoverage),
        cppDisabilityBenefit: Number(latestIns.cppDisabilityBenefit ?? 0),
        diReplacementRate: Number(latestIns.diReplacementRate ?? 0.70),
        criticalIllnessLumpSum: Number(latestIns.criticalIllnessLumpSum),
        existingCriticalIllnessCoverage: Number(latestIns.existingCriticalIllnessCoverage),
        uncoveredTreatmentCosts: Number(latestIns.uncoveredTreatmentCosts ?? 0),
        discountRate: Number(latestIns.discountRate ?? 0.04),
        withdrawalRate: Number(latestIns.withdrawalRate ?? 0.04),
        incomeVolatility: Number(latestIns.incomeVolatility ?? 0),
        isVariableIncome: latestIns.isVariableIncome ?? false,
      };

      const engine = createInsuranceStepFn(insProfile);
      initialState = engine.initialState;
      stepFn = engine.stepFn;
      simAssumptions.yearsToProject = Math.max(1, insProfile.workingYearsRemaining);
    } else if (mod === "education") {
      const edSavings = await storage.getEducationSavings(clientId);
      const latestEd = edSavings.length > 0 ? edSavings[edSavings.length - 1] : null;
      if (!latestEd) return { success: false, noData: true, actionItemsCreated: 0, error: "No education savings found" };

      const { createRespStepFn } = await import("../engine/education");
      const respProfile = {
        childAge: latestEd.childAge,
        targetAge: latestEd.targetAge,
        currentBalance: Number(latestEd.currentBalance),
        annualContribution: Number(latestEd.monthlyContribution) * 12,
        familyIncomeBracket: (latestEd.familyIncomeBracket ?? "high") as "low" | "mid" | "high",
        cesgReceivedToDate: Number(latestEd.cesgReceivedToDate ?? 0),
        clbEligible: latestEd.clbEligible ?? false,
        clbReceivedToDate: Number(latestEd.clbReceivedToDate ?? 0),
        targetEducationCost: Number(latestEd.estimatedCost),
        educationCostInflation: Number(latestEd.educationCostInflation ?? 0.03),
        equityAllocation: Number(latestEd.equityAllocation ?? 0.6),
        bondAllocation: Number(latestEd.bondAllocation ?? 0.4),
      };

      const engine = createRespStepFn(respProfile, false);
      initialState = engine.initialState;
      stepFn = engine.stepFn;
      simAssumptions.yearsToProject = Math.max(1, engine.yearsToProject);
    } else if (mod === "debt") {
      const debtEntries = await storage.getDebtEntries(clientId);
      if (debtEntries.length === 0) return { success: false, noData: true, actionItemsCreated: 0, error: "No debt entries found" };

      const { createDebtStepFn } = await import("../engine/debt");
      const cashFlowBudgets = await storage.getCashFlowBudgets(clientId);
      const latestCashFlow = cashFlowBudgets.length > 0 ? cashFlowBudgets[cashFlowBudgets.length - 1] : null;

      const debtItems = debtEntries.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        balance: Number(d.balance),
        interestRate: Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
        isVariableRate: d.category === "variable-rate" || d.category === "line-of-credit",
      }));

      const monthlyIncome = latestCashFlow
        ? Number(latestCashFlow.monthlyNetIncome) + Number(latestCashFlow.additionalIncome ?? 0)
        : 5000;
      const monthlyExpenses = latestCashFlow
        ? (latestCashFlow.budgetEntries as Array<{ monthlyAmount: number }>).reduce((s, e) => s + e.monthlyAmount, 0)
        : 3000;

      const debtEngine = createDebtStepFn(debtItems, monthlyIncome, monthlyExpenses);
      initialState = debtEngine.initialState;
      stepFn = debtEngine.stepFn;
      simAssumptions.yearsToProject = debtEngine.yearsToProject;
    }

    if (!stepFn) {
      return { success: false, noData: true, actionItemsCreated: 0, error: `No step function for module ${mod}` };
    }

    const { runSimulation } = await import("../engine/monteCarlo");
    const simResult = runSimulation(simAssumptions, initialState, stepFn, undefined, false);

    await storage.upsertSimulationResult({
      planId,
      module: mod,
      scenario,
      successRate: String(simResult.successRate),
      p10: String(simResult.finalBalancePercentiles.p10),
      p25: String(simResult.finalBalancePercentiles.p25),
      p50: String(simResult.finalBalancePercentiles.p50),
      p75: String(simResult.finalBalancePercentiles.p75),
      p90: String(simResult.finalBalancePercentiles.p90),
      assumptionsSnapshot: simAssumptions,
      medianPath: simResult.medianPath,
      percentileBands: simResult.percentileBands,
      sensitivityData: simResult.sensitivity,
      simulationCount: simResult.simulationCount,
      yearsProjected: simResult.yearsProjected,
    });

    const itemsCreated = await generateThresholdActionItems(
      planId, mod, scenario, simResult, existingItems
    );
    actionItemsCreated += itemsCreated;
  }

  return { success: true, noData: false, actionItemsCreated };
}

async function generateThresholdActionItems(
  planId: number,
  mod: string,
  scenario: string,
  simResult: { successRate: number; finalBalancePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number } },
  existingItems: Awaited<ReturnType<typeof storage.getPlanActionItems>>
): Promise<number> {
  let count = 0;

  const staleItems = existingItems.filter(
    item => item.module === mod && item.status === "pending" &&
    item.title.includes(`(${scenario})`) && item.title.includes("[auto]")
  );
  for (const stale of staleItems) {
    await storage.deletePlanActionItem(stale.id);
  }

  if (mod === "retirement" && simResult.successRate < 0.70) {
    await storage.createPlanActionItem({
      planId,
      module: "retirement",
      priority: simResult.successRate < 0.50 ? "critical" : "high",
      title: `[auto] Retirement success below 70% (${scenario})`,
      description: `Monte Carlo simulation shows only ${(simResult.successRate * 100).toFixed(1)}% probability of meeting retirement income goals. Consider increasing contributions or adjusting retirement timeline.`,
      status: "pending",
    });
    count++;
  }

  if (mod === "insurance" && simResult.successRate < 0.80) {
    await storage.createPlanActionItem({
      planId,
      module: "insurance",
      priority: simResult.successRate < 0.50 ? "critical" : "high",
      title: `[auto] Insurance coverage inadequacy detected (${scenario})`,
      description: `Monte Carlo analysis shows ${(simResult.successRate * 100).toFixed(1)}% adequacy. Review life, disability, and critical illness coverage levels.`,
      status: "pending",
    });
    count++;
  }

  if (mod === "education" && simResult.successRate < 0.50) {
    await storage.createPlanActionItem({
      planId,
      module: "education",
      priority: "medium",
      title: `[auto] RESP funding probability below 50% (${scenario})`,
      description: `Only ${(simResult.successRate * 100).toFixed(1)}% probability of meeting education funding target. Consider increasing monthly contributions or reviewing investment allocation.`,
      status: "pending",
    });
    count++;
  }

  if (mod === "debt" && simResult.successRate < 0.50) {
    await storage.createPlanActionItem({
      planId,
      module: "debt",
      priority: "high",
      title: `[auto] Debt payoff risk (${scenario})`,
      description: `Only ${(simResult.successRate * 100).toFixed(1)}% probability of becoming debt-free within the projected timeline. Consider increasing payments or consolidating high-interest debt.`,
      status: "pending",
    });
    count++;
  }

  return count;
}

async function generateInsuranceCoverageGapItems(planId: number, clientId: number): Promise<number> {
  const analyses = await storage.getInsuranceAnalyses(clientId);
  const latestIns = analyses.length > 0 ? analyses[analyses.length - 1] : null;
  if (!latestIns) return 0;

  const existingItems = await storage.getPlanActionItems(planId);
  const staleGapItems = existingItems.filter(
    item => item.status === "pending" && item.title.includes("[auto]") && item.title.includes("coverage gap")
  );
  for (const stale of staleGapItems) {
    await storage.deletePlanActionItem(stale.id);
  }

  const { runFullInsuranceAnalysis } = await import("../engine/insurance");
  const insProfile = {
    annualIncome: Number(latestIns.annualIncome),
    personalConsumptionRate: Number(latestIns.personalConsumptionRate ?? 0.30),
    workingYearsRemaining: latestIns.yearsOfIncomeNeeded,
    mortgageBalance: Number(latestIns.mortgageBalance ?? 0),
    totalDebts: Number(latestIns.totalDebts ?? 0),
    educationFundTarget: Number(latestIns.educationFundTarget ?? 0),
    finalExpenses: Number(latestIns.finalExpenses ?? 15000),
    existingLifeCoverage: Number(latestIns.existingLifeCoverage),
    existingAssets: Number(latestIns.existingAssets),
    monthlyExpenses: Number(latestIns.monthlyExpenses),
    existingDisabilityCoverage: Number(latestIns.existingDisabilityCoverage),
    cppDisabilityBenefit: Number(latestIns.cppDisabilityBenefit ?? 0),
    diReplacementRate: Number(latestIns.diReplacementRate ?? 0.70),
    criticalIllnessLumpSum: Number(latestIns.criticalIllnessLumpSum),
    existingCriticalIllnessCoverage: Number(latestIns.existingCriticalIllnessCoverage),
    uncoveredTreatmentCosts: Number(latestIns.uncoveredTreatmentCosts ?? 0),
    discountRate: Number(latestIns.discountRate ?? 0.04),
    withdrawalRate: Number(latestIns.withdrawalRate ?? 0.04),
    incomeVolatility: Number(latestIns.incomeVolatility ?? 0),
    isVariableIncome: latestIns.isVariableIncome ?? false,
  };

  const method = (latestIns.calculationMethod as "dime" | "humanLifeValue" | "capitalRetention") ?? "dime";
  const analysis = runFullInsuranceAnalysis(insProfile, method);
  let count = 0;

  if (analysis.recommendedLifeCoverage > 0) {
    const gapRatio = analysis.lifeCoverageGap / analysis.recommendedLifeCoverage;
    if (gapRatio > 0.20) {
      await storage.createPlanActionItem({
        planId,
        module: "insurance",
        priority: gapRatio > 0.40 ? "critical" : "high",
        title: `[auto] Life insurance coverage gap of ${(gapRatio * 100).toFixed(0)}% detected`,
        description: `Recommended life coverage: $${analysis.recommendedLifeCoverage.toLocaleString()}. Current gap: $${analysis.lifeCoverageGap.toLocaleString()} (${(gapRatio * 100).toFixed(1)}% of recommended). Review and increase coverage.`,
        status: "pending",
      });
      count++;
    }
  }

  if (analysis.diGap) {
    const diMonthlyGap = analysis.diGap.monthlyGap;
    if (diMonthlyGap > 0) {
      await storage.createPlanActionItem({
        planId,
        module: "insurance",
        priority: "high",
        title: `[auto] Disability insurance coverage gap detected`,
        description: `Monthly disability income gap of $${diMonthlyGap.toLocaleString()}. Consider supplemental disability coverage.`,
        status: "pending",
      });
      count++;
    }
  }

  if (analysis.ciGap) {
    const ciGapAmount = analysis.ciGap.gap;
    if (ciGapAmount > 0) {
      await storage.createPlanActionItem({
        planId,
        module: "insurance",
        priority: "medium",
        title: `[auto] Critical illness coverage gap detected`,
        description: `Critical illness coverage gap of $${ciGapAmount.toLocaleString()}. Review critical illness insurance needs.`,
        status: "pending",
      });
      count++;
    }
  }

  return count;
}

export async function generateBeneficiaryActionItems(planId: number, clientId: number): Promise<number> {
  const products = await storage.getProductsByClient(clientId);
  const existingItems = await storage.getPlanActionItems(planId);
  let count = 0;

  const staleBeneficiaryItems = existingItems.filter(
    item => item.status === "pending" && item.title.includes("[auto]") && item.title.includes("beneficiary")
  );
  for (const stale of staleBeneficiaryItems) {
    await storage.deletePlanActionItem(stale.id);
  }

  const estateProducts = products.filter(p => p.beneficiary === "estate");
  if (estateProducts.length > 0) {
    await storage.createPlanActionItem({
      planId,
      module: "estate",
      priority: "critical",
      title: `[auto] ${estateProducts.length} product(s) with beneficiary set to "estate"`,
      description: `Products defaulting to estate bypass probate exemptions. Review and consider naming specific beneficiaries: ${estateProducts.map(p => p.provider + " " + (p.policyNumber ?? "")).join(", ")}.`,
      status: "pending",
    });
    count++;
  }

  const missingBeneficiary = products.filter(p => !p.beneficiary && ["life_insurance", "segregated_fund", "rrsp", "rrif", "tfsa"].includes(p.type));
  if (missingBeneficiary.length > 0) {
    await storage.createPlanActionItem({
      planId,
      module: "estate",
      priority: "high",
      title: `[auto] ${missingBeneficiary.length} product(s) missing beneficiary designation`,
      description: `The following products have no beneficiary on file: ${missingBeneficiary.map(p => p.provider + " " + (p.policyNumber ?? "")).join(", ")}. This may result in probate delays.`,
      status: "pending",
    });
    count++;
  }

  return count;
}

export async function generateRebalancingActionItems(planId: number, clientId: number): Promise<number> {
  const retirementProjs = await storage.getRetirementProjections(clientId);
  const latestProj = retirementProjs.length > 0 ? retirementProjs[retirementProjs.length - 1] : null;
  if (!latestProj) return 0;

  const existingItems = await storage.getPlanActionItems(planId);
  const staleRebalItems = existingItems.filter(
    item => item.status === "pending" && item.title.includes("[auto]") && item.title.includes("rebalancing")
  );
  for (const stale of staleRebalItems) {
    await storage.deletePlanActionItem(stale.id);
  }

  const targetEquity = Number(latestProj.equityAllocation ?? 0.6);
  const _targetBond = Number(latestProj.bondAllocation ?? 0.4);
  const products = await storage.getProductsByClient(clientId);
  const totalValue = products.reduce((s, p) => s + Number(p.value ?? 0), 0);
  if (totalValue <= 0) return 0;

  const equityProducts = products.filter(p => ["mutual_fund", "segregated_fund", "etf"].includes(p.type));
  const equityValue = equityProducts.reduce((s, p) => s + Number(p.value ?? 0), 0);
  const currentEquityRatio = equityValue / totalValue;
  const drift = Math.abs(currentEquityRatio - targetEquity);

  if (drift > 0.05) {
    await storage.createPlanActionItem({
      planId,
      module: "retirement",
      priority: drift > 0.10 ? "high" : "medium",
      title: `[auto] Portfolio rebalancing needed`,
      description: `Current equity allocation is ${(currentEquityRatio * 100).toFixed(1)}% vs target of ${(targetEquity * 100).toFixed(1)}%. Drift of ${(drift * 100).toFixed(1)}% exceeds 5% threshold. Consider rebalancing.`,
      status: "pending",
    });
    return 1;
  }

  return 0;
}

export async function createPlanSnapshot(
  planId: number,
  trigger: string,
  createdBy?: number,
  notes?: string
): Promise<ReturnType<typeof storage.createPlanSnapshot>> {
  const assumptions = await storage.getPlanAssumptions(planId);
  const simResults = await storage.getSimulationResults(planId);
  const actionItems = await storage.getPlanActionItems(planId);
  const staleFlags = await storage.getPlanStaleFlags(planId);

  const plan = await getFirstPlan(planId);
  if (!plan) throw new Error("Plan not found");

  const clientId = plan.clientId;
  const [
    retirementProjections,
    insuranceAnalyses,
    educationSavings,
    debtEntries,
    netWorthEntries,
  ] = await Promise.all([
    storage.getRetirementProjections(clientId),
    storage.getInsuranceAnalyses(clientId),
    storage.getEducationSavings(clientId),
    storage.getDebtEntries(clientId),
    storage.getNetWorthEntries(clientId),
  ]);

  const snapshotData = {
    capturedAt: new Date().toISOString(),
    plan: { id: plan.id, title: plan.title, clientId: plan.clientId },
    assumptions,
    simulationResults: simResults,
    actionItems,
    staleFlags,
    moduleData: {
      retirement: retirementProjections,
      insurance: insuranceAnalyses,
      education: educationSavings,
      debt: debtEntries,
      netWorth: netWorthEntries,
    },
  };

  return storage.createPlanSnapshot({
    planId,
    snapshotData,
    trigger,
    notes: notes ?? null,
    createdBy: createdBy ?? null,
  });
}
