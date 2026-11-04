/**
 * authAdapter.ts
 *
 * Planning Suite uses req.user.id as a userId that maps to the users table.
 * Compass CRM uses req.user.staffId / req.user.companyId from its own auth.
 *
 * Import these helpers in any ported PS route file instead of accessing
 * req.user directly, so both codebases stay compatible.
 */

import type { Request } from "express";

export interface BEAuthUser {
  staffId: number;
  companyId: number;
  role: string;
  isAdmin: boolean;
}

/** Get the staff ID (equivalent to PS userId) from a BE authenticated request */
export function getStaffId(req: Request): number {
  const user = (req as any).user as BEAuthUser;
  if (!user?.staffId) throw new Error("Not authenticated");
  return user.staffId;
}

/** Get the company ID from a BE authenticated request */
export function getCompanyId(req: Request): number {
  const user = (req as any).user as BEAuthUser;
  if (!user?.companyId) throw new Error("Not authenticated");
  return user.companyId;
}

/**
 * Build a companyId-scoped client ownership check.
 * In PS, clients are owned by userId. In BE, by companyId.
 * Use this when querying clients to ensure multi-tenant isolation.
 */
export function clientFilter(req: Request) {
  return { companyId: getCompanyId(req) };
}

/**
 * Verify a client belongs to the requesting advisor's company.
 * Throws if not found or not owned.
 */
export async function assertClientOwnership(
  db: any,
  clientId: number,
  req: Request
): Promise<void> {
  const { clients } = await import("../../shared/schema.js");
  const { eq, and } = await import("drizzle-orm");

  const companyId = getCompanyId(req);
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.companyId, companyId)));

  if (!client) {
    const err: any = new Error("Client not found");
    err.status = 404;
    throw err;
  }
}
