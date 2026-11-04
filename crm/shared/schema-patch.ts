// ── SCHEMA PATCH — add these to shared/schema.ts ─────────────────────────────
//
// 1. Add to the clients pgTable definition:
//
//   usState:       text("us_state"),
//   filingStatus:  text("filing_status"),
//
// 2. Add these two new tables at the end of shared/schema.ts:

import { pgTable, serial, integer, text, boolean, decimal, jsonb, timestamp } from "drizzle-orm/pg-core";
import { clients } from "./schema"; // already imported in real file

// ── LTC Analyses ──────────────────────────────────────────────────────────────
export const ltcAnalyses = pgTable("ltc_analyses", {
  id:                  serial("id").primaryKey(),
  clientId:            integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  person:              text("person").notNull().default("primary"),
  label:               text("label"),
  currentAge:          integer("current_age").notNull().default(55),
  province:            text("province").notNull().default("ON"),
  dailyBenefit:        decimal("daily_benefit", { precision: 10, scale: 2 }).notNull().default("200"),
  poolYears:           integer("pool_years").notNull().default(5),
  eliminationDays:     integer("elimination_days").notNull().default(90),
  inflationProtection: text("inflation_protection").notNull().default("none"),
  estAnnualPremium:    decimal("est_annual_premium", { precision: 10, scale: 2 }),
  careCostInflation:   decimal("care_cost_inflation", { precision: 5, scale: 4 }).notNull().default("0.04"),
  estClaimAge:         integer("est_claim_age").notNull().default(80),
  careLevel:           text("care_level").notNull().default("semi_private"),
  hybridLifeBenefit:   decimal("hybrid_life_benefit", { precision: 10, scale: 2 }),
  hybridLtcPct:        decimal("hybrid_ltc_pct", { precision: 5, scale: 2 }),
  notes:               text("notes"),
  resultData:          jsonb("result_data"),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});
export type LtcAnalysis       = typeof ltcAnalyses.$inferSelect;
export type InsertLtcAnalysis = typeof ltcAnalyses.$inferInsert;

// ── DI Analyses ───────────────────────────────────────────────────────────────
export const diAnalyses = pgTable("di_analyses", {
  id:                    serial("id").primaryKey(),
  clientId:              integer("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  person:                text("person").notNull().default("primary"),
  label:                 text("label"),
  grossMonthlyIncome:    decimal("gross_monthly_income",    { precision: 10, scale: 2 }).notNull().default("0"),
  occupationClass:       text("occupation_class").notNull().default("3A"),
  definition:            text("definition").notNull().default("own_occ"),
  waitingPeriodDays:     integer("waiting_period_days").notNull().default(90),
  benefitPeriod:         text("benefit_period").notNull().default("age65"),
  groupDiMonthly:        decimal("group_di_monthly",        { precision: 10, scale: 2 }).notNull().default("0"),
  groupDiEmployerPaid:   boolean("group_di_employer_paid").notNull().default(true),
  individualDiMonthly:   decimal("individual_di_monthly",   { precision: 10, scale: 2 }).notNull().default("0"),
  cppDisabilityMonthly:  decimal("cpp_disability_monthly",  { precision: 10, scale: 2 }).notNull().default("0"),
  partialDisabilityPct:  decimal("partial_disability_pct",  { precision: 5,  scale: 2 }).notNull().default("0.50"),
  colaPct:               decimal("cola_pct",                { precision: 5,  scale: 4 }).notNull().default("0.02"),
  province:              text("province").notNull().default("ON"),
  notes:                 text("notes"),
  resultData:            jsonb("result_data"),
  createdAt:             timestamp("created_at").defaultNow().notNull(),
  updatedAt:             timestamp("updated_at").defaultNow().notNull(),
});
export type DiAnalysis       = typeof diAnalyses.$inferSelect;
export type InsertDiAnalysis = typeof diAnalyses.$inferInsert;
