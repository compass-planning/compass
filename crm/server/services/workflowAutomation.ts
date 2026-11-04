/**
 * server/services/workflowAutomation.ts
 *
 * Daily cron jobs for Canadian financial advisor workflows.
 * Call startWorkflowAutomation() from server/index.ts on startup.
 *
 * Jobs run at 8:00 AM ET daily:
 *   1. Policy renewal reminders (90 / 60 / 30 days out)
 *   2. Client birthday tasks (7 days advance notice)
 *   3. KYC expiry alerts (annual review reminders)
 *   4. RRSP/TFSA contribution reminders (Jan 1 – Mar 1)
 */

import cron from "node-cron";
import { db } from "../db";
import { clients, clientPolicies, tasks, staff } from "@shared/schema";
import { eq, sql, and, isNotNull } from "drizzle-orm";

// ── Helpers ───────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysFromNow(target: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const t = new Date(target);
  t.setHours(0, 0, 0, 0);
  return Math.round((t.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

async function _getDefaultAdvisorForClient(clientId: number): Promise<number | null> {
  const [client] = await db
    .select({ advisorId: clients.advisorId, companyId: clients.companyId })
    .from(clients)
    .where(eq(clients.id, clientId));
  return client?.advisorId ?? null;
}

async function getDefaultStaffForCompany(companyId: number): Promise<number | null> {
  const [member] = await db
    .select({ id: staff.id })
    .from(staff)
    .where(and(eq(staff.companyId, companyId), eq(staff.role, "advisor")))
    .limit(1);
  return member?.id ?? null;
}

async function createWorkflowTask(
  companyId: number,
  clientId: number | null,
  staffId: number | null,
  title: string,
  description: string,
  dueDate: Date,
  priority: "high" | "medium" | "low" = "medium",
  taskType: string = "reminder",
) {
  if (!staffId || !companyId) return;

  // Avoid duplicate tasks for the same reminder
  const existing = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.title, title),
        clientId ? eq(tasks.clientId, clientId) : sql`true`,
        eq(tasks.status, "open"),
      )
    )
    .limit(1);

  if (existing.length > 0) return; // already exists

  await db.insert(tasks).values({
    companyId,
    createdByStaffId: staffId,
    assignedToStaffId: staffId,
    clientId: clientId ?? undefined,
    title,
    description,
    dueDate: dueDate.toISOString().split("T")[0],
    priority,
    status: "open",
    taskType,
  });
}

// ── Job 1: Policy Renewal Reminders ──────────────────────────────────────────

async function runRenewalReminders() {
  console.log("[workflow] Running policy renewal reminders...");

  const policies = await db
    .select({
      id: clientPolicies.id,
      clientId: clientPolicies.clientId,
      type: clientPolicies.type,
      provider: clientPolicies.provider,
      policyNumber: clientPolicies.policyNumber,
      renewalDate: clientPolicies.renewalDate,
    })
    .from(clientPolicies)
    .where(isNotNull(clientPolicies.renewalDate));

  let created = 0;

  for (const policy of policies) {
    if (!policy.renewalDate) continue;

    const renewal = new Date(policy.renewalDate);
    if (isNaN(renewal.getTime())) continue;

    const days = daysFromNow(renewal);
    if (![90, 60, 30].includes(days)) continue;

    const [client] = await db
      .select({ companyId: clients.companyId, advisorId: clients.advisorId })
      .from(clients)
      .where(eq(clients.id, policy.clientId));

    if (!client?.companyId) continue;

    const advisorId = client.advisorId ??
      await getDefaultStaffForCompany(client.companyId);

    const label = policy.provider
      ? `${policy.provider} ${policy.type}`
      : policy.type;
    const policyRef = policy.policyNumber ? ` (${policy.policyNumber})` : "";

    await createWorkflowTask(
      client.companyId,
      policy.clientId,
      advisorId,
      `${days}-day renewal reminder: ${label}${policyRef}`,
      `Policy renewal is in ${days} days on ${renewal.toLocaleDateString("en-CA")}. Review coverage, premium, and confirm renewal with client.`,
      addDays(new Date(), 2),
      days === 30 ? "high" : "medium",
      "renewal_reminder",
    );
    created++;
  }

  console.log(`[workflow] Renewal reminders: ${created} tasks created`);
}

// ── Job 2: Birthday Tasks ─────────────────────────────────────────────────────

async function runBirthdayReminders() {
  console.log("[workflow] Running birthday reminders...");

  const allClients = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      dateOfBirth: clients.dateOfBirth,
      companyId: clients.companyId,
      advisorId: clients.advisorId,
    })
    .from(clients)
    .where(isNotNull(clients.dateOfBirth));

  let created = 0;
  const today = new Date();

  for (const client of allClients) {
    if (!client.dateOfBirth || !client.companyId) continue;

    const dob = new Date(client.dateOfBirth);
    if (isNaN(dob.getTime())) continue;

    // Next birthday this year
    const nextBirthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBirthday < today) nextBirthday.setFullYear(today.getFullYear() + 1);

    const days = daysFromNow(nextBirthday);
    if (days !== 7) continue;

    const age = nextBirthday.getFullYear() - dob.getFullYear();
    const advisorId = client.advisorId ??
      await getDefaultStaffForCompany(client.companyId);

    await createWorkflowTask(
      client.companyId,
      client.id,
      advisorId,
      `Birthday: ${client.firstName} ${client.lastName} turns ${age}`,
      `${client.firstName}'s birthday is in 7 days (${nextBirthday.toLocaleDateString("en-CA")}). Send a personal note and consider if this triggers any planning milestones (RRSP, OAS eligibility, retirement planning).`,
      addDays(new Date(), 5),
      "low",
      "birthday",
    );
    created++;
  }

  console.log(`[workflow] Birthday reminders: ${created} tasks created`);
}

// ── Job 3: KYC Annual Review Alerts ──────────────────────────────────────────

async function runKycReviewAlerts() {
  console.log("[workflow] Running KYC review alerts...");

  // Flag clients whose last activity was >12 months ago
  const staleClients = await db.execute(sql`
    SELECT c.id, c.first_name, c.last_name, c.company_id, c.advisor_id,
           MAX(a.date) as last_activity
    FROM clients c
    LEFT JOIN activities a ON a.client_id = c.id
    WHERE c.company_id IS NOT NULL
    GROUP BY c.id, c.first_name, c.last_name, c.company_id, c.advisor_id
    HAVING MAX(a.date) < NOW() - INTERVAL '12 months'
       OR MAX(a.date) IS NULL
    LIMIT 50
  `);

  let created = 0;

  for (const row of staleClients.rows as any[]) {
    const advisorId = row.advisor_id ??
      await getDefaultStaffForCompany(row.company_id);

    await createWorkflowTask(
      row.company_id,
      row.id,
      advisorId,
      `KYC review due: ${row.first_name} ${row.last_name}`,
      `No activity recorded in 12+ months. MFDA/IIROC requires annual KYC review. Schedule a call to update suitability, risk tolerance, and life changes.`,
      addDays(new Date(), 14),
      "medium",
      "kyc_review",
    );
    created++;
  }

  console.log(`[workflow] KYC alerts: ${created} tasks created`);
}

// ── Job 4: RRSP/TFSA Contribution Season ─────────────────────────────────────

async function runContributionSeasonReminders() {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-indexed
  const day = now.getDate();

  // Fire once: Jan 2 (RRSP/TFSA season starts)
  if (month !== 1 || day !== 2) return;

  console.log("[workflow] Running RRSP/TFSA contribution season reminders...");

  const allClients = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      companyId: clients.companyId,
      advisorId: clients.advisorId,
    })
    .from(clients)
    .where(isNotNull(clients.companyId));

  let created = 0;

  for (const client of allClients) {
    if (!client.companyId) continue;
    const advisorId = client.advisorId ??
      await getDefaultStaffForCompany(client.companyId);

    await createWorkflowTask(
      client.companyId,
      client.id,
      advisorId,
      `RRSP/TFSA contribution review: ${client.firstName} ${client.lastName}`,
      `New year — confirm TFSA room, RRSP room, and recommend contributions before the March 1 RRSP deadline.`,
      new Date(now.getFullYear(), 1, 15), // Feb 15
      "high",
      "contribution_reminder",
    );
    created++;
  }

  console.log(`[workflow] Contribution reminders: ${created} tasks created`);
}

// ── Start all jobs ────────────────────────────────────────────────────────────

export function startWorkflowAutomation() {
  console.log("[workflow] Starting workflow automation...");

  // Run daily at 8:00 AM ET (13:00 UTC)
  cron.schedule("0 13 * * *", async () => {
    try { await runRenewalReminders(); } catch (e) { console.error("[workflow] renewal error:", e); }
    try { await runBirthdayReminders(); } catch (e) { console.error("[workflow] birthday error:", e); }
    try { await runKycReviewAlerts(); } catch (e) { console.error("[workflow] kyc error:", e); }
    try { await runContributionSeasonReminders(); } catch (e) { console.error("[workflow] contribution error:", e); }
  });

  console.log("[workflow] Cron jobs scheduled (daily 8AM ET)");
}
