import { Router } from "express";
import {
  projectTaxYears,
  calculateRrspRoom,
  calculateTfsaRoom,
  analyzeCapitalGains,
  analyzeIncomeSplitting,
} from "../engine/tax/index.js";
import type {
  TaxProjectionProfile,
  RrspRoomInput,
  TfsaRoomInput,
} from "../engine/tax/types.js";
import { db } from "../db/index.js";
import { capitalGainsPositions } from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { taxAnalyses, clients } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";

export const taxRouter = Router();
taxRouter.use(isAuthenticated);

// ── Tax Projection ──────────────────────────────────────────────────────────

taxRouter.post("/:clientId/projection", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<TaxProjectionProfile>;

    // Validate required fields
    if (!input.currentAge || !input.retirementAge || !input.planToAge || !input.province) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Build complete profile with defaults
    const profile: TaxProjectionProfile = {
      currentAge: Number(input.currentAge),
      retirementAge: Number(input.retirementAge),
      planToAge: Number(input.planToAge),
      province: String(input.province),
      employmentIncome: Number(input.employmentIncome || 0),
      selfEmploymentIncome: Number(input.selfEmploymentIncome || 0),
      otherIncome: Number(input.otherIncome || 0),
      incomeGrowthRate: Number(input.incomeGrowthRate || 0.03),
      rrspBalance: Number(input.rrspBalance || 0),
      rrspContributionRoom: Number(input.rrspContributionRoom || 0),
      rrspAnnualContribution: Number(input.rrspAnnualContribution || 0),
      tfsaBalance: Number(input.tfsaBalance || 0),
      tfsaContributionRoom: Number(input.tfsaContributionRoom || 0),
      tfsaAnnualContribution: Number(input.tfsaAnnualContribution || 0),
      nonRegBalance: Number(input.nonRegBalance || 0),
      nonRegAcb: Number(input.nonRegAcb || 0),
      nonRegAnnualContrib: Number(input.nonRegAnnualContrib || 0),
      portfolioYield: Number(input.portfolioYield || 0.06),
      desiredRetirementIncome: Number(input.desiredRetirementIncome || 0),
      pensionIncome: Number(input.pensionIncome || 0),
      cppStartAge: Number(input.cppStartAge || 65),
      oasStartAge: Number(input.oasStartAge || 65),
    };

    const projections = projectTaxYears(profile);

    // Calculate summary
    const totalLifetimeTax = projections.reduce((sum, p) => sum + p.totalTax, 0);
    const totalGrossIncome = projections.reduce((sum, p) => sum + p.totalGrossIncome, 0);
    const averageEffectiveRate = totalGrossIncome > 0 ? totalLifetimeTax / totalGrossIncome : 0;
    const projectedFinalWealth = projections[projections.length - 1]?.totalWealth || 0;
    const successProbability = projections.every(p => p.totalWealth > 0) ? 0.85 : 0.45;

    res.json({
      projections,
      summary: {
        totalLifetimeTax,
        averageEffectiveRate,
        projectedFinalWealth,
        successProbability,
      },
    });
  } catch (error) {
    console.error("[tax projection error]", error);
    res.status(500).json({ error: "Failed to run tax projection" });
  }
});

// ── RRSP Room Calculation ───────────────────────────────────────────────────

taxRouter.post("/:clientId/rrsp-room", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    const roomInput: RrspRoomInput = {
      currentCarryForwardRoom: Number(input.carryForwardRoom || 0),
      priorYearEarnedIncome: Number(input.priorYearEarnedIncome || 0),
      currentYearContributions: Number(input.contributionsMadeThisYear || 0),
      pensionAdjustment: Number(input.pensionAdjustment || 0),
    };

    const summary = calculateRrspRoom(roomInput);
    
    // Calculate additional insights
    const marginalTaxRate = Number(input.marginalTaxRate || 0.435);
    const yearsToProject = Number(input.yearsToProject || 10);
    const marginalTaxSavings = summary.totalAvailableRoom * marginalTaxRate;
    const effectiveCost = summary.totalAvailableRoom * (1 - marginalTaxRate);
    
    // Catch-up strategy
    const yearsToMaxOut = Math.ceil(summary.totalAvailableRoom / 31560); // Using 2024 limit
    const annualContributionNeeded = summary.totalAvailableRoom / yearsToProject;
    const projectedRefundPerYear = annualContributionNeeded * marginalTaxRate;

    res.json({
      summary,
      marginalTaxSavings,
      effectiveCost,
      catchUpStrategy: {
        yearsToMaxOut,
        annualContributionNeeded,
        projectedRefundPerYear,
      },
    });
  } catch (error) {
    console.error("[rrsp room error]", error);
    res.status(500).json({ error: "Failed to calculate RRSP room" });
  }
});

// ── TFSA Room Calculation ───────────────────────────────────────────────────

taxRouter.post("/:clientId/tfsa-room", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    const birthYear = Number(input.birthYear || 1985);
    const currentYear = new Date().getFullYear();
    const yearTurned18 = birthYear + 18;

    const roomInput: TfsaRoomInput = {
      yearTurned18: yearTurned18,
      currentCarryForwardRoom: Number(input.priorYearClosingRoom || 0),
      currentYearContributions: Number(input.contributionsMadeThisYear || 0),
      currentYearWithdrawals: Number(input.withdrawalsLastYear || 0),
    };

    const summary = calculateTfsaRoom(roomInput);
    
    // Calculate cumulative room since 2009
    const cumulativeRoomSince2009 = summary.cumulativeRoomEarned;
    
    // Future limits (next 5 years, assuming $7000/year)
    const futureLimits = [];
    for (let i = 1; i <= 5; i++) {
      futureLimits.push({ year: currentYear + i, limit: 7000 });
    }
    
    // 30-year projection
    const currentBalance = Number(input.currentTfsaBalance || 0);
    const annualContrib = Number(input.annualContribution || 7000);
    const portfolioReturn = Number(input.portfolioReturn || 0.06);
    
    let tfsaBalance = currentBalance;
    let taxableBalance = currentBalance;
    
    for (let i = 0; i < 30; i++) {
      tfsaBalance = (tfsaBalance + annualContrib) * (1 + portfolioReturn);
      // Taxable account: 50% of gains taxed at marginal rate (assume 43.5%)
      const taxableGrowth = taxableBalance * portfolioReturn;
      const taxOnGrowth = taxableGrowth * 0.5 * 0.435;
      taxableBalance = (taxableBalance + annualContrib) * (1 + portfolioReturn) - taxOnGrowth;
    }

    res.json({
      summary,
      cumulativeRoomSince2009,
      futureLimits,
      thirtyYearProjection: {
        tfsaBalanceFinal: Math.round(tfsaBalance),
        taxableBalanceFinal: Math.round(taxableBalance),
        tfsaAdvantage: Math.round(tfsaBalance - taxableBalance),
      },
    });
  } catch (error) {
    console.error("[tfsa room error]", error);
    res.status(500).json({ error: "Failed to calculate TFSA room" });
  }
});

// ── Capital Gains Analysis ──────────────────────────────────────────────────

taxRouter.post("/:clientId/capital-gains", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    if (!input.positions || !Array.isArray(input.positions)) {
      return res.status(400).json({ error: "Positions array required" });
    }

    const positions = input.positions.map((p: any) => ({
      name: String(p.symbol || ""),
      marketValue: Number(p.fmv || 0),
      adjustedCostBase: Number(p.acb || 0),
      unrealizedGain: Number(p.fmv || 0) - Number(p.acb || 0),
      isLoss: (Number(p.fmv || 0) - Number(p.acb || 0)) < 0,
    }));

    const currentIncome = Number(input.currentIncome || 100000);
    const province = String(input.province || "ON");

    // analyzeCapitalGains(positions, currentIncome, province, projectedYears?)
    const result = analyzeCapitalGains(positions, currentIncome, province);
    
    // Transform to match frontend expectations
    res.json({
      positions: result.positions.map(p => ({
        symbol: p.name,
        acb: p.adjustedCostBase,
        fmv: p.marketValue,
        unrealizedGain: p.unrealizedGain,
      })),
      totalUnrealizedGain: result.totalUnrealizedGain,
      scenarios: result.scenarios.map(s => ({
        name: s.label,
        gainRealized: s.amountRealized,
        taxableGain: s.taxableGain,
        estimatedTax: s.estimatedTax,
      })),
      lossHarvestingOpportunity: result.harvestingOpportunity,
    });
  } catch (error) {
    console.error("[capital gains error]", error);
    res.status(500).json({ error: "Failed to analyze capital gains" });
  }
});

// ── Income Splitting Optimization ───────────────────────────────────────────

taxRouter.post("/:clientId/income-splitting", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body;

    const selfIncome = Number(input.higherIncome || 0);
    const spouseIncome = Number(input.lowerIncome || 0);
    const eligiblePensionIncome = Number(input.pensionIncome || 0);
    const selfRrspBalance = Number(input.selfRrspBalance || 0);
    const spouseRrspBalance = Number(input.spouseRrspBalance || 0);
    const age = Number(input.age || 65);
    const province = String(input.province || "ON");

    // analyzeIncomeSplitting(selfIncome, spouseIncome, eligiblePensionIncome, selfRrspBalance, spouseRrspBalance, age, province)
    const result = analyzeIncomeSplitting(
      selfIncome,
      spouseIncome,
      eligiblePensionIncome,
      selfRrspBalance,
      spouseRrspBalance,
      age,
      province
    );
    
    res.json(result);
  } catch (error) {
    console.error("[income splitting error]", error);
    res.status(500).json({ error: "Failed to analyze income splitting" });
  }
});

// ── Capital Gains Positions (persistence) ────────────────────────────────────


taxRouter.get("/:clientId/capital-gains-positions", async (req: AuthRequest, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await ownsClient(clientId, req.userId!)) return res.status(404).json({ error: "Not found" });
    const rows = await db.select().from(capitalGainsPositions)
      .where(eq(capitalGainsPositions.clientId, clientId));
    res.json(rows);
  } catch (error) {
    console.error("[cg positions get]", error);
    res.status(500).json({ error: "Failed to load positions" });
  }
});

taxRouter.post("/:clientId/capital-gains-positions", async (req: AuthRequest, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await ownsClient(clientId, req.userId!)) return res.status(404).json({ error: "Not found" });
    const { id, createdAt, updatedAt, ...body } = req.body;
    const [row] = await db.insert(capitalGainsPositions)
      .values({ clientId, ...body })
      .returning();
    res.json(row);
  } catch (error) {
    console.error("[cg positions post]", error);
    res.status(500).json({ error: "Failed to save position" });
  }
});

taxRouter.patch("/capital-gains-positions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { id: _id, clientId: _cid, createdAt, updatedAt, ...body } = req.body;
    const [row] = await db.update(capitalGainsPositions)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(capitalGainsPositions.id, id))
      .returning();
    res.json(row);
  } catch (error) {
    console.error("[cg positions patch]", error);
    res.status(500).json({ error: "Failed to update position" });
  }
});

taxRouter.delete("/capital-gains-positions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(capitalGainsPositions).where(eq(capitalGainsPositions.id, id));
    res.json({ ok: true });
  } catch (error) {
    console.error("[cg positions delete]", error);
    res.status(500).json({ error: "Failed to delete position" });
  }
});
// ── Tax Analyses (RRSP / TFSA / Projection / Splitting) ─────────────────────


taxRouter.get("/client/:clientId/analyses", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { type } = req.query;
    const rows = await db.select().from(taxAnalyses).where(eq(taxAnalyses.clientId, clientId));
    res.json(type ? rows.filter((r: any) => r.type === type) : rows);
  } catch (e: any) {
    console.error("[tax analyses get]", e?.message);
    res.status(500).json({ error: e?.message ?? "Failed" });
  }
});

taxRouter.post("/client/:clientId/analyses", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const { id, createdAt, updatedAt, ...body } = req.body;
    const [row] = await db.insert(taxAnalyses).values({ clientId, ...body }).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

taxRouter.patch("/tax-analyses/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { id: _id, clientId: _cid, createdAt, updatedAt, ...body } = req.body;
    const [row] = await db.update(taxAnalyses).set({ ...body, updatedAt: new Date() })
      .where(eq(taxAnalyses.id, id)).returning();
    res.json(row);
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});

taxRouter.delete("/tax-analyses/:id", async (req, res) => {
  try {
    await db.delete(taxAnalyses).where(eq(taxAnalyses.id, parseInt(req.params.id)));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: "Failed" }); }
});
