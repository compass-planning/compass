/**
 * server/fpUtils.ts
 *
 * Shared utilities for all financial planning route handlers.
 * Ownership checks are multi-tenant: a staff member can access a client
 * if they are the assigned advisor OR if they belong to the same company
 * with a manager/admin role (general_manager, advisor_admin, sales_manager).
 */

import { db } from "./db";
import { clients, financialPlans, staff } from "@shared/schema";
import { and, eq, or } from "drizzle-orm";

// Numeric columns: coerce empty string → "0" rather than null.
const ZERO_FIELDS = new Set([
  "annualContribution", "currentRrsp", "currentTfsa", "currentNonReg",
  "currentNonRegAcb", "expectedReturn", "inflationRate", "desiredIncome",
  "cppMonthly", "oasMonthly", "coverageAmount", "premium",
  "monthlyAmount", "retirementAdjustmentPct",
  "value", "balance", "rrspBalance", "tfsaBalance", "nonRegBalance",
]);

// Text columns: blank stays as empty string, not null.
const TEXT_FIELDS = new Set([
  "label", "name", "notes", "description", "type", "category", "status",
  "owner", "province", "occupation", "phone", "email", "method", "frequency",
  "premiumFrequency", "accountType", "beneficiary", "policyNumber",
  "provider", "insured", "inforceDate", "renewalDate", "relationship",
  "title", "content", "priority",
]);

/**
 * Strip server-managed fields from a client payload and coerce empty strings
 * to null (text) or "0" (numeric), preventing Drizzle insert/update errors.
 */
export function safe(body: any): Record<string, unknown> {
  const {
    _id: __id, createdAt: _createdAt, updatedAt: _updatedAt, userId: _userId,
    clientId: _clientId, planId: _planId, calculatedAt: _calculatedAt,
    ...rest
  } = body;
  for (const key of Object.keys(rest)) {
    if (rest[key] === "") {
      if (ZERO_FIELDS.has(key))       rest[key] = "0";
      else if (!TEXT_FIELDS.has(key)) rest[key] = null;
    }
  }
  return rest;
}

/**
 * Returns true if the staff member (staffId) can access the given client.
 * Access granted when:
 *   - client.advisorId === staffId, OR
 *   - staff is a manager/admin in the same company as the client
 *
 * Fails closed: a falsy/missing staffId or clientId can never match. This
 * matters because route handlers read staffId from req.userId — if that is
 * ever undefined, this returns false rather than producing ambiguous SQL.
 */
export async function ownsClient(clientId: number, staffId: number): Promise<boolean> {
  if (!staffId || !clientId) return false;

  const [member] = await db
    .select({ companyId: staff.companyId, role: staff.role })
    .from(staff)
    .where(eq(staff.id, staffId));

  if (!member) return false;

  const managerRoles = ["general_manager", "advisor_admin", "sales_manager", "office_admin"];
  const isManager = managerRoles.includes(member.role);

  const conditions: any[] = [eq(clients.advisorId, staffId)];
  if (isManager && member.companyId) {
    conditions.push(eq(clients.companyId, member.companyId));
  }

  const [c] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), or(...conditions)));

  return !!c;
}

/**
 * Returns the plan row if accessible by the staff member, or null.
 */
export async function ownsPlan(
  planId: number,
  staffId: number,
): Promise<{ id: number; clientId: number } | null> {
  if (!staffId || !planId) return null;

  const [p] = await db
    .select({ id: financialPlans.id, clientId: financialPlans.clientId })
    .from(financialPlans)
    .where(eq(financialPlans.id, planId));

  if (!p) return null;
  const canAccess = await ownsClient(p.clientId, staffId);
  return canAccess ? p : null;
}
