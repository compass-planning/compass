// server/planning/routes.ts
// ─────────────────────────────────────────────────────────────────────────────
// Financial Planning Report Routes — adapted for fp-standalone schema
// Mount in server/index.ts:
//   import { planningRouter } from "./planning/routes.js";
//   app.use("/api/planning", planningRouter);
// (isAuthenticated is applied globally via r.use in this file)
// ─────────────────────────────────────────────────────────────────────────────
import { Router, type Response } from "express";
import { db } from "../db/index.js";
import {
  clients,
  retirementProjections,
  taxPlanningNotes,
  householdExpenses,
  debtEntries,
  educationSavings,
  estatePlanningNotes,
  insuranceAnalyses,
  netWorthEntries,
  users,
} from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";

import { projectRetirement }      from "./engines/retirement.js";
import { projectTax }             from "./engines/tax.js";
import { analyzeRrsp }            from "./engines/rrsp.js";
import { analyzeTfsa }            from "./engines/tfsa.js";
import { analyzeCapitalGains }    from "./engines/capitalGains.js";
import { analyzeIncomeSplitting } from "./engines/incomeSplitting.js";
import { analyzeInsurance }       from "./engines/insurance.js";
import { analyzeEducation }       from "./engines/education.js";
import { analyzeEstate }          from "./engines/estate.js";
import { analyzeDebt }            from "./engines/debt.js";
import { generateComprehensiveReport } from "./reports/comprehensive.js";

import type {
  RetirementInputs, TaxInputs, RrspInputs, TfsaInputs,
  CapitalGainsInputs, IncomeSplittingInputs, InsuranceInputs,
  EducationInputs, EstateInputs, DebtInputs,
  PlanningClient, PlanningAdvisor, ReportMeta, Province,
} from "./types.js";
import { logger } from "../logger";

export const planningRouter = Router();
planningRouter.use(isAuthenticated);

// ── Helpers ───────────────────────────────────────────────────────────────────

function ageFrom(dob: string): number {
  const birth = new Date(dob), today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function toProvince(raw: string | null | undefined): Province {
  const map: Record<string, Province> = {
    on: "ontario", ontario: "ontario",
    bc: "british_columbia", "british columbia": "british_columbia", british_columbia: "british_columbia",
    ab: "alberta", alberta: "alberta",
    qc: "quebec", quebec: "quebec",
    mb: "manitoba", manitoba: "manitoba",
    sk: "saskatchewan", saskatchewan: "saskatchewan",
    ns: "nova_scotia", "nova scotia": "nova_scotia",
    nb: "new_brunswick", "new brunswick": "new_brunswick",
    pe: "pei", pei: "pei",
    nl: "newfoundland", newfoundland: "newfoundland",
    yt: "yukon", yukon: "yukon",
    nt: "northwest_territories",
    nu: "nunavut", nunavut: "nunavut",
  };
  return map[(raw ?? "on").toLowerCase()] ?? "ontario";
}

function today(): string {
  return new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

/** Sum netWorthEntries assets by category keyword (case-insensitive). */
function sumNwCategory(rows: { type: string; category: string; value: string }[], keyword: string): number {
  return rows
    .filter(r => r.type === "asset" && r.category.toLowerCase().includes(keyword.toLowerCase()))
    .reduce((s, r) => s + Number(r.value ?? 0), 0);
}

/** Sum householdExpenses monthly amounts by category keyword. */
function sumExpenseCategory(rows: { category: string; monthlyAmount: string | null }[], keyword: string): number {
  return rows
    .filter(r => r.category.toLowerCase().includes(keyword.toLowerCase()))
    .reduce((s, r) => s + Number(r.monthlyAmount ?? 0), 0);
}

// ── Ownership check ───────────────────────────────────────────────────────────

async function _ownsClient(clientId: number, userId: number): Promise<boolean> {
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  return !!c;
}

// ── Load client + advisor ─────────────────────────────────────────────────────
// fp-standalone: no staff/companies tables — advisor is the authenticated user.
// Spouse data is stored inline on the client row (spouseFirstName etc.),
// not as a separate client record linked via spouseId.

async function _loadClientAndAdvisor(
  userId: number,
  clientId: number,
): Promise<{ client: PlanningClient; advisor: PlanningAdvisor; annualIncome: number; spouseAnnualIncome: number } | null> {

  const [clientRow] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  if (!clientRow) return null;

  const [userRow] = await db
    .select({
      firstName: users.firstName,
      lastName:  users.lastName,
      email:     users.email,
      firmName:  users.firmName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // Infer marital status from presence of spouse fields
  const hasSpouse = !!clientRow.spouseFirstName;
  const maritalStatus = hasSpouse ? "married" : "single";

  const client: PlanningClient = {
    id:             clientRow.id,
    firstName:      clientRow.firstName,
    lastName:       clientRow.lastName,
    fullName:       `${clientRow.firstName} ${clientRow.lastName}`,
    dateOfBirth:    clientRow.dateOfBirth ?? "1975-01-01",
    age:            clientRow.dateOfBirth ? ageFrom(clientRow.dateOfBirth) : 50,
    province:       toProvince(clientRow.province),
    maritalStatus,
    // Spouse — inline fields on client row, no separate record lookup needed
    spouseFirstName:   clientRow.spouseFirstName  ?? undefined,
    spouseLastName:    clientRow.spouseLastName   ?? undefined,
    spouseDateOfBirth: clientRow.spouseDateOfBirth ?? undefined,
    spouseAge:         clientRow.spouseDateOfBirth ? ageFrom(clientRow.spouseDateOfBirth) : undefined,
    email: clientRow.email ?? "",
    phone: clientRow.phone ?? undefined,
  };

  const advisor: PlanningAdvisor = {
    firstName:   userRow?.firstName ?? "Advisor",
    lastName:    userRow?.lastName  ?? "",
    fullName:    userRow ? `${userRow.firstName} ${userRow.lastName}` : "Your Advisor",
    email:       userRow?.email ?? "",
    companyName: userRow?.firmName ?? "fp-standalone",
  };

return {
  client, advisor,
  annualIncome:       Number(clientRow.annualIncome       ?? 0),
  spouseAnnualIncome: Number(clientRow.spouseAnnualIncome ?? 0),
};

// ── POST /api/planning/report/:clientId ───────────────────────────────────────
// Body: { sections?: string | string[], overrides?: object }
// Returns: text/html full report

planningRouter.post("/report/:clientId", async (req: AuthRequest, res: Response) => {
  try {
    const userId   = req.userId!;
    const clientId = parseInt(req.params.clientId, 10);
    const { sections = "all", overrides = {} } = req.body as {
      sections: string | string[];
      overrides: Record<string, any>;
    };

    const wanted = sections === "all"
      ? ["retirement","tax","rrsp","tfsa","capitalGains","incomeSplitting","insurance","education","estate","debt"]
      : Array.isArray(sections) ? sections : [sections];

    const people = await loadClientAndAdvisor(userId, clientId);
    if (!people) return res.status(404).json({ error: "Client not found" });

    const { client, advisor, annualIncome: clientAnnualIncome, spouseAnnualIncome: clientSpouseAnnualIncome } = people;
    const meta: ReportMeta = {
      client, advisor,
      reportDate:   today(),
      reportTitle:  "Comprehensive Financial Plan",
      disclaimer:   "This plan does not constitute investment advice. Past performance is not indicative of future results. Please consult a registered financial planner.",
      confidential: true,
    };

    // ── Load DB rows ───────────────────────────────────────────────────────────
    // Child tables are already scoped to this client; ownership verified above.
    const [retRow] = await db
      .select().from(retirementProjections)
      .where(eq(retirementProjections.clientId, clientId))
      .limit(1);

    // taxPlanningNotes in fp-standalone is a notes table (title/content/category),
    // not a structured financial data store — all financial fields fall to defaults.
    const [_taxNote] = await db
      .select().from(taxPlanningNotes)
      .where(eq(taxPlanningNotes.clientId, clientId))
      .limit(1);

    const [_estRow] = await db
      .select().from(estatePlanningNotes)
      .where(eq(estatePlanningNotes.clientId, clientId))
      .limit(1);

    const [insRow] = await db
      .select().from(insuranceAnalyses)
      .where(eq(insuranceAnalyses.clientId, clientId))
      .limit(1);

    const eduRows      = await db.select().from(educationSavings).where(eq(educationSavings.clientId, clientId));
    const debtRows     = await db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId));
    const nwRows       = await db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, clientId));
    const expenseRows  = await db.select().from(householdExpenses).where(eq(householdExpenses.clientId, clientId));

    // ── Derive portfolio balances from netWorthEntries ─────────────────────────
    // fp-standalone stores RRSP/TFSA/etc. as net worth asset entries by category.
    const rrspBalance   = sumNwCategory(nwRows, "rrsp");
    const tfsaBalance   = sumNwCategory(nwRows, "tfsa");
    const nonRegBalance = sumNwCategory(nwRows, "non-registered") || sumNwCategory(nwRows, "non_reg");
    const rrifBalance   = sumNwCategory(nwRows, "rrif");

    // ── Derive expense buckets from householdExpenses ──────────────────────────
    const totalMonthlyExpenses = expenseRows.reduce((s, e) => s + Number(e.monthlyAmount ?? 0), 0);

    // ── Build inputs ───────────────────────────────────────────────────────────
    const province = client.province;
    const age      = client.age;

    // retRow column mapping for fp-standalone schema:
    //   annualContribution  (not annualRrspContribution)
    //   lifeExpectancy      (not planToAge)
    //   pensionIncome       (annual, not monthly)
    //   expectedReturn      (combined portfolio rate, not separate equity/bond)
    //   equityAllocation    (0–1 decimal)
    const retRawReturn     = Number(retRow?.expectedReturn ?? 7) / 100;
    const retEquityAlloc   = Number((retRow as any)?.equityAllocation ?? 0.60);
    // Approximate split: equityReturn ≈ totalReturn / equityAlloc, bondReturn ≈ remainder
    const impliedEquityRet = retEquityAlloc > 0 ? Math.min(retRawReturn / retEquityAlloc, 0.12) : 0.07;
    const impliedBondRet   = retEquityAlloc < 1 ? Math.max(retRawReturn - impliedEquityRet * retEquityAlloc, 0.02) : 0.035;

    //const clientAnnualIncome       = Number(client.annualIncome ?? (retRow as any)?.annualIncome ?? 80000);
    //const clientSpouseAnnualIncome = Number(client.spouseAnnualIncome ?? 0);

    const retInputs: RetirementInputs = {
      currentAge:               age,
      retirementAge:            Number(retRow?.retirementAge   ?? 65),
      planToAge:                Number(retRow?.lifeExpectancy  ?? 90),   // lifeExpectancy → planToAge
      province,
      rrspBalance:              Number(retRow?.rrspBalance      ?? rrspBalance),
      tfsaBalance:              Number(retRow?.tfsaBalance      ?? tfsaBalance),
      nonRegBalance:            Number(retRow?.nonRegBalance    ?? nonRegBalance),
      pensionMonthly:           Number(retRow?.pensionIncome    ?? 0) / 12,   // annual → monthly
      annualRrspContribution:   Number(retRow?.annualContribution ?? 10000),  // annualContribution → annualRrspContribution
      annualTfsaContribution:   Number(retRow?.annualTfsaContribution ?? 7000),
      annualNonRegContribution: Number((retRow as any)?.annualNonRegContribution ?? 0),
      employmentIncome:         clientAnnualIncome,
      spouseEmploymentIncome:   clientSpouseAnnualIncome,
      desiredRetirementIncome:  Number(retRow?.desiredRetirementIncome ?? 60000),
      cppStartAge:              Number(retRow?.cppStartAge  ?? 65),
      oasStartAge:              Number(retRow?.oasStartAge  ?? 65),
      yearsInCanada:            Number((retRow as any)?.yearsInCanada ?? 40),
      spouseAge:                client.spouseAge,
      spouseRrspBalance:        0,   // not stored separately in fp-standalone
      spouseTfsaBalance:        0,
      spouseCppStartAge:        65,
      equityReturn:             impliedEquityRet,
      bondReturn:               impliedBondRet,
      inflationRate:            Number(retRow?.inflationRate  ?? 2) / 100,
      equityAllocation:         retEquityAlloc,
      rrifConversionAge:        Number((retRow as any)?.rrifConversionAge ?? 71),
      ...overrides.retirement,
    };

    // taxPlanningNotes has no financial columns in fp-standalone — all default
    const taxInputs: TaxInputs = {
      taxYear:              new Date().getFullYear(),
      province,
      employmentIncome:     clientAnnualIncome,
      selfEmploymentIncome: 0,
      capitalGainsIncome:   0,
      eligibleDividends:    0,
      nonEligibleDividends: 0,
      rrspDeduction:        Math.min(retInputs.annualRrspContribution, 31560),
      otherDeductions:      0,
      pensionIncome:        retInputs.pensionMonthly * 12,
      rentalIncome:         0,
      otherIncome:          0,
      rrspContributionRoom: 50000,
      spouseEmploymentIncome: clientSpouseAnnualIncome,
      spousePensionIncome:  0,
      ...overrides.tax,
    };

    const portfolioReturn = retInputs.equityReturn * retInputs.equityAllocation
      + retInputs.bondReturn * (1 - retInputs.equityAllocation);

    const birthYear = client.dateOfBirth
      ? new Date(client.dateOfBirth).getFullYear()
      : new Date().getFullYear() - age;

    const rrspInputs: RrspInputs = {
      currentAge:              age,
      earnedIncome:            taxInputs.employmentIncome + taxInputs.selfEmploymentIncome,
      currentBalance:          retInputs.rrspBalance,
      unusedContributionRoom:  taxInputs.rrspContributionRoom,
      pensionAdjustment:       0,
      annualContribution:      retInputs.annualRrspContribution,
      province,
      expectedRetirementAge:   retInputs.retirementAge,
      expectedReturnRate:      portfolioReturn,
      ...overrides.rrsp,
    };

    const tfsaInputs: TfsaInputs = {
      currentAge:          age,
      birthYear,
      currentBalance:      retInputs.tfsaBalance,
      withdrawalsThisYear: 0,
      annualContribution:  retInputs.annualTfsaContribution,
      expectedReturnRate:  portfolioReturn,
      province,
      ...overrides.tfsa,
    };

    const cgInputs: CapitalGainsInputs = {
      province,
      taxYear:               new Date().getFullYear(),
      otherIncome:           taxInputs.employmentIncome,
      disposals:             [],
      currentYearLosses:     0,
      carryForwardLosses:    0,
      carryBackLosses:       0,
      hasPrincipalResidence: false,
      ...overrides.capitalGains,
    };

    const isInputs: IncomeSplittingInputs = {
      province,
      primaryAge:               age,
      primaryEmploymentIncome:  taxInputs.employmentIncome,
      primaryPensionIncome:     taxInputs.pensionIncome,
      primaryRrspBalance:       retInputs.rrspBalance,
      primaryRrifBalance:       rrifBalance,
      primaryOtherIncome:       taxInputs.otherIncome,
      spouseAge:                client.spouseAge ?? age - 2,
      spouseEmploymentIncome:   taxInputs.spouseEmploymentIncome ?? 0,
      spousePensionIncome:      0,
      spouseRrspBalance:        0,
      spouseOtherIncome:        0,
      yearsToRetirement:        Math.max(0, retInputs.retirementAge - age),
      ...overrides.incomeSplitting,
    };

    // insRow column mapping for fp-standalone schema:
    //   existingLifeCoverage        (not existingLifeInsurance)
    //   existingDisabilityCoverage  (not existingDisabilityBenefit)
    //   existingCriticalIllnessCoverage (not existingCriticalIllness)
    //   yearsOfIncomeNeeded         (not incomeReplacementYears)
    //   monthlyExpenses             (exists in schema)
    const insInputs: InsuranceInputs = {
      clientAge:              age,
      spouseAge:              client.spouseAge,
      province,
      maritalStatus:          client.maritalStatus,
      numberOfDependents:     0,   // not in fp-standalone schema
      annualIncome:           taxInputs.employmentIncome,
      spouseAnnualIncome:     taxInputs.spouseEmploymentIncome,
      incomeReplacementYears: Number((insRow as any)?.yearsOfIncomeNeeded ?? 20),
      liquidAssets:           tfsaBalance + nonRegBalance,  // best proxy available
      rrspBalance,
      tfsaBalance,
      nonRegInvestments:      nonRegBalance,
      realEstateEquity:       0,   // not in fp-standalone schema
      mortgageBalance:        Number((insRow as any)?.mortgageBalance ?? debtRows.find(d => d.category === "mortgage")?.balance ?? 0),
      otherDebt:              debtRows.filter(d => d.category !== "mortgage").reduce((s, d) => s + Number(d.balance ?? 0), 0),
      finalExpenses:          Number((insRow as any)?.finalExpenses ?? 25000),
      existingLifeInsurance:  Number(insRow?.existingLifeCoverage ?? 0),
      existingGroupBenefits:  0,   // not in fp-standalone schema
      monthlyExpenses:        Number((insRow as any)?.monthlyExpenses ?? totalMonthlyExpenses ?? 5000),
      existingDisabilityBenefit: Number((insRow as any)?.existingDisabilityCoverage ?? 0),
      waitingPeriod:          90,
      existingCriticalIllness: Number((insRow as any)?.existingCriticalIllnessCoverage ?? 0),
      province2:              province,
      ...overrides.insurance,
    };

    const eduInputs: EducationInputs = {
      province,
      familyIncome:      taxInputs.employmentIncome + (taxInputs.spouseEmploymentIncome ?? 0),
      numberOfChildren:  eduRows.length,
      children: eduRows.map(e => ({
        name:               e.childName ?? "Child",
        birthYear:          e.childAge  ? (new Date().getFullYear() - e.childAge) : 2015,
        age:                e.childAge  ?? 9,
        existingRespBalance: Number(e.currentRespBalance ?? 0),
      })),
      existingRespBalance: eduRows.reduce((s, e) => s + Number(e.currentRespBalance ?? 0), 0),
      annualContribution:  eduRows.reduce((s, e) => s + Number(e.monthlyContribution ?? 0) * 12, 0) || 2500,
      expectedReturnRate:  portfolioReturn,
      educationType:       "university",
      programYears:        4,
      ...overrides.education,
    };

    // estatePlanningNotes in fp-standalone is a notes table (title/content),
    // not a structured financial data store — all financial fields fall to defaults.
    const estInputs: EstateInputs = {
      province,
      age,
      spouseAge:                   client.spouseAge,
      maritalStatus:               client.maritalStatus,
      primaryResidence:            sumNwCategory(nwRows, "real estate"),
      cottageOrSecondProperty:     0,
      rrspBalance,
      rrifBalance,
      tfsaBalance,
      nonRegInvestments:           nonRegBalance,
      lifeInsurance:               Number(insRow?.existingLifeCoverage ?? 0),
      businessInterest:            sumNwCategory(nwRows, "business"),
      otherAssets:                 0,
      mortgage:                    Number(debtRows.find(d => d.category === "mortgage")?.balance ?? 0),
      otherDebt:                   debtRows.filter(d => d.category !== "mortgage").reduce((s, d) => s + Number(d.balance ?? 0), 0),
      hasWill:                     false,   // not stored in fp-standalone
      hasPOA:                      false,
      hasHCDirective:              false,
      namedRrspBeneficiary:        false,
      namedTfsaBeneficiary:        false,
      namedInsuranceBeneficiary:   false,
      rrspTaxableOnDeath:          client.maritalStatus !== "married",
      capitalGainsOnCottage:       0,
      capitalGainsOnBusiness:      0,
      ...overrides.estate,
    };

    // debtEntries.category in fp-standalone (not .type)
    const debtInputs: DebtInputs = {
      province,
      grossMonthlyIncome:       taxInputs.employmentIncome / 12,
      spouseGrossMonthlyIncome: (taxInputs.spouseEmploymentIncome ?? 0) / 12,
      debts: debtRows.map(d => ({
        name:                 d.name,
        type:                 (d.category as any) ?? "other",   // category → type for engine
        balance:              Number(d.balance ?? 0),
        interestRate:         d.interestRate ? Number(d.interestRate) / 100 : 0.05,
        minimumPayment:       Number(d.minimumPayment ?? Math.round(Number(d.balance ?? 0) * 0.02)),
        remainingTermMonths:  60,   // not stored in fp-standalone
      })),
      // Derive expense buckets from householdExpenses categories
      housingCosts:   sumExpenseCategory(expenseRows, "housing")   || sumExpenseCategory(expenseRows, "rent")   || 2000,
      propertyTax:    sumExpenseCategory(expenseRows, "property")  || 400,
      utilities:      sumExpenseCategory(expenseRows, "utilities") || 300,
      groceries:      sumExpenseCategory(expenseRows, "grocery")   || sumExpenseCategory(expenseRows, "food")   || 800,
      transportation: sumExpenseCategory(expenseRows, "transport") || sumExpenseCategory(expenseRows, "auto")   || 600,
      insurance:      sumExpenseCategory(expenseRows, "insurance") || 300,
      childcare:      sumExpenseCategory(expenseRows, "childcare") || sumExpenseCategory(expenseRows, "child")  || 0,
      entertainment:  sumExpenseCategory(expenseRows, "entertain") || 400,
      otherExpenses:  sumExpenseCategory(expenseRows, "other")     || 500,
      rrspMonthly:    retInputs.annualRrspContribution / 12,
      tfsaMonthly:    retInputs.annualTfsaContribution / 12,
      otherSavings:   0,
      emergencyFundBalance: 0,
      emergencyFundTarget:  totalMonthlyExpenses * 3,
      ...overrides.debt,
    };

    // ── Run engines ────────────────────────────────────────────────────────────
    const engineResults: Parameters<typeof generateComprehensiveReport>[1] = {};

    if (wanted.includes("retirement"))      engineResults.retirement      = projectRetirement(retInputs);
    if (wanted.includes("tax"))             engineResults.tax             = projectTax(taxInputs);
    if (wanted.includes("rrsp"))            engineResults.rrsp            = analyzeRrsp(rrspInputs);
    if (wanted.includes("tfsa"))            engineResults.tfsa            = analyzeTfsa(tfsaInputs);
    if (wanted.includes("capitalGains"))    engineResults.capitalGains    = analyzeCapitalGains(cgInputs);
    if (wanted.includes("incomeSplitting")) engineResults.incomeSplitting = analyzeIncomeSplitting(isInputs);
    if (wanted.includes("insurance"))       engineResults.insurance       = analyzeInsurance(insInputs);
    if (wanted.includes("education") && eduInputs.children.length > 0)
                                            engineResults.education       = analyzeEducation(eduInputs);
    if (wanted.includes("estate"))          engineResults.estate          = analyzeEstate(estInputs);
    if (wanted.includes("debt") && debtRows.length > 0)
                                            engineResults.debt            = analyzeDebt(debtInputs);

    const reportInputs = {
      meta,
      ...(engineResults.retirement      ? { retirement:      retInputs  } : {}),
      ...(engineResults.tax             ? { tax:             taxInputs  } : {}),
      ...(engineResults.rrsp            ? { rrsp:            rrspInputs } : {}),
      ...(engineResults.tfsa            ? { tfsa:            tfsaInputs } : {}),
      ...(engineResults.capitalGains    ? { capitalGains:    cgInputs   } : {}),
      ...(engineResults.incomeSplitting ? { incomeSplitting: isInputs   } : {}),
      ...(engineResults.insurance       ? { insurance:       insInputs  } : {}),
      ...(engineResults.education       ? { education:       eduInputs  } : {}),
      ...(engineResults.estate          ? { estate:          estInputs  } : {}),
      ...(engineResults.debt            ? { debt:            debtInputs } : {}),
    };

    const html = generateComprehensiveReport(reportInputs as any, engineResults);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="financial-plan-${clientId}.html"`);
    return res.send(html);

  } catch (err: any) {
    logger.error("[planning] report error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/planning/summary/:clientId — JSON summary of available data ──────
planningRouter.get("/summary/:clientId", async (req: AuthRequest, res: Response) => {
  try {
    const userId   = req.userId!;
    const clientId = parseInt(req.params.clientId, 10);

    const people = await loadClientAndAdvisor(userId, clientId);
    if (!people) return res.status(404).json({ error: "Client not found" });

    const [retRow] = await db
      .select({ id: retirementProjections.id })
      .from(retirementProjections)
      .where(eq(retirementProjections.clientId, clientId))
      .limit(1);

    const eduRows  = await db.select({ id: educationSavings.id }).from(educationSavings).where(eq(educationSavings.clientId, clientId));
    const debtRows = await db.select({ id: debtEntries.id }).from(debtEntries).where(eq(debtEntries.clientId, clientId));

    return res.json({
      client:      people.client,
      hasPlanData: {
        retirement: !!retRow,
        education:  eduRows.length > 0,
        debt:       debtRows.length > 0,
      },
      sections: ["retirement","tax","rrsp","tfsa","capitalGains","incomeSplitting","insurance","education","estate","debt"],
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
}
