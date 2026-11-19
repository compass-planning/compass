/**
 * Credit cards live in two places: a Net Worth liability (what they owe) and a Debt entry (rate, payment, payoff
 * strategy). This keeps the two in step, whichever side the advisor enters or edits them on:
 *   net_worth_entries (type liability, category "Credit Card")  <->  debt_entries (category credit_card, nw_entry_id)
 * Only credit cards are mirrored. Everything here works on one client's rows at a time.
 */
import { db } from "./db";
import { and, eq, isNull } from "drizzle-orm";
import { debtEntries, netWorthEntries } from "@shared/schema";

type NwRow = typeof netWorthEntries.$inferSelect;
type DebtRow = typeof debtEntries.$inferSelect;

export const isCreditCard = (c?: string | null) => (c ?? "").toLowerCase().replace(/[\s_-]+/g, "") === "creditcard";
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const lc = (s?: string | null) => (s ?? "").trim().toLowerCase();

/** A credit-card Net Worth liability was created / edited: create or update its Debt entry. */
export async function mirrorNwCardToDebt(nw: NwRow): Promise<void> {
  if (nw.type !== "liability" || !isCreditCard(nw.category)) { await removeDebtForNw(nw.id); return; }
  const m: any = nw.metadata ?? {};
  const vals = {
    name: nw.name,
    category: "credit_card",
    balance: String(nw.value ?? "0"),
    interestRate: String(num(m.interestRate)),
    minimumPayment: String(num(m.monthlyPayment ?? m.payment)),
    nwEntryId: nw.id,
    updatedAt: new Date(),
  };
  const [linked] = await db.select().from(debtEntries).where(eq(debtEntries.nwEntryId, nw.id));
  if (linked) {
    // Rate / payment left blank on the Net Worth side never wipe what the Debt entry already has.
    const keep: Record<string, string> = {};
    if (!(num(m.interestRate) > 0)) keep.interestRate = String(num(linked.interestRate));
    if (!(num(m.monthlyPayment ?? m.payment) > 0)) keep.minimumPayment = String(num(linked.minimumPayment));
    await db.update(debtEntries).set({ ...vals, ...keep } as any).where(eq(debtEntries.id, linked.id));
    return;
  }
  // An unlinked credit-card debt with the same name (entered before linking existed) is adopted, not duplicated.
  const loose = (await db.select().from(debtEntries).where(and(eq(debtEntries.clientId, nw.clientId), isNull(debtEntries.nwEntryId))))
    .find(d => isCreditCard(d.category) && lc(d.name) === lc(nw.name));
  if (loose) {
    // Keep whatever the older debt entry already knew (rate, payment) where Net Worth has nothing, and carry it back.
    const merged = {
      ...vals,
      interestRate: num(m.interestRate) > 0 ? vals.interestRate : String(num(loose.interestRate)),
      minimumPayment: num(m.monthlyPayment ?? m.payment) > 0 ? vals.minimumPayment : String(num(loose.minimumPayment)),
    };
    await db.update(debtEntries).set(merged as any).where(eq(debtEntries.id, loose.id));
    const [adopted] = await db.select().from(debtEntries).where(eq(debtEntries.id, loose.id));
    if (adopted) await mirrorDebtCardToNw(adopted);
    return;
  }
  await db.insert(debtEntries).values({ clientId: nw.clientId, payoffStrategy: "avalanche", ...vals } as any);
}

/** A credit-card Debt entry was created / edited: create or update its Net Worth liability. */
export async function mirrorDebtCardToNw(debt: DebtRow): Promise<void> {
  if (!isCreditCard(debt.category)) {
    if (debt.nwEntryId) { await db.update(debtEntries).set({ nwEntryId: null } as any).where(eq(debtEntries.id, debt.id)); }
    return;
  }
  const pay = num(debt.minimumPayment);
  const patchMeta = (old: any) => {
    const m: Record<string, any> = { ...(old ?? {}) };
    // A zero on the debt side never wipes a rate / payment Net Worth already has (it just means "not entered").
    if (num(debt.interestRate) > 0 || m.interestRate == null || m.interestRate === "") m.interestRate = String(num(debt.interestRate));
    if (pay > 0) { m.payment = String(pay); m.paymentFrequency = "monthly"; m.monthlyPayment = String(pay); }
    return m;
  };
  if (debt.nwEntryId) {
    const [nw] = await db.select().from(netWorthEntries).where(eq(netWorthEntries.id, debt.nwEntryId));
    if (nw && nw.clientId === debt.clientId) {
      await db.update(netWorthEntries).set({ name: debt.name, value: String(debt.balance), metadata: patchMeta(nw.metadata) } as any).where(eq(netWorthEntries.id, nw.id));
      return;
    }
  }
  // Adopt an unlinked credit-card liability with the same name, else create one.
  const taken = new Set((await db.select({ id: debtEntries.nwEntryId }).from(debtEntries).where(eq(debtEntries.clientId, debt.clientId))).map(r => r.id));
  const nws = await db.select().from(netWorthEntries).where(and(eq(netWorthEntries.clientId, debt.clientId), eq(netWorthEntries.type, "liability")));
  const loose = nws.find(n => isCreditCard(n.category) && !taken.has(n.id) && lc(n.name) === lc(debt.name));
  let nwId: number;
  if (loose) {
    await db.update(netWorthEntries).set({ value: String(debt.balance), metadata: patchMeta(loose.metadata) } as any).where(eq(netWorthEntries.id, loose.id));
    nwId = loose.id;
  } else {
    const [created] = await db.insert(netWorthEntries).values({
      clientId: debt.clientId, type: "liability", category: "Credit Card", name: debt.name,
      value: String(debt.balance), owner: "primary", notes: "Linked to Debt tab", metadata: patchMeta({}),
    } as any).returning();
    nwId = created.id;
  }
  await db.update(debtEntries).set({ nwEntryId: nwId } as any).where(eq(debtEntries.id, debt.id));
}

export async function removeDebtForNw(nwId: number): Promise<void> {
  await db.delete(debtEntries).where(eq(debtEntries.nwEntryId, nwId));
}

/** Deleting a credit-card debt removes the Net Worth liability it mirrors. */
export async function removeNwForDebt(debt: { nwEntryId: number | null; clientId: number; category: string }): Promise<void> {
  if (!debt.nwEntryId || !isCreditCard(debt.category)) return;
  const [nw] = await db.select({ id: netWorthEntries.id, clientId: netWorthEntries.clientId }).from(netWorthEntries).where(eq(netWorthEntries.id, debt.nwEntryId));
  if (nw && nw.clientId === debt.clientId) await db.delete(netWorthEntries).where(eq(netWorthEntries.id, nw.id));
}

/** Cards that exist on one side only (entered before linking, or by other code paths) get their twin on first read. */
export async function ensureCardLinks(clientId: number): Promise<void> {
  try {
    const [nws, debts] = await Promise.all([
      db.select().from(netWorthEntries).where(and(eq(netWorthEntries.clientId, clientId), eq(netWorthEntries.type, "liability"))),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId)),
    ]);
    const linkedNw = new Set(debts.map(d => d.nwEntryId).filter((x): x is number => x != null));
    for (const nw of nws) if (isCreditCard(nw.category) && !linkedNw.has(nw.id)) await mirrorNwCardToDebt(nw);
    const fresh = await db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId));
    for (const d of fresh) if (isCreditCard(d.category) && !d.nwEntryId) await mirrorDebtCardToNw(d);
  } catch (e: any) {
    console.error("[debt] card link skipped:", e?.message ?? e);
  }
}
