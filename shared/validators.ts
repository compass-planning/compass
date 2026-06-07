/**
 * shared/validators.ts
 * Centralised Zod schemas for all POST/PATCH bodies.
 * Used by server routes — import here, not inline, so validation
 * is consistent and testable.
 */
import { z } from "zod";

// ── Helpers ───────────────────────────────────────────────────────────────────
const numericString = z.string().regex(/^\d*\.?\d*$/, "Must be a number").or(z.literal(""));
const positiveNum   = z.number().nonnegative();
const province      = z.enum(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
                               "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL",
                               "IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT",
                               "NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
                               "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",""]).optional();

// ── Client ────────────────────────────────────────────────────────────────────
export const clientCreateSchema = z.object({
  firstName:               z.string().min(1, "First name is required").max(100),
  lastName:                z.string().min(1, "Last name is required").max(100),
  email:                   z.string().email("Invalid email").optional().or(z.literal("")).or(z.null()).transform(v => v ?? ""),
  phone:                   z.string().max(30).optional(),
  province:                province,
  dateOfBirth:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").optional().or(z.literal("")).or(z.null()).transform(v => v ?? ""),
  annualIncome:            z.coerce.number().nonnegative().optional().or(z.null()).transform(v => v ?? undefined),
  spouseFirstName:         z.string().max(100).optional().or(z.null()).transform(v => v ?? ""),
  spouseLastName:          z.string().max(100).optional().or(z.null()).transform(v => v ?? ""),
  spouseDateOfBirth:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).or(z.null()).transform(v => v ?? ""),
  spouseAnnualIncome:      z.coerce.number().nonnegative().optional().or(z.null()).transform(v => v ?? undefined),
  retirementAge:           z.coerce.number().int().min(40).max(90).optional().or(z.null()).transform(v => v ?? undefined),
  desiredRetirementIncome: z.coerce.number().nonnegative().optional().or(z.null()).transform(v => v ?? undefined),
  notes:                   z.string().max(5000).optional().or(z.null()).transform(v => v ?? ""),
  jurisdiction:            z.enum(["CA", "US"]).optional(),
  preferredLanguage:       z.enum(["en", "fr"]).optional(),
});

export const clientPatchSchema = clientCreateSchema.partial();

// ── Goal ──────────────────────────────────────────────────────────────────────
export const goalCreateSchema = z.object({
  clientId:            z.coerce.number().int().positive(),
  name:                z.string().min(1).max(200),
  type:                z.enum(["retirement","education","home","emergency","debt_payoff","travel","other"]),
  targetAmount:        z.coerce.number().nonnegative(),
  currentSavings:      z.coerce.number().nonnegative().optional(),
  targetDate:          z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  priority:            z.enum(["high","medium","low"]).optional(),
  status:              z.enum(["on_track","at_risk","behind","completed"]).optional(),
  notes:               z.string().max(2000).optional(),
  monthlyContribution: z.coerce.number().nonnegative().optional(),
  inflationAdjust:     z.boolean().optional(),
  startYear:           z.coerce.number().int().optional(),
  endYear:             z.coerce.number().int().optional(),
  annualAmount:        z.coerce.number().nonnegative().optional(),
  fundingSource:       z.enum(["non_reg","tfsa","rrsp","automatic"]).optional(),
});

export const goalPatchSchema = goalCreateSchema.partial();

// ── Pension ───────────────────────────────────────────────────────────────────
export const pensionCreateSchema = z.object({
  clientId:                    z.coerce.number().int().positive(),
  planName:                    z.string().min(1).max(200),
  pensionType:                 z.enum(["dbpp","dcpp","group_rrsp","prpp","other"]),
  employer:                    z.string().max(200).optional(),
  person:                      z.enum(["primary","spouse"]).optional(),
  accrualRate:                 z.coerce.number().min(0).max(5).optional(),
  projectedYearsAtRetirement:  z.coerce.number().int().min(0).max(50).optional(),
  bestAverageEarnings:         z.coerce.number().nonnegative().optional(),
  currentBalance:              z.coerce.number().nonnegative().optional(),
  annualContribution:          z.coerce.number().nonnegative().optional(),
  employerMatch:               z.coerce.number().nonnegative().optional(),
  projectedAnnualBenefit:      z.coerce.number().nonnegative().optional(),
  bridgeBenefit:               z.coerce.number().nonnegative().optional(),
  indexationRate:              z.coerce.number().min(0).max(10).optional(),
  survivorBenefit:             z.coerce.number().min(0).max(100).optional(),
  vestingYears:                z.coerce.number().int().min(0).max(30).optional(),
  notes:                       z.string().max(2000).optional(),
});

export const pensionPatchSchema = pensionCreateSchema.partial();

// ── Insurance Analysis ────────────────────────────────────────────────────────
export const insuranceCreateSchema = z.object({
  clientId:        z.coerce.number().int().positive(),
  primaryName:     z.string().max(100).optional(),
  primaryAge:      z.coerce.number().int().min(0).max(120).optional(),
  primaryAnnualIncome: z.coerce.number().nonnegative().optional(),
  spouseName:      z.string().max(100).optional(),
  spouseAge:       z.coerce.number().int().min(0).max(120).optional(),
  spouseAnnualIncome: z.coerce.number().nonnegative().optional(),
  familyMembers:   z.coerce.number().int().min(0).max(20).optional(),
  notes:           z.string().max(5000).optional(),
}).passthrough(); // allow extra fields from the complex worksheet

// ── Auth helpers (reused across auth.ts) ──────────────────────────────────────
export const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const emailSchema = z.object({
  email: z.string().email(),
});
