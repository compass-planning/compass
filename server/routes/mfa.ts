/**
 * server/routes/mfa.ts
 *
 * TOTP MFA endpoints — all require isAuthenticated except /challenge.
 *
 *   POST /api/auth/mfa/setup      — generate secret + QR code URI (not saved yet)
 *   POST /api/auth/mfa/enable     — verify first code, persist secret, mark enabled
 *   POST /api/auth/mfa/disable    — verify code, clear secret, mark disabled
 *   POST /api/auth/mfa/challenge  — verify code against temp token, return full JWT
 */
import type { Response } from "express";
import { Router }        from "express";
import speakeasy         from "speakeasy";
import QRCode            from "qrcode";
import { z }             from "zod";
import jwt               from "jsonwebtoken";
import { db }            from "../db/index.js";
import { users }         from "../../shared/schema.js";
import { eq }            from "drizzle-orm";
import { isAuthenticated, signToken, type AuthRequest } from "../auth/index.js";
import { logger }        from "../logger.js";

const r = Router();

const SECRET     = process.env.JWT_SECRET ?? "change-me-in-env";
const MFA_TTL    = 5 * 60;        // 5 minutes for the pending MFA token
const APP_NAME   = "Compass Planning";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Sign a short-lived token indicating MFA verification is pending. */
function signMfaToken(userId: number, jurisdiction: "CA" | "US"): string {
  return jwt.sign(
    { sub: userId, jur: jurisdiction, mfa_pending: true },
    SECRET,
    { expiresIn: MFA_TTL },
  );
}

/** Verify a TOTP code against a base32 secret. */
function verifyTotp(secret: string, code: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token:    code.replace(/\s/g, ""),
    window:   1,   // allow 1 step drift (30s before/after)
  });
}

// ── POST /api/auth/mfa/setup ─────────────────────────────────────────────────
// Returns a new TOTP secret + QR code data URL. Does NOT save yet.
r.post("/setup", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const [u] = await db.select({ email: users.email, totpEnabled: users.totpEnabled })
      .from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.totpEnabled) return res.status(400).json({ message: "MFA is already enabled" });

    const secret = speakeasy.generateSecret({
      name:   `${APP_NAME} (${u.email})`,
      length: 20,
    });

    const otpauthUrl = secret.otpauth_url!;
    const qrCode     = await QRCode.toDataURL(otpauthUrl);

    res.json({
      secret:  secret.base32,
      qrCode,             // data:image/png;base64,...
      otpauthUrl,
    });
  } catch (err) {
    logger.error({ err, userId: req.userId }, "mfa setup error");
    res.status(500).json({ message: "Failed to generate MFA secret" });
  }
});

// ── POST /api/auth/mfa/enable ────────────────────────────────────────────────
// Verify first TOTP code against provided secret, then persist and enable.
r.post("/enable", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { secret, code } = z.object({
      secret: z.string().min(16),
      code:   z.string().length(6),
    }).parse(req.body);

    if (!verifyTotp(secret, code)) {
      return res.status(401).json({ message: "Invalid verification code. Please try again." });
    }

    await db.update(users)
      .set({ totpSecret: secret, totpEnabled: true })
      .where(eq(users.id, req.userId!));

    logger.info({ userId: req.userId }, "MFA enabled");
    res.json({ message: "MFA enabled successfully" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0]?.message });
    logger.error({ err, userId: req.userId }, "mfa enable error");
    res.status(500).json({ message: "Failed to enable MFA" });
  }
});

// ── POST /api/auth/mfa/disable ───────────────────────────────────────────────
// Verify current TOTP code, then clear MFA.
r.post("/disable", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);

    const [u] = await db.select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
      .from(users).where(eq(users.id, req.userId!)).limit(1);

    if (!u?.totpEnabled || !u.totpSecret) {
      return res.status(400).json({ message: "MFA is not enabled" });
    }
    if (!verifyTotp(u.totpSecret, code)) {
      return res.status(401).json({ message: "Invalid code" });
    }

    await db.update(users)
      .set({ totpSecret: null, totpEnabled: false })
      .where(eq(users.id, req.userId!));

    logger.info({ userId: req.userId }, "MFA disabled");
    res.json({ message: "MFA disabled" });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0]?.message });
    logger.error({ err, userId: req.userId }, "mfa disable error");
    res.status(500).json({ message: "Failed to disable MFA" });
  }
});

// ── POST /api/auth/mfa/challenge ─────────────────────────────────────────────
// Verify TOTP code against temp token. Returns full JWT if valid.
// No isAuthenticated middleware — user only has a temp mfaToken at this point.
r.post("/challenge", async (req: any, res: Response) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string().min(1),
      code:     z.string().length(6),
    }).parse(req.body);

    // Verify the pending MFA token
    let payload: any;
    try {
      payload = jwt.verify(mfaToken, SECRET);
    } catch {
      return res.status(401).json({ message: "MFA session expired. Please sign in again." });
    }

    if (!payload.mfa_pending) {
      return res.status(401).json({ message: "Invalid MFA token" });
    }

    const userId = +payload.sub;
    const jur    = payload.jur === "US" ? "US" : "CA" as "CA" | "US";

    // Get user's TOTP secret
    const [u] = await db.select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!u?.totpEnabled || !u.totpSecret) {
      return res.status(401).json({ message: "MFA not configured for this account" });
    }

    if (!verifyTotp(u.totpSecret, code)) {
      logger.warn({ userId }, "MFA challenge failed — invalid code");
      return res.status(401).json({ message: "Invalid code. Please try again." });
    }

    // Issue full session token
    const token = signToken(userId, jur);
    logger.info({ userId }, "MFA challenge passed — session issued");
    res.json({ token, jurisdiction: jur });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0]?.message });
    logger.error({ err }, "mfa challenge error");
    res.status(500).json({ message: "MFA challenge failed" });
  }
});

export { r as mfaRouter, signMfaToken };
