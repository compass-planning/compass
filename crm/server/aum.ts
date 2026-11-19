import { db } from "./db";
import { netWorthEntries, clientPolicies } from "@shared/schema";
import { inArray, and, eq, or, isNull, gte, sql } from "drizzle-orm";

const ACCOUNT_CATS = new Set(["RRSP", "TFSA", "Non-Registered"]);

/** AUM = RRSP / TFSA / Non-Registered accounts flagged "managed by Advisor / Brokerage". Everything else is not AUM. */
export function isManagedAccount(e: { type?: string | null; category?: string | null; metadata?: any }): boolean {
  const m = e.metadata && typeof e.metadata === "object" ? e.metadata : {};
  return e.type === "asset" && ACCOUNT_CATS.has(String(e.category)) && (m.managedByAdvisor === true || m.managedByAdvisor === "true");
}

export function sumAum(entries: { type?: string | null; category?: string | null; value?: any; metadata?: any }[]): number {
  return entries.filter(isManagedAccount).reduce((s, e) => s + (Number(e.value) || 0), 0);
}

export async function aumForClients(clientIds: number[]): Promise<number> {
  if (!clientIds.length) return 0;
  const rows = await db.select().from(netWorthEntries).where(inArray(netWorthEntries.clientId, clientIds));
  return sumAum(rows);
}

/** Active Policies = policies flagged "advisor is agent of record" for these clients (not past their renewal/expiry date). */
export async function activePoliciesForClients(clientIds: number[]): Promise<number> {
  if (!clientIds.length) return 0;
  const today = new Date().toISOString().slice(0, 10);
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clientPolicies)
    .where(and(
      inArray(clientPolicies.clientId, clientIds),
      eq(clientPolicies.agentOfRecord, true),
      or(isNull(clientPolicies.renewalDate), eq(clientPolicies.renewalDate, ""), gte(clientPolicies.renewalDate, today)),
    ));
  return row?.n ?? 0;
}
