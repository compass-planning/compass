import { useSearch, useLocation, useParams } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import { useClients } from "@/hooks/use-clients";
import { useCurrentStaff } from "@/hooks/use-users";
import { AppLayout } from "@/components/AppLayout";
import { GoalsTab }    from "@/pages/GoalsTab";
import { PensionTab }  from "@/pages/PensionTab";
import { ExpensesTab } from "@/pages/ExpensesTab";
import { ReportsTab }  from "@/pages/ReportsTab";
import { LettersTab }  from "@/pages/LettersTab";
import { PoliciesTab } from "@/pages/PoliciesTab";
import { MeltdownTab } from "@/pages/MeltdownTab";
import { HouseholdQueue } from "@/components/HouseholdQueue";
import { InsightLedDashboard } from "@/components/InsightLedDashboard";
import { ClientProfileSection } from "@/components/ClientProfileSection";
import { RecordMeetingPanel, LogActivityPanel, PastMeetingsPanel } from "@/components/ClientActivityTabs";
import { NetWorthTab as MultiEntryNetWorthTab } from "@/pages/MultiEntryTabs";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import React, { useState, useEffect, Component, type ReactNode, useContext } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { InlineEdit } from "@/components/ui/InlineEdit";
import { NWSubtabCtx } from "@/components/layout/PlanningDocFlow";
// trying to force build this file
class ErrorBoundary extends Component<{children:ReactNode;fallback?:ReactNode},{error:boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? (this.props.fallback ?? null) : this.props.children; }
}
import { useQuery } from "@tanstack/react-query";
import { RetirementTab } from "@/components/planning/RetirementProjectionForm";
import {
  useClientPlans, useNetWorthEntries, useCreateNetWorthEntry, useDeleteNetWorthEntry, useUpdateNetWorthEntry,
  useRetirementProjections,
  useInsuranceAnalyses, useCreateInsuranceWorksheet,
  useEducationSavings, useCreateEducationSaving, useDeleteEducationSaving,
  useDebtEntries, useCreateDebtEntry, useDeleteDebtEntry,
  useTaxPlanningNotes, useCreateTaxPlanningNote, useDeleteTaxPlanningNote,
  useEstatePlanningNotes, useCreateEstatePlanningNote, useDeleteEstatePlanningNote,
  useAiRecommendations, useGenerateAiRecommendations, useUpdateAiRecommendation, useDeleteAiRecommendation,
  useFinancialPlanningOverview, useAvailableReports,
  usePlanStaleFlags, useSimulationResults, usePlanAssumptions, useCapitalGains,
  useDeleteInsuranceAnalysis,
} from "@/hooks/use-plans";
import { SimulationDashboard } from "@/components/planning/SimulationDashboard";
import {
  RespFundingGauge, EstateScorecard, DebtPayoffTimeline,
} from "@/components/planning/ModuleViews";
import { FinancialPlanTab } from "@/components/planning/FinancialPlanTab";
import {
  Target, DollarSign, PiggyBank, Shield, GraduationCap, CreditCard,
  Receipt, ScrollText, Brain, Plus, Trash2, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, FileText, Printer, Loader2, BarChart3,
  Users, ChevronDown, Eye, Gift, FileSignature,
  Pencil, Save, X, SlidersHorizontal,
  Flag, Building2, Wallet, ClipboardList, ArrowLeft, Search,
  UserCircle, Activity, ChevronRight, Mic, CalendarClock,
} from "lucide-react";

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey = "profile" | "overview"  | "plan" | "dashboard" | "networth"
| "goals" | "pension" | "retirement" | "insurance" | "resp"
| "expenses" | "debt" | "tax" | "estate" | "meltdown"
| "record_meeting" | "log_activity" | "past_meetings"
| "letters" | "policies" | "reports" | "ai" | "income";

function getTabs(isFr: boolean): { key: TabKey; label: string; icon: typeof Target }[] {
  return [
  { key: "profile",     label: isFr ? "Profil" : "Profile",        icon: UserCircle },
  { key: "overview",    label: isFr ? "Aperçu" : "Overview",       icon: Target },
  { key: "plan",        label: isFr ? "Plan financier" : "Financial Plan", icon: Sparkles },
  { key: "dashboard",   label: isFr ? "Tableau de bord" : "Dashboard",      icon: BarChart3 },
  { key: "networth",    label: isFr ? "Valeur nette" : "Net Worth",      icon: DollarSign },
  { key: "income",      label: isFr ? "Revenus" : "Income Sources",   icon: TrendingUp },
  { key: "retirement",  label: isFr ? "Retraite" : "Retirement",     icon: PiggyBank },
  { key: "insurance",   label: isFr ? "Assurance" : "Insurance",      icon: Shield },
  { key: "resp",        label: isFr ? "REEE" : "RESP",           icon: GraduationCap },
  { key: "debt",        label: isFr ? "Dettes" : "Debt",           icon: CreditCard },
  { key: "tax",         label: isFr ? "Fiscalité" : "Tax",            icon: Receipt },
  { key: "estate",      label: isFr ? "Succession" : "Estate",         icon: ScrollText },
  { key: "ai",          label: isFr ? "IA" : "AI Insights",    icon: Brain },
  { key: "goals",       label: isFr ? "Objectifs" : "Goals",           icon: Flag },
  { key: "pension",     label: isFr ? "Régime de retraite" : "Pension",          icon: Building2 },
  { key: "expenses",    label: isFr ? "Dépenses" : "Expenses",         icon: Wallet },
  { key: "meltdown",    label: isFr ? "Décaissement" : "Meltdown",         icon: TrendingDown },
  { key: "record_meeting", label: isFr ? "Enregistrer réunion" : "Record Meeting",   icon: Mic },
  { key: "log_activity",   label: isFr ? "Journal d'activité" : "Log Activity",     icon: Activity },
  { key: "past_meetings",  label: isFr ? "Réunions passées" : "Past Meetings",    icon: CalendarClock },
  { key: "letters",     label: isFr ? "Lettres" : "Letters",          icon: FileSignature },
  { key: "policies",    label: isFr ? "Polices" : "Policies Doc",     icon: FileText },
  { key: "reports",     label: isFr ? "Rapports" : "Reports",          icon: ClipboardList },
  ];
}

// Grouped client-sidebar structure. Items reference keys in `tabs`; an optional
// `label` overrides the display name. Tabs not listed here render flat at the end
// in their original order (see fpNavSidebar render).
type NavEntry =
  | { type: "item"; key: TabKey }
  | { type: "group"; label: string; items: { key: TabKey; label?: string }[] };

function getNavStructure(isFr: boolean): NavEntry[] {
  return [
  { type: "item", key: "profile" },
  { type: "item", key: "overview" },
  { type: "item", key: "dashboard" },
  { type: "group", label: isFr ? "Détails financiers" : "Financial Details", items: [
    { key: "networth" }, { key: "income" }, { key: "goals" }, { key: "debt" }, { key: "expenses" },
    { key: "pension" }, { key: "retirement" }, { key: "resp" }, { key: "tax" }, { key: "meltdown" },
  ] },
  { type: "group", label: isFr ? "Détails assurance" : "Insurance Details", items: [
    { key: "policies" }, { key: "insurance", label: isFr ? "Analyse des besoins" : "Financial Needs Analysis" },
  ] },
  { type: "group", label: isFr ? "Insights & Plans" : "Insights & Plans", items: [
    { key: "ai" }, { key: "plan", label: isFr ? "Plan financier" : "Financial Plan" },
  ] },
  { type: "group", label: isFr ? "Activité" : "Activity", items: [
    { key: "record_meeting" }, { key: "log_activity" }, { key: "past_meetings" },
  ] },
  ];
}

// Keys handled by navStructure above; computed inside components using isFr.
// Placeholder for module-level usage with isFr=false (English default).
const _tabs_en = getTabs(false);
const _nav_en = getNavStructure(false);
const groupedKeys = new Set<TabKey>(
  _nav_en.flatMap(e => e.type === "item" ? [e.key] : e.items.map(i => i.key))
);
const ungroupedTabs = _tabs_en.filter(t => !groupedKeys.has(t.key));

const moduleToTabMap: Record<string, TabKey> = {
  retirement: "retirement", insurance: "insurance", education: "resp",
  estate: "estate", debt: "debt", tax: "tax", cashflow: "overview",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(s: string | null | undefined): string {
  if (!s) return "";
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fmt$(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n: number): string { return `${(n * 100).toFixed(1)}%`; }

// ── Report helper — opens server-generated HTML report in new window ──────────

async function openReport(clientId: number, type: "comprehensive" | "retirement" | "insurance" | "net-worth") {
    const res = await fetch(`/api/crm/reports/${clientId}/${type}`, {
    headers: {},
  });
  if (!res.ok) throw new Error("Failed to generate report");
  const html = await res.text();
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ clientId, onTabChange, t }: { clientId: number; onTabChange?: (t: TabKey) => void }) {
  const { isFrench: isFr } = useLanguage();
  const { data: overview, isLoading } = useFinancialPlanningOverview(clientId);
  const { data: reports } = useAvailableReports(clientId);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const handleReport = async (type: "comprehensive" | "retirement" | "insurance" | "net-worth") => {
    setGeneratingReport(type);
    try { await openReport(clientId, type as any); }
    catch (err) { console.error("Report error:", err); }
    finally { setGeneratingReport(null); }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">{isFr ? "Chargement de l'aperçu..." : "Loading overview..."}</div>;
  if (!overview) return null;

  const cards = [
    { label: isFr ? "Valeur nette" : "Net Worth",            value: `$${Number(overview.netWorth).toLocaleString()}`,          icon: DollarSign,  color: overview.netWorth >= 0 ? "text-green-600" : "text-red-600",    bg: overview.netWorth >= 0 ? "bg-green-50" : "bg-red-50" },
    { label: isFr ? "Total des actifs" : "Total Assets",         value: `$${Number(overview.totalAssets).toLocaleString()}`,        icon: TrendingUp,  color: "text-green-600", bg: "bg-green-50" },
    { label: isFr ? "Total des passifs" : "Total Liabilities",    value: `$${Number(overview.totalLiabilities).toLocaleString()}`,   icon: TrendingDown, color: "text-red-500",  bg: "bg-red-50" },
    { label: isFr ? "Total des dettes" : "Total Debt",           value: `$${Number(overview.totalDebt).toLocaleString()}`,          icon: CreditCard,  color: "text-orange-600", bg: "bg-orange-50" },
    { label: isFr ? "Objectifs financiers" : "Financial Goals",      value: overview.goals,                    icon: Target,        color: "text-primary",    bg: "bg-primary/5",   tab: "dashboard" },
    { label: isFr ? "Plans de retraite" : "Retirement Plans",     value: overview.retirementProjections,    icon: PiggyBank,     color: "text-violet-600",   bg: "bg-violet-50",     tab: "retirement" },
    { label: isFr ? "Analyses d'assurance" : "Insurance Analyses",   value: overview.insuranceAnalyses,        icon: Shield,        color: "text-purple-600", bg: "bg-purple-50",   tab: "insurance" },
    { label: isFr ? "Plans d'éducation" : "Education Plans",      value: overview.educationPlans,           icon: GraduationCap, color: "text-teal-600",   bg: "bg-teal-50",     tab: "resp" },
    { label: isFr ? "Notes fiscales" : "Tax Notes",            value: overview.taxNotes,                 icon: Receipt,       color: "text-amber-600",  bg: "bg-amber-50",    tab: "tax" },
    { label: isFr ? "Notes successorales" : "Estate Notes",         value: overview.estateNotes,              icon: ScrollText,    color: "text-indigo-600", bg: "bg-indigo-50",   tab: "estate" },
    { label: isFr ? "Recommandations IA" : "AI Recommendations",   value: overview.aiRecommendations,        icon: Brain,         color: "text-pink-600",   bg: "bg-pink-50",     tab: "ai" },
    { label: isFr ? "Actions en attente" : "Pending Actions",      value: overview.pendingRecommendations,   icon: Clock,         color: "text-yellow-600", bg: "bg-yellow-50",   tab: "ai" },
  ];

  const reportButtons = [
    { type: "comprehensive", label: isFr ? "Plan complet" : "Full Plan",   available: true,                   icon: FileText,  tab: null },
    { type: "retirement",    label: isFr ? "Retraite" : "Retirement",  available: !!reports?.retirement,  icon: PiggyBank, tab: "retirement" as TabKey },
    { type: "insurance",     label: isFr ? "Assurance" : "Insurance",   available: !!reports?.insurance,   icon: Shield,    tab: "insurance" as TabKey },
    { type: "net-worth",     label: isFr ? "Valeur nette" : "Net Worth",   available: !!reports?.netWorth,    icon: DollarSign, tab: "networth" as TabKey },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-display font-bold">{isFr ? "Aperçu de la planification financière" : "Financial Planning Overview"}</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {reportButtons.map(btn => (
            <button
              key={btn.type}
              onClick={() => btn.tab ? onTabChange?.(btn.tab) : handleReport(btn.type as any)}
              disabled={!btn.available || generatingReport === btn.type}
              data-testid={`button-report-${btn.type}`}
              className="flex items-center space-x-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generatingReport === btn.type
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <btn.icon className="w-3.5 h-3.5" />}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map(card => (
          <div key={card.label} onClick={() => (card as any).tab && onTabChange?.((card as any).tab)}
            className={`border border-border rounded-2xl p-5 ${card.bg} ${(card as any).tab ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}>
            <div className="flex items-center space-x-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{card.label}</p>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Net Worth Tab ─────────────────────────────────────────────────────────────

const NW_CAT_COLORS: Record<string, string> = {
  "Liquid Assets": "#3b82f6", "Registered Investments (RRSP/TFSA)": "#10b981",
  "Non-Registered Investments": "#8b5cf6", "Real Estate": "#f59e0b",
  "Business Assets": "#ef4444", "Personal Property": "#06b6d4", "Other": "#94a3b8",
  "Mortgages": "#dc2626", "Car Loans": "#f97316", "Student Loans": "#a78bfa",
  "Credit Cards": "#fb7185", "Lines of Credit": "#fbbf24", "Business Loans": "#64748b",
  "Other Liabilities": "#94a3b8",
};

function NetWorthItem({ item, onUpdate, onDelete }: { item: any; onUpdate: (id: number, data: any) => void; onDelete: (id: number) => void }) {
  const isAsset = item.type === "asset";
  const val = parseFloat(item.value || "0");
  const fmtVal = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
  return (
    <div className="group flex justify-between items-center px-5 py-3 hover:bg-slate-50 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900" onClick={e => e.stopPropagation()}>
            <InlineEdit value={item.name} onSave={v => onUpdate(item.id, { name: v })} placeholder="Name" />
          </div>
          {item.owner && (
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-0.5 inline-block">{item.owner}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`text-sm font-semibold ${isAsset ? "text-emerald-600" : "text-red-500"}`} onClick={e => e.stopPropagation()}>
          <InlineEdit
            value={val.toFixed(0)} type="number"
            onSave={v => onUpdate(item.id, { value: v })}
            format={v => `${isAsset ? "" : "−"}${fmtVal(Number(v))}`}
            inputClassName="w-28 text-right"
          />
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
          <button onClick={() => onDelete(item.id)} className="p-1 text-slate-300 hover:text-red-500 transition" data-testid={`button-fp-del-nw-${item.id}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function NetWorthSection({ title, total, color, isAsset, children, onAdd }: {
  title: string; total: number; color: string; isAsset: boolean; children: React.ReactNode; onAdd: () => void;
}) {
  const [open, setOpen] = useState(true);
  const fmtVal = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-sm transition-shadow">
      <div onClick={() => setOpen(o => !o)} className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <div>
            <p className="font-semibold text-slate-900 text-sm">{title}</p>
            <p className="text-xs text-slate-400">{open ? "Click to collapse" : "Click to expand"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <p className={`text-base font-semibold ${isAsset ? "text-emerald-600" : "text-red-500"}`}>{isAsset ? "" : "−"}{fmtVal(total)}</p>
          <span className="text-slate-300 text-sm">{open ? "−" : "+"}</span>
        </div>
      </div>
      {open && (
        <div className="border-t border-slate-100">
          {children}
          <button onClick={e => { e.stopPropagation(); onAdd(); }} className="w-full px-5 py-2 text-xs text-violet-600 hover:bg-violet-50 text-left transition-colors border-t border-slate-50">
            + Add to {title}
          </button>
        </div>
      )}
    </div>
  );
}

export function NetWorthTab({ clientId }: { clientId: number }) {
  const { isFrench: isFr, t } = useLanguage();
  const { sub } = useContext(NWSubtabCtx);
  const { data: rawEntries = [] } = useNetWorthEntries(clientId);
  const entries = rawEntries as any[];
  const createEntry = useCreateNetWorthEntry();
  const updateEntry = useUpdateNetWorthEntry(clientId);
  const deleteEntry = useDeleteNetWorthEntry(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"asset" | "liability">("asset");
  const [presetCat, setPresetCat] = useState("");
  const [form, setForm] = useState({ category: "", name: "", value: "" });

  const assetCats = ["Liquid Assets", "Registered Investments (RRSP/TFSA)", "Non-Registered Investments", "Real Estate", "Business Assets", "Personal Property", "Other"];
  const liabilityCats = ["Mortgages", "Car Loans", "Student Loans", "Credit Cards", "Lines of Credit", "Business Loans", "Other Liabilities"];

  const assets      = entries.filter(e => e.type === "asset");
  const liabilities = entries.filter(e => e.type === "liability");
  const totalAssets      = assets.reduce((s, e) => s + parseFloat(e.value || "0"), 0);
  const totalLiabilities = liabilities.reduce((s, e) => s + parseFloat(e.value || "0"), 0);
  const netWorth = totalAssets - totalLiabilities;

  const fmtBig = (n: number) => Math.abs(n) >= 1_000_000 ? `$${(n/1_000_000).toFixed(2)}M` : `$${Math.round(n).toLocaleString("en-CA")}`;

  const assetGroups   = assetCats.map(cat => ({ cat, items: assets.filter((e: any) => e.category === cat), total: 0 }))
    .map(g => ({ ...g, total: g.items.reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0) }))
    .filter(g => g.items.length > 0);
  const liabGroups    = liabilityCats.map(cat => ({ cat, items: liabilities.filter((e: any) => e.category === cat), total: 0 }))
    .map(g => ({ ...g, total: g.items.reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0) }))
    .filter(g => g.items.length > 0);

  const pieData = assetGroups.map(g => ({ name: g.cat.split(" ")[0], full: g.cat, value: Math.round(g.total) })).filter(d => d.value > 0);

  function openAdd(type: "asset" | "liability", cat = "") {
    setAddType(type); setPresetCat(cat);
    setForm({ category: cat, name: "", value: "" });
    setShowAdd(true);
  }

  const handleAdd = async () => {
    try {
            const res = await fetch(`/api/crm/clients/${clientId}/net-worth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: addType, category: form.category, name: form.name, value: form.value })
      });
      const data = await res.json();
      if (res.ok) { setShowAdd(false); setForm({ category: "", name: "", value: "" }); }
      else { toast({ title: "Error", description: data.message, variant: "destructive" }); }
    } catch(e: any) { alert("Failed: " + e.message); }
  };

  // Education subtab — hand off to RESPTab
  if (sub === "education") {
    return <RESPTab clientId={clientId} planId={null} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{sub === "liabilities" ? (isFr ? "Passifs" : t.netWorth.liabilitiesTab) : t.netWorth.title}</h1>
          <p className="text-sm text-slate-500">{entries.length} entr{entries.length !== 1 ? "ies" : "y"}</p>
        </div>
        <button onClick={() => openAdd(sub === "liabilities" ? "liability" : "asset")} data-testid="button-fp-add-nw"
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-violet-400 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
          <Plus className="w-4 h-4" /> {t.common.addEntry}
        </button>
      </div>

      {/* Hero summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className={`bg-white border-2 rounded-xl p-5 ${netWorth >= 0 ? "border-violet-200 bg-violet-50/30" : "border-red-200 bg-red-50/30"}`} data-testid="fp-net-worth">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.netWorth.title}</p>
          <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? "text-violet-600" : "text-red-600"}`}>{fmtBig(netWorth)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="fp-total-assets">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.netWorth.totalAssets}</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtBig(totalAssets)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5" data-testid="fp-total-liabilities">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{t.netWorth.totalLiabilities}</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{fmtBig(totalLiabilities)}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 font-semibold">{t.common.noData2}</p>
          <button onClick={() => openAdd("asset")} className="mt-3 text-violet-600 text-sm hover:underline">{t.netWorth.addFirstAsset}</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT — grouped sections */}
          <div className="lg:col-span-2 space-y-4">
            {(sub !== "liabilities") && assetGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.netWorth.assets}</p>
                {assetGroups.map(({ cat, items, total }) => (
                  <NetWorthSection key={cat} title={cat} total={total} color={NW_CAT_COLORS[cat] ?? "#94a3b8"} isAsset onAdd={() => openAdd("asset", cat)}>
                    {items.map((e: any) => (
                      <NetWorthItem key={e.id} item={e}
                        onUpdate={(id, data) => updateEntry.mutate({ id, data })}
                        onDelete={id => { if (confirm("Delete?")) deleteEntry.mutate(id); }}
                      />
                    ))}
                  </NetWorthSection>
                ))}
              </div>
            )}
            {(sub !== "assets") && liabGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.netWorth.liabilities}</p>
                {liabGroups.map(({ cat, items, total }) => (
                  <NetWorthSection key={cat} title={cat} total={total} color={NW_CAT_COLORS[cat] ?? "#94a3b8"} isAsset={false} onAdd={() => openAdd("liability", cat)}>
                    {items.map((e: any) => (
                      <NetWorthItem key={e.id} item={e}
                        onUpdate={(id, data) => updateEntry.mutate({ id, data })}
                        onDelete={id => { if (confirm("Delete?")) deleteEntry.mutate(id); }}
                      />
                    ))}
                  </NetWorthSection>
                ))}
              </div>
            )}
            {sub === "liabilities" && liabGroups.length === 0 && (
              <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl">
                <p className="text-slate-500 font-semibold">{isFr ? "Aucun passif" : "No liabilities"}</p>
                <button onClick={() => openAdd("liability")} className="mt-3 text-violet-600 text-sm hover:underline">{t.netWorth.addFirstLiability}</button>
              </div>
            )}
          </div>

          {/* RIGHT — allocation chart */}
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{isFr ? "Répartition des actifs" : "Asset Allocation"}</p>
              {pieData.length > 0 ? (
                <>
                  <PieChart width={220} height={160}>
                    <Pie data={pieData} cx={110} cy={75} innerRadius={45} outerRadius={68} paddingAngle={2} dataKey="value">
                      {pieData.map(entry => <Cell key={entry.name} fill={NW_CAT_COLORS[entry.full] ?? "#94a3b8"} />)}
                    </Pie>
                    <Tooltip wrapperStyle={{ zIndex: 50 }} contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "11px" }} formatter={(v: number, _: any, p: any) => [`$${Math.round(v).toLocaleString("en-CA")}`, p?.payload?.full ?? ""]} />
                  </PieChart>
                  <div className="space-y-1.5 mt-1">
                    {pieData.map(d => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: NW_CAT_COLORS[d.full] ?? "#94a3b8" }} />
                          <span className="text-slate-600 truncate max-w-[100px]">{d.full.split("(")[0].trim()}</span>
                        </div>
                        <span className="font-medium text-slate-900">{fmtBig(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-xs text-slate-400 text-center py-8">{isFr ? "Ajoutez des actifs pour voir la répartition" : "Add assets to see allocation"}</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{t.netWorth.quickAdd}</p>
              {["Real Estate", "Registered Investments (RRSP/TFSA)", "Liquid Assets"].map(cat => (
                <button key={cat} onClick={() => openAdd("asset", cat)} className="w-full text-left text-xs text-slate-600 hover:text-violet-600 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition">+ {cat.split(" ")[0]}</button>
              ))}
              <div className="border-t border-slate-100 pt-2 mt-1">
                {["Mortgages", "Credit Cards"].map(cat => (
                  <button key={cat} onClick={() => openAdd("liability", cat)} className="w-full text-left text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition">+ {cat}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-bold mb-5 text-slate-900">{addType === "asset" ? (isFr ? "Ajouter un actif" : t.netWorth.addAsset) : (isFr ? "Ajouter un passif" : t.netWorth.addLiability)}</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddType("asset")} className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${addType === "asset" ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300" : "bg-slate-100 text-slate-500"}`}>{isFr ? "Actif" : t.common.asset}</button>
                <button type="button" onClick={() => setAddType("liability")} className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${addType === "liability" ? "bg-red-100 text-red-600 border-2 border-red-300" : "bg-slate-100 text-slate-500"}`}>{isFr ? "Passif" : t.common.liability}</button>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">{t.common.category}</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-nw-cat" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400">
                  <option value="">-- Select --</option>
                  {(addType === "asset" ? assetCats : liabilityCats).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">{isFr ? "Description" : "Description"}</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-fp-nw-name" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">{isFr ? "Valeur ($)" : "Value ($)"}</label>
                <input type="number" step="0.01" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} data-testid="input-fp-nw-value" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:bg-slate-100">{t.common.cancel}</button>
              <button onClick={handleAdd} disabled={createEntry.isPending || !form.category || !form.name || !form.value} data-testid="button-fp-submit-nw"
                className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-violet-600 to-violet-400 text-white hover:shadow-md disabled:opacity-50 transition">
                {createEntry.isPending ? t.common.adding : t.common.addEntry}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ── Scenario preview for module tabs ─────────────────────────────────────────

function ModuleScenarioPreview({ planId, module }: { planId: number | null; module: string }) {
  const { data: simResults = [] } = useSimulationResults(planId);
  const moduleResults = simResults.filter(r => r.module === module);
  if (moduleResults.length === 0) return null;
  const scenarioLabels: Record<string, string> = { Conservative: "Stress", Moderate: "Base", Aggressive: "Optimistic" };
  return (
    <div className="border border-border rounded-2xl p-4" data-testid={`module-scenario-${module}`}>
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Monte Carlo Results</p>
      <div className="grid grid-cols-3 gap-3">
        {moduleResults.slice(0, 3).map(r => {
          const pctVal = Math.round(Number(r.successRate) * 100);
          const color = pctVal >= 80 ? "text-green-600 bg-green-50 border-green-200" : pctVal >= 60 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : "text-red-600 bg-red-50 border-red-200";
          return (
            <div key={r.scenario} className={`border rounded-xl p-3 text-center ${color}`} data-testid={`module-scenario-card-${module}-${r.scenario.toLowerCase()}`}>
              <p className="text-xs font-semibold opacity-70">{scenarioLabels[r.scenario] || r.scenario}</p>
              <p className="text-2xl font-bold">{pctVal}%</p>
              <p className="text-xs">success</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// ── Insurance Tab ─────────────────────────────────────────────────────────────
// (Retained from original — full worksheet)

type WorksheetForm = {
  primaryName: string; primaryAge: string; primaryAnnualIncome: string;
  spouseName: string; spouseAge: string; spouseAnnualIncome: string;
  familyMembers: string;
  liabilities: { mortgageBalance: string; carLoans: string; linesOfCredit: string; creditCards: string; finalExpenses: string; emergencyFund: string };
  legacy: { educationFund: string; legacyFundForChildren: string; charitableBequest: string; other: string };
  primaryIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  spouseIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  primaryAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  spouseAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  primaryExistingCoverage: string; spouseExistingCoverage: string;
  primaryCoveragePurchased: string; spouseCoveragePurchased: string;
  primaryShortfallAcknowledged: string; spouseShortfallAcknowledged: string;
  primarySignature: string; spouseSignature: string; signatureDate: string;
  meetingNotes: string;
};

// Forward declarations so InsuranceTab can reference them
declare function WorksheetField(props: { label: string; value: string; onChange: (v: string) => void; testId: string; prefix?: string }): JSX.Element;
declare function AssetRow(props: { label: string; value: string; onValueChange: (v: string) => void; useIt?: boolean; onToggle?: () => void; testId: string }): JSX.Element;

function WorksheetFieldImpl({ label, value, onChange, testId, prefix = "$", v }: { label: string; value: string; onChange: (v: string) => void; testId: string; prefix?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex mt-1">
        {prefix && <span className="flex items-center px-3 bg-muted border border-r-0 rounded-l-lg text-sm font-medium">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={testId}
          className={`flex-1 px-3 py-2 border text-sm bg-background ${prefix ? "rounded-r-lg" : "rounded-lg"}`}
          placeholder="0"
        />
      </div>
    </div>
  );
}

function AssetRowImpl({ label, value, onValueChange, useIt, onToggle, testId, v }: { label: string; value: string; onValueChange: (v: string) => void; useIt?: boolean; onToggle?: () => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      {onToggle !== undefined && (
        <input type="checkbox" checked={useIt} onChange={onToggle} data-testid={`toggle-${testId}`} className="rounded" />
      )}
      <div className="flex-1">
        <WorksheetFieldImpl label={label} value={value} onChange={onValueChange} testId={`input-${testId}`} />
      </div>
    </div>
  );
}

export function InsuranceTab({ clientId, planId, client }: { clientId: number; planId: number | null; client?: Record<string, unknown> }) {
  const { isFrench: isFr, t } = useLanguage();
  const { data: analyses = [] } = useInsuranceAnalyses(clientId);
  const { data: nwEntries = [] } = useNetWorthEntries(clientId);
  const [policies, setPolicies] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>(`/api/crm/clients/${clientId}/policies`).then(data => { console.log("Policies loaded:", data); setPolicies(data); }).catch(err => console.error("Policies error:", err)); }, [clientId]);
  const deleteAnalysis = useDeleteInsuranceAnalysis(clientId);
  const createWorksheet = useCreateInsuranceWorksheet();
  const queryClient = useQueryClient();
  const [showWorksheet, setShowWorksheet] = useState(false);
  const [viewingId, setViewingId] = useState<number | null>(null);

  const defaultWs: WorksheetForm = {
    primaryName: "", primaryAge: "", primaryAnnualIncome: "",
    spouseName: "", spouseAge: "", spouseAnnualIncome: "", familyMembers: "2",
    liabilities: { mortgageBalance: "0", carLoans: "0", linesOfCredit: "0", creditCards: "0", finalExpenses: "15000", emergencyFund: "0" },
    legacy: { educationFund: "0", legacyFundForChildren: "0", charitableBequest: "0", other: "0" },
    primaryIncome: { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" },
    spouseIncome: { replacementPct: "70", cppSurvivorBenefit: "700", targetAge: "65" },
    primaryAssets: { liquidSavings: "0", rrsps: "0", rrspsUse: true, nonRegistered: "0", nonRegisteredUse: true, tfsa: "0", tfsaUse: true, other: "0" },
    spouseAssets: { liquidSavings: "0", rrsps: "0", rrspsUse: true, nonRegistered: "0", nonRegisteredUse: true, tfsa: "0", tfsaUse: true, other: "0" },
    primaryExistingCoverage: "0", spouseExistingCoverage: "0",
    primaryCoveragePurchased: "0", spouseCoveragePurchased: "0",
    primaryShortfallAcknowledged: "0", spouseShortfallAcknowledged: "0",
    primarySignature: "", spouseSignature: "", signatureDate: "",
    meetingNotes: "",
  };
  const [form, setForm] = useState<WorksheetForm>(defaultWs);

function buildDefaultFromNW() {
  const sum = (type: string, category: string, owner?: string) =>
    nwEntries.filter((e: any) => e.type === type && e.category === category && (!owner || e.owner === owner))
             .reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0);
  const policySum = (insured: string) =>
    policies.filter((p: any) => p.insured === insured && ["Life","Term Life","Whole Life","Universal Life"].includes(p.type))
            .reduce((s: number, p: any) => s + parseFloat(p.coverageAmount || "0"), 0);
  return {
    liabilities: {
      mortgageBalance: String(sum("liability", "Mortgage")),
      carLoans:        String(sum("liability", "Car Loan")),
      linesOfCredit:   String(sum("liability", "Line of Credit")),
      creditCards:     String(sum("liability", "Credit Card")),
      finalExpenses:   "15000",
      emergencyFund:   "0",
    },
    primaryAssets: {
      liquidSavings:      String(sum("asset", "Cash/Bank", "primary")),
      rrsps:              String(sum("asset", "RRSP", "primary")),
      rrspsUse:           true,
      nonRegistered:      String(sum("asset", "Non-Registered", "primary")),
      nonRegisteredUse:   true,
      tfsa:               String(sum("asset", "TFSA", "primary")),
      tfsaUse:            true,
      other:              "0",
    },
    spouseAssets: {
      liquidSavings:      String(sum("asset", "Cash/Bank", "spouse")),
      rrsps:              String(sum("asset", "RRSP", "spouse")),
      rrspsUse:           true,
      nonRegistered:      String(sum("asset", "Non-Registered", "spouse")),
      nonRegisteredUse:   true,
      tfsa:               String(sum("asset", "TFSA", "spouse")),
      tfsaUse:            true,
      other:              "0",
    },
      primaryExistingCoverage: String(policySum("primary")),
      spouseExistingCoverage:  String(policySum("spouse")),
  };
}
  const v = (s: string) => parseFloat(s) || 0;
  const subtotalA = Object.values(form.liabilities).reduce((s, val) => s + v(val), 0);
  const subtotalB = Object.values(form.legacy).reduce((s, val) => s + v(val), 0);
  const primaryYears = form.primaryAge ? Math.max(0, v(form.primaryIncome.targetAge) - v(form.primaryAge)) : 0;
  const spouseYears  = form.spouseAge ? Math.max(0, v(form.spouseIncome.targetAge) - v(form.spouseAge)) : 0;
  const annualReplace = (income: string, pct: string, cpp: string) =>
    (v(income) * v(pct) / 100) - (v(cpp) * 12);
  const subtotalC = annualReplace(form.primaryAnnualIncome, form.primaryIncome.replacementPct, form.primaryIncome.cppSurvivorBenefit) * primaryYears;
  const subtotalD = annualReplace(form.spouseAnnualIncome,  form.spouseIncome.replacementPct,  form.spouseIncome.cppSurvivorBenefit)  * spouseYears;
  const calcE = (assets: WorksheetForm["primaryAssets"]) =>
    v(assets.liquidSavings) + (assets.rrspsUse ? v(assets.rrsps) : 0) +
    (assets.nonRegisteredUse ? v(assets.nonRegistered) : 0) + (assets.tfsaUse ? v(assets.tfsa) : 0) + v(assets.other);
  const subtotalE = calcE(form.primaryAssets);
  const subtotalF = calcE(form.spouseAssets);
  const primaryNeed = Math.max(0, subtotalA + subtotalB + subtotalC - subtotalE);
  const spouseNeed  = Math.max(0, subtotalA + subtotalB + subtotalD - subtotalF);
  const primaryNet  = Math.max(0, primaryNeed - v(form.primaryExistingCoverage));
  const spouseNet   = Math.max(0, spouseNeed  - v(form.spouseExistingCoverage));
  const calc = { subtotalA, subtotalB, subtotalC, subtotalD, subtotalE, subtotalF, primaryNeed, spouseNeed, primaryNet, spouseNet, primaryYears, spouseYears };

  const updateLiabilities = (key: keyof WorksheetForm["liabilities"], val: string) =>
    setForm(f => ({ ...f, liabilities: { ...f.liabilities, [key]: val } }));
  const updateLegacy = (key: keyof WorksheetForm["legacy"], val: string) =>
    setForm(f => ({ ...f, legacy: { ...f.legacy, [key]: val } }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewingId) {
      api.patch(`/api/crm/insurance/${viewingId}`, {
        worksheetData: { ...form, calc },
        primaryName: form.primaryName,
        primaryAge: form.primaryAge ? parseInt(form.primaryAge) : null,
        spouseName: form.spouseName,
        spouseAge: form.spouseAge ? parseInt(form.spouseAge) : null,
        annualIncome: form.primaryAnnualIncome,
        spouseAnnualIncome: form.spouseAnnualIncome,
      }).then(() => {
        setShowWorksheet(false);
        setForm(defaultWs);
        setViewingId(null);
        queryClient.invalidateQueries({ queryKey: ["/api/crm/clients/:clientId/insurance-analyses", clientId] });
      });
    } else {
      createWorksheet.mutate({ clientId, data: { ...form, calc } }, {
        onSuccess: () => { setShowWorksheet(false); setForm(defaultWs); setViewingId(null); },
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">{t.insurance.needsAnalysis}</h2>
        <button onClick={() => {
           console.log("policies at click:", policies.length, "sum:", policies.filter((p:any) => ["Life","Term Life","Whole Life","Universal Life"].includes(p.type) && p.insured==="primary").reduce((s:number,p:any)=>s+parseFloat(p.coverageAmount||"0"),0));
           setForm({ ...defaultWs, ...buildDefaultFromNW(), primaryName: client ? `${client.firstName} ${client.lastName}` : "", primaryAge: client?.dateOfBirth ? String(new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()) : "", primaryAnnualIncome: client?.annualIncome ? String(client.annualIncome) : "", spouseName: client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "", spouseAge: client?.spouseDateOfBirth ? String(new Date().getFullYear() - new Date(client.spouseDateOfBirth).getFullYear()) : "", spouseAnnualIncome: client?.spouseFirstName && client?.spouseAnnualIncome ? String(client.spouseAnnualIncome) : "" }); setViewingId(null); setShowWorksheet(true); }}
          data-testid="button-fp-add-insurance"
          className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>{t.insurance.recordAnalysis}</span>
        </button>
      </div>

      {(analyses as any[]).map((a) => (
        <div key={a.id} className="border border-border rounded-2xl p-6" data-testid={`card-fp-insurance-${a.id}`}>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-bold">{a.primaryName || (isFr ? "Analyse des besoins familiaux" : "Family Needs Analysis")}</h3>
              <p className="text-xs text-muted-foreground">{isFr ? "Créé" : "Created"} {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { if (a.worksheetData) { setForm({ ...defaultWs, ...a.worksheetData }); } else { setForm({ ...defaultWs, primaryName: a.primaryName ?? "", primaryAge: a.primaryAge ? String(a.primaryAge) : "", spouseName: a.spouseName ?? "", spouseAge: a.spouseAge ? String(a.spouseAge) : "" }); } setViewingId(a.id); setShowWorksheet(true); }} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Open"><Eye className="w-4 h-4" /></button>
              <button onClick={async () => {  const res = await fetch(`/api/crm/reports/${clientId}/fna/${a.id}`, { headers: {} }); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title={isFr ? "Rapport" : "Report"}><Printer className="w-4 h-4" /></button>
              <button onClick={() => { if (confirm(isFr ? "Supprimer cette analyse?" : "Delete this analysis?")) deleteAnalysis.mutate(a.id); }} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title={isFr ? "Supprimer" : "Delete"}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div className="grid grid-cols-2 gap-4 mt-2">
              {(() => {
                const ws = (a.worksheetData ?? {}) as any;
                const calc = ws.calc ?? {};
                const pNet = Math.max(0, parseFloat(calc.primaryNet ?? ws.primaryNeed ?? "0"));
                const sNet = Math.max(0, parseFloat(calc.spouseNet ?? ws.spouseNeed ?? "0"));
                const items = [
                  { label: `${a.primaryName || "Primary"} - Life Need`, val: pNet },
                  ...(a.spouseName ? [{ label: `${a.spouseName} - Life Need`, val: sNet }] : []),
                  { label: isFr ? "Besoin AI" : "DI Need", val: parseFloat(a.recommendedDisabilityCoverage || "0") },
                  { label: isFr ? "Besoin SLD" : "LTC Need", val: parseFloat(a.criticalIllnessLumpSum || "0") },
                ];
                return items.map(item => (
                  <div key={item.label} className="p-1.5 bg-muted/30 rounded-lg flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className={`text-sm font-bold ${item.val > 0 ? "text-red-600" : "text-green-600"}`}>{fmt$(item.val)}</p>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      ))}

      {analyses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl" data-testid="empty-insurance">
          {isFr ? "Aucune analyse d'assurance. Créez une fiche d'analyse des besoins familiaux." : "No insurance analyses yet. Create a Family Needs Analysis worksheet."}
        </div>
      )}
      
      {showWorksheet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-background z-10 px-8 pt-6 pb-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-display font-bold" data-testid="text-worksheet-title">{t.insurance.familyNeedsAnalysis}</h2>
                  <p className="text-sm text-muted-foreground mt-1">{isFr ? "Remplissez toutes les sections pour calculer le besoin total en assurance-vie" : "Complete all sections to calculate total life insurance need"}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{isFr ? "Besoin net — assuré principal" : "Primary Net Need"}</p>
                    <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-primary-net">{fmt$(calc.primaryNet)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{isFr ? "Besoin net — conjoint(e)" : "Spouse Net Need"}</p>
                    <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-spouse-net">{fmt$(calc.spouseNet)}</p>
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-8" data-testid="form-fp-insurance-worksheet">
              <section>
                <div className="flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">{isFr ? "Informations client" : "Client Information"}</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">{isFr ? "Assuré principal" : "Primary Insured"}</p>
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Nom complet" : "Full Name"}</label><input type="text" required value={form.primaryName} onChange={e => setForm(f => ({ ...f, primaryName: e.target.value }))} data-testid="input-ws-primary-name" className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WorksheetFieldImpl label={isFr ? "Âge" : "Age"} value={form.primaryAge} onChange={v => setForm(f => ({ ...f, primaryAge: v }))} testId="input-ws-primary-age" prefix="" />
                      <WorksheetFieldImpl label={isFr ? "Revenu annuel" : "Annual Income"} value={form.primaryAnnualIncome} onChange={v => setForm(f => ({ ...f, primaryAnnualIncome: v }))} testId="input-ws-primary-income" />
                    </div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">{t.common.spouse}</p>
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Nom complet" : "Full Name"}</label><input type="text" value={form.spouseName} onChange={e => setForm(f => ({ ...f, spouseName: e.target.value }))} data-testid="input-ws-spouse-name" className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WorksheetFieldImpl label={isFr ? "Âge" : "Age"} value={form.spouseAge} onChange={v => setForm(f => ({ ...f, spouseAge: v }))} testId="input-ws-spouse-age" prefix="" />
                      <WorksheetFieldImpl label={isFr ? "Revenu annuel" : "Annual Income"} value={form.spouseAnnualIncome} onChange={v => setForm(f => ({ ...f, spouseAnnualIncome: v }))} testId="input-ws-spouse-income" />
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-500" /><h3 className="font-display font-bold text-lg">{isFr ? "Passifs du ménage" : "Household Liabilities"}</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">{isFr ? "Sous-total (A)" : "Subtotal (A)"}</span><p className="font-bold text-red-600" data-testid="text-ws-subtotal-a">{fmt$(calc.subtotalA)}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <WorksheetFieldImpl label={isFr ? "Solde hypothécaire" : "Mortgage Balance"} value={form.liabilities.mortgageBalance} onChange={v => updateLiabilities("mortgageBalance")} testId="input-ws-mortgage" />
                  <WorksheetFieldImpl label={isFr ? "Prêts auto" : "Car Loans"} value={form.liabilities.carLoans} onChange={v => updateLiabilities("carLoans")} testId="input-ws-car-loans" />
                  <WorksheetFieldImpl label={isFr ? "Marges de crédit" : "Lines of Credit"} value={form.liabilities.linesOfCredit} onChange={v => updateLiabilities("linesOfCredit")} testId="input-ws-loc" />
                  <WorksheetFieldImpl label={isFr ? "Cartes de crédit" : "Credit Cards"} value={form.liabilities.creditCards} onChange={v => updateLiabilities("creditCards")} testId="input-ws-credit-cards" />
                  <WorksheetFieldImpl label={isFr ? "Frais finaux" : "Final Expenses"} value={form.liabilities.finalExpenses} onChange={v => updateLiabilities("finalExpenses")} testId="input-ws-final-expenses" />
                  <WorksheetFieldImpl label={isFr ? "Fonds d'urgence" : "Emergency Fund"} value={form.liabilities.emergencyFund} onChange={v => updateLiabilities("emergencyFund")} testId="input-ws-emergency" />
                </div>
              </section>
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /><h3 className="font-display font-bold text-lg">{isFr ? "Besoins et désirs en héritage" : "Legacy Needs & Wants"}</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">{isFr ? "Sous-total (B)" : "Subtotal (B)"}</span><p className="font-bold text-amber-600">{fmt$(calc.subtotalB)}</p></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <WorksheetFieldImpl label="Education Fund" value={form.legacy.educationFund} onChange={v => updateLegacy("educationFund")} testId="input-ws-edu" />
                  <WorksheetFieldImpl label="Legacy Fund for Children" value={form.legacy.legacyFundForChildren} onChange={v => updateLegacy("legacyFundForChildren")} testId="input-ws-legacy" />
                  <WorksheetFieldImpl label="Charitable Bequest" value={form.legacy.charitableBequest} onChange={v => updateLegacy("charitableBequest")} testId="input-ws-charity" />
                  <WorksheetFieldImpl label="Other" value={form.legacy.other} onChange={v => updateLegacy("other")} testId="input-ws-legacy-other" />
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-violet-500" /><h3 className="font-display font-bold text-lg">{isFr ? "Besoin de remplacement du revenu familial" : "Family Income Replacement Need"}</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (C)</p><p className="font-bold text-violet-600">{fmt$(calc.subtotalC)}</p></div>
                    <WorksheetFieldImpl label={isFr ? "% remplacement du revenu" : "Income Replacement %"} value={form.primaryIncome.replacementPct} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, replacementPct: v } }))} testId="input-ws-primary-rep-pct" prefix="%" />
                    <WorksheetFieldImpl label={isFr ? "Prestation de survivant RPC/RRQ ($/mois)" : "CPP/QPP Survivor Benefit ($/mo)"} value={form.primaryIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, cppSurvivorBenefit: v } }))} testId="input-ws-primary-cpp" />
                    <WorksheetFieldImpl label={isFr ? "Âge cible (revenu requis jusqu'à)" : "Target Age (Income Needed To)"} value={form.primaryIncome.targetAge} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, targetAge: v } }))} testId="input-ws-primary-target-age" prefix="" />
                    <p className="text-xs text-muted-foreground">{isFr ? `Années de revenu : ${calc.primaryYears}` : `Years of income: ${calc.primaryYears}`}</p>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (D)</p><p className="font-bold text-violet-600">{fmt$(calc.subtotalD)}</p></div>
                    <WorksheetFieldImpl label={isFr ? "% remplacement du revenu" : "Income Replacement %"} value={form.spouseIncome.replacementPct} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, replacementPct: v } }))} testId="input-ws-spouse-rep-pct" prefix="%" />
                    <WorksheetFieldImpl label={isFr ? "Prestation de survivant RPC/RRQ ($/mois)" : "CPP/QPP Survivor Benefit ($/mo)"} value={form.spouseIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, cppSurvivorBenefit: v } }))} testId="input-ws-spouse-cpp" />
                    <WorksheetFieldImpl label={isFr ? "Âge cible (revenu requis jusqu'à)" : "Target Age (Income Needed To)"} value={form.spouseIncome.targetAge} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, targetAge: v } }))} testId="input-ws-spouse-target-age" prefix="" />
                    <p className="text-xs text-muted-foreground">{isFr ? `Années de revenu : ${calc.spouseYears}` : `Years of income: ${calc.spouseYears}`}</p>
                  </div>
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4"><PiggyBank className="w-5 h-5 text-green-500" /><h3 className="font-display font-bold text-lg">{isFr ? "Actifs financiers disponibles" : "Financial Assets Available"}</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (E)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalE)}</p></div>
                    <WorksheetFieldImpl label={isFr ? "Épargne liquide" : "Liquid Savings"} value={form.primaryAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, liquidSavings: v } }))} testId="input-ws-primary-liquid" />
                    <AssetRowImpl label={isFr ? "REER" : "RRSPs"} value={form.primaryAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrsps: v } }))} useIt={form.primaryAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrspsUse: !f.primaryAssets.rrspsUse } }))} testId="primary-rrsp" />
                    <AssetRowImpl label={isFr ? "Non enregistré" : "Non-Registered"} value={form.primaryAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegistered: v } }))} useIt={form.primaryAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegisteredUse: !f.primaryAssets.nonRegisteredUse } }))} testId="primary-nonreg" />
                    <AssetRowImpl label={isFr ? "CELI" : "TFSA"} value={form.primaryAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsa: v } }))} useIt={form.primaryAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsaUse: !f.primaryAssets.tfsaUse } }))} testId="primary-tfsa" />
                    <WorksheetFieldImpl label="Other" value={form.primaryAssets.other} onChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, other: v } }))} testId="input-ws-primary-other-asset" />
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (F)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalF)}</p></div>
                    <WorksheetFieldImpl label={isFr ? "Épargne liquide" : "Liquid Savings"} value={form.spouseAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, liquidSavings: v } }))} testId="input-ws-spouse-liquid" />
                    <AssetRowImpl label={isFr ? "REER" : "RRSPs"} value={form.spouseAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrsps: v } }))} useIt={form.spouseAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrspsUse: !f.spouseAssets.rrspsUse } }))} testId="spouse-rrsp" />
                    <AssetRowImpl label={isFr ? "Non enregistré" : "Non-Registered"} value={form.spouseAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegistered: v } }))} useIt={form.spouseAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegisteredUse: !f.spouseAssets.nonRegisteredUse } }))} testId="spouse-nonreg" />
                    <AssetRowImpl label={isFr ? "CELI" : "TFSA"} value={form.spouseAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsaUse: !f.spouseAssets.tfsaUse } }))} useIt={form.spouseAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsaUse: !f.spouseAssets.tfsaUse } }))} testId="spouse-tfsa" />
                    <WorksheetFieldImpl label="Other" value={form.spouseAssets.other} onChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, other: v } }))} testId="input-ws-spouse-other-asset" />
                  </div>
                </div>
              </section>

              <section className="border-2 border-primary/20 rounded-2xl p-6 bg-primary/5">
                <div className="flex items-center gap-2 mb-4"><Shield className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">{isFr ? "Besoin total en assurance-vie" : "Total Life Insurance Need"}</h3></div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm font-semibold mb-2">{isFr ? "Principal : A + B + C - E" : "Primary: A + B + C - E"}</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-ws-primary-total">{fmt$(calc.primaryNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WorksheetFieldImpl label={isFr ? "Couverture vie existante" : "Existing Life Coverage"} value={form.primaryExistingCoverage} onChange={v => setForm(f => ({ ...f, primaryExistingCoverage: v }))} testId="input-ws-primary-existing" />
                      <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-primary-net-need">{isFr ? "Besoin net" : "Net Need"}: {fmt$(calc.primaryNet)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">{isFr ? "Conjoint : A + B + D - F" : "Spouse: A + B + D - F"}</p>
                    <p className="text-2xl font-bold mt-2" data-testid="text-ws-spouse-total">{fmt$(calc.spouseNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WorksheetFieldImpl label={isFr ? "Couverture vie existante" : "Existing Life Coverage"} value={form.spouseExistingCoverage} onChange={v => setForm(f => ({ ...f, spouseExistingCoverage: v }))} testId="input-ws-spouse-existing" />
                      <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`} data-testid="text-ws-spouse-net-need">{isFr ? "Besoin net" : "Net Need"}: {fmt$(calc.spouseNet)}</p>
                    </div>
                  </div>
                </div>
              </section>
              <section>
                <div className="flex items-center gap-2 mb-4"><FileSignature className="w-5 h-5 text-gray-500" /><h3 className="font-display font-bold text-lg">{isFr ? "Décision et reconnaissance" : "Decision & Acknowledgement"}</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">Primary</p>
                    <WorksheetFieldImpl label={isFr ? "Montant de couverture souscrit" : "Coverage Amount Purchased"} value={form.primaryCoveragePurchased} onChange={v => setForm(f => ({ ...f, primaryCoveragePurchased: v }))} testId="input-ws-primary-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Manque reconnu" : "Acknowledged Shortfall"}</label>
                    <p className="text-sm font-bold text-red-600 mt-1">{fmt$(Math.max(0, calc.primaryNet - v(form.primaryCoveragePurchased)))}</p></div>
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Signature (nom en lettres moulées)" : "Signature (Printed Name)"}</label><input type="text" value={form.primarySignature} onChange={e => setForm(f => ({ ...f, primarySignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">{isFr ? "Conjoint(e)" : "Spouse"}</p>
                    <WorksheetFieldImpl label={isFr ? "Montant de couverture souscrit" : "Coverage Amount Purchased"} value={form.spouseCoveragePurchased} onChange={v => setForm(f => ({ ...f, spouseCoveragePurchased: v }))} testId="input-ws-spouse-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Manque reconnu" : "Acknowledged Shortfall"}</label>
                    <p className="text-sm font-bold text-red-600 mt-1">{fmt$(Math.max(0, calc.spouseNet - v(form.spouseCoveragePurchased)))}</p></div>
                    <div><label className="text-xs font-medium text-muted-foreground">{isFr ? "Signature (nom en lettres moulées)" : "Signature (Printed Name)"}</label><input type="text" value={form.spouseSignature} onChange={e => setForm(f => ({ ...f, spouseSignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 mt-4">
                  <div><label className="text-xs font-medium text-muted-foreground">Date</label><input type="date" value={form.signatureDate} onChange={e => setForm(f => ({ ...f, signatureDate: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                </div>
                <div className="mt-4"><label className="text-xs font-medium text-muted-foreground">{isFr ? "Notes de réunion" : "Meeting Notes"}</label><textarea value={form.meetingNotes} onChange={e => setForm(f => ({ ...f, meetingNotes: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
              </section>

              <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t border-border flex justify-between items-center">
                <div className="flex items-center gap-2">
                  {viewingId && (
                    <button type="button"
                      onClick={async () => {  const res = await fetch(`/api/crm/reports/${clientId}/fna/${viewingId}`, { headers: {} }); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold border border-border hover:bg-muted text-sm">
                      <Printer className="w-4 h-4" /> {isFr ? "Rapport" : "Report"}
                    </button>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowWorksheet(false)} data-testid="button-ws-cancel" className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">{t.common.cancel}</button>
                  <button type="submit" disabled={createWorksheet.isPending} data-testid="button-ws-save" className="px-8 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    {createWorksheet.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />{t.common.saving}</> : viewingId ? t.common.updateAnalysis2 : t.common.saveAnalysis2}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESP Tab ──────────────────────────────────────────────────────────────────

function RESPTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { isFrench: isFr, t } = useLanguage();
  const { data: savings = [] } = useEducationSavings(clientId);
  const { data: simResults = [] } = useSimulationResults(planId);
  const createSaving = useCreateEducationSaving();
  const deleteSaving = useDeleteEducationSaving(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ childName: "", childAge: "", targetAge: "18", currentBalance: "0", monthlyContribution: "0", expectedReturn: "5", estimatedCost: "80000", accountType: "RESP", notes: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createSaving.mutate({ clientId, data: { childName: form.childName, childAge: parseInt(form.childAge), targetAge: parseInt(form.targetAge), currentBalance: form.currentBalance, monthlyContribution: form.monthlyContribution, expectedReturn: form.expectedReturn, estimatedCost: form.estimatedCost, accountType: form.accountType, notes: form.notes || undefined } },
      { onSuccess: () => { setShowAdd(false); setForm({ childName: "", childAge: "", targetAge: "18", currentBalance: "0", monthlyContribution: "0", expectedReturn: "5", estimatedCost: "80000", accountType: "RESP", notes: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">{isFr ? "Épargne-études (REEE)" : "Education Savings (RESP)"}</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-resp" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>{isFr ? "Ajouter un plan" : "Add Plan"}</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(savings as any[]).map(s => {
          const yearsLeft = Math.max(0, s.targetAge - s.childAge);
          const bal = parseFloat(s.currentBalance);
          const monthly = parseFloat(s.monthlyContribution);
          const rate = parseFloat(s.expectedReturn) / 100 / 12;
          const months = yearsLeft * 12;
          const projected = months > 0 ? bal * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate) : bal;
          const gap = parseFloat(s.estimatedCost) - projected;
          return (
            <div key={s.id} className="border border-border rounded-2xl p-6" data-testid={`card-fp-resp-${s.id}`}>
              <div className="flex justify-between items-start">
                <div><h3 className="text-lg font-bold">{s.childName}</h3><p className="text-sm text-muted-foreground">Age {s.childAge} | {s.accountType} | Target: Age {s.targetAge}</p></div>
                <button onClick={() => { if (confirm("Delete?")) deleteSaving.mutate(s.id); }} data-testid={`button-fp-del-resp-${s.id}`} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><p className="text-xs text-muted-foreground uppercase">{isFr ? "Solde actuel" : "Current Balance"}</p><p className="text-lg font-bold text-primary">{fmt$(bal)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">{isFr ? "Contribution mensuelle" : "Monthly Contribution"}</p><p className="text-lg font-bold">{fmt$(monthly)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">{isFr ? "Projeté à la cible" : "Projected at Target"}</p><p className="text-lg font-bold text-violet-600">{fmt$(Math.round(projected))}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">{isFr ? "Écart / Surplus" : "Gap / Surplus"}</p><p className={`text-lg font-bold ${gap > 0 ? "text-red-600" : "text-green-600"}`}>{gap > 0 ? "-" : "+"}{fmt$(Math.abs(Math.round(gap)))}</p></div>
              </div>
              {s.notes && <p className="mt-4 text-sm text-muted-foreground bg-muted/30 p-3 rounded-xl">{s.notes}</p>}
            </div>
          );
        })}
      </div>
      {savings.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">{isFr ? "Aucun plan d'épargne-études." : "No education savings plans yet."}</div>}
      <ModuleScenarioPreview planId={planId} module="education" />
      <RespFundingGauge results={simResults} savings={savings as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display font-bold mb-6">{isFr ? "Ajouter un plan d'épargne-études" : "Add Education Savings Plan"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-resp">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold">{t.netWorth.childName}</label><input required value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} data-testid="input-fp-resp-name" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{isFr ? "Type de compte" : "Account Type"}</label><select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} data-testid="select-fp-resp-type" className="w-full px-3 py-2 rounded-xl border mt-1"><option value="RESP">RESP</option><option value="RDSP">RDSP</option><option value="Other">Other</option></select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">{t.common.age}</label><input type="number" required value={form.childAge} onChange={e => setForm({ ...form, childAge: e.target.value })} data-testid="input-fp-resp-age" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{isFr ? "Âge cible" : "Target Age"}</label><input type="number" required value={form.targetAge} onChange={e => setForm({ ...form, targetAge: e.target.value })} data-testid="input-fp-resp-target" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{isFr ? "Rendement (%)" : "Return (%)"}</label><input type="number" step="0.1" required value={form.expectedReturn} onChange={e => setForm({ ...form, expectedReturn: e.target.value })} data-testid="input-fp-resp-return" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">{isFr ? "Solde ($)" : "Balance ($)"}</label><input type="number" required value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: e.target.value })} data-testid="input-fp-resp-balance" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{isFr ? "Mensuel ($)" : "Monthly ($)"}</label><input type="number" required value={form.monthlyContribution} onChange={e => setForm({ ...form, monthlyContribution: e.target.value })} data-testid="input-fp-resp-monthly" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{isFr ? "Coût estimé ($)" : "Est. Cost ($)"}</label><input type="number" required value={form.estimatedCost} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} data-testid="input-fp-resp-cost" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div><label className="text-sm font-semibold">{t.common.notes}</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} data-testid="input-fp-resp-notes" className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[80px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">{t.common.cancel}</button>
                <button type="submit" disabled={createSaving.isPending} data-testid="button-fp-submit-resp" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createSaving.isPending ? t.common.adding : (isFr ? "Ajouter un plan" : "Add Plan")}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Debt Tab ──────────────────────────────────────────────────────────────────

function DebtTab({ clientId, planId }: { clientId: number; planId: number | null }) {
  const { isFrench: isFr, t } = useLanguage();
  const { data: debts = [] } = useDebtEntries(clientId);
  const createDebt = useCreateDebtEntry();
  const deleteDebt = useDeleteDebtEntry(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Credit Card", balance: "", interestRate: "", minimumPayment: "", term: "", notes: "" });
  const categories = ["Mortgage", "Car Loan", "Student Loan", "Credit Card", "Personal Loan", "Line of Credit", "Other"];
  const totalDebt = (debts as any[]).reduce((s, d) => s + parseFloat(d.balance || "0"), 0);
  const avgRate = debts.length > 0 ? (debts as any[]).reduce((s, d) => s + parseFloat(d.interestRate || "0"), 0) / debts.length : 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDebt.mutate({ clientId, data: { name: form.name, category: form.category, balance: form.balance, interestRate: form.interestRate, minimumPayment: form.minimumPayment || "0", term: form.term || undefined, notes: form.notes || undefined } },
      { onSuccess: () => { setShowAdd(false); setForm({ name: "", category: "Credit Card", balance: "", interestRate: "", minimumPayment: "", term: "", notes: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">{t.debt.title}</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-debt" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>{t.debt.addDebt}</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50" data-testid="fp-total-debt"><p className="text-xs font-semibold text-red-500 uppercase tracking-wider">{t.debt.totalDebt}</p><p className="text-2xl font-bold text-red-600 mt-1">{fmt$(totalDebt)}</p></div>
        <div className="border border-border rounded-2xl p-5" data-testid="fp-debt-accounts"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{isFr ? "Comptes" : "Accounts"}</p><p className="text-2xl font-bold mt-1">{debts.length}</p></div>
        <div className="border border-orange-200 rounded-2xl p-5 bg-orange-50/50" data-testid="fp-avg-rate"><p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">{isFr ? "Taux d'intérêt moyen" : "Avg Interest Rate"}</p><p className="text-2xl font-bold text-orange-700 mt-1">{avgRate.toFixed(1)}%</p></div>
      </div>
      <div className="border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            <th className="text-left px-4 py-3 font-semibold">{t.debt.colName}</th>
            <th className="text-left px-4 py-3 font-semibold">{t.debt.colType}</th>
            <th className="text-right px-4 py-3 font-semibold">{t.debt.colBalance}</th>
            <th className="text-right px-4 py-3 font-semibold">{t.debt.colRate}</th>
            <th className="text-right px-4 py-3 font-semibold">{t.debt.colMinPayment}</th>
            <th className="text-center px-4 py-3 font-semibold">{isFr ? "Actions" : "Actions"}</th>
          </tr></thead>
          <tbody>
            {(debts as any[]).map(d => (
              <tr key={d.id} className="border-t hover:bg-muted/30" data-testid={`row-fp-debt-${d.id}`}>
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.category}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt$(parseFloat(d.balance))}</td>
                <td className="px-4 py-3 text-right">{parseFloat(d.interestRate).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{fmt$(parseFloat(d.minimumPayment))}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { if (confirm("Delete?")) deleteDebt.mutate(d.id); }} data-testid={`button-fp-del-debt-${d.id}`} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {debts.length === 0 && <div className="text-center py-12 text-muted-foreground">{t.debt.noDebtsYet}</div>}
      </div>
      <ModuleScenarioPreview planId={planId} module="debt" />
      <DebtPayoffTimeline debts={debts as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">{isFr ? "Ajouter une dette" : "Add Debt Account"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-debt">
              <div><label className="text-sm font-semibold">{t.common.name}</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="input-fp-debt-name" className="w-full px-3 py-2 rounded-xl border mt-1" placeholder="e.g. TD Visa" /></div>
              <div><label className="text-sm font-semibold">{t.common.category}</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-debt-cat" className="w-full px-3 py-2 rounded-xl border mt-1">{categories.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">{t.debt.colBalance}</label><input type="number" step="0.01" required value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} data-testid="input-fp-debt-balance" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{t.debt.colRate}</label><input type="number" step="0.01" required value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} data-testid="input-fp-debt-rate" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">{t.debt.colMinPayment}</label><input type="number" step="0.01" value={form.minimumPayment} onChange={e => setForm({ ...form, minimumPayment: e.target.value })} data-testid="input-fp-debt-min" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">{t.common.cancel}</button>
                <button type="submit" disabled={createDebt.isPending} data-testid="button-fp-submit-debt" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createDebt.isPending ? t.common.adding : t.debt.addDebt}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
// ── Tax Tab (complete rework — engine-backed) ─────────────────────────────────

// ============================================================================
// TAX TAB - FIXED VERSION WITH ALL WORKING PANELS
// ============================================================================
// This replaces the broken TaxTab and panel components in FinancialPlanning.tsx
// Key fixes:
// 1. Proper state management for results
// 2. Correct mutation calling pattern
// 3. Complete form handling
// ============================================================================

import type {
  } from "@/hooks/use-plans";

// -- Type definitions --------------------------------------------------------

type TaxSubTab = "notes" | "rrsp" | "tfsa" | "projection" | "capgains" | "splitting";

// taxSubTabs is now built inside TaxTab to support i18n (see below)

// PANEL: Tax Planning Notes
// ============================================================================

function TaxNotesPanel({ clientId }: { clientId: number }) {
  const { isFrench: isFr, t } = useLanguage();
  const { data: notes = [] } = useTaxPlanningNotes(clientId);
  const createNote = useCreateTaxPlanningNote();
  const deleteNote = useDeleteTaxPlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    taxYear: String(new Date().getFullYear()),
    category: "General",
    title: "",
    content: "",
  });

  const categories = [
    "General",
    "RRSP Optimization",
    "TFSA Strategy",
    "Income Splitting",
    "Capital Gains",
    "Tax Loss Harvesting",
    "Charitable Donations",
    "Corporate Tax",
    "Other",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNote.mutate(
      {
        clientId,
        data: {
          taxYear: parseInt(form.taxYear),
          category: form.category,
          title: form.title,
          content: form.content,
        },
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          setForm({ taxYear: String(new Date().getFullYear()), category: "General", title: "", content: "" });
        },
      }
    );
  };

  const grouped = (notes as any[]).reduce((acc, n) => {
    if (!acc[n.taxYear]) acc[n.taxYear] = [];
    acc[n.taxYear].push(n);
    return acc;
  }, {} as Record<number, any[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/90"
        >
          <Plus className="w-4 h-4" />
          <span>{t.common.addNote}</span>
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleSubmit} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold">{isFr ? "Année fiscale" : "Tax Year"}</label>
              <input
                type="number"
                value={form.taxYear}
                onChange={(e) => setForm((f) => ({ ...f, taxYear: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border mt-1 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-semibold">{t.common.category}</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border mt-1 text-sm"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">{isFr ? "Titre" : "Title"}</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mt-1 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-sm font-semibold">{t.taxEstate.content}</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border mt-1 text-sm resize-none"
              rows={4}
              required
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
              {createNote.isPending ? t.common.saving : t.common.saveNote}
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-sm font-semibold"
            >
              {t.common.cancel}
            </button>
          </div>
        </form>
      )}

      <div className="space-y-6">
        {Object.entries(grouped)
          .sort(([a], [b]) => Number(b) - Number(a))
          .map(([year, yearNotes]) => (
            <div key={year}>
              <h3 className="text-lg font-bold mb-3">{isFr ? `Année fiscale ${year}` : `${year} Tax Year`}</h3>
              <div className="grid gap-4">
                {(yearNotes as any[]).map((note: any) => (
                  <div key={note.id} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow group">
                    <div className="flex justify-between items-start">
                      <span className="text-xs font-semibold text-purple-600 uppercase bg-purple-50 px-2 py-1 rounded-lg">
                        {note.category}
                      </span>
                      <button
                        onClick={() => {
                          if (confirm(isFr ? "Supprimer cette note?" : "Delete this note?")) deleteNote.mutate(note.id);
                        }}
                        className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <h4 className="font-semibold mt-3">{note.title}</h4>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>

      {notes.length === 0 && !showAdd && (
        <p className="text-center text-muted-foreground py-8">{isFr ? "Aucune note de planification fiscale." : "No tax planning notes yet."}</p>
      )}
    </div>
  );
}

// ============================================================================
// PANEL: RRSP Room Calculator
// ============================================================================

function RrspRoomPanel({ clientId, prefill, person = "primary", primaryLabel = "Primary", spouseLabel = "Spouse" }: {
  clientId: number; prefill?: any; person?: string; primaryLabel?: string; spouseLabel?: string;
}) {
  const { isFrench: isFr, t } = useLanguage();
  const owner = person === "spouse" ? "spouse" : "primary";
  const personLabel = person === "spouse" ? spouseLabel : primaryLabel;
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    label: "", priorYearEarnedIncome: "", pensionAdjustment: "0",
    carryForwardRoom: "0", contributionsMadeThisYear: "0",
    marginalTaxRate: "0.435", yearsToProject: "10",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/crm/tax/client/${clientId}/analyses?type=rrsp`);
      setAnalyses(data.filter((a: any) => a.owner === owner));
    } catch { setAnalyses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId, owner]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      label: `RRSP Analysis ${new Date().getFullYear()} — ${personLabel}`,
      priorYearEarnedIncome: prefill?.priorYearEarnedIncome ?? "",
      pensionAdjustment: "0", carryForwardRoom: "0",
      contributionsMadeThisYear: "0", marginalTaxRate: "0.435", yearsToProject: "10",
    });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? "", ...a.inputData });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "label") continue;
        input[k] = Number(v);
      }
      const result = await api.post(`/api/crm/tax/${clientId}/rrsp-room`, input);
      const payload = { type: "rrsp", owner, label: form.label, inputData: form, resultData: result };
      if (editingId) await api.patch(`/api/crm/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/crm/tax/client/${clientId}/analyses`, payload);
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm(isFr ? "Supprimer cette analyse?" : "Delete this analysis?")) return;
    await api.delete(`/api/crm/tax/tax-analyses/${id}`);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 p-4 bg-violet-50 border border-violet-200 rounded-xl text-sm text-violet-800">
          <strong>{isFr ? "Suivi des droits REER" : "RRSP Room Tracker"}</strong> — {isFr ? "Calcule les droits de cotisation disponibles selon la formule ARC 18% avec report." : "Calculates available contribution room using the CRA 18% formula with carry-forward."}
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" /> {isFr ? "Nouvelle analyse" : "New Analysis"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isFr ? `${editingId ? "Modifier" : "Nouvelle"} analyse REER — ${personLabel}` : `${editingId ? "Edit" : "New"} RRSP Analysis — ${personLabel}`}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Étiquette" : "Label"}</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [isFr ? "Revenu gagné l'an dernier ($)" : "Prior Year Earned Income ($)", "priorYearEarnedIncome"],
                  [isFr ? "Facteur d'équivalence ($)" : "Pension Adjustment ($)", "pensionAdjustment"],
                  [isFr ? "Droits inutilisés ($)" : "Carry-Forward Room ($)", "carryForwardRoom"],
                  [isFr ? "Cotisations cette année ($)" : "Contributions This Year ($)", "contributionsMadeThisYear"],
                  [isFr ? "Taux marginal (ex. 0,435)" : "Marginal Tax Rate (e.g. 0.435)", "marginalTaxRate"],
                  [isFr ? "Années à projeter" : "Years to Project", "yearsToProject"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                    <input type="number" step="any" value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">{t.common.cancel}</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving : (isFr ? "Calculer et enregistrer" : "Calculate & Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">{t.common.loading}</div>
      : analyses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 font-semibold">{isFr ? `Aucune analyse REER pour ${personLabel}` : `No RRSP analyses yet for ${personLabel}`}</p>
          <p className="text-sm text-gray-400 mt-1">{isFr ? "Cliquez sur Nouvelle analyse pour calculer les droits de cotisation" : "Click New Analysis to calculate contribution room"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a: any) => {
            const r = a.resultData;
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{a.label || (isFr ? "Analyse REER" : "RRSP Analysis")}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString("en-CA")}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {r && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: isFr ? "Droits disponibles" : "Available Room", value: r.summary?.totalAvailableRoom, color: "blue" },
                      { label: isFr ? "Économies d'impôt" : "Tax Savings", value: r.marginalTaxSavings, color: "green" },
                      { label: isFr ? "Annuel pour rattraper" : "Annual to Catch Up", value: r.catchUpStrategy?.annualContributionNeeded, color: "amber" },
                      { label: isFr ? "Remboursement / an" : "Refund / Year", value: r.catchUpStrategy?.projectedRefundPerYear, color: "purple" },
                    ].map(c => (
                      <div key={c.label} className={`bg-${c.color}-50 rounded-xl p-3`}>
                        <p className={`text-[10px] font-bold text-${c.color}-600 uppercase`}>{c.label}</p>
                        <p className={`text-lg font-bold text-${c.color}-700`}>${Math.round(c.value ?? 0).toLocaleString("en-CA")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PANEL: TFSA Room Calculator
// ============================================================================

function TfsaRoomPanel({ clientId, prefill, person = "primary", primaryLabel = "Primary", spouseLabel = "Spouse" }: {
  clientId: number; prefill?: any; person?: string; primaryLabel?: string; spouseLabel?: string;
}) {
  const { isFrench: isFr, t } = useLanguage();
  const owner = person === "spouse" ? "spouse" : "primary";
  const personLabel = person === "spouse" ? spouseLabel : primaryLabel;
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm] = useState({
    label: "", birthYear: "", priorYearClosingRoom: "0",
    contributionsMadeThisYear: "0", withdrawalsLastYear: "0",
    currentTfsaBalance: "0", annualContribution: "7000", portfolioReturn: "6",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/crm/tax/client/${clientId}/analyses?type=tfsa`);
      setAnalyses(data.filter((a: any) => a.owner === owner));
    } catch { setAnalyses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId, owner]);

  const openNew = () => {
    setEditingId(null);
    const birthYear = prefill?.birthYear ?? String(new Date().getFullYear() - 35);
    setForm({
      label: `TFSA Analysis ${new Date().getFullYear()} — ${personLabel}`,
      birthYear, priorYearClosingRoom: "0", contributionsMadeThisYear: "0",
      withdrawalsLastYear: "0", currentTfsaBalance: prefill?.tfsaBalance ?? "0",
      annualContribution: "7000", portfolioReturn: "6",
    });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? "", ...a.inputData });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "label") continue;
        input[k] = k === "portfolioReturn" ? Number(v) / 100 : Number(v);
      }
      const result = await api.post(`/api/crm/tax/${clientId}/tfsa-room`, input);
      const payload = { type: "tfsa", owner, label: form.label, inputData: form, resultData: result };
      if (editingId) await api.patch(`/api/crm/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/crm/tax/client/${clientId}/analyses`, payload);
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm(isFr ? "Supprimer cette analyse?" : "Delete this analysis?")) return;
    await api.delete(`/api/crm/tax/tax-analyses/${id}`);
    await load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 p-4 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-800">
          <strong>{isFr ? "Suivi des droits CELI" : "TFSA Room Tracker"}</strong> — {isFr ? "Calcule les droits de cotisation CELI disponibles et projette l'avantage de croissance exonérée d'impôt." : "Calculates available TFSA contribution room and projects tax-free growth advantage."}
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" /> {isFr ? "Nouvelle analyse" : "New Analysis"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isFr ? `${editingId ? "Modifier" : "Nouvelle"} analyse CELI — ${personLabel}` : `${editingId ? "Edit" : "New"} TFSA Analysis — ${personLabel}`}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Étiquette" : "Label"}</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  [isFr ? "Année de naissance" : "Birth Year", "birthYear"],
                  [isFr ? "Droits de clôture l'an dernier ($)" : "Prior Year Closing Room ($)", "priorYearClosingRoom"],
                  [isFr ? "Cotisations cette année ($)" : "Contributions This Year ($)", "contributionsMadeThisYear"],
                  [isFr ? "Retraits l'an dernier ($)" : "Withdrawals Last Year ($)", "withdrawalsLastYear"],
                  [isFr ? "Solde CELI actuel ($)" : "Current TFSA Balance ($)", "currentTfsaBalance"],
                  [isFr ? "Cotisation annuelle ($)" : "Annual Contribution ($)", "annualContribution"],
                  [isFr ? "Rendement prévu (ex. 0,06)" : "Expected Return (e.g. 0.06)", "portfolioReturn"],
                ].map(([label, key]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                    <input type="number" step="any" value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">{t.common.cancel}</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving : (isFr ? "Calculer et enregistrer" : "Calculate & Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">{t.common.loading}</div>
      : analyses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 font-semibold">{isFr ? `Aucune analyse CELI pour ${personLabel}` : `No TFSA analyses yet for ${personLabel}`}</p>
          <p className="text-sm text-gray-400 mt-1">{isFr ? "Cliquez sur Nouvelle analyse pour calculer les droits de cotisation" : "Click New Analysis to calculate contribution room"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a: any) => {
            const r = a.resultData;
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{a.label || (isFr ? "Analyse CELI" : "TFSA Analysis")}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString("en-CA")}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {r && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: isFr ? "Droits disponibles" : "Available Room", value: r.summary?.totalAvailableRoom, color: "teal" },
                      { label: isFr ? "Valeur CELI 30 ans" : "30yr TFSA Value", value: r.thirtyYearProjection?.tfsaBalanceFinal, color: "green" },
                      { label: isFr ? "Avantage CELI" : "TFSA Advantage", value: r.thirtyYearProjection?.tfsaAdvantage, color: "blue" },
                    ].map(c => (
                      <div key={c.label} className={`bg-${c.color}-50 rounded-xl p-3`}>
                        <p className={`text-[10px] font-bold text-${c.color}-600 uppercase`}>{c.label}</p>
                        <p className={`text-lg font-bold text-${c.color}-700`}>${Math.round(c.value ?? 0).toLocaleString("en-CA")}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ============================================================================
// ============================================================================
// PANEL: Tax Projection — Scenario-based redesign
// ============================================================================

function ScenarioCard({ scenario, active, onSelect }: { scenario: any; active: boolean; onSelect: () => void }) {
  return (
    <div
      onClick={onSelect}
      className={`p-4 rounded-xl border cursor-pointer transition-all flex-1 min-w-0 ${
        active ? "border-violet-500 bg-violet-50 shadow-sm" : "border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50"
      }`}
    >
      <p className="font-semibold text-sm text-slate-900 truncate">{scenario.label || "Unnamed Scenario"}</p>
      {scenario.resultData?.summary && (
        <p className="text-xs text-slate-500 mt-1">
          Tax: {`$${Math.round(scenario.resultData.summary.totalLifetimeTax / 1000)}K`}
          {" · "}
          Wealth: {`$${Math.round(scenario.resultData.summary.projectedFinalWealth / 1000)}K`}
        </p>
      )}
      {!scenario.resultData?.summary && (
        <p className="text-xs text-slate-400 mt-1">{new Date(scenario.createdAt).toLocaleDateString("en-CA")}</p>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "text-slate-900" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-white">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function AdjustPanel({ open, onClose, form, setForm, f }: { open: boolean; onClose: () => void; form: any; setForm: (f: any) => void }) {
  const { isFrench: isFr } = useLanguage();
  if (!open) return null;
  const field = (label: string, key: string, placeholder?: string) => (
    <div>
      <label className="text-xs font-semibold text-slate-500 block mb-1">{label}</label>
      <input
        value={form[key] ?? ""}
        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
      />
    </div>
  );
  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-slate-900">{isFr ? "Ajuster la stratégie" : "Adjust Strategy"}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">{isFr ? "Décaissement" : "Drawdown"}</p>
        {field(isFr ? "Âge début retrait REER" : "RRSP Withdrawal Start Age", "rrspStartAge", "e.g. 65")}
        {field(isFr ? "% décaissement CELI" : "TFSA Drawdown %", "tfsaDrawdownPct", "e.g. 50")}
        {field(isFr ? "% fractionnement" : "Income Split %", "incomeSplitPct", "e.g. 30")}
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide pt-2">{isFr ? "Revenu" : "Income"}</p>
        {field(isFr ? "Revenu d'emploi" : "Employment Income", "employmentIncome", "e.g. 120000")}
        {field(isFr ? "Revenu de pension" : "Pension Income", "pensionIncome", "e.g. 24000")}
        {field(isFr ? "Âge début RPC" : "CPP Start Age", "cppStartAge", "e.g. 65")}
        {field(isFr ? "Âge début SV" : "OAS Start Age", "oasStartAge", "e.g. 65")}
        <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide pt-2">{isFr ? "Portefeuille" : "Portfolio"}</p>
        {field(isFr ? "Solde REER" : "RRSP Balance", "rrspBalance", "e.g. 250000")}
        {field(isFr ? "Solde CELI" : "TFSA Balance", "tfsaBalance", "e.g. 80000")}
        {field(isFr ? "Solde non enregistré" : "Non-Reg Balance", "nonRegBalance", "e.g. 150000")}
        {field(isFr ? "Rendement" : "Portfolio Yield", "portfolioYield", "e.g. 0.06")}
      </div>
      <div className="p-5 border-t border-slate-100">
        <button onClick={onClose} className="w-full py-2 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">
          {isFr ? "Appliquer les modifications" : "Apply Changes"}
        </button>
      </div>
    </div>
  );
}

function TaxProjectionPanel({ clientId, prefillPrimary, prefillSpouse, person = "primary", primaryLabel = "Primary", spouseLabel = "Spouse" }: {
  clientId: number; prefillPrimary?: any; prefillSpouse?: any;
  person?: string; primaryLabel?: string; spouseLabel?: string;
}) {
  const { isFrench: isFr, t } = useLanguage();
  const owner = person === "spouse" ? "spouse" : person === "both" ? "joint" : "primary";
  const personLabel = person === "spouse" ? spouseLabel : person === "both" ? "Combined" : primaryLabel;
  const activePrefill = person === "spouse" ? prefillSpouse : prefillPrimary;
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [showTable, setShowTable] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const provinces = ["ON","BC","AB","QC","MB","SK","NS","NB","PE","NL","YT","NT","NU"];
  const [form, setForm] = useState({
    label: "", currentAge: "40", retirementAge: "65", planToAge: "90",
    province: "ON", employmentIncome: "0", selfEmploymentIncome: "0",
    otherIncome: "0", incomeGrowthRate: "0.03", rrspBalance: "0",
    rrspContributionRoom: "0", rrspAnnualContribution: "0", tfsaBalance: "0",
    tfsaContributionRoom: "0", tfsaAnnualContribution: "0", nonRegBalance: "0",
    nonRegAcb: "0", nonRegAnnualContrib: "0", portfolioYield: "0.06",
    desiredRetirementIncome: "0", pensionIncome: "0", cppStartAge: "65", oasStartAge: "65",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/crm/tax/client/${clientId}/analyses?type=projection`);
      setAnalyses(data.filter((a: any) => a.owner === owner));
    } catch { setAnalyses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId, owner]);

  const openNew = () => {
    setEditingId(null);
    const pf = activePrefill;
    setForm({
      label: `Tax Projection ${new Date().getFullYear()} — ${personLabel}`,
      currentAge: pf?.currentAge ?? "40", retirementAge: pf?.retirementAge ?? "65",
      planToAge: pf?.planToAge ?? "90", province: pf?.province ?? "ON",
      employmentIncome: pf?.employmentIncome ?? "0", selfEmploymentIncome: "0",
      otherIncome: "0", incomeGrowthRate: "0.03",
      rrspBalance: pf?.rrspBalance ?? "0", rrspContributionRoom: "0",
      rrspAnnualContribution: pf?.rrspAnnualContribution ?? "0",
      tfsaBalance: pf?.tfsaBalance ?? "0", tfsaContributionRoom: "0",
      tfsaAnnualContribution: pf?.annualTfsaContribution ?? "0",
      nonRegBalance: pf?.nonRegBalance ?? "0", nonRegAcb: "0", nonRegAnnualContrib: "0",
      portfolioYield: "0.06", desiredRetirementIncome: pf?.desiredRetirementIncome ?? "0",
      pensionIncome: "0", cppStartAge: pf?.cppStartAge ?? "65", oasStartAge: pf?.oasStartAge ?? "65",
    });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? "", ...a.inputData });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "label") continue;
        input[k] = isNaN(Number(v)) ? v : Number(v);
      }
      const result = await api.post(`/api/crm/tax/${clientId}/projection`, input);
      const payload = { type: "projection", owner, label: form.label, inputData: form, resultData: result };
      if (editingId) await api.patch(`/api/crm/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/crm/tax/client/${clientId}/analyses`, payload);
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm(isFr ? "Supprimer cette projection?" : "Delete this projection?")) return;
    await api.delete(`/api/crm/tax/tax-analyses/${id}`);
    await load();
  };

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;
  const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

  const activeAnalysis = analyses.find(a => a.id === selected) ?? analyses[0] ?? null;
  const baseAnalysis = analyses[0] ?? null;
  const compareAnalysis = analyses.length > 1 ? analyses.find(a => a.id !== baseAnalysis?.id) : null;

  return (
    <div className="space-y-5">
      {/* Header — Step 1: no purple banner */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">{isFr ? "Scénarios fiscaux" : "Tax Scenarios"}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-1.5 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 px-3 py-2 rounded-xl transition-colors"
          >
            <SlidersHorizontal className="w-4 h-4" /> {isFr ? "Ajuster la stratégie" : "Adjust Strategy"}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap">
            <Plus className="w-4 h-4" /> {isFr ? "Nouveau scénario" : "New Scenario"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isFr ? `${editingId ? "Modifier" : "Nouveau"} scénario — ${personLabel}` : `${editingId ? "Edit" : "New"} Scenario — ${personLabel}`}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Nom du scénario" : "Scenario Name"}</label>
                <input value={form.label} onChange={e => setForm((f: any) => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder={isFr ? "Ex. Plan de base, retrait optimisé..." : "e.g. Base Plan, Optimized Withdrawal..."} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { key: "currentAge", label: isFr ? "Âge actuel" : "Current Age" }, { key: "retirementAge", label: isFr ? "Âge de retraite" : "Retirement Age" },
                  { key: "planToAge", label: isFr ? "Planifier jusqu'à l'âge" : "Plan to Age" }, { key: "province", label: isFr ? "Province" : "Province", select: provinces },
                  { key: "employmentIncome", label: isFr ? "Revenu d'emploi" : "Employment Income" }, { key: "rrspBalance", label: isFr ? "Solde REER" : "RRSP Balance" },
                  { key: "tfsaBalance", label: isFr ? "Solde CELI" : "TFSA Balance" }, { key: "nonRegBalance", label: isFr ? "Solde non enregistré" : "Non-Reg Balance" },
                  { key: "rrspAnnualContribution", label: isFr ? "Cotisation annuelle REER" : "RRSP Annual Contrib" }, { key: "tfsaAnnualContribution", label: isFr ? "Cotisation annuelle CELI" : "TFSA Annual Contrib" },
                  { key: "desiredRetirementIncome", label: isFr ? "Revenu souhaité" : "Desired Income" }, { key: "pensionIncome", label: isFr ? "Revenu de pension" : "Pension Income" },
                  { key: "cppStartAge", label: isFr ? "Âge début RPC" : "CPP Start Age" }, { key: "oasStartAge", label: isFr ? "Âge début SV" : "OAS Start Age" },
                  { key: "portfolioYield", label: isFr ? "Rendement du portefeuille" : "Portfolio Yield" }, { key: "incomeGrowthRate", label: isFr ? "Taux de croissance du revenu" : "Income Growth Rate" },
                ].map(({ key, label, select }) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
                    {select ? (
                      <select value={(form as any)[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
                        {select.map(o => <option key={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input value={(form as any)[key]} onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
                        className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="p-5 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600">{t.common.cancel}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-semibold disabled:opacity-50">
                {saving ? t.common.saving : (isFr ? "Lancer la projection" : "Run Projection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-slate-400">{t.common.loading}</p>}

      {!loading && analyses.length === 0 && (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 font-medium">{isFr ? "Aucun scénario pour l'instant" : "No scenarios yet"}</p>
          <p className="text-sm text-slate-400 mt-1">{isFr ? "Créez un plan de base pour modéliser l'impôt à vie et la richesse" : "Create a Base Plan to model lifetime tax and wealth"}</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 text-sm bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700">
            + {isFr ? "Nouveau scénario" : "New Scenario"}
          </button>
        </div>
      )}

      {!loading && analyses.length > 0 && (
        <>
          {/* Step 2: Scenario selector cards */}
          <div className="flex gap-3">
            {analyses.map(a => (
              <ScenarioCard key={a.id} scenario={a} active={(selected ?? analyses[0]?.id) === a.id} onSelect={() => setSelected(a.id)} />
            ))}
            <button onClick={openNew}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-violet-600 border border-dashed border-slate-200 hover:border-violet-300 rounded-xl px-4 py-2 transition-colors whitespace-nowrap">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {/* Step 3: Metrics as decision blocks */}
          {activeAnalysis?.resultData?.summary && (() => {
            const s = activeAnalysis.resultData.summary;
            return (
              <div className="grid grid-cols-4 gap-4">
                <Metric label={isFr ? "Impôt à vie" : "Lifetime Tax"} value={fmt$(s.totalLifetimeTax)} tone="text-red-600" />
                <Metric label={isFr ? "Taux effectif" : "Effective Rate"} value={fmtPct(s.averageEffectiveRate)} tone="text-orange-600" />
                <Metric label={isFr ? "Richesse finale" : "Final Wealth"} value={fmt$(s.projectedFinalWealth)} tone="text-emerald-600" />
                <Metric label={isFr ? "Succès" : "Success"} value={fmtPct(s.successProbability)} tone="text-violet-600" />
              </div>
            );
          })()}

          {/* Step 4: Comparison layer */}
          {baseAnalysis?.resultData?.summary && compareAnalysis?.resultData?.summary && (() => {
            const b = baseAnalysis.resultData.summary;
            const o = compareAnalysis.resultData.summary;
            const taxSavings = b.totalLifetimeTax - o.totalLifetimeTax;
            const wealthDiff = o.projectedFinalWealth - b.projectedFinalWealth;
            return (
              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
                  {baseAnalysis.label} vs {compareAnalysis.label}
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <Metric label={isFr ? "Économies d'impôt" : "Tax Savings"} value={(taxSavings >= 0 ? "-" : "+") + fmt$(Math.abs(taxSavings))} tone={taxSavings >= 0 ? "text-emerald-600" : "text-red-600"} />
                  <Metric label={isFr ? "Différence de richesse" : "Wealth Difference"} value={(wealthDiff >= 0 ? "+" : "") + fmt$(wealthDiff)} tone={wealthDiff >= 0 ? "text-emerald-600" : "text-red-600"} />
                  <Metric label={isFr ? "Différence de taux" : "Rate Difference"} value={`${((b.averageEffectiveRate - o.averageEffectiveRate) * 100).toFixed(1)}pp`} tone="text-violet-600" />
                </div>
              </div>
            );
          })()}

          {/* Active scenario card with edit/delete + year-by-year toggle */}
          {activeAnalysis && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-bold text-gray-900">{activeAnalysis.label || "Scenario"}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(activeAnalysis.createdAt).toLocaleDateString("en-CA")}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(activeAnalysis)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(activeAnalysis.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {/* Step 5: Collapsible year-by-year */}
              {activeAnalysis.resultData?.projections && (
                <>
                  <button onClick={() => setShowTable(showTable === activeAnalysis.id ? null : activeAnalysis.id)}
                    className="text-xs font-semibold text-violet-600 hover:underline flex items-center gap-1">
                    {showTable === activeAnalysis.id ? (isFr ? "▲ Masquer" : "▲ Hide") : (isFr ? "▼ Afficher" : "▼ Show")} {isFr ? "Tableau annuel" : "Year-by-Year Table"}
                  </button>
                  {showTable === activeAnalysis.id && (
                    <div className="mt-3 overflow-x-auto border border-gray-200 rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            {[isFr ? "Année" : "Year", isFr ? "Âge" : "Age", "Phase", isFr ? "Revenu total" : "Total Income", isFr ? "Impôt féd." : "Fed Tax", isFr ? "Impôt prov." : "Prov Tax", isFr ? "Impôt total" : "Total Tax", isFr ? "Après impôt" : "After-Tax", isFr ? "Richesse totale" : "Total Wealth"].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(activeAnalysis.resultData.projections as any[]).map((p: any, i: number) => (
                            <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                              <td className="px-3 py-1.5">{p.year}</td>
                              <td className="px-3 py-1.5">{p.age}</td>
                              <td className="px-3 py-1.5 capitalize">{p.phase}</td>
                              <td className="px-3 py-1.5">{fmt$(p.totalGrossIncome)}</td>
                              <td className="px-3 py-1.5">{fmt$(p.federalTax)}</td>
                              <td className="px-3 py-1.5">{fmt$(p.provincialTax)}</td>
                              <td className="px-3 py-1.5">{fmt$(p.totalTax)}</td>
                              <td className="px-3 py-1.5">{fmt$(p.netIncome)}</td>
                              <td className="px-3 py-1.5 font-semibold">{fmt$(p.totalWealth)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* Step 6: Adjust Strategy side panel */}
      <AdjustPanel open={showAdjust} onClose={() => setShowAdjust(false)} form={form} setForm={setForm} />
    </div>
  );
}

// ============================================================================
// PANEL: Capital Gains Analysis
// ============================================================================

const PROVINCE_RATES: Record<string, number> = {
  ON: 53.53, BC: 53.50, AB: 48.00, QC: 53.31, MB: 50.40,
  SK: 47.50, NS: 54.00, NB: 52.50, PE: 51.37, NL: 51.30,
  YT: 48.00, NT: 47.05, NU: 44.50,
};

function CapitalGainsPanel({ clientId, person = "primary", client }: {
  clientId: number; client?: any; person?: string;
}) {
  const { isFrench: isFr, t } = useLanguage();
  const capGains = useCapitalGains(clientId);
  const owner = person === "combined" ? "joint" : person === "spouse" ? "spouse" : "primary";
  const personLabel = person === "combined" ? "Joint" : person === "spouse" ? (client?.spouseFirstName ?? "Spouse") : (client?.firstName ?? "Primary");
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const [result, setResult]     = useState<any>(null);
  const [showResult, setShowResult] = useState<number | null>(null);

  const provinces = ["ON","BC","AB","QC","MB","SK","NS","NB","PE","NL","YT","NT","NU"];
  const ASSET_TYPES = [
    { key: "stock",      label: "Stock / ETF" },
    { key: "realestate", label: "Real Estate" },
    { key: "smallbiz",   label: "Small Business Shares" },
    { key: "farmfish",   label: "Farm / Fishing Property" },
    { key: "other",      label: "Other" },
  ];
  const LCGE_TYPES = ["smallbiz", "farmfish"];
  const LCGE_LIMIT = 1250000;

  const emptyForm = () => ({
    label: `Capital Gains — ${personLabel} — ${new Date().getFullYear()}`,
    province: client?.province ?? "ON",
    marginalRate: String((PROVINCE_RATES[client?.province ?? "ON"] ?? 53.53).toFixed(2)),
    carryForwardLoss: "0",
    positions: [{ type: "stock", symbol: "", acb: "", fmv: "", lcgeEligible: false }],
  });

  const [form, setForm] = useState(emptyForm());

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/crm/tax/client/${clientId}/analyses?type=capgains`);
      setAnalyses(data.filter((a: any) => a.owner === owner));
    } catch { setAnalyses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId, owner]);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm());
    setResult(null);
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? "", ...a.inputData });
    setResult(a.resultData ?? null);
    setShowForm(true);
  };

  const addPosition = () =>
    setForm(f => ({ ...f, positions: [...f.positions, { type: "stock", symbol: "", acb: "", fmv: "", lcgeEligible: false }] }));

  const removePosition = (i: number) =>
    setForm(f => ({ ...f, positions: f.positions.filter((_, idx) => idx !== i) }));

  const updatePos = (i: number, k: string, v: unknown) =>
    setForm(f => ({
      ...f,
      positions: f.positions.map((x, idx) => {
        if (idx !== i) return x;
        const u = { ...x, [k]: v };
        if (k === "type") u.lcgeEligible = LCGE_TYPES.includes(v);
        return u;
      }),
    }));

  // Live preview
  const preview = form.positions.map(p => ({ ...p, gain: Number(p.fmv || 0) - Number(p.acb || 0) }));
  const totalGain     = preview.reduce((s, p) => s + Math.max(0, p.gain), 0);
  const totalLoss     = preview.reduce((s, p) => s + Math.abs(Math.min(0, p.gain)), 0);
  const lcgeGains     = preview.filter(p => p.lcgeEligible).reduce((s, p) => s + Math.max(0, p.gain), 0);
  const lcgeSheltered = Math.min(lcgeGains, LCGE_LIMIT);
  const netGain       = Math.max(0, totalGain - totalLoss - Number(form.carryForwardLoss || 0) - lcgeSheltered);
  const taxableGain   = netGain * 0.5;
  const estTax        = taxableGain * (Number(form.marginalRate) / 100);

  const save = async () => {
    setSaving(true);
    try {
      const input = {
        positions: form.positions.map(p => ({
          symbol: p.symbol || p.type,
          acb: Number(p.acb), fmv: Number(p.fmv),
          lcgeEligible: p.lcgeEligible,
        })),
        marginalTaxRate: Number(form.marginalRate) / 100,
        carryForwardLoss: Number(form.carryForwardLoss || 0),
        province: form.province,
      };
      const calcResult = await new Promise<any>((resolve) =>
        capGains.mutate(input, { onSuccess: resolve, onError: () => resolve(null) })
      );
      const payload = {
        type: "capgains", owner, label: form.label,
        inputData: { province: form.province, marginalRate: form.marginalRate, carryForwardLoss: form.carryForwardLoss, positions: form.positions },
        resultData: calcResult,
      };
      if (editingId) await api.patch(`/api/crm/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/crm/tax/client/${clientId}/analyses`, payload);
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm(isFr ? "Supprimer cette analyse?" : "Delete this analysis?")) return;
    await api.delete(`/api/crm/tax/tax-analyses/${id}`);
    await load();
  };

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
          <strong>{isFr ? "Analyseur de gains en capital" : "Capital Gains Analyser"}</strong> — {isFr ? "Taux d'inclusion 50% · DAPE 1,25M$ · Pertes reportées indéfiniment" : "50% inclusion rate · LCGE $1.25M · Losses carry forward indefinitely"}
          <span className="ml-2 text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">{isFr ? "Hausse du taux annulée le 21 mars 2025" : "Rate increase cancelled Mar 21, 2025"}</span>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" /> {isFr ? "Nouvelle analyse" : "New Analysis"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isFr ? `${editingId ? "Modifier" : "Nouvelle"} analyse de gains en capital — ${personLabel}` : `${editingId ? "Edit" : "New"} Capital Gains Analysis — ${personLabel}`}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Étiquette" : "Label"}</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Province" : "Province"}</label>
                  <select value={form.province}
                    onChange={e => setForm(f => ({ ...f, province: e.target.value, marginalRate: String((PROVINCE_RATES[e.target.value] ?? 53.53).toFixed(2)) }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Taux marginal (%)" : "Marginal Tax Rate (%)"}</label>
                  <input type="number" step="0.1" value={form.marginalRate}
                    onChange={e => setForm(f => ({ ...f, marginalRate: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Pertes des années précédentes ($)" : "Prior Year Losses ($)"}</label>
                  <input type="number" value={form.carryForwardLoss}
                    onChange={e => setForm(f => ({ ...f, carryForwardLoss: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
              </div>

              {/* Positions table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{isFr ? "Positions" : "Positions"}</label>
                  <button onClick={addPosition} className="flex items-center gap-1 text-xs font-semibold text-[#0c1e3a] hover:underline">
                    <Plus className="w-3.5 h-3.5" /> {isFr ? "Ajouter une position" : "Add Position"}
                  </button>
                </div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{isFr ? "Type" : "Type"}</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{isFr ? "Symbole" : "Symbol"}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">{isFr ? "PBR ($)" : "ACB ($)"}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">{isFr ? "JVM ($)" : "FMV ($)"}</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500">{isFr ? "Gain/Perte" : "Gain/Loss"}</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-gray-500">{isFr ? "DAPE" : "LCGE"}</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.positions.map((pos, i) => {
                        const gain = Number(pos.fmv || 0) - Number(pos.acb || 0);
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <select value={pos.type} onChange={e => updatePos(i, "type", e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full">
                                {ASSET_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <input value={pos.symbol} onChange={e => updatePos(i, "symbol", e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full" placeholder="e.g. XIC.TO" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={pos.acb} onChange={e => updatePos(i, "acb", e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full text-right" placeholder="0" />
                            </td>
                            <td className="px-3 py-2">
                              <input type="number" value={pos.fmv} onChange={e => updatePos(i, "fmv", e.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs w-full text-right" placeholder="0" />
                            </td>
                            <td className="px-3 py-2 text-right">
                              {(pos.acb || pos.fmv) && (
                                <span className={`text-xs font-bold ${gain >= 0 ? "text-green-600" : "text-red-600"}`}>
                                  {gain >= 0 ? "+" : "−"}${Math.abs(gain).toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input type="checkbox" checked={pos.lcgeEligible}
                                onChange={e => updatePos(i, "lcgeEligible", e.target.checked)}
                                disabled={!LCGE_TYPES.includes(pos.type)}
                                className="w-4 h-4 rounded" />
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => removePosition(i)} className="text-gray-300 hover:text-red-500">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Live preview */}
              {(totalGain > 0 || totalLoss > 0) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: isFr ? "Gains bruts" : "Gross Gains",        value: totalGain,    color: "text-green-700",  bg: "bg-green-50" },
                    { label: isFr ? "Pertes + report" : "Losses + Carry-Fwd", value: totalLoss + Number(form.carryForwardLoss || 0), color: "text-red-600", bg: "bg-red-50" },
                    { label: isFr ? "Abrité DAPE" : "LCGE Sheltered",     value: lcgeSheltered, color: "text-violet-700",  bg: "bg-violet-50" },
                    { label: isFr ? "Impôt estimé" : "Est. Tax Owing",     value: estTax,       color: "text-orange-700", bg: "bg-orange-50" },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-xl p-3`}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{c.label}</p>
                      <p className={`text-base font-bold ${c.color}`}>{fmt$(c.value)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">{t.common.cancel}</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving : (isFr ? "Calculer et enregistrer" : "Calculate & Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">{t.common.loading}</div>
      : analyses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 font-semibold">{isFr ? `Aucune analyse de gains en capital pour ${personLabel}` : `No capital gains analyses yet for ${personLabel}`}</p>
          <p className="text-sm text-gray-400 mt-1">{isFr ? "Cliquez sur Nouvelle analyse pour calculer les gains, pertes et DAPE" : "Click New Analysis to calculate gains, losses and LCGE"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a: any) => {
            const inp = a.inputData;
            const r = a.resultData;
            const positions = inp?.positions ?? [];
            const gains = positions.reduce((s: number, p: any) => s + Math.max(0, Number(p.fmv||0) - Number(p.acb||0)), 0);
            const losses = positions.reduce((s: number, p: any) => s + Math.abs(Math.min(0, Number(p.fmv||0) - Number(p.acb||0))), 0);
            const lcge = Math.min(positions.filter((p: any) => p.lcgeEligible).reduce((s: number, p: any) => s + Math.max(0, Number(p.fmv||0) - Number(p.acb||0)), 0), LCGE_LIMIT);
            const net = Math.max(0, gains - losses - Number(inp?.carryForwardLoss || 0) - lcge);
            const tax = net * 0.5 * (Number(inp?.marginalRate || 53.53) / 100);
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{a.label || (isFr ? "Analyse de gains en capital" : "Capital Gains Analysis")}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{positions.length} position{positions.length !== 1 ? "s" : ""} · {inp?.province ?? "ON"} · {new Date(a.createdAt).toLocaleDateString("en-CA")}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: isFr ? "Gains bruts" : "Gross Gains",    value: gains, color: "text-green-700",  bg: "bg-green-50" },
                    { label: isFr ? "Pertes nettes" : "Net Losses",     value: losses, color: "text-red-600",   bg: "bg-red-50" },
                    { label: isFr ? "Abrité DAPE" : "LCGE Sheltered", value: lcge,  color: "text-violet-700",   bg: "bg-violet-50" },
                    { label: isFr ? "Impôt estimé" : "Est. Tax",       value: tax,   color: "text-orange-700", bg: "bg-orange-50" },
                  ].map(c => (
                    <div key={c.label} className={`${c.bg} rounded-xl p-3`}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase">{c.label}</p>
                      <p className={`text-lg font-bold ${c.color}`}>{fmt$(c.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// PANEL: Income Splitting Optimizer
// ============================================================================

function IncomeSplittingPanel({ clientId, prefill, person = "primary", primaryLabel = "Primary", spouseLabel = "Spouse" }: {
  clientId: number; prefill?: any; person?: string; primaryLabel?: string; spouseLabel?: string;
}) {
  const { isFrench: isFr, t } = useLanguage();
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]     = useState(false);
  const provinces = ["ON","BC","AB","QC","MB","SK","NS","NB","PE","NL","YT","NT","NU"];
  const [form, setForm] = useState({
    label: "", higherIncome: "0", lowerIncome: "0",
    pensionIncome: "0", age: "65", province: "ON",
  });

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/crm/tax/client/${clientId}/analyses?type=splitting`);
      setAnalyses(data);
    } catch { setAnalyses([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [clientId]);

  const openNew = () => {
    setEditingId(null);
    setForm({
      label: `Income Splitting Analysis ${new Date().getFullYear()}`,
      higherIncome: prefill?.higherIncome ?? "0",
      lowerIncome:  prefill?.lowerIncome  ?? "0",
      pensionIncome: "0",
      age: prefill?.age ?? "65",
      province: prefill?.province ?? "ON",
    });
    setShowForm(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({ label: a.label ?? "", ...a.inputData });
    setShowForm(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const input: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (k === "label") continue;
        input[k] = isNaN(Number(v)) ? v : Number(v);
      }
      const result = await api.post(`/api/crm/tax/${clientId}/income-splitting`, input);
      const payload = { type: "splitting", owner: "joint", label: form.label, inputData: form, resultData: result };
      if (editingId) await api.patch(`/api/crm/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/crm/tax/client/${clientId}/analyses`, payload);
      setShowForm(false);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  const del = async (id: number) => {
    if (!confirm(isFr ? "Supprimer cette analyse?" : "Delete this analysis?")) return;
    await api.delete(`/api/crm/tax/tax-analyses/${id}`);
    await load();
  };

  const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800">
          <strong>{isFr ? "Optimiseur de fractionnement du revenu" : "Income Splitting Optimizer"}</strong> — {isFr ? "Trouve la meilleure stratégie : partage de pension (T1032), REER de conjoint, partage du RPC ou prêt à taux prescrit." : "Finds the best strategy: pension split (T1032), spousal RRSP, CPP sharing, or prescribed rate loan."}
        </div>
        <button onClick={openNew}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap">
          <Plus className="w-4 h-4" /> {isFr ? "Nouvelle analyse" : "New Analysis"}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{isFr ? `${editingId ? "Modifier" : "Nouvelle"} analyse de fractionnement du revenu` : `${editingId ? "Edit" : "New"} Income Splitting Analysis`}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Étiquette" : "Label"}</label>
                <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? `Revenu de ${primaryLabel} ($)` : `${primaryLabel} Income ($)`}</label>
                  <input type="number" value={form.higherIncome}
                    onChange={e => setForm(f => ({ ...f, higherIncome: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? `Revenu de ${spouseLabel} ($)` : `${spouseLabel} Income ($)`}</label>
                  <input type="number" value={form.lowerIncome}
                    onChange={e => setForm(f => ({ ...f, lowerIncome: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Revenu de pension admissible ($)" : "Eligible Pension Income ($)"}</label>
                  <input type="number" value={form.pensionIncome}
                    onChange={e => setForm(f => ({ ...f, pensionIncome: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Âge (conjoint le plus âgé)" : "Age (older spouse)"}</label>
                  <input type="number" value={form.age}
                    onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500 block mb-1">{isFr ? "Province" : "Province"}</label>
                  <select value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm">
                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">{t.common.cancel}</button>
              <button onClick={save} disabled={saving}
                className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl">
                <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving : (isFr ? "Calculer et enregistrer" : "Calculate & Save")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? <div className="text-center py-8 text-gray-400 text-sm">{t.common.loading}</div>
      : analyses.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-500 font-semibold">{isFr ? "Aucune analyse de fractionnement du revenu pour l'instant" : "No income splitting analyses yet"}</p>
          <p className="text-sm text-gray-400 mt-1">{isFr ? "Cliquez sur Nouvelle analyse pour trouver la stratégie optimale" : "Click New Analysis to find the optimal strategy"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {analyses.map((a: any) => {
            const r = a.resultData;
            return (
              <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{a.label || (isFr ? "Fractionnement du revenu" : "Income Splitting")}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleDateString("en-CA")}</p>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(a)} className="p-1.5 text-gray-300 hover:text-violet-500"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => del(a.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                {r && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      <div className="bg-indigo-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-indigo-600 uppercase">{isFr ? "Stratégie" : "Strategy"}</p>
                        <p className="text-sm font-bold text-indigo-700">{r.strategy?.replace(/_/g, " ").toUpperCase()}</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-red-600 uppercase">{isFr ? "Impôt actuel" : "Current Tax"}</p>
                        <p className="text-lg font-bold text-red-700">{fmt$(r.currentCombinedTax ?? 0)}</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-green-600 uppercase">{isFr ? "Impôt optimisé" : "Optimized Tax"}</p>
                        <p className="text-lg font-bold text-green-700">{fmt$(r.optimizedCombinedTax ?? 0)}</p>
                      </div>
                      <div className="bg-emerald-50 rounded-xl p-3">
                        <p className="text-[10px] font-bold text-emerald-600 uppercase">{isFr ? "Économies annuelles" : "Annual Savings"}</p>
                        <p className="text-lg font-bold text-emerald-700">{fmt$(r.annualTaxSavings ?? 0)}</p>
                      </div>
                    </div>
                    {r.details && (
                      <p className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">{r.details}</p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// MAIN TAX TAB COMPONENT
// ============================================================================

export function TaxTab({ clientId, person: personProp = "primary", client }: { clientId: number; client?: any; person?: string }) {
  const { isFrench: isFr, t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<TaxSubTab>("projection");
  const person = (personProp === "spouse" ? "spouse" : personProp === "combined" ? "both" : "primary") as "primary" | "spouse" | "both";
  const { data: projections = [] } = useRetirementProjections(clientId);
  const ret = (projections as any[])[0] ?? null;

  const hasSpouse = !!client?.spouseFirstName;
  const primaryLabel = client?.firstName ?? "Primary";
  const spouseLabel  = client?.spouseFirstName ?? "Spouse";
  const { data: taxNwEntries = [] } = useNetWorthEntries(clientId);

  function buildPrefill(isPrimary: boolean) {
    if (!client) return null;
    const dob    = isPrimary ? client.dateOfBirth : client.spouseDateOfBirth;
    const income = isPrimary ? Number(client.annualIncome ?? 0) : Number(client.spouseAnnualIncome ?? 0);
    const retAge = isPrimary
      ? (client.retirementAge ?? Number(ret?.retirementAge ?? 65))
      : (client.spouseRetirementAge ?? 65);
    const age       = dob ? (new Date().getFullYear() - new Date(dob).getFullYear()) : 40;
    const birthYear = dob ? new Date(dob).getFullYear() : (new Date().getFullYear() - age);
    const owner = isPrimary ? "primary" : "spouse";
    const nwTfsa = (taxNwEntries as any[])
      .filter(e => e.type === "asset" && e.category === "TFSA" &&
        (e.owner === owner || (!e.owner && isPrimary)))
      .reduce((s: number, e: any) => s + Number(e.value), 0);

    return {
      currentAge:              String(age),
      retirementAge:           String(retAge),
      planToAge:               String(Number(ret?.lifeExpectancy ?? 90)),
      province:                client.province ?? "ON",
      employmentIncome:        String(income),
      priorYearEarnedIncome:   String(income),
      rrspBalance:             isPrimary ? String(Number(ret?.rrspBalance   ?? 0)) : "0",
      tfsaBalance: nwTfsa > 0 ? String(nwTfsa) : (isPrimary ? String(Number(ret?.tfsaBalance ?? 0)) : "0"),
      nonRegBalance:           isPrimary ? String(Number(ret?.nonRegBalance ?? 0)) : "0",
      rrspAnnualContribution:  isPrimary ? String(Number(ret?.annualContribution      ?? 0)) : "0",
      annualTfsaContribution:  isPrimary ? String(Number(ret?.annualTfsaContribution  ?? 0)) : "0",
      desiredRetirementIncome: String(Number(ret?.desiredRetirementIncome ?? (isPrimary ? client.desiredRetirementIncome : client.spouseDesiredRetirementIncome) ?? 0)),
      cppStartAge:             String(ret?.cppStartAge ?? 65),
      oasStartAge:             String(ret?.oasStartAge ?? 65),
      birthYear:               String(birthYear),
      age:                     String(age),
      higherIncome:            String(Math.max(Number(client.annualIncome ?? 0), Number(client.spouseAnnualIncome ?? 0))),
      lowerIncome:             String(Math.min(Number(client.annualIncome ?? 0), Number(client.spouseAnnualIncome ?? 0))),
    };
  }

  const prefillPrimary = buildPrefill(true);
  const prefillSpouse  = buildPrefill(false);
  const activePrefill  = person === "spouse" ? prefillSpouse : prefillPrimary;

  const taxSubTabs: Array<{ key: TaxSubTab; label: string }> = [
    { key: "notes",      label: t.taxEstate.planningNotes },
    { key: "rrsp",       label: t.taxEstate.rrspRoom },
    { key: "tfsa",       label: t.taxEstate.tfsaRoom },
    { key: "projection", label: t.taxEstate.taxProjection },
    { key: "capgains",   label: t.taxEstate.capitalGains },
    { key: "splitting",  label: t.taxEstate.incomeSplitting },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 px-1">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xl font-display font-bold">{t.taxEstate.taxPlanning}</h2>
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto flex-wrap">
        {taxSubTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveSubTab(tab.key)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeSubTab === tab.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-200">
        {activeSubTab === "notes"      && <TaxNotesPanel        clientId={clientId} />}
        {activeSubTab === "rrsp"       && <RrspRoomPanel        clientId={clientId} prefill={activePrefill} person={person} primaryLabel={primaryLabel} spouseLabel={spouseLabel} />}
        {activeSubTab === "tfsa"       && <TfsaRoomPanel        clientId={clientId} prefill={activePrefill} person={person} primaryLabel={primaryLabel} spouseLabel={spouseLabel} />}
        {activeSubTab === "projection" && <TaxProjectionPanel   clientId={clientId} prefillPrimary={prefillPrimary} prefillSpouse={hasSpouse ? prefillSpouse : undefined} person={person} primaryLabel={primaryLabel} spouseLabel={spouseLabel} />}
        {activeSubTab === "capgains"   && <CapitalGainsPanel    clientId={clientId} client={client} person={person} />}
        {activeSubTab === "splitting"  && <IncomeSplittingPanel clientId={clientId} prefill={activePrefill} person={person} primaryLabel={primaryLabel} spouseLabel={spouseLabel} />}
      </div>
    </div>
  );
}



// ── Estate Tab ────────────────────────────────────────────────────────────────

export function EstateNotesTab({ clientId, planId, client }: { clientId: number; planId: number | null; client?: Record<string, unknown> }) {
  const { isFrench: isFr, t } = useLanguage();
  const { data: notes = [] } = useEstatePlanningNotes(clientId);
  const { data: assumptions = [] } = usePlanAssumptions(planId);
  const createNote = useCreateEstatePlanningNote();
  const deleteNote = useDeleteEstatePlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Will", title: "", content: "" });
  const categories = ["Will", "Power of Attorney", "Trust", "Beneficiary Designations", "Estate Tax", "Succession Planning", "Charitable Giving", "Other"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNote.mutate({ clientId, data: { category: form.category, title: form.title, content: form.content } },
      { onSuccess: () => { setShowAdd(false); setForm({ category: "Will", title: "", content: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">{t.taxEstate.estatePlanning}</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-fp-add-estate" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>{t.taxEstate.addEstateNote}</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(notes as any[]).map(n => (
          <div key={n.id} className="border border-border rounded-2xl p-6 hover:shadow-md transition-shadow group" data-testid={`card-fp-estate-${n.id}`}>
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg">{n.category}</span>
              <button onClick={() => { if (confirm("Delete?")) deleteNote.mutate(n.id); }} data-testid={`button-fp-del-estate-${n.id}`} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            <h3 className="text-lg font-bold mt-3">{n.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </div>
      {notes.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">{t.taxEstate.noEstateNotes}</div>}
      <EstateScorecard notes={notes as any[]} province={(assumptions as any[]).find(a => a.scenario === "Moderate")?.province} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">{t.taxEstate.addEstateNote}</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-fp-estate">
              <div><label className="text-sm font-semibold">{isFr ? "Catégorie" : "Category"}</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} data-testid="select-fp-estate-cat" className="w-full px-3 py-2 rounded-xl border mt-1">
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-semibold">{t.taxEstate.noteTitle}</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} data-testid="input-fp-estate-title" className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              <div><label className="text-sm font-semibold">{t.taxEstate.content}</label><textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} data-testid="input-fp-estate-content" className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[120px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">{isFr ? "Annuler" : "Cancel"}</button>
                <button type="submit" disabled={createNote.isPending} data-testid="button-fp-submit-estate" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createNote.isPending ? (isFr ? "Ajout..." : "Adding...") : t.taxEstate.addEstateNote}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Tab ────────────────────────────────────────────────────────────────────

export function AITab({ clientId }: { clientId: number }) {
  const { isFrench: isFr, t } = useLanguage();
  const qc = useQueryClient();
  const { data: recommendations = [] } = useAiRecommendations(clientId);
  const generateRecs  = useGenerateAiRecommendations();
  const updateRec     = useUpdateAiRecommendation(clientId);
  const deleteRec     = useDeleteAiRecommendation(clientId);

  // Group by runId — fall back to createdAt date for legacy recs with no runId
  const sessions = (() => {
    const groups = new Map<string, any[]>();
    for (const rec of (recommendations as any[])) {
      const key = rec.runId ?? "legacy";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([runId, recs]) => ({
        runId,
        recs,
        date: runId !== "legacy" && !isNaN(Date.parse(runId)) ? new Date(runId) : null,
      }));
  })();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Auto-expand most recent session whenever recommendations load
  const newestRunId = sessions[0]?.runId ?? null;
  useEffect(() => {
    if (newestRunId) setExpanded(prev => new Set([...prev, newestRunId]));
  }, [newestRunId]);

  const toggleExpanded = (runId: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(runId) ? next.delete(runId) : next.add(runId);
      return next;
    });

const deleteSession = async (runId: string) => {
  if (!confirm(t.taxEstate.deleteRecsSession ?? (isFr ? "Supprimer toutes les recommandations de cette session ?" : "Delete all recommendations in this session?"))) return;
  try {
    if (runId === "legacy") {
      const legacyRecs = (recommendations as any[]).filter((r: any) => !r.runId);
      await Promise.all(legacyRecs.map((r: any) =>
        api.delete(`/api/crm/ai-recommendations/${r.id}`)
      ));
    } else {
      await api.delete(`/api/crm/clients/${clientId}/ai/session/${encodeURIComponent(runId)}`);
    }
  } catch {
    // Records may already be gone — fall through to invalidate
  } finally {
    qc.invalidateQueries({ queryKey: ["/api/crm/clients/:clientId/ai-recommendations", clientId] });
    qc.refetchQueries({ queryKey: ["/api/crm/clients/:clientId/ai-recommendations", clientId] });
  }
};

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const priorityBadge = (priority: string) => {
    const colors: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-green-100 text-green-700" };
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[priority] || colors.medium}`}>{priority}</span>;
  };

  const statusIcon = (status: string) => {
    if (status === "completed")   return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    if (status === "in_progress") return <Clock       className="w-4 h-4 text-violet-500  shrink-0" />;
    if (status === "dismissed")   return <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0" />;
    return <Clock className="w-4 h-4 text-yellow-500 shrink-0" />;
  };

  const sessionSummary = (recs: any[]) => {
    const counts = { high: 0, medium: 0, low: 0, completed: 0 };
    for (const r of recs) {
      if (r.status === "completed") counts.completed++;
      else counts[r.priority as keyof typeof counts]++;
    }
    return counts;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">{t.ai.recommendations}</h2>
        <button
          onClick={() => generateRecs.mutate(clientId)}
          disabled={generateRecs.isPending}
          data-testid="button-fp-generate-ai"
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          <span>{generateRecs.isPending ? t.ai.analyzing : t.ai.generateInsights}</span>
        </button>
      </div>

      {/* Generating spinner */}
      {generateRecs.isPending && (
        <div className="border border-purple-200 rounded-2xl p-5 bg-purple-50/50 text-center">
          <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-purple-700 font-medium text-sm">{isFr ? "Analyse des données financières du client…" : "Analyzing client's financial data…"}</p>
        </div>
      )}

      {/* Empty state */}
      {sessions.length === 0 && !generateRecs.isPending && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t.ai.noRecommendations}</p>
        </div>
      )}

      {/* Session cards */}
      {sessions.map(({ runId, recs, date }) => {
        const open    = expanded.has(runId);
        const summary = sessionSummary(recs);
        const sorted  = [...recs].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
        const isLegacy = runId === "legacy" || !recs[0]?.runId;
        const dateStr = isLegacy || !date
          ? t.taxEstate.previousRecs ?? (isFr ? "Recommandations précédentes" : "Previous recommendations")
          : date.toLocaleDateString(isFr ? "fr-CA" : "en-CA", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

        return (
          <div key={runId} className="border border-border rounded-2xl overflow-hidden">
            {/* Session header — always visible, 2-3 lines high */}
            <div className="px-5 py-4 bg-muted/30 flex items-start justify-between gap-4">
              <button
                onClick={() => toggleExpanded(runId)}
                className="flex-1 min-w-0 text-left"
                data-testid={`session-header-${runId}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900">{dateStr}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span>{recs.length} {isFr ? `recommandation${recs.length !== 1 ? "s" : ""}` : `recommendation${recs.length !== 1 ? "s" : ""}`}</span>
                  {summary.high    > 0 && <span className="text-red-600 font-medium">{summary.high} {isFr ? "haute priorité" : "high priority"}</span>}
                  {summary.medium  > 0 && <span className="text-yellow-600">{summary.medium} {isFr ? "moyenne" : "medium"}</span>}
                  {summary.low     > 0 && <span className="text-green-600">{summary.low} {isFr ? "faible" : "low"}</span>}
                  {summary.completed > 0 && <span className="text-gray-400">{summary.completed} {isFr ? "complétée(s)" : "completed"}</span>}
                </div>
              </button>
              <button
                onClick={() => deleteSession(runId)}
                className="p-1.5 hover:bg-red-50 rounded-lg shrink-0 mt-0.5"
                title={t.taxEstate.deleteSession ?? (isFr ? "Supprimer cette session" : "Delete this session")}
                data-testid={`button-delete-session-${runId}`}
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>

            {/* Recommendations — shown when expanded */}
            {open && (
              <div className="divide-y divide-border/50">
                {sorted.map((rec) => (
                  <div
                    key={rec.id}
                    className={`px-5 py-4 ${rec.status === "completed" ? "bg-muted/20 opacity-70" : rec.status === "dismissed" ? "bg-muted/10 opacity-50" : ""}`}
                    data-testid={`card-fp-ai-${rec.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {statusIcon(rec.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm">{rec.title}</span>
                            {priorityBadge(rec.priority)}
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded uppercase">{rec.category}</span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">{rec.content}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {rec.status === "pending" && (
                          <>
                            <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "in_progress" } })} data-testid={`button-fp-ai-start-${rec.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 font-medium hover:bg-violet-100">{isFr ? "Démarrer" : "Start"}</button>
                            <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "dismissed" } })} data-testid={`button-fp-ai-dismiss-${rec.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/80">{isFr ? "Ignorer" : "Dismiss"}</button>
                          </>
                        )}
                        {rec.status === "in_progress" && (
                          <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "completed" } })} data-testid={`button-fp-ai-complete-${rec.id}`} className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-600 font-medium hover:bg-green-100">{isFr ? "Compléter" : "Complete"}</button>
                        )}
                        {rec.status === "completed" && (
                          <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "pending" } })} className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium hover:bg-muted/80">{isFr ? "Rouvrir" : "Reopen"}</button>
                        )}
                        <button onClick={() => { if (confirm(t.taxEstate.deleteRec ?? (isFr ? "Supprimer cette recommandation ?" : "Delete this recommendation?"))) deleteRec.mutate(rec.id); }} data-testid={`button-fp-del-ai-${rec.id}`} className="p-1 hover:bg-red-50 rounded ml-1"><Trash2 className="w-3 h-3 text-red-400" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Income Sources Tab ────────────────────────────────────────────────────────
type IncomeSource = {
  id: number; clientId: number; owner: string; sourceType: string;
  label?: string; annualAmount: string; taxability: string;
  startAge?: number; endAge?: number; indexedToInflation: boolean;
  isSurvivorBenefit: boolean; survivorPercentage?: string; notes?: string;
};

const SOURCE_TYPE_LABELS: Record<string, { en: string; fr: string }> = {
  employment:                  { en: "Employment",               fr: "Emploi" },
  self_employment:             { en: "Self-Employment",          fr: "Travail autonome" },
  rental:                      { en: "Rental Income",            fr: "Revenu locatif" },
  corporate_dividend:          { en: "Corporate Dividends",      fr: "Dividendes corporatifs" },
  cpp:                         { en: "CPP / QPP",                fr: "RPC / RRQ" },
  oas:                         { en: "OAS",                      fr: "SV" },
  defined_benefit_pension:     { en: "Defined Benefit Pension",  fr: "Retraite à prestations déterminées" },
  defined_contribution_pension:{ en: "Defined Contribution Pension", fr: "Retraite à cotisations déterminées" },
  annuity:                     { en: "Annuity",                  fr: "Rente" },
  other:                       { en: "Other",                    fr: "Autre" },
};

const TAXABILITY_LABELS: Record<string, { en: string; fr: string }> = {
  fully_taxable:       { en: "Fully Taxable",       fr: "Entièrement imposable" },
  capital_gain:        { en: "Capital Gain",         fr: "Gain en capital" },
  eligible_dividend:   { en: "Eligible Dividend",    fr: "Dividende déterminé" },
  non_eligible_dividend: { en: "Non-Eligible Dividend", fr: "Dividende non déterminé" },
  non_taxable:         { en: "Non-Taxable",          fr: "Non imposable" },
};

const OWNER_LABELS: Record<string, { en: string; fr: string }> = {
  primary: { en: "Primary",  fr: "Titulaire principal" },
  spouse:  { en: "Spouse",   fr: "Conjoint(e)" },
  joint:   { en: "Joint",    fr: "Conjoint" },
};

const EMPTY_FORM = {
  owner: "primary", sourceType: "employment", label: "", annualAmount: "",
  taxability: "fully_taxable", startAge: "", endAge: "",
  indexedToInflation: false, isSurvivorBenefit: false, survivorPercentage: "", notes: "",
};

function IncomeSourcesTab({ clientId }: { clientId?: number }) {
  const { isFrench: isFr } = useLanguage();
  const qc = useQueryClient();
  const lbl = (o: Record<string, { en: string; fr: string }>, k: string) => isFr ? (o[k]?.fr ?? k) : (o[k]?.en ?? k);

  const { data: sources = [], isLoading } = useQuery<IncomeSource[]>({
    queryKey: ["/api/crm/clients/:id/income-sources", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/income-sources`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
    enabled: !!clientId,
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const openNew = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setShowForm(true); };
  const openEdit = (s: IncomeSource) => {
    setForm({
      owner: s.owner, sourceType: s.sourceType, label: s.label ?? "",
      annualAmount: s.annualAmount, taxability: s.taxability,
      startAge: s.startAge?.toString() ?? "", endAge: s.endAge?.toString() ?? "",
      indexedToInflation: s.indexedToInflation, isSurvivorBenefit: s.isSurvivorBenefit,
      survivorPercentage: s.survivorPercentage ?? "", notes: s.notes ?? "",
    });
    setEditId(s.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!clientId || !form.annualAmount) return;
    setSaving(true);
    const body = {
      owner: form.owner, sourceType: form.sourceType,
      label: form.label || null, annualAmount: form.annualAmount,
      taxability: form.taxability,
      startAge: form.startAge ? +form.startAge : null,
      endAge: form.endAge ? +form.endAge : null,
      indexedToInflation: form.indexedToInflation,
      isSurvivorBenefit: form.isSurvivorBenefit,
      survivorPercentage: form.survivorPercentage || null,
      notes: form.notes || null,
    };
    try {
      const url = editId
        ? `/api/crm/clients/${clientId}/income-sources/${editId}`
        : `/api/crm/clients/${clientId}/income-sources`;
      const method = editId ? "PUT" : "POST";
      await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await qc.invalidateQueries({ queryKey: ["/api/crm/clients/:id/income-sources", clientId] });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!clientId) return;
    if (!confirm(isFr ? "Supprimer cette source de revenu ?" : "Delete this income source?")) return;
    await fetch(`/api/crm/clients/${clientId}/income-sources/${id}`, { method: "DELETE", credentials: "include" });
    await qc.invalidateQueries({ queryKey: ["/api/crm/clients/:id/income-sources", clientId] });
  };

  const totalPrimary = sources.filter(s => s.owner === "primary").reduce((sum, s) => sum + +s.annualAmount, 0);
  const totalSpouse  = sources.filter(s => s.owner === "spouse").reduce((sum, s) => sum + +s.annualAmount, 0);
  const totalAll     = totalPrimary + totalSpouse + sources.filter(s => s.owner === "joint").reduce((sum, s) => sum + +s.annualAmount, 0);

  const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

  if (!clientId) return <p className="text-sm text-muted-foreground p-6">{isFr ? "Sélectionnez un client." : "Select a client."}</p>;

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: isFr ? "Revenu total" : "Total Income", value: fmt(totalAll), tone: "blue" },
          { label: isFr ? "Titulaire principal" : "Primary", value: fmt(totalPrimary), tone: "emerald" },
          { label: isFr ? "Conjoint(e)" : "Spouse", value: fmt(totalSpouse), tone: "violet" },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 bg-${card.tone}-50 border-${card.tone}-200`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
            <p className="text-xl font-bold text-slate-800 mt-1">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{isFr ? "annuel brut" : "annual gross"}</p>
          </div>
        ))}
      </div>

      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">{isFr ? "Sources de revenu" : "Income Sources"}</h3>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-medium text-primary border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded-lg px-3 py-1.5 transition-colors">
          <Plus className="w-3.5 h-3.5" />{isFr ? "Ajouter" : "Add Source"}
        </button>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4"><Loader2 className="w-4 h-4 animate-spin" />{isFr ? "Chargement..." : "Loading..."}</div>
      ) : sources.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <TrendingUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{isFr ? "Aucune source de revenu. Ajoutez des revenus pour améliorer les recommandations IA." : "No income sources yet. Add sources to improve AI recommendations."}</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                {[
                  isFr ? "Source" : "Source",
                  isFr ? "Titulaire" : "Owner",
                  isFr ? "Montant annuel" : "Annual Amount",
                  isFr ? "Imposition" : "Taxability",
                  isFr ? "Période" : "Period",
                  "",
                ].map((h, i) => (
                  <th key={i} className="text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {sources.map(s => (
                <tr key={s.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.label || lbl(SOURCE_TYPE_LABELS, s.sourceType)}</p>
                    {s.label && <p className="text-xs text-muted-foreground">{lbl(SOURCE_TYPE_LABELS, s.sourceType)}</p>}
                    {s.indexedToInflation && <span className="text-[10px] text-emerald-600 font-medium">{isFr ? "Indexé" : "Indexed"}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{lbl(OWNER_LABELS, s.owner)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{fmt(+s.annualAmount)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{lbl(TAXABILITY_LABELS, s.taxability)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.startAge || s.endAge ? `${isFr ? "Âge" : "Age"} ${s.startAge ?? "—"} → ${s.endAge ?? "∞"}` : (isFr ? "En cours" : "Ongoing")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded hover:bg-muted"><Pencil className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold">{editId ? (isFr ? "Modifier la source" : "Edit Source") : (isFr ? "Ajouter une source de revenu" : "Add Income Source")}</h4>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Owner */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Titulaire" : "Owner"}</label>
              <select value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {["primary","spouse","joint"].map(o => <option key={o} value={o}>{lbl(OWNER_LABELS, o)}</option>)}
              </select>
            </div>
            {/* Source Type */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Type de revenu" : "Income Type"}</label>
              <select value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {Object.entries(SOURCE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{isFr ? v.fr : v.en}</option>)}
              </select>
            </div>
            {/* Label */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Nom personnalisé (optionnel)" : "Custom Label (optional)"}</label>
              <input type="text" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder={isFr ? "ex. Emploi chez ABC inc." : "e.g. Employment at ABC Inc."} className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            {/* Amount */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Montant annuel brut ($)" : "Annual Gross Amount ($)"}</label>
              <input type="number" min="0" value={form.annualAmount} onChange={e => setForm(f => ({ ...f, annualAmount: e.target.value }))} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            {/* Taxability */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Type d'imposition" : "Taxability"}</label>
              <select value={form.taxability} onChange={e => setForm(f => ({ ...f, taxability: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background">
                {Object.entries(TAXABILITY_LABELS).map(([k, v]) => <option key={k} value={k}>{isFr ? v.fr : v.en}</option>)}
              </select>
            </div>
            {/* Start Age */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Âge de début (vide = en cours)" : "Start Age (blank = already active)"}</label>
              <input type="number" min="18" max="100" value={form.startAge} onChange={e => setForm(f => ({ ...f, startAge: e.target.value }))} placeholder="—" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            {/* End Age */}
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Âge de fin (vide = à vie)" : "End Age (blank = lifetime)"}</label>
              <input type="number" min="18" max="120" value={form.endAge} onChange={e => setForm(f => ({ ...f, endAge: e.target.value }))} placeholder="∞" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
            </div>
            {/* Checkboxes */}
            <div className="flex items-center gap-4 col-span-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.indexedToInflation} onChange={e => setForm(f => ({ ...f, indexedToInflation: e.target.checked }))} className="rounded" />
                {isFr ? "Indexé à l'inflation" : "Indexed to inflation"}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.isSurvivorBenefit} onChange={e => setForm(f => ({ ...f, isSurvivorBenefit: e.target.checked }))} className="rounded" />
                {isFr ? "Prestation de survivant" : "Survivor benefit"}
              </label>
            </div>
            {/* Survivor % (conditional) */}
            {form.isSurvivorBenefit && (
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "% prestation de survivant" : "Survivor Benefit %"}</label>
                <input type="number" min="0" max="100" value={form.survivorPercentage} onChange={e => setForm(f => ({ ...f, survivorPercentage: e.target.value }))} placeholder="60" className="w-full border rounded-lg px-3 py-2 text-sm bg-background" />
              </div>
            )}
            {/* Notes */}
            <div className="col-span-2">
              <label className="text-xs font-medium text-muted-foreground block mb-1">{isFr ? "Notes (optionnel)" : "Notes (optional)"}</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm bg-background resize-none" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setShowForm(false)} className="text-sm px-4 py-2 rounded-lg border hover:bg-muted">{isFr ? "Annuler" : "Cancel"}</button>
            <button onClick={handleSave} disabled={saving || !form.annualAmount} className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isFr ? "Enregistrer" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* AI context hint */}
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-start gap-3">
        <Brain className="w-4 h-4 text-violet-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-violet-700">
          {isFr
            ? "Ces données sont transmises à l'IA lors de la génération de recommandations — permettant des conseils précis sur l'optimisation fiscale, le fractionnement du revenu, et le report de la RPC/SV."
            : "This data is passed to AI when generating recommendations — enabling precise advice on tax efficiency, income splitting, and CPP/OAS deferral."}
        </p>
      </div>
    </div>
  );
}

export function FinancialPlanningContent({ initialClientId, clientId: clientIdProp, noSidebar, activeTabOverride, onTabChangeOverride, t }: { initialClientId?: number; clientId?: number; noSidebar?: boolean; activeTabOverride?: string; onTabChangeOverride?: (t: any) => void }) {
  const { isFrench: isFr } = useLanguage();
  const tabs = getTabs(isFr);
  const navStructure = getNavStructure(isFr);
  const [_activeTab, _setActiveTab] = useState<TabKey>("overview");
  const activeTab = (activeTabOverride as TabKey) ?? _activeTab;
  const setActiveTab = onTabChangeOverride ?? _setActiveTab;
  const [person, setPerson] = useState<"primary"|"spouse"|"combined">("primary");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(clientIdProp ?? initialClientId ?? null);

  const { data: clients = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string }>>({
    queryKey: ["/api/crm/clients"],
  });

const { data: selectedClient } = useQuery({
    queryKey: ["client-detail", selectedClientId],
    queryFn: () => selectedClientId ? api.get(`/api/crm/clients/${selectedClientId}`) : null,
    enabled: !!selectedClientId,
});

const { data: plans = [] } = useClientPlans(selectedClientId ?? 0);
    
  const sortedPlans = [...plans].sort((a, b) => b.id - a.id);
  const activePlanId = sortedPlans.length > 0 ? sortedPlans[0].id : null;
  const { data: allFlags = [] } = usePlanStaleFlags(activePlanId);

  const unresolvedFlags = (allFlags as any[]).filter(f => !f.resolvedAt);
  const recentlyResolvedFlags = (allFlags as any[]).filter(f => {
    if (!f.resolvedAt) return false;
    return new Date(f.resolvedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  });

  const staleTabKeys = new Set(unresolvedFlags.map(f => moduleToTabMap[f.module]).filter(Boolean));
  const recalculatedTabKeys = new Set(recentlyResolvedFlags.map(f => moduleToTabMap[f.module]).filter(Boolean));

  return (
    <div className="fp-insightled flex min-h-screen" data-testid="fp-popout-container">
      <aside style={{ width: noSidebar ? "0" : "200px", minWidth: noSidebar ? "0" : "200px", minHeight: "100vh", flexShrink: 0, flexBasis: noSidebar ? "0" : "200px", display: noSidebar ? "none" : undefined, overflow: "hidden" }} className="bg-muted/30 border-r border-border flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border">
          <select
            value={selectedClientId ?? ""}
            onChange={e => setSelectedClientId(Number(e.target.value) || null)}
            data-testid="select-fp-client"
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">{isFr ? "-- Choisir un client --" : "-- Select Client --"}</option>
            {(clients as any[]).map(c => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </select>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto" data-testid="fp-sidebar-nav">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              disabled={!selectedClientId}
              data-testid={`tab-fp-${t.key}`}
              className={`flex items-center space-x-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === t.key && selectedClientId
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : selectedClientId
                    ? "text-slate-700 hover:bg-muted hover:text-slate-900"
                    : "text-slate-400 cursor-not-allowed"
              }`}
            >
              <t.icon className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{t.label}</span>
              {staleTabKeys.has(t.key) && (
                <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Data has changed — review needed" data-testid={`stale-indicator-${t.key}`} />
              )}
              {!staleTabKeys.has(t.key) && recalculatedTabKeys.has(t.key) && (
                <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-violet-500" title="Recently recalculated" data-testid={`recalculated-indicator-${t.key}`} />
              )}
            </button>
          ))}
        </nav>
      </aside>
      <div style={{ flex: 1, minWidth: 0 }} className="overflow-y-auto p-6">
        {selectedClientId && unresolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3" data-testid="stale-banner">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-medium text-amber-800">{unresolvedFlags.length} module{unresolvedFlags.length > 1 ? "s" : ""} pending recalculation</span>
              <span className="text-amber-600 ml-2">Changed: {new Date((unresolvedFlags as any)[0].createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        )}
        {selectedClientId && unresolvedFlags.length === 0 && recentlyResolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-3" data-testid="recalculated-banner">
            <CheckCircle className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <span className="text-sm font-medium text-violet-800">{recentlyResolvedFlags.length} module{recentlyResolvedFlags.length > 1 ? "s" : ""} recalculated — review updated projections</span>
          </div>
        )}

        {selectedClientId ? (
          <>
            {/* Person tabs — only shown on tabs that use primary/spouse distinction */}
            {selectedClient && ["retirement", "tax", "dashboard"].includes(activeTab) && (
              <div className="flex gap-1 mb-5 bg-muted/40 rounded-xl p-1 border border-border w-fit">
                <button onClick={() => setPerson("primary")}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "primary" ? "bg-white shadow text-[#0c1e3a] border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                  {(selectedClient as any).firstName ?? "Client"}
                </button>
                {(selectedClient as any).spouseFirstName && (
                  <button onClick={() => setPerson("spouse")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "spouse" ? "bg-white shadow text-purple-700 border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                    {(selectedClient as any).spouseFirstName}
                  </button>
                )}
                {(selectedClient as any).spouseFirstName && (
                  <button onClick={() => setPerson("combined")}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "combined" ? "bg-white shadow text-violet-700 border border-border" : "text-muted-foreground hover:text-foreground"}`}>
                    Combined
                  </button>
                )}
              </div>
            )}
            {activeTab === "profile" && selectedClientId && selectedClient && (
              <ClientProfileSection client={selectedClient as any} />
            )}
            {activeTab === "profile" && (!selectedClientId || !selectedClient) && (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">
                <UserCircle className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{isFr ? "Sélectionnez un client pour voir son profil" : "Select a client to view their profile"}</p>
              </div>
            )}
            {activeTab === "record_meeting" && selectedClientId && (
              <RecordMeetingPanel
                clientId={selectedClientId}
                clientName={`${(selectedClient as any)?.firstName ?? ""} ${(selectedClient as any)?.lastName ?? ""}`.trim()}
              />
            )}
            {activeTab === "log_activity" && selectedClientId && (
              <LogActivityPanel clientId={selectedClientId} />
            )}
            {activeTab === "past_meetings" && selectedClientId && (
              <PastMeetingsPanel clientId={selectedClientId} />
            )}
            {(activeTab === "record_meeting" || activeTab === "log_activity" || activeTab === "past_meetings") && !selectedClientId && (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">
                <Activity className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">{isFr ? "Sélectionnez un client pour voir l'activité" : "Select a client to view activity"}</p>
              </div>
            )}
            {activeTab === "overview" && selectedClientId && selectedClient && (
              <InsightLedDashboard
                clientId={selectedClientId}
                client={selectedClient as any}
                onNavigate={(tab: string) => setActiveTab(tab as TabKey)}
              />
            )}
            {activeTab === "overview" && (!selectedClientId || !selectedClient) && (
              <OverviewTab clientId={selectedClientId} onTabChange={setActiveTab} />
            )}
            {activeTab === "plan"       && <FinancialPlanTab clientId={selectedClientId} clientName={(selectedClient as any)?.firstName} />}
            {activeTab === "dashboard"  && activePlanId && <SimulationDashboard
              planId={activePlanId}
            />}
            {activeTab === "dashboard"  && !activePlanId && (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No financial plan for this client</p>
                <p className="text-sm mt-1">Create a financial plan first to access the simulation dashboard</p>
              </div>
            )}
            {activeTab === "networth"   && <MultiEntryNetWorthTab clientId={selectedClientId} client={selectedClient as any} />}
            {activeTab === "income"     && <IncomeSourcesTab     clientId={selectedClientId ?? undefined} />}
            {activeTab === "retirement" && selectedClientId && <RetirementTab clientId={selectedClientId} clientName={(selectedClient as any)?.firstName} />}
            {activeTab === "insurance"  && <InsuranceTab     clientId={selectedClientId} planId={activePlanId} client={selectedClient} />}
            {activeTab === "resp"       && <RESPTab          clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "debt"       && <DebtTab          clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "tax" && (
              <TaxTab   clientId={selectedClientId} client={selectedClient} />
            )}
            {activeTab === "estate"     && <EstateNotesTab   clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "ai"         && <AITab            clientId={selectedClientId} />}
            {activeTab === "goals"     && <GoalsTab         clientId={selectedClientId} />}
            {activeTab === "pension"   && <PensionTab       clientId={selectedClientId} />}
            {activeTab === "expenses"  && <ExpensesTab      clientId={selectedClientId} />}
            {activeTab === "meltdown"  && selectedClientId && selectedClient && (
              <MeltdownTab clientId={selectedClientId} client={selectedClient} person="combined" />
            )}
            {activeTab === "letters"   && <LettersTab       clientId={selectedClientId} client={selectedClient} />}
            {activeTab === "policies"  && <PoliciesTab      clientId={selectedClientId} client={selectedClient} />}
            {activeTab === "reports"   && <ReportsTab       clientId={selectedClientId} />}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-muted-foreground" data-testid="text-fp-heading">{isFr ? "Choisir un client" : "Select a Client"}</h2>
              <p className="text-muted-foreground mt-2">{isFr ? "Choisissez un client dans la barre latérale pour voir son plan financier." : "Choose a client from the sidebar to view their financial plan."}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancialPlanning() {
  const { isFrench: isFr } = useLanguage();
  const tabs = getTabs(isFr);
  // Office admins and advisor admins never see financial information (the server enforces it too):
  // they only get the client profile and activity tools.
  const { data: meStaff } = useCurrentStaff();
  const canSeeFinancial = !!meStaff && meStaff.role !== "office_admin" && meStaff.role !== "advisor_admin";
  const NON_FINANCIAL_KEYS = new Set<TabKey>(["profile", "record_meeting", "log_activity", "past_meetings"]);
  const navStructure = getNavStructure(isFr)
    .map(e => e.type === "group" ? { ...e, items: e.items.filter(it => canSeeFinancial || NON_FINANCIAL_KEYS.has(it.key)) } : e)
    .filter(e => e.type === "group" ? e.items.length > 0 : canSeeFinancial || NON_FINANCIAL_KEYS.has(e.key));
  const searchString = useSearch();
  const [, navigate] = useLocation();
  const routeParams = useParams<{ id?: string }>();
  const params = new URLSearchParams(searchString);
  const urlClientId = routeParams?.id
    ? Number(routeParams.id)
    : params.get("client") ? Number(params.get("client")) : null;

  const [sidebarMode, setSidebarMode] = useState<"main" | "fp">(urlClientId ? "fp" : "main");
  const [selectedId, setSelectedId]   = useState<number | null>(urlClientId);
  const [openGroup, setOpenGroup]     = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState<TabKey>("overview");
  const [clientSearch, setClientSearch] = useState("");
  const [pickerOpen, setPickerOpen]   = useState(!urlClientId);

  const { data: clients = [], isLoading } = useClients();
  useEffect(() => {
    if (meStaff && !canSeeFinancial && !NON_FINANCIAL_KEYS.has(activeTab)) setActiveTab("profile");
  }, [meStaff, canSeeFinancial, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
  const selectedClient = (clients as any[]).find((c: any) => c.id === selectedId);
  const filtered = (clients as any[]).filter((c: any) =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(clientSearch.toLowerCase())
  );

  function selectClient(id: number) {
    setSelectedId(id); setPickerOpen(false);
    setClientSearch(""); setActiveTab("overview");
    setSidebarMode("fp");
    navigate(`/financial-planning?client=${id}`, { replace: true });
  }

  function backToMainNav() {
    setSidebarMode("main");
    navigate("/financial-planning", { replace: true });
  }

  const tabBtn = (key: TabKey, labelOverride?: string) => {
    const t = tabs.find(x => x.key === key);
    if (!t) return null;
    const Icon = t.icon;
    return (
      <button key={key} onClick={() => { setActiveTab(key); setPickerOpen(false); }}
        className={`flex items-center space-x-2.5 w-full px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
          activeTab === key ? "bg-white/15 text-white font-semibold" : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
        }`}>
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{labelOverride ?? t.label}</span>
      </button>
    );
  };

  const fpNavSidebar = (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-3 pb-2 border-b border-white/10">
        {openGroup ? (
          <>
            <button onClick={() => setOpenGroup(null)}
              className="flex items-center gap-2 text-primary-foreground/60 hover:text-white text-xs mb-3 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /><span>Back</span>
            </button>
            <p className="text-sm font-semibold text-white truncate">{openGroup}</p>
          </>
        ) : (
          <>
            <button onClick={backToMainNav}
              className="flex items-center gap-2 text-primary-foreground/60 hover:text-white text-xs mb-3 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" /><span>{isFr ? "Menu principal" : "Main Menu"}</span>
            </button>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/60 mb-0.5">Client</p>
              <p className="text-sm font-semibold text-white truncate">
                {selectedClient ? `${selectedClient.firstName} ${selectedClient.lastName}` : "—"}
              </p>
            </div>
          </>
        )}
      </div>
      {selectedId && (
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {openGroup ? (
            navStructure
              .filter((e): e is Extract<NavEntry, { type: "group" }> => e.type === "group" && e.label === openGroup)
              .flatMap(g => g.items.map(it => tabBtn(it.key, it.label)))
          ) : (
            <>
              {navStructure.map((entry, i) =>
                entry.type === "item" ? (
                  tabBtn(entry.key)
                ) : (
                  <button key={`grp-${i}`} onClick={() => setOpenGroup(entry.label)}
                    className="flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium text-primary-foreground/80 hover:bg-white/10 hover:text-white transition-colors">
                    <span className="truncate">{entry.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                  </button>
                )
              )}
              {canSeeFinancial && ungroupedTabs.length > 0 && (
                <div className="pt-2 mt-2 border-t border-white/10 space-y-0.5">
                  {ungroupedTabs.map(t => tabBtn(t.key))}
                </div>
              )}
            </>
          )}
        </nav>
      )}
      {!selectedId && <p className="px-4 py-4 text-xs text-primary-foreground/50 text-center">Select a client above to begin</p>}
    </div>
  );

  return (
    <AppLayout sidebarOverride={sidebarMode === "fp" ? fpNavSidebar : undefined} noPadding={sidebarMode === "fp"}>
      {sidebarMode === "main" ? (
        <div className="-m-8 h-[calc(100%+4rem)]" style={{ margin: 0, height: "100%" }}>
          <HouseholdQueue onSelect={(id) => {
            setSelectedId(id);
            setSidebarMode("fp");
            setActiveTab("overview");
            navigate(`/financial-planning?client=${id}`, { replace: true });
          }} />
        </div>
      ) : (
        <FinancialPlanningContent
          key={selectedId ?? "none"}
          initialClientId={selectedId ?? undefined}
          activeTabOverride={activeTab}
          onTabChangeOverride={setActiveTab}
          noSidebar
        />
      )}
    </AppLayout>
  );
}
