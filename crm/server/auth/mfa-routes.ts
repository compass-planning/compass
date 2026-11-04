/**
 * server/auth/mfa-routes.ts
 *
 * MFA endpoints — all prefixed /api/auth/mfa/
 *
 * These routes sit outside the standard isAuthenticated middleware because
 * the MFA verify step happens AFTER password auth but BEFORE isAuthenticated
 * would pass. They do their own session checks.
 *
 * Routes:
 *   GET  /api/auth/mfa/status    — is MFA enabled for the current user?
 *   GET  /api/auth/mfa/setup     — generate QR code for enrolment
 *   POST /api/auth/mfa/enrol     — confirm first TOTP code, activate MFA
 *   POST /api/auth/mfa/verify    — verify TOTP during login
 *   POST /api/auth/mfa/recover   — use a recovery code during login
 *   POST /api/auth/mfa/disable   — disable MFA (requires valid TOTP)
 */

import type { Express, Response } from "express";
import { validate, mfaTokenSchema, mfaRecoverySchema } from "../schemas";
import { db } from "../db";
import { staff } from "@shared/schema";
import { eq } from "drizzle-orm";
import { logger } from "../logger";
import {
  generateTotpSetup,
  verifyAndEnrol,
  verifyTotpToken,
  verifyRecoveryCode,
  disableMfa,
} from "./mfa";

// Require an active session (staffId present) without the full isAuthenticated
// guard — used for the MFA verify step which happens mid-login.
function requireSession(req: any, res: Response): number | null {
  const id = req.session?.staffId;
  if (!id) {
    res.status(401).json({ message: "No active session. Please log in first." });
    return null;
  }
  return id;
}

export function registerMfaRoutes(app: Express): void {

  // ── GET /api/auth/mfa/status ────────────────────────────────────────────────
  // Returns whether the current user has MFA enabled.
  // Safe to call before MFA is verified (used by the client to decide what to show).
  app.get("/api/auth/mfa/status", async (req: any, res: Response) => {
    const staffId = req.session?.staffId;
    if (!staffId) return res.status(401).json({ message: "Unauthorized" });

    try {
      const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
      if (!member) return res.status(404).json({ message: "User not found" });

      return res.json({
        mfaEnabled:    (member as any).mfaEnabled ?? false,
        mfaVerified:   req.session.mfaVerified ?? false,
        enrolledAt:    (member as any).mfaEnrolledAt ?? null,
      });
    } catch (err) {
      logger.error({ err }, "[mfa/status]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── GET /api/auth/mfa/setup ─────────────────────────────────────────────────
  // Generates a new TOTP secret and returns a QR code data URL.
  // The secret is stored on the staff record but mfa_enabled stays false
  // until /enrol confirms the first valid code.
  app.get("/api/auth/mfa/setup", async (req: any, res: Response) => {
    const staffId = requireSession(req, res);
    if (!staffId) return;

    try {
      const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
      if (!member) return res.status(404).json({ message: "User not found" });

      if ((member as any).mfaEnabled) {
        return res.status(400).json({ message: "MFA is already enabled on this account." });
      }

      const setup = await generateTotpSetup(staffId, member.email);

      // Return the QR code — the base32 secret is also returned so the advisor
      // can enter it manually if their camera doesn't work.
      return res.json({
        qrCodeDataUrl: setup.qrCodeDataUrl,
        manualEntryKey: setup.base32Secret,
        issuer: "Compass CRM",
        account: member.email,
      });
    } catch (err) {
      logger.error({ err }, "[mfa/setup]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/auth/mfa/enrol ────────────────────────────────────────────────
  // Confirms enrolment by verifying the first TOTP code.
  // Returns 10 single-use recovery codes — shown once and never again.
  app.post("/api/auth/mfa/enrol", validate(mfaTokenSchema), async (req: any, res: Response) => {
    const staffId = requireSession(req, res);
    if (!staffId) return;

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "TOTP code is required." });
    }

    try {
      const result = await verifyAndEnrol(staffId, token);

      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      // MFA is now active — mark this session as verified
      req.session.mfaEnabled  = true;
      req.session.mfaVerified = true;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err: any) => (err ? reject(err) : resolve()))
      );

      return res.json({
        message: "MFA enabled successfully.",
        recoveryCodes: result.recoveryCodes,
        warning: "Save these recovery codes somewhere safe. They will not be shown again.",
      });
    } catch (err) {
      logger.error({ err }, "[mfa/enrol]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/auth/mfa/verify ───────────────────────────────────────────────
  // Verifies the TOTP code during the login flow.
  // The session already has staffId (set during password check) but mfaVerified
  // is false — this route sets it to true on success.
  app.post("/api/auth/mfa/verify", validate(mfaTokenSchema), async (req: any, res: Response) => {
    const staffId = req.session?.staffId;
    if (!staffId) {
      return res.status(401).json({ message: "No active session. Please log in first." });
    }

    // Already verified this session — no-op
    if (req.session.mfaVerified) {
      return res.json({ verified: true });
    }

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "TOTP code is required." });
    }

    try {
      const [member] = await db.select().from(staff).where(eq(staff.id, staffId));
      if (!member) return res.status(404).json({ message: "User not found" });

      if (!(member as any).mfaEnabled || !(member as any).totpSecret) {
        // MFA not set up — pass through (shouldn't reach here normally)
        req.session.mfaVerified = true;
        await new Promise<void>((resolve, reject) =>
          req.session.save((e: any) => (e ? reject(e) : resolve()))
        );
        return res.json({ verified: true });
      }

      const valid = verifyTotpToken((member as any).totpSecret, token);
      if (!valid) {
        return res.status(401).json({ message: "Invalid code. Please try again.", verified: false });
      }

      req.session.mfaVerified = true;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err: any) => (err ? reject(err) : resolve()))
      );

      return res.json({
        verified: true,
        user: {
          id:        String(member.id),
          email:     member.email,
          firstName: member.firstName,
          lastName:  member.lastName,
        },
      });
    } catch (err) {
      logger.error({ err }, "[mfa/verify]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/auth/mfa/recover ──────────────────────────────────────────────
  // Accepts a recovery code during login when the advisor can't access their
  // authenticator app. Marks the code as used (single use).
  app.post("/api/auth/mfa/recover", validate(mfaRecoverySchema), async (req: any, res: Response) => {
    const staffId = req.session?.staffId;
    if (!staffId) {
      return res.status(401).json({ message: "No active session. Please log in first." });
    }

    const { code } = req.body;
    if (!code || typeof code !== "string") {
      return res.status(400).json({ message: "Recovery code is required." });
    }

    try {
      const valid = await verifyRecoveryCode(staffId, code);
      if (!valid) {
        return res.status(401).json({ message: "Invalid or already-used recovery code." });
      }

      req.session.mfaVerified = true;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err: any) => (err ? reject(err) : resolve()))
      );

      const [member] = await db.select().from(staff).where(eq(staff.id, staffId));

      return res.json({
        verified: true,
        warning: "Recovery code used. Please re-enrol your authenticator app.",
        user: member ? {
          id:        String(member.id),
          email:     member.email,
          firstName: member.firstName,
          lastName:  member.lastName,
        } : undefined,
      });
    } catch (err) {
      logger.error({ err }, "[mfa/recover]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // ── POST /api/auth/mfa/disable ──────────────────────────────────────────────
  // Disables MFA. Requires a valid TOTP code as confirmation.
  // Deletes the TOTP secret and all recovery codes.
  app.post("/api/auth/mfa/disable", async (req: any, res: Response) => {
    const staffId = req.session?.staffId;
    if (!staffId || !req.session.mfaVerified) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return res.status(400).json({ message: "TOTP code is required to disable MFA." });
    }

    try {
      const result = await disableMfa(staffId, token);
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }

      req.session.mfaEnabled  = false;
      req.session.mfaVerified = false;
      await new Promise<void>((resolve, reject) =>
        req.session.save((err: any) => (err ? reject(err) : resolve()))
      );

      return res.json({ message: "MFA has been disabled." });
    } catch (err) {
      logger.error({ err }, "[mfa/disable]");
      return res.status(500).json({ message: "Internal server error" });
    }
  });
}
