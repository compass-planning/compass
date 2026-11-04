/**
 * FinancialPlanning.tsx — Compass CRM port (complete, drop-in)
 *
 * Changes from Planning Suite original:
 *  1. `api` helper defined locally using credentials:"include" instead of fp_token
 *  2. All `localStorage.getItem("fp_token")` fetch calls replaced with credentials:"include"
 *  3. `/api/clients` query uses credentials:"include" (BE's company-scoped endpoint)
 *  4. selectedClient fetched with the local api helper
 *  5. All @/ import paths already correct for Compass CRM
 *  6. Tax panel API calls use BE routes (api.post → /api/tax/...)
 */

import { useQueryClient } from "@tanstack/react-query";
import React, { useState, useMemo, useEffect, useRef, Component, type ReactNode } from "react";
import { PieChart, Pie, Cell, Tooltip } from "recharts";
import { InlineEdit } from "@/components/ui/InlineEdit";

class ErrorBoundary extends Component<{children:ReactNode;fallback?:ReactNode},{error:boolean}> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? (this.props.fallback ?? null) : this.props.children; }
}

import { useQuery } from "@tanstack/react-query";
import { RetirementTab } from "@/components/planning/RetirementProjectionForm";
import {
  useClientPlans, useNetWorthEntries, useCreateNetWorthEntry, useDeleteNetWorthEntry, useUpdateNetWorthEntry,
  useRetirementProjections, useCreateRetirementProjection, useDeleteRetirementProjection,
  useInsuranceAnalyses, useCreateInsuranceWorksheet,
  useEducationSavings, useCreateEducationSaving, useDeleteEducationSaving,
  useDebtEntries, useCreateDebtEntry, useDeleteDebtEntry,
  useTaxPlanningNotes, useCreateTaxPlanningNote, useDeleteTaxPlanningNote,
  useEstatePlanningNotes, useCreateEstatePlanningNote, useDeleteEstatePlanningNote,
  useAiRecommendations, useGenerateAiRecommendations, useUpdateAiRecommendation, useDeleteAiRecommendation,
  useFinancialPlanningOverview, useAvailableReports,
  usePlanStaleFlags, useSimulationResults, usePlanAssumptions,
  useCapitalGains,
} from "@/hooks/use-plans";
import { SimulationDashboard } from "@/components/planning/SimulationDashboard";
import {
  CppOasTimingView, InsuranceMethodComparison,
  RespFundingGauge, EstateScorecard, DebtPayoffTimeline,
} from "@/components/planning/ModuleViews";
import { FinancialPlanTab } from "@/components/planning/FinancialPlanTab";
import {
  Target, DollarSign, PiggyBank, Shield, GraduationCap, CreditCard,
  Receipt, ScrollText, Brain, Plus, Trash2, Sparkles, TrendingUp, TrendingDown,
  AlertTriangle, CheckCircle, Clock, FileText, Printer, Loader2, BarChart3,
  Users, Calculator, ChevronDown, ChevronUp, Info, Download, Eye, Gift, FileSignature,
  Pencil, Save, X,
} from "lucide-react";

// ── Local api helper — BE uses cookie auth, not bearer tokens ─────────────────
const api = {
  get: <T = any>(url: string): Promise<T> =>
    fetch(url, { credentials: "include" }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  post: <T = any>(url: string, data?: unknown): Promise<T> =>
    fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  patch: <T = any>(url: string, data?: unknown): Promise<T> =>
    fetch(url, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: data ? JSON.stringify(data) : undefined }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
  delete: <T = any>(url: string): Promise<T> =>
    fetch(url, { method: "DELETE", credentials: "include" }).then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); }),
};

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabKey = "overview" | "dashboard" | "networth" | "retirement" | "insurance" | "resp" | "debt" | "tax" | "estate" | "ai" | "plan";

const tabs: { key: TabKey; label: string; icon: typeof Target }[] = [
  { key: "overview",    label: "Overview",       icon: Target },
  { key: "plan",        label: "Financial Plan", icon: Sparkles },
  { key: "dashboard",   label: "Dashboard",      icon: BarChart3 },
  { key: "networth",    label: "Net Worth",      icon: DollarSign },
  { key: "retirement",  label: "Retirement",     icon: PiggyBank },
  { key: "insurance",   label: "Insurance",      icon: Shield },
  { key: "resp",        label: "RESP",           icon: GraduationCap },
  { key: "debt",        label: "Debt",           icon: CreditCard },
  { key: "tax",         label: "Tax",            icon: Receipt },
  { key: "estate",      label: "Estate",         icon: ScrollText },
  { key: "ai",          label: "AI Insights",    icon: Brain },
];

const moduleToTabMap: Record<string, TabKey> = {
  retirement: "retirement", insurance: "insurance", education: "resp",
  estate: "estate", debt: "debt", tax: "tax", cashflow: "overview",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n: number): string {
  return `$${Math.abs(n).toLocaleString("en-CA", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Report helper — BE: cookie auth ──────────────────────────────────────────

async function openReport(clientId: number, type: "comprehensive" | "retirement" | "insurance" | "net-worth") {
  const res = await fetch(`/api/reports/${clientId}/${type}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to generate report");
  const html = await res.text();
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(html);
  win.document.close();
}

// ── Overview Tab ──────────────────────────────────────────────────────────────

function OverviewTab({ clientId, onTabChange }: { clientId: number; onTabChange?: (t: TabKey) => void }) {
  const { data: overview, isLoading } = useFinancialPlanningOverview(clientId);
  const { data: reports } = useAvailableReports(clientId);
  const [generatingReport, setGeneratingReport] = useState<string | null>(null);

  const handleReport = async (type: "comprehensive" | "retirement" | "insurance" | "net-worth") => {
    setGeneratingReport(type);
    try { await openReport(clientId, type as any); }
    catch (err) { console.error("Report error:", err); }
    finally { setGeneratingReport(null); }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading overview...</div>;
  if (!overview) return null;

  const cards = [
    { label: "Net Worth",          value: `$${Number((overview as any).netWorth).toLocaleString()}`,        icon: DollarSign,   color: (overview as any).netWorth >= 0 ? "text-green-600" : "text-red-600",   bg: (overview as any).netWorth >= 0 ? "bg-green-50" : "bg-red-50" },
    { label: "Total Assets",       value: `$${Number((overview as any).totalAssets).toLocaleString()}`,      icon: TrendingUp,   color: "text-green-600", bg: "bg-green-50" },
    { label: "Total Liabilities",  value: `$${Number((overview as any).totalLiabilities).toLocaleString()}`, icon: TrendingDown,  color: "text-red-500",   bg: "bg-red-50" },
    { label: "Total Debt",         value: `$${Number((overview as any).totalDebt).toLocaleString()}`,        icon: CreditCard,   color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Financial Goals",    value: (overview as any).goals,                 icon: Target,        color: "text-primary",    bg: "bg-primary/5",   tab: "dashboard" as TabKey },
    { label: "Retirement Plans",   value: (overview as any).retirementProjections, icon: PiggyBank,     color: "text-blue-600",   bg: "bg-blue-50",     tab: "retirement" as TabKey },
    { label: "Insurance Analyses", value: (overview as any).insuranceAnalyses,     icon: Shield,        color: "text-purple-600", bg: "bg-purple-50",   tab: "insurance" as TabKey },
    { label: "Education Plans",    value: (overview as any).educationPlans,        icon: GraduationCap, color: "text-teal-600",   bg: "bg-teal-50",     tab: "resp" as TabKey },
    { label: "Tax Notes",          value: (overview as any).taxNotes,              icon: Receipt,       color: "text-amber-600",  bg: "bg-amber-50",    tab: "tax" as TabKey },
    { label: "Estate Notes",       value: (overview as any).estateNotes,           icon: ScrollText,    color: "text-indigo-600", bg: "bg-indigo-50",   tab: "estate" as TabKey },
    { label: "AI Recommendations", value: (overview as any).aiRecommendations,     icon: Brain,         color: "text-pink-600",   bg: "bg-pink-50",     tab: "ai" as TabKey },
    { label: "Pending Actions",    value: (overview as any).pendingRecommendations, icon: Clock,         color: "text-yellow-600", bg: "bg-yellow-50",   tab: "ai" as TabKey },
  ];

  const reportButtons = [
    { type: "comprehensive", label: "Full Plan",   available: true,                   icon: FileText },
    { type: "retirement",    label: "Retirement",  available: !!reports?.retirement,  icon: PiggyBank },
    { type: "insurance",     label: "Insurance",   available: !!reports?.insurance,   icon: Shield },
    { type: "net-worth",     label: "Net Worth",   available: !!reports?.netWorth,    icon: DollarSign },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-display font-bold">Financial Planning Overview</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {reportButtons.map(btn => (
            <button key={btn.type} onClick={() => handleReport(btn.type as any)} disabled={!btn.available || generatingReport === btn.type}
              className="flex items-center space-x-1.5 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {generatingReport === btn.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <btn.icon className="w-3.5 h-3.5" />}
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
          {item.owner && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded mt-0.5 inline-block">{item.owner}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <div className={`text-sm font-semibold ${isAsset ? "text-emerald-600" : "text-red-500"}`} onClick={e => e.stopPropagation()}>
          <InlineEdit value={val.toFixed(0)} type="number" onSave={v => onUpdate(item.id, { value: v })}
            format={v => `${isAsset ? "" : "−"}${fmtVal(Number(v))}`} inputClassName="w-28 text-right" />
        </div>
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
          <button onClick={() => onDelete(item.id)} className="p-1 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function NetWorthSection({ title, total, color, isAsset, children, onAdd }: { title: string; total: number; color: string; isAsset: boolean; children: React.ReactNode; onAdd: () => void }) {
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
          <button onClick={e => { e.stopPropagation(); onAdd(); }} className="w-full px-5 py-2 text-xs text-blue-600 hover:bg-blue-50 text-left transition-colors border-t border-slate-50">
            + Add to {title}
          </button>
        </div>
      )}
    </div>
  );
}

export function NetWorthTab({ clientId }: { clientId: number }) {
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

  const assetGroups = assetCats.map(cat => ({ cat, items: assets.filter((e: any) => e.category === cat), total: 0 }))
    .map(g => ({ ...g, total: g.items.reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0) }))
    .filter(g => g.items.length > 0);
  const liabGroups = liabilityCats.map(cat => ({ cat, items: liabilities.filter((e: any) => e.category === cat), total: 0 }))
    .map(g => ({ ...g, total: g.items.reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0) }))
    .filter(g => g.items.length > 0);
  const pieData = assetGroups.map(g => ({ name: g.cat.split(" ")[0], full: g.cat, value: Math.round(g.total) })).filter(d => d.value > 0);

  function openAdd(type: "asset" | "liability", cat = "") {
    setAddType(type); setPresetCat(cat);
    setForm({ category: cat, name: "", value: "" });
    setShowAdd(true);
  }

  // BE: cookie auth — no fp_token needed
  const handleAdd = async () => {
    try {
      const res = await fetch(`/api/clients/${clientId}/net-worth`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: addType, category: form.category, name: form.name, value: form.value })
      });
      if (res.ok) { setShowAdd(false); setForm({ category: "", name: "", value: "" }); }
      else { const d = await res.json(); alert("Error: " + d.message); }
    } catch(e: any) { alert("Failed: " + e.message); }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Net Worth</h1>
          <p className="text-sm text-slate-500">{entries.length} entr{entries.length !== 1 ? "ies" : "y"}</p>
        </div>
        <button onClick={() => openAdd("asset")} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
          <Plus className="w-4 h-4" /> Add Entry
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className={`bg-white border-2 rounded-xl p-5 ${netWorth >= 0 ? "border-blue-200 bg-blue-50/30" : "border-red-200 bg-red-50/30"}`}>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Worth</p>
          <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? "text-blue-600" : "text-red-600"}`}>{fmtBig(netWorth)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Assets</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{fmtBig(totalAssets)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-500 mt-1">{fmtBig(totalLiabilities)}</p>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
          <p className="text-slate-500 font-semibold">No entries yet</p>
          <button onClick={() => openAdd("asset")} className="mt-3 text-blue-600 text-sm hover:underline">Add your first asset</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {assetGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assets</p>
                {assetGroups.map(({ cat, items, total }) => (
                  <NetWorthSection key={cat} title={cat} total={total} color={NW_CAT_COLORS[cat] ?? "#94a3b8"} isAsset onAdd={() => openAdd("asset", cat)}>
                    {items.map((e: any) => (
                      <NetWorthItem key={e.id} item={e} onUpdate={(id, data) => updateEntry.mutate({ id, data })} onDelete={id => { if (confirm("Delete?")) deleteEntry.mutate(id); }} />
                    ))}
                  </NetWorthSection>
                ))}
              </div>
            )}
            {liabGroups.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Liabilities</p>
                {liabGroups.map(({ cat, items, total }) => (
                  <NetWorthSection key={cat} title={cat} total={total} color={NW_CAT_COLORS[cat] ?? "#94a3b8"} isAsset={false} onAdd={() => openAdd("liability", cat)}>
                    {items.map((e: any) => (
                      <NetWorthItem key={e.id} item={e} onUpdate={(id, data) => updateEntry.mutate({ id, data })} onDelete={id => { if (confirm("Delete?")) deleteEntry.mutate(id); }} />
                    ))}
                  </NetWorthSection>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Asset Allocation</p>
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
              ) : <p className="text-xs text-slate-400 text-center py-8">Add assets to see allocation</p>}
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Quick Add</p>
              {["Real Estate", "Registered Investments (RRSP/TFSA)", "Liquid Assets"].map(cat => (
                <button key={cat} onClick={() => openAdd("asset", cat)} className="w-full text-left text-xs text-slate-600 hover:text-blue-600 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition">+ {cat.split(" ")[0]}</button>
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
            <h2 className="text-lg font-bold mb-5 text-slate-900">Add {addType === "asset" ? "Asset" : "Liability"}</h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddType("asset")} className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${addType === "asset" ? "bg-emerald-100 text-emerald-700 border-2 border-emerald-300" : "bg-slate-100 text-slate-500"}`}>Asset</button>
                <button type="button" onClick={() => setAddType("liability")} className={`flex-1 py-2 rounded-xl font-semibold text-sm transition ${addType === "liability" ? "bg-red-100 text-red-600 border-2 border-red-300" : "bg-slate-100 text-slate-500"}`}>Liability</button>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">Category</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                  <option value="">-- Select --</option>
                  {(addType === "asset" ? assetCats : liabilityCats).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">Description</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-600 block mb-1">Value ($)</label>
                <input type="number" step="0.01" required value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowAdd(false)} className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:bg-slate-100">Cancel</button>
              <button onClick={handleAdd} disabled={createEntry.isPending || !form.category || !form.name || !form.value}
                className="px-5 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-md disabled:opacity-50 transition">
                {createEntry.isPending ? "Adding…" : "Add Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Scenario preview helper ────────────────────────────────────────────────────

function ModuleScenarioPreview({ planId, module }: { planId: number | null; module: string }) {
  const { data: simResults = [] } = useSimulationResults(planId);
  const moduleResults = (simResults as any[]).filter((r: any) => r.module === module);
  if (moduleResults.length === 0) return null;
  return (
    <div className="border border-border rounded-2xl p-4">
      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Monte Carlo Results</p>
      <div className="grid grid-cols-3 gap-3">
        {moduleResults.slice(0, 3).map((r: any) => {
          const pctVal = Math.round(Number(r.successRate) * 100);
          const color = pctVal >= 80 ? "text-green-600 bg-green-50 border-green-200" : pctVal >= 60 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : "text-red-600 bg-red-50 border-red-200";
          return (
            <div key={r.scenario} className={`border rounded-xl p-3 text-center ${color}`}>
              <p className="text-xs font-semibold opacity-70">{r.scenario}</p>
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

type WorksheetForm = {
  primaryName: string; primaryAge: string; primaryAnnualIncome: string;
  spouseName: string; spouseAge: string; spouseAnnualIncome: string; familyMembers: string;
  liabilities: { mortgageBalance: string; carLoans: string; linesOfCredit: string; creditCards: string; finalExpenses: string; emergencyFund: string };
  legacy: { educationFund: string; legacyFundForChildren: string; charitableBequest: string; other: string };
  primaryIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  spouseIncome: { replacementPct: string; cppSurvivorBenefit: string; targetAge: string };
  primaryAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  spouseAssets: { liquidSavings: string; rrsps: string; rrspsUse: boolean; nonRegistered: string; nonRegisteredUse: boolean; tfsa: string; tfsaUse: boolean; other: string };
  primaryExistingCoverage: string; spouseExistingCoverage: string;
  primaryCoveragePurchased: string; spouseCoveragePurchased: string;
  primaryShortfallAcknowledged: string; spouseShortfallAcknowledged: string;
  primarySignature: string; spouseSignature: string; signatureDate: string; meetingNotes: string;
};

function WField({ label, value, onChange, testId, prefix = "$" }: { label: string; value: string; onChange: (v: string) => void; testId: string; prefix?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="flex mt-1">
        {prefix && <span className="flex items-center px-3 bg-muted border border-r-0 rounded-l-lg text-sm font-medium">{prefix}</span>}
        <input type="number" value={value} onChange={e => onChange(e.target.value)} data-testid={testId}
          className={`flex-1 px-3 py-2 border text-sm bg-background ${prefix ? "rounded-r-lg" : "rounded-lg"}`} placeholder="0" />
      </div>
    </div>
  );
}

function ARow({ label, value, onValueChange, useIt, onToggle, testId }: { label: string; value: string; onValueChange: (v: string) => void; useIt?: boolean; onToggle?: () => void; testId: string }) {
  return (
    <div className="flex items-center gap-2">
      {onToggle !== undefined && <input type="checkbox" checked={useIt} onChange={onToggle} className="rounded" />}
      <div className="flex-1"><WField label={label} value={value} onChange={onValueChange} testId={`input-${testId}`} /></div>
    </div>
  );
}

export function InsuranceTab({ clientId, planId, client }: { clientId: number; planId: number | null; client?: any }) {
  const { data: analyses = [] } = useInsuranceAnalyses(clientId);
  const { data: nwEntries = [] } = useNetWorthEntries(clientId);
  const [policies, setPolicies] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>(`/api/clients/${clientId}/policies`).then(setPolicies).catch(() => {}); }, [clientId]);
  const createWorksheet = useCreateInsuranceWorksheet();
  const qc = useQueryClient();
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
    primarySignature: "", spouseSignature: "", signatureDate: "", meetingNotes: "",
  };
  const [form, setForm] = useState<WorksheetForm>(defaultWs);

  function buildDefaultFromNW() {
    const sum = (type: string, category: string, owner?: string) =>
      (nwEntries as any[]).filter((e: any) => e.type === type && e.category === category && (!owner || e.owner === owner))
               .reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0);
    const policySum = (insured: string) =>
      policies.filter((p: any) => p.insured === insured && ["Life","Term Life","Whole Life","Universal Life"].includes(p.type))
              .reduce((s: number, p: any) => s + parseFloat(p.coverageAmount || "0"), 0);
    return {
      liabilities: { mortgageBalance: String(sum("liability","Mortgage")), carLoans: String(sum("liability","Car Loan")), linesOfCredit: String(sum("liability","Line of Credit")), creditCards: String(sum("liability","Credit Card")), finalExpenses: "15000", emergencyFund: "0" },
      primaryAssets: { liquidSavings: String(sum("asset","Cash/Bank","primary")), rrsps: String(sum("asset","RRSP","primary")), rrspsUse: true, nonRegistered: String(sum("asset","Non-Registered","primary")), nonRegisteredUse: true, tfsa: String(sum("asset","TFSA","primary")), tfsaUse: true, other: "0" },
      spouseAssets: { liquidSavings: String(sum("asset","Cash/Bank","spouse")), rrsps: String(sum("asset","RRSP","spouse")), rrspsUse: true, nonRegistered: String(sum("asset","Non-Registered","spouse")), nonRegisteredUse: true, tfsa: String(sum("asset","TFSA","spouse")), tfsaUse: true, other: "0" },
      primaryExistingCoverage: String(policySum("primary")),
      spouseExistingCoverage: String(policySum("spouse")),
    };
  }

  const v = (s: string) => parseFloat(s) || 0;
  const subtotalA = Object.values(form.liabilities).reduce((s, val) => s + v(val), 0);
  const subtotalB = Object.values(form.legacy).reduce((s, val) => s + v(val), 0);
  const primaryYears = form.primaryAge ? Math.max(0, v(form.primaryIncome.targetAge) - v(form.primaryAge)) : 0;
  const spouseYears  = form.spouseAge  ? Math.max(0, v(form.spouseIncome.targetAge)  - v(form.spouseAge))  : 0;
  const annualReplace = (income: string, pct: string, cpp: string) => (v(income) * v(pct) / 100) - (v(cpp) * 12);
  const subtotalC = annualReplace(form.primaryAnnualIncome, form.primaryIncome.replacementPct, form.primaryIncome.cppSurvivorBenefit) * primaryYears;
  const subtotalD = annualReplace(form.spouseAnnualIncome,  form.spouseIncome.replacementPct,  form.spouseIncome.cppSurvivorBenefit)  * spouseYears;
  const calcE = (a: WorksheetForm["primaryAssets"]) => v(a.liquidSavings) + (a.rrspsUse ? v(a.rrsps) : 0) + (a.nonRegisteredUse ? v(a.nonRegistered) : 0) + (a.tfsaUse ? v(a.tfsa) : 0) + v(a.other);
  const subtotalE = calcE(form.primaryAssets);
  const subtotalF = calcE(form.spouseAssets);
  const primaryNeed = Math.max(0, subtotalA + subtotalB + subtotalC - subtotalE);
  const spouseNeed  = Math.max(0, subtotalA + subtotalB + subtotalD - subtotalF);
  const primaryNet  = Math.max(0, primaryNeed - v(form.primaryExistingCoverage));
  const spouseNet   = Math.max(0, spouseNeed  - v(form.spouseExistingCoverage));
  const calc = { subtotalA, subtotalB, subtotalC, subtotalD, subtotalE, subtotalF, primaryNeed, spouseNeed, primaryNet, spouseNet, primaryYears, spouseYears };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (viewingId) {
      // BE: use api.patch (cookie auth)
      api.patch(`/api/insurance/${viewingId}`, { worksheetData: { ...form, calc }, primaryName: form.primaryName, primaryAge: form.primaryAge ? parseInt(form.primaryAge) : null, spouseName: form.spouseName, spouseAge: form.spouseAge ? parseInt(form.spouseAge) : null, annualIncome: form.primaryAnnualIncome, spouseAnnualIncome: form.spouseAnnualIncome })
        .then(() => { setShowWorksheet(false); setForm(defaultWs); setViewingId(null); qc.invalidateQueries({ queryKey: ["/api/clients/:clientId/insurance-analyses", clientId] }); });
    } else {
      createWorksheet.mutate({ clientId, data: { ...form, calc } }, {
        onSuccess: () => { setShowWorksheet(false); setForm(defaultWs); setViewingId(null); },
      });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Insurance Needs Analysis</h2>
        <button onClick={() => {
          setForm({ ...defaultWs, ...buildDefaultFromNW(), primaryName: client ? `${client.firstName} ${client.lastName}` : "", primaryAge: client?.dateOfBirth ? String(new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()) : "", primaryAnnualIncome: client?.annualIncome ? String(client.annualIncome) : "", spouseName: client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "", spouseAge: client?.spouseDateOfBirth ? String(new Date().getFullYear() - new Date(client.spouseDateOfBirth).getFullYear()) : "", spouseAnnualIncome: client?.spouseFirstName && client?.spouseAnnualIncome ? String(client.spouseAnnualIncome) : "" });
          setViewingId(null); setShowWorksheet(true);
        }} className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>New Analysis</span>
        </button>
      </div>

      {(analyses as any[]).map((a) => (
        <div key={a.id} className="border border-border rounded-2xl p-6">
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="text-base font-bold">{a.primaryName || "Family Needs Analysis"}</h3>
              <p className="text-xs text-muted-foreground">Created {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "-"}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { if (a.worksheetData) { setForm({ ...defaultWs, ...a.worksheetData }); } else { setForm({ ...defaultWs, primaryName: a.primaryName ?? "", primaryAge: a.primaryAge ? String(a.primaryAge) : "", spouseName: a.spouseName ?? "", spouseAge: a.spouseAge ? String(a.spouseAge) : "" }); } setViewingId(a.id); setShowWorksheet(true); }} className="p-1.5 text-primary hover:bg-primary/10 rounded-lg" title="Open"><Eye className="w-4 h-4" /></button>
              {/* BE: report via cookie auth */}
              <button onClick={async () => { const res = await fetch(`/api/reports/${clientId}/fna/${a.id}`, { credentials: "include" }); const html = await res.text(); const blob = new Blob([html], { type: "text/html" }); window.open(URL.createObjectURL(blob), "_blank"); }} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg" title="Report"><Printer className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {(() => {
              const ws = (a.worksheetData ?? {}) as any;
              const c = ws.calc ?? {};
              const pNet = Math.max(0, parseFloat(c.primaryNet ?? ws.primaryNeed ?? "0"));
              const sNet = Math.max(0, parseFloat(c.spouseNet ?? ws.spouseNeed ?? "0"));
              return [
                { label: `${a.primaryName || "Primary"} - Life Need`, val: pNet },
                ...(a.spouseName ? [{ label: `${a.spouseName} - Life Need`, val: sNet }] : []),
              ].map(item => (
                <div key={item.label} className="p-1.5 bg-muted/30 rounded-lg flex items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className={`text-sm font-bold ${item.val > 0 ? "text-red-600" : "text-green-600"}`}>{fmt$(item.val)}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      ))}

      {analyses.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">No insurance analyses yet. Create a Family Needs Analysis worksheet.</div>
      )}

      {showWorksheet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-3xl w-full max-w-4xl shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="sticky top-0 bg-background z-10 px-8 pt-6 pb-4 border-b border-border">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-display font-bold">Family Needs Analysis</h2>
                  <p className="text-sm text-muted-foreground mt-1">Complete all sections to calculate total life insurance need</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Primary Net Need</p>
                    <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`}>{fmt$(calc.primaryNet)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Spouse Net Need</p>
                    <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`}>{fmt$(calc.spouseNet)}</p>
                  </div>
                </div>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="px-8 py-6 space-y-8">
              {/* Client Info */}
              <section>
                <div className="flex items-center gap-2 mb-4"><Users className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">Client Information</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">Primary Insured</p>
                    <div><label className="text-xs font-medium text-muted-foreground">Full Name</label><input type="text" required value={form.primaryName} onChange={e => setForm(f => ({ ...f, primaryName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WField label="Age" value={form.primaryAge} onChange={v => setForm(f => ({ ...f, primaryAge: v }))} testId="ws-primary-age" prefix="" />
                      <WField label="Annual Income" value={form.primaryAnnualIncome} onChange={v => setForm(f => ({ ...f, primaryAnnualIncome: v }))} testId="ws-primary-income" />
                    </div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">Spouse</p>
                    <div><label className="text-xs font-medium text-muted-foreground">Full Name</label><input type="text" value={form.spouseName} onChange={e => setForm(f => ({ ...f, spouseName: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <WField label="Age" value={form.spouseAge} onChange={v => setForm(f => ({ ...f, spouseAge: v }))} testId="ws-spouse-age" prefix="" />
                      <WField label="Annual Income" value={form.spouseAnnualIncome} onChange={v => setForm(f => ({ ...f, spouseAnnualIncome: v }))} testId="ws-spouse-income" />
                    </div>
                  </div>
                </div>
              </section>

              {/* Liabilities */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-red-500" /><h3 className="font-display font-bold text-lg">Household Liabilities</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">Subtotal (A)</span><p className="font-bold text-red-600">{fmt$(calc.subtotalA)}</p></div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <WField label="Mortgage Balance" value={form.liabilities.mortgageBalance} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, mortgageBalance: v } }))} testId="ws-mortgage" />
                  <WField label="Car Loans" value={form.liabilities.carLoans} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, carLoans: v } }))} testId="ws-car" />
                  <WField label="Lines of Credit" value={form.liabilities.linesOfCredit} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, linesOfCredit: v } }))} testId="ws-loc" />
                  <WField label="Credit Cards" value={form.liabilities.creditCards} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, creditCards: v } }))} testId="ws-cc" />
                  <WField label="Final Expenses" value={form.liabilities.finalExpenses} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, finalExpenses: v } }))} testId="ws-final" />
                  <WField label="Emergency Fund" value={form.liabilities.emergencyFund} onChange={v => setForm(f => ({ ...f, liabilities: { ...f.liabilities, emergencyFund: v } }))} testId="ws-emergency" />
                </div>
              </section>

              {/* Legacy */}
              <section>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2"><Gift className="w-5 h-5 text-amber-500" /><h3 className="font-display font-bold text-lg">Legacy Needs</h3></div>
                  <div className="text-right"><span className="text-xs text-muted-foreground">Subtotal (B)</span><p className="font-bold text-amber-600">{fmt$(calc.subtotalB)}</p></div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <WField label="Education Fund" value={form.legacy.educationFund} onChange={v => setForm(f => ({ ...f, legacy: { ...f.legacy, educationFund: v } }))} testId="ws-edu" />
                  <WField label="Legacy for Children" value={form.legacy.legacyFundForChildren} onChange={v => setForm(f => ({ ...f, legacy: { ...f.legacy, legacyFundForChildren: v } }))} testId="ws-legacy" />
                  <WField label="Charitable Bequest" value={form.legacy.charitableBequest} onChange={v => setForm(f => ({ ...f, legacy: { ...f.legacy, charitableBequest: v } }))} testId="ws-charity" />
                  <WField label="Other" value={form.legacy.other} onChange={v => setForm(f => ({ ...f, legacy: { ...f.legacy, other: v } }))} testId="ws-other" />
                </div>
              </section>

              {/* Income Replacement */}
              <section>
                <div className="flex items-center gap-2 mb-4"><TrendingUp className="w-5 h-5 text-blue-500" /><h3 className="font-display font-bold text-lg">Family Income Replacement</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (C)</p><p className="font-bold text-blue-600">{fmt$(calc.subtotalC)}</p></div>
                    <WField label="Replacement %" value={form.primaryIncome.replacementPct} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, replacementPct: v } }))} testId="ws-pri-rep" prefix="%" />
                    <WField label="CPP Survivor ($/mo)" value={form.primaryIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, cppSurvivorBenefit: v } }))} testId="ws-pri-cpp" />
                    <WField label="Target Age" value={form.primaryIncome.targetAge} onChange={v => setForm(f => ({ ...f, primaryIncome: { ...f.primaryIncome, targetAge: v } }))} testId="ws-pri-age" prefix="" />
                    <p className="text-xs text-muted-foreground">Years: {calc.primaryYears}</p>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (D)</p><p className="font-bold text-blue-600">{fmt$(calc.subtotalD)}</p></div>
                    <WField label="Replacement %" value={form.spouseIncome.replacementPct} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, replacementPct: v } }))} testId="ws-sps-rep" prefix="%" />
                    <WField label="CPP Survivor ($/mo)" value={form.spouseIncome.cppSurvivorBenefit} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, cppSurvivorBenefit: v } }))} testId="ws-sps-cpp" />
                    <WField label="Target Age" value={form.spouseIncome.targetAge} onChange={v => setForm(f => ({ ...f, spouseIncome: { ...f.spouseIncome, targetAge: v } }))} testId="ws-sps-age" prefix="" />
                    <p className="text-xs text-muted-foreground">Years: {calc.spouseYears}</p>
                  </div>
                </div>
              </section>

              {/* Assets */}
              <section>
                <div className="flex items-center gap-2 mb-4"><PiggyBank className="w-5 h-5 text-green-500" /><h3 className="font-display font-bold text-lg">Financial Assets Available</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-primary">Primary (E)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalE)}</p></div>
                    <WField label="Liquid Savings" value={form.primaryAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, liquidSavings: v } }))} testId="ws-pri-liquid" />
                    <ARow label="RRSPs" value={form.primaryAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrsps: v } }))} useIt={form.primaryAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, rrspsUse: !f.primaryAssets.rrspsUse } }))} testId="pri-rrsp" />
                    <ARow label="Non-Registered" value={form.primaryAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegistered: v } }))} useIt={form.primaryAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, nonRegisteredUse: !f.primaryAssets.nonRegisteredUse } }))} testId="pri-nonreg" />
                    <ARow label="TFSA" value={form.primaryAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsa: v } }))} useIt={form.primaryAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, primaryAssets: { ...f.primaryAssets, tfsaUse: !f.primaryAssets.tfsaUse } }))} testId="pri-tfsa" />
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <div className="flex justify-between"><p className="text-sm font-semibold text-purple-600">Spouse (F)</p><p className="font-bold text-green-600">{fmt$(calc.subtotalF)}</p></div>
                    <WField label="Liquid Savings" value={form.spouseAssets.liquidSavings} onChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, liquidSavings: v } }))} testId="ws-sps-liquid" />
                    <ARow label="RRSPs" value={form.spouseAssets.rrsps} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrsps: v } }))} useIt={form.spouseAssets.rrspsUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, rrspsUse: !f.spouseAssets.rrspsUse } }))} testId="sps-rrsp" />
                    <ARow label="Non-Registered" value={form.spouseAssets.nonRegistered} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegistered: v } }))} useIt={form.spouseAssets.nonRegisteredUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, nonRegisteredUse: !f.spouseAssets.nonRegisteredUse } }))} testId="sps-nonreg" />
                    <ARow label="TFSA" value={form.spouseAssets.tfsa} onValueChange={v => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsa: v } }))} useIt={form.spouseAssets.tfsaUse} onToggle={() => setForm(f => ({ ...f, spouseAssets: { ...f.spouseAssets, tfsaUse: !f.spouseAssets.tfsaUse } }))} testId="sps-tfsa" />
                  </div>
                </div>
              </section>

              {/* Total Need */}
              <section className="border-2 border-primary/20 rounded-2xl p-6 bg-primary/5">
                <div className="flex items-center gap-2 mb-4"><Shield className="w-5 h-5 text-primary" /><h3 className="font-display font-bold text-lg">Total Life Insurance Need</h3></div>
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <p className="text-sm font-semibold mb-2">Primary: A + B + C - E</p>
                    <p className="text-2xl font-bold mt-2">{fmt$(calc.primaryNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WField label="Existing Coverage" value={form.primaryExistingCoverage} onChange={v => setForm(f => ({ ...f, primaryExistingCoverage: v }))} testId="ws-pri-existing" />
                      <p className={`text-lg font-bold ${calc.primaryNet > 0 ? "text-red-600" : "text-green-600"}`}>Net Need: {fmt$(calc.primaryNet)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-2">Spouse: A + B + D - F</p>
                    <p className="text-2xl font-bold mt-2">{fmt$(calc.spouseNeed)}</p>
                    <div className="mt-3 space-y-2">
                      <WField label="Existing Coverage" value={form.spouseExistingCoverage} onChange={v => setForm(f => ({ ...f, spouseExistingCoverage: v }))} testId="ws-sps-existing" />
                      <p className={`text-lg font-bold ${calc.spouseNet > 0 ? "text-red-600" : "text-green-600"}`}>Net Need: {fmt$(calc.spouseNet)}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Signatures */}
              <section>
                <div className="flex items-center gap-2 mb-4"><FileSignature className="w-5 h-5 text-gray-500" /><h3 className="font-display font-bold text-lg">Decision & Acknowledgement</h3></div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-primary">Primary</p>
                    <WField label="Coverage Purchased" value={form.primaryCoveragePurchased} onChange={v => setForm(f => ({ ...f, primaryCoveragePurchased: v }))} testId="ws-pri-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">Signature</label><input type="text" value={form.primarySignature} onChange={e => setForm(f => ({ ...f, primarySignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                  <div className="space-y-3 p-4 border border-border rounded-xl">
                    <p className="text-sm font-semibold text-purple-600">Spouse</p>
                    <WField label="Coverage Purchased" value={form.spouseCoveragePurchased} onChange={v => setForm(f => ({ ...f, spouseCoveragePurchased: v }))} testId="ws-sps-purchased" />
                    <div><label className="text-xs font-medium text-muted-foreground">Signature</label><input type="text" value={form.spouseSignature} onChange={e => setForm(f => ({ ...f, spouseSignature: e.target.value }))} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
                  </div>
                </div>
                <div className="mt-4"><label className="text-xs font-medium text-muted-foreground">Meeting Notes</label><textarea value={form.meetingNotes} onChange={e => setForm(f => ({ ...f, meetingNotes: e.target.value }))} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm mt-1 bg-background" /></div>
              </section>

              <div className="sticky bottom-0 bg-background pt-4 pb-2 border-t border-border flex justify-end gap-3">
                <button type="button" onClick={() => setShowWorksheet(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createWorksheet.isPending} className="px-8 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {createWorksheet.isPending ? <><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Saving...</> : viewingId ? "Update Analysis" : "Save Analysis"}
                </button>
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
        <h2 className="text-xl font-display font-bold">Education Savings (RESP)</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Plan</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(savings as any[]).map(s => {
          const yearsLeft = Math.max(0, s.targetAge - s.childAge);
          const bal = parseFloat(s.currentBalance || s.currentRespBalance || "0");
          const monthly = parseFloat(s.monthlyContribution || "0");
          const rate = parseFloat(s.expectedReturn) / 100 / 12;
          const months = yearsLeft * 12;
          const projected = months > 0 ? bal * Math.pow(1 + rate, months) + monthly * ((Math.pow(1 + rate, months) - 1) / rate) : bal;
          const gap = parseFloat(s.estimatedCost) - projected;
          return (
            <div key={s.id} className="border border-border rounded-2xl p-6">
              <div className="flex justify-between items-start">
                <div><h3 className="text-lg font-bold">{s.childName}</h3><p className="text-sm text-muted-foreground">Age {s.childAge} | {s.accountType} | Target: Age {s.targetAge}</p></div>
                <button onClick={() => { if (confirm("Delete?")) deleteSaving.mutate(s.id); }} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div><p className="text-xs text-muted-foreground uppercase">Current Balance</p><p className="text-lg font-bold text-primary">{fmt$(bal)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Monthly Contribution</p><p className="text-lg font-bold">{fmt$(monthly)}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Projected at Target</p><p className="text-lg font-bold text-blue-600">{fmt$(Math.round(projected))}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase">Gap / Surplus</p><p className={`text-lg font-bold ${gap > 0 ? "text-red-600" : "text-green-600"}`}>{gap > 0 ? "-" : "+"}{fmt$(Math.abs(Math.round(gap)))}</p></div>
              </div>
            </div>
          );
        })}
      </div>
      {savings.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">No education savings plans yet.</div>}
      <ModuleScenarioPreview planId={planId} module="education" />
      <RespFundingGauge results={simResults as any[]} savings={savings as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-display font-bold mb-6">Add Education Savings Plan</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-sm font-semibold">Child Name</label><input required value={form.childName} onChange={e => setForm({ ...form, childName: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Account Type</label><select value={form.accountType} onChange={e => setForm({ ...form, accountType: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1"><option>RESP</option><option>RDSP</option><option>Other</option></select></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Current Age</label><input type="number" required value={form.childAge} onChange={e => setForm({ ...form, childAge: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Target Age</label><input type="number" required value={form.targetAge} onChange={e => setForm({ ...form, targetAge: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Return (%)</label><input type="number" step="0.1" required value={form.expectedReturn} onChange={e => setForm({ ...form, expectedReturn: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Balance ($)</label><input type="number" required value={form.currentBalance} onChange={e => setForm({ ...form, currentBalance: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Monthly ($)</label><input type="number" required value={form.monthlyContribution} onChange={e => setForm({ ...form, monthlyContribution: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Est. Cost ($)</label><input type="number" required value={form.estimatedCost} onChange={e => setForm({ ...form, estimatedCost: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createSaving.isPending} className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createSaving.isPending ? "Adding..." : "Add Plan"}</button>
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
        <h2 className="text-xl font-display font-bold">Debt Management</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Debt</span>
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50"><p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Debt</p><p className="text-2xl font-bold text-red-600 mt-1">{fmt$(totalDebt)}</p></div>
        <div className="border border-border rounded-2xl p-5"><p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accounts</p><p className="text-2xl font-bold mt-1">{debts.length}</p></div>
        <div className="border border-orange-200 rounded-2xl p-5 bg-orange-50/50"><p className="text-xs font-semibold text-orange-600 uppercase tracking-wider">Avg Interest Rate</p><p className="text-2xl font-bold text-orange-700 mt-1">{avgRate.toFixed(1)}%</p></div>
      </div>
      <div className="border border-border rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr>
            <th className="text-left px-4 py-3 font-semibold">Name</th>
            <th className="text-left px-4 py-3 font-semibold">Category</th>
            <th className="text-right px-4 py-3 font-semibold">Balance</th>
            <th className="text-right px-4 py-3 font-semibold">Rate</th>
            <th className="text-right px-4 py-3 font-semibold">Min. Payment</th>
            <th className="text-center px-4 py-3 font-semibold">Actions</th>
          </tr></thead>
          <tbody>
            {(debts as any[]).map(d => (
              <tr key={d.id} className="border-t hover:bg-muted/30">
                <td className="px-4 py-3 font-medium">{d.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{d.category}</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">{fmt$(parseFloat(d.balance))}</td>
                <td className="px-4 py-3 text-right">{parseFloat(d.interestRate).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right">{fmt$(parseFloat(d.minimumPayment))}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => { if (confirm("Delete?")) deleteDebt.mutate(d.id); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {debts.length === 0 && <div className="text-center py-12 text-muted-foreground">No debts tracked yet.</div>}
      </div>
      <ModuleScenarioPreview planId={planId} module="debt" />
      <DebtPayoffTimeline debts={debts as any[]} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Add Debt Account</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-sm font-semibold">Name</label><input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" placeholder="e.g. TD Visa" /></div>
              <div><label className="text-sm font-semibold">Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="text-sm font-semibold">Balance ($)</label><input type="number" step="0.01" required value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Rate (%)</label><input type="number" step="0.01" required value={form.interestRate} onChange={e => setForm({ ...form, interestRate: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
                <div><label className="text-sm font-semibold">Min Payment ($)</label><input type="number" step="0.01" value={form.minimumPayment} onChange={e => setForm({ ...form, minimumPayment: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createDebt.isPending} className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createDebt.isPending ? "Adding..." : "Add Debt"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tax Tab ───────────────────────────────────────────────────────────────────

type TaxSubTab = "notes" | "rrsp" | "tfsa" | "projection" | "capgains" | "splitting";
const taxSubTabs: Array<{ key: TaxSubTab; label: string }> = [
  { key: "notes", label: "Planning Notes" }, { key: "rrsp", label: "RRSP Room" },
  { key: "tfsa", label: "TFSA Room" }, { key: "projection", label: "Tax Projection" },
  { key: "capgains", label: "Capital Gains" }, { key: "splitting", label: "Income Splitting" },
];

function TaxNotesPanel({ clientId }: { clientId: number }) {
  const { data: notes = [] } = useTaxPlanningNotes(clientId);
  const createNote = useCreateTaxPlanningNote();
  const deleteNote = useDeleteTaxPlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ taxYear: String(new Date().getFullYear()), category: "General", title: "", content: "" });
  const categories = ["General","RRSP Optimization","TFSA Strategy","Income Splitting","Capital Gains","Tax Loss Harvesting","Charitable Donations","Corporate Tax","Other"];
  const grouped = (notes as any[]).reduce((acc: any, n: any) => { if (!acc[n.taxYear]) acc[n.taxYear] = []; acc[n.taxYear].push(n); return acc; }, {});

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowAdd(true)} className="flex items-center space-x-2 px-3 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-xl hover:bg-secondary/90">
          <Plus className="w-4 h-4" /><span>Add Note</span>
        </button>
      </div>
      {showAdd && (
        <form onSubmit={e => { e.preventDefault(); createNote.mutate({ clientId, data: { taxYear: parseInt(form.taxYear), category: form.category, title: form.title, content: form.content } }, { onSuccess: () => { setShowAdd(false); setForm({ taxYear: String(new Date().getFullYear()), category: "General", title: "", content: "" }); } }); }} className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-semibold">Tax Year</label><input type="number" value={form.taxYear} onChange={e => setForm(f => ({ ...f, taxYear: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" required /></div>
            <div><label className="text-sm font-semibold">Category</label><select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div><label className="text-sm font-semibold">Title</label><input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" required /></div>
          <div><label className="text-sm font-semibold">Content</label><textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="w-full px-3 py-2 rounded-xl border mt-1 text-sm resize-none" rows={4} required /></div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">{createNote.isPending ? "Saving..." : "Save Note"}</button>
            <button type="button" onClick={() => setShowAdd(false)} className="px-4 py-2 bg-muted text-muted-foreground rounded-xl text-sm font-semibold">Cancel</button>
          </div>
        </form>
      )}
      <div className="space-y-6">
        {Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a)).map(([year, yearNotes]) => (
          <div key={year}>
            <h3 className="text-lg font-bold mb-3">{year} Tax Year</h3>
            <div className="grid gap-4">
              {(yearNotes as any[]).map((note: any) => (
                <div key={note.id} className="border border-border rounded-xl p-4 hover:shadow-md transition-shadow group">
                  <div className="flex justify-between items-start">
                    <span className="text-xs font-semibold text-purple-600 uppercase bg-purple-50 px-2 py-1 rounded-lg">{note.category}</span>
                    <button onClick={() => { if (confirm("Delete?")) deleteNote.mutate(note.id); }} className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <h4 className="font-semibold mt-3">{note.title}</h4>
                  <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{note.content}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
        {notes.length === 0 && !showAdd && <p className="text-center text-muted-foreground py-8">No tax planning notes yet.</p>}
      </div>
    </div>
  );
}

// Tax analysis panels use the local `api` helper (cookie auth)

function TaxAnalysisPanel({ clientId, type, title, color, fields, buildInput, renderResult }: {
  clientId: number; type: string; title: string; color: string;
  fields: Array<[string, string]>;
  buildInput: (form: Record<string, string>) => Record<string, unknown>;
  renderResult: (r: any) => React.ReactNode;
}) {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ label: "" });

  const load = async () => {
    setLoading(true);
    try { setAnalyses(await api.get<any[]>(`/api/tax/client/${clientId}/analyses?type=${type}`)); }
    catch { setAnalyses([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [clientId, type]);

  const openNew = () => {
    setEditingId(null);
    setForm({ label: `${title} — ${new Date().getFullYear()}`, ...Object.fromEntries(fields.map(([, k]) => [k, "0"])) });
    setShowForm(true);
  };
  const openEdit = (a: any) => { setEditingId(a.id); setForm({ label: a.label ?? "", ...a.inputData }); setShowForm(true); };
  const del = async (id: number) => { if (!confirm("Delete?")) return; await api.delete(`/api/tax/tax-analyses/${id}`); await load(); };

  const save = async () => {
    setSaving(true);
    try {
      const input = buildInput(form);
      const result = await api.post(`/api/tax/${clientId}/${type}`, input);
      const payload = { type, owner: "primary", label: form.label, inputData: form, resultData: result };
      if (editingId) await api.patch(`/api/tax/tax-analyses/${editingId}`, payload);
      else await api.post(`/api/tax/client/${clientId}/analyses`, payload);
      setShowForm(false); await load();
    } catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className={`flex-1 p-4 bg-${color}-50 border border-${color}-200 rounded-xl text-sm text-${color}-800`}><strong>{title}</strong></div>
        <button onClick={openNew} className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-2 rounded-xl whitespace-nowrap"><Plus className="w-4 h-4" /> New Analysis</button>
      </div>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold">{editingId ? "Edit" : "New"} {title}</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-semibold text-gray-500 block mb-1">Label</label><input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" /></div>
              <div className="grid grid-cols-2 gap-3">
                {fields.map(([label, key]) => (
                  <div key={key}><label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label><input type="number" step="any" value={form[key] ?? ""} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" placeholder="0" /></div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 justify-end p-5 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 px-4 py-2">Cancel</button>
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2.5 rounded-xl"><Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Calculate & Save"}</button>
            </div>
          </div>
        </div>
      )}
      {loading ? <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
      : analyses.length === 0 ? <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl"><p className="text-gray-500 font-semibold">No {title.toLowerCase()} analyses yet</p></div>
      : (
        <div className="space-y-3">
          {analyses.map((a: any) => (
            <div key={a.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div><h3 className="font-bold text-gray-900">{a.label || title}</h3><p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString("en-CA")}</p></div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} className="p-1.5 text-gray-300 hover:text-blue-500"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(a.id)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {a.resultData && renderResult(a.resultData)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaxTab({ clientId, client, person: personProp = "primary" }: { clientId: number; client?: any; person?: string }) {
  const [activeSubTab, setActiveSubTab] = useState<TaxSubTab>("projection");
  const { data: projections = [] } = useRetirementProjections(clientId);
  const ret = (projections as any[])[0] ?? null;
  const primaryLabel = client?.firstName ?? "Primary";
  const spouseLabel  = client?.spouseFirstName ?? "Spouse";
  const fmtK = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-300 px-1">
      <h2 className="text-xl font-display font-bold">Tax Planning</h2>
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto flex-wrap">
        {taxSubTabs.map(t => (
          <button key={t.key} onClick={() => setActiveSubTab(t.key)} className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${activeSubTab === t.key ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{t.label}</button>
        ))}
      </div>
      <div className="animate-in fade-in duration-200">
        {activeSubTab === "notes" && <TaxNotesPanel clientId={clientId} />}
        {activeSubTab === "rrsp" && (
          <TaxAnalysisPanel clientId={clientId} type="rrsp-room" title="RRSP Room Tracker" color="blue"
            fields={[["Prior Year Earned Income ($)","priorYearEarnedIncome"],["Pension Adjustment ($)","pensionAdjustment"],["Carry-Forward Room ($)","carryForwardRoom"],["Contributions This Year ($)","contributionsMadeThisYear"],["Marginal Tax Rate (decimal)","marginalTaxRate"],["Years to Project","yearsToProject"]]}
            buildInput={f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "label").map(([k, v]) => [k, Number(v)]))}
            renderResult={r => r.summary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{ label: "Available Room", val: r.summary.totalAvailableRoom }, { label: "Tax Savings", val: r.marginalTaxSavings }, { label: "Annual Catch-Up", val: r.catchUpStrategy?.annualContributionNeeded }, { label: "Refund / Year", val: r.catchUpStrategy?.projectedRefundPerYear }].map(c => (
                  <div key={c.label} className="bg-blue-50 rounded-xl p-3"><p className="text-[10px] font-bold text-blue-600 uppercase">{c.label}</p><p className="text-lg font-bold text-blue-700">{fmtK(c.val ?? 0)}</p></div>
                ))}
              </div>
            ) : null}
          />
        )}
        {activeSubTab === "tfsa" && (
          <TaxAnalysisPanel clientId={clientId} type="tfsa-room" title="TFSA Room Tracker" color="teal"
            fields={[["Birth Year","birthYear"],["Prior Year Closing Room ($)","priorYearClosingRoom"],["Contributions This Year ($)","contributionsMadeThisYear"],["Withdrawals Last Year ($)","withdrawalsLastYear"],["Current TFSA Balance ($)","currentTfsaBalance"],["Annual Contribution ($)","annualContribution"],["Expected Return (decimal)","portfolioReturn"]]}
            buildInput={f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "label").map(([k, v]) => [k, Number(v)]))}
            renderResult={r => r.summary ? (
              <div className="grid grid-cols-3 gap-3">
                {[{ label: "Available Room", val: r.summary.totalAvailableRoom }, { label: "30yr TFSA Value", val: r.thirtyYearProjection?.tfsaBalanceFinal }, { label: "TFSA Advantage", val: r.thirtyYearProjection?.tfsaAdvantage }].map(c => (
                  <div key={c.label} className="bg-teal-50 rounded-xl p-3"><p className="text-[10px] font-bold text-teal-600 uppercase">{c.label}</p><p className="text-lg font-bold text-teal-700">{fmtK(c.val ?? 0)}</p></div>
                ))}
              </div>
            ) : null}
          />
        )}
        {activeSubTab === "projection" && (
          <TaxAnalysisPanel clientId={clientId} type="projection" title="Tax Projection" color="purple"
            fields={[["Current Age","currentAge"],["Retirement Age","retirementAge"],["Plan To Age","planToAge"],["Employment Income ($)","employmentIncome"],["RRSP Balance ($)","rrspBalance"],["RRSP Annual Contribution ($)","rrspAnnualContribution"],["TFSA Balance ($)","tfsaBalance"],["TFSA Annual Contribution ($)","tfsaAnnualContribution"],["Non-Reg Balance ($)","nonRegBalance"],["Desired Retirement Income ($)","desiredRetirementIncome"],["CPP Start Age","cppStartAge"],["OAS Start Age","oasStartAge"]]}
            buildInput={f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "label").map(([k, v]) => [k, Number(v)]))}
            renderResult={r => r.summary ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[{ label: "Total Lifetime Tax", val: r.summary.totalLifetimeTax, color: "red" }, { label: "Avg Effective Rate", val: r.summary.averageEffectiveRate * 100, color: "orange", pct: true }, { label: "Final Wealth", val: r.summary.projectedFinalWealth, color: "green" }, { label: "Success Probability", val: r.summary.successProbability * 100, color: "blue", pct: true }].map(c => (
                  <div key={c.label} className={`bg-${c.color}-50 rounded-xl p-3`}><p className={`text-[10px] font-bold text-${c.color}-600 uppercase`}>{c.label}</p><p className={`text-lg font-bold text-${c.color}-700`}>{c.pct ? `${(c.val ?? 0).toFixed(1)}%` : fmtK(c.val ?? 0)}</p></div>
                ))}
              </div>
            ) : null}
          />
        )}
        {activeSubTab === "capgains" && (
          <TaxAnalysisPanel clientId={clientId} type="capital-gains" title="Capital Gains Analyser" color="amber"
            fields={[["Unrealized Gain ($)","unrealizedGain"],["Cost Base ($)","acb"],["Marginal Tax Rate (%)","marginalRate"],["Prior Year Losses ($)","carryForwardLoss"]]}
            buildInput={f => ({ unrealizedGain: Number(f.unrealizedGain), acb: Number(f.acb), marginalTaxRate: Number(f.marginalRate) / 100, carryForwardLoss: Number(f.carryForwardLoss || 0) })}
            renderResult={r => r.scenarios ? (
              <div className="grid grid-cols-3 gap-3">
                {(r.scenarios as any[]).slice(0, 3).map((s: any) => (
                  <div key={s.name} className="bg-amber-50 rounded-xl p-3"><p className="text-[10px] font-bold text-amber-600 uppercase">{s.name}</p><p className="text-lg font-bold text-amber-700">{fmtK(s.estimatedTax)}</p></div>
                ))}
              </div>
            ) : null}
          />
        )}
        {activeSubTab === "splitting" && (
          <TaxAnalysisPanel clientId={clientId} type="income-splitting" title="Income Splitting Optimizer" color="indigo"
            fields={[["Higher Income ($)","higherIncome"],["Lower Income ($)","lowerIncome"],["Pension Income ($)","pensionIncome"],["Age (older spouse)","age"]]}
            buildInput={f => Object.fromEntries(Object.entries(f).filter(([k]) => k !== "label").map(([k, v]) => [k, Number(v)]))}
            renderResult={r => (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-indigo-50 rounded-xl p-3"><p className="text-[10px] font-bold text-indigo-600 uppercase">Strategy</p><p className="text-sm font-bold text-indigo-700">{r.strategy?.replace(/_/g, " ").toUpperCase()}</p></div>
                <div className="bg-red-50 rounded-xl p-3"><p className="text-[10px] font-bold text-red-600 uppercase">Current Tax</p><p className="text-lg font-bold text-red-700">{fmtK(r.currentCombinedTax ?? 0)}</p></div>
                <div className="bg-green-50 rounded-xl p-3"><p className="text-[10px] font-bold text-green-600 uppercase">Optimized Tax</p><p className="text-lg font-bold text-green-700">{fmtK(r.optimizedCombinedTax ?? 0)}</p></div>
                <div className="bg-emerald-50 rounded-xl p-3"><p className="text-[10px] font-bold text-emerald-600 uppercase">Annual Savings</p><p className="text-lg font-bold text-emerald-700">{fmtK(r.annualTaxSavings ?? 0)}</p></div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}

// ── Estate Tab ────────────────────────────────────────────────────────────────

export function EstateNotesTab({ clientId, planId }: { clientId: number; planId: number | null; client?: any }) {
  const { data: notes = [] } = useEstatePlanningNotes(clientId);
  const { data: assumptions = [] } = usePlanAssumptions(planId);
  const createNote = useCreateEstatePlanningNote();
  const deleteNote = useDeleteEstatePlanningNote(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ category: "Will", title: "", content: "" });
  const categories = ["Will","Power of Attorney","Trust","Beneficiary Designations","Estate Tax","Succession Planning","Charitable Giving","Other"];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createNote.mutate({ clientId, data: { category: form.category, title: form.title, content: form.content } },
      { onSuccess: () => { setShowAdd(false); setForm({ category: "Will", title: "", content: "" }); } });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">Estate Planning Notes</h2>
        <button onClick={() => setShowAdd(true)} className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Note</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(notes as any[]).map(n => (
          <div key={n.id} className="border border-border rounded-2xl p-6 hover:shadow-md transition-shadow group">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-indigo-600 uppercase bg-indigo-50 px-2 py-1 rounded-lg">{n.category}</span>
              <button onClick={() => { if (confirm("Delete?")) deleteNote.mutate(n.id); }} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            <h3 className="text-lg font-bold mt-3">{n.title}</h3>
            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
          </div>
        ))}
      </div>
      {notes.length === 0 && <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-2xl">No estate planning notes yet.</div>}
      <EstateScorecard notes={notes as any[]} province={(assumptions as any[]).find((a: any) => a.scenario === "Moderate")?.province} />
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-2xl font-display font-bold mb-6">Add Estate Planning Note</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="text-sm font-semibold">Category</label><select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1">{categories.map(c => <option key={c}>{c}</option>)}</select></div>
              <div><label className="text-sm font-semibold">Title</label><input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1" /></div>
              <div><label className="text-sm font-semibold">Content</label><textarea required value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} className="w-full px-3 py-2 rounded-xl border mt-1 min-h-[120px]" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-muted-foreground hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createNote.isPending} className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createNote.isPending ? "Adding..." : "Add Note"}</button>
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
  const qc = useQueryClient();
  const { data: recommendations = [] } = useAiRecommendations(clientId);
  const generateRecs = useGenerateAiRecommendations();
  const updateRec    = useUpdateAiRecommendation(clientId);
  const deleteRec    = useDeleteAiRecommendation(clientId);

  const sessions = (() => {
    const groups = new Map<string, any[]>();
    for (const rec of (recommendations as any[])) {
      const key = rec.runId ?? "legacy";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(rec);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a)).map(([runId, recs]) => ({
      runId, recs, date: runId !== "legacy" && !isNaN(Date.parse(runId)) ? new Date(runId) : null,
    }));
  })();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const newestRunId = sessions[0]?.runId ?? null;
  useEffect(() => { if (newestRunId) setExpanded(prev => new Set([...prev, newestRunId])); }, [newestRunId]);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const priorityBadge = (p: string) => {
    const colors: Record<string, string> = { high: "bg-red-100 text-red-700", medium: "bg-yellow-100 text-yellow-700", low: "bg-green-100 text-green-700" };
    return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[p] || colors.medium}`}>{p}</span>;
  };
  const statusIcon = (s: string) => {
    if (s === "completed")   return <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />;
    if (s === "in_progress") return <Clock className="w-4 h-4 text-blue-500 shrink-0" />;
    return <Clock className="w-4 h-4 text-yellow-500 shrink-0" />;
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-display font-bold">AI Recommendations</h2>
        <button onClick={() => generateRecs.mutate(clientId)} disabled={generateRecs.isPending}
          className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
          <Sparkles className="w-4 h-4" /><span>{generateRecs.isPending ? "Analyzing..." : "Generate Insights"}</span>
        </button>
      </div>
      {generateRecs.isPending && (
        <div className="border border-purple-200 rounded-2xl p-5 bg-purple-50/50 text-center">
          <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-purple-700 font-medium text-sm">Analyzing client's financial data…</p>
        </div>
      )}
      {sessions.length === 0 && !generateRecs.isPending && (
        <div className="text-center py-12 border border-dashed border-border rounded-2xl">
          <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No recommendations yet. Click "Generate Insights" to analyse this client.</p>
        </div>
      )}
      {sessions.map(({ runId, recs, date }) => {
        const open = expanded.has(runId);
        const sorted = [...recs].sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));
        const isLegacy = runId === "legacy" || !recs[0]?.runId;
        const dateStr = isLegacy || !date ? "Previous recommendations" : date.toLocaleDateString("en-CA", { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        return (
          <div key={runId} className="border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 bg-muted/30 flex items-start justify-between gap-4">
              <button onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(runId) ? n.delete(runId) : n.add(runId); return n; })} className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                  <span className="text-sm font-semibold text-gray-900">{dateStr}</span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                </div>
                <span className="text-xs text-muted-foreground">{recs.length} recommendation{recs.length !== 1 ? "s" : ""}</span>
              </button>
              <button onClick={async () => { if (!confirm("Delete session?")) return; if (isLegacy) { await Promise.all((recommendations as any[]).filter((r: any) => !r.runId).map((r: any) => api.delete(`/api/ai-recommendations/${r.id}`))); } else { await api.delete(`/api/clients/${clientId}/ai/session/${encodeURIComponent(runId)}`); } qc.invalidateQueries({ queryKey: ["/api/clients/:clientId/ai-recommendations", clientId] }); }} className="p-1.5 hover:bg-red-50 rounded-lg shrink-0"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            {open && (
              <div className="divide-y divide-border/50">
                {sorted.map(rec => (
                  <div key={rec.id} className={`px-5 py-4 ${rec.status === "completed" ? "bg-muted/20 opacity-70" : ""}`}>
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
                        {rec.status === "pending" && <><button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "in_progress" } })} className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 font-medium hover:bg-blue-100">Start</button><button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "dismissed" } })} className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">Dismiss</button></>}
                        {rec.status === "in_progress" && <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "completed" } })} className="text-xs px-2.5 py-1 rounded-lg bg-green-50 text-green-600 font-medium">Complete</button>}
                        {rec.status === "completed" && <button onClick={() => updateRec.mutate({ id: rec.id, data: { status: "pending" } })} className="text-xs px-2.5 py-1 rounded-lg bg-muted text-muted-foreground font-medium">Reopen</button>}
                        <button onClick={() => { if (confirm("Delete?")) deleteRec.mutate(rec.id); }} className="p-1 hover:bg-red-50 rounded ml-1"><Trash2 className="w-3 h-3 text-red-400" /></button>
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

// ── Main FinancialPlanningContent ─────────────────────────────────────────────

export function FinancialPlanningContent({ initialClientId }: { initialClientId?: number } = {}) {
  const [activeTab, setActiveTab]               = useState<TabKey>("overview");
  const [person, setPerson]                     = useState<"primary" | "spouse" | "combined">("primary");
  const [selectedClientId, setSelectedClientId] = useState<number | null>(initialClientId ?? null);

  // BE: company-scoped clients, cookie auth
  const { data: clients = [] } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: () => fetch("/api/clients", { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  // Fetch selected client detail
  const { data: selectedClient = null } = useQuery({
    queryKey: ["client-detail", selectedClientId],
    queryFn: () => selectedClientId ? api.get(`/api/clients/${selectedClientId}`) : null,
    enabled: !!selectedClientId,
  });

  const { data: plans = [] } = useClientPlans(selectedClientId ?? 0);
  const activePlanId = [...(plans as any[])].sort((a, b) => b.id - a.id)[0]?.id ?? null;
  const { data: allFlags = [] } = usePlanStaleFlags(activePlanId);

  const unresolvedFlags     = (allFlags as any[]).filter((f: any) => !f.resolvedAt);
  const recentlyResolvedFlags = (allFlags as any[]).filter((f: any) => {
    if (!f.resolvedAt) return false;
    return new Date(f.resolvedAt).getTime() > Date.now() - 24 * 60 * 60 * 1000;
  });
  const staleTabKeys        = new Set(unresolvedFlags.map((f: any) => moduleToTabMap[f.module]).filter(Boolean));
  const recalculatedTabKeys = new Set(recentlyResolvedFlags.map((f: any) => moduleToTabMap[f.module]).filter(Boolean));

  return (
    <div className="flex min-h-screen" data-testid="fp-popout-container">
      <aside style={{ width: "200px", minWidth: "200px", minHeight: "100vh", flexShrink: 0 }} className="bg-muted/30 border-r border-border flex flex-col overflow-y-auto">
        <div className="p-3 border-b border-border">
          <select value={selectedClientId ?? ""} onChange={e => setSelectedClientId(Number(e.target.value) || null)} data-testid="select-fp-client"
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary">
            <option value="">-- Select Client --</option>
            {(clients as any[]).map((c: any) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}
          </select>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} disabled={!selectedClientId}
              className={`flex items-center space-x-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === t.key && selectedClientId ? "bg-primary text-primary-foreground shadow-sm" : selectedClientId ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "text-muted-foreground/50 cursor-not-allowed"}`}>
              <t.icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{t.label}</span>
              {staleTabKeys.has(t.key) && <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse" />}
              {!staleTabKeys.has(t.key) && recalculatedTabKeys.has(t.key) && <span className="ml-auto flex-shrink-0 w-2 h-2 rounded-full bg-blue-500" />}
            </button>
          ))}
        </nav>
      </aside>

      <div style={{ flex: 1, minWidth: 0 }} className="overflow-y-auto p-6">
        {selectedClientId && unresolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span className="text-sm font-medium text-amber-800">{unresolvedFlags.length} module{unresolvedFlags.length > 1 ? "s" : ""} pending recalculation</span>
          </div>
        )}
        {selectedClientId && unresolvedFlags.length === 0 && recentlyResolvedFlags.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
            <CheckCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span className="text-sm font-medium text-blue-800">{recentlyResolvedFlags.length} module{recentlyResolvedFlags.length > 1 ? "s" : ""} recalculated</span>
          </div>
        )}

        {selectedClientId ? (
          <>
            {selectedClient && ["retirement", "tax", "dashboard"].includes(activeTab) && (
              <div className="flex gap-1 mb-5 bg-muted/40 rounded-xl p-1 border border-border w-fit">
                <button onClick={() => setPerson("primary")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "primary" ? "bg-white shadow text-[#0c1e3a] border border-border" : "text-muted-foreground hover:text-foreground"}`}>{(selectedClient as any).firstName ?? "Client"}</button>
                {(selectedClient as any).spouseFirstName && <>
                  <button onClick={() => setPerson("spouse")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "spouse" ? "bg-white shadow text-purple-700 border border-border" : "text-muted-foreground hover:text-foreground"}`}>{(selectedClient as any).spouseFirstName}</button>
                  <button onClick={() => setPerson("combined")} className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${person === "combined" ? "bg-white shadow text-blue-700 border border-border" : "text-muted-foreground hover:text-foreground"}`}>Combined</button>
                </>}
              </div>
            )}
            {activeTab === "overview"   && <OverviewTab clientId={selectedClientId} onTabChange={setActiveTab} />}
            {activeTab === "plan"       && <FinancialPlanTab clientId={selectedClientId} clientName={(selectedClient as any)?.firstName} />}
            {activeTab === "dashboard"  && activePlanId && <SimulationDashboard planId={activePlanId} />}
            {activeTab === "dashboard"  && !activePlanId && (
              <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground">
                <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No financial plan for this client</p>
                <p className="text-sm mt-1">Create a financial plan first to access the simulation dashboard</p>
              </div>
            )}
            {activeTab === "networth"   && <NetWorthTab clientId={selectedClientId} />}
            {activeTab === "retirement" && <RetirementTab clientId={selectedClientId} clientName={(selectedClient as any)?.firstName} />}
            {activeTab === "insurance"  && <InsuranceTab clientId={selectedClientId} planId={activePlanId} client={selectedClient} />}
            {activeTab === "resp"       && <RESPTab clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "debt"       && <DebtTab clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "tax"        && <TaxTab clientId={selectedClientId} client={selectedClient} person={person} />}
            {activeTab === "estate"     && <EstateNotesTab clientId={selectedClientId} planId={activePlanId} />}
            {activeTab === "ai"         && <AITab clientId={selectedClientId} />}
          </>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center py-16">
              <FileText className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-muted-foreground">Select a Client</h2>
              <p className="text-muted-foreground mt-2">Choose a client from the sidebar to view their financial plan.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function FinancialPlanning() {
  return <FinancialPlanningContent />;
}
