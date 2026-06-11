/**
 * server/routes/mfa.ts
 * Email verification + email-code MFA. No SMS / Twilio.
 *
 * POST /api/auth/mfa/verify-email        — verify 6-digit registration code
 * POST /api/auth/mfa/resend-verification — resend verification email
 * POST /api/auth/mfa/enable              — turn on login MFA (sends test code)
 * POST /api/auth/mfa/confirm             — confirm test code, MFA active
 * POST /api/auth/mfa/disable             — turn off login MFA
 * POST /api/auth/mfa/challenge           — send login code (after password check)
 * POST /api/auth/mfa/complete            — verify login code, return full JWT
 */

import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { isAuthenticated, signToken, type AuthRequest } from "../auth/index.js";
import { sendVerificationEmail, sendMfaCodeEmail, generateCode } from "../services/emailService.js";

const r = Router();
const SECRET  = process.env.JWT_SECRET ?? "change-me-in-env";
const MFA_TTL = 10 * 60;

export function signMfaToken(userId: number, jurisdiction: "CA" | "US"): string {
  return jwt.sign({ sub: userId, jur: jurisdiction, mfa_pending: true }, SECRET, { expiresIn: MFA_TTL });
}

function verifyMfaToken(token: string): { userId: number; jurisdiction: "CA" | "US" } | null {
  try {
    const p = jwt.verify(token, SECRET) as any;
    if (!p.mfa_pending) return null;
    return { userId: +p.sub, jurisdiction: p.jur ?? "CA" };
  } catch { return null; }
}

function codeExpiry(minutes = 15): Date {
  return new Date(Date.now() + minutes * 60 * 1000);
}

// ── POST /verify-email ────────────────────────────────────────────────────────
r.post("/verify-email", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const jur = req.userJurisdiction ?? "CA";
    const [u] = await getDb(jur).select({
      id: users.id,
      emailVerifyCode:   (users as any).emailVerifyCode,
      emailVerifyExpiry: (users as any).emailVerifyExpiry,
      emailVerified:     (users as any).emailVerified,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.emailVerified) return res.json({ message: "Email already verified" });
    if (!u.emailVerifyCode || u.emailVerifyCode !== code)
      return res.status(400).json({ message: "Invalid verification code" });
    if (u.emailVerifyExpiry && new Date(u.emailVerifyExpiry) < new Date())
      return res.status(400).json({ message: "Code expired. Please request a new one." });
    await getDb(jur).update(users).set({
      emailVerified: true, emailVerifyCode: null, emailVerifyExpiry: null,
    } as any).where(eq(users.id, req.userId!));
    res.json({ message: "Email verified successfully" });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Invalid code format" });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /resend-verification ─────────────────────────────────────────────────
r.post("/resend-verification", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    const [u] = await getDb(jur).select({
      id: users.id, email: users.email, firstName: users.firstName,
      emailVerified: (users as any).emailVerified,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.emailVerified) return res.json({ message: "Email already verified" });
    const code = generateCode();
    await getDb(jur).update(users).set({
      emailVerifyCode: code, emailVerifyExpiry: codeExpiry(15),
    } as any).where(eq(users.id, req.userId!));
    await sendVerificationEmail(u.email, code, u.firstName);
    res.json({ message: "Verification email sent" });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── POST /enable — start MFA setup, send a test code ──────────────────────────
r.post("/enable", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    const [u] = await getDb(jur).select({
      id: users.id, email: users.email, firstName: users.firstName,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    const code = generateCode();
    await getDb(jur).update(users).set({
      smsCode: code, smsCodeExpiry: codeExpiry(10),
    } as any).where(eq(users.id, req.userId!));
    await sendMfaCodeEmail(u.email, code, u.firstName);
    res.json({ message: "Code sent to your email. Enter it to enable MFA." });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── POST /confirm — confirm setup code, MFA on ────────────────────────────────
r.post("/confirm", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const jur = req.userJurisdiction ?? "CA";
    const [u] = await getDb(jur).select({
      id: users.id,
      smsCode: (users as any).smsCode,
      smsCodeExpiry: (users as any).smsCodeExpiry,
    }).from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (!u.smsCode || u.smsCode !== code)
      return res.status(400).json({ message: "Invalid code" });
    if (u.smsCodeExpiry && new Date(u.smsCodeExpiry) < new Date())
      return res.status(400).json({ message: "Code expired. Please restart setup." });
    await getDb(jur).update(users).set({
      smsMfaEnabled: true, smsCode: null, smsCodeExpiry: null,
    } as any).where(eq(users.id, req.userId!));
    res.json({ message: "Two-factor authentication enabled" });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Invalid code format" });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /disable ─────────────────────────────────────────────────────────────
r.post("/disable", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    await getDb(jur).update(users).set({
      smsMfaEnabled: false, smsCode: null, smsCodeExpiry: null,
    } as any).where(eq(users.id, req.userId!));
    res.json({ message: "Two-factor authentication disabled" });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── POST /challenge — send login code after password auth ─────────────────────
r.post("/challenge", async (req: any, res: Response) => {
  try {
    const { mfaToken } = z.object({ mfaToken: z.string() }).parse(req.body);
    const payload = verifyMfaToken(mfaToken);
    if (!payload) return res.status(401).json({ message: "Invalid or expired MFA token" });
    const [u] = await getDb(payload.jurisdiction).select({
      id: users.id, email: users.email, firstName: users.firstName,
      smsMfaEnabled: (users as any).smsMfaEnabled,
    }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!u?.smsMfaEnabled)
      return res.status(400).json({ message: "MFA not configured" });
    const code = generateCode();
    await getDb(payload.jurisdiction).update(users).set({
      smsCode: code, smsCodeExpiry: codeExpiry(10),
    } as any).where(eq(users.id, payload.userId));
    await sendMfaCodeEmail(u.email, code, u.firstName);
    const masked = u.email.replace(/^(..).*(@.*)$/, "$1•••$2");
    res.json({ message: `Code sent to ${masked}`, mfaToken });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /complete — verify login code, return full JWT ───────────────────────
r.post("/complete", async (req: any, res: Response) => {
  try {
    const { mfaToken, code } = z.object({
      mfaToken: z.string(), code: z.string().length(6),
    }).parse(req.body);
    const payload = verifyMfaToken(mfaToken);
    if (!payload) return res.status(401).json({ message: "Invalid or expired MFA token" });
    const [u] = await getDb(payload.jurisdiction).select({
      id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName,
      smsCode: (users as any).smsCode, smsCodeExpiry: (users as any).smsCodeExpiry,
    }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (!u.smsCode || u.smsCode !== code)
      return res.status(400).json({ message: "Invalid code" });
    if (u.smsCodeExpiry && new Date(u.smsCodeExpiry) < new Date())
      return res.status(400).json({ message: "Code expired. Please sign in again." });
    await getDb(payload.jurisdiction).update(users).set({
      smsCode: null, smsCodeExpiry: null,
    } as any).where(eq(users.id, payload.userId));
    res.json({
      token: signToken(u.id, payload.jurisdiction),
      user: { id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

export { r as mfaRouter };
