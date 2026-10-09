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
const AgentsTab          = lazy(() => import("./AgentsTab").then(m => ({ default: m.AgentsTab })));
const InsightLedDashboard = lazy(() => import("../components/InsightLedDashboard").then(m => ({ default: m.InsightLedDashboard })));

import { fmt$, fmtPct, initials, avatarBg, cn } from "../lib/utils";
import { VoiceProvider, useVoice, labelToKey } from "../contexts/VoiceContext";
import { ClientOverview } from "./ClientOverview";
import { MeetingRecorderTrigger, IntakeRecorderTrigger, type IntakeProfile } from "../components/MeetingRecorder";
import { useHotkeys } from "../hooks/useHotkeys";
import { useLocale } from "../hooks/useLocale";
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

function scoreLabel(s: number, t: T = translations.en): { label: string; cls: string; dot: string } {
  if (s >= 85) return { label: t.dashboard.statusOptimized,  cls: "text-emerald-600 bg-emerald-50 border-emerald-100", dot: "bg-emerald-400" };
  if (s >= 70) return { label: t.dashboard.statusReview,     cls: "text-blue-600    bg-blue-50    border-blue-100",    dot: "bg-blue-400" };
  if (s >= 50) return { label: t.dashboard.statusGaps,       cls: "text-amber-600   bg-amber-50   border-amber-100",   dot: "bg-amber-400" };
  return               { label: t.dashboard.statusCritical,  cls: "text-red-600    bg-red-50     border-red-100",      dot: "bg-red-400" };
}

function fmtNw(nw: number | null): string {
  if (nw === null) return "—";
  if (Math.abs(nw) >= 1_000_000) return `$${(nw / 1_000_000).toFixed(1)}M`;
  if (Math.abs(nw) >= 1_000)    return `$${Math.round(nw / 1000)}K`;
  return `$${Math.round(nw)}`;
}

// ── Household Row ─────────────────────────────────────────────────────────────

function HouseholdRow({
  c, onSelect, onDelete, onOvReady, keyboardActive, tAdv = translations.en,
}: {
  c: Client;
  onSelect: (c: Client) => void;
  onDelete: (id: number) => void;
  onOvReady?: (id: number, ov: Overview) => void;
  keyboardActive?: boolean;
  tAdv?: T;
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
  const { label: statusLabel, cls: statusCls, dot: dotCls } = scoreLabel(score, tAdv);
  const nw         = ov?.netWorth ?? null;
  const actionCount = ov
    ? ov.pendingAi + (ov.retirementProjections === 0 ? 1 : 0) + (ov.insuranceAnalyses === 0 ? 1 : 0)
    : 0;

  const gaps: string[] = [];
  if (ov?.retirementProjections === 0) gaps.push(tAdv.dashboard.noRetirementPlan);
  if (ov?.insuranceAnalyses     === 0) gaps.push(tAdv.dashboard.noInsuranceAnalysis);
  if ((ov?.pendingAi ?? 0) > 0)        gaps.push(`${ov!.pendingAi} AI action${ov!.pendingAi > 1 ? "s" : ""} pending`);

  const nextAction = gaps[0] ?? tAdv.dashboard.reviewComplete;

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
                  { label: tAdv.client.retirementPlan, ok: (ov?.retirementProjections ?? 0) > 0, value: `${ov?.retirementProjections ?? 0} plan${(ov?.retirementProjections ?? 0) !== 1 ? "s" : ""}` },
                  { label: tAdv.client.insuranceAnalysis, ok: (ov?.insuranceAnalyses ?? 0) > 0, value: `${ov?.insuranceAnalyses ?? 0} analysis` },
                  { label: tAdv.client.aiInsights, ok: (ov?.pendingAi ?? 0) === 0, value: (ov?.pendingAi ?? 0) > 0 ? `${ov!.pendingAi} pending` : "Clear" },
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
                  { label: tAdv.client.netWorthLabel,    value: fmtNw(nw) },
                  { label: tAdv.client.regionLabel,       value: c.province ?? "—" },
                  { label: tAdv.client.plans2, value: `${ov?.retirementProjections ?? 0} ${tAdv.client.plansOnFile}` },
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

function ClientsTab({ onSelect, tAdv = translations.en }: { onSelect: (c: Client) => void; tAdv?: T }) {
  const { user } = useAuth();
  const jurisdiction  = (user as any)?.jurisdiction ?? "CA";
  const regions       = jurisdiction === "US"
    ? ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
    : PROVINCES;
  const regionLabel   = jurisdiction === "US" ? tAdv.client.stateLabel : tAdv.client.provinceLabel;
  const defaultRegion = jurisdiction === "US" ? "CA" : "ON";

  const [clients,  setClients]  = useState<Client[]>([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [form,     setForm]     = useState({ firstName: "", lastName: "", email: "", phone: "", province: defaultRegion });
  const [busy,     setBusy]     = useState(false);
  const [ovData,   setOvData]   = useState<Record<number, Overview>>({});
  const [navIdx,   setNavIdx]   = useState(-1);
  const [sortBy,   setSortBy]   = useState<"name" | "score" | "nw">("score");

  // Keyboard navigation
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      if (e.key === "ArrowDown") { e.preventDefault(); setNavIdx(i => Math.min(i + 1, clients.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setNavIdx(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && navIdx >= 0 && clients[navIdx]) onSelect(clients[navIdx]);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [clients, navIdx, onSelect]);

  const load = useCallback(() => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    api.get<Client[]>(`/api/clients${qs}`).then(setClients).finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function create() {
    setBusy(true);
    try {
      const c = await api.post<Client>("/api/clients", { ...form, jurisdiction });
      setClients(p => [c, ...p]);
      setShowNew(false);
      setForm({ firstName: "", lastName: "", email: "", phone: "", province: defaultRegion });
      toast({ title: tAdv.client.clientAdded, description: `${form.firstName} ${form.lastName} added successfully` });
    } catch (e: any) {
      toast({ title: tAdv.common.error, description: e.message, variant: "destructive" });
    } finally { setBusy(false); }
  }

  function handleIntakeComplete(profile: IntakeProfile) {
    setForm(f => ({
      ...f,
      firstName: profile.firstName || f.firstName,
      lastName:  profile.lastName  || f.lastName,
      email:     profile.email     || f.email,
      phone:     profile.phone     || f.phone,
      province:  profile.province  || f.province,
    }));
    setShowNew(true);  // ensure form is open
  }

  function deleteClient(id: number) {
    api.delete(`/api/clients/${id}`).then(() => setClients(p => p.filter(c => c.id !== id)));
  }

  // Aggregated intelligence
  const allOv        = Object.values(ovData);
  const totalAum     = allOv.reduce((s, o) => s + Math.max(0, o.netWorth), 0);
  const totalPending = allOv.reduce((s, o) => s + o.pendingAi, 0);
  const noRetirement = allOv.filter(o => o.retirementProjections === 0).length;
  const noInsurance  = allOv.filter(o => o.insuranceAnalyses === 0).length;
  const avgScore     = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + householdScore(ovData[c.id] ?? null), 0) / clients.length)
    : 0;

  const fmtAum = (n: number) => n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(1)}M`
    : `$${Math.round(n / 1000)}K`;

  // Sort clients
  const sorted = [...clients].sort((a, b) => {
    if (sortBy === "score") return householdScore(ovData[b.id] ?? null) - householdScore(ovData[a.id] ?? null);
    if (sortBy === "nw")    return (ovData[b.id]?.netWorth ?? 0) - (ovData[a.id]?.netWorth ?? 0);
    return `${a.lastName}${a.firstName}`.localeCompare(`${b.lastName}${b.firstName}`);
  });

  return (
    <div className="flex h-full min-h-0 overflow-hidden">

      {/* ══ LEFT — Operations Queue (75%) ══════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-sm font-bold text-slate-900 leading-none">{tAdv.common.householdQueue}</h1>
              <p className="text-[10px] text-slate-400 mt-0.5">{clients.length} {tAdv.common.householdsCount} · {tAdv.common.avgScore} {avgScore}</p>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tAdv.common.searchHouseholds}
                className="w-full pl-8 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition"
              />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400">
              <span>{tAdv.common.sortLabel}</span>
              {([["score",tAdv.common.colScoreStatus],["name",tAdv.common.colHousehold],["nw",tAdv.common.colNetWorth]] as [string,string][]).map(([k, l]) => (
                <button key={k} onClick={() => setSortBy(k as any)}
                  className={`px-2 py-1 rounded transition-colors font-medium ${sortBy === k ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-500"}`}>
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => setShowNew(s => !s)}
              className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
              {showNew ? tAdv.common.cancel : tAdv.common.newHousehold}
            </button>
          </div>
        </div>

        {/* New client form */}
        {showNew && (
          <div className="flex-shrink-0 border-b border-blue-100 bg-blue-50/40 px-5 py-3">
            <div className="text-[10px] font-semibold text-blue-700 uppercase tracking-widest mb-2">New Household</div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-2">
              <input placeholder={tAdv.client.firstNamePlaceholder} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
              <input placeholder={tAdv.client.lastNamePlaceholder} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
              <input placeholder={tAdv.client.emailPlaceholder} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
              <input placeholder={tAdv.client.phonePlaceholder} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
              <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400">
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={create} disabled={busy || !form.firstName || !form.lastName}
                className="flex items-center gap-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {busy ? <span className="w-3 h-3 border border-white/40 border-t-white rounded-full animate-spin" /> : <Plus className="w-3 h-3" />}
                {tAdv.common.addHousehold}
              </button>
              <button onClick={() => setShowNew(false)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">{tAdv.common.cancel}</button>
              <div className="ml-auto">
                <IntakeRecorderTrigger onComplete={handleIntakeComplete} />
              </div>
            </div>
          </div>
        )}

        {/* Table header */}
        <div className="flex-shrink-0 bg-slate-50 border-b border-slate-200">
          <div
            className="grid items-center px-4 py-2 text-[9px] font-semibold uppercase tracking-widest text-slate-400"
            style={{ gridTemplateColumns: "2fr 110px 100px 120px 1fr 90px" }}
          >
            <span>{tAdv.common.colHousehold}</span>
            <span>{tAdv.common.colScoreStatus}</span>
            <span className="text-right">{tAdv.common.colNetWorth}</span>
            <span>{tAdv.common.colAlerts}</span>
            <span>{tAdv.common.colNextAction}</span>
            <span className="text-right">{tAdv.common.colActions}</span>
          </div>
        </div>

        {/* Queue */}
        <div className="flex-1 overflow-y-auto bg-white pb-20">
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700 mb-1">
                {search ? tAdv.dashboard.noHouseholdsMatch + "" : tAdv.dashboard.noHouseholdsYet}
              </p>
              {!search && (
                <button onClick={() => setShowNew(true)}
                  className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-800">
                  Add your first household →
                </button>
              )}
            </div>
          ) : (
            sorted.map((c, idx) => (
              <HouseholdRow
                key={c.id} c={c} tAdv={tAdv}
                onSelect={onSelect}
                onDelete={deleteClient}
                onOvReady={(id, ov) => setOvData(prev => ({ ...prev, [id]: ov }))}
                keyboardActive={idx === navIdx}
              />
            ))
          )}
        </div>
      </div>

      {/* ══ RIGHT — Intelligence Rail (25%) ════════════════════════════════════ */}
      <div className="w-64 flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-y-auto pb-20">

        {/* AUM Summary */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{tAdv.dashboard.bookSummary}</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: tAdv.dashboard.totalAum,      value: fmtAum(totalAum),        hi: true },
              { label: tAdv.dashboard.avgScore,      value: `${avgScore}/100`,        hi: avgScore >= 70 },
              { label: tAdv.dashboard.households,     value: String(clients.length),   hi: true },
              { label: tAdv.dashboard.pendingActions,value: String(totalPending),     hi: totalPending === 0 },
            ].map(s => (
              <div key={s.label} className="bg-slate-50 rounded-lg p-2.5">
                <div className="text-[9px] text-slate-400 mb-0.5">{s.label}</div>
                <div className={`text-sm font-bold ${s.hi ? "text-slate-900" : "text-amber-600"}`}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Priorities */}
        <div className="px-4 py-3 border-b border-slate-100 flex-1">
          <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{tAdv.dashboard.todaysPriorities}</div>
          <div className="space-y-2">
            {noRetirement > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                <span className="text-amber-500 text-xs mt-0.5">⚠</span>
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  {noRetirement} household{noRetirement > 1 ? "s" : ""} {noRetirement > 1 ? tAdv.dashboard.householdsMissingRetPlural : tAdv.dashboard.householdsMissingRet}
                </p>
              </div>
            )}
            {noInsurance > 0 && (
              <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                <span className="text-amber-500 text-xs mt-0.5">⚠</span>
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                  {noInsurance} {noInsurance > 1 ? tAdv.dashboard.insuranceGaps : tAdv.dashboard.insuranceGap}
                </p>
              </div>
            )}
            {totalPending > 0 && (
              <div className="flex items-start gap-2 p-2 bg-blue-50 border border-blue-100 rounded-lg">
                <span className="text-blue-500 text-xs mt-0.5">↻</span>
                <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                  {totalPending} {totalPending > 1 ? tAdv.dashboard.aiRecs : tAdv.dashboard.aiRec}
                </p>
              </div>
            )}
            {noRetirement === 0 && noInsurance === 0 && totalPending === 0 && clients.length > 0 && (
              <div className="flex items-start gap-2 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">
                <span className="text-emerald-500 text-xs mt-0.5">✓</span>
                <p className="text-[10px] text-emerald-700 font-medium">{tAdv.dashboard.allUpToDate}</p>
              </div>
            )}
          </div>
        </div>

        {/* Opportunities */}
        {clients.length > 0 && (
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{tAdv.dashboard.opportunities}</div>
            <div className="space-y-1.5">
              {noRetirement > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-[10px] text-slate-600">{tAdv.dashboard.retirementProjections}</span>
                  <span className="text-[10px] font-semibold text-blue-600">{noRetirement} {tAdv.dashboard.openCount}</span>
                </div>
              )}
              {noInsurance > 0 && (
                <div className="flex items-center justify-between py-1 border-b border-slate-50">
                  <span className="text-[10px] text-slate-600">{tAdv.dashboard.insuranceAnalysis2}</span>
                  <span className="text-[10px] font-semibold text-amber-600">{noInsurance} {tAdv.dashboard.gapsCount}{noInsurance > 1 ? "s" : ""}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-1">
                <span className="text-[10px] text-slate-600">{tAdv.dashboard.householdsNeedReview}</span>
                <span className="text-[10px] font-semibold text-slate-700">
                  {clients.filter(c => householdScore(ovData[c.id] ?? null) < 70).length}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Score distribution */}
        {clients.length > 0 && (
          <div className="px-4 py-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-2">{tAdv.dashboard.scoreDistribution}</div>
            {[
              { label: tAdv.dashboard.optimizedLabel,   count: clients.filter(c => householdScore(ovData[c.id] ?? null) >= 85).length, color: "bg-emerald-400" },
              { label: tAdv.dashboard.reviewLabel,    count: clients.filter(c => { const s = householdScore(ovData[c.id] ?? null); return s >= 70 && s < 85; }).length, color: "bg-blue-400" },
              { label: tAdv.dashboard.gapsLabel,      count: clients.filter(c => { const s = householdScore(ovData[c.id] ?? null); return s >= 50 && s < 70; }).length, color: "bg-amber-400" },
              { label: tAdv.dashboard.criticalLabel,    count: clients.filter(c => householdScore(ovData[c.id] ?? null) < 50).length, color: "bg-red-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.color}`} />
                <span className="text-[10px] text-slate-500 flex-1">{s.label}</span>
                <span className="text-[10px] font-bold text-slate-700">{s.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// Client Detail — shown when a client is selected (name, family, plans)
// ─────────────────────────────────────────────────────────────────────────────
function ClientDetail({ client, onBack, onPlanSelect, onUpdate, onLocaleChange, t = translations.en, advisorLocale = "en", level }: { client: Client; onBack: () => void; onPlanSelect: (p: Plan) => void; onUpdate: (c: Client) => void; onLocaleChange: (l: ClientLocale) => void; t?: T; advisorLocale?: ClientLocale; level?: string }) {
  const [plans, setPlans]       = useState<Plan[]>([]);
  const [editing, setEditing]   = useState(false);
  const [form, setForm]         = useState<Partial<Client>>({ ...client });
  const [busy, setBusy]         = useState(false);
  const [newPlanName, setNewPlanName] = useState(t.client.financialPlanName);
  const u = (k: keyof Client, v: any) => setForm(f => ({ ...f, [k]: v }));

  // Jurisdiction-aware region list
  const { user } = useAuth();
  const jurisdiction = (client as any).jurisdiction ?? (user as any)?.jurisdiction ?? "CA";
  const regions = jurisdiction === "US"
    ? ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"]
    : PROVINCES;
  const regionLabel = jurisdiction === "US" ? t.client.stateLabel : t.client.provinceLabel;
  const defaultRegion = jurisdiction === "US" ? "CA" : "ON";

  useEffect(() => {
    api.get<Plan[]>(`/api/clients/${client.id}/plans`).then(setPlans);
  }, [client.id]);

  async function save() {
    setBusy(true);
    try { const updated = await api.patch<Client>(`/api/clients/${client.id}`, form); setEditing(false); onUpdate(updated); }
    catch (e: any) {toast({ title: t.common.error, description: e.message, variant: "destructive" }) }
    finally { setBusy(false); }
  }

  async function inlinePatch(data: Partial<Client>) {
    try {
      const updated = await api.patch<Client>(`/api/clients/${client.id}`, data);
      onUpdate(updated);
    } catch (e: any) { toast({ title: t.common.error, description: e.message, variant: "destructive" }); }
  }

  async function deletePlan(planId: number) {
    if (!confirm("Delete this plan? This cannot be undone.")) return;
    await api.delete(`/api/plans/${planId}`);
    setPlans(prev => prev.filter(p => p.id !== planId));
  }
   async function createPlan() {
     const p = await api.post<Plan>(`/api/clients/${client.id}/plans`, { name: level === "standard" ? "FNA" : newPlanName });
     setPlans(prev => [p, ...prev]);
     if (level === "standard") {
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
    if (ov.retirementProjections === 0) insights.push({ msg: t.client.overview.noRetirementProjection, color: "blue" });
    if (ov.insuranceAnalyses === 0) insights.push({ msg: t.client.overview.noInsuranceAnalysis, color: "red" });
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
            { label: t.client.overview.netWorth,         value: nwFmt(ov.netWorth),            color: ov.netWorth >= 0 ? "text-emerald-600" : "text-red-500" },
            { label: t.client.overview.retirementPlans,  value: String(ov.retirementProjections), color: ov.retirementProjections > 0 ? "text-blue-600" : "text-slate-400" },
            { label: t.client.overview.insuranceAnalyses, value: String(ov.insuranceAnalyses),   color: ov.insuranceAnalyses > 0 ? "text-blue-600" : "text-red-500" },
            { label: t.client.overview.pendingAiActions,  value: String(ov.pendingAi),           color: ov.pendingAi > 0 ? "text-amber-600" : "text-slate-400" },
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
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">{t.client.householdProfile}</h2>
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            {hasSpouse ? t.client.jointFile : t.client.singleFile}
          </span>
        </div>

        {/* Adults — primary + spouse side by side */}
        <div className={cn(
          "grid",
          (hasSpouse || editing) ? "grid-cols-1 lg:grid-cols-2 lg:divide-x divide-gray-100" : "grid-cols-1",
        )}>
          {/* ── Primary ── */}
          <PersonPanel
            roleLabel={t.client.primaryClient}
            avatarBg={avatarBg(client.firstName + client.lastName)}
            avatarInitials={initials(client.firstName, client.lastName)}
            displayName={`${client.firstName} ${client.lastName}`}
            displaySubtitle={[client.occupation, ageFromDob(client.dateOfBirth) ? `${t.client.ageLabel} ${ageFromDob(client.dateOfBirth)}` : null].filter(Boolean).join(" · ") || t.client.occupationNotSet}
            editing={editing}
            edit={
              <div className="grid grid-cols-2 gap-3">
                <Input label={t.client.firstName}  value={form.firstName ?? ""} onChange={v => u("firstName", v)} />
                <Input label={t.client.lastName}   value={form.lastName ?? ""}  onChange={v => u("lastName", v)} />
                <Input label={t.client.email} type="email" value={form.email ?? ""} onChange={v => u("email", v)} />
                <Input label={t.client.phone}       value={form.phone ?? ""}     onChange={v => u("phone", v)} />
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
                <ExecField label={t.client.email}          value={client.email}                     onSave={v => inlinePatch({ email: v })} />
                <ExecField label={t.client.phone}          value={client.phone}                     onSave={v => inlinePatch({ phone: v })} />
                <ExecField label={t.client.dateOfBirth}  value={client.dateOfBirth}               onSave={v => inlinePatch({ dateOfBirth: v })} />
                <ExecField label={t.client.province}       value={client.province}                  onSave={v => inlinePatch({ province: v })} />
                <ExecField label={t.client.occupation}     value={client.occupation}                onSave={v => inlinePatch({ occupation: v })} />
                <ExecField label={t.client.annualIncome}  value={fmt$(client.annualIncome)} mono   onSave={v => inlinePatch({ annualIncome: v })} type="number" />
                <ExecField label={t.client.pension}        value={(client as any).pensionType}      onSave={v => inlinePatch({ pensionType: v } as any)} />
                <ExecField label={t.client.retirementAge} value={client.retirementAge} mono        onSave={v => inlinePatch({ retirementAge: +v })} type="number" />
                <ExecField label={t.client.desiredIncome} value={fmt$(client.desiredRetirementIncome)} mono onSave={v => inlinePatch({ desiredRetirementIncome: v })} type="number" />
              </dl>
            }
          />

          {/* ── Spouse ── */}
          {(hasSpouse || editing) ? (
            <PersonPanel
              roleLabel={t.client.spousePartner}
              avatarBg={avatarBg((client.spouseFirstName ?? "") + (client.spouseLastName ?? ""))}
              avatarInitials={initials(client.spouseFirstName ?? "", client.spouseLastName ?? "")}
              displayName={`${client.spouseFirstName ?? ""} ${client.spouseLastName ?? ""}`.trim()}
              displaySubtitle={[client.spouseOccupation, ageFromDob(client.spouseDateOfBirth) ? `${t.client.ageLabel} ${ageFromDob(client.spouseDateOfBirth)}` : null].filter(Boolean).join(" · ") || t.client.occupationNotSet}
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
                  <ExecField label={t.client.pension}        value={(client as any).spousePensionType}      onSave={v => inlinePatch({ spousePensionType: v } as any)} />
                  <ExecField label={t.client.retirementAge} value={client.spouseRetirementAge} mono        onSave={v => inlinePatch({ spouseRetirementAge: +v })} type="number" />
                  <ExecField label={t.client.desiredIncome} value={fmt$(client.spouseDesiredRetirementIncome)} mono />
                </dl>
              }
            />
          ) : (
            !editing && (
              <div className="px-6 py-8 flex flex-col items-center justify-center text-center border-t lg:border-t-0 border-gray-100">
                <div className="w-10 h-10 rounded-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 mb-2">
                  <UserPlus className="w-4 h-4" />
                </div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-0.5">{t.client.noSpouseOnFile}</p>
                <button onClick={() => setEditing(true)} className="text-xs text-[#0c1e3a] font-semibold hover:underline">{t.client.addSpouseDetails}</button>
              </div>
            )
          )}
        </div>

        {/* ── Dependants strip ─────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Baby className="w-3.5 h-3.5 text-gray-400" />
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{t.client.childrenDependants}</h3>
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
                <p className="text-xs text-gray-400 italic">{t.client.noDependantsHint}</p>
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
            <p className="text-xs text-gray-400 italic">{t.client.noDependants}</p>
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
  const { locale: advisorLocaleStr } = useLocale();
  const role = user?.role ?? "fa";
  const level = user?.level ?? "standard";
  const [showForceReset, setShowForceReset] = useState(!!user?.mustResetPassword);
  const [showChangePw, setShowChangePw]     = useState(false);
  const [tab, setTab] = useState<Tab>(user?.role === "ga" ? "agents" : "clients");
  const [nwSubtabHint, setNwSubtabHint] = useState<string | undefined>(undefined);
  const [person, setPerson] = useState<"primary"|"spouse"|"combined">("primary");
  const [client, setClient]       = useState<Client | null>(null);
  const [clientLocale, setClientLocale] = useState<ClientLocale>("en");

  // Auto-sync client locale when active client changes
  useEffect(() => {
    if (!client) { setClientLocale("en"); return; }
    const lang = (client.preferredLanguage ?? (client.province === "QC" ? "fr" : "en")) as ClientLocale;
    setClientLocale(lang);
  }, [client?.id, client?.preferredLanguage]);
  const [plan, setPlan]           = useState<Plan | null>(null);
  const [showClientDetail, setShowClientDetail] = useState(false);
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
    { id: "nav-clients",    label: "Go to Clients",       group: "Navigate", icon: Users,          shortcut: "G C",   run: () => { setShowClientDetail(false); setTab("clients"); } },
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

  function selectClient(c: Client) {
    setClient(c);
    setPlan(null);
    setShowClientDetail(true);
    setTab("profile" as Tab);
  }

  function selectPlan(p: Plan) {
    setPlan(p);
    setShowClientDetail(false);
    setTab(level === "standard" ? "protection" : "fp");
  }

  function backToClients() {
    setShowClientDetail(false);
    setTab("clients");
  }

  // Two locales, not one:
  //   tAdvisor — drives advisor-facing UI (form labels, profile fields).
  //              Follows the i18next locale which already hard-forces QC advisors to FR.
  //   tAdvisor — drives the advisor UI (all forms, menus, planning screens)
  //   tClient  — drives client-facing content; follows client preferredLanguage
  //              UNLESS the advisor has manually toggled the sidebar to FR/EN,
  //              in which case the sidebar locale overrides (so QC advisors
  //              serving EN residents can flip the whole UI to EN).
  const advisorLocale: ClientLocale = advisorLocaleStr === "fr" ? "fr" : "en";
  const tAdvisor = (translations[advisorLocale as keyof typeof translations] ?? translations.en) as T;
  // tClient rule:
  //  - If advisor sidebar is FR (QC default OR manual toggle): show FR everywhere
  //  - Otherwise: follow the client's own preferredLanguage setting
  //    (so an EN advisor serving a QC client gets FR client-facing content)
  const tClient = (advisorLocale === "fr" ? translations["fr"] : (translations[clientLocale as keyof typeof translations] ?? translations.en)) as T;
  const clientName = client ? `${client.firstName} ${client.lastName}` : undefined;
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
      <Sidebar activeTab={tab} onTab={t => { if (t === "clients") { setShowClientDetail(false); } setTab(t as any); setPerson("primary"); setNwSubtabHint(undefined); }} clientName={clientName} role={role} level={level} />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-12 bg-white/60 backdrop-blur-md border-b border-slate-200/80 flex items-center px-5 justify-between relative z-10">
          <div className="flex items-center gap-3">
           <span className="text-[11px] font-bold tracking-[0.14em] uppercase text-brand-gradient border-r border-slate-200 pr-3 mr-1">
             Compass Planning
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
            {!client && <span className="text-sm font-semibold text-slate-500">Financial Planning</span>}
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
            <button onClick={() => { setTab("agents"); logout(); }} title="Sign out" className="text-slate-400 hover:text-rose-500 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
         </header>
         {showForceReset && <ChangePasswordModal forceReset onClose={() => setShowForceReset(false)} />}
         {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
        

        {/* Content — wrap in fp-insightled so EVERY tab gets the
            light-grey page + dark-card treatment (sidebar/header are outside) */}
        <div key={tab} className={`flex-1 fp-insightled animate-in fade-in duration-300 ${
            (tab === "networth" || tab === "clients") ? "overflow-hidden" : "overflow-y-auto"
        }`}>
          <Suspense fallback={<TabLoader />}>
          {/* Global context bar — shown when a client is selected and not on overview/clients */}
          {client && !["clients", "overview", "dashboard"].includes(tab) && (
            <div className="flex justify-between items-center bg-white border-b border-slate-200 px-6 py-2">
              <button onClick={() => setTab("overview" as Tab)} className="text-sm font-medium text-slate-700 hover:text-blue-600 transition flex items-center gap-1.5">
                <span>{client.firstName}{client.spouseFirstName ? ` & ${client.spouseFirstName}` : ""} {client.lastName}</span>
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
          {tab === "clients" && !showClientDetail && (
            <ClientsTab onSelect={selectClient} tAdv={tAdvisor} />
          )}
          {tab === "clients" && showClientDetail && client && (
            <ClientDetail client={client} onBack={backToClients} onPlanSelect={selectPlan} onUpdate={setClient} onLocaleChange={setClientLocale} t={tAdvisor} advisorLocale={advisorLocale} level={level} />
          )}
          {tab !== "agents" && tab !== "clients" && !client && (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="w-16 h-16 bg-white border border-slate-200/80 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                <Users className="w-8 h-8 text-slate-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-800 mb-1">Select a Client</h2>
              <p className="text-sm text-slate-500 mb-4">Choose a client from the Clients tab to view their financial plan</p>
              <button onClick={() => setTab("agents")} className="text-sm font-semibold text-white bg-brand-gradient hover:bg-brand-gradient-hover px-4 py-2 rounded-lg shadow-sm transition-all">
                Go to Clients
              </button>
            </div>
          )}
          {tab === "agents"  && <AgentsTab />}
          {tab === "overview" && client && <ClientOverview client={client as any} onNavigate={(tab) => setTab(tab as Tab)} t={tAdvisor} />}
          {tab === "profile"  && client && <ClientDetail client={client} onBack={() => setTab("overview" as Tab)} onPlanSelect={selectPlan} onUpdate={setClient} onLocaleChange={setClientLocale} t={tAdvisor} advisorLocale={advisorLocale} level={level} />}
          {tab === "dashboard" && client && <InsightLedDashboard clientId={client.id} client={client} t={tAdvisor} onNavigate={(tab) => { const [tabKey, subtab] = tab.split(":"); setTab(tabKey as Tab); setNwSubtabHint(subtab); }} />}

          {/* ── Merged Insight-Led hubs ─────────────────────────────────────────
              Each hub provides its own dark Insight-Led shell with sub-tabs.
              They render outside PlanningDocFlow because the hub is the shell. */}
          {tab === "protection" && client && (
            <ProtectionHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={tAdvisor} />
          )}
          {tab === "retirementhub" && client && (
            <RetirementHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={tAdvisor} />
          )}
          {tab === "taxestate" && client && (
            <TaxEstateHub clientId={client.id} client={client} person={person} onPersonChange={setPerson} t={tAdvisor} />
          )}
          {tab === "documents" && client && (
            <DocumentsHub clientId={client.id} client={client} t={tAdvisor} advisorLocale={advisorLocale} />
          )}
          {tab === "fp" && client && (
            <FinancialPlanHub clientId={client.id} client={client} t={tAdvisor} />
          )}

          {/* ── Simple themed tabs — kept in PlanningDocFlow for voice/recording ── */}
          {PLANNING_TABS.includes(tab as PlanningTab) && client && (
            <div className="fp-insightled h-full">
              <PlanningDocFlow
                tab={tab as PlanningTab}
                clientId={client.id}
                clientName={client.spouseFirstName
                  ? `${client.lastName} Family`
                  : `${client.firstName} ${client.lastName}`}
                client={client}
                initialNwSubtab={tab === "networth" ? nwSubtabHint : undefined}
                tr={tAdvisor}
                personToggle={tab === "goals" && hasSpouse ? {
                  person,
                  onPersonChange: setPerson,
                  primaryLabel: client.firstName,
                  spouseLabel: client.spouseFirstName!,
                  showCombined: true,
                } : undefined}
              >
                {tab === "networth" && (
                  <QueryClientProvider client={queryClient}>
                      <NetWorthTabNew clientId={client.id} client={client} t={tAdvisor} />
                   </QueryClientProvider>
                )}
                {tab === "goals"    && (
                  <QueryClientProvider client={queryClient}>
                    <GoalsTab clientId={client.id} client={client} t={tAdvisor} />
                 </QueryClientProvider>
                )}
                {tab === "debt"     && (
                  <QueryClientProvider client={queryClient}>
                    <DebtTab clientId={client.id} t={tAdvisor} />
                  </QueryClientProvider>
                )}
                {tab === "expenses" && (
                  <QueryClientProvider client={queryClient}>
                    <ExpensesTab clientId={client.id} addTrigger={tab === "expenses" ? globalAddTrigger : 0} t={tAdvisor} />
                  </QueryClientProvider>
                )}
                {tab === "ai" && (
                  <QueryClientProvider client={queryClient}>
                    <AITab clientId={client.id} t={tAdvisor} />
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

