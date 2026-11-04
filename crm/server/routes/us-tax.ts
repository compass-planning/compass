import { Router } from "express";
import { isAuthenticated } from "../auth";
import { getCompanyId } from "./middleware";
import { db } from "../db";
import { clients } from "@shared/schema";
import { eq, and } from "drizzle-orm";

import { projectUsTaxYears }                          from "../engine/tax/usProjector";
import { analyzeUsCapitalGains, analyzeRothConversion } from "../engine/tax/usCapitalGains";
import { analyzeSsTiming, analyzeSsSpousal }           from "../engine/reference/usSocialSecurity";
import {
  calculateCombinedTaxUS,
  calculateLtcgTax,
  US_STANDARD_DEDUCTION_2025,
  resolveStateCode,
} from "../engine/reference/usTaxData2025";
import {
  get401kLimit, getIraLimit,
  US_401K_CATCHUP_50_2025, US_401K_CATCHUP_6063_2025,
  US_IRA_CATCHUP_50_2025, US_ROTH_IRA_PHASEOUT_2025,
  getRmdStartAge, getSsFra,
} from "../engine/reference/usBenefitRates2025";
import type { UsTaxProjectionProfile } from "../engine/tax/usTypes";
import type { FilingStatus }           from "../engine/reference/usTaxData2025";

export const usTaxRouter = Router();
usTaxRouter.use(isAuthenticated);

// ── Tenant isolation ─────────────────────────────────────────────────────────
async function clientInCompany(req: any, clientId: number): Promise<boolean> {
  const companyId = await getCompanyId(req);
  if (!companyId) return false;
  const [c] = await db.select({ id: clients.id }).from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));
  return !!c;
}

// ── Tax Projection ────────────────────────────────────────────────────────────
usTaxRouter.post("/:clientId/us-projection", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const input = req.body as Partial<UsTaxProjectionProfile>;
    if (!input.currentAge || !input.retirementAge || !input.planToAge || !input.usState)
      return res.status(400).json({ error: "Missing required fields: currentAge, retirementAge, planToAge, usState" });

    const profile: UsTaxProjectionProfile = {
      currentAge:           Number(input.currentAge),
      retirementAge:        Number(input.retirementAge),
      planToAge:            Number(input.planToAge),
      birthYear:            Number(input.birthYear || (new Date().getFullYear() - Number(input.currentAge))),
      filingStatus:         (input.filingStatus as FilingStatus) || "single",
      usState:              String(input.usState),
      wagesIncome:          Number(input.wagesIncome          || 0),
      selfEmploymentIncome: Number(input.selfEmploymentIncome || 0),
      otherOrdinaryIncome:  Number(input.otherOrdinaryIncome  || 0),
      qualifiedDividends:   Number(input.qualifiedDividends   || 0),
      ordinaryDividends:    Number(input.ordinaryDividends    || 0),
      incomeGrowthRate:     Number(input.incomeGrowthRate     || 0.03),
      pretaxBalance:        Number(input.pretaxBalance        || 0),
      pretaxAnnualContrib:  Number(input.pretaxAnnualContrib  || 0),
      employerMatch:        Number(input.employerMatch        || 0),
      pretaxGrowthRate:     Number(input.pretaxGrowthRate     || 0.07),
      rothBalance:          Number(input.rothBalance          || 0),
      rothAnnualContrib:    Number(input.rothAnnualContrib    || 0),
      rothGrowthRate:       Number(input.rothGrowthRate       || 0.07),
      tradIraBalance:       Number(input.tradIraBalance       || 0),
      tradIraAnnualContrib: Number(input.tradIraAnnualContrib || 0),
      taxableBalance:       Number(input.taxableBalance       || 0),
      taxableCostBasis:     Number(input.taxableCostBasis     || 0),
      taxableAnnualContrib: Number(input.taxableAnnualContrib || 0),
      taxableGrowthRate:    Number(input.taxableGrowthRate    || 0.07),
      dividendYield:        Number(input.dividendYield        || 0.02),
      hsaBalance:           Number(input.hsaBalance           || 0),
      hsaAnnualContrib:     Number(input.hsaAnnualContrib     || 0),
      hsaGrowthRate:        Number(input.hsaGrowthRate        || 0.05),
      ssMonthlyBenefitAtFra: Number(input.ssMonthlyBenefitAtFra || 0),
      ssSpousalMonthlyAtFra: Number(input.ssSpousalMonthlyAtFra || 0),
      ssStartAge:           Number(input.ssStartAge           || 67),
      pensionMonthly:       Number(input.pensionMonthly       || 0),
      pensionStartAge:      Number(input.pensionStartAge      || 65),
      desiredRetirementIncome: Number(input.desiredRetirementIncome || 0),
      inflationRate:        Number(input.inflationRate        || 0.03),
      longTermCareAnnual:   Number(input.longTermCareAnnual   || 0),
      longTermCareStartAge: Number(input.longTermCareStartAge || 80),
      longTermCareDuration: Number(input.longTermCareDuration || 3),
    } as UsTaxProjectionProfile;

    const rows = projectUsTaxYears(profile);
    res.json({ projections: rows });
  } catch (e: any) {
    console.error("[us-projection]", e?.message);
    res.status(500).json({ error: "Failed to run US projection" });
  }
});

// ── 401(k) Room ───────────────────────────────────────────────────────────────
usTaxRouter.post("/:clientId/401k-room", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const { age, employerMatch, annualSalary } = req.body;
    const yr = new Date().getFullYear();
    const limit = get401kLimit(yr);
    const catchup50   = age >= 50  && age < 60  ? US_401K_CATCHUP_50_2025   : 0;
    const catchup6063 = age >= 60  && age <= 63 ? US_401K_CATCHUP_6063_2025 : 0;
    const totalLimit  = limit + catchup50 + catchup6063;
    const matchAmt    = Number(annualSalary || 0) * Number(employerMatch || 0);
    res.json({
      employeeLimit: limit, catchup50, catchup6063, totalEmployeeLimit: totalLimit,
      employerMatchEstimate: matchAmt, combinedLimit: totalLimit + matchAmt,
      year: yr,
    });
  } catch (e: any) {
    console.error("[401k-room]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── IRA Room ──────────────────────────────────────────────────────────────────
usTaxRouter.post("/:clientId/ira-room", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const { age, filingStatus, magi } = req.body;
    const yr     = new Date().getFullYear();
    const limit  = getIraLimit(yr);
    const catchup = age >= 50 ? US_IRA_CATCHUP_50_2025 : 0;
    const phaseout = (US_ROTH_IRA_PHASEOUT_2025 as any)[filingStatus || "single"] ?? US_ROTH_IRA_PHASEOUT_2025.single;
    const magiNum = Number(magi || 0);
    let rothEligible = limit + catchup;
    if (magiNum > phaseout.max) rothEligible = 0;
    else if (magiNum > phaseout.min)
      rothEligible = Math.round(rothEligible * (1 - (magiNum - phaseout.min) / (phaseout.max - phaseout.min)));
    res.json({ baseLimit: limit, catchup, totalLimit: limit + catchup, rothEligibleContribution: rothEligible, phaseoutRange: phaseout, year: yr });
  } catch (e: any) {
    console.error("[ira-room]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Social Security Timing ───────────────────────────────────────────────────
usTaxRouter.post("/:clientId/ss-timing", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const { birthYear, monthlyBenefitAtFra, filingStatus, spouseMonthlyAtFra } = req.body;
    const result = analyzeSsTiming({ birthYear: Number(birthYear), monthlyBenefitAtFra: Number(monthlyBenefitAtFra) });
    let spousal = null;
    if (spouseMonthlyAtFra)
      spousal = analyzeSsSpousal({ birthYear: Number(birthYear), monthlyBenefitAtFra: Number(monthlyBenefitAtFra) }, { monthlyBenefitAtFra: Number(spouseMonthlyAtFra) });
    res.json({ primary: result, spousal });
  } catch (e: any) {
    console.error("[ss-timing]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Capital Gains (US) ────────────────────────────────────────────────────────
usTaxRouter.post("/:clientId/us-capital-gains", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const result = analyzeUsCapitalGains(req.body);
    res.json(result);
  } catch (e: any) {
    console.error("[us-capital-gains]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Roth Conversion Analysis ──────────────────────────────────────────────────
usTaxRouter.post("/:clientId/roth-conversion", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const result = analyzeRothConversion(req.body);
    res.json(result);
  } catch (e: any) {
    console.error("[roth-conversion]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── Quick Tax Calc ────────────────────────────────────────────────────────────
usTaxRouter.post("/:clientId/us-tax-calc", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const { ordinaryIncome, qualifiedDividends, longTermGains, filingStatus, usState, age } = req.body;
    const stateCode = resolveStateCode(String(usState || "CA"));
    const result = calculateCombinedTaxUS(
      Number(ordinaryIncome || 0), Number(qualifiedDividends || 0),
      Number(longTermGains || 0),
      (filingStatus || "single") as FilingStatus,
      stateCode, Number(age || 45),
    );
    const deduction = (US_STANDARD_DEDUCTION_2025 as any)[filingStatus || "single"] ?? US_STANDARD_DEDUCTION_2025.single;
    res.json({ ...result, standardDeduction: deduction });
  } catch (e: any) {
    console.error("[us-tax-calc]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// ── US Retirement Projection ──────────────────────────────────────────────────
usTaxRouter.post("/:clientId/us-retirement", async (req: any, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    if (!await clientInCompany(req, clientId)) return res.status(404).json({ error: "Not found" });
    const input = req.body as Partial<UsTaxProjectionProfile>;
    if (!input.currentAge || !input.retirementAge || !input.usState)
      return res.status(400).json({ error: "Missing required fields" });
    const profile = { ...input, planToAge: input.planToAge || 90 } as UsTaxProjectionProfile;
    const rows = projectUsTaxYears(profile);
    const fra  = getSsFra(Number(input.birthYear || (new Date().getFullYear() - Number(input.currentAge))));
    const rmdAge = getRmdStartAge(Number(input.birthYear || 1960));
    res.json({ projections: rows, socialSecurityFra: fra, rmdStartAge: rmdAge });
  } catch (e: any) {
    console.error("[us-retirement]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});
