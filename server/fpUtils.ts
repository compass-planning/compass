/**
 * server/fpUtils.ts
 *
 * Shared utilities for financial route handlers.
 * Each user owns exactly one profile — no GA/FA hierarchy.
 */

import { db } from "./db/index.js";
import { clients, financialPlans } from "../shared/schema.js";
import { and, eq } from "drizzle-orm";

const ZERO_FIELDS = new Set([
  "annualContribution", "currentRrsp", "currentTfsa", "currentNonReg",
  "currentNonRegAcb", "expectedReturn", "inflationRate", "desiredIncome",
  "cppMonthly", "oasMonthly", "coverageAmount", "premium",
  "monthlyAmount", "retirementAdjustmentPct",
  "value", "balance", "rrspBalance", "tfsaBalance", "nonRegBalance",
]);

const TEXT_FIELDS = new Set([
  "label", "name", "notes", "description", "type", "category", "status",
  "owner", "province", "occupation", "phone", "email", "method", "frequency",
  "premiumFrequency", "accountType", "beneficiary", "policyNumber",
  "provider", "insured", "inforceDate", "renewalDate", "relationship",
  "title", "content", "priority",
]);

/**
 * Strip server-managed fields from a payload and coerce empty strings.
 */
export function safe(body: any): Record<string, unknown> {
  const { id, createdAt, updatedAt, userId, clientId, planId, calculatedAt, ...rest } = body;
  for (const key of Object.keys(rest)) {
    if (rest[key] === "") {
      if (ZERO_FIELDS.has(key))       rest[key] = "0";
      else if (!TEXT_FIELDS.has(key)) rest[key] = null;
    }
  }
  return rest;
}

/**
 * Returns true if the given clientId belongs to the authenticated userId.
 * Single-user model: each user owns exactly one profile record.
 */
export async function ownsClient(clientId: number, userId: number): Promise<boolean> {
  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, userId)));
  return !!c;
}

/**
 * Returns the plan row if it belongs to the authenticated user, or null.
 */
export async function ownsPlan(
  planId: number,
  userId: number,
): Promise<{ id: number; clientId: number } | null> {
  const [p] = await db
    .select({ id: financialPlans.id, clientId: financialPlans.clientId })
    .from(financialPlans)
    .where(and(eq(financialPlans.id, planId), eq(financialPlans.userId, userId)));
  return p ?? null;
}
