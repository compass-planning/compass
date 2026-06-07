/**
 * server/routes/admin.ts
 *
 * Admin-only API. Completely separate from the user-facing auth.
 * Mount at /api/admin in server/index.ts.
 *
 * Endpoints:
 *   POST   /api/admin/login
 *   GET    /api/admin/me
 *   GET    /api/admin/stats            — dashboard summary counts
 *   GET    /api/admin/users            — paginated user list
 *   GET    /api/admin/users/:id        — single user detail
 *   PATCH  /api/admin/users/:id        — update subscription status / notes
 *   GET    /api/admin/tickets          — support ticket list
 *   POST   /api/admin/tickets          — create ticket (admin-side)
 *   PATCH  /api/admin/tickets/:id      — update ticket status / notes
 *   POST   /api/admin/seed             — create first super-admin (one-time, disabled after)
 */

import { Router, type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../db/index.js";
import { adminUsers, users, supportTickets } from "../../shared/schema.js";
import { eq, desc, ilike, or, count, sql } from "drizzle-orm";
import { z } from "zod";

const r = Router();

const ADMIN_SECRET = process.env.ADMIN_JWT_SECRET ?? process.env.JWT_SECRET ?? "admin-change-me";
const ADMIN_TTL    = 8 * 3600; // 8 hours

// ── Token helpers ─────────────────────────────────────────────────────────────

function signAdminToken(id: number, role: string): string {
  return jwt.sign({ sub: id, role, adm: true }, ADMIN_SECRET, { expiresIn: ADMIN_TTL });
}

interface AdminReq extends Request {
  adminId?: number;
  adminRole?: string;
}

function requireAdmin(req: AdminReq, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Unauthorized" });
  try {
    const p = jwt.verify(h.slice(7), ADMIN_SECRET) as any;
    if (!p.adm) return res.status(403).json({ message: "Not an admin token" });
    req.adminId   = +p.sub;
    req.adminRole = p.role;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired admin token" });
  }
}

function requireSuper(req: AdminReq, res: Response, next: NextFunction) {
  if (req.adminRole !== "super") return res.status(403).json({ message: "Super-admin only" });
  next();
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────
r.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({
      email:    z.string().email(),
      password: z.string().min(1),
    }).parse(req.body);

    const [a] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    if (!a || !await bcrypt.compare(password, a.passwordHash))
      return res.status(401).json({ message: "Invalid email or password" });

    res.json({
      token: signAdminToken(a.id, a.role),
      admin: { id: a.id, email: a.email, name: a.name, role: a.role },
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/admin/me ─────────────────────────────────────────────────────────
r.get("/me", requireAdmin, async (req: AdminReq, res: Response) => {
  const [a] = await db.select({
    id: adminUsers.id, email: adminUsers.email,
    name: adminUsers.name, role: adminUsers.role,
  }).from(adminUsers).where(eq(adminUsers.id, req.adminId!)).limit(1);
  if (!a) return res.status(404).json({ message: "Admin not found" });
  res.json(a);
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
r.get("/stats", requireAdmin, async (_req: AdminReq, res: Response) => {
  try {
    const [totals] = await db.select({
      total:    count(),
      trialing: sql<number>`count(*) filter (where subscription_status = 'trialing')`,
      active:   sql<number>`count(*) filter (where subscription_status = 'active')`,
      pastDue:  sql<number>`count(*) filter (where subscription_status = 'past_due')`,
      canceled: sql<number>`count(*) filter (where subscription_status = 'canceled')`,
      monthly:  sql<number>`count(*) filter (where subscription_tier = 'monthly' and subscription_status = 'active')`,
      annual:   sql<number>`count(*) filter (where subscription_tier = 'annual' and subscription_status = 'active')`,
    }).from(users);

    const [tickets] = await db.select({
      open:       sql<number>`count(*) filter (where status = 'open')`,
      inProgress: sql<number>`count(*) filter (where status = 'in_progress')`,
      urgent:     sql<number>`count(*) filter (where priority = 'urgent' and status not in ('resolved','closed'))`,
    }).from(supportTickets);

    // Trial expiring within 3 days
    const [expiringSoon] = await db.select({ count: count() }).from(users).where(
      sql`subscription_status = 'trialing' AND trial_ends_at BETWEEN NOW() AND NOW() + INTERVAL '3 days'`
    );

    res.json({ users: totals, tickets, expiringSoon: expiringSoon.count });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/admin/users ──────────────────────────────────────────────────────
r.get("/users", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const page   = Math.max(1, +(req.query.page ?? 1));
    const limit  = Math.min(100, +(req.query.limit ?? 50));
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;

    let query = db.select({
      id:                 users.id,
      email:              users.email,
      firstName:          users.firstName,
      lastName:           users.lastName,
      jurisdiction:       users.jurisdiction,
      subscriptionTier:   users.subscriptionTier,
      subscriptionStatus: users.subscriptionStatus,
      trialEndsAt:        users.trialEndsAt,
      currentPeriodEnd:   users.currentPeriodEnd,
      stripeCustomerId:   users.stripeCustomerId,
      createdAt:          users.createdAt,
    }).from(users).$dynamic();

    if (search) {
      query = query.where(or(
        ilike(users.email, `%${search}%`),
        ilike(users.firstName, `%${search}%`),
        ilike(users.lastName, `%${search}%`),
      )) as any;
    }
    if (status) {
      query = query.where(eq(users.subscriptionStatus, status)) as any;
    }

    const rows = await query
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ total }] = await db.select({ total: count() }).from(users);
    res.json({ users: rows, total, page, limit });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/admin/users/:id ──────────────────────────────────────────────────
r.get("/users/:id", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const [u] = await db.select().from(users).where(eq(users.id, +req.params.id)).limit(1);
    if (!u) return res.status(404).json({ message: "User not found" });

    // Recent tickets for this user
    const tickets = await db.select().from(supportTickets)
      .where(eq(supportTickets.userId, u.id))
      .orderBy(desc(supportTickets.createdAt))
      .limit(10);

    res.json({ ...u, tickets });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── PATCH /api/admin/users/:id ────────────────────────────────────────────────
r.patch("/users/:id", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const body = z.object({
      subscriptionTier:   z.enum(["trial", "monthly", "annual"]).optional(),
      subscriptionStatus: z.enum(["trialing", "active", "past_due", "canceled"]).optional(),
      trialEndsAt:        z.string().datetime().nullable().optional(),
      currentPeriodEnd:   z.string().datetime().nullable().optional(),
    }).parse(req.body);

    const update: any = { ...body, updatedAt: new Date() };
    if (body.trialEndsAt)     update.trialEndsAt     = new Date(body.trialEndsAt);
    if (body.currentPeriodEnd) update.currentPeriodEnd = new Date(body.currentPeriodEnd);

    const [u] = await db.update(users).set(update)
      .where(eq(users.id, +req.params.id))
      .returning({ id: users.id, email: users.email, subscriptionTier: users.subscriptionTier, subscriptionStatus: users.subscriptionStatus });

    if (!u) return res.status(404).json({ message: "User not found" });
    res.json(u);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── GET /api/admin/tickets ────────────────────────────────────────────────────
r.get("/tickets", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const page   = Math.max(1, +(req.query.page ?? 1));
    const limit  = Math.min(100, +(req.query.limit ?? 50));
    const status = req.query.status as string | undefined;

    let query = db.select().from(supportTickets).$dynamic();
    if (status) query = query.where(eq(supportTickets.status, status)) as any;

    const rows = await query
      .orderBy(desc(supportTickets.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ total }] = await db.select({ total: count() }).from(supportTickets);
    res.json({ tickets: rows, total, page, limit });
  } catch (e: any) {
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/admin/tickets ───────────────────────────────────────────────────
r.post("/tickets", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const body = z.object({
      userId:    z.number().int().optional(),
      userEmail: z.string().email().optional(),
      subject:   z.string().min(1),
      body:      z.string().min(1),
      priority:  z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      notes:     z.string().optional(),
    }).parse(req.body);

    const [ticket] = await db.insert(supportTickets).values({
      ...body,
      assignedTo: req.adminId,
      status: "open",
    }).returning();

    res.status(201).json(ticket);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── PATCH /api/admin/tickets/:id ──────────────────────────────────────────────
r.patch("/tickets/:id", requireAdmin, async (req: AdminReq, res: Response) => {
  try {
    const body = z.object({
      status:     z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
      priority:   z.enum(["low", "normal", "high", "urgent"]).optional(),
      assignedTo: z.number().int().nullable().optional(),
      notes:      z.string().optional(),
    }).parse(req.body);

    const update: any = { ...body, updatedAt: new Date() };
    if (body.status === "resolved") update.resolvedAt = new Date();

    const [ticket] = await db.update(supportTickets).set(update)
      .where(eq(supportTickets.id, +req.params.id))
      .returning();

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });
    res.json(ticket);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

// ── POST /api/admin/seed ──────────────────────────────────────────────────────
// Creates the first super-admin. Disabled once any admin exists.
r.post("/seed", async (req: Request, res: Response) => {
  try {
    const existing = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
    if (existing.length) return res.status(409).json({ message: "Admin already exists. Use admin login." });

    // Require a seed secret to prevent unauthorized use
    const { email, password, name, seedSecret } = z.object({
      email:      z.string().email(),
      password:   z.string().min(12),
      name:       z.string().min(1),
      seedSecret: z.string(),
    }).parse(req.body);

    if (seedSecret !== process.env.ADMIN_SEED_SECRET)
      return res.status(403).json({ message: "Invalid seed secret" });

    const hash = await bcrypt.hash(password, 12);
    const [a] = await db.insert(adminUsers).values({
      email, passwordHash: hash, name, role: "super",
    }).returning({ id: adminUsers.id, email: adminUsers.email, name: adminUsers.name, role: adminUsers.role });

    res.status(201).json({ message: "Super-admin created.", admin: a });
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0]?.message });
    res.status(500).json({ message: e.message });
  }
});

export { r as adminRouter };
