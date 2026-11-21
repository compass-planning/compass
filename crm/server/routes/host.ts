import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { storage, ALL_COMPANIES } from "../storage";
import { isAuthenticated } from "../auth";
import { detectEmailProvider } from "../email/detect-provider";
import {
  subscriptionPlans, accountTypes, hostRoles,
  serviceCaseStatuses, serviceCasePriorities, hostInvoiceStatuses,
  hostUsers,
  insertServiceCaseSchema, insertServiceCaseNoteSchema,
  insertHostInvoiceSchema, insertHostPayableSchema, insertHostStaffSchema,
} from "@shared/schema";

import { pool } from "../db";
import { recordEvent } from "../security";

export const hostRouter = Router();

// ── Host role middleware ──────────────────────────────────────────────────────

const requireHostRole = (...roles: string[]) => {
  return async (req: any, res: any, next: any) => {
    if (req.session?.userType !== "host" || !req.session?.hostUserId) {
      return res.status(403).json({ message: "Host portal access required" });
    }
    const hostUser = await storage.getHostUser(req.session.hostUserId);
    if (!hostUser || !hostUser.isActive) {
      return res.status(403).json({ message: "Host portal access required" });
    }
    if (roles.length > 0) {
      const hasRole = roles.some(r => (hostUser.roles as string[]).includes(r));
      if (!hasRole) return res.status(403).json({ message: "Insufficient host portal permissions" });
    }
    req.hostUser = hostUser;
    next();
  };
};

async function getSuperAdminId(): Promise<number | null> {
  const allHostUsers = await storage.getHostUsers();
  const admins = allHostUsers
    .filter(u => (u.roles as string[]).includes("admin"))
    .sort((a, b) => a.id - b.id);
  return admins.length > 0 ? admins[0].id : null;
}

// ── Me ────────────────────────────────────────────────────────────────────────

hostRouter.get("/me", isAuthenticated, async (req: any, res) => {
  if (req.session?.userType !== "host" || !req.session?.hostUserId) {
    return res.json({ isHostUser: false });
  }
  const hostUser = await storage.getHostUser(req.session.hostUserId);
  if (!hostUser) return res.json({ isHostUser: false });
  res.json({ isHostUser: true, ...hostUser });
});

hostRouter.patch("/me", isAuthenticated, async (req: any, res) => {
  if (req.session?.userType !== "host" || !req.session?.hostUserId) {
    return res.status(403).json({ message: "Host portal access required" });
  }
  try {
    const input = z.object({
      firstName: z.string().min(1).optional(),
      lastName: z.string().min(1).optional(),
      phone: z.string().optional().nullable(),
    }).parse(req.body);
    res.json(await storage.updateHostUser(req.session.hostUserId, input));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

// ── Companies ─────────────────────────────────────────────────────────────────

hostRouter.get("/companies", isAuthenticated, requireHostRole("admin", "sales", "manager"), async (_req, res) => {
  const allCompanies = await storage.getAllCompanies();
  const companiesWithCounts = await Promise.all(
    allCompanies.map(async c => ({ ...c, userCount: (await storage.getStaffMembers(c.id)).length }))
  );
  res.json(companiesWithCounts);
});

hostRouter.get("/companies/:id", isAuthenticated, requireHostRole("admin", "sales", "manager"), async (req, res) => {
  const company = await storage.getCompany(Number(req.params.id));
  if (!company) return res.status(404).json({ message: "Company not found" });
  res.json({ ...company, userCount: (await storage.getStaffMembers(company.id)).length });
});

hostRouter.patch("/companies/:id", isAuthenticated, requireHostRole("admin", "sales"), async (req, res) => {
  try {
    const updates = z.object({
      name: z.string().min(1).optional(),
      plan: z.enum(subscriptionPlans).optional(),
      accountType: z.enum(accountTypes).optional(),
      contactName: z.string().optional(),
      billingEmail: z.string().email().optional(),
      corporateAddress: z.string().optional(),
      corporatePhone: z.string().optional(),
    }).parse(req.body);
    res.json(await storage.updateCompany(Number(req.params.id), updates as any));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.get("/companies/:id/staff", isAuthenticated, requireHostRole("admin", "sales", "manager"), async (req, res) => {
  const staffMembers = await storage.getStaffMembers(Number(req.params.id));
  res.json(staffMembers.map(m => ({
    id: m.id, firstName: m.firstName, lastName: m.lastName,
    email: m.email, role: m.role, isAdmin: m.isAdmin, createdAt: m.createdAt,
  })));
});

// ── Service cases ─────────────────────────────────────────────────────────────

hostRouter.get("/cases", isAuthenticated, requireHostRole("admin", "service"), async (req: any, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  res.json(await storage.getServiceCases(companyId ?? ALL_COMPANIES));
});

hostRouter.get("/cases/:id", isAuthenticated, requireHostRole("admin", "service"), async (req, res) => {
  const c = await storage.getServiceCase(Number(req.params.id));
  if (!c) return res.status(404).json({ message: "Case not found" });
  res.json(c);
});

hostRouter.post("/cases", isAuthenticated, requireHostRole("admin", "service"), async (req: any, res) => {
  try {
    const existing = await storage.getServiceCases(ALL_COMPANIES);
    const caseNumber = `SVC-${String(existing.length + 1).padStart(5, "0")}`;
    const input = insertServiceCaseSchema.parse({ ...req.body, caseNumber, createdById: req.hostUser.id });
    res.status(201).json(await storage.createServiceCase(input));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.patch("/cases/:id", isAuthenticated, requireHostRole("admin", "service"), async (req, res) => {
  try {
    const updates = z.object({
      title: z.string().optional(), description: z.string().optional(),
      status: z.enum(serviceCaseStatuses).optional(),
      priority: z.enum(serviceCasePriorities).optional(),
      assignedToId: z.number().optional(),
    }).parse(req.body);
    if (updates.status === "resolved") (updates as any).resolvedAt = new Date();
    res.json(await storage.updateServiceCase(Number(req.params.id), updates as any));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.get("/cases/:id/notes", isAuthenticated, requireHostRole("admin", "service"), async (req, res) => {
  res.json(await storage.getServiceCaseNotes(Number(req.params.id)));
});

hostRouter.post("/cases/:id/notes", isAuthenticated, requireHostRole("admin", "service"), async (req: any, res) => {
  try {
    const input = insertServiceCaseNoteSchema.parse({
      ...req.body, caseId: Number(req.params.id), authorId: req.hostUser.id,
    });
    res.json(await storage.createServiceCaseNote(input));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

// ── Invoices ──────────────────────────────────────────────────────────────────

hostRouter.get("/invoices", isAuthenticated, requireHostRole("admin", "accounting"), async (req: any, res) => {
  const companyId = req.query.companyId ? Number(req.query.companyId) : undefined;
  res.json(await storage.getHostInvoices(companyId ?? ALL_COMPANIES));
});

hostRouter.post("/invoices", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    const existing = await storage.getHostInvoices(ALL_COMPANIES);
    const invoiceNumber = `INV-${String(existing.length + 1).padStart(5, "0")}`;
    res.status(201).json(await storage.createHostInvoice(insertHostInvoiceSchema.parse({ ...req.body, invoiceNumber })));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.patch("/invoices/:id", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    const updates = z.object({
      amount: z.string().optional(), description: z.string().optional(),
      status: z.enum(hostInvoiceStatuses).optional(),
      dueDate: z.string().optional(), paidDate: z.string().optional(),
    }).parse(req.body);
    res.json(await storage.updateHostInvoice(Number(req.params.id), updates as any));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

// ── Payables ──────────────────────────────────────────────────────────────────

hostRouter.get("/payables", isAuthenticated, requireHostRole("admin", "accounting"), async (_req, res) => {
  res.json(await storage.getHostPayables());
});

hostRouter.post("/payables", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    res.status(201).json(await storage.createHostPayable(insertHostPayableSchema.parse(req.body)));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.patch("/payables/:id", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    const updates = z.object({
      vendorName: z.string().optional(), amount: z.string().optional(),
      description: z.string().optional(), status: z.string().optional(),
      dueDate: z.string().optional(), paidDate: z.string().optional(),
    }).parse(req.body);
    res.json(await storage.updateHostPayable(Number(req.params.id), updates as any));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

// ── HR ────────────────────────────────────────────────────────────────────────

hostRouter.get("/hr", isAuthenticated, requireHostRole("admin", "accounting"), async (_req, res) => {
  res.json(await storage.getHostStaffMembers());
});

hostRouter.post("/hr", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    res.status(201).json(await storage.createHostStaffMember(insertHostStaffSchema.parse(req.body)));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.patch("/hr/:id", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    const updates = z.object({
      firstName: z.string().optional(), lastName: z.string().optional(),
      email: z.string().optional(), phone: z.string().optional(),
      department: z.string().optional(), position: z.string().optional(),
      salary: z.string().optional(), isActive: z.boolean().optional(),
    }).parse(req.body);
    res.json(await storage.updateHostStaffMember(Number(req.params.id), updates as any));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

// ── Analytics ─────────────────────────────────────────────────────────────────

hostRouter.get("/analytics", isAuthenticated, requireHostRole("admin", "manager", "development"), async (_req, res) => {
  const analytics = await storage.getHostAnalytics();
  res.json({ ...analytics, uptime: 99.97, bandwidthUsageMB: 4280 });
});

// ── Host users ────────────────────────────────────────────────────────────────

hostRouter.get("/users", isAuthenticated, requireHostRole("admin"), async (_req, res) => {
  res.json(await storage.getHostUsers());
});

hostRouter.post("/users", isAuthenticated, requireHostRole("admin"), async (req, res) => {
  try {
    const { tempPassword, ...body } = req.body;
    const input = z.object({
      firstName: z.string().min(1), lastName: z.string().min(1),
      email: z.string().email(), phone: z.string().optional(),
      roles: z.array(z.enum(hostRoles)),
    }).parse(body);
    if (tempPassword && (typeof tempPassword !== "string" || tempPassword.length < 6)) {
      return res.status(400).json({ message: "Temporary password must be at least 6 characters" });
    }
    let passwordHash: string | undefined;
    if (tempPassword) passwordHash = await bcrypt.hash(tempPassword, 12);
    const newUser = await storage.createHostUser({ ...input, passwordHash });
    await storage.createEmailConfiguration({
      hostUserId: newUser.id,
      provider: detectEmailProvider(newUser.email),
      config: {}, isActive: false,
    });
    res.status(201).json(newUser);
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.patch("/users/:id", isAuthenticated, requireHostRole("admin"), async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const target = await storage.getHostUser(id);
    if (!target) return res.status(404).json({ message: "Host user not found" });
    const input = z.object({
      firstName: z.string().min(1).optional(), lastName: z.string().min(1).optional(),
      phone: z.string().optional().nullable(),
      roles: z.array(z.enum(hostRoles)).optional(),
      isActive: z.boolean().optional(),
    }).parse(req.body);
    const superAdminId = await getSuperAdminId();
    if (id === superAdminId) {
      if (input.isActive === false) {
        return res.status(403).json({ message: "The primary super-admin account cannot be deactivated" });
      }
      if (input.roles && !input.roles.includes("admin")) {
        return res.status(403).json({ message: "The primary super-admin account must retain the admin role" });
      }
    }
    res.json(await storage.updateHostUser(id, input));
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
    throw err;
  }
});

hostRouter.delete("/users/:id", isAuthenticated, requireHostRole("admin"), async (req: any, res) => {
  const id = Number(req.params.id);
  const target = await storage.getHostUser(id);
  if (!target) return res.status(404).json({ message: "Host user not found" });
  const superAdminId = await getSuperAdminId();
  if (id === superAdminId) {
    return res.status(403).json({ message: "The primary super-admin account cannot be deleted" });
  }
  if (id === req.session.hostUserId) {
    return res.status(403).json({ message: "You cannot delete your own account" });
  }
  await db.delete(hostUsers).where(eq(hostUsers.id, id));
  res.status(204).send();
});

hostRouter.post("/users/:id/set-password", isAuthenticated, requireHostRole("admin"), async (req, res) => {
  const id = Number(req.params.id);
  const target = await storage.getHostUser(id);
  if (!target) return res.status(404).json({ message: "Host user not found" });
  const { password } = req.body;
  if (!password || typeof password !== "string" || password.length < 12) {
    return res.status(400).json({ message: "Password must be at least 12 characters" });
  }
  await storage.updateHostUser(id, { passwordHash: await bcrypt.hash(password, 12) });
  res.json({ message: "Password set successfully" });
});


// ── Security events (login failures, lockouts, MFA failures, new devices) ─────
// Read by the app-management team while they monitor the platform. Data comes from security_events (server/security.ts).

const SECURITY_ROLES = ["admin", "accounting", "manager"];
const SEC_RANGES: Record<string, string> = { "24h": "24 hours", "7d": "7 days", "30d": "30 days" };
const APP_FILTER = (v: any): "crm" | "planning" | null => (v === "crm" || v === "planning" ? v : null);

hostRouter.get("/security/summary", isAuthenticated, requireHostRole(...SECURITY_ROLES), async (req: any, res) => {
  try {
    const range = SEC_RANGES[String(req.query.range)] ?? SEC_RANGES["24h"];
    const app = APP_FILTER(req.query.app);
    const counts = await pool.query(
      `SELECT type, count(*)::int AS n FROM security_events WHERE created_at > now() - $1::interval AND ($2::text IS NULL OR app = $2) GROUP BY type`, [range, app]);
    const byType: Record<string, number> = {};
    for (const r of counts.rows) byType[r.type] = r.n;
    const locked = await pool.query(
      `SELECT s.id, s.email, s.first_name, s.last_name, s.locked_until, s.last_failed_login_at, c.name AS company
         FROM staff s LEFT JOIN companies c ON c.id = s.company_id
        WHERE s.locked_until IS NOT NULL AND s.locked_until > now() ORDER BY s.locked_until DESC LIMIT 100`);
    const lockedRows: any[] = app === "planning" ? [] : locked.rows.map((r: any) => ({ ...r, app: "crm" }));
    if (app !== "crm") {
      const pl = await pool.query(
        `SELECT l.email, l.locked_until, l.last_failed_at AS last_failed_login_at, u.first_name, u.last_name
           FROM public.planning_lockouts l LEFT JOIN public.users u ON lower(u.email) = l.email
          WHERE l.locked_until IS NOT NULL AND l.locked_until > now() ORDER BY l.locked_until DESC LIMIT 100`);
      for (const r of pl.rows) lockedRows.push({ id: null, email: r.email, first_name: r.first_name, last_name: r.last_name, locked_until: r.locked_until, last_failed_login_at: r.last_failed_login_at, company: null, app: "planning" });
    }
    const ips = await pool.query(
      `SELECT ip, count(*)::int AS failures, count(DISTINCT lower(email))::int AS accounts, max(created_at) AS last_seen
         FROM security_events WHERE type = 'login_failed' AND ip IS NOT NULL AND created_at > now() - $1::interval AND ($2::text IS NULL OR app = $2)
        GROUP BY ip ORDER BY failures DESC LIMIT 10`, [range, app]);
    res.json({ range: String(req.query.range || "24h"), app: app ?? "all", counts: byType, locked: lockedRows, topIps: ips.rows });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

hostRouter.get("/security/events", isAuthenticated, requireHostRole(...SECURITY_ROLES), async (req: any, res) => {
  try {
    const range = SEC_RANGES[String(req.query.range)] ?? SEC_RANGES["24h"];
    const types = String(req.query.type || "").split(",").map((t) => t.trim()).filter(Boolean);
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const params: any[] = [range, limit, APP_FILTER(req.query.app)];
    let typeSql = "";
    if (types.length) { params.push(types); typeSql = `AND e.type = ANY($${params.length}::text[])`; }
    const r = await pool.query(
      `SELECT e.id, e.created_at, e.type, e.email, e.ip, e.user_agent, e.detail, e.staff_id, e.app, c.name AS company
         FROM security_events e LEFT JOIN companies c ON c.id = e.company_id
        WHERE e.created_at > now() - $1::interval AND ($3::text IS NULL OR e.app = $3) ${typeSql}
        ORDER BY e.created_at DESC LIMIT $2`, params);
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** Lift a lockout early (e.g. the real user is locked out after an attack). Admin only. */
hostRouter.post("/security/unlock/:staffId", isAuthenticated, requireHostRole("admin"), async (req: any, res) => {
  try {
    const id = Number(req.params.staffId);
    const r = await pool.query(`UPDATE staff SET locked_until = NULL, failed_login_count = 0 WHERE id = $1 RETURNING email, company_id`, [id]);
    if (!r.rowCount) return res.status(404).json({ message: "Staff member not found" });
    await recordEvent("account_unlocked" as any, req, { email: r.rows[0].email, staffId: id, companyId: r.rows[0].company_id, detail: { by: req.hostUser?.email } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

/** Lift a Compass Planning lockout early. Admin only. */
hostRouter.post("/security/unlock-planning", isAuthenticated, requireHostRole("admin"), async (req: any, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ message: "email required" });
    const r = await pool.query(`UPDATE public.planning_lockouts SET locked_until = NULL, failed_count = 0 WHERE email = $1`, [email]);
    if (!r.rowCount) return res.status(404).json({ message: "No lockout found for that email" });
    await pool.query(
      `INSERT INTO security_events (type, email, ip, user_agent, detail, app) VALUES ('account_unlocked', $1, $2, $3, $4, 'planning')`,
      [email, req.ip ?? null, String(req.headers["user-agent"] || "").slice(0, 300), JSON.stringify({ by: req.hostUser?.email })]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Unified admin area — accounts & billing, uptime, PIPEDA, client-reported issues.
// Covers both apps: Compass CRM (crm schema) and Compass Planning (public schema, same database).
// ═══════════════════════════════════════════════════════════════════════════════

const ACCOUNT_ROLES = ["admin", "accounting", "sales", "manager"];
const UPTIME_ROLES = ["admin", "manager", "development"];
const PRIVACY_ROLES = ["admin", "manager"];
const ISSUE_ROLES = ["admin", "service", "manager"];
const fail = (res: any, err: any) => res.status(500).json({ message: err?.message ?? "Server error" });

// ── Accounts & billing ────────────────────────────────────────────────────────

hostRouter.get("/accounts", isAuthenticated, requireHostRole(...ACCOUNT_ROLES), async (req: any, res) => {
  try {
    const app = APP_FILTER(req.query.app);
    const rows: any[] = [];
    if (app !== "planning") {
      const r = await pool.query(
        `SELECT c.id, c.name, coalesce(c.billing_email, c.contact_name) AS email, c.plan, c.account_type, c.created_at,
                (SELECT count(*)::int FROM staff s WHERE s.company_id = c.id) AS users,
                (SELECT max(s.last_login_at) FROM staff s WHERE s.company_id = c.id) AS last_login
           FROM companies c ORDER BY c.created_at DESC`);
      for (const c of r.rows) rows.push({ app: "crm", id: c.id, name: c.name, email: c.email, plan: c.plan, status: "active", trialEndsAt: null, periodEnd: null, users: c.users, createdAt: c.created_at, lastLogin: c.last_login, hasStripe: false });
    }
    if (app !== "crm") {
      const r = await pool.query(
        `SELECT u.id, u.first_name, u.last_name, u.firm_name, u.email, u.subscription_tier, u.subscription_status, u.trial_ends_at, u.current_period_end,
                u.stripe_customer_id, u.created_at, u.account_type,
                (SELECT max(e.created_at) FROM security_events e WHERE e.app = 'planning' AND e.type = 'login_success' AND lower(e.email) = lower(u.email)) AS last_login
           FROM public.users u ORDER BY u.created_at DESC`);
      for (const u of r.rows) rows.push({ app: "planning", id: u.id, name: u.firm_name || `${u.first_name} ${u.last_name}`, email: u.email, plan: u.subscription_tier, status: u.subscription_status, trialEndsAt: u.trial_ends_at, periodEnd: u.current_period_end, users: 1, createdAt: u.created_at, lastLogin: u.last_login, hasStripe: !!u.stripe_customer_id });
    }
    const prices = await pool.query(`SELECT app, plan, monthly_price::float AS p FROM plan_prices`);
    const price = new Map(prices.rows.map((p: any) => [`${p.app}:${p.plan}`, p.p]));
    let mrr = 0;
    const byStatus: Record<string, number> = {};
    for (const a of rows) {
      a.monthly = price.get(`${a.app}:${a.plan}`) ?? 0;
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
      if (a.status === "active") mrr += a.monthly;
    }
    const q = String(req.query.q || "").toLowerCase().trim();
    const out = q ? rows.filter((a) => `${a.name} ${a.email}`.toLowerCase().includes(q)) : rows;
    res.json({
      summary: { total: rows.length, crm: rows.filter((a) => a.app === "crm").length, planning: rows.filter((a) => a.app === "planning").length, byStatus, mrr },
      accounts: out.slice(0, 1000),
    });
  } catch (err) { fail(res, err); }
});

hostRouter.get("/plan-prices", isAuthenticated, requireHostRole(...ACCOUNT_ROLES), async (_req, res) => {
  try {
    const plans = await pool.query(`SELECT 'crm' AS app, plan FROM companies GROUP BY plan UNION SELECT 'planning', subscription_tier FROM public.users GROUP BY subscription_tier`);
    const saved = await pool.query(`SELECT app, plan, monthly_price::float AS price FROM plan_prices`);
    const m = new Map(saved.rows.map((p: any) => [`${p.app}:${p.plan}`, p.price]));
    const keys = new Set<string>(plans.rows.map((p: any) => `${p.app}:${p.plan}`).concat(Array.from(m.keys())));
    res.json(Array.from(keys).sort().map((k) => { const [app, plan] = k.split(":"); return { app, plan, price: m.get(k) ?? 0 }; }));
  } catch (err) { fail(res, err); }
});

hostRouter.put("/plan-prices", isAuthenticated, requireHostRole("admin", "accounting"), async (req: any, res) => {
  try {
    const { app, plan, price } = req.body ?? {};
    if (!["crm", "planning"].includes(app) || !plan || !(Number(price) >= 0)) return res.status(400).json({ message: "app, plan and a non-negative price are required" });
    await pool.query(`INSERT INTO plan_prices (app, plan, monthly_price) VALUES ($1,$2,$3) ON CONFLICT (app, plan) DO UPDATE SET monthly_price = EXCLUDED.monthly_price`, [app, String(plan), Number(price)]);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ── Uptime / downtime ─────────────────────────────────────────────────────────

hostRouter.get("/uptime/summary", isAuthenticated, requireHostRole(...UPTIME_ROLES), async (req: any, res) => {
  try {
    const range = SEC_RANGES[String(req.query.range)] ?? SEC_RANGES["24h"];
    const since = await pool.query(`SELECT least(min(checked_at), (SELECT min(started_at) FROM incidents)) AS first, max(checked_at) AS last FROM uptime_checks`);
    const stats = await pool.query(
      `SELECT count(*)::int AS checks, count(*) FILTER (WHERE ok)::int AS ok_checks, round(avg(latency_ms))::int AS avg_ms, max(latency_ms)::int AS max_ms
         FROM uptime_checks WHERE checked_at > now() - $1::interval`, [range]);
    const down = await pool.query(
      `SELECT coalesce(sum(greatest(0, extract(epoch FROM (least(coalesce(ended_at, now()), now()) - greatest(started_at, now() - $1::interval))))), 0)::float AS secs
         FROM incidents WHERE coalesce(ended_at, now()) > now() - $1::interval AND kind <> 'note'`, [range]);
    const windowSecs = (await pool.query(`SELECT extract(epoch FROM (now() - greatest(coalesce($2::timestamp, now()), now() - $1::interval)))::float AS s`, [range, since.rows[0].first])).rows[0].s;
    const downSecs = Math.min(down.rows[0].secs, Math.max(windowSecs, 1));
    const last = await pool.query(`SELECT checked_at, ok, latency_ms, detail, extract(epoch FROM (now() - checked_at))::float AS age FROM uptime_checks ORDER BY checked_at DESC LIMIT 1`);
    const lastAgeSecs: number | null = last.rows[0] ? last.rows[0].age : null;
    const incidents = await pool.query(
      `SELECT id, started_at, ended_at, kind, source, detail, note, extract(epoch FROM (coalesce(ended_at, now()) - started_at))::int AS seconds
         FROM incidents WHERE coalesce(ended_at, now()) > now() - $1::interval ORDER BY started_at DESC LIMIT 100`, [range]);
    res.json({
      range: String(req.query.range || "24h"), monitoringSince: since.rows[0].first, lastCheck: last.rows[0] ?? null,
      status: !last.rows[0] ? "unknown" : (lastAgeSecs! > 180 ? "stale" : last.rows[0].ok ? "up" : "down"),
      uptimePct: windowSecs > 0 ? Math.max(0, Math.round((1 - downSecs / windowSecs) * 10000) / 100) : null,
      downSeconds: Math.round(downSecs), checks: stats.rows[0], incidents: incidents.rows,
    });
  } catch (err) { fail(res, err); }
});

/** Record an outage seen from outside (e.g. your external pinger) or add a note to an incident. */
hostRouter.post("/uptime/incidents", isAuthenticated, requireHostRole("admin", "development"), async (req: any, res) => {
  try {
    const { startedAt, endedAt, note } = req.body ?? {};
    const s = new Date(startedAt), e = endedAt ? new Date(endedAt) : null;
    if (isNaN(s.getTime()) || (e && (isNaN(e.getTime()) || e < s))) return res.status(400).json({ message: "Valid start (and end after start) required" });
    const r = await pool.query(`INSERT INTO incidents (started_at, ended_at, kind, source, note) VALUES ($1,$2,'manual','admin',$3) RETURNING id`, [s, e, String(note ?? "").slice(0, 1000)]);
    res.status(201).json(r.rows[0]);
  } catch (err) { fail(res, err); }
});

hostRouter.patch("/uptime/incidents/:id", isAuthenticated, requireHostRole("admin", "development"), async (req: any, res) => {
  try {
    await pool.query(`UPDATE incidents SET note = $2 WHERE id = $1`, [Number(req.params.id), String(req.body?.note ?? "").slice(0, 1000)]);
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ── PIPEDA monitoring ─────────────────────────────────────────────────────────

const REQUEST_KINDS = ["access", "erasure", "correction", "withdraw_consent", "complaint", "other"];

hostRouter.get("/pipeda/summary", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (_req, res) => {
  try {
    const b = await pool.query(
      `SELECT count(*) FILTER (WHERE status <> 'closed')::int AS open,
              count(*) FILTER (WHERE status <> 'closed' AND rrosh = 'real_risk' AND (opc_notified_at IS NULL OR individuals_notified_at IS NULL))::int AS notify_needed,
              count(*) FILTER (WHERE status <> 'closed' AND rrosh = 'unassessed')::int AS unassessed,
              count(*) FILTER (WHERE discovered_at > current_date - interval '24 months')::int AS last_24m
         FROM privacy_breaches`);
    const rq = await pool.query(
      `SELECT count(*) FILTER (WHERE status = 'open')::int AS open,
              count(*) FILTER (WHERE status = 'open' AND due_at < current_date)::int AS overdue,
              count(*) FILTER (WHERE status = 'open' AND due_at BETWEEN current_date AND current_date + 7)::int AS due_soon FROM privacy_requests`);
    const purges = await pool.query(
      `SELECT id, email, purge_requested_at, purge_at FROM public.users WHERE purge_requested_at IS NOT NULL ORDER BY purge_at ASC LIMIT 100`);
    const consent = await pool.query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE consent_data_processing IS NOT TRUE)::int AS no_processing,
              count(*) FILTER (WHERE consent_marketing)::int AS marketing,
              count(*) FILTER (WHERE consent_crm_sharing)::int AS crm_sharing FROM public.users`);
    const events = await pool.query(
      `SELECT count(*) FILTER (WHERE type = 'password_reset_done')::int AS resets, count(*) FILTER (WHERE type = 'account_locked')::int AS locks
         FROM security_events WHERE created_at > now() - interval '30 days'`);
    res.json({
      breaches: b.rows[0], requests: rq.rows[0],
      pendingPurges: purges.rows.map((p: any) => ({ ...p, overdue: new Date(p.purge_at) < new Date() })),
      consent: consent.rows[0], last30d: events.rows[0],
    });
  } catch (err) { fail(res, err); }
});

hostRouter.get("/pipeda/breaches", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (_req, res) => {
  try { res.json((await pool.query(`SELECT * FROM privacy_breaches ORDER BY discovered_at DESC, id DESC LIMIT 500`)).rows); }
  catch (err) { fail(res, err); }
});

const BREACH_FIELDS: Record<string, "text" | "date" | "int" | "bool"> = {
  discovered_at: "date", occurred_at: "date", description: "text", data_types: "text", individuals_affected: "int", apps: "text",
  rrosh: "text", contained: "bool", opc_notified_at: "date", individuals_notified_at: "date", status: "text", notes: "text",
};
const BREACH_ENUMS: Record<string, string[]> = { apps: ["crm", "planning", "both"], rrosh: ["unassessed", "low", "real_risk"], status: ["open", "investigating", "contained", "closed"] };
function cleanFields(body: any, spec: Record<string, string>, enums: Record<string, string[]>): { cols: string[]; vals: any[] } | string {
  const cols: string[] = [], vals: any[] = [];
  for (const [k, t] of Object.entries(spec)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (!(camel in (body ?? {})) && !(k in (body ?? {}))) continue;
    let v = body[camel] ?? body[k];
    if (v === "" || v === undefined) v = null;
    if (v !== null) {
      if (t === "date") { if (isNaN(new Date(v).getTime())) return `${k} must be a date`; v = String(v).slice(0, 10); }
      else if (t === "int") { v = Number(v); if (!Number.isInteger(v) || v < 0) return `${k} must be a whole number`; }
      else if (t === "bool") v = !!v;
      else { v = String(v).slice(0, 5000); if (enums[k] && !enums[k].includes(v)) return `${k} must be one of ${enums[k].join(", ")}`; }
    }
    cols.push(k); vals.push(v);
  }
  return { cols, vals };
}

hostRouter.post("/pipeda/breaches", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (req: any, res) => {
  try {
    const c = cleanFields(req.body, BREACH_FIELDS, BREACH_ENUMS);
    if (typeof c === "string") return res.status(400).json({ message: c });
    if (!c.cols.includes("description") || !c.cols.includes("discovered_at") || c.vals[c.cols.indexOf("description")] == null || c.vals[c.cols.indexOf("discovered_at")] == null)
      return res.status(400).json({ message: "description and discovered_at are required" });
    c.cols.push("created_by"); c.vals.push(req.hostUser?.email ?? null);
    const r = await pool.query(`INSERT INTO privacy_breaches (${c.cols.join(",")}) VALUES (${c.cols.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, c.vals);
    res.status(201).json(r.rows[0]);
  } catch (err) { fail(res, err); }
});

hostRouter.patch("/pipeda/breaches/:id", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (req: any, res) => {
  try {
    const c = cleanFields(req.body, BREACH_FIELDS, BREACH_ENUMS);
    if (typeof c === "string") return res.status(400).json({ message: c });
    if (!c.cols.length) return res.status(400).json({ message: "Nothing to update" });
    const r = await pool.query(`UPDATE privacy_breaches SET ${c.cols.map((k, i) => `${k} = $${i + 2}`).join(",")} WHERE id = $1 RETURNING *`, [Number(req.params.id), ...c.vals]);
    if (!r.rowCount) return res.status(404).json({ message: "Not found" });
    res.json(r.rows[0]);
  } catch (err) { fail(res, err); }
});

hostRouter.get("/pipeda/requests", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (_req, res) => {
  try { res.json((await pool.query(`SELECT * FROM privacy_requests ORDER BY (status = 'open') DESC, due_at ASC LIMIT 500`)).rows); }
  catch (err) { fail(res, err); }
});

hostRouter.post("/pipeda/requests", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (req: any, res) => {
  try {
    const { app, email, kind, receivedAt, notes } = req.body ?? {};
    if (!email || !REQUEST_KINDS.includes(kind)) return res.status(400).json({ message: `email and kind (${REQUEST_KINDS.join(", ")}) required` });
    const recv = receivedAt ? new Date(receivedAt) : new Date();
    if (isNaN(recv.getTime())) return res.status(400).json({ message: "receivedAt must be a date" });
    const due = new Date(recv.getTime() + 30 * 86400000); // PIPEDA: respond within 30 days
    const r = await pool.query(
      `INSERT INTO privacy_requests (app, email, kind, received_at, due_at, notes, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [["crm", "planning"].includes(app) ? app : "crm", String(email).toLowerCase().trim(), kind, recv.toISOString().slice(0, 10), due.toISOString().slice(0, 10), String(notes ?? "").slice(0, 2000), req.hostUser?.email ?? null]);
    res.status(201).json(r.rows[0]);
  } catch (err) { fail(res, err); }
});

hostRouter.patch("/pipeda/requests/:id", isAuthenticated, requireHostRole(...PRIVACY_ROLES), async (req: any, res) => {
  try {
    const { status, notes } = req.body ?? {};
    if (status && !["open", "completed", "refused"].includes(status)) return res.status(400).json({ message: "status must be open, completed or refused" });
    const r = await pool.query(
      `UPDATE privacy_requests SET status = coalesce($2, status), notes = coalesce($3, notes),
              completed_at = CASE WHEN $2 IN ('completed','refused') THEN current_date WHEN $2 = 'open' THEN NULL ELSE completed_at END WHERE id = $1 RETURNING *`,
      [Number(req.params.id), status ?? null, notes ?? null]);
    if (!r.rowCount) return res.status(404).json({ message: "Not found" });
    res.json(r.rows[0]);
  } catch (err) { fail(res, err); }
});

// ── Issues reported by clients (both apps) ────────────────────────────────────
// CRM reports are service_cases; Planning reports are support_tickets. Priorities are normalised to low/normal/high/urgent.

const CRM_TO_UNI: Record<string, string> = { low: "low", medium: "normal", high: "high", critical: "urgent" };
const UNI_TO_CRM: Record<string, string> = { low: "low", normal: "medium", high: "high", urgent: "critical" };

hostRouter.get("/issues", isAuthenticated, requireHostRole(...ISSUE_ROLES), async (req: any, res) => {
  try {
    const app = APP_FILTER(req.query.app);
    const status = ["open", "in_progress", "resolved", "closed"].includes(String(req.query.status)) ? String(req.query.status) : null;
    const out: any[] = [];
    if (app !== "planning") {
      const r = await pool.query(
        `SELECT sc.id, sc.case_number, sc.title, sc.description, sc.status, sc.priority, sc.created_at, sc.resolved_at, c.name AS company,
                (SELECT string_agg(n.note, E'\n— ' ORDER BY n.created_at) FROM service_case_notes n WHERE n.case_id = sc.id) AS notes
           FROM service_cases sc LEFT JOIN companies c ON c.id = sc.company_id WHERE ($1::text IS NULL OR sc.status = $1) ORDER BY sc.created_at DESC LIMIT 300`, [status]);
      for (const x of r.rows) out.push({ app: "crm", id: x.id, ref: x.case_number, title: x.title, description: x.description, status: x.status, priority: CRM_TO_UNI[x.priority] ?? "normal", from: x.company ?? "—", createdAt: x.created_at, resolvedAt: x.resolved_at, notes: x.notes });
    }
    if (app !== "crm") {
      const r = await pool.query(
        `SELECT id, subject, body, status, priority, user_email, created_at, resolved_at, notes FROM public.support_tickets WHERE ($1::text IS NULL OR status = $1) ORDER BY created_at DESC LIMIT 300`, [status]);
      for (const x of r.rows) out.push({ app: "planning", id: x.id, ref: `PLN-${String(x.id).padStart(5, "0")}`, title: x.subject, description: x.body, status: x.status, priority: x.priority, from: x.user_email ?? "—", createdAt: x.created_at, resolvedAt: x.resolved_at, notes: x.notes });
    }
    out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const open = out.filter((i) => i.status === "open" || i.status === "in_progress").length;
    res.json({ open, issues: out });
  } catch (err) { fail(res, err); }
});

hostRouter.patch("/issues/:app/:id", isAuthenticated, requireHostRole(...ISSUE_ROLES), async (req: any, res) => {
  try {
    const { status, priority, note } = req.body ?? {};
    if (status && !["open", "in_progress", "resolved", "closed"].includes(status)) return res.status(400).json({ message: "Invalid status" });
    if (priority && !UNI_TO_CRM[priority]) return res.status(400).json({ message: "Invalid priority" });
    const id = Number(req.params.id);
    const done = status === "resolved" || status === "closed";
    if (req.params.app === "crm") {
      const r = await pool.query(
        `UPDATE service_cases SET status = coalesce($2, status), priority = coalesce($3, priority), updated_at = now(),
                resolved_at = CASE WHEN $4 THEN now() WHEN $2 IS NOT NULL THEN NULL ELSE resolved_at END WHERE id = $1 RETURNING id`,
        [id, status ?? null, priority ? UNI_TO_CRM[priority] : null, done]);
      if (!r.rowCount) return res.status(404).json({ message: "Not found" });
      if (note) await pool.query(`INSERT INTO service_case_notes (case_id, author_id, note) VALUES ($1,$2,$3)`, [id, req.hostUser?.id ?? null, String(note).slice(0, 5000)]);
    } else if (req.params.app === "planning") {
      const stamp = note ? `[${new Date().toISOString().slice(0, 16).replace("T", " ")} ${req.hostUser?.email ?? "admin"}] ${String(note).slice(0, 2000)}` : null;
      const r = await pool.query(
        `UPDATE public.support_tickets SET status = coalesce($2, status), priority = coalesce($3, priority), updated_at = now(),
                resolved_at = CASE WHEN $4 THEN now() WHEN $2 IS NOT NULL THEN NULL ELSE resolved_at END,
                notes = CASE WHEN $5::text IS NULL THEN notes ELSE coalesce(notes || E'\n', '') || $5 END WHERE id = $1 RETURNING id`,
        [id, status ?? null, priority ?? null, done, stamp]);
      if (!r.rowCount) return res.status(404).json({ message: "Not found" });
    } else return res.status(400).json({ message: "Unknown app" });
    res.json({ ok: true });
  } catch (err) { fail(res, err); }
});

// ── One-glance overview for the admin landing ─────────────────────────────────

hostRouter.get("/overview", isAuthenticated, requireHostRole(), async (req: any, res) => {
  try {
    const roles: string[] = req.hostUser?.roles ?? [];
    const has = (...r: string[]) => r.some((x) => roles.includes(x));
    const o: any = {};
    if (has(...UPTIME_ROLES)) {
      const last = await pool.query(`SELECT ok, extract(epoch FROM (now() - checked_at))::float AS age FROM uptime_checks ORDER BY checked_at DESC LIMIT 1`);
      const age: number | null = last.rows[0] ? last.rows[0].age : null;
      o.uptime = { status: !last.rows[0] ? "unknown" : age! > 180 ? "stale" : last.rows[0].ok ? "up" : "down" };
    }
    if (has(...SECURITY_ROLES)) {
      const s = await pool.query(`SELECT count(*) FILTER (WHERE type IN ('account_locked','ip_burst_alert','mfa_failed'))::int AS alerts FROM security_events WHERE created_at > now() - interval '24 hours'`);
      o.security = s.rows[0];
    }
    if (has(...ISSUE_ROLES)) {
      const i = await pool.query(`SELECT (SELECT count(*) FROM service_cases WHERE status IN ('open','in_progress'))::int + (SELECT count(*) FROM public.support_tickets WHERE status IN ('open','in_progress'))::int AS open`);
      o.issues = i.rows[0];
    }
    if (has(...PRIVACY_ROLES)) {
      const p = await pool.query(
        `SELECT (SELECT count(*) FROM privacy_breaches WHERE status <> 'closed')::int AS open_breaches,
                (SELECT count(*) FROM privacy_requests WHERE status = 'open' AND due_at < current_date)::int AS overdue_requests`);
      o.privacy = p.rows[0];
    }
    if (has(...ACCOUNT_ROLES)) {
      const a = await pool.query(
        `SELECT (SELECT count(*) FROM companies)::int + (SELECT count(*) FROM public.users)::int AS accounts,
                (SELECT count(*) FROM public.users WHERE subscription_status IN ('past_due','unpaid'))::int AS past_due`);
      o.accounts = a.rows[0];
    }
    res.json(o);
  } catch (err) { fail(res, err); }
});
