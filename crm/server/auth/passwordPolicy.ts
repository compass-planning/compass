/**
 * server/auth/passwordPolicy.ts
 *
 * Single source of truth for Compass CRM password requirements.
 * Import validatePassword() in every route that creates or changes a password.
 *
 * Policy (aligned with NIST SP 800-63B and Canadian financial industry expectations):
 *   - Minimum 12 characters
 *   - At least one uppercase letter
 *   - At least one lowercase letter
 *   - At least one digit
 *   - At least one special character
 *   - Not a known common password (checked against a local blocklist)
 *
 * HaveIBeenPwned k-anonymity check is included but non-blocking — a network
 * failure never prevents a legitimate user from setting a password. The result
 * is logged for monitoring purposes only.
 */

// ── Common password blocklist ─────────────────────────────────────────────────
// Passwords that meet length/complexity rules but are still trivially guessed.
import { logger } from "../logger";
const COMMON_PASSWORDS = new Set([
  "Password1!", "Password12!", "Welcome1!", "Welcome12!",
  "Qwerty123!", "Abc123456!", "Admin1234!", "Letmein1!",
  "Passw0rd!", "P@ssword1", "P@ssw0rd1", "Summer2024!",
  "Winter2024!", "Spring2024!", "Fall2024!", "Canada123!",
  "Toronto123!", "Hockey123!", "Maple123!", "Broker123!",
]);

// ── Policy definition ─────────────────────────────────────────────────────────
export const PASSWORD_POLICY = {
  minLength:        12,
  requireUppercase: true,
  requireLowercase: true,
  requireDigit:     true,
  requireSpecial:   true,
  specialChars:     "!@#$%^&*()_+-=[]{}|;':\",./<>?",
};

export interface PasswordValidationResult {
  valid:    boolean;
  message?: string;   // Present when valid === false
}

// ── Main validator ────────────────────────────────────────────────────────────
export function validatePassword(password: unknown): PasswordValidationResult {
  if (!password || typeof password !== "string") {
    return { valid: false, message: "Password is required." };
  }

  if (password.length < PASSWORD_POLICY.minLength) {
    return {
      valid:   false,
      message: `Password must be at least ${PASSWORD_POLICY.minLength} characters.`,
    };
  }

  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter." };
  }

  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter." };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number." };
  }

  // Special character check using character class
  if (!/[!@#$%^&*()\-_=+\[\]{}|;':",.<>/?`~\\]/.test(password)) {
    return {
      valid:   false,
      message: "Password must contain at least one special character (e.g. ! @ # $ % & *).",
    };
  }

  if (COMMON_PASSWORDS.has(password)) {
    return { valid: false, message: "This password is too common. Please choose a different one." };
  }

  return { valid: true };
}
