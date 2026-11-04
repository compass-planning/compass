/**
 * server/schemas/index.ts
 *
 * Shared Zod schemas and validate() middleware for Compass CRM API routes.
 *
 * Usage:
 *   import { validate, loginSchema } from "../schemas";
 *
 *   app.post("/api/auth/login", validate(loginSchema), async (req, res) => {
 *     const { email, password } = req.body; // fully typed and validated
 *   });
 *
 * validate() returns a 400 with structured errors if validation fails.
 * On success it replaces req.body with the parsed (coerced) data so downstream
 * code can trust the types without further checks.
 */

import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

// ── Validate middleware factory ────────────────────────────────────────────────
export function validate<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        message: "Validation error",
        errors: result.error.issues.map((issue) => ({
          field:   issue.path.join(".") || "body",
          message: issue.message,
        })),
      });
    }
    // Replace req.body with coerced, validated data
    (req as any).body = result.data;
    return next();
  };
}

// ── Re-usable field types ─────────────────────────────────────────────────────
const email    = z.string().email("Invalid email address").toLowerCase().trim();
const name     = z.string().min(1).max(100).trim();
const optName  = z.string().max(100).trim().optional();
const optStr   = z.string().max(500).trim().optional();
const province = z.enum(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]).optional();
const phone    = z.string().max(30).trim().optional();
const dateStr  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD").optional();
const posNum   = z.coerce.number().min(0).optional();
const posInt   = z.coerce.number().int().min(0).optional();
const pct      = z.coerce.number().min(0).max(100).optional();
const age      = z.coerce.number().int().min(18).max(120);
const optAge   = z.coerce.number().int().min(0).max(120).optional();

// ── Auth schemas ───────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email:    email,
  password: z.string().min(1, "Password is required").max(200),
});

export const registerSchema = z.object({
  companyName: z.string().min(1, "Company name is required").max(200).trim(),
  firstName:   name,
  lastName:    name,
  email:       email,
  password:    z.string().min(12, "Password must be at least 12 characters").max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required").max(200),
  newPassword:     z.string().min(12, "New password must be at least 12 characters").max(200),
});

export const mfaTokenSchema = z.object({
  token: z.string().min(6).max(8).regex(/^\d+$/, "TOTP code must be digits only"),
});

export const mfaRecoverySchema = z.object({
  code: z.string().min(1, "Recovery code is required").max(20).trim(),
});

// ── Client schemas ─────────────────────────────────────────────────────────────
export const createClientSchema = z.object({
  firstName:        name,
  lastName:         name,
  email:            email.optional(),
  phone:            phone,
  dateOfBirth:      dateStr,
  province:         province,
  occupation:       optStr,
  spouseFirstName:  optName,
  spouseLastName:   optName,
  spouseDateOfBirth: dateStr,
  notes:            z.string().max(5000).trim().optional(),
  status:           z.enum(["active","inactive","prospect","lead"]).optional(),
  advisorId:        z.coerce.number().int().positive().optional(),
});

export const updateClientSchema = createClientSchema.partial();

// ── Net worth schemas ──────────────────────────────────────────────────────────
export const netWorthEntrySchema = z.object({
  label:       z.string().min(1).max(200).trim(),
  value:       z.coerce.number().min(-999_999_999).max(999_999_999),
  type:        z.enum(["asset","liability"]),
  category:    z.string().max(100).trim().optional(),
  accountType: z.string().max(100).trim().optional(),
  institution: z.string().max(200).trim().optional(),
  notes:       z.string().max(1000).trim().optional(),
  // Allow extra fields — safe() will strip server-managed ones
}).passthrough();

// ── Retirement schemas ─────────────────────────────────────────────────────────
export const retirementProjectionSchema = z.object({
  currentAge:             age,
  retirementAge:          age,
  lifeExpectancy:         age,
  currentSavings:         posNum,
  annualContribution:     posNum,
  expectedReturn:         pct,
  inflationRate:          pct,
  desiredRetirementIncome: posNum,
  cppMonthly:             posNum,
  oasMonthly:             posNum,
  cppStartAge:            optAge,
  oasStartAge:            optAge,
  province:               province,
  notes:                  z.string().max(2000).trim().optional(),
}).passthrough();

export const retirementPatchSchema = retirementProjectionSchema.partial();

// ── Insurance schemas ──────────────────────────────────────────────────────────
export const insuranceSchema = z.object({
  type:             z.string().max(100).trim().optional(),
  provider:         z.string().max(200).trim().optional(),
  policyNumber:     z.string().max(100).trim().optional(),
  coverageAmount:   posNum,
  premium:          posNum,
  premiumFrequency: z.enum(["monthly","quarterly","semi-annual","annual"]).optional(),
  inforceDate:      dateStr,
  renewalDate:      dateStr,
  insured:          z.string().max(200).trim().optional(),
  beneficiary:      z.string().max(200).trim().optional(),
  notes:            z.string().max(2000).trim().optional(),
}).passthrough();

export const insurancePatchSchema = insuranceSchema.partial();

// ── Debt schemas ───────────────────────────────────────────────────────────────
export const debtEntrySchema = z.object({
  label:          z.string().min(1).max(200).trim(),
  balance:        z.coerce.number().min(0).max(999_999_999),
  interestRate:   pct,
  monthlyPayment: posNum,
  type:           z.string().max(100).trim().optional(),
  lender:         z.string().max(200).trim().optional(),
  maturityDate:   dateStr,
  notes:          z.string().max(1000).trim().optional(),
}).passthrough();

export const debtPatchSchema = debtEntrySchema.partial();

// ── Tax schemas ────────────────────────────────────────────────────────────────
export const taxPlanningSchema = z.object({
  year:                 z.coerce.number().int().min(2000).max(2100).optional(),
  employmentIncome:     posNum,
  selfEmploymentIncome: posNum,
  capitalGains:         z.coerce.number().min(-999_999_999).max(999_999_999).optional(),
  rrspDeduction:        posNum,
  province:             province,
  filingStatus:         z.enum(["single","married","commonlaw"]).optional(),
  notes:                z.string().max(5000).trim().optional(),
}).passthrough();

export const taxPatchSchema = taxPlanningSchema.partial();

// ── Education / RESP schemas ───────────────────────────────────────────────────
export const educationSchema = z.object({
  childName:          z.string().max(200).trim().optional(),
  targetYear:         posInt,
  annualCost:         posNum,
  currentSavings:     posNum,
  annualContribution: posNum,
  province:           province,
  notes:              z.string().max(1000).trim().optional(),
}).passthrough();

export const educationPatchSchema = educationSchema.partial();

// ── Estate schemas ─────────────────────────────────────────────────────────────
export const estateSchema = z.object({
  willInPlace:         z.boolean().optional(),
  poaInPlace:          z.boolean().optional(),
  estateValue:         posNum,
  probateFees:         posNum,
  taxLiability:        posNum,
  executorName:        z.string().max(200).trim().optional(),
  notes:               z.string().max(5000).trim().optional(),
}).passthrough();

// ── Simulation schema ──────────────────────────────────────────────────────────
export const simulationSchema = z.object({
  simulations:        z.coerce.number().int().min(100).max(10000).default(1000),
  equityAllocation:   pct,
  equityReturn:       pct,
  bondReturn:         pct,
  inflationRate:      pct,
  lifeExpectancy:     optAge,
}).passthrough();

// ── AI report schema ───────────────────────────────────────────────────────────
export const aiReportSchema = z.object({
  simulationResult:  z.object({
    successRate:              z.number().min(0).max(1),
    simulationCount:          z.number().int().min(1),
    finalBalancePercentiles:  z.object({
      p10: z.number(), p25: z.number(), p50: z.number(),
      p75: z.number(), p90: z.number(),
    }),
  }).optional(),
  equityAllocation: pct,
  equityReturn:     pct,
  bondReturn:       pct,
  inflationRate:    pct,
  lifeExpectancy:   optAge,
}).passthrough();

// ── Activity / note schemas ────────────────────────────────────────────────────
export const activitySchema = z.object({
  type:    z.string().min(1).max(100).trim(),
  notes:   z.string().max(5000).trim().optional(),
  date:    dateStr,
}).passthrough();

// ── Document schema ────────────────────────────────────────────────────────────
export const documentSchema = z.object({
  name:     z.string().min(1).max(200).trim(),
  type:     z.string().max(100).trim().optional(),
  url:      z.string().url().optional(),
  notes:    z.string().max(1000).trim().optional(),
}).passthrough();
