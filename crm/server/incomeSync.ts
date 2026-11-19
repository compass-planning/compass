/**
 * Keeps the client profile's income fields (annualIncome / spouseAnnualIncome) and the Income Sources tab in step.
 *
 * Each profile income shows up as one "profile-synced" row in income_sources (profile_synced = 'primary' | 'spouse').
 *  - Profile -> sources: syncProfileIncome() creates / updates / removes that row.
 *  - Sources -> profile: editing or deleting the synced row writes the new amount back to the client (see routes/income.ts).
 * A manually entered employment / self-employment source for the same person is respected: no duplicate row is created,
 * so income is never counted twice.
 */
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { clients, incomeSources } from "@shared/schema";

type Owner = "primary" | "spouse";
const OWNERS: Owner[] = ["primary", "spouse"];

export function profileIncomeColumn(owner: Owner) {
  return owner === "primary" ? "annualIncome" : "spouseAnnualIncome";
}

export async function syncProfileIncome(clientId: number): Promise<void> {
  try {
    const [client] = await db.select().from(clients).where(eq(clients.id, clientId));
    if (!client) return;
    const rows = await db.select().from(incomeSources).where(eq(incomeSources.clientId, clientId));

    for (const owner of OWNERS) {
      const amount = Number(owner === "primary" ? client.annualIncome : client.spouseAnnualIncome) || 0;
      const synced = rows.find(r => (r as any).profileSynced === owner);

      if (amount <= 0) {
        if (synced) await db.delete(incomeSources).where(eq(incomeSources.id, synced.id));
        continue;
      }
      if (synced) {
        if (Number(synced.annualAmount) !== amount) {
          await db.update(incomeSources).set({ annualAmount: String(amount) }).where(eq(incomeSources.id, synced.id));
        }
        continue;
      }
      // Someone already entered this person's employment income by hand: leave it alone.
      const manual = rows.some(r => r.owner === owner && (r.sourceType === "employment" || r.sourceType === "self_employment"));
      if (manual) continue;

      const selfEmployed = owner === "primary" && /self/i.test(String(client.employmentStatus ?? ""));
      const label = owner === "primary"
        ? (client.employerName || client.occupation || "Employment income")
        : (client.spouseOccupation || "Spouse employment income");
      await db.insert(incomeSources).values({
        clientId,
        owner,
        sourceType: selfEmployed ? "self_employment" : "employment",
        label,
        annualAmount: String(amount),
        taxability: "fully_taxable",
        profileSynced: owner,
        notes: "From client profile",
      } as any);
    }
  } catch (e: any) {
    // Table or column not migrated yet: never break the profile save over this.
    console.error("[income] profile sync skipped:", e?.message ?? e);
  }
}

/** Income-tab edit / delete of a synced row flows back into the client profile. */
export async function writeBackToProfile(clientId: number, owner: string | null | undefined, amount: number | null): Promise<void> {
  if (owner !== "primary" && owner !== "spouse") return;
  const col = profileIncomeColumn(owner);
  await db.update(clients).set({ [col]: amount == null ? null : String(amount), updatedAt: new Date() } as any).where(eq(clients.id, clientId));
}
