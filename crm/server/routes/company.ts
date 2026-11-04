import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { updateCompanySettingsSchema, PLAN_DEFINITIONS } from "@shared/schema";
import { getStaffFromSession, getCompanyId, requireRole } from "./middleware";

export const companyRouter = Router();

// ── Settings ──────────────────────────────────────────────────────────────────

companyRouter.get(
  "/api/company/settings",
  isAuthenticated,
  async (req: any, res) => {
    const companyId = await getCompanyId(req);
    if (!companyId)
      return res.status(404).json({ message: "No company found" });
    const company = await storage.getCompany(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });
    res.json(company);
  },
);

companyRouter.patch(
  "/api/company/settings",
  isAuthenticated,
  requireRole("general_manager"),
  async (req: any, res) => {
    try {
      const companyId = req.staffMember?.companyId;
      if (!companyId)
        return res.status(404).json({ message: "No company found" });
      const input = updateCompanySettingsSchema.parse(req.body);
      const company = await storage.getCompany(companyId);
      if (!company)
        return res.status(404).json({ message: "Company not found" });

      if (input.plan) {
        const targetPlan = PLAN_DEFINITIONS.find((p) => p.id === input.plan);
        if (!targetPlan)
          return res.status(400).json({ message: "Invalid plan" });
        if (targetPlan.maxMembers !== -1) {
          const existingStaff = await storage.getStaffMembers(companyId);
          if (existingStaff.length > targetPlan.maxMembers) {
            return res.status(400).json({
              message: `Cannot downgrade to ${targetPlan.name}: you have ${existingStaff.length} users but this plan allows only ${targetPlan.maxMembers}.`,
            });
          }
        }
        const moduleUpdates: Record<string, boolean> = {};
        for (const key of Object.keys(targetPlan.includedModules) as Array<
          keyof typeof targetPlan.includedModules
        >) {
          if (targetPlan.includedModules[key]) {
            moduleUpdates[key] = true;
          } else if (targetPlan.addonModules[key]) {
            moduleUpdates[key] = company[key] === true;
          } else {
            moduleUpdates[key] = false;
          }
        }
        Object.assign(input, moduleUpdates);
      }

      if (
        input.accountType &&
        input.accountType !== company.accountType &&
        !input.plan
      ) {
        const currentPlan = PLAN_DEFINITIONS.find((p) => p.id === company.plan);
        if (
          currentPlan &&
          !currentPlan.accountTypes.includes(
            input.accountType as "single_advisor" | "multi_member",
          )
        ) {
          return res.status(400).json({
            message: `Your current plan (${currentPlan.name}) is not compatible with ${input.accountType === "single_advisor" ? "Solo Advisor" : "Multi-Member"} accounts. Please change your plan first.`,
          });
        }
      }

      res.json(await storage.updateCompany(companyId, input));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: err.errors[0].message,
            field: err.errors[0].path.join("."),
          });
      }
      throw err;
    }
  },
);

companyRouter.patch(
  "/api/company/modules",
  isAuthenticated,
  requireRole("general_manager"),
  async (req: any, res) => {
    try {
      const companyId = req.staffMember?.companyId;
      if (!companyId)
        return res.status(404).json({ message: "No company found" });
      const moduleSchema = z.object({
        moduleEmail: z.boolean().optional(),
        moduleCalendar: z.boolean().optional(),
        moduleInsurance: z.boolean().optional(),
        moduleMutualFund: z.boolean().optional(),
        moduleSegFund: z.boolean().optional(),
        moduleMeetingRecorder: z.boolean().optional(),
        moduleAnalytics: z.boolean().optional(),
        modulePipeline: z.boolean().optional(),
        moduleFinancialPlanning: z.boolean().optional(),
      });
      const input = moduleSchema.parse(req.body);
      const company = await storage.getCompany(companyId);
      if (!company)
        return res.status(404).json({ message: "Company not found" });
      const currentPlan = PLAN_DEFINITIONS.find((p) => p.id === company.plan);
      if (currentPlan) {
        for (const key of Object.keys(input) as (keyof typeof input)[]) {
          const moduleKey = key as keyof typeof currentPlan.includedModules;
          if (currentPlan.includedModules[moduleKey]) {
            input[key] = true;
          } else if (
            input[key] === true &&
            !currentPlan.addonModules[moduleKey]
          ) {
            return res.status(403).json({
              message: `Your current plan (${currentPlan.name}) does not support this module. Upgrade your plan to enable it.`,
            });
          }
        }
      }
      res.json(await storage.updateCompany(companyId, input));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res
          .status(400)
          .json({
            message: err.errors[0].message,
            field: err.errors[0].path.join("."),
          });
      }
      throw err;
    }
  },
);

companyRouter.get("/api/company/plans", isAuthenticated, async (_req, res) => {
  res.json(PLAN_DEFINITIONS);
});

// ── Dashboard stats ───────────────────────────────────────────────────────────

companyRouter.get(
  "/api/dashboard/stats",
  isAuthenticated,
  async (req: any, res) => {
    const currentStaff = await getStaffFromSession(req);
    if (!currentStaff?.companyId) {
      return res.json({
        totalAUM: 0,
        activeClients: 0,
        leadsCount: 0,
        pendingSales: 0,
      });
    }

    const staffIdParam = req.query.staffId ? Number(req.query.staffId) : null;
    const role = currentStaff.role;

    let clientsList: { id: number; advisorId: number | null }[];
    let leadsList: { id: number; stage: string }[];

    if (staffIdParam) {
      if (role === "advisor" && staffIdParam !== currentStaff.id) {
        return res.json({
          totalAUM: 0,
          activeClients: 0,
          leadsCount: 0,
          pendingSales: 0,
        });
      }
      if (role === "advisor_admin" || role === "sales_manager") {
        const assignedAdvisors = await storage.getAdvisorsByAdmin(
          currentStaff.id,
        );
        if (
          staffIdParam !== currentStaff.id &&
          !assignedAdvisors.map((a) => a.id).includes(staffIdParam)
        ) {
          return res.json({
            totalAUM: 0,
            activeClients: 0,
            leadsCount: 0,
            pendingSales: 0,
          });
        }
      }
      const targetStaff = await storage.getStaffMember(staffIdParam);
      if (!targetStaff || targetStaff.companyId !== currentStaff.companyId) {
        return res.json({
          totalAUM: 0,
          activeClients: 0,
          leadsCount: 0,
          pendingSales: 0,
        });
      }
      clientsList = await storage.getClientsByAdvisor(staffIdParam);
      leadsList = await storage.getLeadsByAdvisor(staffIdParam);
    } else if (role === "advisor") {
      clientsList = await storage.getClientsByAdvisor(currentStaff.id);
      leadsList = await storage.getLeadsByAdvisor(currentStaff.id);
    } else if (role === "advisor_admin" || role === "sales_manager") {
      const assignedAdvisors = await storage.getAdvisorsByAdmin(
        currentStaff.id,
      );
      const teamIds = [currentStaff.id, ...assignedAdvisors.map((a) => a.id)];
      clientsList = await storage.getClientsByAdvisors(teamIds);
      leadsList = await storage.getLeadsByAdvisors(teamIds);
    } else {
      const companyStaff = await storage.getStaffMembers(
        currentStaff.companyId,
      );
      const staffIds = companyStaff.map((s) => s.id);
      clientsList =
        staffIds.length > 0
          ? await storage.getClientsByAdvisors(staffIds)
          : await storage.getClients(currentStaff.companyId);
      leadsList = await storage.getLeads(currentStaff.companyId);
    }

    let totalAUM = 0;
    for (const client of clientsList) {
      const prods = await storage.getProductsByClient(client.id);
      for (const p of prods) {
        if (p.status === "active") totalAUM += parseFloat(p.value) || 0;
      }
    }

    res.json({
      totalAUM,
      activeClients: clientsList.length,
      leadsCount: leadsList.filter((l) => !l.stage || l.stage !== "closed_won")
        .length,
      pendingSales: leadsList.filter((l) => l.stage === "proposal").length,
    });
  },
);
