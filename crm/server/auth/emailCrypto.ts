/**
 * server/auth/emailCrypto.ts
 *
 * Transparent AES-256-GCM encryption for email-account secrets stored in the
 * `email_configurations.config` jsonb column (IMAP/SMTP passwords and OAuth
 * access/refresh tokens). Encryption happens at the storage boundary, so every
 * consumer (factory, providers, routes) keeps working with plaintext.
 *
 * Key management:
 *   EMAIL_ENC_KEY — any passphrase; a 32-byte key is derived from it via scrypt.
 *   In production the key MUST be set or the process throws on first use.
 *
 * Ciphertext format (string):  enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 *   - decrypt() passes through any value that does NOT start with "enc:v1:",
 *     so legacy plaintext rows keep working and get encrypted on next write.
 *   - encrypt() is idempotent: an already-encrypted value is returned unchanged.
 */

import {
  scryptSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "crypto";

const PREFIX = "enc:v1:";
// Feeds the key derivation: changing it makes every stored email credential undecryptable.
// Not secret; not user-visible.
const KDF_SALT = "compasscrm-email-v1";
const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

// Keys inside the config blob that must never be stored in plaintext.
const SENSITIVE_KEYS = ["password", "accessToken", "refreshToken"] as const;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.EMAIL_ENC_KEY;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "EMAIL_ENC_KEY is required (>=16 chars) to encrypt email credentials.",
      );
    }
    // Dev fallback so local runs without the var don't crash. NOT for prod.
    cachedKey = scryptSync("dev-only-insecure-key", KDF_SALT, 32);
    return cachedKey;
  }
  cachedKey = scryptSync(secret, KDF_SALT, 32);
  return cachedKey;
}

export function isEncrypted(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptValue(plaintext: string): string {
  if (isEncrypted(plaintext)) return plaintext; // idempotent
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ct = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptValue(value: string): string {
  if (!isEncrypted(value)) return value; // legacy plaintext — pass through
  const [, , ivB64, tagB64, ctB64] = value.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ct = Buffer.from(ctB64, "base64");
  const decipher = createDecipheriv(ALGO, getKey(), iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * Returns a shallow copy of an email-config object with sensitive string
 * fields encrypted. Safe to call on partial updates and on already-encrypted
 * objects (idempotent per field).
 */
export function encryptEmailConfig(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!config || typeof config !== "object") return config;
  const out: Record<string, unknown> = { ...config };
  for (const key of SENSITIVE_KEYS) {
    const v = out[key];
    if (typeof v === "string" && v.length > 0) out[key] = encryptValue(v);
  }
  return out;
}

/**
 * Returns a shallow copy of an email-config object with sensitive string
 * fields decrypted. Non-encrypted (legacy) values pass through untouched.
 */
export function decryptEmailConfig(
  config: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null | undefined {
  if (!config || typeof config !== "object") return config;
  const out: Record<string, unknown> = { ...config };
  for (const key of SENSITIVE_KEYS) {
    const v = out[key];
    if (typeof v === "string" && v.length > 0) {
      try {
        out[key] = decryptValue(v);
      } catch {
        // Leave as-is if it can't be decrypted (e.g. key rotation mismatch);
        // the provider will surface an auth error rather than crash the read.
      }
    }
  }
  return out;
}
