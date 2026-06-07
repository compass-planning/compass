/**
 * server/services/pipedaAuditService.ts
 *
 * PIPEDA-compliant audit logging service.
 *
 * Records every instance of:
 *   - Client financial data sent to an external AI processor (Anthropic / OpenAI)
 *   - Report generation events
 *   - Authentication events (login success/failure, password changes)
 *   - Client data access
 *
 * The audit_log table is append-only and must be retained for 24 months per
 * PIPEDA Breach of Security Safeguards Regulations (SOR/2018-64).
 *
 * NEVER delete rows from audit_log. NEVER log actual data values — log
 * categories only (e.g. "income,netWorth" not "$120,000").
 */

import { getDb }   from "../db/index.js";
import { auditLog } from "../../shared/schema.js";
import { logger }   from "../logger.js";

// ── Action constants ───────────────────────────────────────────────────────────
export const AuditAction = {
  // External AI data transfers — highest priority for PIPEDA
  AI_FINANCIAL_PLAN:      "ai.financial_plan",        // financial plan generation → Anthropic
  AI_MEETING_SUMMARY:     "ai.meeting_summary",        // meeting transcript → Anthropic
  AI_INTAKE_EXTRACT:      "ai.intake_extract",         // intake conversation → Anthropic
  AI_NEEDS_ANALYSIS:      "ai.needs_analysis",         // needs analysis → Anthropic
  AI_VOICE_FIELD:         "ai.voice_field",            // single field extraction → Anthropic
  AI_TRANSCRIPTION:       "ai.transcription",          // audio → OpenAI Whisper
  AI_RECOMMENDATIONS:     "ai.recommendations",        // AI recommendations → Anthropic
  AI_PLAN_REPORT:         "ai.plan_report",            // AI report generation → Anthropic

  // Report access
  REPORT_GENERATED:       "report.generated",
  REPORT_PRINTED:         "report.printed",

  // Data access
  CLIENT_ACCESSED:        "data.client_accessed",
  CLIENT_CREATED:         "data.client_created",
  CLIENT_UPDATED:         "data.client_updated",

  // Authentication
  AUTH_LOGIN_SUCCESS:     "auth.login_success",
  AUTH_LOGIN_FAILURE:     "auth.login_failure",
  AUTH_LOGOUT:            "auth.logout",
  AUTH_PASSWORD_CHANGED:  "auth.password_changed",
  AUTH_MFA_ENABLED:       "auth.mfa_enabled",
  AUTH_MFA_CHALLENGE:     "auth.mfa_challenge",
} as const;

export type AuditActionType = typeof AuditAction[keyof typeof AuditAction];

// ── Data categories (never log actual values) ─────────────────────────────────
export const DataCategory = {
  INCOME:          "income",
  NET_WORTH:       "netWorth",
  RETIREMENT:      "retirement",
  INSURANCE:       "insurance",
  DEBT:            "debt",
  TAX:             "tax",
  ESTATE:          "estate",
  EDUCATION:       "education",
  GOALS:           "goals",
  PENSION:         "pension",
  MEETING_AUDIO:   "meetingAudio",
  TRANSCRIPT:      "transcript",
  PERSONAL_INFO:   "personalInfo",  // name, DOB, contact
  CASH_FLOW:       "cashFlow",
} as const;

export type DataCategoryType = typeof DataCategory[keyof typeof DataCategory];

// ── Audit entry interface ─────────────────────────────────────────────────────
interface AuditEntry {
  userId?:            number;
  userEmail?:         string;
  action:             AuditActionType;
  resourceType?:      string;
  resourceId?:        number;
  clientId?:          number;
  externalProcessor?: "anthropic" | "openai";
  dataCategories?:    DataCategoryType[];
  purposeCode?:       string;
  recordCount?:       number;
  ipAddress?:         string;
  userAgent?:         string;
  correlationId?:     string;
  outcome?:           "success" | "error";
  errorMessage?:      string;
  jurisdiction?:      "CA" | "US";
}

// ── Core logging function ─────────────────────────────────────────────────────
export async function auditWrite(entry: AuditEntry): Promise<void> {
  try {
    const jur = entry.jurisdiction ?? "CA";
    const db  = getDb(jur);

    await (db.insert(auditLog) as any).values({
      userId:            entry.userId ?? null,
      userEmail:         entry.userEmail ?? null,
      action:            entry.action,
      resourceType:      entry.resourceType ?? null,
      resourceId:        entry.resourceId ?? null,
      clientId:          entry.clientId ?? null,
      externalProcessor: entry.externalProcessor ?? null,
      dataCategories:    entry.dataCategories?.join(",") ?? null,
      purposeCode:       entry.purposeCode ?? null,
      recordCount:       entry.recordCount ?? null,
      ipAddress:         entry.ipAddress ?? null,
      userAgent:         entry.userAgent ?? null,
      correlationId:     entry.correlationId ?? null,
      outcome:           entry.outcome ?? "success",
      errorMessage:      entry.errorMessage ?? null,
    });
  } catch (err) {
    // Never let audit logging crash the main request — but always log the failure
    logger.error({ err, entry: { action: entry.action, clientId: entry.clientId } },
      "PIPEDA audit write failed — investigate immediately");
  }
}

// ── Convenience wrappers for the most common events ──────────────────────────

/** Log any call that sends client data to Anthropic */
export async function auditAnthropicCall(opts: {
  req:            any;
  action:         AuditActionType;
  clientId?:      number;
  dataCategories: DataCategoryType[];
  purposeCode:    string;
  recordCount?:   number;
  outcome?:       "success" | "error";
  errorMessage?:  string;
}): Promise<void> {
  return auditWrite({
    userId:            opts.req.userId,
    userEmail:         opts.req.userEmail,
    action:            opts.action,
    resourceType:      "client",
    clientId:          opts.clientId,
    externalProcessor: "anthropic",
    dataCategories:    opts.dataCategories,
    purposeCode:       opts.purposeCode,
    recordCount:       opts.recordCount,
    ipAddress:         opts.req.ip ?? opts.req.socket?.remoteAddress,
    userAgent:         opts.req.headers?.["user-agent"],
    correlationId:     opts.req.id,
    outcome:           opts.outcome ?? "success",
    errorMessage:      opts.errorMessage,
    jurisdiction:      opts.req.userJurisdiction ?? "CA",
  });
}

/** Log any call that sends data to OpenAI */
export async function auditOpenAiCall(opts: {
  req:            any;
  action:         AuditActionType;
  clientId?:      number;
  dataCategories: DataCategoryType[];
  purposeCode:    string;
  outcome?:       "success" | "error";
  errorMessage?:  string;
}): Promise<void> {
  return auditWrite({
    userId:            opts.req.userId,
    userEmail:         opts.req.userEmail,
    action:            opts.action,
    resourceType:      "client",
    clientId:          opts.clientId,
    externalProcessor: "openai",
    dataCategories:    opts.dataCategories,
    purposeCode:       opts.purposeCode,
    ipAddress:         opts.req.ip ?? opts.req.socket?.remoteAddress,
    userAgent:         opts.req.headers?.["user-agent"],
    correlationId:     opts.req.id,
    outcome:           opts.outcome ?? "success",
    errorMessage:      opts.errorMessage,
    jurisdiction:      opts.req.userJurisdiction ?? "CA",
  });
}

/** Log an authentication event */
export async function auditAuth(opts: {
  req:        any;
  action:     AuditActionType;
  userId?:    number;
  userEmail?: string;
  outcome?:   "success" | "error";
  errorMessage?: string;
}): Promise<void> {
  return auditWrite({
    userId:       opts.userId,
    userEmail:    opts.userEmail,
    action:       opts.action,
    resourceType: "auth",
    ipAddress:    opts.req.ip ?? opts.req.socket?.remoteAddress,
    userAgent:    opts.req.headers?.["user-agent"],
    correlationId: opts.req.id,
    outcome:      opts.outcome ?? "success",
    errorMessage: opts.errorMessage,
  });
}
