/**
 * server/lib/totp.ts
 * TOTP enroll/verify helpers and recovery code management.
 * Uses speakeasy (RFC 6238) — no external vendor, fully Canadian-resident.
 */

import speakeasy from "speakeasy";
import QRCode    from "qrcode";
import crypto    from "crypto";
import bcrypt    from "bcryptjs";

const ISSUER     = "Compass Planning";
const CODE_COUNT = 8;   // number of recovery codes issued at enroll time
const TOTP_WINDOW = 1;  // ±1 step tolerance for clock drift (~30s each side)

// ── Enroll ────────────────────────────────────────────────────────────────────

export interface EnrollResult {
  secret:        string;   // base32 — store encrypted in DB, never expose after setup
  otpauthUrl:    string;   // for QR code
  qrCodeDataUrl: string;   // base64 PNG — send to client once during setup
}

export async function generateTotpSecret(userEmail: string): Promise<EnrollResult> {
  const generated = speakeasy.generateSecret({
    name:   `${ISSUER} (${userEmail})`,
    issuer: ISSUER,
    length: 32,
  });

  const otpauthUrl    = generated.otpauth_url!;
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

  return {
    secret:        generated.base32,
    otpauthUrl,
    qrCodeDataUrl,
  };
}

// ── Verify ────────────────────────────────────────────────────────────────────

export function verifyTotpCode(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token:    token.replace(/\s/g, ""),
    window:   TOTP_WINDOW,
  });
}

// ── Recovery codes ────────────────────────────────────────────────────────────

export interface RecoveryCode {
  code:     string;  // plaintext — shown to user ONCE at enroll time
  hash:     string;  // bcrypt hash — stored in DB
  used:     boolean;
}

/** Generate a fresh set of recovery codes. Returns plaintext codes for display
 *  and hashed codes for storage. Store only the hashed version. */
export async function generateRecoveryCodes(): Promise<{ plain: string[]; hashed: RecoveryCode[] }> {
  const plain: string[]          = [];
  const hashed: RecoveryCode[]   = [];

  for (let i = 0; i < CODE_COUNT; i++) {
    // Format: XXXX-XXXX-XXXX (human readable)
    const raw  = crypto.randomBytes(6).toString("hex").toUpperCase();
    const code = `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}`;
    const hash = await bcrypt.hash(code, 10);
    plain.push(code);
    hashed.push({ code, hash, used: false });
  }

  return { plain, hashed };
}

/** Attempt to consume a recovery code. Returns the index of the matched code
 *  (so it can be marked used), or -1 if no match. */
export async function consumeRecoveryCode(
  input: string,
  codes: RecoveryCode[]
): Promise<number> {
  const normalized = input.replace(/\s|-/g, "").toUpperCase();
  for (let i = 0; i < codes.length; i++) {
    if (codes[i].used) continue;
    // Reconstruct expected format for comparison
    const candidate = `${normalized.slice(0,4)}-${normalized.slice(4,8)}-${normalized.slice(8,12)}`;
    const match = await bcrypt.compare(candidate, codes[i].hash);
    if (match) return i;
  }
  return -1;
}
