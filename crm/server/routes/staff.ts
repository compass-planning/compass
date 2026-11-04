import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { validatePassword } from "../auth/passwordPolicy";
import { eq, and } from "drizzle-orm";
import { storage } from "../storage";
import { api } from "@shared/routes";
import { staff, advisorAssignments, PLAN_DEFINITIONS } from "@shared/schema";
import { isAuthenticated } from "../auth";
import { detectEmailProvider } from "../email/detect-provider";
import {
  getStaffFromSession, getCompanyId, requireRole,
  redactStaffSensitiveFields, denyHostUsers,
} from "./middleware";

export const staffRouter = Router();

// ── Current user ──────────────────────────────────────────────────────────────

staffRouter.get("/api/staff/me", isAuthenticated, async (req: any, res) => {
  const member = await getStaffFromSession(req);
  if (!member) {
    return res.status(404).json({ message: "Staff profile not found. Contact your administrator." });
  }
  res.json(member);
});

staffRouter.patch("/api/staff/me/timezone", isAuthenticated, async (req: any, res) => {
  try {
    const member = await getStaffFromSession(req);
    if (!member) return res.status(404).json({ message: "Staff profile not found" });
    const validTimezones = Intl.supportedValuesOf("timeZone");
    const input = z.object({
      timezone: z.string().min(1).refine(tz => validTimezones.includes(tz), {
        message: "Invalid timezone",
      }),
    }).parse(req.body);
    const updated = await storage.updateStaffMember(member.id, { timezone: input.timezone });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    res.status(500).json({ message: "Failed to update timezone" });
  }
});

// ── Staff CRUD ────────────────────────────────────────────────────────────────

staffRouter.get("/api/staff", isAuthenticated, async (req: any, res) => {
  const companyId = await getCompanyId(req);
  const members = await storage.getStaffMembers(companyId);
  const caller = await getStaffFromSession(req);
  const canSeeSensitive =
    caller?.role === "general_manager" || caller?.role === "office_admin";
  res.json(
    canSeeSensitive
      ? members
      : members.map(m => redactStaffSensitiveFields(m as unknown as Record<string, unknown>))
  );
});

staffRouter.get("/api/staff/:id", isAuthenticated, async (req: any, res) => {
  const member = await storage.getStaffMember(Number(req.params.id));
  if (!member) return res.status(404).json({ message: "Staff member not found" });
  const companyId = await getCompanyId(req);
  if (companyId && member.companyId && member.companyId !== companyId) {
    return res.status(404).json({ message: "Staff member not found" });
  }
  const caller = await getStaffFromSession(req);
  const canSeeSensitive =
    caller?.role === "general_manager" || caller?.role === "office_admin";
  res.json(
    canSeeSensitive
      ? member
      : redactStaffSensitiveFields(member as unknown as Record<string, unknown>)
  );
});

staffRouter.post(
  "/api/staff",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    try {
      const { tempPassword, ...body } = req.body;
      const input = api.staff.create.input.parse(body);
      if (tempPassword && (typeof tempPassword !== "string" || tempPassword.length < 6)) {
        return res.status(400).json({
          message: "Temporary password must be at least 6 characters",
          field: "tempPassword",
        });
      }
      const protectedRoles = ["general_manager", "office_admin"];
      // Host users are super-admins — skip the role check.
      if (req.session?.userType !== "host" &&
          req.staffMember?.role === "office_admin" &&
          protectedRoles.includes(input.role)) {
        return res.status(403).json({ message: "Only the General Manager can assign this role" });
      }
      // For host users, companyId must be provided in the request body.
      // For staff users, it comes from their session.
      const companyId = req.session?.userType === "host"
        ? (Number(req.body.companyId) || undefined)
        : await getCompanyId(req);
      if (!companyId) {
        return res.status(400).json({ message: "companyId is required" });
      }
      const company = await storage.getCompany(companyId);
      if (company) {
        const currentPlan = PLAN_DEFINITIONS.find(p => p.id === company.plan);
        if (currentPlan && currentPlan.maxMembers !== -1) {
          const existingStaff = await storage.getStaffMembers(companyId);
          if (existingStaff.length >= currentPlan.maxMembers) {
            return res.status(403).json({
              message: `Your ${currentPlan.name} plan allows a maximum of ${currentPlan.maxMembers} users. Please upgrade your plan to add more team members.`,
            });
          }
        }
      }
      let passwordHash: string | undefined;
      if (tempPassword) {
        passwordHash = await bcrypt.hash(tempPassword, 12);
      }
      const member = await db.transaction(async tx => {
        const [created] = await tx.insert(staff).values({ ...input, companyId }).returning();
        if (passwordHash) {
          const [updated] = await tx
            .update(staff)
            .set({ passwordHash, mustChangePassword: true })
            .where(eq(staff.id, created.id))
            .returning();
          return updated;
        }
        return created;
      });
      const detectedProvider = detectEmailProvider(member.email);
      await storage.createEmailConfiguration({
        staffId: member.id,
        provider: detectedProvider,
        config: {},
        isActive: false,
      });
      res.status(201).json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  }
);

staffRouter.put(
  "/api/staff/:id",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    try {
      const existing = await storage.getStaffMember(Number(req.params.id));
      if (!existing) return res.status(404).json({ message: "Staff member not found" });
      const callerCompanyId = req.staffMember?.companyId;
      if (callerCompanyId && existing.companyId && existing.companyId !== callerCompanyId) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      const input = api.staff.update.input.parse(req.body);
      const protectedRoles = ["general_manager", "office_admin"];
      if (req.staffMember.role === "office_admin") {
        if (input.role && protectedRoles.includes(input.role)) {
          return res.status(403).json({ message: "Only the General Manager can assign this role" });
        }
        if (protectedRoles.includes(existing.role)) {
          return res.status(403).json({ message: "Only the General Manager can modify this user" });
        }
      }
      const member = await storage.updateStaffMember(Number(req.params.id), input);
      if (input.email && input.email !== existing.email) {
        const newProvider = detectEmailProvider(input.email);
        const existingConfig = await storage.getEmailConfiguration(existing.id);
        if (existingConfig) {
          await storage.updateEmailConfiguration(existingConfig.id, {
            provider: newProvider,
            config: {},
            isActive: false,
          });
        } else {
          await storage.createEmailConfiguration({
            staffId: existing.id,
            provider: newProvider,
            config: {},
            isActive: false,
          });
        }
        await storage.updateStaffMember(existing.id, { emailSetupSkipped: false });
      }
      res.json(member);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  }
);

staffRouter.delete(
  "/api/staff/:id",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    const existing = await storage.getStaffMember(Number(req.params.id));
    if (!existing) return res.status(404).json({ message: "Staff member not found" });
    const callerCompanyId = req.staffMember?.companyId;
    if (callerCompanyId && existing.companyId && existing.companyId !== callerCompanyId) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    const protectedRoles = ["general_manager", "office_admin"];
    if (req.staffMember.role === "office_admin" && protectedRoles.includes(existing.role)) {
      return res.status(403).json({ message: "Only the General Manager can remove this user" });
    }
    await storage.deleteStaffMember(Number(req.params.id));
    res.status(204).send();
  }
);

staffRouter.post(
  "/api/staff/:id/set-password",
  isAuthenticated,
  requireRole("general_manager", "office_admin", "sales_manager"),
  async (req: any, res) => {
    try {
      const targetId = Number(req.params.id);
      const { password } = req.body;
      const pwdCheck = validatePassword(password);
      if (!pwdCheck.valid) {
        return res.status(400).json({ message: pwdCheck.message });
      }
      const target = await storage.getStaffMember(targetId);
      if (!target) return res.status(404).json({ message: "Staff member not found" });
      const callerCompanyId = req.staffMember?.companyId;
      if (callerCompanyId && target.companyId !== callerCompanyId) {
        return res.status(404).json({ message: "Staff member not found" });
      }
      const protectedRoles = ["general_manager", "office_admin"];
      if (req.staffMember.role === "office_admin" && protectedRoles.includes(target.role)) {
        return res.status(403).json({
          message: "Only the General Manager can set passwords for this role",
        });
      }
      if (req.staffMember.role === "sales_manager") {
        const allowedTargetRoles = ["advisor_admin", "advisor"];
        if (!allowedTargetRoles.includes(target.role)) {
          return res.status(403).json({
            message: "Sales Managers can only reset passwords for advisors on their team",
          });
        }
        const [assignment] = await db
          .select()
          .from(advisorAssignments)
          .where(
            and(
              eq(advisorAssignments.adminId, req.staffMember.id),
              eq(advisorAssignments.advisorId, targetId)
            )
          );
        if (!assignment) {
          return res.status(403).json({
            message: "You can only reset passwords for advisors assigned to your team",
          });
        }
      }
      const hash = await bcrypt.hash(password, 12);
      await db
        .update(staff)
        .set({ passwordHash: hash, mustChangePassword: true })
        .where(eq(staff.id, targetId));
      res.json({ message: "Password set successfully" });
    } catch (_err) {
      res.status(500).json({ message: "Failed to set password" });
    }
  }
);

// ── Clients by advisor (SM drill-down) ────────────────────────────────────────

staffRouter.get("/api/staff/:advisorId/clients", isAuthenticated, async (req: any, res) => {
  const advisorId = Number(req.params.advisorId);
  if (isNaN(advisorId)) return res.status(400).json({ message: "Invalid advisor ID" });
  const companyId = await getCompanyId(req);
  const advisor = await storage.getStaffMember(advisorId);
  if (!advisor) return res.status(404).json({ message: "Staff member not found" });
  if (companyId && advisor.companyId && advisor.companyId !== companyId) {
    return res.status(404).json({ message: "Staff member not found" });
  }
  const caller = await getStaffFromSession(req);
  if (!caller) return res.status(403).json({ message: "Forbidden" });
  if (caller.role === "general_manager" || caller.role === "office_admin") {
    // full access
  } else if (caller.role === "sales_manager" || caller.role === "advisor_admin") {
    const assignments = await storage.getAdvisorAssignments();
    const isAssigned = assignments.some(a => a.adminId === caller.id && a.advisorId === advisorId);
    if (!isAssigned) return res.status(403).json({ message: "Forbidden" });
  } else if (caller.role === "advisor") {
    if (caller.id !== advisorId) return res.status(403).json({ message: "Forbidden" });
  } else {
    return res.status(403).json({ message: "Forbidden" });
  }
  const clients = await storage.getClientsByAdvisor(advisorId);
  res.json(clients);
});

staffRouter.get("/api/staff/:advisorId/clients-by-type", isAuthenticated, async (req: any, res) => {
  try {
    const advisorId = Number(req.params.advisorId);
    if (isNaN(advisorId)) return res.status(400).json({ message: "Invalid advisor ID" });
    const companyId = await getCompanyId(req);
    const advisor = await storage.getStaffMember(advisorId);
    if (!advisor) return res.status(404).json({ message: "Staff member not found" });
    if (companyId && advisor.companyId && advisor.companyId !== companyId) {
      return res.status(404).json({ message: "Staff member not found" });
    }
    const caller = await getStaffFromSession(req);
    if (!caller) return res.status(403).json({ message: "Forbidden" });
    if (caller.role === "general_manager" || caller.role === "office_admin") {
      // full access
    } else if (caller.role === "sales_manager" || caller.role === "advisor_admin") {
      const assignments = await storage.getAdvisorAssignments();
      const isAssigned = assignments.some(a => a.adminId === caller.id && a.advisorId === advisorId);
      if (!isAssigned) return res.status(403).json({ message: "Forbidden" });
    } else if (caller.role === "advisor") {
      if (caller.id !== advisorId) return res.status(403).json({ message: "Forbidden" });
    } else {
      return res.status(403).json({ message: "Forbidden" });
    }
    const filterType = req.query.type as string;
    const validTypes = ["leads", "pending", "insurance", "mutual_fund", "segregated_fund"] as const;
    if (!filterType || !validTypes.includes(filterType as (typeof validTypes)[number])) {
      return res.status(400).json({
        message: "Invalid type parameter. Must be one of: leads, pending, insurance, mutual_fund, segregated_fund",
      });
    }
    if (filterType === "leads") {
      const advisorLeads = await storage.getLeadsByAdvisor(advisorId);
      return res.json(advisorLeads);
    }
    const allClients = await storage.getClientsByAdvisor(advisorId);
    if (filterType === "pending") {
      const clientIds = allClients.map(c => c.id);
      const allProducts = await storage.getProductsByClientIds(clientIds);
      const pendingClientIds = new Set(
        allProducts.filter(p => p.status === "pending").map(p => p.clientId)
      );
      return res.json(allClients.filter(c => pendingClientIds.has(c.id)));
    }
    const clientIds = allClients.map(c => c.id);
    const allProducts = await storage.getProductsByClientIds(clientIds);
    const matchingClientIds = new Set(
      allProducts.filter(p => p.type === filterType).map(p => p.clientId)
    );
    res.json(allClients.filter(c => matchingClientIds.has(c.id)));
  } catch {
    res.status(500).json({ message: "Internal server error" });
  }
});

// ── Staff documents ───────────────────────────────────────────────────────────

staffRouter.get("/api/staff/:staffId/documents", isAuthenticated, async (req, res) => {
  const docs = await storage.getStaffDocuments(Number(req.params.staffId));
  res.json(docs);
});

staffRouter.post(
  "/api/staff/:staffId/documents",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req, res) => {
    try {
      const input = z
        .object({
          title: z.string().min(1),
          documentType: z.string().min(1),
          description: z.string().optional().nullable(),
          fileName: z.string().optional().nullable(),
          status: z.string().optional().default("active"),
        })
        .parse(req.body);
      const doc = await storage.createStaffDocument({
        ...input,
        staffId: Number(req.params.staffId),
      });
      res.status(201).json(doc);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join("."),
        });
      }
      throw err;
    }
  }
);

staffRouter.delete(
  "/api/staff-documents/:id",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req, res) => {
    await storage.deleteStaffDocument(Number(req.params.id));
    res.status(204).send();
  }
);

// ── Staff children ────────────────────────────────────────────────────────────

staffRouter.get("/api/staff/:staffId/children", isAuthenticated, async (req, res) => {
  const kids = await storage.getStaffChildren(Number(req.params.staffId));
  res.json(kids);
});

staffRouter.post("/api/staff/:staffId/children", isAuthenticated, async (req: any, res) => {
  try {
    const input = z
      .object({
        firstName: z.string().min(1),
        lastName: z.string().optional().nullable(),
        dateOfBirth: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const child = await storage.createStaffChild({
      ...input,
      staffId: Number(req.params.staffId),
    });
    res.status(201).json(child);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

staffRouter.put("/api/staff/:staffId/children/:childId", isAuthenticated, async (req: any, res) => {
  try {
    const input = z
      .object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().optional().nullable(),
        dateOfBirth: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
      .parse(req.body);
    const updated = await storage.updateStaffChild(Number(req.params.childId), input);
    res.json(updated);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

staffRouter.delete("/api/staff/:staffId/children/:childId", isAuthenticated, async (req, res) => {
  await storage.deleteStaffChild(Number(req.params.childId));
  res.status(204).send();
});

// ── Advisors by admin ────────────────────────────────────────────────────────

staffRouter.get("/api/staff/:adminId/advisors", isAuthenticated, async (req: any, res) => {
  const advisors = await storage.getAdvisorsByAdmin(Number(req.params.adminId));
  res.json(advisors);
});

// ── Advisor assignments ───────────────────────────────────────────────────────

staffRouter.get("/api/advisor-assignments", isAuthenticated, denyHostUsers, async (req: any, res) => {
  const companyId = await getCompanyId(req);
  const assignments = await storage.getAdvisorAssignments(companyId);
  res.json(assignments);
});

staffRouter.post(
  "/api/advisor-assignments",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req: any, res) => {
    try {
      const input = api.advisorAssignments.create.input.extend({
        adminId: z.coerce.number(),
        advisorId: z.coerce.number(),
      }).parse(req.body);

      const manager = await storage.getStaffMember(input.adminId);
      if (!manager || !["advisor_admin", "sales_manager"].includes(manager.role)) {
        return res.status(400).json({ message: "Manager must be an Advisor Admin or Sales Manager", field: "adminId" });
      }
      const teamMember = await storage.getStaffMember(input.advisorId);
      if (!teamMember || teamMember.role !== "advisor") {
        return res.status(400).json({ message: "Assigned member must be an advisor", field: "advisorId" });
      }

      const assignment = await storage.createAdvisorAssignment(input);
      res.status(201).json(assignment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join('.') });
      }
      throw err;
    }
  }
);

staffRouter.delete(
  "/api/advisor-assignments/:id",
  isAuthenticated,
  requireRole("general_manager", "office_admin"),
  async (req, res) => {
    await storage.deleteAdvisorAssignment(Number(req.params.id));
    res.status(204).send();
  }
);
