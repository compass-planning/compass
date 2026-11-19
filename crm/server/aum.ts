import { db } from "./db";
import { netWorthEntries } from "@shared/schema";
import { inArray } from "drizzle-orm";

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
