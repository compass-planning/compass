import { Router } from "express";
import { projectUsTaxYears }               from "../engine/tax/usProjector.js";
import { analyzeUsCapitalGains, analyzeRothConversion } from "../engine/tax/usCapitalGains.js";
import { analyzeSsTiming, analyzeSsSpousal } from "../engine/reference/usSocialSecurity.js";
import {
  calculateCombinedTaxUS,
  calculateLtcgTax,
  US_STANDARD_DEDUCTION_2025,
  resolveStateCode,
} from "../engine/reference/usTaxData2025.js";
import {
  get401kLimit,
  getIraLimit,
  US_401K_CATCHUP_50_2025,
  US_401K_CATCHUP_6063_2025,
  US_IRA_CATCHUP_50_2025,
  US_ROTH_IRA_PHASEOUT_2025,
  getRmdStartAge,
  getSsFra,
} from "../engine/reference/usBenefitRates2025.js";
import type { UsTaxProjectionProfile } from "../engine/tax/usTypes.js";
import type { FilingStatus } from "../engine/reference/usTaxData2025.js";
import { db } from "../db/index.js";
import { capitalGainsPositions, taxAnalyses, clients } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";

export const usTaxRouter = Router();
usTaxRouter.use(isAuthenticated);

// ── Tax Projection ────────────────────────────────────────────────────────────

usTaxRouter.post("/:clientId/us-projection", async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    const input = req.body as Partial<UsTaxProjectionProfile>;

    if (!input.currentAge || !input.retirementAge || !input.planToAge || !input.usState) {
      return res.status(400).json({ error: "Missing required fields: currentAge, retirementAge, planToAge, usState" });
    }

    const profile: UsTaxProjectionProfile = {
      currentAge:              Number(input.currentAge),
      retirementAge:           Number(input.retirementAge),
      planToAge:               Number(input.planToAge),
      birthYear:               Number(input.birthYear || (new Date().getFullYear() - Number(input.currentAge))),
      filingStatus:            (input.filingStatus as FilingStatus) || "single",
      usState:                 String(input.usState),

      wagesIncome:             Number(input.wagesIncome             || 0),
      selfEmploymentIncome:    Number(input.selfEmploymentIncome     || 0),
      otherOrdinaryIncome:     Number(input.otherOrdinaryIncome      || 0),
      qualifiedDividends:      Number(input.qualifiedDividends       || 0),
      ordinaryDividends:       Number(input.ordinaryDividends        || 0),
      incomeGrowthRate:        Number(input.incomeGrowthRate         || 0.03),

      pretaxBalance:           Number(input.pretaxBalance            || 0),
      pretaxAnnualContrib:     Number(input.pretaxAnnualContrib      || 0),
      employerMatch:           Number(input.employerMatch            || 0),
      pretaxGrowthRate:        Number(input.pretaxGrowthRate         || 0.07),

      rothBalance:             Number(input.rothBalance              || 0),
      rothAnnualContrib:       Number(input.rothAnnualContrib        || 0),
      rothGrowthRate:          Number(input.rothGrowthRate           || 0.07),

      tradIraBalance:          Number(input.tradIraBalance           || 0),
      tradIraAnnualContrib:    Number(input.tradIraAnnualContrib     || 0),

      taxableBalance:          Number(input.taxableBalance           || 0),
      taxableCostBasis:        Number(input.taxableCostBasis         || 0),
      taxableAnnualContrib:    Number(input.taxableAnnualContrib     || 0),
      taxableGrowthRate:       Number(input.taxableGrowthRate        || 0.07),
      dividendYield:           Number(input.dividendYield            || 0.02),

      hsaBalance:              Number(input.hsaBalance               || 0),
      hsaAnnualContrib:        Number(input.hsaAnnualContrib         || 0),
      hsaGrowthRate:           Number(input.hsaGrowthRate            || 0.05),

      ssMonthlyBenefitAtFra:   Number(input.ssMonthlyBenefitAtFra    || 0),
      ssClaimAge:              Number(input.ssClaimAge               || 67),

      pensionAnnualIncome:     Number(input.pensionAnnualIncome      || 0),
      pensionCola:             Number(input.pensionCola              || 0.02),

      desiredRetirementIncome: Number(input.desiredRetirementIncome  || 0),
      retirementIncomeGrowth:  Number(input.retirementIncomeGrowth   || 0.025),

      useStandardDeduction:    input.useStandardDeduction !== false,
      itemizedDeductions:      Number(input.itemizedDeductions       || 0),

      hasSpouse:               Boolean(input.hasSpouse),
      spouseAge:               input.spouseAge ? Number(input.spouseAge) : undefined,
      spouseBirthYear:         input.spouseBirthYear ? Number(input.spouseBirthYear) : undefined,
      spouseWages:             input.spouseWages ? Number(input.spouseWages) : undefined,
      spousePretaxBalance:     input.spousePretaxBalance ? Number(input.spousePretaxBalance) : undefined,
      spouseRothBalance:       input.spouseRothBalance ? Number(input.spouseRothBalance) : undefined,
      spouseSsMonthlyAtFra:    input.spouseSsMonthlyAtFra ? Number(input.spouseSsMonthlyAtFra) : undefined,
    };

    const projections = projectUsTaxYears(profile);

    const totalLifetimeTax    = projections.reduce((s, p) => s + p.totalTax, 0);
    const totalGrossIncome    = projections.reduce((s, p) => s + p.totalAgi, 0);
    const averageEffectiveRate = totalGrossIncome > 0 ? totalLifetimeTax / totalGrossIncome : 0;
    const projectedFinalWealth = projections[projections.length - 1]?.totalWealth || 0;
    const successProbability   = projections.every(p => p.totalWealth > 0) ? 0.85 : 0.45;

    // Roth conversion window summary
    const conversionWindowYears = projections.filter(p => p.inRothConversionWindow);
    const rmdStartAge = getRmdStartAge(profile.birthYear);

    res.json({
      projections,
      summary: {
        totalLifetimeTax,
        averageEffectiveRate,
        projectedFinalWealth,
        successProbability,
        rmdStartAge,
        ssFra: getSsFra(profile.birthYear),
        conversionWindowYears: conversionWindowYears.length,
        conversionWindowStart: conversionWindowYears[0]?.age ?? null,
        conversionWindowEnd:   conversionWindowYears[conversionWindowYears.length - 1]?.age ?? null,
      },
    });
  } catch (error) {
    console.error("[us tax projection error]", error);
    res.status(500).json({ error: "Failed to run US tax projection" });
  }
});

// ── 401(k) / 403(b) Room ─────────────────────────────────────────────────────

usTaxRouter.post("/:clientId/401k-room", async (req, res) => {
  try {
    const input = req.body;
    const age   = Number(input.age || 40);
    const year  = new Date().getFullYear();

    const employeeLimit   = get401kLimit(year);
    const catchup         = age >= 60 && age <= 63 ? US_401K_CATCHUP_6063_2025
                          : age >= 50              ? US_401K_CATCHUP_50_2025
                          : 0;
    const totalEmployeeLimit = employeeLimit + catchup;
    const employerMatch   = Number(input.employerMatch || 0);
    const contribsMade    = Number(input.contributionsMade || 0);
    const remainingRoom   = Math.max(0, totalEmployeeLimit - contribsMade);

    const marginalRate    = Number(input.marginalRate || 0.24);
    const annualTaxSaving = Math.min(contribsMade, totalEmployeeLimit) * marginalRate;

    // 30-year projection: pre-tax vs taxable
    const annualContrib  = Number(input.annualContribution || totalEmployeeLimit);
    const growthRate     = Number(input.growthRate || 0.07);
    const currentBalance = Number(input.currentBalance || 0);
    let pretaxBal = currentBalance;
    let taxableBal = currentBalance;

    for (let i = 0; i < 30; i++) {
      pretaxBal  = (pretaxBal + annualContrib) * (1 + growthRate);
      const taxableContrib = annualContrib * (1 - marginalRate); // after-tax dollars
      const growth = taxableBal * growthRate;
      const taxOnGrowth = growth * 0.20; // assume 20% LTCG
      taxableBal = (taxableBal + taxableContrib + growth - taxOnGrowth);
    }

    res.json({
      summary: {
        employeeLimit,
        catchupAllowed: catchup,
        totalEmployeeLimit,
        employerMatchActual: employerMatch,
        contributionsMade: contribsMade,
        remainingRoom,
        annualTaxSaving,
      },
      catchupEligibility: {
        age50Plus:    age >= 50,
        superCatchup: age >= 60 && age <= 63,
        catchupAmount: catchup,
      },
      thirtyYearProjection: {
        pretaxBalanceFinal:   Math.round(pretaxBal),
        taxableBalanceFinal:  Math.round(taxableBal),
        pretaxAdvantage:      Math.round(pretaxBal - taxableBal),
      },
    });
  } catch (error) {
    console.error("[401k room error]", error);
    res.status(500).json({ error: "Failed to calculate 401(k) room" });
  }
});

// ── IRA / Roth IRA Room ───────────────────────────────────────────────────────

usTaxRouter.post("/:clientId/ira-room", async (req, res) => {
  try {
    const input        = req.body;
    const age          = Number(input.age || 40);
    const year         = new Date().getFullYear();
    const filingStatus = (input.filingStatus as FilingStatus) || "single";
    const magi         = Number(input.magi || 0);

    const baseLimit    = getIraLimit(year);
    const catchup      = age >= 50 ? US_IRA_CATCHUP_50_2025 : 0;
    const totalLimit   = baseLimit + catchup;
    const contribsMade = Number(input.contributionsMade || 0);

    // Roth eligibility
    const rothPhaseout = US_ROTH_IRA_PHASEOUT_2025[filingStatus] ?? US_ROTH_IRA_PHASEOUT_2025.single;
    let rothAllowed = totalLimit;
    if (magi >= rothPhaseout.upper) {
      rothAllowed = 0;
    } else if (magi > rothPhaseout.lower) {
      const pct = 1 - (magi - rothPhaseout.lower) / (rothPhaseout.upper - rothPhaseout.lower);
      rothAllowed = Math.floor((totalLimit * pct) / 10) * 10;
    }

    const isBackdoorRothAdvised = magi >= rothPhaseout.upper;

    // 30-year Roth vs taxable comparison
    const annualContrib  = Number(input.annualContribution || totalLimit);
    const growthRate     = Number(input.growthRate || 0.07);
    const currentRoth    = Number(input.currentRothBalance || 0);
    let rothBal = currentRoth;
    let taxableBal = currentRoth;
    const marginalRate = Number(input.marginalRate || 0.22);

    for (let i = 0; i < 30; i++) {
      rothBal = (rothBal + annualContrib) * (1 + growthRate); // tax-free
      const growth = taxableBal * growthRate;
      taxableBal = (taxableBal + annualContrib) * (1 + growthRate) - growth * 0.15; // LTCG drag
    }

    res.json({
      summary: {
        baseLimit,
        catchupAllowed: catchup,
        totalLimit,
        rothContribAllowed: rothAllowed,
        isBackdoorRothAdvised,
        contributionsMade: contribsMade,
        remainingRoom: Math.max(0, totalLimit - contribsMade),
      },
      rothPhaseout: {
        lower: rothPhaseout.lower,
        upper: rothPhaseout.upper,
        currentMagi: magi,
        fullyEligible: magi <= rothPhaseout.lower,
        partiallyEligible: magi > rothPhaseout.lower && magi < rothPhaseout.upper,
        ineligible: magi >= rothPhaseout.upper,
      },
      backdoorRoth: isBackdoorRothAdvised ? {
        recommended: true,
        steps: [
          "Make a non-deductible Traditional IRA contribution ($" + totalLimit.toLocaleString() + ")",
          "Wait for contribution to settle (typically 1-2 business days)",
          "Convert the Traditional IRA balance to Roth IRA",
          "File Form 8606 to track non-deductible basis",
          "Note: Pro-rata rule applies if you have other pre-tax IRA balances",
        ],
      } : { recommended: false },
      thirtyYearProjection: {
        rothBalanceFinal:    Math.round(rothBal),
        taxableBalanceFinal: Math.round(taxableBal),
        rothAdvantage:       Math.round(rothBal - taxableBal),
      },
    });
  } catch (error) {
    console.error("[ira room error]", error);
    res.status(500).json({ error: "Failed to calculate IRA room" });
  }
});

// ── Social Security Timing ────────────────────────────────────────────────────

usTaxRouter.post("/:clientId/ss-timing", async (req, res) => {
  try {
    const input     = req.body;
    const pia       = Number(input.ssMonthlyBenefitAtFra || 0);
    const birthYear = Number(input.birthYear || 1960);
    const filingStatus = (input.filingStatus || "single") as "single" | "mfj";

    if (pia <= 0) {
      return res.status(400).json({ error: "ssMonthlyBenefitAtFra (PIA) is required" });
    }

    const provisionalIncome = Number(input.provisionalIncomeAtRetirement || 0);
    const analysis = analyzeSsTiming(pia, birthYear, provisionalIncome, filingStatus);

    // Spousal analysis if applicable
    let spouseAnalysis = null;
    if (input.hasSpouse && input.spousePia && input.spouseBirthYear) {
      spouseAnalysis = analyzeSsSpousal(
        pia,
        Number(input.spousePia),
        Number(input.age || 65),
        Number(input.spouseAge || 65),
        birthYear,
        Number(input.spouseBirthYear),
      );
    }

    res.json({ ...analysis, spouseAnalysis });
  } catch (error) {
    console.error("[ss timing error]", error);
    res.status(500).json({ error: "Failed to analyze Social Security timing" });
  }
});

// ── Capital Gains Analysis ────────────────────────────────────────────────────

usTaxRouter.post("/:clientId/us-capital-gains", async (req, res) => {
  try {
    const input = req.body;

    if (!input.positions || !Array.isArray(input.positions)) {
      return res.status(400).json({ error: "positions array required" });
    }

    const positions = input.positions.map((p: any) => ({
      name:          String(p.symbol || p.name || ""),
      marketValue:   Number(p.fmv || p.marketValue || 0),
      costBasis:     Number(p.acb || p.costBasis || 0),
      unrealizedGain: Number(p.fmv || p.marketValue || 0) - Number(p.acb || p.costBasis || 0),
      isLongTerm:    Boolean(p.isLongTerm ?? true),
      isLoss:        (Number(p.fmv || p.marketValue || 0) - Number(p.acb || p.costBasis || 0)) < 0,
    }));

    const ordinaryIncome = Number(input.ordinaryIncome || input.currentIncome || 100_000);
    const filingStatus   = (input.filingStatus || "single") as FilingStatus;
    const usState        = resolveStateCode(String(input.usState || "CA"));

    const result = analyzeUsCapitalGains(positions, ordinaryIncome, filingStatus, usState);

    res.json({
      positions: result.positions.map(p => ({
        name:          p.name,
        costBasis:     p.costBasis,
        marketValue:   p.marketValue,
        unrealizedGain: p.unrealizedGain,
        isLongTerm:    p.isLongTerm,
        isLoss:        p.isLoss,
      })),
      totalUnrealizedLtcg:    result.totalUnrealizedLtcg,
      totalUnrealizedStcg:    result.totalUnrealizedStcg,
      totalUnrealizedLoss:    result.totalUnrealizedLoss,
      harvestingOpportunity:  result.harvestingOpportunity,
      stepUpOpportunity:      result.stepUpOpportunity,
      scenarios:              result.scenarios.map(s => ({
        name:             s.label,
        amountRealized:   s.amountRealized,
        isLongTerm:       s.isLongTerm,
        ltcgTax:          s.ltcgTax,
        niit:             s.niit,
        stateTax:         s.stateTax,
        totalTax:         s.totalTax,
        netProceeds:      s.netProceeds,
        effectiveTaxRate: s.effectiveTaxRate,
      })),
      recommendedYear:        result.recommendedYear,
      reasoning:              result.reasoning,
      rothConversionInterplay: result.rothConversionInterplay,
    });
  } catch (error) {
    console.error("[us capital gains error]", error);
    res.status(500).json({ error: "Failed to analyze US capital gains" });
  }
});

// ── Roth Conversion Analysis ──────────────────────────────────────────────────

usTaxRouter.post("/:clientId/roth-conversion", async (req, res) => {
  try {
    const input        = req.body;
    const filingStatus = (input.filingStatus || "single") as FilingStatus;
    const usState      = resolveStateCode(String(input.usState || "CA"));

    if (!input.currentAge || !input.birthYear) {
      return res.status(400).json({ error: "currentAge and birthYear are required" });
    }

    const result = analyzeRothConversion(
      Number(input.tradIraBalance    || 0),
      Number(input.rothBalance       || 0),
      Number(input.currentAge),
      Number(input.birthYear),
      Number(input.ssClaimAge        || 67),
      Number(input.retirementAge     || 65),
      Number(input.ordinaryIncome    || 0),
      filingStatus,
      usState,
    );

    res.json(result);
  } catch (error) {
    console.error("[roth conversion error]", error);
    res.status(500).json({ error: "Failed to analyze Roth conversion" });
  }
});

// ── Quick Tax Calculator ──────────────────────────────────────────────────────
// Lightweight endpoint for the UI to show live federal + state tax as inputs change

usTaxRouter.post("/:clientId/us-tax-calc", async (req, res) => {
  try {
    const input        = req.body;
    const filingStatus = (input.filingStatus || "single") as FilingStatus;
    const usState      = resolveStateCode(String(input.usState || "CA"));
    const grossIncome  = Number(input.grossIncome || 0);
    const standardDed  = US_STANDARD_DEDUCTION_2025[filingStatus];
    const itemized     = Number(input.itemizedDeductions || 0);
    const deduction    = Math.max(standardDed, itemized);
    const taxableIncome = Math.max(0, grossIncome - deduction);

    const ltcg         = Number(input.ltcgAmount || 0);
    const nii          = Number(input.netInvestmentIncome || ltcg);

    const result   = calculateCombinedTaxUS(taxableIncome, filingStatus, usState, nii, grossIncome - ltcg, grossIncome);
    const ltcgTax  = calculateLtcgTax(taxableIncome - ltcg, ltcg, filingStatus);

    res.json({
      grossIncome,
      deductionUsed:   deduction,
      taxableIncome,
      federalTax:      result.federalTax,
      stateTax:        result.stateTax,
      niit:            result.niit,
      ltcgTax,
      totalTax:        result.totalTax + ltcgTax,
      effectiveRate:   result.effectiveRate,
      marginalRate:    result.marginalRate,
      afterTaxIncome:  grossIncome - result.totalTax - ltcgTax,
    });
  } catch (error) {
    console.error("[us tax calc error]", error);
    res.status(500).json({ error: "Failed to calculate US tax" });
  }
});

  // ── US Retirement Monte Carlo ─────────────────────────────────────────────────
usTaxRouter.post("/:clientId/us-retirement", async (req, res) => {
  try {
    const { runUsRetirementProjection } = await import("../engine/usRetirementProjection.js");
    const input = req.body;
    if (!input.currentAge || !input.retirementAge || !input.birthYear) {
      return res.status(400).json({ error: "currentAge, retirementAge and birthYear are required" });
    }
    const result = runUsRetirementProjection({
      currentAge:              Number(input.currentAge),
      retirementAge:           Number(input.retirementAge),
      lifeExpectancy:          Number(input.lifeExpectancy      || 90),
      birthYear:               Number(input.birthYear),
      filingStatus:            input.filingStatus               || "single",
      usState:                 input.usState                    || "CA",
      pretaxBalance:           Number(input.pretaxBalance       || 0),
      rothBalance:             Number(input.rothBalance         || 0),
      taxableBalance:          Number(input.taxableBalance      || 0),
      annualPretaxContrib:     Number(input.annualPretaxContrib || 0),
      annualRothContrib:       Number(input.annualRothContrib   || 0),
      annualTaxableContrib:    Number(input.annualTaxableContrib|| 0),
      employerMatch:           Number(input.employerMatch       || 0),
      currentIncome:           Number(input.currentIncome       || 0),
      desiredRetirementIncome: Number(input.desiredRetirementIncome || 60000),
      pensionIncome:           Number(input.pensionIncome       || 0),
      pensionCola:             Number(input.pensionCola         || 0.02),
      ssMonthlyAtFra:          Number(input.ssMonthlyAtFra      || 0),
      ssClaimAge:              Number(input.ssClaimAge          || 67),
      expectedReturn:          Number(input.expectedReturn      || 0.07),
      stdDev:                  Number(input.stdDev              || 0.10),
      inflationRate:           Number(input.inflationRate       || 0.025),
      equityAllocation:        Number(input.equityAllocation    || 0.60),
      isCouple:                Boolean(input.isCouple),
      spouseAge:               input.spouseAge        ? Number(input.spouseAge)        : undefined,
      spouseBirthYear:         input.spouseBirthYear  ? Number(input.spouseBirthYear)  : undefined,
      spouseRetirementAge:     input.spouseRetirementAge ? Number(input.spouseRetirementAge) : undefined,
      spousePretaxBalance:     input.spousePretaxBalance ? Number(input.spousePretaxBalance) : undefined,
      spouseRothBalance:       input.spouseRothBalance  ? Number(input.spouseRothBalance)  : undefined,
      spouseSsMonthlyAtFra:    input.spouseSsMonthlyAtFra ? Number(input.spouseSsMonthlyAtFra) : undefined,
      spouseSsClaimAge:        input.spouseSsClaimAge  ? Number(input.spouseSsClaimAge)  : undefined,
      simulations:             Number(input.simulations || 1000),
    });
    res.json(result);
  } catch (e: any) {
    console.error("[us-retirement]", e.message);
    res.status(500).json({ error: e.message });
  }
});
