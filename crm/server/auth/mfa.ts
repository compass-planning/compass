/**
 * server/auth/mfa.ts
 *
 * TOTP MFA service for Compass CRM.
 *
 * Uses:
 *   speakeasy  — RFC 6238 TOTP generation and verification
 *   qrcode     — QR code data URL for authenticator app enrolment
 *   bcryptjs   — one-way hashing for recovery codes
 *
 * The TOTP secret is stored as a base32 string in staff.totp_secret.
 * Recovery codes are bcrypt-hashed in mfa_recovery_codes — the plain
 * codes are shown to the advisor once at enrolment and never stored.
 */

import speakeasy from "speakeasy";
import QRCode    from "qrcode";
import bcrypt    from "bcryptjs";
import crypto    from "crypto";
import { db, pool } from "../db";
import { staff }    from "@shared/schema";
import { eq }       from "drizzle-orm";

const ISSUER       = "Compass CRM"; // label shown in the authenticator app (does not affect code verification)
const WINDOW       = 1;    // Accept 1 step either side (±30 seconds drift)
const RECOVERY_COUNT = 10; // Recovery codes generated per enrolment

// ── Secret generation ─────────────────────────────────────────────────────────
export async function generateTotpSetup(
  staffId: number,
  email:   string
): Promise<{ otpauthUrl: string; qrCodeDataUrl: string; base32Secret: string }> {
  const secret = speakeasy.generateSecret({
    name:   `${ISSUER} (${email})`,
    issuer: ISSUER,
    length: 32,
  });

  // Store the pending secret on the staff record.
  // It is NOT yet active — mfa_enabled stays false until enrolment is confirmed
  // by the advisor entering a valid code (verifyAndEnrol).
  await db
    .update(staff)
    .set({ totpSecret: secret.base32 } as any)
    .where(eq(staff.id, staffId));

  const qrCodeDataUrl = await QRCode.toDataURL(secret.otpauth_url!);

  return {
    otpauthUrl:    secret.otpauth_url!,
    qrCodeDataUrl,
    base32Secret:  secret.base32,
  };
}

// ── Token verification ────────────────────────────────────────────────────────
export function verifyTotpToken(base32Secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret:   base32Secret,
    encoding: "base32",
    token:    token.replace(/\s/g, ""),
    window:   WINDOW,
  });
}

// ── Enrolment confirmation ────────────────────────────────────────────────────
// Called after the advisor scans the QR and enters their first valid code.
// Sets mfa_enabled = true and generates recovery codes.
export async function verifyAndEnrol(
  staffId: number,
  token:   string
): Promise<{ success: boolean; recoveryCodes?: string[]; message?: string }> {
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));

  if (!member || !(member as any).totpSecret) {
    return { success: false, message: "MFA setup not started. Please scan the QR code first." };
  }

  const valid = verifyTotpToken((member as any).totpSecret, token);
  if (!valid) {
    return { success: false, message: "Invalid code. Please try again." };
  }

  // Activate MFA
  await db
    .update(staff)
    .set({ mfaEnabled: true, mfaEnrolledAt: new Date() } as any)
    .where(eq(staff.id, staffId));

  // Generate and store recovery codes
  const recoveryCodes = await generateRecoveryCodes(staffId);

  return { success: true, recoveryCodes };
}

// ── Recovery codes ────────────────────────────────────────────────────────────
async function generateRecoveryCodes(staffId: number): Promise<string[]> {
  // Remove any existing recovery codes for this user
  await pool.query("DELETE FROM mfa_recovery_codes WHERE staff_id = $1", [staffId]);

  const codes: string[] = [];
  const inserts: Promise<void>[] = [];

  for (let i = 0; i < RECOVERY_COUNT; i++) {
    // Format: XXXX-XXXX-XXXX (easy to read and type)
    const plain = [
      crypto.randomBytes(2).toString("hex").toUpperCase(),
      crypto.randomBytes(2).toString("hex").toUpperCase(),
      crypto.randomBytes(2).toString("hex").toUpperCase(),
    ].join("-");

    codes.push(plain);

    const hash = await bcrypt.hash(plain, 10);
    inserts.push(
      pool
        .query(
          "INSERT INTO mfa_recovery_codes (staff_id, code_hash) VALUES ($1, $2)",
          [staffId, hash]
        )
        .then(() => undefined)
    );
  }

  await Promise.all(inserts);
  return codes; // Return plain codes — shown once, never stored again
}

// ── Recovery code verification ────────────────────────────────────────────────
export async function verifyRecoveryCode(
  staffId: number,
  code:    string
): Promise<boolean> {
  const result = await pool.query<{ id: number; code_hash: string }>(
    "SELECT id, code_hash FROM mfa_recovery_codes WHERE staff_id = $1 AND used = FALSE",
    [staffId]
  );

  for (const row of result.rows) {
    const match = await bcrypt.compare(code.trim().toUpperCase(), row.code_hash);
    if (match) {
      // Mark as used — single use only
      await pool.query(
        "UPDATE mfa_recovery_codes SET used = TRUE, used_at = NOW() WHERE id = $1",
        [row.id]
      );
      return true;
    }
  }

  return false;
}

// ── Disable MFA ───────────────────────────────────────────────────────────────
export async function disableMfa(
  staffId:  number,
  token:    string
): Promise<{ success: boolean; message?: string }> {
  const [member] = await db.select().from(staff).where(eq(staff.id, staffId));

  if (!member || !(member as any).mfaEnabled) {
    return { success: false, message: "MFA is not enabled on this account." };
  }

  const valid = verifyTotpToken((member as any).totpSecret, token);
  if (!valid) {
    return { success: false, message: "Invalid TOTP code. MFA not disabled." };
  }

  await db
    .update(staff)
    .set({ mfaEnabled: false, totpSecret: null, mfaEnrolledAt: null } as any)
    .where(eq(staff.id, staffId));

  await pool.query("DELETE FROM mfa_recovery_codes WHERE staff_id = $1", [staffId]);

  return { success: true };
}
