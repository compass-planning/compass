/**
 * server/routes/auth.ts
 * Self-hosted auth — email + password + TOTP MFA.
 * No Firebase dependency.
 *
 * Public routes:
 *   POST /api/auth/register           — create account, sends verification email
 *   POST /api/auth/verify-email       — verify email with 6-digit code
 *   POST /api/auth/login              — email + password → partial token (mfaVerified: false)
 *   POST /api/auth/totp/verify        — submit TOTP code → full token (mfaVerified: true)
 *   POST /api/auth/totp/recover       — use recovery code instead of TOTP
 *   POST /api/auth/forgot             — send password reset code
 *   POST /api/auth/reset-password     — consume reset code, set new password
 *   POST /api/auth/refresh            — exchange refresh token for new access token
 *
 * Authenticated routes (full token required):
 *   GET  /api/auth/me                 — current user profile
 *   PATCH /api/auth/me                — update profile fields
 *   GET  /api/auth/me/profile         — financial profile (clients row)
 *   PATCH /api/auth/me/profile        — update financial profile
 *   POST /api/auth/totp/setup         — begin TOTP enrollment (returns QR code)
 *   POST /api/auth/totp/enable        — confirm TOTP enrollment with first code
 *   POST /api/auth/change-password    — change password (requires current password)
 */

import type { Request, Response } from "express";
import { Router }          from "express";
import bcrypt              from "bcryptjs";
import crypto              from "crypto";
import { z }               from "zod";
import { eq, and }         from "drizzle-orm";
import { getDb }           from "../db/index.js";
import { users, clients }  from "../../shared/schema.js";
import { isAuthenticated, getUser, type AuthRequest } from "../auth/index.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken as _verifyRefreshToken } from "../lib/jwt.js";
import { generateTotpSecret, verifyTotpCode, generateRecoveryCodes, consumeRecoveryCode } from "../lib/totp.js";
import { safeMsg, AppError } from "../lib/errorUtils.js";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  generateCode,
} from "../services/emailService.js";
import { logger } from "../logger.js";

const r = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const PASSWORD_SCHEMA = z.string()
  .min(8,  "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[0-9]/, "Password must contain a number");

function issueTokens(userId: number, jurisdiction: "CA" | "US", mfaVerified: boolean) {
  const access  = signAccessToken({ userId, jurisdiction, mfaVerified });
  const refresh = mfaVerified ? signRefreshToken(userId) : null;
  return { access, refresh };
}

// ── POST /register ────────────────────────────────────────────────────────────
r.post("/register", async (req: Request, res: Response) => {
  try {
    const body = z.object({
      email:        z.string().email(),
      password:     PASSWORD_SCHEMA,
      firstName:    z.string().min(1),
      lastName:     z.string().min(1),
      firmName:     z.string().optional(),
      jurisdiction: z.enum(["CA", "US"]).default("CA"),
      province:     z.string().optional(),
    }).parse(req.body);

    const db  = getDb(body.jurisdiction);
    const jur = body.jurisdiction as "CA" | "US";

    // Check for existing account
    const [existing] = await db.select({ id: users.id })
      .from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
    if (existing) {
      // Don't reveal account existence — return same success shape
      return res.status(201).json({ message: "If that email is new, a verification code has been sent." });
    }

    const passwordHash   = await bcrypt.hash(body.password, 12);
    const verifyCode     = generateCode();
    const verifyCodeHash = await bcrypt.hash(verifyCode, 10);
    const trialEndsAt    = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [u] = await (db.insert(users) as any).values({
      email:              body.email.toLowerCase(),
      passwordHash,
      firstName:          body.firstName,
      lastName:           body.lastName,
      firmName:           body.firmName ?? null,
      jurisdiction:       jur,
      province:           body.province ?? (jur === "CA" ? "ON" : null),
      subscriptionTier:   "trial",
      subscriptionStatus: "trialing",
      trialEndsAt,
      emailVerifyCode:     verifyCodeHash,
      emailVerifyExpires:  new Date(Date.now() + 15 * 60 * 1000),
    }).returning();

    // Auto-create financial profile
    await (db.insert(clients) as any).values({
      userId:    u.id,
      firstName: body.firstName,
      lastName:  body.lastName,
      email:     body.email.toLowerCase(),
      jurisdiction: jur,
      province:  body.province ?? (jur === "CA" ? "ON" : null),
    }).onConflictDoNothing();

    await sendVerificationEmail(body.email, verifyCode, body.firstName);
    logger.info({ userId: u.id }, "[auth] registration complete, verification email sent");

    res.status(201).json({ message: "Verification code sent to your email.", userId: u.id });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    logger.error({ err: e }, "[auth/register]");
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /verify-email ────────────────────────────────────────────────────────
r.post("/verify-email", async (req: Request, res: Response) => {
  try {
    const { email, code } = z.object({
      email: z.string().email(),
      code:  z.string().length(6),
    }).parse(req.body);

    // Try CA then US
    let db  = getDb("CA");
    let jur: "CA" | "US" = "CA";
    let [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!u) {
      db  = getDb("US");
      jur = "US";
      [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    }
    if (!u || !u.emailVerifyCode) throw new AppError("Invalid or expired code", 400);
    if (u.emailVerifyExpires && new Date() > u.emailVerifyExpires) throw new AppError("Code expired — please register again", 400);
    if (u.emailVerifiedAt) throw new AppError("Email already verified", 400);

    const valid = await bcrypt.compare(code, u.emailVerifyCode);
    if (!valid) throw new AppError("Invalid verification code", 400);

    await (db.update(users) as any).set({
      emailVerifiedAt:    new Date(),
      emailVerifyCode:    null,
      emailVerifyExpires: null,
    }).where(eq(users.id, u.id));

    // Issue partial token — user must complete TOTP setup before full access
    const { access } = issueTokens(u.id, jur, false);
    res.json({ accessToken: access, nextStep: "totp-setup" });
  } catch (e: any) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ message: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /login ───────────────────────────────────────────────────────────────
r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    let db: ReturnType<typeof getDb> = getDb("CA");
    let jur: "CA" | "US"            = "CA";
    let [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);

    if (!u) {
      db  = getDb("US");
      jur = "US";
      [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    }

    // Constant-time: always run compare even if no user (prevents timing attacks)
    const hash   = u?.passwordHash ?? "$2b$12$invalidhashtopreventtiming";
    const valid  = await bcrypt.compare(password, hash);

    if (!u || !valid) throw new AppError("Invalid email or password", 401);
    if (!u.emailVerifiedAt) throw new AppError("Please verify your email before signing in", 403);

    jur = (u.jurisdiction ?? "CA") as "CA" | "US";

    // If TOTP not yet set up, issue partial token and direct to setup
    if (!u.totpEnabledAt) {
      const { access } = issueTokens(u.id, jur, false);
      return res.json({ accessToken: access, nextStep: "totp-setup" });
    }

    // TOTP enrolled — issue partial token, require TOTP step
    const { access } = issueTokens(u.id, jur, false);
    res.json({ accessToken: access, nextStep: "totp-verify" });
  } catch (e: any) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ message: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /totp/setup — begin enrollment (authenticated, mfaVerified not required) ──
r.post("/totp/setup", async (req: AuthRequest, res: Response) => {
  // Allow partial token (mfaVerified: false) for setup during registration flow
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  let userId: number; let jur: "CA" | "US";
  try {
    const { verifyAccessToken } = await import("../lib/jwt.js");
    const p = verifyAccessToken(header.slice(7));
    userId = p.userId; jur = p.jurisdiction;
  } catch { return res.status(401).json({ message: "Invalid token" }); }

  try {
    const db  = getDb(jur);
    const [u] = await db.select({ email: users.email, totpEnabledAt: users.totpEnabledAt })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.totpEnabledAt) return res.status(400).json({ message: "TOTP already enabled" });

    const enroll = await generateTotpSecret(u.email);

    // Store pending secret (not yet enabled until confirmed with first code)
    await (db.update(users) as any).set({ totpPendingSecret: enroll.secret }).where(eq(users.id, userId));

    res.json({ qrCodeDataUrl: enroll.qrCodeDataUrl, otpauthUrl: enroll.otpauthUrl });
  } catch (e: any) {
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /totp/enable — confirm enrollment with first code ────────────────────
r.post("/totp/enable", async (req: AuthRequest, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  let userId: number; let jur: "CA" | "US";
  try {
    const { verifyAccessToken } = await import("../lib/jwt.js");
    const p = verifyAccessToken(header.slice(7));
    userId = p.userId; jur = p.jurisdiction;
  } catch { return res.status(401).json({ message: "Invalid token" }); }

  try {
    const { code } = z.object({ code: z.string().min(6).max(6) }).parse(req.body);
    const db       = getDb(jur);
    const [u]      = await db.select({ totpPendingSecret: users.totpPendingSecret })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!u?.totpPendingSecret) return res.status(400).json({ message: "No pending TOTP setup" });

    const valid = verifyTotpCode(u.totpPendingSecret, code);
    if (!valid) return res.status(400).json({ message: "Invalid code — check your authenticator app" });

    // Generate recovery codes
    const { plain, hashed } = await generateRecoveryCodes();

    await (db.update(users) as any).set({
      totpSecret:        u.totpPendingSecret,
      totpPendingSecret: null,
      totpEnabledAt:     new Date(),
      mfaRecoveryCodes:  JSON.stringify(hashed),
    }).where(eq(users.id, userId));

    // Issue full token — TOTP now verified
    const { access, refresh } = issueTokens(userId, jur, true);
    logger.info({ userId }, "[auth] TOTP enrollment complete");

    res.json({ accessToken: access, refreshToken: refresh, recoveryCodes: plain });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /totp/verify — submit TOTP code after login ─────────────────────────
r.post("/totp/verify", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  let userId: number; let jur: "CA" | "US";
  try {
    const { verifyAccessToken } = await import("../lib/jwt.js");
    const p = verifyAccessToken(header.slice(7));
    userId = p.userId; jur = p.jurisdiction;
  } catch { return res.status(401).json({ message: "Invalid token" }); }

  try {
    const { code } = z.object({ code: z.string().min(6).max(6) }).parse(req.body);
    const db       = getDb(jur);
    const [u]      = await db.select({ totpSecret: users.totpSecret })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!u?.totpSecret) return res.status(400).json({ message: "TOTP not configured" });

    const valid = verifyTotpCode(u.totpSecret, code);
    if (!valid) return res.status(400).json({ message: "Invalid code" });

    const { access, refresh } = issueTokens(userId, jur, true);
    res.json({ accessToken: access, refreshToken: refresh });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /totp/recover — use recovery code instead of TOTP ───────────────────
r.post("/totp/recover", async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  let userId: number; let jur: "CA" | "US";
  try {
    const { verifyAccessToken } = await import("../lib/jwt.js");
    const p = verifyAccessToken(header.slice(7));
    userId = p.userId; jur = p.jurisdiction;
  } catch { return res.status(401).json({ message: "Invalid token" }); }

  try {
    const { code } = z.object({ code: z.string().min(1) }).parse(req.body);
    const db       = getDb(jur);
    const [u]      = await db.select({ mfaRecoveryCodes: users.mfaRecoveryCodes })
      .from(users).where(eq(users.id, userId)).limit(1);

    if (!u?.mfaRecoveryCodes) return res.status(400).json({ message: "No recovery codes found" });

    const codes  = JSON.parse(u.mfaRecoveryCodes as string);
    const index  = await consumeRecoveryCode(code, codes);
    if (index === -1) return res.status(400).json({ message: "Invalid recovery code" });

    // Mark code as used
    codes[index].used = true;
    await (db.update(users) as any).set({ mfaRecoveryCodes: JSON.stringify(codes) })
      .where(eq(users.id, userId));

    const { access, refresh } = issueTokens(userId, jur, true);
    const remaining = codes.filter((c: any) => !c.used).length;
    logger.info({ userId, remaining }, "[auth] recovery code used");

    res.json({ accessToken: access, refreshToken: refresh, codesRemaining: remaining });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /forgot ──────────────────────────────────────────────────────────────
r.post("/forgot", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);

    for (const jur of ["CA", "US"] as const) {
      const db  = getDb(jur);
      const [u] = await db.select({ id: users.id, firstName: users.firstName })
        .from(users).where(eq(users.email, email.toLowerCase())).limit(1);
      if (u) {
        const code     = generateCode();
        const codeHash = await bcrypt.hash(code, 10);
        await (db.update(users) as any).set({
          resetCode:        codeHash,
          resetCodeExpires: new Date(Date.now() + 15 * 60 * 1000),
        }).where(eq(users.id, u.id));
        await sendPasswordResetEmail(email, code, u.firstName);
        break;
      }
    }
    // Always return success — never reveal whether account exists
    res.json({ message: "If that email has an account, a reset code has been sent." });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /reset-password ──────────────────────────────────────────────────────
r.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { email, code, password } = z.object({
      email:    z.string().email(),
      code:     z.string().length(6),
      password: PASSWORD_SCHEMA,
    }).parse(req.body);

    let db: ReturnType<typeof getDb> = getDb("CA");
    let [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    if (!u) {
      db  = getDb("US");
      [u] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    }

    if (!u || !u.resetCode) throw new AppError("Invalid or expired reset code", 400);
    if (u.resetCodeExpires && new Date() > u.resetCodeExpires) throw new AppError("Reset code expired", 400);

    const valid = await bcrypt.compare(code, u.resetCode);
    if (!valid) throw new AppError("Invalid reset code", 400);

    const passwordHash = await bcrypt.hash(password, 12);
    await (db.update(users) as any).set({
      passwordHash,
      resetCode:        null,
      resetCodeExpires: null,
      mustResetPassword: false,
    }).where(eq(users.id, u.id));

    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (e: any) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ message: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /refresh ─────────────────────────────────────────────────────────────
r.post("/refresh", async (req: Request, res: Response) => {
  try {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const { userId } = _verifyRefreshToken(refreshToken);

    // Look up user to confirm still active
    let db  = getDb("CA"); let jur: "CA" | "US" = "CA";
    let [u] = await db.select({ id: users.id, jurisdiction: users.jurisdiction })
      .from(users).where(eq(users.id, userId)).limit(1);
    if (!u) { db = getDb("US"); jur = "US";
      [u] = await db.select({ id: users.id, jurisdiction: users.jurisdiction })
        .from(users).where(eq(users.id, userId)).limit(1);
    }
    if (!u) throw new AppError("User not found", 401);

    jur = (u.jurisdiction ?? "CA") as "CA" | "US";
    const access = signAccessToken({ userId, jurisdiction: jur, mfaVerified: true });
    res.json({ accessToken: access });
  } catch (e: any) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ message: e.message });
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// ── GET /me ───────────────────────────────────────────────────────────────────
r.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const u = await getUser(req.userId!, req.userJurisdiction ?? "CA");
  if (!u) return res.status(404).json({ message: "Not found" });
  res.json(u);
});

// ── PATCH /me ─────────────────────────────────────────────────────────────────
r.patch("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const body = z.object({
      firmName:     z.string().nullable().optional(),
      jurisdiction: z.enum(["CA", "US"]).optional(),
      province:     z.string().nullable().optional(),
      phone:        z.string().nullable().optional(),
      address:      z.string().nullable().optional(),
      city:         z.string().nullable().optional(),
      postalCode:   z.string().nullable().optional(),
    }).parse(req.body);
    const [u] = await getDb(req.userJurisdiction ?? "CA")
      .update(users).set(body)
      .where(eq(users.id, req.userId!))
      .returning({ id: users.id, email: users.email, firstName: users.firstName, lastName: users.lastName });
    res.json(u);
  } catch (e: any) {
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── GET /me/profile ───────────────────────────────────────────────────────────
r.get("/me/profile", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    let [profile] = await getDb(jur).select().from(clients)
      .where(eq(clients.userId, req.userId!)).limit(1);

    if (!profile) {
      const [u] = await getDb(jur).select({
        firstName: users.firstName, lastName: users.lastName,
        email: users.email, jurisdiction: users.jurisdiction, province: users.province,
      }).from(users).where(eq(users.id, req.userId!)).limit(1);
      if (!u) return res.status(404).json({ message: "User not found" });
      const [created] = await (getDb(jur).insert(clients) as any).values({
        userId: req.userId, firstName: u.firstName, lastName: u.lastName,
        email: u.email, jurisdiction: u.jurisdiction ?? jur,
        province: u.province ?? (jur === "CA" ? "ON" : null),
      }).returning();
      profile = created;
    }
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── PATCH /me/profile ─────────────────────────────────────────────────────────
r.patch("/me/profile", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    const { id, userId, createdAt, updatedAt, ...body } = req.body;
    const [updated] = await getDb(jur).update(clients)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(clients.userId, req.userId!))
      .returning();
    if (!updated) return res.status(404).json({ message: "Profile not found" });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ message: safeMsg(e) });
  }
});

// ── POST /change-password ─────────────────────────────────────────────────────
r.post("/change-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string().min(1),
      newPassword:     PASSWORD_SCHEMA,
    }).parse(req.body);

    const db  = getDb(req.userJurisdiction ?? "CA");
    const [u] = await db.select({ passwordHash: users.passwordHash })
      .from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) throw new AppError("User not found", 404);

    const valid = await bcrypt.compare(currentPassword, u.passwordHash);
    if (!valid) throw new AppError("Current password is incorrect", 400);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await (db.update(users) as any).set({ passwordHash, mustResetPassword: false })
      .where(eq(users.id, req.userId!));

    res.json({ message: "Password changed successfully" });
  } catch (e: any) {
    if (e instanceof AppError) return res.status(e.statusCode).json({ message: e.message });
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: safeMsg(e) });
  }
});

export { r as authRouter };
