/**
 * SCHEMA ADDITIONS — add these to shared/schema.ts
 * ===================================================
 *
 * This file documents EXACTLY what to add/change in shared/schema.ts.
 * It is NOT imported anywhere — it is a reference patch document.
 *
 * ── STEP 1 ─────────────────────────────────────────────────────────────────
 * REMOVE this line (line 9 currently):
 *
 *   export * from "./models/auth";
 *
 * Replace with a direct import where sessions is actually needed
 * (server/auth/session.ts):
 *
 *   import { sessions } from "@shared/models/auth";
 *
 * Reason: the barrel re-export causes reconcile-schema to see the sessions
 * table as part of the managed schema and tries to recreate / alter it,
 * which conflicts with the connect-pg-simple session store.
 *
 * ── STEP 2 ─────────────────────────────────────────────────────────────────
 * ADD these three columns to the staff pgTable, after lastLoginAt:
 */

// ── MFA columns (already in DB via migration — must match or will be dropped) ─
//   mfaEnabled:    boolean("mfa_enabled").notNull().default(false),
//   totpSecret:    text("totp_secret"),
//   mfaEnrolledAt: timestamp("mfa_enrolled_at"),

/**
 * ── STEP 3 ─────────────────────────────────────────────────────────────────
 * ADD preferred_language to staff pgTable, after mfaEnrolledAt:
 */

//   preferredLanguage: text("preferred_language").notNull().default("en"),

/**
 * ── STEP 4 ─────────────────────────────────────────────────────────────────
 * ADD defaultLanguage to companies pgTable, after createdAt:
 */

//   defaultLanguage: text("default_language").notNull().default("en"),

/**
 * ── FINAL FORM — staff pgTable tail (after lastLoginAt): ───────────────────
 *
 *   lastLoginAt:       timestamp("last_login_at"),
 *   mfaEnabled:        boolean("mfa_enabled").notNull().default(false),
 *   totpSecret:        text("totp_secret"),
 *   mfaEnrolledAt:     timestamp("mfa_enrolled_at"),
 *   preferredLanguage: text("preferred_language").notNull().default("en"),
 *   createdAt:         timestamp("created_at").defaultNow(),
 *
 * ── FINAL FORM — companies pgTable tail: ───────────────────────────────────
 *
 *   contactName:      text("contact_name"),
 *   billingEmail:     text("billing_email"),
 *   corporateAddress: text("corporate_address"),
 *   corporatePhone:   text("corporate_phone"),
 *   defaultLanguage:  text("default_language").notNull().default("en"),
 *   createdAt:        timestamp("created_at").defaultNow(),
 */

// ── MIGRATION SQL (run via flyctl proxy before next deploy) ─────────────────
//
// Run against the Compass CRM database (schema "crm"):
//
//   ALTER TABLE staff
//     ADD COLUMN IF NOT EXISTS mfa_enabled        BOOLEAN   NOT NULL DEFAULT FALSE,
//     ADD COLUMN IF NOT EXISTS totp_secret         TEXT,
//     ADD COLUMN IF NOT EXISTS mfa_enrolled_at     TIMESTAMP,
//     ADD COLUMN IF NOT EXISTS preferred_language  TEXT      NOT NULL DEFAULT 'en';
//
//   ALTER TABLE companies
//     ADD COLUMN IF NOT EXISTS default_language    TEXT      NOT NULL DEFAULT 'en';
//
// Verify mfa_recovery_codes exists (do NOT add to Drizzle schema):
//   SELECT COUNT(*) FROM mfa_recovery_codes;
//   -- If 0 rows returned with error: table does not exist, create it:
//   CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
//     id         SERIAL PRIMARY KEY,
//     staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
//     code_hash  TEXT NOT NULL,
//     used       BOOLEAN NOT NULL DEFAULT FALSE,
//     used_at    TIMESTAMP,
//     created_at TIMESTAMP DEFAULT NOW()
//   );

export {};
