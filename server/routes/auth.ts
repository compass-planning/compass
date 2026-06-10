import type { Request, Response } from "express";
import { Router } from "express";
import { db, getDb }    from "../db/index.js";
import { signMfaToken } from "./mfa.js";
import { auditAuth, AuditAction } from "../services/pipedaAuditService.js";

function localeFromProvince(province?: string | null): "en" | "fr" {
  return province?.toUpperCase() === "QC" ? "fr" : "en";
}
import { users, clients, insertUserSchema } from "../../shared/schema.js";
import {
  hashPassword, checkPassword, signToken, validatePassword,
  isAuthenticated, getUser, type AuthRequest,
} from "../auth/index.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const r = Router();

// ── Register ──────────────────────────────────────────────────────────────────
r.post("/register", async (req: Request, res: Response) => {
  try {
    const body = insertUserSchema.parse(req.body);
    const pwErr = validatePassword(body.password);
    if (pwErr) return res.status(400).json({ message: pwErr });
    const jur  = (body.jurisdiction ?? "CA") as "CA" | "US";
    const target = getDb(jur);

    const exists = await target.select({ id: users.id }).from(users).where(eq(users.email, body.email)).limit(1);
    if (exists.length) return res.status(409).json({ message: "Email already registered" });

    const hash = await hashPassword(body.password);
    const emailVerifyCode = generateCode();
    const emailVerifyExpiry = new Date(Date.now() + 15 * 60 * 1000);

    const province = (body as any).province ?? null;
    const locale   = localeFromProvince(province);

    // 14-day trial
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [u] = await (target.insert(users) as any).values({
      email: body.email, passwordHash: hash,
      firstName: body.firstName, lastName: body.lastName,
      firmName:  body.firmName ?? null,
      emailVerifyCode, emailVerifyExpiry, emailVerified: false,
      jurisdiction: jur,
      province, locale,
      subscriptionTier: "trial",
      subscriptionStatus: "trialing",
      trialEndsAt,
    }).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, firmName: users.firmName,
      jurisdiction: users.jurisdiction,
      subscriptionTier: users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      trialEndsAt: users.trialEndsAt,
      province: (users as any).province, locale: (users as any).locale,
    });

    // Send verification email
    try {
      await sendVerificationEmail(u.email, emailVerifyCode, u.firstName);
    } catch (emailErr: any) {
      console.error("[register] email send failed:", emailErr.message);
      // Don't fail registration if email fails
    }

    // Auto-create the user's personal financial profile record
    await (target.insert(clients) as any).values({
      userId: u.id,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      jurisdiction: jur,
      province: province ?? (jur === "CA" ? "ON" : null),
    }).onConflictDoNothing();

    res.status(201).json({ token: signToken(u.id, jur), user: u });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error", errors: e.errors });
    console.error("[register]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string() }).parse(req.body);

    let [u] = await getDb("CA").select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) {
      [u] = await getDb("US").select().from(users).where(eq(users.email, email)).limit(1);
    }

    if (!u || !await checkPassword(password, u.passwordHash)) {
      await auditAuth({ req, action: AuditAction.AUTH_LOGIN_FAILURE, userEmail: email, outcome: "error", errorMessage: "Invalid credentials" });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const jur = (u.jurisdiction ?? "CA") as "CA" | "US";

    if ((u as any).smsMfaEnabled) {
      await auditAuth({ req, action: AuditAction.AUTH_LOGIN_SUCCESS, userId: u.id, userEmail: u.email });
      return res.json({ mfaRequired: true, mfaToken: signMfaToken(u.id, jur) });
    }

    await auditAuth({ req, action: AuditAction.AUTH_LOGIN_SUCCESS, userId: u.id, userEmail: u.email });
    res.json({
      token: signToken(u.id, jur),
      user: {
        id: u.id, email: u.email, firstName: u.firstName, lastName: u.lastName,
        firmName: u.firmName,
        mustResetPassword: u.mustResetPassword,
        jurisdiction: jur,
        province: (u as any).province ?? null,
        locale:   (u as any).locale   ?? localeFromProvince((u as any).province),
        subscriptionTier: u.subscriptionTier,
        subscriptionStatus: u.subscriptionStatus,
        trialEndsAt: u.trialEndsAt,
        currentPeriodEnd: u.currentPeriodEnd,
        emailVerified: (u as any).emailVerified ?? false,
      },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    console.error("[login]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Me ────────────────────────────────────────────────────────────────────────
r.get("/me", isAuthenticated, async (req: AuthRequest, res: Response) => {
  const u = await getUser(req.userId!, req.userJurisdiction ?? "CA");
  if (!u) return res.status(404).json({ message: "Not found" });
  res.json(u);
});

// ── Me: patch ─────────────────────────────────────────────────────────────────
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
    const [u] = await db.update(users).set(body).where(eq(users.id, req.userId!)).returning({
      id: users.id, email: users.email, firstName: users.firstName,
      lastName: users.lastName, firmName: users.firmName,
    });
    res.json(u);
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── Change Password ───────────────────────────────────────────────────────────
r.post("/change-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword, securityQuestion, securityAnswer } = z.object({
      currentPassword:  z.string().min(1),
      newPassword:      z.string().min(12),
      securityQuestion: z.string().optional(),
      securityAnswer:   z.string().optional(),
    }).parse(req.body);
    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (!await checkPassword(currentPassword, u.passwordHash))
      return res.status(401).json({ message: "Current password is incorrect" });
    const hash = await hashPassword(newPassword);
    const updates: any = { passwordHash: hash, mustResetPassword: false };
    if (securityQuestion && securityAnswer) {
      updates.securityQuestion   = securityQuestion;
      updates.securityAnswerHash = await hashPassword(securityAnswer.toLowerCase().trim());
    }
    await db.update(users).set(updates).where(eq(users.id, req.userId!));
    await auditAuth({ req, action: AuditAction.AUTH_PASSWORD_CHANGED, userId: req.userId });
    res.json({ message: "Password changed successfully", token: signToken(u.id, req.userJurisdiction ?? "CA") });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: "Validation error", errors: e.errors });
    console.error("[change-password]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Force Reset Password ──────────────────────────────────────────────────────
r.post("/force-reset-password", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const { newPassword, securityQuestion, securityAnswer } = z.object({
      newPassword:      z.string().min(12),
      securityQuestion: z.string().optional(),
      securityAnswer:   z.string().optional(),
    }).parse(req.body);
    const hash = await hashPassword(newPassword);
    const updates: any = { passwordHash: hash, mustResetPassword: false };
    if (securityQuestion && securityAnswer) {
      updates.securityQuestion   = securityQuestion;
      updates.securityAnswerHash = await hashPassword(securityAnswer.toLowerCase().trim());
    }
    await db.update(users).set(updates).where(eq(users.id, req.userId!));
    const [u] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
    res.json({ message: "Password reset successfully", token: signToken(u.id, req.userJurisdiction ?? "CA") });
  } catch (e: any) {
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Forgot Password: send email code ─────────────────────────────────────────
r.post("/forgot/send", async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    let jur: "CA" | "US" = "CA";
    let [u] = await getDb("CA").select({ id: users.id, email: users.email, firstName: users.firstName }).from(users).where(eq(users.email, email)).limit(1);
    if (!u) {
      [u] = await getDb("US").select({ id: users.id, email: users.email, firstName: users.firstName }).from(users).where(eq(users.email, email)).limit(1);
      if (u) jur = "US";
    }
    // Always return success to prevent email enumeration
    if (u) {
      const code = generateCode();
      await getDb(jur).update(users).set({
        emailVerifyCode: code,
        emailVerifyExpiry: new Date(Date.now() + 15 * 60 * 1000),
      } as any).where(eq(users.id, u.id));
      try { await sendVerificationEmail(u.email, code, u.firstName); } catch {}
    }
    res.json({ message: "If that email exists, a reset code has been sent." });
  } catch (e: any) {
    res.status(500).json({ message: "Server error" });
  }
});

// ── Forgot Password: verify code + reset ─────────────────────────────────────
r.post("/forgot/reset", async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = z.object({
      email:       z.string().email(),
      code:        z.string().length(6),
      newPassword: z.string().min(12),
    }).parse(req.body);

    let jur: "CA" | "US" = "CA";
    let [u] = await getDb("CA").select().from(users).where(eq(users.email, email)).limit(1);
    if (!u) {
      [u] = await getDb("US").select().from(users).where(eq(users.email, email)).limit(1);
      if (u) jur = "US";
    }
    if (!u) return res.status(400).json({ message: "Account not found." });

    const verifyCode = (u as any).emailVerifyCode;
    const expiry     = (u as any).emailVerifyExpiry;
    if (!verifyCode || verifyCode !== code)
      return res.status(400).json({ message: "Invalid code." });
    if (expiry && new Date(expiry) < new Date())
      return res.status(400).json({ message: "Code expired. Please request a new one." });

    const hash = await hashPassword(newPassword);
    await getDb(jur).update(users).set({
      passwordHash: hash, emailVerifyCode: null, emailVerifyExpiry: null,
    } as any).where(eq(users.id, u.id));
    res.json({ message: "Password reset successfully. You can now sign in." });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message ?? "Validation error" });
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Me: get/create personal financial profile ────────────────────────────────
// The consumer app has no "clients" concept — each user IS their own client.
// This endpoint returns the user's profile record, creating one if missing.
r.get("/me/profile", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    const target = getDb(jur);

    // Look up the user's own profile record
    let [profile] = await target.select().from(clients)
      .where(eq(clients.userId, req.userId!)).limit(1);

    // Create it if it doesn't exist (handles legacy accounts)
    if (!profile) {
      const [u] = await target.select({
        firstName: users.firstName, lastName: users.lastName,
        email: users.email, jurisdiction: users.jurisdiction,
        province: (users as any).province,
      }).from(users).where(eq(users.id, req.userId!)).limit(1);

      if (!u) return res.status(404).json({ message: "User not found" });

      const [created] = await (target.insert(clients) as any).values({
        userId: req.userId,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        jurisdiction: u.jurisdiction ?? jur,
        province: u.province ?? (jur === "CA" ? "ON" : null),
      }).returning();
      profile = created;
    }

    res.json(profile);
  } catch (e: any) {
    console.error("[me/profile]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

// ── Me: update personal financial profile ─────────────────────────────────────
r.patch("/me/profile", isAuthenticated, async (req: AuthRequest, res: Response) => {
  try {
    const jur = req.userJurisdiction ?? "CA";
    const target = getDb(jur);

    // Strip server-managed fields
    const { id, userId, createdAt, updatedAt, ...body } = req.body;

    const [updated] = await target.update(clients)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(clients.userId, req.userId!))
      .returning();

    if (!updated) return res.status(404).json({ message: "Profile not found" });
    res.json(updated);
  } catch (e: any) {
    console.error("[me/profile patch]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
  }
});

export { r as authRouter };
