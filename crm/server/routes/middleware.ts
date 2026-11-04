import type { _Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, _and } from "drizzle-orm";
import {
  educationSavings, debtEntries, taxPlanningNotes, estatePlanningNotes,
  estateAnalyses, cashFlowBudgets, aiRecommendations, children, documents,
  activities, products, meetings, financialPlans, netWorthEntries,
  retirementProjections, insuranceAnalyses, planActionItems, planAssumptions,
} from "@shared/schema";

// ── Session helpers ──────────────────────────────────────────────────────────

export async function getStaffFromSession(req: any) {
  const staffId = req.session?.staffId;
  if (!staffId) return null;
  return await storage.getStaffMember(staffId);
}

export async function getCompanyId(req: any): Promise<number | undefined> {
  const member = await getStaffFromSession(req);
  return member?.companyId ?? undefined;
}

// ── Role enforcement ─────────────────────────────────────────────────────────

export const requireRole = (...roles: string[]) => {
  return async (req: any, res: Response, next: NextFunction) => {
    const member = await getStaffFromSession(req);
    if (!member || !roles.includes(member.role)) {
      return res.status(403).json({ message: "Forbidden: insufficient permissions" });
    }
    req.staffMember = member;
    next();
  };
};

export const denyHostUsers = async (req: any, res: Response, next: NextFunction) => {
  if (req.session?.userType === "host") {
    return res.status(403).json({ message: "Host portal users cannot access brokerage resources" });
  }
  next();
};

// ── Ownership verification ────────────────────────────────────────────────────

export async function verifyClientOwnership(
  req: any, res: Response, clientId: number
): Promise<boolean> {
  const companyId = await getCompanyId(req);
  if (!companyId) { res.status(403).json({ message: "Access denied" }); return false; }
  const client = await storage.getClient(clientId);
  if (!client || client.companyId !== companyId) {
    res.status(403).json({ message: "Access denied" }); return false;
  }
  return true;
}

export async function verifyFpRecordOwnership(
  req: any,
  res: Response,
  table: typeof educationSavings | typeof debtEntries | typeof taxPlanningNotes
    | typeof estatePlanningNotes | typeof estateAnalyses | typeof cashFlowBudgets
    | typeof aiRecommendations | typeof children | typeof documents | typeof activities
    | typeof products | typeof meetings | typeof financialPlans | typeof netWorthEntries
    | typeof retirementProjections | typeof insuranceAnalyses,
  recordId: number
): Promise<boolean> {
  const companyId = await getCompanyId(req);
  if (!companyId) { res.status(403).json({ message: "Access denied" }); return false; }
  const [record] = await db.select({ clientId: table.clientId }).from(table).where(eq(table.id, recordId));
  if (!record) { res.status(404).json({ message: "Record not found" }); return false; }
  const client = await storage.getClient(record.clientId);
  if (!client || client.companyId !== companyId) {
    res.status(403).json({ message: "Access denied" }); return false;
  }
  return true;
}

export async function verifyPlanChildOwnership(
  req: any,
  res: Response,
  table: typeof planActionItems | typeof planAssumptions,
  recordId: number
): Promise<boolean> {
  const companyId = await getCompanyId(req);
  if (!companyId) { res.status(403).json({ message: "Access denied" }); return false; }
  const [record] = await db.select({ planId: table.planId }).from(table).where(eq(table.id, recordId));
  if (!record) { res.status(404).json({ message: "Record not found" }); return false; }
  const [plan] = await db.select({ clientId: financialPlans.clientId }).from(financialPlans).where(eq(financialPlans.id, record.planId));
  if (!plan) { res.status(404).json({ message: "Plan not found" }); return false; }
  const client = await storage.getClient(plan.clientId);
  if (!client || client.companyId !== companyId) {
    res.status(403).json({ message: "Access denied" }); return false;
  }
  return true;
}

// ── Password change enforcement ───────────────────────────────────────────────

const PASSWORD_CHANGE_ALLOWED = [
  { path: "/api/auth/user", methods: ["GET"] },
  { path: "/api/auth/change-password", methods: ["POST"] },
  { path: "/api/auth/logout", methods: ["POST"] },
  { path: "/api/staff/me", methods: ["GET"] },
  { path: "/api/host/me", methods: ["GET"] },
  { path: "/api/company/settings", methods: ["GET"] },
  { path: "/api/email/config", methods: ["GET"] },
  { path: "/api/email/skip-setup", methods: ["POST"] },
  { path: "/api/email/auth/gmail", methods: ["GET"] },
  { path: "/api/email/auth/gmail/callback", methods: ["GET"] },
  { path: "/api/email/test-imap", methods: ["POST"] },
  { path: "/api/email/setup-imap", methods: ["POST"] },
  { path: "/api/email/known-servers", methods: ["GET"] },
  { path: "/api/email/auth/microsoft", methods: ["GET"] },
  { path: "/api/email/auth/microsoft/callback", methods: ["GET"] },
  { path: "/api/email/status", methods: ["GET"] },
];

export const enforcePasswordChanged = async (req: any, res: Response, next: NextFunction) => {
  const url = req.originalUrl?.split("?")[0];
  if (!url?.startsWith("/api/") || url.startsWith("/api/auth/")) return next();
  const allowed = PASSWORD_CHANGE_ALLOWED.find(
    a => a.path === url && a.methods.includes(req.method)
  );
  if (allowed) return next();
  const member = await getStaffFromSession(req);
  if (member?.mustChangePassword) {
    return res.status(403).json({
      message: "You must change your temporary password before accessing this resource"
    });
  }
  next();
};

// ── Sensitive field redaction ─────────────────────────────────────────────────

const SENSITIVE_STAFF_FIELDS = [
  "personalEmail", "phone", "address",
  "emergencyContactName", "emergencyContactPhone", "emergencyContactRelation",
  "maritalStatus", "spouseName", "spousePhone", "spouseEmail",
  "spouseBirthday", "anniversary", "contractDate",
] as const;

export function redactStaffSensitiveFields(
  member: Record<string, unknown>
): Record<string, unknown> {
  const redacted = { ...member };
  for (const field of SENSITIVE_STAFF_FIELDS) {
    delete redacted[field];
  }
  return redacted;
}
