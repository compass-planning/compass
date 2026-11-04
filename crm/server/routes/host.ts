import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { eq } from "drizzle-orm";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { detectEmailProvider } from "../email/detect-provider";
import {
  subscriptionPlans, accountTypes, hostRoles,
  serviceCaseStatuses, serviceCasePriorities, hostInvoiceStatuses,
  hostUsers,
  insertServiceCaseSchema, insertServiceCaseNoteSchema,
  insertHostInvoiceSchema, insertHostPayableSchema, insertHostStaffSchema,
} from "@shared/schema";

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
  res.json(await storage.getServiceCases(companyId));
});

hostRouter.get("/cases/:id", isAuthenticated, requireHostRole("admin", "service"), async (req, res) => {
  const c = await storage.getServiceCase(Number(req.params.id));
  if (!c) return res.status(404).json({ message: "Case not found" });
  res.json(c);
});

hostRouter.post("/cases", isAuthenticated, requireHostRole("admin", "service"), async (req: any, res) => {
  try {
    const existing = await storage.getServiceCases();
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
  res.json(await storage.getHostInvoices(companyId));
});

hostRouter.post("/invoices", isAuthenticated, requireHostRole("admin", "accounting"), async (req, res) => {
  try {
    const existing = await storage.getHostInvoices();
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
