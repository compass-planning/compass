import { useState, useEffect, useCallback } from "react";
import { lazy, Suspense } from "react";
import { useAuth } from "../lib/auth";
import { token } from "../lib/api";
import { api } from "../lib/api";
import { useToast, toast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar, type Tab } from "../components/Sidebar";
import { PlanningDocFlow, PLANNING_TABS, type PlanningTab } from "../components/layout/PlanningDocFlow";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { TabLoader, Field, SectionHeader, Card, Input, Select, DobInput, Textarea } from "../components/ui/AppHelpers";
import { ChangePasswordModal } from "../components/ChangePasswordModal";
import { SubscriptionBanner } from "../components/SubscriptionBanner";
import { SubscriptionModal }  from "../components/SubscriptionModal";
const AITab = lazy(() => import("./FinancialPlanning").then(m => ({ default: m.AITab })));
const NetWorthTabNew   = lazy(() => import("./MultiEntryTabs").then(m => ({ default: m.NetWorthTab })));
const RetirementHub    = lazy(() => import("../components/RetirementHub").then(m => ({ default: m.RetirementHub })));
const TaxEstateHub     = lazy(() => import("../components/TaxEstateHub").then(m => ({ default: m.TaxEstateHub })));
const ProtectionHub    = lazy(() => import("../components/ProtectionHub").then(m => ({ default: m.ProtectionHub })));
const DocumentsHub     = lazy(() => import("../components/DocumentsHub").then(m => ({ default: m.DocumentsHub })));
const FinancialPlanHub = lazy(() => import("../components/FinancialPlanHub").then(m => ({ default: m.FinancialPlanHub })));
const DebtTab = lazy(() => import("./MultiEntryTabs").then(m => ({ default: m.DebtTab })));
const GoalsTab         = lazy(() => import("./GoalsTab").then(m => ({ default: m.GoalsTab })));
const ExpensesTab      = lazy(() => import("./ExpensesTab").then(m => ({ default: m.ExpensesTab })));
const ReportsTab       = lazy(() => import("./ReportsTab").then(m => ({ default: m.ReportsTab })));
const LettersTab       = lazy(() => import("./LettersTab").then(m => ({ default: m.LettersTab })));
// AgentsTab removed — hierarchy eliminated
const InsightLedDashboard = lazy(() => import("../components/InsightLedDashboard").then(m => ({ default: m.InsightLedDashboard })));

import { fmt$, fmtPct, initials, avatarBg, cn } from "../lib/utils";
import { VoiceProvider, useVoice, labelToKey } from "../contexts/VoiceContext";
import { ClientOverview } from "./ClientOverview";
import { MeetingRecorderTrigger, IntakeRecorderTrigger, type IntakeProfile } from "../components/MeetingRecorder";
import { useHotkeys } from "../hooks/useHotkeys";
import { CommandPalette, type CommandAction } from "../components/ui/CommandPalette";
import { InlineEdit } from "../components/ui/InlineEdit";
import { translations, type T, type ClientLocale } from "../i18n/translations";
import { Globe,
  Plus, Pencil, Trash2, X, Check, Search,
  User, Users, UserPlus, Baby, FileText, Home, Calendar, Briefcase, LogOut, Save, KeyRound, Eye, EyeOff, Mic, MicOff, Loader2,
  LayoutDashboard, PiggyBank, Shield, Receipt, Target, Brain, Scale, ChevronRight, ChevronUp, ChevronDown,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface Client { id: number; firstName: string; lastName: string; email: string | null; phone: string | null; dateOfBirth: string | null; province: string | null; occupation: string | null; employmentStatus: string | null; annualIncome: string | null; spouseFirstName: string | null; spouseLastName: string | null; spouseDateOfBirth: string | null; spouseOccupation: string | null; spouseAnnualIncome: string | null; spouseRetirementAge: number | null; spouseDesiredRetirementIncome: string | null; spousePensionType: string | null; dependants: any; retirementAge: number | null; desiredRetirementIncome: string | null; notes: string | null; pensionType: string | null; preferredLanguage: string | null; updatedAt: string; }
interface Plan { id: number; name: string; status: string; createdAt: string; }
interface NWEntry { id: number; type: string; category: string; name: string; value: string; notes: string | null; }
interface Overview { netWorth: number; totalAssets: number; totalLiabilities: number; totalDebt: number; retirementProjections: number; insuranceAnalyses: number; educationPlans: number; taxNotes: number; estateNotes: number; aiRecommendations: number; pendingAi: number; plans: number; }

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

//

// ─────────────────────────────────────────────────────────────────────────────
// ADVISOR OPERATIONS QUEUE
// Drop-in replacement for ClientCard + ClientsTab in App.tsx
//
// HOW TO USE:
//   1. Delete the existing `function ClientCard(...)` block
//   2. Delete the existing `function ClientsTab(...)` block  
//   3. Paste this entire file's contents in their place
//   4. The `onSelect` prop is preserved — clicking "Open" navigates as before
// ─────────────────────────────────────────────────────────────────────────────

// ── Household Score ───────────────────────────────────────────────────────────

function householdScore(ov: Overview | null): number {
  if (!ov) return 0;
  let score = 100;
  if (ov.retirementProjections === 0) score -= 22;
  if (ov.insuranceAnalyses     === 0) score -= 18;
  if (ov.pendingAi > 0)               score -= Math.min(25, ov.pendingAi * 8);
  if (ov.netWorth <= 0)               score -= 10;
  return Math.max(0, score);
}

function scoreLabel(s: number): { label: string; cls: string; dot: string } {
  if (s >= 85) return { label: "Optimized",     cls: "text-emerald-600 bg-emerald-50 border-emerald-100", dot: "bg-emerald-400" };
  if (s >= 70) return { label: "Review Needed", cls: "text-blue-600    bg-blue-50    border-blue-100",    dot: "bg-blue-400" };
  if (s >= 50) return { label: "Planning Gaps", cls: "text-amber-600   bg-amber-50   border-amber-100",   dot: "bg-amber-400" };
  return               { label: "Critical",      cls: "text-red-600    bg-red-50     border-red-100",      dot: "bg-red-400" };
}

function fmtNw(nw: number | null): string {
  if (nw === null) return "—";
  if (Math.abs(nw) >= 1_000_000) return `$${(nw / 1_000_000).toFixed(1)}M`;
  if (Math.abs(nw) >= 1_000)    return `$${Math.round(nw / 1000)}K`;
  return `$${Math.round(nw)}`;
}

// ── Household Row ─────────────────────────────────────────────────────────────

function HouseholdRow({
  c, onSelect, onDelete, onOvReady, keyboardActive,
}: {
  c: Client;
  onSelect: (c: Client) => void;
  onDelete: (id: number) => void;
  onOvReady?: (id: number, ov: Overview) => void;
  keyboardActive?: boolean;
}) {
  const [ov,       setOv]       = useState<Overview | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get<Overview>(`/api/clients/${c.id}/overview`).then(data => {
      setOv(data);
      onOvReady?.(c.id, data);
    }).catch(() => {});
  }, [c.id]);

  const score      = householdScore(ov);
  const { label: statusLabel, cls: statusCls, dot: dotCls } = scoreLabel(score);
  const nw         = ov?.netWorth ?? null;
  const actionCount = ov
    ? ov.pendingAi + (ov.retirementProjections === 0 ? 1 : 0) + (ov.insuranceAnalyses === 0 ? 1 : 0)
    : 0;

  const gaps: string[] = [];
  if (ov?.retirementProjections === 0) gaps.push("No retirement plan");
  if (ov?.insuranceAnalyses     === 0) gaps.push("No insurance analysis");
  if ((ov?.pendingAi ?? 0) > 0)        gaps.push(`${ov!.pendingAi} AI action${ov!.pendingAi > 1 ? "s" : ""} pending`);

  const nextAction = gaps[0] ?? "Review complete";

  const scoreColor = score >= 85 ? "#10b981" : score >= 70 ? "#3b82f6" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className={`border-b border-slate-100 last:border-0 transition-colors group ${
      keyboardActive ? "bg-blue-50/50" : expanded ? "bg-slate-50/60" : "hover:bg-slate-50/40"
    }`}>

      {/* ── Main row ── */}
      <div
        className="grid items-center px-4 py-3 cursor-pointer select-none"
        style={{ gridTemplateColumns: "2fr 110px 100px 120px 1fr 90px" }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Household */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-full ${avatarBg(c.firstName + c.lastName)} flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0`}>
            {initials(c.firstName, c.lastName)}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate leading-none mb-0.5">
              {c.firstName} {c.lastName}
            </div>
            <div className="text-[10px] text-slate-400 truncate">
              {c.email ?? c.province ?? "—"}
            </div>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-2">
          <div className="relative w-6 h-6 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
              <circle cx="12" cy="12" r="9" fill="none" stroke="#f1f5f9" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="9" fill="none"
                stroke={scoreColor} strokeWidth="2.5"
                strokeDasharray={`${(score / 100) * 56.5} 56.5`}
                strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[7px] font-bold" style={{ color: scoreColor }}>{score}</span>
            </div>
          </div>
          <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${statusCls}`}>
            {statusLabel}
          </span>
        </div>

        {/* Net Worth */}
        <div className="text-right">
          {ov ? (
            <span className={`text-sm font-semibold ${(nw ?? 0) >= 0 ? "text-slate-900" : "text-red-600"}`}>
              {fmtNw(nw)}
            </span>
          ) : (
            <span className="text-xs text-slate-300">—</span>
          )}
        </div>

        {/* Alerts */}
        <div>
          {actionCount > 0 ? (
            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded">
              ⚠ {actionCount} alert{actionCount > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-[10px] text-emerald-600 font-medium">✓ Clear</span>
          )}
        </div>

        {/* Next Action */}
        <div className="text-[10px] text-slate-500 truncate pr-4">{nextAction}</div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onSelect(c)}
            className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition-colors border border-blue-100"
          >
            Open →
          </button>
          <button
            onClick={() => { if (confirm(`Delete ${c.firstName} ${c.lastName}?`)) onDelete(c.id); }}
            className="p-1 text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 rounded"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)}
            className="p-1 text-slate-300 hover:text-slate-500 transition-colors rounded">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Inline expansion ── */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Planning status */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Planning Status</div>
              <div className="space-y-1.5">
                {[
                  { label: "Retirement Plan", ok: (ov?.retirementProjections ?? 0) > 0, value: `${ov?.retirementProjections ?? 0} plan${(ov?.retirementProjections ?? 0) !== 1 ? "s" : ""}` },
                  { label: "Insurance Analysis", ok: (ov?.insuranceAnalyses ?? 0) > 0, value: `${ov?.insuranceAnalyses ?? 0} analysis` },
                  { label: "AI Insights", ok: (ov?.pendingAi ?? 0) === 0, value: (ov?.pendingAi ?? 0) > 0 ? `${ov!.pendingAi} pending` : "Clear" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.ok ? "bg-emerald-400" : "bg-amber-400"}`} />
                      <span className="text-[10px] text-slate-600">{item.label}</span>
                    </div>
                    <span className={`text-[10px] font-semibold ${item.ok ? "text-emerald-600" : "text-amber-600"}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial snapshot */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Financial Snapshot</div>
              <div className="space-y-1.5">
                {[
                  { label: "Net Worth",    value: fmtNw(nw) },
                  { label: "Region",       value: c.province ?? "—" },
                  { label: "Plans", value: `${ov?.retirementProjections ?? 0} on file` },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                    <span className="text-[10px] font-semibold text-slate-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Open gaps */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Open Gaps</div>
              {gaps.length === 0 ? (
                <div className="text-[10px] text-emerald-600 font-medium">✓ No gaps detected</div>
              ) : (
                <div className="space-y-1">
                  {gaps.map((g, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <span className="text-amber-500 text-[10px] mt-0.5">⚠</span>
                      <span className="text-[10px] text-slate-600">{g}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">Quick Actions</div>
              <div className="space-y-1.5">
                <button onClick={() => onSelect(c)}
                  className="w-full text-left text-[10px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors border border-blue-100 flex items-center justify-between">
                  Open full profile <span>→</span>
                </button>
                {(ov?.retirementProjections ?? 0) === 0 && (
                  <button onClick={() => onSelect(c)}
                    className="w-full text-left text-[10px] font-medium text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg transition-colors border border-amber-100 flex items-center justify-between">
                    Create retirement plan <span>→</span>
                  </button>
                )}
                {(ov?.insuranceAnalyses ?? 0) === 0 && (
                  <button onClick={() => onSelect(c)}
                    className="w-full text-left text-[10px] font-medium text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg transition-colors border border-slate-100 flex items-center justify-between">
                    Insurance analysis <span>→</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Clients Tab (Advisor Operations Queue) ────────────────────────────────────

// ClientsTab replaced — single user app, auto-selects the user's own profile
function ClientsTab({ onSelect }: { onSelect: (c: Client) => void }) {
  const [client, setClient] = useState<Client | null>(null);

  useEffect(() => {
    api.get<Client>("/api/auth/me/profile").then(profile => {
      setClient(profile);
      onSelect(profile);
    }).catch(() => {});
  }, []);

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-violet-600/30 border-t-violet-600 rounded-full animate-spin" />
      </div>
    );
  }
  return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Client Detail — shown when a client is selected (name, family, plans)
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetail({ client, onBack, onPlanSelect, onUpdate, onLocaleChange, t = translations.en }: { client: Client; onBack: () => void; onPlanSelect: (p: Plan) => void; onUpdate: (c: Client) => void; onLocaleChange: (l: ClientLocale) => void; t?: T }) {
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState<Partial<Client>>({ ...client });
  const [busy, setBusy]         = useState(false);
  const [newPlanName, setNewPlanName] = useState("Financial Plan");
  const u = (k: keyof Client, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Jurisdiction-aware region list
  const { user } = useAuth();
  const jurisdiction = (client as any).jurisdiction ?? (user as any)?.jurisdiction ?? "CA";
  const regions = jurisdiction === "US"
    ? ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
    : PROVINCES;
  const regionLabel = jurisdiction === "US" ? "State" : "Province";
  const defaultRegion = jurisdiction === "US" ? "CA" : "ON";

  useEffect(() => {
    api.get<Plan[]>(`/api/clients/${client.id}/plans`).then(setPlans);
  }, [client.id]);

  async function save() {
    setBusy(true);
    try { const updated = await api.patch<Client>(`/api/clients/${client.id}`, form); setEditing(false); onUpdate(updated); }
    catch (e: any) {toast({ title: "Error", description: e.message, variant: "destructive" }) }
    finally { setBusy(false); }
  }

  async function inlinePatch(data: Partial<Client>) {
    try {
      const updated = await api.patch<Client>(`/api/clients/${client.id}`, data);
      onUpdate(updated);
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  }

  async function deletePlan(planId: number) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    await api.delete(`/api/plans/${planId}`);
    setPlans(prev => prev.filter(p => p.id !== planId));
  }
   async function createPlan() {
     const p = await api.post<Plan>(`/api/clients/${client.id}/plans`, { name: newPlanName });
     setPlans(prev => [p, ...prev]);
     if (false) { // removed standard-level gate
       onPlanSelect(p);
       // navigate to FNA tab after selecting plan
     } else {
       onPlanSelect(p);
     }
   }

  // ── Helpers for the Household card ─────────────────────────────────────────
  const dependants: any[] = (editing ? (form.dependants as any[]) : (client.dependants as any[])) ?? [];
  const hasSpouse = !!(client.spouseFirstName || (editing && form.spouseFirstName));
  const householdName = client.spouseFirstName ? `The ${client.lastName} Household` : `${client.firstName} ${client.lastName}`;
  const ageFromDob = (dob: string | null | undefined) => {
    if (!dob) return null;
    const d = new Date(dob);
    if (isNaN(d.getTime())) return null;
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  };

  const [ov, setOv] = useState<Overview | null>(null);

  useEffect(() => {
    api.get<Overview>(`/api/clients/${client.id}/overview`).then(setOv).catch(() => {});
  }, [client.id]);

  const nwFmt = (n: number) =>
    Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000).toLocaleString()}K`;

  const insights: { msg: string; color: string }[] = [];
  if (ov) {
    if (ov.pendingAi > 0) insights.push({ msg: `${ov.pendingAi} AI recommendation${ov.pendingAi > 1 ? "s" : ""} awaiting review`, color: "amber" });
    if (ov.retirementProjections === 0) insights.push({ msg: "No retirement projection on file — consider adding one", color: "blue" });
    if (ov.insuranceAnalyses === 0) insights.push({ msg: "No insurance analysis on file — protection gap unknown", color: "red" });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* ── Back + Title bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors">
          <ChevronRight className="w-4 h-4 rotate-180" />
        </button>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${avatarBg(client.firstName+client.lastName)} flex items-center justify-center text-white font-bold`}>
            {initials(client.firstName, client.lastName)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{householdName}</h1>
            <p className="text-sm text-gray-400">{client.province ?? "—"} · {hasSpouse ? "2 adults" : "1 adult"}{dependants.length ? ` · ${dependants.length} ${dependants.length === 1 ? "dependant" : "dependants"}` : ""}</p>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {/* Client language toggle — controls report/letter language */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-0.5" title="Report language">
              <Globe className="w-3.5 h-3.5 text-gray-400 ml-1.5" />
              {(["en", "fr"] as const).map(lang => {
                const activeLang = client.preferredLanguage ?? (client.province === "QC" ? "fr" : "en");
                return (
                  <button
                    key={lang}
                    onClick={async () => {
                      try {
                        const updated = await api.patch<Client>(`/api/clients/${client.id}`, { preferredLanguage: lang });
                        onUpdate(updated);
                        onLocaleChange(lang as ClientLocale);
                      } catch {}
                    }}
                    className={`text-xs font-semibold px-2 py-1 rounded transition-colors ${
                      activeLang === lang
                        ? "bg-[#0c1e3a] text-white"
                        : "text-gray-400 hover:text-gray-700"
                    }`}
                  >{lang.toUpperCase()}</button>
                );
              })}
            </div>
            <span className="text-[10px] text-gray-400">Report lang</span>
          </div>
          <div className="flex gap-2">
          {editing ? (
            <>
              <button onClick={() => { setEditing(false); setForm({...client}); }} className="text-sm text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg">Cancel</button>
              <button onClick={save} disabled={busy} className="flex items-center gap-1.5 text-sm text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg disabled:opacity-50">
                <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save"}
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg">
              <Pencil className="w-3.5 h-3.5" /> Edit
            </button>
          )}
          </div>
        </div>
      </div>

      {/* ── Top insight bar ───────────────────────────────────────────────── */}
      {ov && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Net Worth",          value: nwFmt(ov.netWorth),            color: ov.netWorth >= 0 ? "text-emerald-600" : "text-red-500" },
            { label: "Retirement Plans",   value: String(ov.retirementProjections), color: ov.retirementProjections > 0 ? "text-blue-600" : "text-slate-400" },
            { label: "Insurance Analyses", value: String(ov.insuranceAnalyses),   color: ov.insuranceAnalyses > 0 ? "text-blue-600" : "text-red-500" },
            { label: "Pending AI Actions", value: String(ov.pendingAi),           color: ov.pendingAi > 0 ? "text-amber-600" : "text-slate-400" },
          ].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-all duration-200">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className={`text-xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Advisor insights ─────────────────────────────────────────────── */}
      {insights.map((ins, i) => (
        <div key={i} className={`rounded-xl p-4 text-sm font-medium border ${
          ins.color === "amber" ? "bg-amber-50 border-amber-100 text-amber-700"
          : ins.color === "red"  ? "bg-red-50 border-red-100 text-red-700"
          : "bg-blue-50 border-blue-100 text-blue-700"
        }`}>
          ⚠ {ins.msg}
        </div>
      ))}

      {/* ── Single full-width Household card ─────────────────────────────── */}
      <Card className="!p-0 overflow-hidden mb-6">
        {/* Card header strip */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#0c1e3a]/5 rounded-lg flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-[#0c1e3a]" />
            </div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">Household Profile</h2>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {hasSpouse ? "Joint File" : "Single File"}
          </span>
        </div>

        {/* Adults — primary + spouse side by side */}
        <div className={cn(
          "grid",
          (hasSpouse || editing) ? "grid-cols-1 lg:grid-cols-2 lg:divide-x divide-gray-100" : "grid-cols-1",
        )}>
          {/* ── Primary ── */}
          <PersonPanel
            roleLabel="Primary Client"
            avatarBg={avatarBg(client.firstName + client.lastName)}
            avatarInitials={initials(client.firstName, client.lastName)}
            displayName={`${client.firstName} ${client.lastName}`}
            displaySubtitle={[client.occupation, ageFromDob(client.dateOfBirth) ? `age ${ageFromDob(client.dateOfBirth)}` : null].filter(Boolean).join(" · ") || "Occupation not set"}
            editing={editing}
            edit={
              <div className="grid grid-cols-2 gap-3">
                <Input label="First Name"  value={form.firstName ?? ""} onChange={v => u("firstName", v)} />
                <Input label="Last Name"   value={form.lastName ?? ""}  onChange={v => u("lastName", v)} />
                <Input label="Email" type="email" value={form.email ?? ""} onChange={v => u("email", v)} />
                <Input label="Phone"       value={form.phone ?? ""}     onChange={v => u("phone", v)} />
                <DobInput label={t.client.dateOfBirth} value={form.dateOfBirth ?? ""} onChange={v => u("dateOfBirth", v)} />
                <Select label={regionLabel} value={form.province ?? defaultRegion} onChange={v => u("province", v)} options={regions} />
                <Input label={t.client.occupation}  value={form.occupation ?? ""} onChange={v => u("occupation", v)} />
                <Input label={t.client.annualIncome} type="number" value={form.annualIncome ?? ""} onChange={v => u("annualIncome", v)} />
                <Select label={t.client.pensionType} value={(form as any).pensionType ?? ""} onChange={v => u("pensionType", v)} options={["", "DBPP", "DCPP", "Group RRSP", "DPSP", "No Pension"]} />
                <Input label={t.client.retirementAge} type="number" value={String(form.retirementAge ?? "")} onChange={v => u("retirementAge", +v)} />
                <Input label={t.client.desiredIncome} type="number" value={form.desiredRetirementIncome ?? ""} onChange={v => u("desiredRetirementIncome", v)} />
              </div>
            }
            view={
              <dl className="grid grid-cols-2 gap-y-3 gap-x-6">
                <ExecField label="Email"          value={client.email}                     onSave={v => inlinePatch({ email: v })} />
                <ExecField label="Phone"          value={client.phone}                     onSave={v => inlinePatch({ phone: v })} />
                <ExecField label={t.client.dateOfBirth}  value={client.dateOfBirth}               onSave={v => inlinePatch({ dateOfBirth: v })} />
                <ExecField label={t.client.province}       value={client.province}                  onSave={v => inlinePatch({ province: v })} />
                <ExecField label={t.client.occupation}     value={client.occupation}                onSave={v => inlinePatch({ occupation: v })} />
                <ExecField label={t.client.annualIncome}  value={fmt$(client.annualIncome)} mono   onSave={v => inlinePatch({ annualIncome: v })} type="number" />
                <ExecField label="Pension"        value={(client as any).pensionType}      onSave={v => inlinePatch({ pensionType: v } as any)} />
                <ExecField label={t.client.retirementAge} value={client.retirementAge} mono        onSave={v => inlinePatch({ retirementAge: +v })} type="number" />
                <ExecField label="Desired Income" value={fmt$(client.desiredRetirementIncome)} mono onSave={v => inlinePatch({ desiredRetirementIncome: v })} type="number" />
              </dl>
            }
          />

          {/* ── Spouse ── */}
          {(hasSpouse || editing) ? (
            <PersonPanel
              roleLabel="Spouse / Partner"
              avatarBg={avatarBg((client.spouseFirstName ?? "") + (client.spouseLastName ?? ""))}
              avatarInitials={initials(client.spouseFirstName ?? "", client.spouseLastName ?? "")}
              displayName={`${client.spouseFirstName ?? ""} ${client.spouseLastName ?? ""}`.trim()}
              displaySubtitle={[client.spouseOccupation, ageFromDob(client.spouseDateOfBirth) ? `age ${ageFromDob(client.spouseDateOfBirth)}` : null].filter(Boolean).join(" · ") || "Occupation not set"}
              editing={editing}
              edit={
                <div className="grid grid-cols-2 gap-3">
                  <Input label={t.client.spouseFirstName} value={form.spouseFirstName ?? ""} onChange={v => u("spouseFirstName", v)} />
                  <Input label={t.client.spouseLastName}  value={form.spouseLastName ?? ""}  onChange={v => u("spouseLastName", v)} />
                  <DobInput label={t.client.spouseDOB} value={form.spouseDateOfBirth ?? ""} onChange={v => u("spouseDateOfBirth", v)} />
                  <Input label={t.client.spouseOccupation} value={form.spouseOccupation ?? ""} onChange={v => u("spouseOccupation", v)} />
                  <Input label={t.client.spouseIncome} type="number" value={form.spouseAnnualIncome ?? ""} onChange={v => u("spouseAnnualIncome", v)} />
                  <Input label={t.client.spouseRetirementAge} type="number" value={String(form.spouseRetirementAge ?? "")} onChange={v => u("spouseRetirementAge", +v)} />
                  <Select label="Spouse Pension Type" value={(form as any).spousePensionType ?? ""} onChange={v => u("spousePensionType", v)} options={["", "DBPP", "DCPP", "Group RRSP", "DPSP", "No Pension"]} />
                  <Input label="Spouse Desired Income" type="number" value={form.spouseDesiredRetirementIncome ?? ""} onChange={v => u("spouseDesiredRetirementIncome", v)} />
                </div>
              }
              view={
                <dl className="grid grid-cols-2 gap-y-3 gap-x-6">
                  <ExecField label={t.client.dateOfBirth}  value={client.spouseDateOfBirth}             onSave={v => inlinePatch({ spouseDateOfBirth: v })} />
                  <ExecField label={t.client.occupation}     value={client.spouseOccupation}               onSave={v => inlinePatch({ spouseOccupation: v })} />
                  <ExecField label={t.client.annualIncome}  value={fmt$(client.spouseAnnualIncome)} mono   onSave={v => inlinePatch({ spouseAnnualIncome: v })} type="number" />
                  <ExecField label="Pension"        value={(client as any).spousePensionType}      onSave={v => inlinePatch({ spousePensionType: v } as any)} />
                  <ExecField label={t.client.retirementAge} value={client.spouseRetirementAge} mono        onSave={v => inlinePatch({ spouseRetirementAge: +v })} type="number" />
                  <ExecField label="Desired Income" value={fmt$(client.spouseDesiredRetirementIncome)} mono />
                </dl>
              }
            />
          ) : (
            !editing && (
              <div className="px-6 py-8 flex flex-col items-center justify-center text-center border-t lg:border-t-0 border-gray-100">
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 mb-2">
                  <UserPlus className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">No Spouse on File</p>
                <button onClick={() => setEditing(true)} className="text-xs text-[#0c1e3a] font-semibold hover:underline">Add spouse details</button>
              </div>
            )
          )}
        </div>

        {/* ── Dependants strip ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Baby className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Children & Dependants</h3>
              {dependants.length > 0 && (
                <span className="text-[11px] text-gray-400 font-medium">· {dependants.length}</span>
              )}
            </div>
            {editing && (
              <button
                type="button"
                onClick={() => u("dependants", [...((form.dependants as any[]) ?? []), { name: "", dob: "", relationship: "Child" }])}
                className="flex items-center gap-1 text-xs font-semibold text-[#0c1e3a] hover:underline"
              >
                <Plus className="w-3 h-3" /> Add Dependant
              </button>
            )}
          </div>

          {editing ? (
            // Edit mode — full row inputs
            <div className="space-y-2">
              {dependants.length === 0 && (
                <p className="text-xs text-gray-400 italic">No dependants — click "Add Dependant" to add a child or other family member.</p>
              )}
              {dependants.map((d: any, i: number) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-end bg-white rounded-lg border border-gray-100 p-3">
                  <div className="col-span-5">
                    <Input label="Name" value={d.name ?? ""} onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], name: v }; u("dependants", deps); }} />
                  </div>
                  <div className="col-span-3">
                    <DobInput label="DOB" value={d.dob ?? ""} onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], dob: v }; u("dependants", deps); }} />
                  </div>
                  <div className="col-span-3">
                    <Select label="Relation" value={d.relationship ?? "Child"} onChange={v => { const deps = [...dependants]; deps[i] = { ...deps[i], relationship: v }; u("dependants", deps); }} options={["Child", "Parent", "Sibling", "Other"]} />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => u("dependants", dependants.filter((_: any, idx: number) => idx !== i))} className="mb-1 text-red-400 hover:text-red-600 p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : dependants.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No dependants on file</p>
          ) : (
            // View mode — horizontal row of executive avatar pills
            <div className="flex flex-wrap gap-2">
              {dependants.map((d: any, i: number) => {
                const age = ageFromDob(d.dob);
                return (
                  <div key={i} className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-lg pl-1.5 pr-3 py-1.5">
                    <div className={`w-7 h-7 rounded-md ${avatarBg(d.name ?? "?")} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}>
                      {initials(d.name?.split(" ")[0] ?? "", d.name?.split(" ")[1] ?? "")}
                    </div>
                    <div className="flex flex-col leading-tight">
                      <span className="text-xs font-bold text-gray-800">{d.name || "Unnamed"}</span>
                      <span className="text-[10px] text-gray-400 font-medium">
                        {(d.relationship ?? "Child")}{age !== null ? ` · age ${age}` : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Notes (always visible if present, editable in edit mode) ─── */}
        {(editing || client.notes) && (
          <div className="px-6 py-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Advisor Notes</h3>
            </div>
            {editing ? (
              <Textarea label="" value={form.notes ?? ""} onChange={v => u("notes", v)} />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{client.notes}</p>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PersonPanel — one column of the Household card (Primary or Spouse)
// ─────────────────────────────────────────────────────────────────────────────
function PersonPanel({ roleLabel, avatarBg, avatarInitials, displayName, displaySubtitle, editing, edit, view }: {
  roleLabel: string;
  avatarBg: string;
  avatarInitials: string;
  displayName: string;
  displaySubtitle: string;
  editing: boolean;
  edit: React.ReactNode;
  view: React.ReactNode;
}) {
  return (
    <div className="px-6 py-5">
      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-gray-100">
        <div className={`w-12 h-12 rounded-xl ${avatarBg} flex items-center justify-center text-white text-base font-bold shadow-sm`}>
          {avatarInitials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{roleLabel}</p>
          <h3 className="text-base font-bold text-gray-900 truncate">{displayName || "—"}</h3>
          <p className="text-xs text-gray-400 truncate">{displaySubtitle}</p>
        </div>
      </div>
      {editing ? edit : view}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ExecField — refined "executive" read-only field. Label small, value bold.
// ─────────────────────────────────────────────────────────────────────────────
function ExecField({ label, value, mono = false, onSave, type = "text" }: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  onSave?: (v: string) => void;
  type?: "text" | "number";
}) {
  const v = value === null || value === undefined || value === "" ? "—" : value;
  const isEmpty = v === "—";
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-0.5">{label}</dt>
      <dd className={cn(
        "text-sm font-semibold truncate",
        isEmpty ? "text-gray-300" : "text-gray-800",
        mono && !isEmpty && "font-mono tabular-nums",
      )}>
        {onSave ? (
          <InlineEdit
            value={v === "—" ? "" : String(v)}
            type={type}
            onSave={onSave}
            placeholder={label}
            className={cn("text-sm font-semibold", mono && "font-mono tabular-nums", isEmpty && "text-gray-300")}
          />
        ) : v}
      </dd>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const [showForceReset, setShowForceReset] = useState(!!user?.mustResetPassword);
  const [showChangePw, setShowChangePw]     = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [nwSubtabHint, setNwSubtabHint] = useState<string | undefined>(undefined);
  const [person, setPerson] = useState<"primary"|"spouse"|"combined">("primary");
  // Single profile — auto-loaded on boot, never null after first fetch
  const [client, setClient]       = useState<Client | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [clientLocale, setClientLocale] = useState<ClientLocale>("en");

  // Auto-load the user's own financial profile on boot
  useEffect(() => {
    api.get<Client>("/api/auth/me/profile")
      .then(setClient)
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user?.id]);

  // Auto-sync locale from profile province
  useEffect(() => {
    if (!client) { setClientLocale("en"); return; }
    const lang = (client.preferredLanguage ?? (client.province === "QC" ? "fr" : "en")) as ClientLocale;
    setClientLocale(lang);
  }, [client?.id, client?.preferredLanguage]);
  const [plan, setPlan]           = useState<Plan | null>(null);
  const [clientOv, setClientOv]   = useState<Overview | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [clientNavIdx, setClientNavIdx] = useState(0);

  // Context-aware "A" = quick add for current tab
  function contextAdd() {
    if (!client) return;
    const addMap: Partial<Record<Tab, Tab>> = {
      networth:      "networth",
      goals:         "goals",
      expenses:      "expenses",
      retirementhub: "retirementhub",
      protection:    "protection",
    };
    // Navigate to the tab and fire a custom event the tab can listen to
    const dest = addMap[tab];
    if (dest) {
      window.dispatchEvent(new CustomEvent("fp:quickadd", { detail: { tab: dest } }));
    }
  }
  const [focusMode, setFocusMode]     = useState(false);
  const [globalAddTrigger, setGlobalAddTrigger] = useState(0);

  // ── Global hotkeys ──────────────────────────────────────────────────────────
  const cmdActions: CommandAction[] = [
    // Navigation
    { id: "nav-overview",   label: "Go to Overview",      group: "Navigate", icon: LayoutDashboard, shortcut: "G O",   run: () => client && setTab("overview" as Tab) },
    { id: "nav-dashboard",  label: "Go to Dashboard",     group: "Navigate", icon: LayoutDashboard, shortcut: "G D",   run: () => client && setTab("dashboard") },
    { id: "nav-retirement", label: "Go to Retirement",    group: "Navigate", icon: PiggyBank,       shortcut: "G R",   run: () => client && setTab("retirementhub") },
    { id: "nav-protection", label: "Go to Protection",    group: "Navigate", icon: Shield,          shortcut: "G P",   run: () => client && setTab("protection") },
    { id: "nav-cashflow",   label: "Go to Cash Flow",     group: "Navigate", icon: Receipt,         shortcut: "G F",   run: () => client && setTab("expenses") },
    { id: "nav-goals",      label: "Go to Goals",         group: "Navigate", icon: Target,          shortcut: "G G",   run: () => client && setTab("goals") },
    { id: "nav-networth",   label: "Go to Net Worth",     group: "Navigate", icon: Scale,           shortcut: "G N",   run: () => client && setTab("networth") },
    { id: "nav-tax",        label: "Go to Tax & Estate",  group: "Navigate", icon: FileText,        shortcut: "G T",   run: () => client && setTab("taxestate") },
    { id: "nav-ai",         label: "Go to AI Insights",   group: "Navigate", icon: Brain,           shortcut: "G A",   run: () => client && setTab("ai") },
    { id: "nav-documents",  label: "Go to Documents",     group: "Navigate", icon: FileText,        shortcut: "G Doc", run: () => client && setTab("documents") },
    // Actions
    { id: "add-client",     label: "Add Client",          group: "Actions",  icon: Plus,            shortcut: "N",     run: () => { setShowClientDetail(false); setTab("clients"); } },
  ].filter(a => !["nav-overview","nav-dashboard","nav-retirement","nav-protection","nav-cashflow","nav-goals","nav-networth","nav-tax","nav-ai","nav-documents"].includes(a.id) || !!client);

  useHotkeys({
    "mod+k": () => setCommandOpen(true),
    "g": () => {}, // handled by sequential keys below
    "a": () => { if (!commandOpen) contextAdd(); },
    "f": () => setFocusMode((f: boolean) => !f),
  });

  // Sequential G+key navigation
  useEffect(() => {
    let gPressed = false;
    let gTimer: ReturnType<typeof setTimeout>;
    function handler(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable) return;
      if (commandOpen) return;
      if (e.key.toLowerCase() === "g" && !e.metaKey && !e.ctrlKey) {
        gPressed = true;
        clearTimeout(gTimer);
        gTimer = setTimeout(() => { gPressed = false; }, 1000);
        return;
      }
      if (gPressed) {
        gPressed = false;
        clearTimeout(gTimer);
        const map: Record<string, Tab> = { c: "clients", o: "overview" as Tab, d: "dashboard", r: "retirementhub", p: "protection", f: "expenses", g: "goals", n: "networth", t: "taxestate", a: "ai" };
        const dest = map[e.key.toLowerCase()];
        if (dest) {
          e.preventDefault();
          if (dest === "clients") { setShowClientDetail(false); }
          setTab(dest);
        }
      }
    }
    window.addEventListener("keydown", handler);
    return () => { window.removeEventListener("keydown", handler); clearTimeout(gTimer); };
  }, [client, commandOpen]);

  // Refresh overview when client changes
  useEffect(() => {
    if (client) {
      api.get<Overview>(`/api/clients/${client.id}/overview`).then(setClientOv).catch(() => {});
    } else {
      setClientOv(null);
    }
  }, [client?.id]);

  // Single-user: selectClient auto-navigates to overview
  function selectClient(c: Client) { setClient(c); setTab("overview" as Tab); }

  function selectPlan(p: Plan) {
    setPlan(p);
    setShowClientDetail(false);
    setTab("fp");
  }

  function backToClients() { setTab("overview"); }

  const t: T = translations[clientLocale];
  const userName = client ? `${client.firstName} ${client.lastName}` : (user ? `${user.firstName} ${user.lastName}` : undefined);
  const hasSpouse = !!client?.spouseFirstName;
  // Person toggle is rendered by HubShell inside each hub / PlanningDocFlow.
  return (
    <VoiceProvider>
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} actions={cmdActions} />
      {focusMode && (
        <div
          className="fixed inset-0 z-[150] bg-black/20 backdrop-blur-[1px]"
          onClick={() => setFocusMode(false)}
          title="Click to exit focus mode"
        >
          <div className="absolute top-4 right-4 text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
            Focus mode — press <kbd className="font-mono">F</kbd> or click to exit
          </div>
        </div>
      )}
      <Sidebar activeTab={tab} onTab={t => { setTab(t as any); setPerson("primary"); setNwSubtabHint(undefined); }} userName={userName} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <SubscriptionBanner onUpgrade={() => setShowSubscriptionModal(true)} />
        {showSubscriptionModal && (
          <SubscriptionModal
            onClose={() => setShowSubscriptionModal(false)}
            currentStatus={user?.subscriptionStatus}
          />
        )}
        {/* Top bar */}
        <header className="flex-shrink-0 h-12 bg-white/60 backdrop-blur-md border-b border-slate-200/80 flex items-center px-5 justify-between relative z-10">
          <div className="flex items-center gap-3">
           <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-brand-gradient border-r border-slate-200 pr-3 mr-1">
             Compass
          </span>
            {client && (
              <>
                <div className={`w-6 h-6 rounded-full ${avatarBg(client.firstName+client.lastName)} flex items-center justify-center text-white text-[10px] font-bold`}>
                  {initials(client.firstName, client.lastName)}
                </div>
                <button
                  onClick={() => { setTab("clients"); setShowClientDetail(true); }}
                  className="text-sm font-semibold text-slate-800 hover:text-cyan-600 hover:underline transition-colors"
                  title="Edit client">
                  {client.spouseFirstName ? `${client.lastName} Family` : `${client.firstName} ${client.lastName}`}
                </button>
                {plan && <><span className="text-slate-300">·</span><span className="text-sm text-slate-500">{plan.name}</span></>}
              </>
            )}
            {!client && <span className="text-sm font-semibold text-slate-500">My Financial Plan</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCommandOpen(true)}
              className="hidden md:flex items-center gap-2 text-xs text-slate-400 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-2.5 py-1 rounded-lg transition"
              title="Command palette (⌘K)"
            >
              <Search className="w-3 h-3" />
              <kbd className="font-mono text-[10px]">⌘K</kbd>
            </button>
            {client && (
              <MeetingRecorderTrigger
                clientId={client.id}
                clientName={client.spouseFirstName ? `${client.lastName} Family` : `${client.firstName} ${client.lastName}`}
              />
            )}
            <span className="text-xs text-slate-500 font-medium">{user?.firmName ?? `${user?.firstName} ${user?.lastName}`}</span>
            <button onClick={() => setShowChangePw(true)} title="Change password" className="text-slate-400 hover:text-cyan-600 transition-colors">
              <KeyRound className="w-4 h-4" />
            </button>
            <button onClick={() => { logout(); }} title="Sign out" className="text-slate-400 hover:text-rose-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
         </header>
         {showForceReset && <ChangePasswordModal forceReset onClose={() => setShowForceReset(false)} />}
         {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        

        {/* Content — wrap in fp-insightled so EVERY tab gets the
            light-grey page + dark-card treatment (sidebar/header are outside) */}
        <div key={tab} className={`flex-1 fp-insightled animate-in fade-in duration-300 ${
            tab === "networth" ? "overflow-hidden" : "overflow-y-auto"
        }`}>
          <Suspense fallback={<TabLoader />}>
          {/* Global context bar — shown when a client is selected and not on overview/clients */}
          {client && !["overview", "dashboard", "profile"].includes(tab) && (
            <div className="flex justify-between items-center bg-white border-b border-slate-200 px-6 py-2">
              <button onClick={() => setTab("overview" as Tab)} className="text-sm font-medium text-slate-700 hover:text-blue-600 transition flex items-center gap-1.5">
                <span>My Financial Plan</span>
              </button>
              {clientOv && (
                <div className="flex gap-4 text-xs text-slate-500">
                  <span>Net Worth: <span className={`font-medium ${clientOv.netWorth >= 0 ? "text-emerald-600" : "text-red-500"}`}>{Math.abs(clientOv.netWorth) >= 1_000_000 ? `$${(clientOv.netWorth/1_000_000).toFixed(2)}M` : `$${Math.round(clientOv.netWorth/1000)}K`}</span></span>
                  {clientOv.retirementProjections > 0 && <span className="text-blue-600">{clientOv.retirementProjections} retirement plan{clientOv.retirementProjections > 1 ? "s" : ""}</span>}
                  {clientOv.pendingAi > 0 && <span className="text-amber-600">⚠ {clientOv.pendingAi} AI pending</span>}
                </div>
              )}
            </div>
          )}
          {/* Profile loading spinner */}
          {profileLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
            </div>
          )}
          {/* All tabs render once the profile is loaded */}
          {!profileLoading && tab === "overview" && client && <ClientOverview client={client} onNavigate={(t) => setTab(t as Tab)} />}
          {!profileLoading && tab === "profile"  && client && <ClientDetail client={client} onBack={() => setTab("overview" as Tab)} onPlanSelect={selectPlan} onUpdate={setClient} onLocaleChange={setClientLocale} t={t} />}
          {!profileLoading && tab === "dashboard" && client && <InsightLedDashboard clientId={client.id} client={client} onNavigate={(t) => { const [tabKey, subtab] = t.split(":"); setTab(tabKey as Tab); setNwSubtabHint(subtab); }} />}

          {/* ── Merged Insight-Led hubs ─────────────────────────────────────────
              Each hub provides its own dark Insight-Led shell with sub-tabs.
              They render outside PlanningDocFlow because the hub is the shell. */}
          {!profileLoading && tab === "protection" && client && (
            <ProtectionHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={t} />
          )}
          {!profileLoading && tab === "retirementhub" && client && (
            <RetirementHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={t} />
          )}
          {!profileLoading && tab === "taxestate" && client && (
            <TaxEstateHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={t} />
          )}
          {!profileLoading && tab === "documents" && client && (
            <DocumentsHub clientId={client.id} client={client} />
          )}
          {!profileLoading && tab === "fp" && client && (
            <FinancialPlanHub clientId={client.id} client={client} t={t} />
          )}

          {/* ── Simple themed tabs — kept in PlanningDocFlow for voice/recording ── */}
          {!profileLoading && PLANNING_TABS.includes(tab as PlanningTab) && client && (
            <div className="fp-insightled h-full">
              <PlanningDocFlow
                tab={tab as PlanningTab}
                clientId={client.id}
                clientName={client.spouseFirstName
                  ? `${client.firstName} & ${client.spouseFirstName}`
                  : `${client.firstName} ${client.lastName}`}
                client={client}
                initialNwSubtab={tab === "networth" ? nwSubtabHint : undefined}
                personToggle={tab === "goals" && hasSpouse ? {
                  person,
                  onPersonChange: setPerson,
                  primaryLabel: client.firstName,
                  spouseLabel: client.spouseFirstName!,
                  showCombined: true,
                } : undefined}
              >
                {!profileLoading && tab === "networth" && (
                  <QueryClientProvider client={queryClient}>
                      <NetWorthTabNew clientId={client.id} client={client} t={t} />
                   </QueryClientProvider>
                )}
                {!profileLoading && tab === "goals"    && (
                  <QueryClientProvider client={queryClient}>
                    <GoalsTab clientId={client.id} client={client} t={t} />
                 </QueryClientProvider>
                )}
                {!profileLoading && tab === "debt"     && (
                  <QueryClientProvider client={queryClient}>
                    <DebtTab clientId={client.id} t={t} />
                  </QueryClientProvider>
                )}
                {!profileLoading && tab === "expenses" && (
                  <QueryClientProvider client={queryClient}>
                    <ExpensesTab clientId={client.id} addTrigger={tab === "expenses" ? globalAddTrigger : 0} t={t} />
                  </QueryClientProvider>
                )}
                {!profileLoading && tab === "ai" && (
                  <QueryClientProvider client={queryClient}>
                    <AITab clientId={client.id} />
                  </QueryClientProvider>
                )}
              </PlanningDocFlow>
            </div>
          )}
          </Suspense>
        </div>
      </div>
     </div>
    </VoiceProvider>
  );
}

