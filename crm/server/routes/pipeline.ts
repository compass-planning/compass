import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { isAuthenticated } from "../auth";
import { getStaffFromSession, getCompanyId, _verifyClientOwnership, validateClientAdvisorAssignment } from "./middleware";

export const pipelineRouter = Router();

const validStages = ["lead", "contacted", "opportunity", "proposal", "closed_won", "follow_up"] as const;
const validSources = ["referral", "cold_call", "website", "social_media", "event", "partner", "other"] as const;
const validProductInterests = ["insurance", "mutual_fund", "segregated_fund"] as const;

async function canAccessLead(req: any, lead: { companyId: number | null; advisorId: number | null }): Promise<boolean> {
  const currentStaff = await getStaffFromSession(req);
  if (!currentStaff) return false;
  return currentStaff.companyId === lead.companyId;
}

// ── Leads ─────────────────────────────────────────────────────────────────────

pipelineRouter.get("/", isAuthenticated, async (req: any, res) => {
  const currentStaff = await getStaffFromSession(req);
  if (!currentStaff?.companyId) return res.json([]);
  res.json(await storage.getLeads(currentStaff.companyId));
});

pipelineRouter.get("/:id", isAuthenticated, async (req: any, res) => {
  const lead = await storage.getLead(Number(req.params.id));
  if (!lead || !(await canAccessLead(req, lead))) {
    return res.status(404).json({ message: "Lead not found" });
  }
  res.json(lead);
});

pipelineRouter.post("/", isAuthenticated, async (req: any, res) => {
  try {
    const input = z.object({
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      stage: z.enum(validStages).optional().default("lead"),
      source: z.enum(validSources).optional().nullable(),
      productInterest: z.enum(validProductInterests).optional().nullable(),
      notes: z.string().optional().nullable(),
      advisorId: z.coerce.number({ required_error: "A sales rep must be assigned" }),
    }).refine(data => data.email || data.phone, {
      message: "At least one of email or phone is required",
    }).parse(req.body);

    if (!(await validateClientAdvisorAssignment(req, res, input.advisorId))) return;
    const companyId = await getCompanyId(req);
    const lead = await storage.createLead({ ...input, companyId });

    if (input.advisorId) {
      const currentStaff = await getStaffFromSession(req);
      if (!currentStaff || currentStaff.id !== input.advisorId) {
        try {
          await storage.createNotification({
            companyId: companyId ?? null,
            recipientStaffId: input.advisorId,
            type: "lead_assigned",
            title: "New Lead Assigned",
            message: `Lead "${input.firstName} ${input.lastName}" has been assigned to you.`,
            relatedEntityType: "lead",
            relatedEntityId: lead.id,
            isRead: false,
          });
        } catch { /* ignore notification errors */ }
      }
    }

    res.status(201).json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
    }
    throw err;
  }
});

pipelineRouter.put("/:id", isAuthenticated, async (req: any, res) => {
  try {
    const leadId = Number(req.params.id);
    const existing = await storage.getLead(leadId);
    if (!existing || !(await canAccessLead(req, existing))) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const input = z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      stage: z.enum(validStages).optional(),
      source: z.enum(validSources).optional().nullable(),
      productInterest: z.enum(validProductInterests).optional().nullable(),
      notes: z.string().optional().nullable(),
      advisorId: z.coerce.number().optional(),
    }).parse(req.body);

    // Leads may only be reassigned to people the caller is allowed to assign to (sales managers: GM, self, own advisors).
    if (input.advisorId !== undefined && input.advisorId !== existing.advisorId && !(await validateClientAdvisorAssignment(req, res, input.advisorId))) return;

    let stageHistory: string | undefined;
    if (input.stage && input.stage !== existing.stage) {
      let history: Array<{ stage: string; date: string }> = [];
      try { history = JSON.parse(existing.stageHistory || "[]"); } catch { history = []; }
      history.push({ stage: input.stage, date: new Date().toISOString() });
      stageHistory = JSON.stringify(history);
    }

    const updatePayload: Record<string, unknown> = { ...input, ...(stageHistory ? { stageHistory } : {}) };

    if (input.stage === "opportunity" && existing.stage !== "opportunity" && !existing.convertedClientId) {
      const mergedFirstName = input.firstName || existing.firstName;
      const mergedLastName = input.lastName || existing.lastName;
      const client = await storage.createClient({
        companyId: existing.companyId,
        advisorId: input.advisorId !== undefined ? input.advisorId : existing.advisorId,
        firstName: mergedFirstName,
        lastName: mergedLastName,
        email: (input.email !== undefined ? input.email : existing.email) ||
          `${mergedFirstName.toLowerCase()}.${mergedLastName.toLowerCase()}@pending.com`,
        phone: input.phone !== undefined ? input.phone : existing.phone,
        notes: input.notes !== undefined ? input.notes : existing.notes,
      });
      updatePayload.convertedClientId = client.id;
      let history: Array<{ stage: string; date: string }> = [];
      try { history = JSON.parse(stageHistory || existing.stageHistory || "[]"); } catch { history = []; }
      history.push({ stage: "converted", date: new Date().toISOString() });
      updatePayload.stageHistory = JSON.stringify(history);
    }

    const lead = await storage.updateLead(leadId, updatePayload as Partial<typeof existing>);

    if (input.advisorId && input.advisorId !== existing.advisorId) {
      const currentStaff = await getStaffFromSession(req);
      if (!currentStaff || currentStaff.id !== input.advisorId) {
        try {
          await storage.createNotification({
            companyId: existing.companyId,
            recipientStaffId: input.advisorId,
            type: "lead_assigned",
            title: "Lead Reassigned to You",
            message: `Lead "${lead.firstName} ${lead.lastName}" has been assigned to you.`,
            relatedEntityType: "lead",
            relatedEntityId: lead.id,
            isRead: false,
          });
        } catch { /* ignore */ }
      }
    }

    res.json(lead);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message, field: err.errors[0].path.join(".") });
    }
    throw err;
  }
});

pipelineRouter.delete("/:id", isAuthenticated, async (req: any, res) => {
  const lead = await storage.getLead(Number(req.params.id));
  if (!lead || !(await canAccessLead(req, lead))) {
    return res.status(404).json({ message: "Lead not found" });
  }
  await storage.deleteLead(lead.id);
  res.status(204).send();
});

// ── Lead activities ───────────────────────────────────────────────────────────

pipelineRouter.get("/:leadId/activities", isAuthenticated, async (req: any, res) => {
  const lead = await storage.getLead(Number(req.params.leadId));
  if (!lead || !(await canAccessLead(req, lead))) {
    return res.status(404).json({ message: "Lead not found" });
  }
  res.json(await storage.getLeadActivities(lead.id));
});

pipelineRouter.post("/:leadId/activities", isAuthenticated, async (req: any, res) => {
  try {
    const lead = await storage.getLead(Number(req.params.leadId));
    if (!lead || !(await canAccessLead(req, lead))) {
      return res.status(404).json({ message: "Lead not found" });
    }
    const input = z.object({
      type: z.string().min(1),
      title: z.string().min(1),
      description: z.string().optional().nullable(),
    }).parse(req.body);
    const currentStaff = await getStaffFromSession(req);
    res.status(201).json(
      await storage.createLeadActivity({ ...input, leadId: lead.id, staffId: currentStaff?.id ?? null })
    );
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: err.errors[0].message });
    }
    throw err;
  }
});

pipelineRouter.delete("/activities/:id", isAuthenticated, async (req: any, res) => {
  const activity = await storage.getLeadActivity(Number(req.params.id));
  if (!activity) return res.status(404).json({ message: "Activity not found" });
  const lead = await storage.getLead(activity.leadId);
  if (!lead || !(await canAccessLead(req, lead))) {
    return res.status(404).json({ message: "Activity not found" });
  }
  await storage.deleteLeadActivity(activity.id);
  res.status(204).send();
});
