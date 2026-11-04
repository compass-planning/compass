import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
import { api } from "@shared/routes";
import {
  financialPlans, planScenarios, planModules, simulatableModules,
  snapshotTriggers, actionItemStatuses, actionItemPriorities,
  DEFAULT_ASSUMPTION_SETS, _planAssumptions, planActionItems,
  planStaleFlags, educationSavings, debtEntries, taxPlanningNotes,
  estatePlanningNotes, estateAnalyses, cashFlowBudgets, aiRecommendations,
  netWorthEntries, retirementProjections, insuranceAnalyses,
  _insertTaskSchema,
} from "@shared/schema";
import { isAuthenticated } from "../auth";
import {
  getStaffFromSession, getCompanyId,
  verifyClientOwnership, verifyFpRecordOwnership, verifyPlanChildOwnership,
} from "./middleware";
import { logger } from "../logger";

export const plansRouter = Router();
const router = plansRouter;

  // ===== Financial Plans =====
router.get(api.plans.list.path, isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const plans = await storage.getPlansByClient(clientId);
    res.json(plans);
  });

router.post(api.plans.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const input = api.plans.create.input.parse(req.body);
      const plan = await storage.createPlan({ ...input, clientId });
      res.status(201).json(plan);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  });

router.put("/api/plans/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, id))) return;
    const updates = req.body;
    const plan = await storage.updatePlan(id, updates);
    res.json(plan);
  });

router.delete("/api/plans/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, id))) return;
    await storage.deletePlan(id);
    res.json({ success: true });
  });

  // ===== Plan Assumptions =====
router.get("/api/plans/:planId/assumptions", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const assumptions = await storage.getPlanAssumptions(planId);
    res.json(assumptions);
  });

router.get("/api/plans/:planId/assumptions/:scenario", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const scenario = req.params.scenario;
    if (!planScenarios.includes(scenario)) {
      return res.status(400).json({ message: `Invalid scenario. Must be one of: ${planScenarios.join(", ")}` });
    }
    const assumption = await storage.getPlanAssumptionByScenario(planId, scenario);
    if (!assumption) return res.status(404).json({ message: "No assumptions found for this scenario" });
    res.json(assumption);
  });

router.post("/api/plans/:planId/assumptions", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        scenario: z.enum(planScenarios),
        equityReturn: z.string(),
        equityVolatility: z.string(),
        bondReturn: z.string(),
        bondVolatility: z.string(),
        inflationMean: z.string().optional(),
        inflationVolatility: z.string().optional(),
        corrEquityBond: z.string().optional(),
        corrEquityInflation: z.string().optional(),
        corrBondInflation: z.string().optional(),
        planToAge: z.number().int().min(60).max(110).optional(),
        simulationCount: z.number().int().min(1000).max(10000).optional(),
        cppStartAge: z.number().int().min(60).max(70).optional(),
        oasStartAge: z.number().int().min(65).max(70).optional(),
        province: z.string().optional(),
        stressCrashYear: z.number().int().min(1).max(10).optional().nullable(),
        stressCrashMagnitude: z.string().optional().nullable(),
        stressRecoveryYears: z.number().int().min(1).max(10).optional().nullable(),
      }).parse(req.body);
      const assumption = await storage.upsertPlanAssumption({ ...input, planId });
      res.status(201).json(assumption);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

router.put("/api/plans/:planId/assumptions/:scenario", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const scenario = req.params.scenario;
      if (!planScenarios.includes(scenario)) {
        return res.status(400).json({ message: `Invalid scenario. Must be one of: ${planScenarios.join(", ")}` });
      }
      const existing = await storage.getPlanAssumptionByScenario(planId, scenario);
      if (!existing) return res.status(404).json({ message: "No assumptions found for this scenario" });
      const input = z.object({
        equityReturn: z.string().optional(),
        equityVolatility: z.string().optional(),
        bondReturn: z.string().optional(),
        bondVolatility: z.string().optional(),
        inflationMean: z.string().optional(),
        inflationVolatility: z.string().optional(),
        corrEquityBond: z.string().optional(),
        corrEquityInflation: z.string().optional(),
        corrBondInflation: z.string().optional(),
        planToAge: z.number().int().min(60).max(110).optional(),
        simulationCount: z.number().int().min(1000).max(10000).optional(),
        cppStartAge: z.number().int().min(60).max(70).optional(),
        oasStartAge: z.number().int().min(65).max(70).optional(),
        province: z.string().optional(),
        stressCrashYear: z.number().int().min(1).max(10).optional().nullable(),
        stressCrashMagnitude: z.string().optional().nullable(),
        stressRecoveryYears: z.number().int().min(1).max(10).optional().nullable(),
      }).parse(req.body);
      const updated = await storage.upsertPlanAssumption({ ...existing, ...input, planId, scenario });
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

router.post("/api/plans/:planId/assumptions/seed-defaults", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const results = [];
    for (const scenario of planScenarios) {
      const defaults = scenario === "base"
        ? DEFAULT_ASSUMPTION_SETS.moderate
        : scenario === "optimistic"
          ? DEFAULT_ASSUMPTION_SETS.aggressive
          : DEFAULT_ASSUMPTION_SETS.conservative;
      const assumption = await storage.upsertPlanAssumption({
        planId,
        scenario,
        ...defaults,
        corrEquityBond: "-0.15",
        corrEquityInflation: "0.10",
        corrBondInflation: "0.30",
        planToAge: 95,
        simulationCount: 5000,
        cppStartAge: 65,
        oasStartAge: 65,
        province: "ontario",
      });
      results.push(assumption);
    }
    res.status(201).json(results);
  });

  // ===== Simulation Results =====
router.get("/api/plans/:planId/simulation-results", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const results = await storage.getSimulationResults(planId);
    res.json(results);
  });

router.get("/api/plans/:planId/simulation-results/:module/:scenario", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const { module: mod, scenario } = req.params;
    if (!planModules.includes(mod)) {
      return res.status(400).json({ message: `Invalid module. Must be one of: ${planModules.join(", ")}` });
    }
    if (!planScenarios.includes(scenario)) {
      return res.status(400).json({ message: `Invalid scenario. Must be one of: ${planScenarios.join(", ")}` });
    }
    const result = await storage.getSimulationResultByModuleScenario(planId, mod, scenario);
    if (!result) return res.status(404).json({ message: "No simulation results found" });
    res.json(result);
  });

router.get("/api/plans/:planId/scenario-comparison", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const results = await storage.getSimulationResults(planId);
    const comparison: Record<string, Record<string, {
      successRate: string;
      p10: string; p25: string; p50: string; p75: string; p90: string;
    }>> = {};
    for (const r of results) {
      if (!comparison[r.module]) comparison[r.module] = {};
      comparison[r.module][r.scenario] = {
        successRate: r.successRate,
        p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90,
      };
    }
    res.json({ planId, comparison });
  });

router.post("/api/plans/:planId/run-simulation", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;

      const input = z.object({
        modules: z.array(z.enum(simulatableModules)).optional(),
        scenarios: z.array(z.enum(planScenarios)).optional(),
      }).parse(req.body ?? {});

      const targetModules = input.modules ?? ["retirement"];
      const targetScenarios = input.scenarios ?? planScenarios.slice();

      const assumptions = await storage.getPlanAssumptions(planId);
      if (assumptions.length === 0) {
        return res.status(400).json({ message: "No plan assumptions found. Seed defaults first with POST /api/plans/:planId/assumptions/seed-defaults" });
      }

      const missingScenarios = targetScenarios.filter(s => !assumptions.find(a => a.scenario === s));
      if (missingScenarios.length > 0) {
        return res.status(400).json({ message: `Missing assumptions for scenarios: ${missingScenarios.join(", ")}. Create them first or seed defaults.` });
      }

      const { runSimulation } = await import("../engine/monteCarlo");
      const { createRetirementStepFn, rrspVsTfsaDecision } = await import("../engine/retirement");
      const { cppTimingComparison } = await import("../engine/reference/cppOas");
      const { createInsuranceStepFn, runFullInsuranceAnalysis } = await import("../engine/insurance");
      const { createRespStepFn, calculateRequiredContribution } = await import("../engine/education");

      const [plan] = await db.select({ clientId: financialPlans.clientId }).from(financialPlans).where(eq(financialPlans.id, planId));
      if (!plan) return res.status(404).json({ message: "Plan not found" });

      const retirementProjs = await storage.getRetirementProjections(plan.clientId);
      const latestProj = retirementProjs.length > 0 ? retirementProjs[retirementProjs.length - 1] : null;

      const insuranceAnalysesList = await storage.getInsuranceAnalyses(plan.clientId);
      const latestInsurance = insuranceAnalysesList.length > 0 ? insuranceAnalysesList[insuranceAnalysesList.length - 1] : null;

      const educationSavingsList = await storage.getEducationSavings(plan.clientId);
      const latestEducation = educationSavingsList.length > 0 ? educationSavingsList[educationSavingsList.length - 1] : null;

      const clientDebtEntries = await storage.getDebtEntries(plan.clientId);
      const clientCashFlowBudgets = await storage.getCashFlowBudgets(plan.clientId);
      const latestCashFlow = clientCashFlowBudgets.length > 0 ? clientCashFlowBudgets[clientCashFlowBudgets.length - 1] : null;

      const allResults = [];

      for (const scenario of targetScenarios) {
        const assumption = assumptions.find(a => a.scenario === scenario);
        if (!assumption) continue;

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
          seed: planId * 1000 + planScenarios.indexOf(scenario),
        };

        for (const mod of targetModules) {
          let initialState: { balance: number; contributions: number; withdrawals: number; customData?: Record<string, number> };
          let stepFn: (state: { year: number; balance: number; contributions: number; withdrawals: number; returns: { equity: number; bond: number; inflation: number }; inflationCumulative: number; success: boolean; customData?: Record<string, number> }, returns: { equity: number; bond: number; inflation: number }, simIndex: number) => { year: number; balance: number; contributions: number; withdrawals: number; returns: { equity: number; bond: number; inflation: number }; inflationCumulative: number; success: boolean; customData?: Record<string, number> };
          let moduleSpecificData: Record<string, unknown> = {};

          if (mod === "retirement" && !latestProj) {
            return res.status(400).json({ message: "No retirement projection found for this client. Create a retirement projection first before running retirement simulations." });
          }

          if (mod === "insurance" && !latestInsurance) {
            return res.status(400).json({ message: "No insurance analysis found for this client. Create an insurance analysis first before running insurance simulations." });
          }

          if (mod === "education" && !latestEducation) {
            return res.status(400).json({ message: "No education savings plan found for this client. Create an education savings entry first before running education simulations." });
          }

          if (mod === "debt" && clientDebtEntries.length === 0) {
            return res.status(400).json({ message: "No debt entries found for this client. Add debts first before running debt simulations." });
          }

          if (mod === "retirement" && latestProj) {
            const rrspBal = Number(latestProj.rrspBalance ?? latestProj.currentSavings);
            const tfsaBal = Number(latestProj.tfsaBalance ?? 0);
            const nonRegBal = Number(latestProj.nonRegBalance ?? 0);

            const profile = {
              currentAge: latestProj.currentAge,
              retirementAge: latestProj.retirementAge,
              planToAge: assumption.planToAge,
              province: latestProj.province ?? assumption.province,
              rrspBalance: rrspBal,
              tfsaBalance: tfsaBal,
              nonRegBalance: nonRegBal,
              annualRrspContribution: Number(latestProj.annualContribution),
              annualTfsaContribution: Number(latestProj.annualTfsaContribution ?? 0),
              annualNonRegContribution: Number(latestProj.annualNonRegContribution ?? 0),
              employmentIncome: Number(latestProj.employmentIncome ?? 80000),
              pensionIncome: Number(latestProj.pensionIncome ?? 0),
              spouseIncome: Number(latestProj.spouseIncome ?? 0),
              desiredRetirementIncome: Number(latestProj.desiredRetirementIncome),
              cppStartAge: latestProj.cppStartAge ?? assumption.cppStartAge,
              oasStartAge: latestProj.oasStartAge ?? assumption.oasStartAge,
              rrifConversionAge: latestProj.rrifConversionAge ?? 71,
              yearsInCanada: latestProj.yearsInCanada ?? 40,
              equityAllocation: Number(latestProj.equityAllocation ?? 0.6),
              bondAllocation: Number(latestProj.bondAllocation ?? 0.4),
              desiredIncomeSourceMix: (latestProj.desiredIncomeSourceMix as Record<string, number> | undefined) ?? undefined,
            };

            const retirementEngine = createRetirementStepFn(profile, false);

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

            const stressCrashYear = assumption.stressCrashYear;
            const stressCrashMagnitude = assumption.stressCrashMagnitude ? Number(assumption.stressCrashMagnitude) : null;
            const stressRecoveryYears = assumption.stressRecoveryYears;
            const hasStressShock = stressCrashYear !== null && stressCrashMagnitude !== null && stressRecoveryYears !== null;

            if (hasStressShock) {
              const baseStep = retirementEngine.stepFn;
              stepFn = (state, returns, simIndex) => {
                const modifiedReturns = { ...returns };
                if (state.year === stressCrashYear) {
                  modifiedReturns.equity = -(stressCrashMagnitude!);
                  modifiedReturns.bond = modifiedReturns.bond * 0.5;
                } else if (state.year > stressCrashYear! && state.year <= stressCrashYear! + stressRecoveryYears!) {
                  const recoveryProgress = (state.year - stressCrashYear!) / stressRecoveryYears!;
                  modifiedReturns.equity = modifiedReturns.equity * recoveryProgress;
                }
                return baseStep({ ...state, returns: modifiedReturns }, modifiedReturns, simIndex);
              };
            } else {
              stepFn = retirementEngine.stepFn;
            }

            const cppTiming = cppTimingComparison();
            const rrspTfsa = rrspVsTfsaDecision(
              profile.employmentIncome,
              profile.desiredRetirementIncome,
              profile.province
            );

            moduleSpecificData = {
              retirementProfile: profile,
              cppTimingAnalysis: cppTiming,
              rrspVsTfsaAdvice: rrspTfsa,
              stressShock: hasStressShock ? { crashYear: stressCrashYear, magnitude: stressCrashMagnitude, recoveryYears: stressRecoveryYears } : null,
            };

            simAssumptions.yearsToProject = Math.max(1, profile.planToAge - profile.currentAge);
          } else if (mod === "insurance" && latestInsurance) {
            const insProfile = {
              annualIncome: Number(latestInsurance.annualIncome),
              personalConsumptionRate: Number(latestInsurance.personalConsumptionRate ?? 0.30),
              workingYearsRemaining: latestInsurance.yearsOfIncomeNeeded,
              mortgageBalance: Number(latestInsurance.mortgageBalance ?? 0),
              totalDebts: Number(latestInsurance.totalDebts ?? 0),
              educationFundTarget: Number(latestInsurance.educationFundTarget ?? 0),
              finalExpenses: Number(latestInsurance.finalExpenses ?? 15000),
              existingLifeCoverage: Number(latestInsurance.existingLifeCoverage),
              existingAssets: Number(latestInsurance.existingAssets),
              monthlyExpenses: Number(latestInsurance.monthlyExpenses),
              existingDisabilityCoverage: Number(latestInsurance.existingDisabilityCoverage),
              cppDisabilityBenefit: Number(latestInsurance.cppDisabilityBenefit ?? 0),
              diReplacementRate: Number(latestInsurance.diReplacementRate ?? 0.70),
              criticalIllnessLumpSum: Number(latestInsurance.criticalIllnessLumpSum),
              existingCriticalIllnessCoverage: Number(latestInsurance.existingCriticalIllnessCoverage),
              uncoveredTreatmentCosts: Number(latestInsurance.uncoveredTreatmentCosts ?? 0),
              discountRate: Number(latestInsurance.discountRate ?? 0.04),
              withdrawalRate: Number(latestInsurance.withdrawalRate ?? 0.04),
              incomeVolatility: Number(latestInsurance.incomeVolatility ?? 0),
              isVariableIncome: latestInsurance.isVariableIncome ?? false,
            };

            const insEngine = createInsuranceStepFn(insProfile);
            initialState = insEngine.initialState;
            stepFn = insEngine.stepFn;
            simAssumptions.yearsToProject = Math.max(1, insProfile.workingYearsRemaining);

            const fullAnalysis = runFullInsuranceAnalysis(insProfile, (latestInsurance.calculationMethod as "dime" | "humanLifeValue" | "capitalRetention") ?? "dime");
            moduleSpecificData = { insuranceProfile: insProfile, fullAnalysis };
          } else if (mod === "education" && latestEducation) {
            const respProfile = {
              childAge: latestEducation.childAge,
              targetAge: latestEducation.targetAge,
              currentBalance: Number(latestEducation.currentBalance),
              annualContribution: Number(latestEducation.monthlyContribution) * 12,
              familyIncomeBracket: (latestEducation.familyIncomeBracket ?? "high") as "low" | "mid" | "high",
              cesgReceivedToDate: Number(latestEducation.cesgReceivedToDate ?? 0),
              clbEligible: latestEducation.clbEligible ?? false,
              clbReceivedToDate: Number(latestEducation.clbReceivedToDate ?? 0),
              targetEducationCost: Number(latestEducation.estimatedCost),
              educationCostInflation: Number(latestEducation.educationCostInflation ?? 0.03),
              equityAllocation: Number(latestEducation.equityAllocation ?? 0.6),
              bondAllocation: Number(latestEducation.bondAllocation ?? 0.4),
            };

            const respEngine = createRespStepFn(respProfile, false);
            initialState = respEngine.initialState;
            stepFn = respEngine.stepFn;
            simAssumptions.yearsToProject = Math.max(1, respEngine.yearsToProject);

            const requiredMonthly = calculateRequiredContribution(
              respProfile, 0.9,
              Number(assumption.equityReturn), Number(assumption.bondReturn),
              respProfile.educationCostInflation
            );
            moduleSpecificData = {
              respProfile,
              requiredMonthlyFor90Pct: Math.ceil(requiredMonthly / 12),
              targetCostInflated: respProfile.targetEducationCost * 4 * Math.pow(1 + respProfile.educationCostInflation, respEngine.yearsToProject),
            };
          } else if (mod === "debt" && clientDebtEntries.length > 0) {
            const { createDebtStepFn } = await import("../engine/debt");
            const debtItems = clientDebtEntries.map(d => ({
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
            moduleSpecificData = {
              totalDebtBalance: debtItems.reduce((s, d) => s + d.balance, 0),
              debtCount: debtItems.length,
              weightedRate: debtItems.reduce((s, d) => s + d.interestRate * d.balance, 0) / Math.max(1, debtItems.reduce((s, d) => s + d.balance, 0)),
            };
          } else {
            initialState = { balance: 100000, contributions: 10000, withdrawals: 0 };
            stepFn = (state, _returns, _simIndex) => {
              const equityAlloc = 0.6;
              const bondAlloc = 0.4;
              const portfolioReturn = equityAlloc * state.returns.equity + bondAlloc * state.returns.bond;
              const newBalance = (state.balance + state.contributions - state.withdrawals) * (1 + portfolioReturn);
              return { ...state, balance: Math.max(0, newBalance), success: newBalance > 0 };
            };
          }

          const result = runSimulation(simAssumptions, initialState, stepFn, undefined, true);

          if (mod === "education" && latestEducation) {
            const targetCostInflated = moduleSpecificData.targetCostInflated as number;
            const p25Balance = result.finalBalancePercentiles.p25;
            const p25Shortfall = Math.max(0, targetCostInflated - p25Balance);
            moduleSpecificData.p25Shortfall = Math.round(p25Shortfall);
            moduleSpecificData.p25Balance = Math.round(p25Balance);
            moduleSpecificData.targetCostInflated = Math.round(targetCostInflated);
          }

          let yearlyDetailBreakdown: unknown[] | null = null;
          if (mod === "retirement" && latestProj) {
            const detailEngine = createRetirementStepFn({
              currentAge: latestProj.currentAge,
              retirementAge: latestProj.retirementAge,
              planToAge: assumption.planToAge,
              province: latestProj.province ?? assumption.province,
              rrspBalance: Number(latestProj.rrspBalance ?? latestProj.currentSavings),
              tfsaBalance: Number(latestProj.tfsaBalance ?? 0),
              nonRegBalance: Number(latestProj.nonRegBalance ?? 0),
              annualRrspContribution: Number(latestProj.annualContribution),
              annualTfsaContribution: Number(latestProj.annualTfsaContribution ?? 0),
              annualNonRegContribution: Number(latestProj.annualNonRegContribution ?? 0),
              employmentIncome: Number(latestProj.employmentIncome ?? 80000),
              pensionIncome: Number(latestProj.pensionIncome ?? 0),
              spouseIncome: Number(latestProj.spouseIncome ?? 0),
              desiredRetirementIncome: Number(latestProj.desiredRetirementIncome),
              cppStartAge: latestProj.cppStartAge ?? assumption.cppStartAge,
              oasStartAge: latestProj.oasStartAge ?? assumption.oasStartAge,
              rrifConversionAge: latestProj.rrifConversionAge ?? 71,
              yearsInCanada: latestProj.yearsInCanada ?? 40,
              equityAllocation: Number(latestProj.equityAllocation ?? 0.6),
              bondAllocation: Number(latestProj.bondAllocation ?? 0.4),
              desiredIncomeSourceMix: (latestProj.desiredIncomeSourceMix as Record<string, number> | undefined) ?? undefined,
            }, true);
            const medianEquityReturn = Number(assumption.equityReturn);
            const medianBondReturn = Number(assumption.bondReturn);
            const medianInflation = Number(assumption.inflationMean);
            let detailState = {
              year: 0, balance: initialState.balance,
              contributions: initialState.contributions, withdrawals: 0,
              returns: { equity: 0, bond: 0, inflation: 0 },
              inflationCumulative: 1.0, success: true,
              customData: initialState.customData,
            };
            const detailStressCrashYear = assumption.stressCrashYear;
            const detailStressMagnitude = assumption.stressCrashMagnitude ? Number(assumption.stressCrashMagnitude) : null;
            const detailStressRecovery = assumption.stressRecoveryYears;
            const detailHasStress = detailStressCrashYear !== null && detailStressMagnitude !== null && detailStressRecovery !== null;

            for (let yr = 1; yr <= simAssumptions.yearsToProject; yr++) {
              let eqReturn = medianEquityReturn;
              let bdReturn = medianBondReturn;
              if (detailHasStress) {
                if (yr === detailStressCrashYear) {
                  eqReturn = -(detailStressMagnitude!);
                  bdReturn = bdReturn * 0.5;
                } else if (yr > detailStressCrashYear! && yr <= detailStressCrashYear! + detailStressRecovery!) {
                  const recoveryProgress = (yr - detailStressCrashYear!) / detailStressRecovery!;
                  eqReturn = eqReturn * recoveryProgress;
                }
              }
              const deterministicReturns = { equity: eqReturn, bond: bdReturn, inflation: medianInflation };
              detailState = {
                ...detailState,
                year: yr,
                returns: deterministicReturns,
                inflationCumulative: detailState.inflationCumulative * (1 + medianInflation),
              };
              detailState = detailEngine.stepFn(detailState, deterministicReturns, 0);
            }
            yearlyDetailBreakdown = detailEngine.getDetails();
          }

          const existingItems = await storage.getPlanActionItems(planId);

          if (mod === "retirement") {
            const staleAutoItems = existingItems.filter(
              (item) => item.module === "retirement" && item.status === "pending" &&
              (item.title.includes(`(${scenario})`) && (item.title.startsWith("Retirement shortfall risk") || item.title.startsWith("Strong retirement outlook")))
            );
            for (const stale of staleAutoItems) {
              await storage.deletePlanActionItem(stale.id);
            }

            if (result.successRate < 0.8) {
              await storage.createPlanActionItem({
                planId,
                module: "retirement",
                priority: result.successRate < 0.5 ? "critical" : "high",
                title: `Retirement shortfall risk (${scenario})`,
                description: `${scenario} scenario shows only ${(result.successRate * 100).toFixed(1)}% probability of success. Consider increasing contributions, delaying retirement, or reducing desired income.`,
                status: "pending",
              });
            }
            if (result.successRate >= 0.9) {
              await storage.createPlanActionItem({
                planId,
                module: "retirement",
                priority: "low",
                title: `Strong retirement outlook (${scenario})`,
                description: `${scenario} scenario shows ${(result.successRate * 100).toFixed(1)}% probability of success. Current plan is on track.`,
                status: "pending",
              });
            }
          }

          if (mod === "insurance") {
            const staleInsItems = existingItems.filter(
              (item) => item.module === "insurance" && item.status === "pending" &&
              item.title.includes(`(${scenario})`)
            );
            for (const stale of staleInsItems) {
              await storage.deletePlanActionItem(stale.id);
            }

            const insAnalysis = moduleSpecificData.fullAnalysis as ReturnType<typeof runFullInsuranceAnalysis> | undefined;
            if (insAnalysis && insAnalysis.lifeCoverageGap > 0) {
              await storage.createPlanActionItem({
                planId,
                module: "insurance",
                priority: insAnalysis.lifeCoverageGap > 500000 ? "critical" : "high",
                title: `Life insurance gap detected (${scenario})`,
                description: `${insAnalysis.selectedMethod.toUpperCase()} method shows $${insAnalysis.lifeCoverageGap.toLocaleString()} coverage gap. Review existing policies and consider additional coverage.`,
                status: "pending",
              });
            }
            if (insAnalysis && insAnalysis.diGap.monthlyGap > 0) {
              await storage.createPlanActionItem({
                planId,
                module: "insurance",
                priority: "high",
                title: `Disability insurance gap (${scenario})`,
                description: `Monthly DI gap of $${insAnalysis.diGap.monthlyGap.toFixed(0)}. Current coverage does not meet ${(insAnalysis.diGap.targetReplacement / insAnalysis.diGap.monthlyNetIncome * 100).toFixed(0)}% income replacement target.`,
                status: "pending",
              });
            }
            if (insAnalysis && insAnalysis.ciGap.gap > 0) {
              await storage.createPlanActionItem({
                planId,
                module: "insurance",
                priority: "medium",
                title: `Critical illness coverage gap (${scenario})`,
                description: `CI gap of $${insAnalysis.ciGap.gap.toLocaleString()}. Consider CI policy to cover mortgage, income replacement, and treatment costs.`,
                status: "pending",
              });
            }
          }

          if (mod === "education") {
            const staleEduItems = existingItems.filter(
              (item) => item.module === "education" && item.status === "pending" &&
              item.title.includes(`(${scenario})`)
            );
            for (const stale of staleEduItems) {
              await storage.deletePlanActionItem(stale.id);
            }

            if (result.successRate < 0.7) {
              const reqMonthly = moduleSpecificData.requiredMonthlyFor90Pct as number | undefined;
              await storage.createPlanActionItem({
                planId,
                module: "education",
                priority: result.successRate < 0.4 ? "critical" : "high",
                title: `RESP funding shortfall (${scenario})`,
                description: `Only ${(result.successRate * 100).toFixed(1)}% chance of full funding.${reqMonthly ? ` Increase monthly contribution to ~$${reqMonthly} for 90% success.` : ""} Maximize CESG by contributing at least $2,500/year.`,
                status: "pending",
              });
            }
            if (result.successRate >= 0.9) {
              await storage.createPlanActionItem({
                planId,
                module: "education",
                priority: "low",
                title: `RESP on track (${scenario})`,
                description: `${(result.successRate * 100).toFixed(1)}% probability of full education funding. Current contribution plan is sufficient.`,
                status: "pending",
              });
            }
          }

          if (mod === "debt") {
            const staleDebtItems = existingItems.filter(
              (item) => item.module === "debt" && item.status === "pending" &&
              item.title.includes(`(${scenario})`)
            );
            for (const stale of staleDebtItems) {
              await storage.deletePlanActionItem(stale.id);
            }

            if (result.successRate < 0.5) {
              await storage.createPlanActionItem({
                planId,
                module: "debt",
                priority: "high",
                title: `Debt payoff risk (${scenario})`,
                description: `Only ${(result.successRate * 100).toFixed(1)}% probability of becoming debt-free within the projected timeline. Consider increasing payments or consolidating high-interest debt.`,
                status: "pending",
              });
            }
            if (result.successRate >= 0.8) {
              await storage.createPlanActionItem({
                planId,
                module: "debt",
                priority: "low",
                title: `Debt payoff on track (${scenario})`,
                description: `${(result.successRate * 100).toFixed(1)}% probability of debt elimination. Current payment plan is sustainable.`,
                status: "pending",
              });
            }
          }

          const storedResult = await storage.upsertSimulationResult({
            planId,
            module: mod,
            scenario,
            successRate: String(result.successRate),
            p10: String(result.finalBalancePercentiles.p10),
            p25: String(result.finalBalancePercentiles.p25),
            p50: String(result.finalBalancePercentiles.p50),
            p75: String(result.finalBalancePercentiles.p75),
            p90: String(result.finalBalancePercentiles.p90),
            moduleMedians: yearlyDetailBreakdown ?? result.medianPath,
            sensitivityData: result.sensitivity,
            assumptionsSnapshot: { ...assumption, ...moduleSpecificData },
            medianPath: result.medianPath,
            percentileBands: result.percentileBands,
            simulationCount: result.simulationCount,
            yearsProjected: result.yearsProjected,
          });
          allResults.push(storedResult);
        }
      }

      const comparison: Record<string, Record<string, {
        successRate: string;
        p10: string; p25: string; p50: string; p75: string; p90: string;
      }>> = {};
      for (const r of allResults) {
        if (!comparison[r.module]) comparison[r.module] = {};
        comparison[r.module][r.scenario] = {
          successRate: r.successRate,
          p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90,
        };
      }

      res.json({ planId, resultsCount: allResults.length, comparison, results: allResults });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      if (err instanceof Error) {
        return res.status(500).json({ message: `Simulation failed: ${err.message}` });
      }
      throw err;
    }
  });

  // ===== Retirement Analysis Endpoints =====
router.get("/api/plans/:planId/retirement/cpp-timing", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const { cppTimingComparison } = await import("../engine/reference/cppOas");
    const result = cppTimingComparison();
    res.json(result);
  });

router.get("/api/plans/:planId/retirement/oas-deferral", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const parsed = z.object({
      totalIncome: z.coerce.number().min(0).max(10000000).default(60000),
      yearsInCanada: z.coerce.number().int().min(0).max(50).default(40),
    }).safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0].message, field: parsed.error.errors[0].path.join(".") });
    }
    const { oasDeferralComparison } = await import("../engine/reference/cppOas");
    const result = oasDeferralComparison(parsed.data.totalIncome, parsed.data.yearsInCanada);
    res.json(result);
  });

router.post("/api/plans/:planId/retirement/rrsp-vs-tfsa", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        currentIncome: z.number().min(0),
        expectedRetirementIncome: z.number().min(0),
        province: z.string(),
      }).parse(req.body);
      const { rrspVsTfsaDecision } = await import("../engine/retirement");
      const result = rrspVsTfsaDecision(input.currentIncome, input.expectedRetirementIncome, input.province);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

router.post("/api/plans/:planId/retirement/pension-split", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        selfIncome: z.number().min(0),
        eligiblePensionIncome: z.number().min(0),
        spouseIncome: z.number().min(0),
        province: z.string(),
      }).parse(req.body);
      const { optimizePensionSplit } = await import("../engine/retirement");
      const result = optimizePensionSplit(input.selfIncome, input.eligiblePensionIncome, input.spouseIncome, input.province);
      res.json(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  // ===== Insurance Carrier Auto-Population =====
router.get("/api/clients/:clientId/insurance/carrier-coverage", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;

    const clientProducts = await storage.getProductsByClient(clientId);
    const activeProducts = clientProducts.filter(p => p.status === "active" || p.status === "in-force");

    const lifeTypes = ["life insurance", "term life", "whole life", "universal life", "life"];
    const diTypes = ["disability", "disability insurance", "long-term disability", "short-term disability", "di"];
    const ciTypes = ["critical illness", "critical illness insurance", "ci"];

    const lifeCoverage = activeProducts
      .filter(p => lifeTypes.some(t => p.type.toLowerCase().includes(t)))
      .reduce((sum, p) => sum + Number(p.value), 0);

    const diCoverage = activeProducts
      .filter(p => diTypes.some(t => p.type.toLowerCase().includes(t)))
      .reduce((sum, p) => sum + Number(p.value), 0);

    const ciCoverage = activeProducts
      .filter(p => ciTypes.some(t => p.type.toLowerCase().includes(t)))
      .reduce((sum, p) => sum + Number(p.value), 0);

    res.json({
      existingLifeCoverage: lifeCoverage,
      existingDisabilityCoverage: diCoverage,
      existingCriticalIllnessCoverage: ciCoverage,
      policiesFound: activeProducts.length,
      policies: activeProducts.map(p => ({
        id: p.id,
        type: p.type,
        provider: p.provider,
        policyNumber: p.policyNumber,
        value: p.value,
        status: p.status,
      })),
    });
  });

  // ===== Insurance Analysis Endpoints =====
router.post("/api/plans/:planId/insurance/full-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        annualIncome: z.number().min(0),
        personalConsumptionRate: z.number().min(0).max(1).default(0.30),
        workingYearsRemaining: z.number().int().min(1).max(50),
        mortgageBalance: z.number().min(0).default(0),
        totalDebts: z.number().min(0).default(0),
        educationFundTarget: z.number().min(0).default(0),
        finalExpenses: z.number().min(0).default(15000),
        existingLifeCoverage: z.number().min(0).default(0),
        existingAssets: z.number().min(0).default(0),
        monthlyExpenses: z.number().min(0),
        existingDisabilityCoverage: z.number().min(0).default(0),
        cppDisabilityBenefit: z.number().min(0).default(0),
        diReplacementRate: z.number().min(0).max(1).default(0.70),
        criticalIllnessLumpSum: z.number().min(0).default(0),
        existingCriticalIllnessCoverage: z.number().min(0).default(0),
        uncoveredTreatmentCosts: z.number().min(0).default(0),
        discountRate: z.number().min(0).max(0.15).default(0.04),
        withdrawalRate: z.number().min(0.01).max(0.10).default(0.04),
        incomeVolatility: z.number().min(0).max(1).default(0),
        isVariableIncome: z.boolean().default(false),
        preferredMethod: z.enum(["dime", "humanLifeValue", "capitalRetention"]).default("dime"),
      }).parse(req.body);
      const plan = await storage.getFinancialPlan(planId);
      if (!plan) return res.status(404).json({ message: "Plan not found" });
      const clientProducts = await storage.getProductsByClient(plan.clientId);
      const activeProducts = clientProducts.filter(p => p.status === "active" || p.status === "in-force");

      const lifeTypes = ["life insurance", "term life", "whole life", "universal life", "life"];
      const diTypes = ["disability", "disability insurance", "long-term disability", "short-term disability", "di"];
      const ciTypes = ["critical illness", "critical illness insurance", "ci"];

      const carrierLifeCoverage = activeProducts
        .filter(p => lifeTypes.some(t => p.type.toLowerCase().includes(t)))
        .reduce((sum, p) => sum + Number(p.value), 0);
      const carrierDiCoverage = activeProducts
        .filter(p => diTypes.some(t => p.type.toLowerCase().includes(t)))
        .reduce((sum, p) => sum + Number(p.value), 0);
      const carrierCiCoverage = activeProducts
        .filter(p => ciTypes.some(t => p.type.toLowerCase().includes(t)))
        .reduce((sum, p) => sum + Number(p.value), 0);

      const hydratedInput = {
        ...input,
        existingLifeCoverage: input.existingLifeCoverage > 0 ? input.existingLifeCoverage : carrierLifeCoverage,
        existingDisabilityCoverage: input.existingDisabilityCoverage > 0 ? input.existingDisabilityCoverage : carrierDiCoverage,
        existingCriticalIllnessCoverage: input.existingCriticalIllnessCoverage > 0 ? input.existingCriticalIllnessCoverage : carrierCiCoverage,
      };

      const { runFullInsuranceAnalysis } = await import("../engine/insurance");
      const result = runFullInsuranceAnalysis(hydratedInput, input.preferredMethod);
      res.json({
        ...result,
        carrierDataUsed: {
          lifeCoverage: carrierLifeCoverage,
          disabilityCoverage: carrierDiCoverage,
          criticalIllnessCoverage: carrierCiCoverage,
          policiesFound: activeProducts.length,
        },
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  // ===== RESP/Education Analysis Endpoints =====
router.post("/api/plans/:planId/education/cesg-projection", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        annualContribution: z.number().min(0).max(50000),
        familyIncomeBracket: z.enum(["low", "mid", "high"]).default("high"),
        cesgReceivedToDate: z.number().min(0).default(0),
        childAge: z.number().int().min(0).max(17),
        clbEligible: z.boolean().default(false),
        clbReceivedToDate: z.number().min(0).default(0),
      }).parse(req.body);
      const { calculateCesg, calculateClb } = await import("../engine/education");
      const cesg = calculateCesg(input.annualContribution, input.familyIncomeBracket, input.cesgReceivedToDate);
      const clb = calculateClb(input.childAge, input.clbReceivedToDate, input.clbEligible);
      res.json({ cesg, clb, totalGrants: cesg.totalCesg + clb.amount });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

router.post("/api/plans/:planId/education/required-contribution", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        childAge: z.number().int().min(0).max(17),
        targetAge: z.number().int().min(1).max(25).default(18),
        currentBalance: z.number().min(0).default(0),
        familyIncomeBracket: z.enum(["low", "mid", "high"]).default("high"),
        cesgReceivedToDate: z.number().min(0).default(0),
        clbEligible: z.boolean().default(false),
        clbReceivedToDate: z.number().min(0).default(0),
        targetEducationCost: z.number().min(0),
        educationCostInflation: z.number().min(0).max(0.15).default(0.03),
        equityAllocation: z.number().min(0).max(1).default(0.6),
        bondAllocation: z.number().min(0).max(1).default(0.4),
        equityReturn: z.number().min(0).max(0.20).default(0.07),
        bondReturn: z.number().min(0).max(0.10).default(0.035),
        targetSuccessRate: z.number().min(0.5).max(0.99).default(0.9),
      }).parse(req.body);
      const { calculateRequiredContribution } = await import("../engine/education");
      const profile = {
        childAge: input.childAge,
        targetAge: input.targetAge,
        currentBalance: input.currentBalance,
        annualContribution: 0,
        familyIncomeBracket: input.familyIncomeBracket,
        cesgReceivedToDate: input.cesgReceivedToDate,
        clbEligible: input.clbEligible,
        clbReceivedToDate: input.clbReceivedToDate,
        targetEducationCost: input.targetEducationCost,
        educationCostInflation: input.educationCostInflation,
        equityAllocation: input.equityAllocation,
        bondAllocation: input.bondAllocation,
      };
      const annualRequired = calculateRequiredContribution(
        profile, input.targetSuccessRate,
        input.equityReturn, input.bondReturn,
        input.educationCostInflation
      );
      res.json({
        annualRequired,
        monthlyRequired: Math.ceil(annualRequired / 12),
        targetSuccessRate: input.targetSuccessRate,
        yearsToEnrollment: input.targetAge - input.childAge,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
      }
      throw err;
    }
  });

  // ===== Plan Snapshots =====
router.get("/api/plans/:planId/snapshots", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const snapshots = await storage.getPlanSnapshots(planId);
    res.json(snapshots);
  });

router.get("/api/plan-snapshots/:id", isAuthenticated, async (req: any, res) => {
    const snapshot = await storage.getPlanSnapshot(Number(req.params.id));
    if (!snapshot) return res.status(404).json({ message: "Snapshot not found" });
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, snapshot.planId))) return;
    res.json(snapshot);
  });

router.post("/api/plans/:planId/snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const caller = await getStaffFromSession(req);
      const input = z.object({
        trigger: z.enum(snapshotTriggers),
        notes: z.string().optional(),
      }).parse(req.body);

      const { createPlanSnapshot } = await import("../services/planRecalculation");
      const snapshot = await createPlanSnapshot(planId, input.trigger, caller?.id, input.notes);
      res.status(201).json(snapshot);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.get("/api/plans/:planId/snapshot-comparison", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const snapshots = await storage.getPlanSnapshots(planId);
    if (snapshots.length < 2) {
      return res.json({ message: "Need at least 2 snapshots to compare", snapshots: snapshots.map(s => ({ id: s.id, trigger: s.trigger, createdAt: s.createdAt })) });
    }
    const latest = snapshots[0];
    const previous = snapshots[1];

    const latestData = latest.snapshotData as Record<string, unknown>;
    const previousData = previous.snapshotData as Record<string, unknown>;

    const latestResults = (latestData.simulationResults ?? []) as Array<{ module: string; scenario: string; successRate: string }>;
    const previousResults = (previousData.simulationResults ?? []) as Array<{ module: string; scenario: string; successRate: string }>;

    const changes: Array<{ module: string; scenario: string; previousSuccessRate: string; currentSuccessRate: string; delta: number }> = [];
    for (const cur of latestResults) {
      const prev = previousResults.find(p => p.module === cur.module && p.scenario === cur.scenario);
      if (prev) {
        const delta = Number(cur.successRate) - Number(prev.successRate);
        changes.push({
          module: cur.module,
          scenario: cur.scenario,
          previousSuccessRate: prev.successRate,
          currentSuccessRate: cur.successRate,
          delta: Math.round(delta * 10000) / 10000,
        });
      }
    }

    res.json({
      latestSnapshot: { id: latest.id, trigger: latest.trigger, createdAt: latest.createdAt },
      previousSnapshot: { id: previous.id, trigger: previous.trigger, createdAt: previous.createdAt },
      changes,
    });
  });

router.post("/api/plans/:planId/recalculate", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;

      const { recalculatePlan } = await import("../services/planRecalculation");
      const result = await recalculatePlan(planId);
      res.json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      res.status(500).json({ message: `Recalculation failed: ${msg}` });
    }
  });

  // ===== Plan Stale Flags =====
router.get("/api/plans/:planId/stale-flags", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const unresolvedOnly = req.query.unresolved === "true";
    const flags = unresolvedOnly
      ? await storage.getUnresolvedStaleFlags(planId)
      : await storage.getPlanStaleFlags(planId);
    res.json(flags);
  });

router.post("/api/plans/:planId/stale-flags", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        module: z.enum(planModules),
        triggeredBy: z.string().min(1),
      }).parse(req.body);
      const flag = await storage.createPlanStaleFlag({ ...input, planId });
      res.status(201).json(flag);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.post("/api/stale-flags/:id/resolve", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    const companyId = await getCompanyId(req);
    if (!companyId) return res.status(403).json({ message: "Access denied" });
    const flags = await db.select().from(planStaleFlags).where(eq(planStaleFlags.id, id));
    if (flags.length === 0) return res.status(404).json({ message: "Stale flag not found" });
    const flag = flags[0];
    const [plan] = await db.select({ clientId: financialPlans.clientId }).from(financialPlans).where(eq(financialPlans.id, flag.planId));
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    const client = await storage.getClient(plan.clientId);
    if (!client || client.companyId !== companyId) return res.status(403).json({ message: "Access denied" });
    const resolved = await storage.resolvePlanStaleFlag(id);
    res.json(resolved);
  });

  // ===== Plan Action Items =====
router.get("/api/plans/:planId/action-items", isAuthenticated, async (req: any, res) => {
    const planId = Number(req.params.planId);
    if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
    const items = await storage.getPlanActionItems(planId);
    res.json(items);
  });

router.post("/api/plans/:planId/action-items", isAuthenticated, async (req: any, res) => {
    try {
      const planId = Number(req.params.planId);
      if (!(await verifyFpRecordOwnership(req, res, financialPlans, planId))) return;
      const input = z.object({
        module: z.enum(planModules),
        priority: z.enum(actionItemPriorities).optional(),
        title: z.string().min(1),
        description: z.string().min(1),
        status: z.enum(actionItemStatuses).optional(),
      }).parse(req.body);
      const item = await storage.createPlanActionItem({ ...input, planId });
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.put("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      if (!(await verifyPlanChildOwnership(req, res, planActionItems, id))) return;
      const input = z.object({
        priority: z.enum(actionItemPriorities).optional(),
        title: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        status: z.enum(actionItemStatuses).optional(),
      }).parse(req.body);
      const item = await storage.updatePlanActionItem(id, input);
      res.json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.delete("/api/action-items/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyPlanChildOwnership(req, res, planActionItems, id))) return;
    await storage.deletePlanActionItem(id);
    res.status(204).send();
  });

  // ===== Net Worth Entries =====
router.get("/api/clients/:clientId/net-worth", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const entries = await storage.getNetWorthEntries(clientId);
    res.json(entries);
  });

router.post("/api/clients/:clientId/net-worth", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const { type, category, name, value } = req.body;
    const entry = await storage.createNetWorthEntry({ clientId, type, category, name, value: String(value) });
    res.status(201).json(entry);
  });

router.put("/api/net-worth/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, netWorthEntries, id))) return;
    const updates = req.body;
    if (updates.value !== undefined) updates.value = String(updates.value);
    const entry = await storage.updateNetWorthEntry(id, updates);
    res.json(entry);
  });

router.delete("/api/net-worth/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, netWorthEntries, id))) return;
    await storage.deleteNetWorthEntry(id);
    res.json({ success: true });
  });

  // ===== Retirement Projections =====
router.get("/api/clients/:clientId/retirement-projections", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const projections = await storage.getRetirementProjections(clientId);
    res.json(projections);
  });

router.post("/api/clients/:clientId/retirement-projections", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const {
        currentAge, retirementAge, lifeExpectancy, currentSavings, annualContribution,
        expectedReturn, inflationRate, desiredRetirementIncome,
        cppStartAge, oasStartAge, rrifConversionAge,
        rrspBalance, tfsaBalance, nonRegBalance,
        pensionIncome, spouseIncome, employmentIncome,
        province, equityAllocation, bondAllocation, yearsInCanada,
        annualTfsaContribution, annualNonRegContribution,
        desiredIncomeSourceMix,
      } = req.body;

      const yearsToRetirement = retirementAge - currentAge;
      const yearsInRetirement = lifeExpectancy - retirementAge;
      const returnRate = parseFloat(expectedReturn) / 100;
      const inflation = parseFloat(inflationRate) / 100;
      const realReturn = (1 + returnRate) / (1 + inflation) - 1;

      const breakdown: { year: number; age: number; balance: string }[] = [];
      let balance = parseFloat(currentSavings);
      const annualContrib = parseFloat(annualContribution);

      for (let y = 0; y <= yearsToRetirement; y++) {
        breakdown.push({ year: y, age: currentAge + y, balance: balance.toFixed(2) });
        if (y < yearsToRetirement) {
          balance = balance * (1 + realReturn) + annualContrib;
        }
      }

      const projectedBalance = balance;
      const desiredIncome = parseFloat(desiredRetirementIncome);
      const totalNeeded = desiredIncome * yearsInRetirement;
      const shortfallSurplus = projectedBalance - totalNeeded;

      for (let y = 1; y <= yearsInRetirement; y++) {
        balance = balance * (1 + realReturn) - desiredIncome;
        breakdown.push({ year: yearsToRetirement + y, age: retirementAge + y, balance: Math.max(0, balance).toFixed(2) });
      }

      const projection = await storage.createRetirementProjection({
        clientId,
        currentAge,
        retirementAge,
        lifeExpectancy,
        currentSavings: String(currentSavings),
        annualContribution: String(annualContribution),
        expectedReturn: String(expectedReturn),
        inflationRate: String(inflationRate),
        desiredRetirementIncome: String(desiredRetirementIncome),
        projectedBalance: projectedBalance.toFixed(2),
        shortfallSurplus: shortfallSurplus.toFixed(2),
        yearlyBreakdown: JSON.stringify(breakdown),
        cppStartAge: cppStartAge ?? 65,
        oasStartAge: oasStartAge ?? 65,
        rrifConversionAge: rrifConversionAge ?? 71,
        rrspBalance: String(rrspBalance ?? currentSavings),
        tfsaBalance: String(tfsaBalance ?? 0),
        nonRegBalance: String(nonRegBalance ?? 0),
        pensionIncome: String(pensionIncome ?? 0),
        spouseIncome: String(spouseIncome ?? 0),
        employmentIncome: String(employmentIncome ?? 80000),
        province: province ?? "ontario",
        equityAllocation: String(equityAllocation ?? 0.6),
        bondAllocation: String(bondAllocation ?? 0.4),
        yearsInCanada: yearsInCanada ?? 40,
        annualTfsaContribution: String(annualTfsaContribution ?? 0),
        annualNonRegContribution: String(annualNonRegContribution ?? 0),
        desiredIncomeSourceMix: desiredIncomeSourceMix ?? null,
      });
      res.status(201).json(projection);
    } catch (err) {
      logger.error("Retirement projection error:", err);
      res.status(500).json({ message: "Failed to save projection" });
    }
  });

router.delete("/api/retirement-projections/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, retirementProjections, id))) return;
    await storage.deleteRetirementProjection(id);
    res.json({ success: true });
  });

  // ===== Insurance Needs Analysis =====
router.get("/api/clients/:clientId/insurance-analyses", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const analyses = await storage.getInsuranceAnalyses(clientId);
    res.json(analyses);
  });

router.post("/api/clients/:clientId/insurance-analyses", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const insuranceCreateSchema = z.object({
        annualIncome: z.coerce.number().min(0),
        yearsOfIncomeNeeded: z.coerce.number().int().min(1).max(50),
        existingLifeCoverage: z.coerce.number().min(0).default(0),
        existingAssets: z.coerce.number().min(0).default(0),
        monthlyExpenses: z.coerce.number().min(0),
        existingDisabilityCoverage: z.coerce.number().min(0).default(0),
        criticalIllnessLumpSum: z.coerce.number().min(0).default(0),
        existingCriticalIllnessCoverage: z.coerce.number().min(0).default(0),
        calculationMethod: z.enum(["dime", "humanLifeValue", "capitalRetention"]).default("dime"),
        personalConsumptionRate: z.coerce.number().min(0).max(1).default(0.30),
        discountRate: z.coerce.number().min(0).max(0.15).default(0.04),
        withdrawalRate: z.coerce.number().min(0.01).max(0.10).default(0.04),
        mortgageBalance: z.coerce.number().min(0).default(0),
        totalDebts: z.coerce.number().min(0).default(0),
        educationFundTarget: z.coerce.number().min(0).default(0),
        finalExpenses: z.coerce.number().min(0).default(15000),
        cppDisabilityBenefit: z.coerce.number().min(0).default(0),
        diReplacementRate: z.coerce.number().min(0).max(1).default(0.70),
        uncoveredTreatmentCosts: z.coerce.number().min(0).default(0),
        incomeVolatility: z.coerce.number().min(0).max(1).default(0),
        isVariableIncome: z.coerce.boolean().default(false),
      });
      const input = insuranceCreateSchema.parse(req.body);

      const clientProducts = await storage.getProductsByClient(clientId);
      const activeProducts = clientProducts.filter(p => p.status === "active" || p.status === "in-force");
      const lifeTypes = ["life insurance", "term life", "whole life", "universal life", "life"];
      const diTypes = ["disability", "disability insurance", "long-term disability", "short-term disability", "di"];
      const ciTypes = ["critical illness", "critical illness insurance", "ci"];
      const carrierLife = activeProducts.filter(p => lifeTypes.some(t => p.type.toLowerCase().includes(t))).reduce((s, p) => s + Number(p.value), 0);
      const carrierDi = activeProducts.filter(p => diTypes.some(t => p.type.toLowerCase().includes(t))).reduce((s, p) => s + Number(p.value), 0);
      const carrierCi = activeProducts.filter(p => ciTypes.some(t => p.type.toLowerCase().includes(t))).reduce((s, p) => s + Number(p.value), 0);

      const { runFullInsuranceAnalysis } = await import("../engine/insurance");
      const profile = {
        annualIncome: input.annualIncome,
        personalConsumptionRate: input.personalConsumptionRate,
        workingYearsRemaining: input.yearsOfIncomeNeeded,
        mortgageBalance: input.mortgageBalance,
        totalDebts: input.totalDebts,
        educationFundTarget: input.educationFundTarget,
        finalExpenses: input.finalExpenses,
        existingLifeCoverage: input.existingLifeCoverage > 0 ? input.existingLifeCoverage : carrierLife,
        existingAssets: input.existingAssets,
        monthlyExpenses: input.monthlyExpenses,
        existingDisabilityCoverage: input.existingDisabilityCoverage > 0 ? input.existingDisabilityCoverage : carrierDi,
        cppDisabilityBenefit: input.cppDisabilityBenefit,
        diReplacementRate: input.diReplacementRate,
        criticalIllnessLumpSum: input.criticalIllnessLumpSum,
        existingCriticalIllnessCoverage: input.existingCriticalIllnessCoverage > 0 ? input.existingCriticalIllnessCoverage : carrierCi,
        uncoveredTreatmentCosts: input.uncoveredTreatmentCosts,
        discountRate: input.discountRate,
        withdrawalRate: input.withdrawalRate,
        incomeVolatility: input.incomeVolatility,
        isVariableIncome: input.isVariableIncome,
      };

      const method = input.calculationMethod;
      const results = runFullInsuranceAnalysis(profile, method);

      const analysis = await storage.createInsuranceAnalysis({
        clientId,
        annualIncome: String(annualIncome),
        yearsOfIncomeNeeded: parseInt(yearsOfIncomeNeeded),
        existingLifeCoverage: String(existingLifeCoverage),
        existingAssets: String(existingAssets),
        monthlyExpenses: String(monthlyExpenses),
        existingDisabilityCoverage: String(existingDisabilityCoverage),
        criticalIllnessLumpSum: String(criticalIllnessLumpSum),
        existingCriticalIllnessCoverage: String(existingCriticalIllnessCoverage),
        calculationMethod: method,
        personalConsumptionRate: String(profile.personalConsumptionRate),
        discountRate: String(profile.discountRate),
        withdrawalRate: String(profile.withdrawalRate),
        mortgageBalance: String(profile.mortgageBalance),
        totalDebts: String(profile.totalDebts),
        educationFundTarget: String(profile.educationFundTarget),
        finalExpenses: String(profile.finalExpenses),
        cppDisabilityBenefit: String(profile.cppDisabilityBenefit),
        diReplacementRate: String(profile.diReplacementRate),
        uncoveredTreatmentCosts: String(profile.uncoveredTreatmentCosts),
        incomeVolatility: String(profile.incomeVolatility),
        isVariableIncome: profile.isVariableIncome,
        recommendedLifeCoverage: results.recommendedLifeCoverage.toFixed(2),
        lifeCoverageGap: results.lifeCoverageGap.toFixed(2),
        recommendedDisabilityCoverage: results.diGap.targetReplacement.toFixed(2),
        disabilityCoverageGap: results.diGap.monthlyGap.toFixed(2),
        recommendedCriticalIllnessCoverage: results.ciGap.totalNeed.toFixed(2),
        criticalIllnessCoverageGap: results.ciGap.gap.toFixed(2),
        analysisResults: results,
      });
      res.status(201).json(analysis);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.post("/api/clients/:clientId/insurance-worksheet", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const worksheetSchema = z.object({
        primaryName: z.string().min(1),
        primaryAge: z.coerce.number().int().min(0).max(120),
        primaryAnnualIncome: z.coerce.number().min(0),
        spouseName: z.string().default(""),
        spouseAge: z.coerce.number().int().min(0).max(120).default(0),
        spouseAnnualIncome: z.coerce.number().min(0).default(0),
        familyMembers: z.coerce.number().int().min(1).max(20).default(2),
        liabilities: z.object({
          mortgageBalance: z.coerce.number().min(0).default(0),
          carLoans: z.coerce.number().min(0).default(0),
          linesOfCredit: z.coerce.number().min(0).default(0),
          creditCards: z.coerce.number().min(0).default(0),
          finalExpenses: z.coerce.number().min(0).default(15000),
          emergencyFund: z.coerce.number().min(0).default(0),
        }),
        legacy: z.object({
          educationFund: z.coerce.number().min(0).default(0),
          legacyFundForChildren: z.coerce.number().min(0).default(0),
          charitableBequest: z.coerce.number().min(0).default(0),
          other: z.coerce.number().min(0).default(0),
        }),
        primaryIncome: z.object({
          replacementPct: z.coerce.number().min(0).max(100).default(75),
          cppSurvivorBenefit: z.coerce.number().min(0).default(0),
          targetAge: z.coerce.number().int().min(0).max(120).default(65),
        }),
        spouseIncome: z.object({
          replacementPct: z.coerce.number().min(0).max(100).default(75),
          cppSurvivorBenefit: z.coerce.number().min(0).default(0),
          targetAge: z.coerce.number().int().min(0).max(120).default(65),
        }),
        primaryAssets: z.object({
          liquidSavings: z.coerce.number().min(0).default(0),
          rrsps: z.coerce.number().min(0).default(0),
          rrspsUse: z.boolean().default(false),
          nonRegistered: z.coerce.number().min(0).default(0),
          nonRegisteredUse: z.boolean().default(false),
          tfsa: z.coerce.number().min(0).default(0),
          tfsaUse: z.boolean().default(true),
          other: z.coerce.number().min(0).default(0),
        }),
        spouseAssets: z.object({
          liquidSavings: z.coerce.number().min(0).default(0),
          rrsps: z.coerce.number().min(0).default(0),
          rrspsUse: z.boolean().default(false),
          nonRegistered: z.coerce.number().min(0).default(0),
          nonRegisteredUse: z.boolean().default(false),
          tfsa: z.coerce.number().min(0).default(0),
          tfsaUse: z.boolean().default(true),
          other: z.coerce.number().min(0).default(0),
        }),
        primaryExistingCoverage: z.coerce.number().min(0).default(0),
        spouseExistingCoverage: z.coerce.number().min(0).default(0),
        primaryCoveragePurchased: z.coerce.number().min(0).default(0),
        spouseCoveragePurchased: z.coerce.number().min(0).default(0),
        primaryShortfallAcknowledged: z.coerce.number().min(0).default(0),
        spouseShortfallAcknowledged: z.coerce.number().min(0).default(0),
        primarySignature: z.string().default(""),
        spouseSignature: z.string().default(""),
        signatureDate: z.string().default(""),
        meetingNotes: z.string().default(""),
      });

      const input = worksheetSchema.parse(req.body);

      const subtotalA = input.liabilities.mortgageBalance + input.liabilities.carLoans +
        input.liabilities.linesOfCredit + input.liabilities.creditCards +
        input.liabilities.finalExpenses + input.liabilities.emergencyFund;

      const subtotalB = input.legacy.educationFund + input.legacy.legacyFundForChildren +
        input.legacy.charitableBequest + input.legacy.other;

      const primaryYears = Math.max(0, input.primaryIncome.targetAge - input.primaryAge);
      const primaryIncomeNeed = (input.primaryAnnualIncome * (input.primaryIncome.replacementPct / 100)) * primaryYears;
      const subtotalC = Math.max(0, primaryIncomeNeed - (input.primaryIncome.cppSurvivorBenefit * 12 * primaryYears));

      const spouseYears = Math.max(0, input.spouseIncome.targetAge - input.spouseAge);
      const spouseIncomeNeed = (input.spouseAnnualIncome * (input.spouseIncome.replacementPct / 100)) * spouseYears;
      const subtotalD = Math.max(0, spouseIncomeNeed - (input.spouseIncome.cppSurvivorBenefit * 12 * spouseYears));

      const pAssets = input.primaryAssets;
      const subtotalE = pAssets.liquidSavings +
        (pAssets.rrspsUse ? pAssets.rrsps : 0) +
        (pAssets.nonRegisteredUse ? pAssets.nonRegistered : 0) +
        (pAssets.tfsaUse ? pAssets.tfsa : 0) +
        pAssets.other;

      const sAssets = input.spouseAssets;
      const subtotalF = sAssets.liquidSavings +
        (sAssets.rrspsUse ? sAssets.rrsps : 0) +
        (sAssets.nonRegisteredUse ? sAssets.nonRegistered : 0) +
        (sAssets.tfsaUse ? sAssets.tfsa : 0) +
        sAssets.other;

      const primaryNeedTotal = Math.max(0, subtotalA + subtotalB + subtotalC - subtotalE);
      const spouseNeedTotal = Math.max(0, subtotalA + subtotalB + subtotalD - subtotalF);

      const primaryNetNeed = Math.max(0, primaryNeedTotal - input.primaryExistingCoverage);
      const spouseNetNeed = Math.max(0, spouseNeedTotal - input.spouseExistingCoverage);

      const worksheetData = {
        liabilities: input.liabilities,
        legacy: input.legacy,
        primaryIncome: { ...input.primaryIncome, years: primaryYears, totalNeed: primaryIncomeNeed },
        spouseIncome: { ...input.spouseIncome, years: spouseYears, totalNeed: spouseIncomeNeed },
        primaryAssets: input.primaryAssets,
        spouseAssets: input.spouseAssets,
        subtotals: { A: subtotalA, B: subtotalB, C: subtotalC, D: subtotalD, E: subtotalE, F: subtotalF },
      };

      const { runFullInsuranceAnalysis } = await import("../engine/insurance");
      const totalDebts = input.liabilities.carLoans + input.liabilities.linesOfCredit + input.liabilities.creditCards;
      const engineProfile = {
        annualIncome: input.primaryAnnualIncome,
        personalConsumptionRate: 0.30,
        workingYearsRemaining: primaryYears || 20,
        mortgageBalance: input.liabilities.mortgageBalance,
        totalDebts,
        educationFundTarget: input.legacy.educationFund,
        finalExpenses: input.liabilities.finalExpenses,
        existingLifeCoverage: input.primaryExistingCoverage,
        existingAssets: subtotalE,
        monthlyExpenses: 0,
        existingDisabilityCoverage: 0,
        cppDisabilityBenefit: 0,
        diReplacementRate: 0.70,
        criticalIllnessLumpSum: 0,
        existingCriticalIllnessCoverage: 0,
        uncoveredTreatmentCosts: 0,
        discountRate: 0.04,
        withdrawalRate: 0.04,
        incomeVolatility: 0,
        isVariableIncome: false,
      };
      const engineResults = runFullInsuranceAnalysis(engineProfile, "dime");

      const enrichedWorksheetData = {
        ...worksheetData,
        engineResults,
      };

      const analysis = await storage.createInsuranceAnalysis({
        clientId,
        annualIncome: String(input.primaryAnnualIncome),
        yearsOfIncomeNeeded: primaryYears || 1,
        existingLifeCoverage: String(input.primaryExistingCoverage),
        existingAssets: String(subtotalE),
        monthlyExpenses: "0",
        existingDisabilityCoverage: "0",
        criticalIllnessLumpSum: "0",
        existingCriticalIllnessCoverage: "0",
        calculationMethod: "worksheet",
        mortgageBalance: String(input.liabilities.mortgageBalance),
        totalDebts: String(totalDebts),
        educationFundTarget: String(input.legacy.educationFund),
        finalExpenses: String(input.liabilities.finalExpenses),
        analysisType: "worksheet",
        primaryName: input.primaryName,
        primaryAge: input.primaryAge,
        spouseName: input.spouseName || null,
        spouseAge: input.spouseAge || null,
        spouseAnnualIncome: String(input.spouseAnnualIncome),
        familyMembers: input.familyMembers,
        worksheetData: enrichedWorksheetData,
        primaryNeed: String(primaryNeedTotal),
        spouseNeed: String(spouseNeedTotal),
        primaryExistingCoverage: String(input.primaryExistingCoverage),
        spouseExistingCoverage: String(input.spouseExistingCoverage),
        primaryNetNeed: String(primaryNetNeed),
        spouseNetNeed: String(spouseNetNeed),
        primaryCoveragePurchased: String(input.primaryCoveragePurchased),
        spouseCoveragePurchased: String(input.spouseCoveragePurchased),
        primaryShortfallAcknowledged: String(input.primaryShortfallAcknowledged),
        spouseShortfallAcknowledged: String(input.spouseShortfallAcknowledged),
        primarySignature: input.primarySignature || null,
        spouseSignature: input.spouseSignature || null,
        signatureDate: input.signatureDate || null,
        meetingNotes: input.meetingNotes || null,
        recommendedLifeCoverage: engineResults.recommendedLifeCoverage.toFixed(2),
        lifeCoverageGap: engineResults.lifeCoverageGap.toFixed(2),
        recommendedDisabilityCoverage: engineResults.diGap.targetReplacement.toFixed(2),
        disabilityCoverageGap: engineResults.diGap.monthlyGap.toFixed(2),
        recommendedCriticalIllnessCoverage: engineResults.ciGap.totalNeed.toFixed(2),
        criticalIllnessCoverageGap: engineResults.ciGap.gap.toFixed(2),
        analysisResults: enrichedWorksheetData,
      });
      res.status(201).json(analysis);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.delete("/api/insurance-analyses/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, insuranceAnalyses, id))) return;
    await storage.deleteInsuranceAnalysis(id);
    res.json({ success: true });
  });

  // ===== Education Savings (RESP) =====
router.get("/api/clients/:clientId/education-savings", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const entries = await storage.getEducationSavings(clientId);
    res.json(entries);
  });

router.post("/api/clients/:clientId/education-savings", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const {
        childName, childAge, targetAge, currentBalance, monthlyContribution,
        expectedReturn, estimatedCost, accountType, notes,
        familyIncomeBracket, cesgReceivedToDate, clbEligible, clbReceivedToDate,
        educationCostInflation, equityAllocation, bondAllocation,
      } = req.body;
      const entry = await storage.createEducationSaving({
        clientId, childName, childAge: Number(childAge), targetAge: Number(targetAge || 18),
        currentBalance: String(currentBalance || "0"), monthlyContribution: String(monthlyContribution || "0"),
        expectedReturn: String(expectedReturn || "5"), estimatedCost: String(estimatedCost || "0"),
        accountType: accountType || "RESP", notes: notes || null,
        familyIncomeBracket: familyIncomeBracket || "high",
        cesgReceivedToDate: String(cesgReceivedToDate ?? "0"),
        clbEligible: clbEligible === true || clbEligible === "true",
        clbReceivedToDate: String(clbReceivedToDate ?? "0"),
        educationCostInflation: String(educationCostInflation ?? "0.03"),
        equityAllocation: String(equityAllocation ?? "0.6"),
        bondAllocation: String(bondAllocation ?? "0.4"),
      });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.put("/api/education-savings/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, educationSavings, id))) return;
    const updated = await storage.updateEducationSaving(id, req.body);
    res.json(updated);
  });

router.delete("/api/education-savings/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, educationSavings, id))) return;
    await storage.deleteEducationSaving(id);
    res.json({ success: true });
  });

  // ===== Debt Management =====
router.get("/api/clients/:clientId/debt-entries", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const entries = await storage.getDebtEntries(clientId);
    res.json(entries);
  });

router.post("/api/clients/:clientId/debt-entries", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const { name, category, balance, interestRate, minimumPayment, term, priority, notes } = req.body;
      const entry = await storage.createDebtEntry({
        clientId, name, category: category || "other",
        balance: String(balance || "0"), interestRate: String(interestRate || "0"),
        minimumPayment: String(minimumPayment || "0"),
        term: term || null, priority: Number(priority || 0), notes: notes || null,
      });
      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.put("/api/debt-entries/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, debtEntries, id))) return;
    const updated = await storage.updateDebtEntry(id, req.body);
    res.json(updated);
  });

router.delete("/api/debt-entries/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, debtEntries, id))) return;
    await storage.deleteDebtEntry(id);
    res.json({ success: true });
  });

  // ===== Tax Planning Notes =====
router.get("/api/clients/:clientId/tax-planning-notes", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const notes = await storage.getTaxPlanningNotes(clientId);
    res.json(notes);
  });

router.post("/api/clients/:clientId/tax-planning-notes", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const { taxYear, category, title, content, actionRequired } = req.body;
      const note = await storage.createTaxPlanningNote({
        clientId, taxYear: Number(taxYear), category: category || "general",
        title, content, actionRequired: actionRequired ?? false,
      });
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.put("/api/tax-planning-notes/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, taxPlanningNotes, id))) return;
    const updated = await storage.updateTaxPlanningNote(id, req.body);
    res.json(updated);
  });

router.delete("/api/tax-planning-notes/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, taxPlanningNotes, id))) return;
    await storage.deleteTaxPlanningNote(id);
    res.json({ success: true });
  });

  // ===== Estate Planning Notes =====
router.get("/api/clients/:clientId/estate-planning-notes", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const notes = await storage.getEstatePlanningNotes(clientId);
    res.json(notes);
  });

router.post("/api/clients/:clientId/estate-planning-notes", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const { category, title, content, documentReference } = req.body;
      const note = await storage.createEstatePlanningNote({
        clientId, category: category || "general",
        title, content, documentReference: documentReference || null,
      });
      res.status(201).json(note);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.put("/api/estate-planning-notes/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, estatePlanningNotes, id))) return;
    const updated = await storage.updateEstatePlanningNote(id, req.body);
    res.json(updated);
  });

router.delete("/api/estate-planning-notes/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, estatePlanningNotes, id))) return;
    await storage.deleteEstatePlanningNote(id);
    res.json({ success: true });
  });

  // ===== Estate Analysis =====
router.get("/api/clients/:clientId/estate-analyses", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const analyses = await storage.getEstateAnalyses(clientId);
    res.json(analyses);
  });

router.post("/api/clients/:clientId/estate-analyses", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const estateInputSchema = z.object({
        province: z.string().min(1),
        grossEstateValue: z.coerce.number().min(0),
        realEstateValue: z.coerce.number().min(0).default(0),
        jointTenancyRealEstate: z.coerce.number().min(0).default(0),
        registeredAccountsWithBeneficiary: z.coerce.number().min(0).default(0),
        lifeInsuranceWithBeneficiary: z.coerce.number().min(0).default(0),
        trustAssets: z.coerce.number().min(0).default(0),
        rrspRrifBalance: z.coerce.number().min(0).default(0),
        nonRegInvestments: z.coerce.number().min(0).default(0),
        nonRegCostBase: z.coerce.number().min(0).default(0),
        primaryResidenceValue: z.coerce.number().min(0).default(0),
        otherIncome: z.coerce.number().min(0).default(0),
        hasWill: z.coerce.boolean().default(false),
        hasPowerOfAttorney: z.coerce.boolean().default(false),
      });
      const input = estateInputSchema.parse(req.body);

      const clientProducts = await storage.getProductsByClient(clientId);
      const policies = clientProducts.map(p => ({
        policyId: p.id,
        type: p.type,
        provider: p.provider,
        policyNumber: p.policyNumber,
        value: Number(p.value),
        beneficiary: p.beneficiary ?? "unknown",
      }));

      const { runFullEstateAnalysis } = await import("../engine/estate");
      const result = runFullEstateAnalysis({ ...input, policies });

      const analysis = await storage.createEstateAnalysis({
        clientId,
        province: input.province,
        grossEstateValue: String(input.grossEstateValue),
        realEstateValue: String(input.realEstateValue),
        jointTenancyRealEstate: String(input.jointTenancyRealEstate),
        registeredAccountsWithBeneficiary: String(input.registeredAccountsWithBeneficiary),
        lifeInsuranceWithBeneficiary: String(input.lifeInsuranceWithBeneficiary),
        trustAssets: String(input.trustAssets),
        rrspRrifBalance: String(input.rrspRrifBalance),
        nonRegInvestments: String(input.nonRegInvestments),
        nonRegCostBase: String(input.nonRegCostBase),
        primaryResidenceValue: String(input.primaryResidenceValue),
        otherIncome: String(input.otherIncome),
        hasWill: input.hasWill,
        hasPowerOfAttorney: input.hasPowerOfAttorney,
        probateFee: String(result.probate.probateFee),
        terminalTax: String(result.terminalTax.estimatedTax),
        efficiencyScore: String(result.efficiency.efficiencyScore),
        netToBeneficiaries: String(result.efficiency.netToBeneficiaries),
        analysisResults: result,
      });

      const clientPlans = await storage.getPlansByClient(clientId);
      const activePlan = clientPlans.length > 0 ? clientPlans[clientPlans.length - 1] : null;
      if (activePlan) {
        const existingEstateItems = await storage.getPlanActionItems(activePlan.id);
        const staleEstateItems = existingEstateItems.filter(
          (item) => item.module === "estate" && item.status === "pending" &&
          (item.title.startsWith("Beneficiary review:") || item.title === "No will on file" || item.title === "No power of attorney on file")
        );
        for (const stale of staleEstateItems) {
          await storage.deletePlanActionItem(stale.id);
        }

        for (const flag of result.beneficiaryFlags) {
          const isMissingBeneficiary = flag.issue.includes("No beneficiary");
          await storage.createPlanActionItem({
            planId: activePlan.id,
            module: "estate",
            priority: isMissingBeneficiary ? "high" : "critical",
            title: `Beneficiary review: ${flag.type} - ${flag.provider} (${flag.policyNumber})`,
            description: flag.issue,
            status: "pending",
          });
        }
        if (!input.hasWill) {
          await storage.createPlanActionItem({
            planId: activePlan.id,
            module: "estate",
            priority: "high",
            title: "No will on file",
            description: "Client does not have a will. Intestacy rules will apply. Recommend establishing a will with an estate lawyer.",
            status: "pending",
          });
        }
        if (!input.hasPowerOfAttorney) {
          await storage.createPlanActionItem({
            planId: activePlan.id,
            module: "estate",
            priority: "medium",
            title: "No power of attorney on file",
            description: "Client does not have a power of attorney. Consider establishing POA for property and personal care.",
            status: "pending",
          });
        }
      }

      res.status(201).json(analysis);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.delete("/api/estate-analyses/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, estateAnalyses, id))) return;
    await storage.deleteEstateAnalysis(id);
    res.json({ success: true });
  });

  // ===== Debt Payoff Strategies =====
router.post("/api/clients/:clientId/debt-payoff-comparison", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const debtPayoffSchema = z.object({
        monthlyIncome: z.coerce.number().min(0),
        monthlyExpenses: z.coerce.number().min(0),
      });
      const input = debtPayoffSchema.parse(req.body);

      const debtRows = await storage.getDebtEntries(clientId);
      if (debtRows.length === 0) {
        return res.status(400).json({ message: "No debt entries found for this client. Add debts first." });
      }

      const { comparePayoffStrategies } = await import("../engine/debt");
      const debts = debtRows.map(d => ({
        id: d.id,
        name: d.name,
        category: d.category,
        balance: Number(d.balance),
        interestRate: Number(d.interestRate),
        minimumPayment: Number(d.minimumPayment),
        isVariableRate: d.category === "variable-rate" || d.category === "line-of-credit",
      }));

      const comparison = comparePayoffStrategies(debts, input.monthlyIncome, input.monthlyExpenses);
      res.json(comparison);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // ===== Cash Flow Analysis =====
router.get("/api/clients/:clientId/cash-flow-budgets", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const budgets = await storage.getCashFlowBudgets(clientId);
    res.json(budgets);
  });

router.post("/api/clients/:clientId/cash-flow-analysis", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;

      const cashFlowSchema = z.object({
        monthlyGrossIncome: z.coerce.number().min(0),
        monthlyNetIncome: z.coerce.number().min(0),
        additionalIncome: z.coerce.number().min(0).default(0),
        currentEmergencyFund: z.coerce.number().min(0).default(0),
        budgetEntries: z.array(z.object({
          category: z.string(),
          subcategory: z.string().default(""),
          monthlyAmount: z.coerce.number().min(0),
          isFixed: z.coerce.boolean().default(true),
        })),
      });
      const input = cashFlowSchema.parse(req.body);

      const debtRows = await storage.getDebtEntries(clientId);
      const monthlyDebtPayments = debtRows.reduce((s, d) => s + Number(d.minimumPayment), 0);

      const { analyzeCashFlow } = await import("../engine/cashflow");
      const analysis = analyzeCashFlow({
        ...input,
        monthlyDebtPayments,
      });

      const budget = await storage.createCashFlowBudget({
        clientId,
        monthlyGrossIncome: String(input.monthlyGrossIncome),
        monthlyNetIncome: String(input.monthlyNetIncome),
        additionalIncome: String(input.additionalIncome),
        currentEmergencyFund: String(input.currentEmergencyFund),
        budgetEntries: input.budgetEntries,
        analysisResults: analysis,
      });
      res.status(201).json({ budget, analysis });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

router.delete("/api/cash-flow-budgets/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, cashFlowBudgets, id))) return;
    await storage.deleteCashFlowBudget(id);
    res.json({ success: true });
  });

  // ===== AI Recommendations =====
router.get("/api/clients/:clientId/ai-recommendations", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const recs = await storage.getAiRecommendations(clientId);
    res.json(recs);
  });

router.post("/api/clients/:clientId/ai-recommendations/generate", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const [plans, netWorth, retirement, insurance, debts, education] = await Promise.all([
        storage.getPlansByClient(clientId),
        storage.getNetWorthEntries(clientId),
        storage.getRetirementProjections(clientId),
        storage.getInsuranceAnalyses(clientId),
        storage.getDebtEntries(clientId),
        storage.getEducationSavings(clientId),
      ]);

      const totalAssets = netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
      const totalLiabilities = netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
      const totalDebt = debts.reduce((s, d) => s + parseFloat(String(d.balance) || "0"), 0);

      const prompt = `You are a certified financial planner. Based on the following client data, provide 3-5 actionable recommendations.

Client: ${client.firstName} ${client.lastName}
Financial Goals: ${plans.map(p => `${p.title} ($${p.goalAmount}, target: ${p.targetDate})`).join("; ") || "None set"}
Net Worth: Assets $${totalAssets.toLocaleString()}, Liabilities $${totalLiabilities.toLocaleString()}, Net $${(totalAssets - totalLiabilities).toLocaleString()}
Retirement: ${retirement.length > 0 ? `Age ${retirement[0].currentAge}, retiring at ${retirement[0].retirementAge}, projected balance $${retirement[0].projectedBalance}` : "No projections"}
Insurance: ${insurance.length > 0 ? `Life gap: $${insurance[0].lifeCoverageGap}, Disability gap: $${insurance[0].disabilityCoverageGap}` : "No analysis"}
Total Debt: $${totalDebt.toLocaleString()} across ${debts.length} accounts
Education Savings: ${education.length > 0 ? education.map(e => `${e.childName}: $${e.currentBalance} saved`).join("; ") : "None"}

Return a JSON object with a "recommendations" key containing an array. Each item: {"category": "retirement|insurance|debt|education|investment|tax|estate", "title": "Short title", "content": "Detailed recommendation", "priority": "high|medium|low"}. Example: {"recommendations": [...]}`;

      const response = await anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        system: "You are a certified Canadian financial planner. Return ONLY valid JSON — no markdown, no prose.",
        messages: [{ role: "user", content: prompt }],
      });

      const content = (response.content[0] as any).text || "{}";
      const clean = content.replace(/```json|```/g, "").trim();
      let parsed: { recommendations?: Array<{ category: string; title: string; content: string; priority: string }> };
      try {
        parsed = JSON.parse(clean);
      } catch {
        return res.status(500).json({ message: "Failed to parse AI response" });
      }

      const recommendations = parsed.recommendations || [];
      const saved = [];
      for (const rec of recommendations) {
        const created = await storage.createAiRecommendation({
          clientId,
          category: rec.category || "investment",
          title: rec.title || "Recommendation",
          content: rec.content || "",
          priority: rec.priority || "medium",
          status: "pending",
        });
        saved.push(created);
      }

      res.json(saved);
    } catch (err) {
      logger.error("AI recommendation error:", err);
      res.status(500).json({ message: "Failed to generate AI recommendations" });
    }
  });

router.put("/api/ai-recommendations/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, aiRecommendations, id))) return;
    const updated = await storage.updateAiRecommendation(id, req.body);
    res.json(updated);
  });

router.delete("/api/ai-recommendations/:id", isAuthenticated, async (req: any, res) => {
    const id = Number(req.params.id);
    if (!(await verifyFpRecordOwnership(req, res, aiRecommendations, id))) return;
    await storage.deleteAiRecommendation(id);
    res.json({ success: true });
  });

  // ===== Financial Planning Overview =====
router.get("/api/clients/:clientId/financial-planning-overview", isAuthenticated, async (req: any, res) => {
    const clientId = Number(req.params.clientId);
    if (!(await verifyClientOwnership(req, res, clientId))) return;
    const [plans, netWorth, retirement, insurance, debts, education, taxNotes, estateNotes, aiRecs] = await Promise.all([
      storage.getPlansByClient(clientId),
      storage.getNetWorthEntries(clientId),
      storage.getRetirementProjections(clientId),
      storage.getInsuranceAnalyses(clientId),
      storage.getDebtEntries(clientId),
      storage.getEducationSavings(clientId),
      storage.getTaxPlanningNotes(clientId),
      storage.getEstatePlanningNotes(clientId),
      storage.getAiRecommendations(clientId),
    ]);

    const totalAssets = netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
    const totalLiabilities = netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);

    res.json({
      goals: plans.length,
      netWorth: totalAssets - totalLiabilities,
      totalAssets,
      totalLiabilities,
      retirementProjections: retirement.length,
      latestRetirement: retirement[0] || null,
      insuranceAnalyses: insurance.length,
      latestInsurance: insurance[0] || null,
      educationPlans: education.length,
      debtAccounts: debts.length,
      totalDebt: debts.reduce((s, d) => s + parseFloat(String(d.balance) || "0"), 0),
      taxNotes: taxNotes.length,
      estateNotes: estateNotes.length,
      aiRecommendations: aiRecs.length,
      pendingRecommendations: aiRecs.filter(r => r.status === "pending").length,
    });
  });

router.get("/api/clients/:clientId/financial-planning-report", isAuthenticated, async (req: any, res) => {
    try {
      const clientId = Number(req.params.clientId);
      if (!(await verifyClientOwnership(req, res, clientId))) return;
      const client = await storage.getClient(clientId);
      if (!client) return res.status(404).json({ message: "Client not found" });

      const [plans, netWorth, retirement, insurance, debts, education, taxNotes, estateNotes, aiRecs] = await Promise.all([
        storage.getPlansByClient(clientId),
        storage.getNetWorthEntries(clientId),
        storage.getRetirementProjections(clientId),
        storage.getInsuranceAnalyses(clientId),
        storage.getDebtEntries(clientId),
        storage.getEducationSavings(clientId),
        storage.getTaxPlanningNotes(clientId),
        storage.getEstatePlanningNotes(clientId),
        storage.getAiRecommendations(clientId),
      ]);

      const totalAssets = netWorth.filter(e => e.type === "asset").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
      const totalLiabilities = netWorth.filter(e => e.type === "liability").reduce((s, e) => s + parseFloat(String(e.value) || "0"), 0);
      const totalDebt = debts.reduce((s, d) => s + parseFloat(String(d.balance) || "0"), 0);

      res.json({
        client: { firstName: client.firstName, lastName: client.lastName, email: client.email },
        generatedAt: new Date().toISOString(),
        summary: {
          netWorth: totalAssets - totalLiabilities,
          totalAssets,
          totalLiabilities,
          totalDebt,
          goalsCount: plans.length,
          retirementReady: retirement.length > 0 && retirement[0].projectedBalance ? parseFloat(String(retirement[0].projectedBalance)) > 0 : false,
        },
        goals: plans.map(p => ({ title: p.title, goalAmount: p.goalAmount, targetDate: p.targetDate, riskTolerance: p.riskTolerance })),
        netWorthBreakdown: { assets: netWorth.filter(e => e.type === "asset"), liabilities: netWorth.filter(e => e.type === "liability") },
        retirement: retirement[0] || null,
        insurance: insurance[0] || null,
        debts,
        educationSavings: education,
        taxNotes,
        estateNotes,
        recommendations: aiRecs.filter(r => r.status === "pending" || r.status === "in_progress"),
      });
    } catch (err) {
      logger.error("Financial planning report error:", err);
      res.status(500).json({ message: "Failed to generate report" });
    }
  });

