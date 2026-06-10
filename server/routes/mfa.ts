/**
 * server/routes/mfa.ts
 * Email verification + SMS MFA — replaces TOTP and security questions.
 *
 * POST /api/auth/mfa/verify-email        — verify 6-digit email code
 * POST /api/auth/mfa/resend-verification — resend verification email
 * POST /api/auth/mfa/sms-setup           — save phone, send code
 * POST /api/auth/mfa/sms-confirm         — verify code, enable SMS MFA
 * POST /api/auth/mfa/sms-disable         — disable SMS MFA
 * POST /api/auth/mfa/sms-challenge       — send SMS code on login
 * POST /api/auth/mfa/sms-complete        — verify code, return full JWT
 */

import { Router, type Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { getDb } from "../db/index.js";
import { users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { isAuthenticated, signToken, type AuthRequest } from "../auth/index.js";
import { sendVerificationEmail } from "../services/emailService.js";
import { sendSmsCode, generateCode } from "../services/smsService.js";

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

// ── POST /sms-setup ───────────────────────────────────────────────────────────
r.post("/sms-setup", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { phone } = z.object({ phone: z.string().min(10).max(20) }).parse(req.body);
    const code = generateCode();
    const jur  = req.userJurisdiction ?? "CA";
    await getDb(jur).update(users).set({
      phone, smsCode: code, smsCodeExpiry: codeExpiry(10),
    } as any).where(eq(users.id, req.userId!));
    await sendSmsCode(phone, code);
    res.json({ message: "SMS code sent. Enter it to confirm your number." });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /sms-confirm ─────────────────────────────────────────────────────────
r.post("/sms-confirm", isAuthenticated, async (req: AuthRequest, res: Response) => {
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
    res.json({ message: "SMS MFA enabled successfully" });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Invalid code format" });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /sms-disable ─────────────────────────────────────────────────────────
r.post("/sms-disable", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    await getDb(jur).update(users).set({
      smsMfaEnabled: false, smsCode: null, smsCodeExpiry: null,
    } as any).where(eq(users.id, req.userId!));
    res.json({ message: "SMS MFA disabled" });
  } catch (e: any) { res.status(500).json({ message: e.message }); }
});

// ── POST /sms-challenge — send code after password login ──────────────────────
r.post("/sms-challenge", async (req: any, res: Response) => {
  try {
    const { mfaToken } = z.object({ mfaToken: z.string() }).parse(req.body);
    const payload = verifyMfaToken(mfaToken);
    if (!payload) return res.status(401).json({ message: "Invalid or expired MFA token" });
    const [u] = await getDb(payload.jurisdiction).select({
      id: users.id, phone: users.phone,
      smsMfaEnabled: (users as any).smsMfaEnabled,
    }).from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!u?.smsMfaEnabled || !u.phone)
      return res.status(400).json({ message: "SMS MFA not configured" });
    const code = generateCode();
    await getDb(payload.jurisdiction).update(users).set({
      smsCode: code, smsCodeExpiry: codeExpiry(10),
    } as any).where(eq(users.id, payload.userId));
    await sendSmsCode(u.phone, code);
    const masked = u.phone.slice(0, -4).replace(/\d/g, "•") + u.phone.slice(-4);
    res.json({ message: `Code sent to ${masked}`, mfaToken });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /sms-complete — verify code, return full JWT ─────────────────────────
r.post("/sms-complete", async (req: any, res: Response) => {
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
