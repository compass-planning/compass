/**
 * Central role rules for client access, assignment and financial visibility.
 *
 *  Role             Clients (see/add/edit)                              Delete  Financial  Assign to
 *  general_manager  all in company                                      yes     yes        anyone
 *  sales_manager    own + own advisors / advisor admins (own team)      no      yes        GM + self + own team
 *  advisor          own clients                                         no      yes        self
 *  office_admin     all in company                                      no      NO         anyone
 *  advisor_admin    everything under their sales manager(s) + own team   no      NO         that same team
 *
 * Every route that touches a client record goes through canAccessClient / getClientScope so the rules
 * live in one place. Company isolation is always enforced first.
 */
import { db } from "./db";
import { and, eq, inArray, or } from "drizzle-orm";
import { advisorAssignments, clients, staff } from "@shared/schema";

export type StaffRow = typeof staff.$inferSelect;
export type ClientRow = typeof clients.$inferSelect;
export type ClientScope = { all: true } | { all: false; advisorIds: Set<number>; retainedBy?: number };

const ALL_ROLES = new Set(["general_manager", "office_admin"]);
const NO_FINANCIAL_ROLES = new Set(["office_admin", "advisor_admin"]);

export const canDeleteClients = (role: string | null | undefined) => role === "general_manager";
export const canViewFinancial = (role: string | null | undefined) => !!role && !NO_FINANCIAL_ROLES.has(role);

async function assignedUnder(adminId: number): Promise<number[]> {
  const rows = await db.select({ id: advisorAssignments.advisorId }).from(advisorAssignments).where(eq(advisorAssignments.adminId, adminId));
  return rows.map(r => r.id);
}

/** The people on a manager's team: themselves plus everyone assigned under them (sales managers: their advisors / advisor admins). */
export async function getTeamIds(member: Pick<StaffRow, "id" | "role">): Promise<Set<number>> {
  const ids = new Set<number>([member.id]);
  if (member.role === "sales_manager") {
    (await assignedUnder(member.id)).forEach(i => ids.add(i));
  } else if (member.role === "advisor_admin") {
    (await assignedUnder(member.id)).forEach(i => ids.add(i));
    // ...plus everything under the sales manager(s) this advisor admin reports to: the manager's own clients and every advisor under them.
    const managers = await db.select({ id: advisorAssignments.adminId }).from(advisorAssignments).where(eq(advisorAssignments.advisorId, member.id));
    for (const m of managers) { ids.add(m.id); (await assignedUnder(m.id)).forEach(i => ids.add(i)); }
  }
  return ids;
}

export async function getClientScope(member: Pick<StaffRow, "id" | "role">): Promise<ClientScope> {
  if (ALL_ROLES.has(member.role)) return { all: true };
  // Sales managers also keep clients they handed up (to the GM, say) until someone reassigns them.
  if (member.role === "sales_manager") return { all: false, advisorIds: await getTeamIds(member), retainedBy: member.id };
  if (member.role === "advisor_admin") return { all: false, advisorIds: await getTeamIds(member) };
  return { all: false, advisorIds: new Set([member.id]) };
}

export function clientInScope(scope: ClientScope, client: Pick<ClientRow, "advisorId"> & { retainedByStaffId?: number | null }): boolean {
  if (scope.all) return true;
  if (scope.retainedBy != null && client.retainedByStaffId === scope.retainedBy) return true;
  return client.advisorId != null && scope.advisorIds.has(client.advisorId);
}

/**
 * Value for clients.retained_by_staff_id after an assignment. A sales manager who hands a client to someone
 * outside their own team keeps seeing it; any other (re)assignment clears it, so the GM reassigning ends it.
 */
export async function retainedByAfterAssign(caller: StaffRow | null | undefined, newAdvisorId: number | null | undefined): Promise<number | null> {
  if (!caller || caller.role !== "sales_manager" || newAdvisorId == null) return null;
  const team = await getTeamIds(caller);
  return team.has(newAdvisorId) ? null : caller.id;
}

/** Company isolation first, then the role's scope. */
export async function canAccessClient(member: StaffRow | null | undefined, client: ClientRow | null | undefined): Promise<boolean> {
  if (!member || !client || !member.companyId || client.companyId !== member.companyId) return false;
  return clientInScope(await getClientScope(member), client);
}

export async function getVisibleClients(member: StaffRow): Promise<ClientRow[]> {
  if (!member.companyId) return [];
  const scope = await getClientScope(member);
  if (scope.all) return db.select().from(clients).where(eq(clients.companyId, member.companyId));
  const mine = scope.advisorIds.size ? inArray(clients.advisorId, [...scope.advisorIds]) : undefined;
  const retained = scope.retainedBy != null ? eq(clients.retainedByStaffId, scope.retainedBy) : undefined;
  const visible = mine && retained ? or(mine, retained) : (mine ?? retained);
  if (!visible) return [];
  return db.select().from(clients).where(and(eq(clients.companyId, member.companyId), visible));
}

/** Active staff in the caller's company that the caller may assign a client / deal to. */
export async function getAssignableStaff(member: StaffRow): Promise<StaffRow[]> {
  if (!member.companyId) return [];
  const all = (await db.select().from(staff).where(eq(staff.companyId, member.companyId))).filter(s => s.isActive !== false);
  if (ALL_ROLES.has(member.role)) return all;
  if (member.role === "advisor") return all.filter(s => s.id === member.id);
  const team = await getTeamIds(member);
  if (member.role === "sales_manager") return all.filter(s => s.role === "general_manager" || team.has(s.id));
  // advisor_admin: the advisors/advisor admins under their sales manager (and themselves), never managers
  return all.filter(s => team.has(s.id) && s.role !== "sales_manager" && s.role !== "general_manager");
}

// Dollar-figure profile fields on the client record itself. Roles without financial access never receive
// them and can't write them (so an edit form that doesn't know the values can't blank them out).
const FINANCIAL_CLIENT_FIELDS = ["annualIncome", "desiredRetirementIncome", "spouseAnnualIncome", "spouseDesiredRetirementIncome"] as const;

export function redactClientForRole<T extends Record<string, any>>(role: string | null | undefined, client: T): T {
  if (canViewFinancial(role)) return client;
  const out: Record<string, any> = { ...client };
  for (const f of FINANCIAL_CLIENT_FIELDS) if (f in out) out[f] = null;
  return out as T;
}

export function stripFinancialClientFields<T extends Record<string, any>>(role: string | null | undefined, body: T): T {
  if (canViewFinancial(role) || !body) return body;
  const out: Record<string, any> = { ...body };
  for (const f of FINANCIAL_CLIENT_FIELDS) delete out[f];
  return out as T;
}
