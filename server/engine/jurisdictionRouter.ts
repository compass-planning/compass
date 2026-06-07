/**
 * jurisdictionRouter.ts
 * Routes financial planning calculations to the correct jurisdiction engine
 * based on the client's `jurisdiction` flag ('CA' | 'US').
 *
 * Usage in route handlers:
 *   const result = projectForClient(client, planProfile);
 */

import { projectTaxYears }   from "./tax/index.js";
import { projectUsTaxYears } from "./tax/usProjector.js";
import type { TaxProjectionProfile, TaxYearProjection } from "./tax/types.js";
import type { UsTaxProjectionProfile, UsTaxYearProjection } from "./tax/usTypes.js";

export type Jurisdiction = "CA" | "US";

export type JurisdictionProjectionResult =
  | { jurisdiction: "CA"; rows: TaxYearProjection[] }
  | { jurisdiction: "US"; rows: UsTaxYearProjection[] };

export function projectByJurisdiction(
  jurisdiction: Jurisdiction,
  profile: TaxProjectionProfile | UsTaxProjectionProfile,
): JurisdictionProjectionResult {
  if (jurisdiction === "US") {
    return {
      jurisdiction: "US",
      rows: projectUsTaxYears(profile as UsTaxProjectionProfile),
    };
  }
  return {
    jurisdiction: "CA",
    rows: projectTaxYears(profile as TaxProjectionProfile),
  };
}

/**
 * ── SCHEMA PATCH INSTRUCTIONS ──────────────────────────────────────────────
 *
 * Add the following fields to shared/schema.ts on the `clients` table:
 *
 *   jurisdiction: text("jurisdiction").notNull().default("CA"),
 *     // 'CA' = Canadian planner, 'US' = American planner
 *
 *   usState: text("us_state"),
 *     // Two-letter US state code (e.g. "CA", "TX") — null for Canadian clients
 *
 *   filingStatus: text("filing_status"),
 *     // 'single' | 'mfj' | 'mfs' | 'hoh' — null for Canadian clients
 *
 *   birthYear: integer("birth_year"),
 *     // Needed for SS FRA and RMD start age on US side
 *
 * Example Drizzle addition to clients table:
 *
 *   jurisdiction:  text("jurisdiction").notNull().default("CA"),
 *   usState:       text("us_state"),
 *   filingStatus:  text("filing_status"),
 *   birthYear:     integer("birth_year"),
 *
 * Migration SQL (run via drizzle-kit or directly):
 *
 *   ALTER TABLE clients
 *     ADD COLUMN IF NOT EXISTS jurisdiction    TEXT NOT NULL DEFAULT 'CA',
 *     ADD COLUMN IF NOT EXISTS us_state        TEXT,
 *     ADD COLUMN IF NOT EXISTS filing_status   TEXT,
 *     ADD COLUMN IF NOT EXISTS birth_year      INTEGER;
 *
 * ── ROUTE PATCH INSTRUCTIONS ────────────────────────────────────────────────
 *
 * In server/routes/tax.ts (or the relevant planning route), replace the
 * hard-coded call to projectTaxYears() with:
 *
 *   const jurisdiction = client.jurisdiction ?? "CA";
 *   const result = projectByJurisdiction(jurisdiction, profile);
 *
 *   if (result.jurisdiction === "US") {
 *     // handle US rows
 *   } else {
 *     // handle CA rows (existing logic)
 *   }
 *
 * ── UI ROUTING ──────────────────────────────────────────────────────────────
 *
 * In FinancialPlanning.tsx (or App.tsx), branch on client.jurisdiction:
 *
 *   {client.jurisdiction === "US" ? (
 *     <UsTaxProjectionTab clientId={clientId} />
 *   ) : (
 *     <TaxProjectionTab clientId={clientId} />  // existing Canadian tab
 *   )}
 *
 * The US tabs to add (parallel to existing Canadian tabs):
 *   - "401k / IRA Room"   → mirrors "RRSP Room"
 *   - "Roth / IRA"        → mirrors "TFSA Room"
 *   - "Tax Projection"    → same tab name, different engine
 *   - "Capital Gains"     → same tab, US LTCG/NIIT logic
 *   - "Social Security"   → mirrors "CPP / OAS"
 *   - "Roth Conversion"   → new; no Canadian equivalent
 */
