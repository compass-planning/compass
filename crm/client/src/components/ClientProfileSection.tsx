/**
 * ClientProfileSection.tsx
 *
 * Full household profile editor, rebuilt from the westoak-planner pattern.
 * Features:
 *  - Inline click-to-edit fields (ExecField)
 *  - Full edit mode with all primary + spouse fields
 *  - Dependants / children management
 *  - Overview KPI bar (net worth, plans, insurance, AI)
 *  - Advisor alerts
 */

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Pencil, Save, X, UserPlus, Baby, Plus, Trash2, Users,
  DollarSign, PiggyBank, Shield, Brain,
} from "lucide-react";
import { useUpdateClient } from "@/hooks/use-clients";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { toast } from "@/hooks/use-toast";
import { fmt$ } from "@/lib/utils";
import { useCurrentStaff } from "@/hooks/use-users";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Overview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  retirementProjections: number;
  insuranceAnalyses: number;
  pendingAi: number;
  plans: number;
}

interface Dependant {
  name?: string;
  dob?: string;
  relationship?: string;
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

const PENSION_TYPES = [
  { value: "",               label: "None / Not Set" },
  { value: "DBPP",           label: "Defined Benefit (DBPP)" },
  { value: "DCPP",           label: "Defined Contribution (DCPP)" },
  { value: "Group RRSP",     label: "Group RRSP" },
  { value: "DPSP",           label: "Deferred Profit Sharing (DPSP)" },
  { value: "No Pension",     label: "No Pension" },
];

const MARITAL_STATUSES = [
  { value: "",             label: "Not Set" },
  { value: "single",       label: "Single" },
  { value: "married",      label: "Married" },
  { value: "common_law",   label: "Common Law" },
  { value: "divorced",     label: "Divorced" },
  { value: "widowed",      label: "Widowed" },
  { value: "separated",    label: "Separated" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

function avatarBg(name: string) {
  const colors = ["bg-violet-500","bg-violet-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-teal-500"];
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "?";
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldInput({ label, value, onChange, type = "text", placeholder, v }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder ?? label}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition"
      />
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, v }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-violet-400 focus:ring-1 focus:ring-violet-200 transition"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function ExecField({ label, value, mono = false, onSave, type = "text", v }: {
  label: string; value: string | number | null | undefined;
  mono?: boolean; onSave?: (v: string) => void; type?: "text" | "number";
}) {
  const display = (value === null || value === undefined || value === "") ? "—" : value;
  const isEmpty = display === "—";
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <div className={`text-sm font-semibold truncate ${isEmpty ? "text-slate-300" : "text-slate-800"} ${mono && !isEmpty ? "font-mono tabular-nums" : ""}`}>
        {onSave ? (
          <InlineEdit
            value={display === "—" ? "" : String(display)}
            type={type}
            onSave={onSave}
            placeholder={label}
            className={`text-sm font-semibold ${mono ? "font-mono tabular-nums" : ""} ${isEmpty ? "text-slate-300" : ""}`}
          />
        ) : display}
      </div>
    </div>
  );
}

function PersonPanel({ roleLabel, bg, ini, name, subtitle, editing, editContent, viewContent }: {
  roleLabel: string; bg: string; ini: string; name: string; subtitle: string;
  editing: boolean; editContent: React.ReactNode; viewContent: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center text-white text-base font-bold shadow-sm`}>
          {ini}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{roleLabel}</p>
          <h3 className="text-base font-bold text-slate-900 truncate">{name || "—"}</h3>
          <p className="text-xs text-slate-400 truncate">{subtitle}</p>
        </div>
      </div>
      {editing ? editContent : viewContent}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ClientProfileSection({ client, onClientUpdate, updated }: {
  client: Record<string, unknown>;
  onClientUpdate?: (updated: Record<string, unknown>) => void;
}) {
  const { data: meStaff } = useCurrentStaff();
  // Office admins / advisor admins never see dollar figures (server redacts them too).
  const canSeeFinancial = !!meStaff && meStaff.role !== "office_admin" && meStaff.role !== "advisor_admin";
  const qc = useQueryClient();
  const _updateClient = useUpdateClient();

  const [editing, setEditing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({ ...client });
  const u = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Reset form when client changes
  useEffect(() => { setForm({ ...client }); }, [client]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: overview } = useQuery<Overview>({
    queryKey: ["overview", client.id],
    queryFn: async () => {
      const r = await fetch(`/api/crm/clients/${client.id}/overview`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to save");
      const updated = await res.json();
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["client-detail", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      onClientUpdate?.(updated);
      setEditing(false);
      toast({ title: "Saved", description: "Client profile updated." });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  }

  // Who this client can be (re)assigned to: the same server-enforced list used when creating clients, tasks and deals.
  const { data: assignable = [] } = useQuery<{ id: number; firstName: string; lastName: string; role: string }[]>({
    queryKey: ["/api/crm/staff/assignable-advisors"],
  });
  const currentAdvisorId = (client.advisorId as number | null | undefined) ?? null;
  const assigneeInList = currentAdvisorId == null || assignable.some(a => a.id === currentAdvisorId);
  const canReassign = assignable.length > 1 || (assignable.length === 1 && currentAdvisorId == null);

  async function inlinePatch(data: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/crm/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.message || "Failed to save");
      const updated = await res.json();
      qc.invalidateQueries({ queryKey: ["client", client.id] });
      qc.invalidateQueries({ queryKey: ["client-detail", client.id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["/api/crm/clients"] });
      onClientUpdate?.(updated);
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }

  const dependants: Dependant[] = ((editing ? form.dependants : client.dependants) as Dependant[] | null) ?? [];
  const hasSpouse = !!(client.spouseFirstName || (editing && form.spouseFirstName));
  const householdName = client.spouseFirstName
    ? `The ${client.lastName} Household`
    : `${client.firstName} ${client.lastName}`;

  // Alerts
  const alerts: { msg: string; tone: string }[] = [];
  if (overview) {
    if (overview.pendingAi > 0)
      alerts.push({ msg: `${overview.pendingAi} AI action${overview.pendingAi > 1 ? "s" : ""} pending review`, tone: "amber" });
    if (overview.retirementProjections === 0)
      alerts.push({ msg: "No retirement projection on file", tone: "blue" });
    if (overview.insuranceAnalyses === 0)
      alerts.push({ msg: "No insurance analysis on file — protection gap unknown", tone: "red" });
  }

  return (
    <div className="space-y-5">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">{householdName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {client.province ?? "—"} ·{" "}
            {hasSpouse ? "2 adults" : "1 adult"}
            {dependants.length > 0 ? ` · ${dependants.length} dependant${dependants.length !== 1 ? "s" : ""}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm({ ...client }); }}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-500 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                <X className="w-3 h-3" /> Cancel
              </button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg disabled:opacity-50 transition-colors">
                <Save className="w-3 h-3" /> {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
              <Pencil className="w-3 h-3" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {/* ── KPI bar ─────────────────────────────────────────────────────── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Net Worth",       value: fmt$(overview.netWorth),                icon: DollarSign, color: overview.netWorth >= 0 ? "text-emerald-600" : "text-red-500",  bg: "bg-emerald-50" },
            { label: "Retirement Plans",value: String(overview.retirementProjections), icon: PiggyBank,  color: overview.retirementProjections > 0 ? "text-violet-600" : "text-slate-300", bg: "bg-violet-50" },
            { label: "Insurance",       value: String(overview.insuranceAnalyses),     icon: Shield,     color: overview.insuranceAnalyses > 0 ? "text-emerald-600" : "text-red-500", bg: "bg-slate-50" },
            { label: "AI Pending",      value: String(overview.pendingAi),             icon: Brain,      color: overview.pendingAi > 0 ? "text-amber-600" : "text-slate-300",  bg: "bg-amber-50" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className={`w-7 h-7 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
              </div>
              <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mb-0.5">{s.label}</p>
              <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Alerts ──────────────────────────────────────────────────────── */}
      {alerts.map((a, i) => (
        <div key={i} className={`rounded-xl px-4 py-3 text-xs font-medium border flex items-center gap-2 ${
          a.tone === "amber" ? "bg-amber-50 border-amber-100 text-amber-700"
          : a.tone === "red"  ? "bg-red-50 border-red-100 text-red-700"
          : "bg-violet-50 border-violet-100 text-violet-700"
        }`}>
          <span>⚠</span> {a.msg}
        </div>
      ))}

      {/* ── Household card ──────────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">

        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-violet-50 rounded flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Household Profile</h3>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>Assigned to</span>
              <select
                value={currentAdvisorId ?? ""}
                disabled={!canReassign}
                onChange={async e => {
                  const v = e.target.value;
                  await inlinePatch({ advisorId: v ? Number(v) : null });
                  toast({ title: "Reassigned", description: "Client assignment updated." });
                }}
                data-testid="select-client-assignee"
                className="normal-case tracking-normal font-medium text-xs text-slate-700 border border-slate-200 rounded-md px-2 py-1 bg-white disabled:opacity-70 max-w-[11rem]"
              >
                <option value="">Unassigned</option>
                {!assigneeInList && <option value={currentAdvisorId ?? ""}>Current assignee</option>}
                {assignable.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}{a.role === "general_manager" ? " (General Manager)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {hasSpouse ? "Joint File" : "Single File"}
            </span>
          </div>
        </div>

        {/* Adults grid */}
        <div className={`grid ${(hasSpouse || editing) ? "grid-cols-1 lg:grid-cols-2 lg:divide-x divide-slate-100" : "grid-cols-1"}`}>

          {/* Primary client */}
          <PersonPanel
            roleLabel="Primary Client"
            bg={avatarBg(client.firstName + client.lastName)}
            ini={initials(client.firstName, client.lastName)}
            name={`${client.firstName} ${client.lastName}`}
            subtitle={[client.occupation, ageFromDob(client.dateOfBirth) ? `age ${ageFromDob(client.dateOfBirth)}` : null].filter(Boolean).join(" · ") || "Occupation not set"}
            editing={editing}
            editContent={
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="First Name"  value={form.firstName ?? ""}  onChange={v => u("firstName", v)} />
                <FieldInput label="Last Name"   value={form.lastName ?? ""}   onChange={v => u("lastName", v)} />
                <FieldInput label="Email" type="email" value={form.email ?? ""} onChange={v => u("email", v)} />
                <FieldInput label="Phone"       value={form.phone ?? ""}      onChange={v => u("phone", v)} />
                <FieldInput label="Cell"        value={form.cell ?? ""}       onChange={v => u("cell", v)} />
                <FieldInput label="Date of Birth" type="date" value={form.dateOfBirth?.split("T")[0] ?? ""} onChange={v => u("dateOfBirth", v)} />
                <FieldInput label="Address"     value={form.address ?? ""}    onChange={v => u("address", v)} />
                <FieldInput label="City"        value={form.city ?? ""}       onChange={v => u("city", v)} />
                <FieldInput label="Postal Code" value={form.postalCode ?? ""} onChange={v => u("postalCode", v)} />
                <FieldSelect label="Province" value={form.province ?? "ON"} onChange={v => u("province", v)}
                  options={PROVINCES.map(p => ({ value: p, label: p }))} />
                <FieldInput label="Occupation"  value={form.occupation ?? ""}  onChange={v => u("occupation", v)} />
                {canSeeFinancial && (
                  <FieldInput label="Annual Income ($)" type="number" value={form.annualIncome ?? ""} onChange={v => u("annualIncome", v)} />
                )}
                <FieldSelect label="Marital Status" value={form.maritalStatus ?? ""} onChange={v => u("maritalStatus", v)} options={MARITAL_STATUSES} />
                <FieldSelect label="Pension Type" value={form.pensionPlan ?? ""} onChange={v => u("pensionPlan", v)} options={PENSION_TYPES} />
                <FieldInput label="Retirement Age" type="number" value={String(form.retirementAge ?? "")} onChange={v => u("retirementAge", v ? +v : null)} />
                {canSeeFinancial && (
                  <FieldInput label="Desired Retirement Income ($)" type="number" value={form.desiredRetirementIncome ?? ""} onChange={v => u("desiredRetirementIncome", v)} />
                )}
              </div>
            }
            viewContent={
              <dl className="grid grid-cols-2 gap-y-4 gap-x-6">
                <ExecField label="Email"             value={client.email}                             onSave={v => inlinePatch({ email: v })} />
                <ExecField label="Phone"             value={client.phone}                             onSave={v => inlinePatch({ phone: v })} />
                <ExecField label="Cell"              value={client.cell}                              onSave={v => inlinePatch({ cell: v })} />
                <ExecField label="Date of Birth"     value={client.dateOfBirth?.split("T")[0]}        onSave={v => inlinePatch({ dateOfBirth: v })} />
                <ExecField label="Address"           value={client.address}                           onSave={v => inlinePatch({ address: v })} />
                <ExecField label="City"              value={client.city}                              onSave={v => inlinePatch({ city: v })} />
                <ExecField label="Postal Code"       value={client.postalCode}                        onSave={v => inlinePatch({ postalCode: v })} />
                <ExecField label="Province"          value={client.province}                          onSave={v => inlinePatch({ province: v })} />
                <ExecField label="Occupation"        value={client.occupation}                        onSave={v => inlinePatch({ occupation: v })} />
                {canSeeFinancial && (
                  <ExecField label="Annual Income"     value={fmt$(client.annualIncome)}       mono     onSave={v => inlinePatch({ annualIncome: v })} type="number" />
                )}
                <ExecField label="Marital Status"    value={MARITAL_STATUSES.find(m => m.value === client.maritalStatus)?.label ?? client.maritalStatus} />
                <ExecField label="Pension Type"      value={PENSION_TYPES.find(p => p.value === client.pensionPlan)?.label ?? client.pensionPlan} />
                <ExecField label="Retirement Age"    value={client.retirementAge}             mono    onSave={v => inlinePatch({ retirementAge: +v })} type="number" />
                {canSeeFinancial && (
                  <ExecField label="Desired Income"    value={fmt$(client.desiredRetirementIncome)} mono onSave={v => inlinePatch({ desiredRetirementIncome: v })} type="number" />
                )}
                <ExecField label="Notes"             value={client.notes}                             onSave={v => inlinePatch({ notes: v })} />
              </dl>
            }
          />

          {/* Spouse */}
          {(hasSpouse || editing) ? (
            <PersonPanel
              roleLabel="Spouse / Partner"
              bg={avatarBg((client.spouseFirstName ?? "") + (client.spouseLastName ?? ""))}
              ini={initials(client.spouseFirstName ?? "", client.spouseLastName ?? "")}
              name={`${client.spouseFirstName ?? ""} ${client.spouseLastName ?? ""}`.trim()}
              subtitle={[client.spouseOccupation, ageFromDob(client.spouseDateOfBirth) ? `age ${ageFromDob(client.spouseDateOfBirth)}` : null].filter(Boolean).join(" · ") || "Occupation not set"}
              editing={editing}
              editContent={
                <div className="grid grid-cols-2 gap-3">
                  <FieldInput label="Spouse First Name" value={form.spouseFirstName ?? ""} onChange={v => u("spouseFirstName", v)} />
                  <FieldInput label="Spouse Last Name"  value={form.spouseLastName ?? ""}  onChange={v => u("spouseLastName", v)} />
                  <FieldInput label="Spouse Email" type="email" value={form.spouseEmail ?? ""} onChange={v => u("spouseEmail", v)} />
                  <FieldInput label="Spouse Phone" value={form.spousePhone ?? ""} onChange={v => u("spousePhone", v)} />
                  <FieldInput label="Spouse DOB" type="date" value={form.spouseDateOfBirth?.split("T")[0] ?? ""} onChange={v => u("spouseDateOfBirth", v)} />
                  <FieldInput label="Spouse Address" value={form.spouseAddress ?? ""} onChange={v => u("spouseAddress", v)} />
                  <FieldInput label="Spouse City" value={form.spouseCity ?? ""} onChange={v => u("spouseCity", v)} />
                  <FieldInput label="Spouse Postal Code" value={form.spousePostalCode ?? ""} onChange={v => u("spousePostalCode", v)} />
                  <FieldInput label="Spouse Occupation" value={form.spouseOccupation ?? ""} onChange={v => u("spouseOccupation", v)} />
                  {canSeeFinancial && (
                    <FieldInput label="Spouse Income ($)" type="number" value={form.spouseAnnualIncome ?? ""} onChange={v => u("spouseAnnualIncome", v)} />
                  )}
                  <FieldInput label="Spouse Retirement Age" type="number" value={String(form.spouseRetirementAge ?? "")} onChange={v => u("spouseRetirementAge", v ? +v : null)} />
                  {canSeeFinancial && (
                    <FieldInput label="Spouse Desired Income ($)" type="number" value={form.spouseDesiredRetirementIncome ?? ""} onChange={v => u("spouseDesiredRetirementIncome", v)} />
                  )}
                  <FieldSelect label="Spouse Pension" value={form.spousePensionType ?? ""} onChange={v => u("spousePensionType", v)} options={PENSION_TYPES} />
                </div>
              }
              viewContent={
                <dl className="grid grid-cols-2 gap-y-4 gap-x-6">
                  <ExecField label="Email"         value={client.spouseEmail}                             onSave={v => inlinePatch({ spouseEmail: v })} />
                  <ExecField label="Phone"         value={client.spousePhone}                             onSave={v => inlinePatch({ spousePhone: v })} />
                  <ExecField label="Date of Birth" value={client.spouseDateOfBirth?.split("T")[0]}        onSave={v => inlinePatch({ spouseDateOfBirth: v })} />
                  <ExecField label="Address"       value={client.spouseAddress}                           onSave={v => inlinePatch({ spouseAddress: v })} />
                  <ExecField label="City"          value={client.spouseCity}                              onSave={v => inlinePatch({ spouseCity: v })} />
                  <ExecField label="Postal Code"   value={client.spousePostalCode}                        onSave={v => inlinePatch({ spousePostalCode: v })} />
                  <ExecField label="Occupation"    value={client.spouseOccupation}                        onSave={v => inlinePatch({ spouseOccupation: v })} />
                  {canSeeFinancial && (
                    <ExecField label="Annual Income" value={fmt$(client.spouseAnnualIncome)}      mono       onSave={v => inlinePatch({ spouseAnnualIncome: v })} type="number" />
                  )}
                  <ExecField label="Pension"       value={PENSION_TYPES.find(p => p.value === client.spousePensionType)?.label ?? client.spousePensionType} />
                  <ExecField label="Retirement Age" value={client.spouseRetirementAge}          mono       onSave={v => inlinePatch({ spouseRetirementAge: +v })} type="number" />
                  {canSeeFinancial && (
                    <ExecField label="Desired Income" value={fmt$(client.spouseDesiredRetirementIncome)} mono onSave={v => inlinePatch({ spouseDesiredRetirementIncome: v })} type="number" />
                  )}
                </dl>
              }
            />
          ) : (
            !editing && (
              <div className="px-6 py-10 flex flex-col items-center justify-center text-center border-t lg:border-t-0 border-slate-100">
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300 mb-2">
                  <UserPlus className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">No Spouse on File</p>
                <button onClick={() => setEditing(true)}
                  className="text-xs text-violet-600 font-semibold hover:underline">
                  Add spouse details →
                </button>
              </div>
            )
          )}
        </div>

        {/* ── Dependants ─────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Baby className="w-3.5 h-3.5 text-slate-400" />
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Children & Dependants
              </h3>
              {dependants.length > 0 && (
                <span className="text-[10px] text-slate-400 font-medium">· {dependants.length}</span>
              )}
            </div>
            {editing && (
              <button
                onClick={() => u("dependants", [...dependants, { name: "", dob: "", relationship: "Child" }])}
                className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:underline"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            )}
          </div>

          {editing ? (
            <div className="space-y-2">
              {dependants.length === 0 && (
                <p className="text-xs text-slate-400 italic">No dependants — click "Add" to add a child.</p>
              )}
              {dependants.map((d: Dependant, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white rounded-lg border border-slate-100 p-3">
                  <div className="col-span-5">
                    <FieldInput label="Name" value={d.name ?? ""}
                      onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], name: v }; u("dependants", deps); }} />
                  </div>
                  <div className="col-span-3">
                    <FieldInput label="Date of Birth" type="date" value={d.dob?.split("T")[0] ?? ""}
                      onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], dob: v }; u("dependants", deps); }} />
                  </div>
                  <div className="col-span-3">
                    <FieldSelect label="Relation" value={d.relationship ?? "Child"}
                      onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], relationship: v }; u("dependants", deps); }}
                      options={["Child","Parent","Sibling","Other"].map(v => ({ value: v, label: v }))} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => u("dependants", dependants.filter((_dep: Dependant, idx: number) => idx !== i))}
                      className="p-1.5 text-red-400 hover:text-red-600 transition-colors mb-0.5">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : dependants.length === 0 ? (
            <p className="text-xs text-slate-400">
              No dependants on file.{" "}
              <button onClick={() => setEditing(true)} className="text-violet-600 hover:underline font-medium">Add one →</button>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {dependants.map((d: Dependant, i: number) => (
                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-[10px] font-bold">
                    {d.name?.[0] ?? "?"}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 leading-none">{d.name || "Unnamed"}</p>
                    <p className="text-[10px] text-slate-400">
                      {d.relationship ?? "Child"}
                      {d.dob ? ` · age ${ageFromDob(d.dob) ?? "?"}` : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Advisor Notes</p>
          {editing ? (
            <textarea
              value={form.notes ?? ""}
              onChange={e => u("notes", e.target.value)}
              rows={3}
              placeholder="Internal notes about this household..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:border-violet-400 resize-none transition"
            />
          ) : (
            <p className="text-sm text-slate-600 whitespace-pre-wrap">
              {client.notes || <span className="text-slate-300 italic">No notes yet.</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
