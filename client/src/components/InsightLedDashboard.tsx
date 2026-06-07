import { useEffect, useState, useMemo } from "react";
import {
  Users, Brain, Shield, TrendingUp, ArrowRight, Target, Calendar, Info,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api } from "../lib/api";
import { translations, type T } from "../i18n/translations";
import "./InsightLedDashboard.css";

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  annualIncome: string | null;
  spouseFirstName: string | null;
  spouseLastName: string | null;
  spouseDateOfBirth: string | null;
  spouseAnnualIncome: string | null;
  retirementAge: number | null;
}

interface Overview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  totalDebt: number;
  retirementProjections: number;
  insuranceAnalyses: number;
  educationPlans: number;
  taxNotes: number;
  estateNotes: number;
  aiRecommendations: number;
  pendingAi: number;
  plans: number;
}

interface NWEntry {
  id: number;
  type: string;
  category: string;
  name: string;
  value: string;
}

const COLORS = {
  cyan: "#06b6d4",
  purple: "#8b5cf6",
  blue: "#2563eb",
  green: "#10b981",
  amber: "#f59e0b",
  rose: "#f43f5e",
  base: "#ffffff",
  border: "rgba(15,23,42,0.08)",
  tick: "rgba(71,85,105,0.7)",
  cursor: "rgba(15,23,42,0.04)",
};

const CATEGORY_COLORS: Record<string, string> = {
  "RRSP": "#60a5fa",
  "TFSA": "#22d3ee",
  "Non-Registered": "#c084fc",
  "Real Estate": "#34d399",
  "Business": "#fbbf24",
  "Cash/Bank": "#f43f5e",
  "Other Asset": "#a78bfa",
};

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value.toFixed(0)}`;
}

interface ScorecardItem {
  label: string;
  grade: string;
  pct: number;
  color: string;
  caption: string;
}

function buildScorecard(ov: Overview, t: T): ScorecardItem[] {
  const cyan = "var(--accent-cyan)";
  const blue = "var(--accent-blue)";
  const green = "var(--accent-green)";
  const amber = "var(--accent-amber)";
  const rose = "var(--accent-rose)";

  const grade = (count: number, full = 1): { g: string; pct: number; color: string } => {
    if (count >= full + 1) return { g: "A", pct: 95, color: green };
    if (count >= full) return { g: "A-", pct: 82, color: green };
    if (count >= 1) return { g: "B", pct: 70, color: amber };
    return { g: "C", pct: 45, color: rose };
  };

  const retirement = grade(ov.retirementProjections);
  const insurance = grade(ov.insuranceAnalyses);
  const tax = grade(ov.taxNotes);
  const estate = grade(ov.estateNotes);
  const cashFlow =
    ov.netWorth > 0
      ? { g: "A", pct: 95, color: cyan }
      : ov.netWorth >= 0
      ? { g: "B+", pct: 80, color: blue }
      : { g: "C", pct: 40, color: rose };

  return [
    { label: t.dashboard.retirement, grade: retirement.g, pct: retirement.pct, color: retirement.color, caption: ov.retirementProjections ? `${ov.retirementProjections} projection(s)` : t.dashboard.notStarted },
    { label: t.dashboard.insurance,  grade: insurance.g,  pct: insurance.pct,  color: insurance.color,  caption: ov.insuranceAnalyses ? `${ov.insuranceAnalyses} analysis` : t.dashboard.noCoverageReview },
    { label: t.dashboard.tax,        grade: tax.g,        pct: tax.pct,        color: tax.color,        caption: ov.taxNotes ? `${ov.taxNotes} note(s)` : t.dashboard.roomAvailable },
    { label: t.dashboard.estate,     grade: estate.g,     pct: estate.pct,     color: estate.color,     caption: ov.estateNotes ? `${ov.estateNotes} note(s)` : t.dashboard.willsOutdated },
    { label: t.dashboard.cashFlow,   grade: cashFlow.g,   pct: cashFlow.pct,   color: cashFlow.color,   caption: ov.netWorth >= 0 ? t.dashboard.positive : t.dashboard.negative },
  ];
}

interface Insight {
  icon: typeof Target;
  color: string;
  title: string;
  body: string;
  cta: string;
  /** Destination sidebar tab key (matches App.tsx Tab type). */
  target: "retirementhub" | "protection" | "ai" | "fp" | "documents" | "networth" | "goals" | "expenses" | "taxestate";
  glow?: boolean;
}

function buildInsights(ov: Overview, t: T): Insight[] {
  const insights: Insight[] = [];

  if (ov.retirementProjections === 0) {
    insights.push({
      icon: Target,
      color: COLORS.cyan,
      title: t.dashboard.buildRetirementTitle,
      body:  t.dashboard.buildRetirementBody,
      cta:   t.dashboard.buildRetirementCta,
      target: "retirementhub",
      glow: true,
    });
  } else {
    insights.push({
      icon: Target,
      color: COLORS.cyan,
      title: t.dashboard.buildRetirementTitle,
      body: `${ov.retirementProjections} projection(s) on file.`,
      cta:   t.dashboard.buildRetirementCta,
      target: "retirementhub",
      glow: true,
    });
  }

  if (ov.insuranceAnalyses === 0) {
    insights.push({
      icon: Shield,
      color: COLORS.rose,
      title: t.dashboard.runInsuranceTitle,
      body:  t.dashboard.runInsuranceBody,
      cta:   t.dashboard.runInsuranceCta,
      target: "protection",
    });
  } else {
    insights.push({
      icon: Shield,
      color: COLORS.rose,
      title: t.dashboard.runInsuranceTitle,
      body: `${ov.insuranceAnalyses} analysis on file.`,
      cta:   t.dashboard.runInsuranceCta,
      target: "protection",
    });
  }

  if (ov.aiRecommendations > 0 || ov.pendingAi > 0) {
    insights.push({
      icon: TrendingUp,
      color: COLORS.green,
      title: t.dashboard.generateAiTitle,
      body: `${ov.aiRecommendations} recommendation(s) generated, ${ov.pendingAi} pending review.`,
      cta:   t.dashboard.generateAiCta,
      target: "ai",
    });
  } else {
    insights.push({
      icon: TrendingUp,
      color: COLORS.green,
      title: t.dashboard.generateAiTitle,
      body:  t.dashboard.generateAiBody,
      cta:   t.dashboard.generateAiCta,
      target: "ai",
    });
  }

  return insights;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const bigint = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export interface InsightLedDashboardProps {
  clientId: number;
  client: Client;
  onNavigate?: (tab: string) => void;
  t?: T;
}

export function InsightLedDashboard({ clientId, client, onNavigate, t = translations.en }: InsightLedDashboardProps) {
  const [ov, setOv] = useState<Overview | null>(null);
  const [nw, setNw] = useState<NWEntry[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errMsg, setErrMsg] = useState<string>("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<Overview>(`/api/clients/${clientId}/overview`),
      api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`).catch(() => [] as NWEntry[]),
    ])
      .then(([overview, entries]) => {
        if (!alive) return;
        setOv(overview);
        setNw(entries);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setErrMsg(err?.message || t.dashboard.failedLoad);
        setStatus("error");
      });
    return () => { alive = false; };
  }, [clientId]);

  const headerInfo = useMemo(() => {
    const a1 = ageFromDob(client.dateOfBirth);
    const a2 = ageFromDob(client.spouseDateOfBirth);
    const ages = a1 != null && a2 != null ? `Ages ${a1} & ${a2}` : a1 != null ? `Age ${a1}` : t.common.ageShort;
    const inc1 = Number(client.annualIncome ?? 0);
    const inc2 = Number(client.spouseAnnualIncome ?? 0);
    const totalIncome = inc1 + inc2;
    const incomeStr = totalIncome > 0 ? `Income ${formatCompact(totalIncome)}/yr` : t.common.incomeShort;
    const fullName = client.spouseFirstName
      ? `${client.firstName} & ${client.spouseFirstName} ${client.lastName}`
      : `${client.firstName} ${client.lastName}`;
    return { fullName, ages, incomeStr, totalIncome };
  }, [client]);

  const trendData = useMemo(() => {
    if (!ov) return [];
    const current = ov.netWorth || 0;
    const years = ["2020", "2021", "2022", "2023", "2024", t.dashboard.currentLabel];
    return years.map((label, i) => ({
      year: label,
      value: Math.round(current * (0.6 + (i / (years.length - 1)) * 0.4)),
    }));
  }, [ov]);

  const allocationData = useMemo(() => {
    const assets = nw.filter(e => e.type === "asset");
    const totals: Record<string, number> = {};
    for (const a of assets) {
      const v = safeNum(a.value);
      if (v <= 0) continue;
      totals[a.category] = (totals[a.category] || 0) + v;
    }
    return Object.entries(totals)
      .map(([name, value]) => ({ name, value, color: CATEGORY_COLORS[name] || "#a78bfa" }))
      .sort((a, b) => b.value - a.value);
  }, [nw]);

  const investedPct = useMemo(() => {
    const totalAssets = safeNum(ov?.totalAssets);
    if (totalAssets <= 0) return 0;
    const investable = nw
      .filter(e => e.type === "asset" && ["RRSP", "TFSA", "Non-Registered"].includes(e.category))
      .reduce((s, e) => s + safeNum(e.value), 0);
    const pct = Math.round((investable / totalAssets) * 100);
    return Number.isFinite(pct) ? pct : 0;
  }, [nw, ov]);

  const cashFlowData = useMemo(() => {
    const monthlyIncome = headerInfo.totalIncome > 0 ? Math.round(headerInfo.totalIncome / 12) : 0;
    const monthlyExpense = monthlyIncome > 0 ? Math.round(monthlyIncome * 0.7) : 0;
    const months = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];
    return months.map(m => ({
      month: m,
      income: monthlyIncome,
      expenses: monthlyExpense,
    }));
  }, [headerInfo]);

  const scorecard = useMemo(() => (ov ? buildScorecard(ov, t) : []), [ov, t]);
  const insights = useMemo(() => (ov ? buildInsights(ov, t) : []), [ov]);

  if (status === "loading") {
    return (
      <div className="fp-insightled flex items-center justify-center h-full">
        <div className="text-[var(--text-secondary)] text-sm font-mono">Loading dashboard…</div>
      </div>
    );
  }

  if (status === "error" || !ov) {
    return (
      <div className="fp-insightled flex items-center justify-center h-full">
        <div className="fp-insightled-card p-6 max-w-md text-center">
          <div className="text-[var(--accent-rose)] text-sm font-bold mb-2">{t.dashboard.couldNotLoad}</div>
          <div className="text-[var(--text-secondary)] text-xs">{errMsg || t.dashboard.pleaseRetry}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fp-insightled">
      <div className="px-8 py-6 flex items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-[2px] shadow-sm">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center">
              <Users className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {headerInfo.fullName}
            </h1>
            <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
              <span className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {headerInfo.ages}</span>
              <span>•</span>
              <span>{headerInfo.incomeStr}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => onNavigate?.("documents")}
            className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-sm font-medium text-slate-700 hover:border-cyan-400 hover:text-cyan-700 shadow-sm transition-all"
          >
            {t.dashboard.scheduleReview}
          </button>
          <button
            onClick={() => onNavigate?.("fp")}
            className="px-4 py-2 rounded-lg bg-brand-gradient hover:bg-brand-gradient-hover text-white text-sm font-semibold shadow-sm transition-all"
          >
            {t.dashboard.generatePlan}
          </button>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Brain className="w-5 h-5 text-[var(--accent-purple)]" />
              <span className="text-gradient-ai font-bold">{t.dashboard.copilotInsights}</span>
            </h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {insights.map((ins, i) => {
              const Icon = ins.icon;
              return (
                <div
                  key={i}
                  className={`fp-insightled-card p-5 ${ins.glow ? "fp-insightled-ai-glow" : ""}`}
                  style={ins.glow ? { borderColor: "rgba(34,211,238,0.3)" } : undefined}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="p-2 rounded-lg shrink-0"
                      style={{ background: hexToRgba(ins.color, 0.15), color: ins.color }}
                    >
                      <Icon className="w-5 h-5" style={{ color: ins.color }} />
                    </div>
                    <div>
                      <h3 className="font-medium text-sm text-[var(--text-primary)] mb-1">{ins.title}</h3>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-3">{ins.body}</p>
                      <button
                        onClick={() => onNavigate?.(ins.target)}
                        className="text-xs font-medium flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
                        style={{ color: ins.color }}
                      >
                        {ins.cta} <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="fp-insightled-card p-6">
          <h2 className="text-sm font-semibold text-[var(--text-secondary)] mb-6 uppercase tracking-widest">{t.dashboard.planHealthScorecard}</h2>
          <div className="grid grid-cols-5 gap-6 divide-x divide-[var(--border-subtle)]">
            {scorecard.map((s, i) => (
              <div key={s.label} className={`px-4 ${i === 0 ? "first:pl-0" : ""} ${i === scorecard.length - 1 ? "pr-0" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">{s.label}</span>
                  <span className="text-xl font-bold font-mono" style={{ color: s.color }}>{s.grade}</span>
                </div>
                <div className="h-1.5 w-full bg-[var(--bg-base)] rounded-full mb-2 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                </div>
                <span className="text-xs text-[var(--text-tertiary)]">{s.caption}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-8 fp-insightled-card p-6 min-h-[350px]">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest">{t.dashboard.currentNetWorth}</h2>
                <div className="text-3xl font-bold mt-1 tracking-tight font-mono text-[var(--text-primary)]">{formatCurrency(ov.netWorth)}</div>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-[var(--text-tertiary)]">
                  <Info className="w-3 h-3" />
                  <span>{t.dashboard.trendCurveNote}</span>
                </div>
              </div>
              <span
                className="px-2 py-1 rounded text-[10px] font-mono font-medium uppercase tracking-wider"
                style={{ backgroundColor: "rgba(15,23,42,0.06)", color: "#475569" }}
              >
                {t.dashboard.snapshot}
              </span>
            </div>
            <div className="w-full" style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ild-nw" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                  <XAxis dataKey={t.common.year} axisLine={false} tickLine={false} tick={{ fill: COLORS.tick, fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.tick, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} dx={-10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid rgba(15,23,42,0.1)", borderRadius: "8px", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", color: "#0f172a" }}
                    itemStyle={{ color: "#0f172a", fontFamily: "JetBrains Mono, ui-monospace, monospace" }}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Area type="monotone" dataKey="value" stroke={COLORS.cyan} strokeWidth={3} fillOpacity={1} fill="url(#ild-nw)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="col-span-4 fp-insightled-card p-6">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-6">{t.dashboard.assetAllocation}</h2>
            <div className="w-full relative" style={{ height: 200 }}>
              {allocationData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)] text-center px-4">
                  {t.dashboard.noAssetsForAllocation}
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={allocationData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke={t.report.none}>
                        {allocationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        wrapperStyle={{ zIndex: 50 }}
                        contentStyle={{ backgroundColor: "#ffffff", border: "1px solid rgba(15,23,42,0.1)", borderRadius: "8px", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", color: "#0f172a" }}
                        itemStyle={{ fontFamily: "Space Mono" }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ height: "100%", zIndex: 0 }}>
                    <span className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wider">{t.dashboard.invested}</span>
                    <span className="text-lg font-bold font-mono text-[var(--accent-blue)]">{investedPct}%</span>
                  </div>
                </>
              )}
            </div>
            {allocationData.length > 0 && (
              <div className="mt-4 space-y-2">
                {allocationData.map(item => (
                  <div key={item.name} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-[var(--text-secondary)]">{item.name}</span>
                    </div>
                    <span className="font-mono text-[var(--text-primary)]">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="col-span-6 fp-insightled-card p-6 min-h-[300px]">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-6">{t.dashboard.cashFlowEstimated}</h2>
            <div className="w-full relative" style={{ height: 220 }}>
              {headerInfo.totalIncome === 0 ? (
                <div className="flex items-center justify-center h-full text-xs text-[var(--text-tertiary)] text-center">
                  {t.dashboard.addIncomeForCashFlow}
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cashFlowData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: COLORS.tick, fontSize: 12 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: COLORS.tick, fontSize: 12 }} tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip
                      cursor={{ fill: COLORS.cursor }}
                      contentStyle={{ backgroundColor: "#ffffff", border: "1px solid rgba(15,23,42,0.1)", borderRadius: "8px", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", color: "#0f172a" }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: "12px", paddingTop: "10px" }} />
                    <Bar dataKey="income" name={t.common.income} fill={COLORS.blue} radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expenses" name={t.dashboard.expensesEst} fill={COLORS.rose} radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="col-span-6 fp-insightled-card p-6 flex flex-col">
            <h2 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-widest mb-6">{t.dashboard.planModuleCoverage}</h2>

            <div className="space-y-6 flex-1">
              <ModuleProgress
                label={t.dashboard.retirementProjections}
                count={ov.retirementProjections}
                target={1}
                color="var(--accent-cyan)"
              />
              <ModuleProgress
                label={t.dashboard.insuranceAnalyses}
                count={ov.insuranceAnalyses}
                target={1}
                color="var(--accent-purple)"
              />
              <ModuleProgress
                label={t.dashboard.educationPlans}
                count={ov.educationPlans}
                target={1}
                color="var(--accent-green)"
              />
              <ModuleProgress
                label={t.dashboard.taxEstateNotes}
                count={ov.taxNotes + ov.estateNotes}
                target={2}
                color="var(--accent-amber)"
              />

              <div className="pt-4 border-t border-[var(--border-subtle)]">
                <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-3">{t.dashboard.quickStats}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <QuickStat label={t.dashboard.totalAssets} value={formatCurrency(ov.totalAssets)} color="var(--accent-green)" />
                  <QuickStat label={t.dashboard.totalLiabilities} value={formatCurrency(ov.totalLiabilities)} color="var(--accent-rose)" />
                  <QuickStat label={t.dashboard.plans} value={String(ov.plans)} color="var(--accent-cyan)" />
                  <QuickStat label={t.dashboard.aiRecs} value={String(ov.aiRecommendations)} color="var(--accent-purple)" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModuleProgress({ label, count, target, color }: { label: string; count: number; target: number; color: string }) {
  const pct = Math.min(100, Math.round((count / Math.max(target, 1)) * 100));
  return (
    <div>
      <div className="flex justify-between text-sm mb-2">
        <span className="font-medium flex items-center gap-2 text-[var(--text-primary)]">
          <Target className="w-4 h-4" style={{ color }} />
          {label}
        </span>
        <span className="font-mono text-[var(--text-secondary)]">
          {count} / {target}
        </span>
      </div>
      <div className="h-2 w-full bg-[var(--bg-base)] rounded-full overflow-hidden border border-[var(--border-subtle)]">
        <div className="h-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function QuickStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg-base)] rounded-lg p-3 border border-[var(--border-subtle)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1">{label}</div>
      <div className="text-sm font-mono font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
