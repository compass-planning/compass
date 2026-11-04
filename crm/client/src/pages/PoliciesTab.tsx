/**
 * PoliciesTab.tsx
 * Institutional-grade Protection Intelligence Workspace.
 *
 * Design philosophy: Goldman Sachs PWM × Bloomberg Terminal (modernized)
 * - Dense, scannable, advisor-centric
 * - Answers: "Is this household properly protected?"
 * - No modals. Inline expansion. Sticky intelligence rail.
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield, AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Plus, Table, Edit3, Trash2, Save, X,
} from "lucide-react";
import { api } from "../lib/api";
import { toast } from "@/hooks/use-toast";
import { PolicyImporter } from "../components/PolicyImporter";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Policy {
  id: number;
  type: string;
  insured: string;
  carrier?: string;
  policyNumber?: string;
  coverageAmount: string;
  premium: string;
  premiumFrequency: string;
  issueDate?: string;
  expiryDate?: string;
  beneficiary?: string;
  riders?: string;
  notes?: string;
  status?: string;
}

interface Props {
  clientId: number;
  client?: any;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const POLICY_TYPES = [
  "Term Life", "Whole Life", "Universal Life", "Variable Life",
  "Group Life", "Disability", "Critical Illness", "Long-Term Care",
  "Mortgage Protection", "Key Person", "Buy-Sell", "Annuity",
];

const FREQ_MULT: Record<string, number> = {
  Monthly: 12, Quarterly: 4, "Semi-Annual": 2, Annual: 1,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => n >= 1_000_000
  ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1000
  ? `$${Math.round(n / 1000).toLocaleString()}K`
  : `$${Math.round(n).toLocaleString()}`;

const _fmtFull$ = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

function annualPremium(p: Policy): number {
  const v = parseFloat(p.premium || "0");
  return v * (FREQ_MULT[p.premiumFrequency] ?? 12);
}

function policyRiskLevel(p: Policy): "low" | "medium" | "high" {
  const cov = parseFloat(p.coverageAmount || "0");
  if (p.type.includes("Disability") || p.type.includes("Critical")) {
    return cov > 0 ? "low" : "high";
  }
  if (cov > 500000) return "low";
  if (cov > 150000) return "medium";
  return "high";
}

function daysUntilExpiry(expiryDate?: string): number | null {
  if (!expiryDate) return null;
  const d = new Date(expiryDate);
  if (isNaN(d.getTime())) return null;
  return Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

// ── Compact Progress Bar ──────────────────────────────────────────────────────

function CoverageBar({ label, pct, tone }: { label: string; pct: number; tone: "green" | "amber" | "red" | "blue" }) {
  const colors = { green: "#10b981", amber: "#f59e0b", red: "#ef4444", blue: "#3b82f6" };
  const bgColors = { green: "rgba(16,185,129,0.1)", amber: "rgba(245,158,11,0.1)", red: "rgba(239,68,68,0.1)", blue: "rgba(59,130,246,0.1)" };
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] font-bold" style={{ color: colors[tone] }}>{Math.round(pct)}%</span>
      </div>
      <div className="h-1 rounded-full" style={{ background: bgColors[tone] }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, pct)}%`, background: colors[tone] }} />
      </div>
    </div>
  );
}

// ── Status Dot ────────────────────────────────────────────────────────────────

function StatusDot({ level }: { level: "low" | "medium" | "high" | "ok" | "warn" | "crit" }) {
  const map = {
    low:    "bg-emerald-400",
    ok:     "bg-emerald-400",
    medium: "bg-amber-400",
    warn:   "bg-amber-400",
    high:   "bg-red-400",
    crit:   "bg-red-400",
  };
  return <span className={`inline-block w-1.5 h-1.5 rounded-full flex-shrink-0 ${map[level]}`} />;
}

// ── Inline Edit Field ─────────────────────────────────────────────────────────

function EditField({ label, value, onChange, type = "text", options, v }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; options?: string[];
}) {
  return (
    <div>
      <label className="block text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{label}</label>
      {options ? (
        <select value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400">
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-400/40 focus:border-violet-400" />
      )}
    </div>
  );
}

// ── Policy Row ────────────────────────────────────────────────────────────────

function PolicyRow({ policy, onSave, onDelete, defaultExpanded = false, p, id }: {
  policy: Policy;
  onSave: (p: Policy) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded]   = useState(defaultExpanded);
  const [editing,  setEditing]    = useState(false);
  const [form,     setForm]       = useState({ ...policy });
  const [saving,   setSaving]     = useState(false);
  const [deleting, setDeleting]   = useState(false);

  const u = (k: keyof Policy) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const risk    = policyRiskLevel(policy);
  const annual  = annualPremium(policy);
  const expDays = daysUntilExpiry(policy.expiryDate);
  const expSoon = expDays !== null && expDays < 365 && expDays >= 0;
  const expired = expDays !== null && expDays < 0;

  const riskColors = {
    low:    { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100" },
    medium: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-100" },
    high:   { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-100" },
  };

  async function handleSave() {
    setSaving(true);
    try { await onSave(form); setEditing(false); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirm(`Remove this ${policy.type} policy?`)) return;
    setDeleting(true);
    try { await onDelete(policy.id); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); setDeleting(false); }
  }

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors ${expanded ? "bg-slate-50/50" : "hover:bg-slate-50/30"}`}>

      {/* ── Main row ── */}
      <div
        className="grid gap-2 px-4 py-3 cursor-pointer select-none"
        style={{ gridTemplateColumns: "1fr 100px 90px 70px 60px 80px" }}
        onClick={() => !editing && setExpanded(e => !e)}
      >
        {/* Type + insured */}
        <div className="flex items-center gap-2 min-w-0">
          <StatusDot level={risk} />
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-900 truncate">{policy.type}</div>
            <div className="text-[10px] text-slate-400 truncate">{policy.insured}</div>
          </div>
        </div>

        {/* Coverage */}
        <div className="text-right">
          <div className="text-xs font-semibold text-slate-900">{fmt$(parseFloat(policy.coverageAmount || "0"))}</div>
          <div className="text-[10px] text-slate-400">coverage</div>
        </div>

        {/* Premium */}
        <div className="text-right">
          <div className="text-xs font-mono text-slate-700">{fmt$(annual)}</div>
          <div className="text-[10px] text-slate-400">per year</div>
        </div>

        {/* Status */}
        <div className="text-center">
          {expired ? (
            <span className="text-[9px] font-bold uppercase tracking-wide text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Expired</span>
          ) : expSoon ? (
            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Expiring</span>
          ) : (
            <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active</span>
          )}
        </div>

        {/* Risk */}
        <div className="text-center">
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${riskColors[risk].bg} ${riskColors[risk].text}`}>
            {risk}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
          <button onClick={() => { setEditing(e => !e); setExpanded(true); }}
            className="p-1 text-slate-300 hover:text-violet-500 transition-colors rounded">
            <Edit3 className="w-3 h-3" />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1 text-slate-300 hover:text-red-500 transition-colors rounded disabled:opacity-50">
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)}
            className="p-1 text-slate-300 hover:text-slate-600 transition-colors rounded">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="px-4 pb-4 animate-in fade-in duration-150">
          {editing ? (
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditField label="Policy Type" value={form.type} onChange={u("type")} options={POLICY_TYPES} />
                <EditField label="Insured" value={form.insured} onChange={u("insured")} />
                <EditField label="Carrier" value={form.carrier ?? ""} onChange={u("carrier")} />
                <EditField label="Policy Number" value={form.policyNumber ?? ""} onChange={u("policyNumber")} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditField label="Coverage Amount" value={form.coverageAmount} onChange={u("coverageAmount")} type="number" />
                <EditField label="Premium" value={form.premium} onChange={u("premium")} type="number" />
                <EditField label="Frequency" value={form.premiumFrequency} onChange={u("premiumFrequency")}
                  options={["Monthly", "Quarterly", "Semi-Annual", "Annual"]} />
                <EditField label="Beneficiary" value={form.beneficiary ?? ""} onChange={u("beneficiary")} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <EditField label="Issue Date" value={form.issueDate ?? ""} onChange={u("issueDate")} type="date" />
                <EditField label="Expiry Date" value={form.expiryDate ?? ""} onChange={u("expiryDate")} type="date" />
                <EditField label="Riders" value={form.riders ?? ""} onChange={u("riders")} />
                <EditField label="Notes" value={form.notes ?? ""} onChange={u("notes")} />
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button onClick={() => setEditing(false)}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg transition-colors">
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-1 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                  {saving ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-3 h-3" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-6 gap-y-3 pt-1 pb-1">
              {[
                { label: "Carrier",        value: policy.carrier       || "—" },
                { label: "Policy #",       value: policy.policyNumber  || "—" },
                { label: "Issue Date",     value: policy.issueDate     ? new Date(policy.issueDate).toLocaleDateString("en-CA") : "—" },
                { label: "Expiry Date",    value: policy.expiryDate    ? new Date(policy.expiryDate).toLocaleDateString("en-CA") : "—" },
                { label: "Beneficiary",    value: policy.beneficiary   || "—" },
                { label: "Riders",         value: policy.riders        || "—" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">{label}</div>
                  <div className="text-xs text-slate-700 font-medium">{value}</div>
                </div>
              ))}
              {policy.notes && (
                <div className="col-span-full">
                  <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">Notes</div>
                  <div className="text-xs text-slate-600 leading-relaxed">{policy.notes}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Policy Form (inline) ──────────────────────────────────────────────────

function AddPolicyForm({ onSave, onCancel, p }: {
  onSave: (p: Omit<Policy, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    type: "Term Life", insured: "", carrier: "", policyNumber: "",
    coverageAmount: "", premium: "", premiumFrequency: "Monthly",
    issueDate: "", expiryDate: "", beneficiary: "", riders: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const u = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSave() {
    if (!form.insured || !form.coverageAmount) {
      toast({ title: "Required", description: "Insured name and coverage amount are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try { await onSave(form); }
    catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  }

  return (
    <div className="border-b border-slate-100 bg-violet-50/30">
      <div className="px-4 py-3 bg-gradient-to-r from-violet-600/5 to-transparent border-l-2 border-violet-500">
        <div className="text-xs font-semibold text-violet-700 mb-3 flex items-center gap-1.5">
          <Plus className="w-3 h-3" /> New Policy
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <EditField label="Policy Type" value={form.type} onChange={u("type")} options={POLICY_TYPES} />
          <EditField label="Insured" value={form.insured} onChange={u("insured")} />
          <EditField label="Carrier" value={form.carrier} onChange={u("carrier")} />
          <EditField label="Coverage Amount" value={form.coverageAmount} onChange={u("coverageAmount")} type="number" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <EditField label="Premium" value={form.premium} onChange={u("premium")} type="number" />
          <EditField label="Frequency" value={form.premiumFrequency} onChange={u("premiumFrequency")}
            options={["Monthly", "Quarterly", "Semi-Annual", "Annual"]} />
          <EditField label="Issue Date" value={form.issueDate} onChange={u("issueDate")} type="date" />
          <EditField label="Beneficiary" value={form.beneficiary} onChange={u("beneficiary")} />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            {saving
              ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" />
              : <Save className="w-3 h-3" />}
            Add Policy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function GroupedPolicies({ policies, onSave, onDelete, p, id }: {
  policies: Policy[];
  onSave: (p: Policy) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  // Group by carrier, then by type within each carrier
  const groups = policies.reduce<Record<string, Record<string, Policy[]>>>((acc, p) => {
    const carrier = p.carrier?.trim() || "No Carrier";
    const type    = p.type || "Other";
    if (!acc[carrier])       acc[carrier] = {};
    if (!acc[carrier][type]) acc[carrier][type] = [];
    acc[carrier][type].push(p);
    return acc;
  }, {});

  const [collapsedCarriers, setCollapsedCarriers] = useState<Set<string>>(new Set());
  const [collapsedTypes,    setCollapsedTypes]    = useState<Set<string>>(new Set());

  const toggleCarrier = (c: string) => setCollapsedCarriers(s => {
    const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n;
  });
  const toggleType = (key: string) => setCollapsedTypes(s => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  return (
    <>
      {Object.entries(groups).map(([carrier, typeMap]) => {
        const carrierPolicies = Object.values(typeMap).flat();
        const carrierPremium  = carrierPolicies.reduce((s, p) => s + annualPremium(p), 0);
        const carrierCoverage = carrierPolicies.reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);
        const isCarrierCollapsed = collapsedCarriers.has(carrier);

        return (
          <div key={carrier} className="border-b border-slate-200 last:border-0">
            {/* Carrier header */}
            <button
              onClick={() => toggleCarrier(carrier)}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left group"
            >
              <div className="w-4 h-4 rounded bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-2.5 h-2.5 text-violet-600" />
              </div>
              <span className="text-xs font-bold text-slate-800 flex-1">{carrier}</span>
              <span className="text-[10px] text-slate-400 font-medium">
                {carrierPolicies.length} polic{carrierPolicies.length !== 1 ? "ies" : "y"}
              </span>
              <span className="text-[10px] text-slate-400 mx-3">·</span>
              <span className="text-[10px] font-semibold text-slate-600">{fmt$(carrierCoverage)}</span>
              <span className="text-[10px] text-slate-400 mx-3">·</span>
              <span className="text-[10px] font-semibold text-slate-600">{fmt$(carrierPremium)}/yr</span>
              <div className="ml-2 text-slate-400 group-hover:text-slate-600 transition-colors">
                {isCarrierCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </div>
            </button>

            {/* Type groups within carrier */}
            {!isCarrierCollapsed && Object.entries(typeMap).map(([type, typePolicies]) => {
              const typeKey = `${carrier}__${type}`;
              const isTypeCollapsed = collapsedTypes.has(typeKey);
              const typePremium  = typePolicies.reduce((s, p) => s + annualPremium(p), 0);
              const typeCoverage = typePolicies.reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);

              return (
                <div key={type} className="border-t border-slate-100">
                  {/* Type subheader */}
                  <button
                    onClick={() => toggleType(typeKey)}
                    className="w-full flex items-center gap-2 px-6 py-2 bg-white hover:bg-slate-50/60 transition-colors text-left group"
                  >
                    <span className="text-[10px] font-semibold text-slate-500 flex-1 uppercase tracking-wider">{type}</span>
                    <span className="text-[10px] text-slate-400">{typePolicies.length}</span>
                    <span className="text-[10px] text-slate-300 mx-2">·</span>
                    <span className="text-[10px] text-slate-500">{fmt$(typeCoverage)}</span>
                    <span className="text-[10px] text-slate-300 mx-2">·</span>
                    <span className="text-[10px] text-slate-500">{fmt$(typePremium)}/yr</span>
                    <div className="ml-2 text-slate-300 group-hover:text-slate-500 transition-colors">
                      {isTypeCollapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
                    </div>
                  </button>

                  {/* Policy rows */}
                  {!isTypeCollapsed && typePolicies.map(p => (
                    <div key={p.id} className="pl-2">
                      <PolicyRow policy={p} onSave={onSave} onDelete={onDelete} />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}


export function PoliciesTab({ clientId, client }: Props) {
  const [policies,      setPolicies]     = useState<Policy[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [showAdd,       setShowAdd]      = useState(false);
  const [showImporter,  setShowImporter] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<Policy[]>(`/api/crm/clients/${clientId}/policies`)
      .then(setPolicies)
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  // ── Computed intelligence ────────────────────────────────────────────────────

  const totalLife = policies
    .filter(p => p.type.toLowerCase().includes("life"))
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);

  const totalDisability = policies
    .filter(p => p.type.toLowerCase().includes("disability"))
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);

  const totalCritical = policies
    .filter(p => p.type.toLowerCase().includes("critical"))
    .reduce((s, p) => s + parseFloat(p.coverageAmount || "0"), 0);

  const totalAnnualPremium = policies.reduce((s, p) => s + annualPremium(p), 0);

  const income = parseFloat(client?.annualIncome || "0");
  const _mortgage = 0; // TODO: pull from net worth

  // Protection score (0-100)
  const incomeReplPct  = income > 0 ? Math.min(100, (totalLife / (income * 10)) * 100) : 0;
  const disabilityOk   = totalDisability > 0;
  const criticalOk     = totalCritical > 0;
  const protectionScore = Math.round(
    (incomeReplPct * 0.5) +
    (disabilityOk ? 25 : 0) +
    (criticalOk   ? 15 : 0) +
    (policies.length > 0 ? 10 : 0)
  );

  const expiringPolicies = policies.filter(p => {
    const d = daysUntilExpiry(p.expiryDate);
    return d !== null && d >= 0 && d < 365;
  });

  // Advisor alerts
  const alerts: { level: "crit" | "warn" | "ok"; msg: string }[] = [];
  if (!disabilityOk) alerts.push({ level: "crit", msg: "No disability coverage — income unprotected" });
  if (!criticalOk)   alerts.push({ level: "warn", msg: "No critical illness coverage on file" });
  if (income > 0 && totalLife < income * 5)
    alerts.push({ level: "crit", msg: `Life coverage below 5× income — gap ~${fmt$(income * 10 - totalLife)}` });
  if (expiringPolicies.length > 0)
    alerts.push({ level: "warn", msg: `${expiringPolicies.length} polic${expiringPolicies.length > 1 ? "ies" : "y"} expiring within 12 months` });
  if (policies.length === 0)
    alerts.push({ level: "crit", msg: "No policies on file — household unprotected" });
  if (totalLife > 0 && income > 0 && totalLife >= income * 10)
    alerts.push({ level: "ok", msg: `Life coverage adequate — ${Math.round(totalLife / income)}× income` });
  if (disabilityOk)
    alerts.push({ level: "ok", msg: "Disability coverage in place" });

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  async function handleAdd(data: Omit<Policy, "id">) {
    const p = await api.post<Policy>(`/api/crm/clients/${clientId}/policies`, data);
    setPolicies(prev => [...prev, p]);
    setShowAdd(false);
    toast({ title: "Policy added", description: `${data.type} policy added successfully` });
  }

  async function handleSave(data: Policy) {
    await api.patch(`/api/crm/clients/${clientId}/policies/${data.id}`, data);
    setPolicies(prev => prev.map(p => p.id === data.id ? data : p));
    toast({ title: "Saved", description: "Policy updated" });
  }

  async function handleDelete(id: number) {
    await api.delete(`/api/crm/clients/${clientId}/policies/${id}`);
    setPolicies(prev => prev.filter(p => p.id !== id));
    toast({ title: "Removed", description: "Policy removed from file" });
  }

  const scoreColor = protectionScore >= 75 ? "text-emerald-600"
    : protectionScore >= 50 ? "text-amber-600" : "text-red-600";
  const scoreRing = protectionScore >= 75 ? "stroke-emerald-500"
    : protectionScore >= 50 ? "stroke-amber-500" : "stroke-red-500";

  return (
    <div className="flex gap-0 h-full min-h-0">

      {/* ══ LEFT — Main content (70%) ══════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-auto">

        {/* ── Executive Summary Strip ── */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white">
          <div className="grid grid-cols-3 md:grid-cols-6 divide-x divide-slate-100">
            {[
              { label: "Life Coverage",    value: totalLife > 0 ? fmt$(totalLife) : "—",          sub: "total",           hi: totalLife > 0 },
              { label: "Disability",        value: totalDisability > 0 ? fmt$(totalDisability) : "Missing", sub: "coverage",     hi: totalDisability > 0 },
              { label: "Critical Illness",  value: totalCritical > 0 ? fmt$(totalCritical) : "—", sub: "coverage",        hi: totalCritical > 0 },
              { label: "Annual Premium",    value: fmt$(totalAnnualPremium),                       sub: "combined",        hi: true },
              { label: "Policies",          value: String(policies.length),                        sub: "on file",         hi: policies.length > 0 },
              { label: "Expiring Soon",     value: String(expiringPolicies.length),               sub: "within 12 mo.",   hi: expiringPolicies.length === 0 },
            ].map(s => (
              <div key={s.label} className="px-4 py-3">
                <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{s.label}</div>
                <div className={`text-sm font-bold leading-none ${
                  s.label === "Disability" && !s.hi ? "text-red-600" :
                  s.label === "Expiring Soon" && expiringPolicies.length > 0 ? "text-amber-600" :
                  "text-slate-900"
                }`}>{s.value}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Table header ── */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div
              className="grid gap-2 flex-1 text-[9px] font-semibold uppercase tracking-widest text-slate-400"
              style={{ gridTemplateColumns: "1fr 100px 90px 70px 60px 80px" }}
            >
              <span>Policy / Insured</span>
              <span className="text-right">Coverage</span>
              <span className="text-right">Premium</span>
              <span className="text-center">Status</span>
              <span className="text-center">Risk</span>
              <span className="text-right">Actions</span>
            </div>
          </div>
        </div>

        {/* ── Policy rows ── */}
        <div className="flex-1 bg-white">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-violet-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {showAdd && (
                <AddPolicyForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
              )}

              {policies.length === 0 && !showAdd ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                    <Shield className="w-5 h-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-700 mb-1">No policies on file</p>
                  <p className="text-xs text-slate-400 mb-4">Add a policy to begin building this household's protection profile</p>
                  <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add First Policy
                  </button>
                </div>
               ) : (
                <GroupedPolicies policies={policies} onSave={handleSave} onDelete={handleDelete} />
              )}
            </>
          )}
        </div>

        {/* ── Bottom toolbar ── */}
        <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-2.5 flex items-center gap-2">
          <button onClick={() => setShowAdd(a => !a)}
            className="flex items-center gap-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-1.5 rounded-lg transition-colors">
            <Plus className="w-3.5 h-3.5" />
            {showAdd ? "Cancel" : "Add Policy"}
          </button>
          <button onClick={() => setShowImporter(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-3.5 py-1.5 rounded-lg transition-colors">
            <Table className="w-3.5 h-3.5" /> Import Excel
          </button>
          <div className="ml-auto text-[10px] text-slate-400">
            {policies.length} polic{policies.length !== 1 ? "ies" : "y"} · {fmt$(totalAnnualPremium)}/yr
          </div>
        </div>
      </div>

      {/* ══ RIGHT — Intelligence Rail (30%) ════════════════════════════════════ */}
      <div className="w-72 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-auto">

        {/* Protection Score */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Protection Score</div>
          <div className="flex items-center gap-4">
            {/* Circular score gauge */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#f1f5f9" strokeWidth="3" />
                <circle cx="18" cy="18" r="15" fill="none"
                  className={scoreRing}
                  strokeWidth="3"
                  strokeDasharray={`${(protectionScore / 100) * 94.2} 94.2`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-sm font-bold ${scoreColor}`}>{protectionScore}</span>
              </div>
            </div>
            <div>
              <div className={`text-sm font-bold ${scoreColor}`}>
                {protectionScore >= 75 ? "Well Protected" : protectionScore >= 50 ? "Needs Attention" : "At Risk"}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                {protectionScore >= 75 ? "Household coverage meets baseline thresholds" :
                 protectionScore >= 50 ? "Some gaps detected — review recommended" :
                 "Critical protection gaps require immediate action"}
              </div>
            </div>
          </div>
        </div>

        {/* Coverage Adequacy */}
        <div className="px-4 py-4 border-b border-slate-100 space-y-3">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400">Coverage Adequacy</div>
          <CoverageBar
            label="Income Replacement"
            pct={incomeReplPct}
            tone={incomeReplPct >= 80 ? "green" : incomeReplPct >= 50 ? "amber" : "red"}
          />
          <CoverageBar
            label="Disability Protection"
            pct={totalDisability > 0 ? 100 : 0}
            tone={totalDisability > 0 ? "green" : "red"}
          />
          <CoverageBar
            label="Critical Illness"
            pct={totalCritical > 0 ? 100 : 0}
            tone={totalCritical > 0 ? "green" : "amber"}
          />
        </div>

        {/* Advisor Alerts */}
        <div className="px-4 py-4 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Advisor Intelligence</div>
          {alerts.length === 0 ? (
            <div className="text-xs text-slate-400">Add policies to generate intelligence</div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg ${
                  a.level === "crit" ? "bg-red-50 border border-red-100" :
                  a.level === "warn" ? "bg-amber-50 border border-amber-100" :
                  "bg-emerald-50 border border-emerald-100"
                }`}>
                  {a.level === "ok"
                    ? <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className={`w-3 h-3 flex-shrink-0 mt-0.5 ${a.level === "crit" ? "text-red-500" : "text-amber-500"}`} />
                  }
                  <p className={`text-[10px] leading-relaxed font-medium ${
                    a.level === "crit" ? "text-red-700" :
                    a.level === "warn" ? "text-amber-700" :
                    "text-emerald-700"
                  }`}>{a.msg}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Household scenarios */}
        {policies.length > 0 && (
          <div className="px-4 py-4 border-t border-slate-100">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-3">Household Scenarios</div>
            <div className="space-y-2">
              {[
                { label: "Survivor Income",    ok: totalLife >= (income * 5), desc: totalLife >= (income * 5) ? "Protected" : "Gap exists" },
                { label: "Disability Income",  ok: totalDisability > 0,      desc: totalDisability > 0 ? "Covered" : "Unprotected" },
                { label: "Critical Illness",   ok: totalCritical > 0,        desc: totalCritical > 0 ? "Covered" : "No coverage" },
                { label: "Estate Liquidity",   ok: totalLife > 500000,       desc: totalLife > 500000 ? "Adequate" : "Review needed" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-1.5">
                    <StatusDot level={s.ok ? "ok" : "warn"} />
                    <span className="text-[10px] text-slate-600">{s.label}</span>
                  </div>
                  <span className={`text-[10px] font-semibold ${s.ok ? "text-emerald-600" : "text-amber-600"}`}>
                    {s.desc}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Importer modal ── */}
      {showImporter && (
        <PolicyImporter
          clientId={clientId}
          onClose={() => setShowImporter(false)}
          onImported={() => { load(); setShowImporter(false); }}
        />
      )}
    </div>
  );
}
