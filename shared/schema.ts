import { pgTable, serial, text, integer, boolean, timestamp, jsonb, decimal, real, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const financialGoals = pgTable("financial_goals", {
  id:            serial("id").primaryKey(),
  clientId:      integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  goalType:      text("goal_type").notNull().default("custom"),
  title:         text("title").notNull(),
  targetAmount:  decimal("target_amount", { precision: 15, scale: 2 }),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }),
  targetDate:    text("target_date"),
  status:        text("status").notNull().default("in_progress"),
  notes:         text("notes"),
  // ── Projection fields ──────────────────────────────────────────────────
  // cashflowType: how this goal affects the plan cashflow
  //   "outflow"          = one-time spend (cottage, car, renovation)
  //   "inflow"           = one-time receipt (inheritance, bonus, sale)
  //   "savings_target"   = accumulation goal (RESP, emergency fund, down payment)
  //   "recurring_expense"= annual extra spend for N years (travel, sabbatical)
  cashflowType:        text("cashflow_type").default("savings_target"),
  targetYear:          integer("target_year"),          // calendar year goal hits
  projectionImpact:    boolean("projection_impact").default(false), // inject into Monte Carlo
  priority:            integer("priority").default(3),  // 1=critical, 5=nice-to-have
  monthlyContribution: decimal("monthly_contribution", { precision: 15, scale: 2 }), // savings toward goal
  inflationAdjust:     boolean("inflation_adjust").default(true),
  startYear:           integer("start_year"),           // for recurring_expense
  endYear:             integer("end_year"),              // for recurring_expense
  annualAmount:        decimal("annual_amount", { precision: 15, scale: 2 }), // for recurring_expense
  fundingSource:       text("funding_source").default("non_reg"), // non_reg|tfsa|rrsp|automatic


  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName:    text("first_name").notNull(),
  lastName:     text("last_name").notNull(),
  firmName:     text("firm_name"),
  jurisdiction: text("jurisdiction").notNull().default("CA"),
  firebaseUid:        text("firebase_uid").unique(),
  mustResetPassword:  boolean("must_reset_password").default(false),
  phone:              text("phone"),
  // ── Address ──────────────────────────────────────────────────────────────
  address:            text("address"),
  city:               text("city"),
  province:           text("province"),
  usState:            text("us_state"),
  postalCode:         text("postal_code"),
  // ── Subscription ─────────────────────────────────────────────────────────
  subscriptionTier:   text("subscription_tier").notNull().default("trial"),   // "trial" | "monthly" | "annual"
  subscriptionStatus: text("subscription_status").notNull().default("trialing"), // "trialing" | "active" | "past_due" | "canceled"
  stripeCustomerId:   text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  trialEndsAt:        timestamp("trial_ends_at"),
  currentPeriodEnd:   timestamp("current_period_end"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, passwordHash: true, firebaseUid: true, createdAt: true, updatedAt: true,
          stripeCustomerId: true, stripeSubscriptionId: true, trialEndsAt: true, currentPeriodEnd: true })
  .extend({ password: z.string().min(8).optional() });
export type User = typeof users.$inferSelect;

// ── Clients ───────────────────────────────────────────────────────────────────
export const clients = pgTable("clients", {
  id:                          serial("id").primaryKey(),
  userId:                      integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  firstName:                   text("first_name").notNull(),
  lastName:                    text("last_name").notNull(),
  email:                       text("email"),
  phone:                       text("phone"),
  dateOfBirth:                 text("date_of_birth"),
  province:                    text("province").default("ON"),
  occupation:                  text("occupation"),
  employmentStatus:            text("employment_status"),
  annualIncome:                decimal("annual_income", { precision: 15, scale: 2 }),
  retirementAge:               integer("retirement_age"),
  desiredRetirementIncome:     decimal("desired_retirement_income", { precision: 15, scale: 2 }),
  pensionType:                 text("pension_type"),
  spouseFirstName:             text("spouse_first_name"),
  spouseLastName:              text("spouse_last_name"),
  spouseDateOfBirth:           text("spouse_date_of_birth"),
  spouseOccupation:            text("spouse_occupation"),
  spouseAnnualIncome:          decimal("spouse_annual_income", { precision: 15, scale: 2 }),
  spouseRetirementAge:         integer("spouse_retirement_age"),
  spouseDesiredRetirementIncome: decimal("spouse_desired_retirement_income", { precision: 15, scale: 2 }),
  spousePensionType:           text("spouse_pension_type"),
  dependants:                  jsonb("dependants"),
  notes:                       text("notes"),
  jurisdiction:                text("jurisdiction").notNull().default("CA"),
  usState:                     text("us_state"),
  filingStatus:                text("filing_status"),
  birthYear:                   integer("birth_year"),
  createdAt:                   timestamp("created_at").defaultNow().notNull(),
  updatedAt:                   timestamp("updated_at").defaultNow().notNull(),
  preferredLanguage:           text("preferred_language").notNull().default("en"),
});

export const insertClientSchema = createInsertSchema(clients).omit({ id: true, createdAt: true, updatedAt: true });
export type Client = typeof clients.$inferSelect;

// ── Financial Plans ───────────────────────────────────────────────────────────
export const financialPlans = pgTable("financial_plans", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  userId:    integer("user_id").notNull().references(() => users.id),
  title:     text("title").notNull().default("Financial Plan"),
  status:    text("status").notNull().default("draft"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
export const plans = financialPlans; // legacy alias
export type FinancialPlan = typeof financialPlans.$inferSelect;

// ── Net Worth Entries ─────────────────────────────────────────────────────────
export const netWorthEntries = pgTable("net_worth_entries", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id"),
  type:      text("type").notNull(), // "asset" | "liability"
  category:  text("category").notNull(),
  name:      text("name").notNull(),
  value:     decimal("value", { precision: 15, scale: 2 }).notNull(),
  owner:     text("owner"),
  notes:     text("notes"),
  metadata:  jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Retirement Projections ────────────────────────────────────────────────────
export const retirementProjections = pgTable("retirement_projections", {
  id:                      serial("id").primaryKey(),
  clientId:                integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:                  integer("plan_id"),
  person:                  text("person").default("primary"),   // "primary" | "spouse"
  label:                   text("label"),
  currentAge:              integer("current_age"),
  retirementAge:           integer("retirement_age"),
  lifeExpectancy:          integer("life_expectancy"),
  currentSavings:          decimal("current_savings", { precision: 15, scale: 2 }),
  rrspBalance:             decimal("rrsp_balance", { precision: 15, scale: 2 }),
  tfsaBalance:             decimal("tfsa_balance", { precision: 15, scale: 2 }),
  nonRegBalance:           decimal("non_reg_balance", { precision: 15, scale: 2 }),
  annualContribution:      decimal("annual_contribution", { precision: 15, scale: 2 }),
  annualTfsaContribution:  decimal("annual_tfsa_contribution", { precision: 15, scale: 2 }),
  tfsaContributionsMade:   decimal("tfsa_contributions_made", { precision: 15, scale: 2 }),
  expectedReturn:          decimal("expected_return", { precision: 5, scale: 2 }),
  inflationRate:           decimal("inflation_rate", { precision: 5, scale: 2 }),
  desiredRetirementIncome: decimal("desired_retirement_income", { precision: 15, scale: 2 }),
  pensionIncome:           decimal("pension_income", { precision: 15, scale: 2 }),
  cppStartAge:             integer("cpp_start_age"),
  oasStartAge:             integer("oas_start_age"),
  cppMonthly:              decimal("cpp_monthly", { precision: 10, scale: 2 }),
  oasMonthly:              decimal("oas_monthly", { precision: 10, scale: 2 }),
  projectedBalance:        decimal("projected_balance", { precision: 15, scale: 2 }),
  shortfallSurplus:        decimal("shortfall_surplus", { precision: 15, scale: 2 }),
  successRate:             decimal("success_rate", { precision: 5, scale: 2 }),
  notes:                   text("notes"),
  createdAt:               timestamp("created_at").defaultNow().notNull(),
  updatedAt:               timestamp("updated_at").defaultNow().notNull(),
});

// ── Insurance Analyses ────────────────────────────────────────────────────────
export const insuranceAnalyses = pgTable("insurance_analyses", {
  id:                           serial("id").primaryKey(),
  clientId:                     integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  method:                       text("method"),
  primaryName:                  text("primary_name"),
  primaryAge:                   integer("primary_age"),
  spouseName:                   text("spouse_name"),
  spouseAge:                    integer("spouse_age"),
  annualIncome:                 decimal("annual_income", { precision: 15, scale: 2 }),
  spouseAnnualIncome:           decimal("spouse_annual_income", { precision: 15, scale: 2 }),
  yearsToReplace:               integer("years_to_replace"),
  existingLifeCoverage:         decimal("existing_life_coverage", { precision: 15, scale: 2 }),
  existingDisability:           decimal("existing_disability", { precision: 15, scale: 2 }),
  existingCriticalIllness:      decimal("existing_critical_illness", { precision: 15, scale: 2 }),
  recommendedLife:              decimal("recommended_life", { precision: 15, scale: 2 }),
  recommendedDisability:        decimal("recommended_disability", { precision: 15, scale: 2 }),
  recommendedCriticalIllness:   decimal("recommended_critical_illness", { precision: 15, scale: 2 }),
  recommendedDisabilityCoverage: decimal("recommended_disability_coverage", { precision: 15, scale: 2 }),
  criticalIllnessLumpSum:       decimal("critical_illness_lump_sum", { precision: 15, scale: 2 }),
  lifeGap:                      decimal("life_gap", { precision: 15, scale: 2 }),
  disabilityGap:                decimal("disability_gap", { precision: 15, scale: 2 }),
  criticalIllnessGap:           decimal("critical_illness_gap", { precision: 15, scale: 2 }),
  worksheetData:                jsonb("worksheet_data"),
  notes:                        text("notes"),
  createdAt:                    timestamp("created_at").defaultNow().notNull(),
  updatedAt:                    timestamp("updated_at").defaultNow().notNull(),
});

// ── Education Savings ─────────────────────────────────────────────────────────
export const educationSavings = pgTable("education_savings", {
  id:                  serial("id").primaryKey(),
  clientId:            integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  childName:           text("child_name").notNull(),
  childDob:            text("child_dob"),
  childAge:            integer("child_age"),
  targetAge:           integer("target_age"),
  currentRespBalance:  decimal("current_resp_balance", { precision: 15, scale: 2 }),
  annualContribution:  decimal("annual_contribution", { precision: 15, scale: 2 }),
  monthlyContribution: decimal("monthly_contribution", { precision: 10, scale: 2 }),
  expectedReturn:      decimal("expected_return", { precision: 5, scale: 2 }),
  targetAmount:        decimal("target_amount", { precision: 15, scale: 2 }),
  estimatedCost:       decimal("estimated_cost", { precision: 15, scale: 2 }),
  projectedBalance:    decimal("projected_balance", { precision: 15, scale: 2 }),
  cespGrant:           decimal("cesp_grant", { precision: 10, scale: 2 }),
  accountType:         text("account_type").default("RESP"),
  notes:               text("notes"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});
export const educationPlans = educationSavings; // legacy alias

// ── Debt Entries ──────────────────────────────────────────────────────────────
export const debtEntries = pgTable("debt_entries", {
  id:             serial("id").primaryKey(),
  clientId:       integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  name:           text("name").notNull(),
  category:       text("category").notNull(),
  balance:        decimal("balance", { precision: 15, scale: 2 }).notNull(),
  interestRate:   decimal("interest_rate", { precision: 5, scale: 2 }),
  minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
  payoffStrategy: text("payoff_strategy"),
  term:           text("term"),
  priority:       integer("priority"),
  notes:          text("notes"),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
  updatedAt:      timestamp("updated_at").defaultNow().notNull(),
});

// ── Tax Planning Notes ────────────────────────────────────────────────────────
export const taxPlanningNotes = pgTable("tax_planning_notes", {
  id:              serial("id").primaryKey(),
  clientId:        integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  taxYear:         integer("tax_year"),
  category:        text("category"),
  title:           text("title").notNull(),
  content:         text("content").notNull(),
  actionRequired:  boolean("action_required").default(false),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});
export const taxNotes = taxPlanningNotes; // legacy alias

// ── Estate Planning Notes ─────────────────────────────────────────────────────
export const estatePlanningNotes = pgTable("estate_planning_notes", {
  id:                 serial("id").primaryKey(),
  clientId:           integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId: integer("plan_id"),
  category:           text("category"),
  title:              text("title").notNull(),
  content:            text("content").notNull(),
  documentReference:  text("document_reference"),
  createdAt:          timestamp("created_at").defaultNow().notNull(),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});
export const estateNotes = estatePlanningNotes; // legacy alias

// ── AI Recommendations ────────────────────────────────────────────────────────
export const aiRecommendations = pgTable("ai_recommendations", {
  id:          serial("id").primaryKey(),
  clientId:    integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:      integer("plan_id"),
  runId:       text("run_id"),       // ISO timestamp — groups all recs from one generate call
  category:    text("category").notNull(),
  priority:    text("priority").notNull().default("medium"),
  title:       text("title").notNull(),
  content:     text("content"),
  description: text("description"),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// ── Client Policies ───────────────────────────────────────────────────────────
export const clientPolicies = pgTable("client_policies", {
  id:               serial("id").primaryKey(),
  clientId:         integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type:             text("type").notNull(),
  policyNumber:     text("policy_number"),
  provider:         text("provider"),
  insured:          text("insured"),
  coverageAmount:   decimal("coverage_amount", { precision: 15, scale: 2 }),
  premium:          decimal("premium", { precision: 10, scale: 2 }),
  premiumFrequency: text("premium_frequency"),
  inforceDate:      text("inforce_date"),
  renewalDate:      text("renewal_date"),
  beneficiary:      text("beneficiary"),
  notes:            text("notes"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
  updatedAt:        timestamp("updated_at").defaultNow().notNull(),
});

/// ── Household Expenses ────────────────────────────────────────────────────────
export const householdExpenses = pgTable("household_expenses", {
  id:                      serial("id").primaryKey(),
  clientId:                integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  category:                text("category").notNull(),
  description:             text("description"),
  monthlyAmount:           decimal("monthly_amount", { precision: 10, scale: 2 }),
  annualAmount:            decimal("annual_amount", { precision: 15, scale: 2 }),
  frequency:               text("frequency"),
  isEssential:             boolean("is_essential").default(true),
  includeInRetirement:     boolean("include_in_retirement").default(true),
  retirementAdjustmentPct: integer("retirement_adjustment_pct").default(100),
  notes:                   text("notes"),
  createdAt:               timestamp("created_at").defaultNow().notNull(),
  updatedAt:               timestamp("updated_at").defaultNow().notNull(),
});

// ── Simulations ───────────────────────────────────────────────────────────────
export const simulations = pgTable("simulations", {
  id:              serial("id").primaryKey(),
  clientId:        integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  successRate:     decimal("success_rate", { precision: 5, scale: 2 }),
  medianOutcome:   decimal("median_outcome", { precision: 15, scale: 2 }),
  worstCase:       decimal("worst_case", { precision: 15, scale: 2 }),
  bestCase:        decimal("best_case", { precision: 15, scale: 2 }),
  parameters:      jsonb("parameters"),
  results:         jsonb("results"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

// ── Plan Assumptions ──────────────────────────────────────────────────────────
export const planAssumptions = pgTable("plan_assumptions", {
  id:                  serial("id").primaryKey(),
  planId:              integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  scenario:            text("scenario").notNull().default("base"),
  equityReturn:        decimal("equity_return", { precision: 6, scale: 4 }),
  equityVolatility:    decimal("equity_volatility", { precision: 6, scale: 4 }),
  bondReturn:          decimal("bond_return", { precision: 6, scale: 4 }),
  bondVolatility:      decimal("bond_volatility", { precision: 6, scale: 4 }),
  inflationMean:       decimal("inflation_mean", { precision: 6, scale: 4 }),
  inflationVolatility: decimal("inflation_volatility", { precision: 6, scale: 4 }),
  corrEquityBond:      decimal("corr_equity_bond", { precision: 6, scale: 4 }),
  corrEquityInflation: decimal("corr_equity_inflation", { precision: 6, scale: 4 }),
  corrBondInflation:   decimal("corr_bond_inflation", { precision: 6, scale: 4 }),
  planToAge:           integer("plan_to_age").default(95),
  simulationCount:     integer("simulation_count").default(1000),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});

// ── Simulation Results ────────────────────────────────────────────────────────
export const simulationResults = pgTable("simulation_results", {
  id:                 serial("id").primaryKey(),
  planId:             integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  scenario:           text("scenario").notNull(),
  module:             text("module"),
  successRate:        decimal("success_rate", { precision: 5, scale: 2 }),
  medianOutcome:      decimal("median_outcome", { precision: 15, scale: 2 }),
  percentile10:       decimal("percentile_10", { precision: 15, scale: 2 }),
  percentile90:       decimal("percentile_90", { precision: 15, scale: 2 }),
  paths:              jsonb("paths"),
  calculatedAt:       timestamp("calculated_at").defaultNow().notNull(),
});

// ── Plan Snapshots ────────────────────────────────────────────────────────────
export const planSnapshots = pgTable("plan_snapshots", {
  id:           serial("id").primaryKey(),
  planId:       integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  snapshotData: jsonb("snapshot_data"),
  trigger:      text("trigger").default("manual"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── Plan Stale Flags ──────────────────────────────────────────────────────────
export const planStaleFlags = pgTable("plan_stale_flags", {
  id:         serial("id").primaryKey(),
  planId:     integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  module:     text("module").notNull(),
  reason:     text("reason"),
  resolvedAt: timestamp("resolved_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

// ── Plan Action Items ─────────────────────────────────────────────────────────
export const planActionItems = pgTable("plan_action_items", {
  id:          serial("id").primaryKey(),
  planId:      integer("plan_id").notNull().references(() => financialPlans.id, { onDelete: "cascade" }),
  title:       text("title").notNull(),
  description: text("description"),
  status:      text("status").default("pending"),
  dueDate:     text("due_date"),
  priority:    text("priority").default("medium"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

//── Pension Plans ────────────────────────────────────────────────────────
export const pensionPlans = pgTable("pension_plans", {
  id:                         serial("id").primaryKey(),
  clientId:                   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  pensionType:                text("pension_type").notNull().default("dbpp"),
  subscriberOwner:            text("subscriber_owner").default("primary"),
  employerName:               text("employer_name"),
  accrualRate:                decimal("accrual_rate", { precision: 5, scale: 4 }),
  yearsOfService:             decimal("years_of_service", { precision: 5, scale: 2 }),
  projectedYearsAtRetirement: decimal("projected_years_at_retirement", { precision: 5, scale: 2 }),
  bestAverageEarnings:        decimal("best_average_earnings", { precision: 15, scale: 2 }),
  currentBalance:             decimal("current_balance", { precision: 15, scale: 2 }),
  employerMatchPct:           decimal("employer_match_pct", { precision: 5, scale: 4 }),
  retirementAge:              integer("retirement_age").default(65),
  indexingType:               text("indexing_type").default("none"),
  indexingRate:               decimal("indexing_rate", { precision: 5, scale: 4 }),
  bridgeBenefit:              decimal("bridge_benefit", { precision: 15, scale: 2 }),
  bridgeBenefitEndAge:        integer("bridge_benefit_end_age").default(65),
  survivorBenefitPct:         decimal("survivor_benefit_pct", { precision: 5, scale: 4 }),
  isVested:                   boolean("is_vested").default(true),
  notes:                      text("notes"),
  createdAt:                  timestamp("created_at").defaultNow().notNull(),
  updatedAt:                  timestamp("updated_at").defaultNow().notNull(),
  });

// ── Reason Why Letters ────────────────────────────────────────────────────────
export const reasonWhyLetters = pgTable("reason_why_letters", {
  id:         serial("id").primaryKey(),
  clientId:   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  letterType: text("letter_type").notNull().default("life"),
  subject:    text("subject"),
  body:       text("body"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

// ── Insert types ──────────────────────────────────────────────────────────────
export type InsertFinancialPlan       = typeof financialPlans.$inferInsert;
export type InsertEducationSaving     = typeof educationSavings.$inferInsert;
export type InsertDebtEntry           = typeof debtEntries.$inferInsert;
export type InsertTaxPlanningNote     = typeof taxPlanningNotes.$inferInsert;
export type InsertEstatePlanningNote  = typeof estatePlanningNotes.$inferInsert;

//── Capital Gains Positions ──────────────────────────────────────────────────────────────
export const capitalGainsPositions = pgTable("capital_gains_positions", {
  id:              serial("id").primaryKey(),
  clientId:        integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  owner:           text("owner").notNull().default("primary"),   // primary | spouse | joint
  type:            text("type").notNull().default("stock"),
  symbol:          text("symbol"),
  acb:             decimal("acb", { precision: 15, scale: 2 }).default("0"),
  fmv:             decimal("fmv", { precision: 15, scale: 2 }).default("0"),
  lcgeEligible:    boolean("lcge_eligible").default(false),
  notes:           text("notes"),
  province:        text("province"),
  marginalRate:    decimal("marginal_rate", { precision: 5, scale: 2 }),
  carryForwardLoss: decimal("carry_forward_loss", { precision: 15, scale: 2 }).default("0"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const insertCapitalGainsPositionSchema = createInsertSchema(capitalGainsPositions).omit({ id: true, createdAt: true, updatedAt: true });

export const taxAnalyses = pgTable("tax_analyses", {
  id:         serial("id").primaryKey(),
  clientId:   integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  type:       text("type").notNull(),
  owner:      text("owner").notNull().default("primary"),
  label:      text("label"),
  inputData:  jsonb("input_data"),
  resultData: jsonb("result_data"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

export const goalCheckIns = pgTable("goal_check_ins", {
  id:            serial("id").primaryKey(),
  goalId:        integer("goal_id").notNull().references(() => financialGoals.id, { onDelete: "cascade" }),
  checkInDate:   date("check_in_date").notNull().defaultNow(),
  currentAmount: decimal("current_amount", { precision: 15, scale: 2 }).default("0"),
  notes:         text("notes"),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ── PIPEDA Audit Log ──────────────────────────────────────────────────────────
// Append-only record of all data access and external data transfers.
// Never deleted — 24 month minimum retention per PIPEDA breach regulations.
export const auditLog = pgTable("audit_log", {
  id:           serial("id").primaryKey(),

  // Who
  userId:       integer("user_id"),                          // null for unauthenticated events
  userEmail:    text("user_email"),                          // denormalised — preserved if user deleted

  // What
  action:       text("action").notNull(),                    // see AuditAction enum below
  resourceType: text("resource_type"),                       // "client" | "report" | "meeting" | "auth"
  resourceId:   integer("resource_id"),                      // clientId, reportId, etc.
  clientId:     integer("client_id"),                        // always set when a client is involved

  // External transfer details (PIPEDA s.10.1 — cross-border transfers)
  externalProcessor: text("external_processor"),             // "anthropic" | "openai" | null
  dataCategories:    text("data_categories"),                // comma-separated: "income,netWorth,retirement"
  purposeCode:       text("purpose_code"),                   // "financial_plan" | "meeting_summary" | "transcription" | "intake" | "needs_analysis"
  recordCount:       integer("record_count"),                // number of data points sent

  // Context
  ipAddress:    text("ip_address"),
  userAgent:    text("user_agent"),
  correlationId: text("correlation_id"),                     // matches X-Correlation-ID header
  outcome:      text("outcome").notNull().default("success"), // "success" | "error"
  errorMessage: text("error_message"),

  // Immutable timestamp — never updated
  createdAt:    timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Scenario Comparisons ──────────────────────────────────────────────────────
export const scenarioComparisons = pgTable("scenario_comparisons", {
  id:          serial("id").primaryKey(),
  clientId:    integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  label:       text("label").notNull().default("Scenario Comparison"),
  scenarioIds: integer("scenario_ids").array().notNull(),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type ScenarioComparison     = typeof scenarioComparisons.$inferSelect;
export type InsertScenarioComparison = typeof scenarioComparisons.$inferInsert;


// ── LTC Analyses ──────────────────────────────────────────────────────────────
export const ltcAnalyses = pgTable("ltc_analyses", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => financialPlans.id, { onDelete: "cascade" }),
  data:      jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── DI Analyses ───────────────────────────────────────────────────────────────
export const diAnalyses = pgTable("di_analyses", {
  id:        serial("id").primaryKey(),
  clientId:  integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:    integer("plan_id").references(() => financialPlans.id, { onDelete: "cascade" }),
  data:      jsonb("data").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Saved Reports ─────────────────────────────────────────────────────────────
export const savedReports = pgTable("saved_reports", {
  id:          serial("id").primaryKey(),
  clientId:    integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  planId:      integer("plan_id").references(() => financialPlans.id, { onDelete: "cascade" }),
  advisorId:   integer("advisor_id"),
  title:       text("title").notNull(),
  locale:      text("locale").notNull().default("en"),
  sections:    jsonb("sections").notNull().default([]),
  htmlContent: text("html_content"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});

// ── Admin ─────────────────────────────────────────────────────────────────────
export const adminUsers = pgTable("admin_users", {
  id:           serial("id").primaryKey(),
  email:        text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name:         text("name").notNull(),
  role:         text("role").notNull().default("support"), // "super" | "support"
  createdAt:    timestamp("created_at").defaultNow().notNull(),
  updatedAt:    timestamp("updated_at").defaultNow().notNull(),
});
export type AdminUser = typeof adminUsers.$inferSelect;

export const supportTickets = pgTable("support_tickets", {
  id:          serial("id").primaryKey(),
  userId:      integer("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail:   text("user_email"),
  subject:     text("subject").notNull(),
  body:        text("body").notNull(),
  status:      text("status").notNull().default("open"),   // "open" | "in_progress" | "resolved" | "closed"
  priority:    text("priority").notNull().default("normal"), // "low" | "normal" | "high" | "urgent"
  assignedTo:  integer("assigned_to").references(() => adminUsers.id, { onDelete: "set null" }),
  resolvedAt:  timestamp("resolved_at"),
  notes:       text("notes"),  // internal admin notes
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  updatedAt:   timestamp("updated_at").defaultNow().notNull(),
});
export type SupportTicket = typeof supportTickets.$inferSelect;
