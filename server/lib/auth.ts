/**
 * server/routes/auth.ts
 * Firebase auth integration.
 *
 * Firebase handles: registration, login, email verification, password reset, MFA.
 * These routes handle: creating/syncing our Postgres user record, and serving /me.
 *
 * POST /api/auth/register  — create Postgres user record after Firebase signup
 * GET  /api/auth/me        — return current user profile
 * PATCH /api/auth/me       — update profile fields
 * GET  /api/auth/me/profile — return/create the user's financial profile (clients row)
 * PATCH /api/auth/me/profile — update financial profile
 */

import type { Request, Response } from "express";
import { Router } from "express";
import { getDb } from "../db/index.js";
import { users, clients } from "../../shared/schema.js";
import { isAuthenticated, getUser, type AuthRequest } from "../auth/index.js";
import { verifyFirebaseToken } from "../lib/firebaseAdmin.js";
import { eq } from "drizzle-orm";
import { z } from "zod";

const r = Router();

// ── POST /register — called client-side after Firebase createUser ─────────────
// Creates the Postgres user record linked to the Firebase UID.
r.post("/register", async (req: Request, res: Response) => {
  try {
    const { idToken, firstName, lastName, firmName, jurisdiction, province } = z.object({
      idToken:      z.string(),
      firstName:    z.string().min(1),
      lastName:     z.string().min(1),
      firmName:     z.string().optional(),
      jurisdiction: z.enum(["CA", "US"]).default("CA"),
      province:     z.string().optional(),
    }).parse(req.body);

    // Verify the Firebase token
    const decoded = await verifyFirebaseToken(idToken);
    const jur = jurisdiction as "CA" | "US";
    const target = getDb(jur);

    // Check if user already exists
    const [existing] = await target.select({ id: users.id })
      .from(users)
      .where(eq((users as any).firebaseUid, decoded.uid))
      .limit(1);

    if (existing) {
      const u = await getUser(existing.id, jur);
      return res.json({ user: u });
    }

    // 14-day trial
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const [u] = await (target.insert(users) as any).values({
      firebaseUid:        decoded.uid,
      email:              decoded.email ?? "",
      passwordHash:       "", // not used — Firebase handles auth
      firstName,
      lastName,
      firmName:           firmName ?? null,
      jurisdiction:       jur,
      province:           province ?? (jur === "CA" ? "ON" : null),
      subscriptionTier:   "trial",
      subscriptionStatus: "trialing",
      trialEndsAt,
    }).returning();

    // Auto-create financial profile
    await (target.insert(clients) as any).values({
      userId:    u.id,
      firstName,
      lastName,
      email:     decoded.email ?? null,
      jurisdiction: jur,
      province:  province ?? (jur === "CA" ? "ON" : null),
    }).onConflictDoNothing();

    res.status(201).json({ user: await getUser(u.id, jur) });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    console.error("[register]", e.message);
    res.status(500).json({ message: e.message ?? "Server error" });
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
    res.status(500).json({ message: e.message });
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
        email: users.email, jurisdiction: users.jurisdiction,
        province: users.province,
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
    res.status(500).json({ message: e.message });
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
    res.status(500).json({ message: e.message });
  }
});

export { r as authRouter };
