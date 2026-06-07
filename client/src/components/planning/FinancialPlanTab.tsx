import { useState, useEffect } from "react";
import { translations, type T } from "../../i18n/translations";
import {
  Sparkles, RefreshCw, ChevronDown, ChevronUp, CheckCircle,
  AlertTriangle, XCircle, Clock, TrendingUp, Shield, CreditCard,
  Receipt, BarChart3, ScrollText, GraduationCap, Target, FileText,
  Loader2, Calendar, ArrowRight, Star, Printer, Trash2, History,
} from "lucide-react";

// Print styles — injected once into the document head
const PRINT_STYLES = `
@media print {
  /* Hide app chrome */
  body > div > aside,
  body > div > header,
  .fp-print-hide { display: none !important; }
  /* Show plan content properly */
  #fp-plan-print-root { display: block !important; }
  .fp-section-card { page-break-inside: avoid; margin-bottom: 16px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  .fp-section-expanded { display: block !important; }
  .fp-priority-actions { page-break-inside: avoid; }
}
`;

// ── Types ────────────────────────────────────────────────────────────────────

interface Recommendation {
  priority:  "high" | "medium" | "low";
  action:    string;
  impact:    string;
  timeline:  string;
}

interface PlanSection {
  id:              string;
  title:           string;
  score:           number;
  status:          "on_track" | "needs_attention" | "at_risk" | "not_started";
  narrative:       string;
  recommendations: Recommendation[];
}

interface PriorityAction {
  rank:        number;
  title:       string;
  description: string;
  section:     string;
  priority:    string;
  timeline:    string;
}

interface FinancialPlan {
  generatedAt:   string;
  clientId:      number;
  clientName:    string;
  dataSnapshot:  { netWorth: number; totalDebt: number; successRate: number | null };
  executiveSummary: {
    score:        number;
    headline:     string;
    narrative:    string;
    keyStrengths: string[];
    keyGaps:      string[];
  };
  sections:        PlanSection[];
  priorityActions: PriorityAction[];
  disclaimer:      string;
}

interface SavedPlan {
  id:        number;
  title:     string;
  createdAt: string;
  plan:      FinancialPlan | null;
}

// ── Normalize plan from Claude (handles array narratives, numeric priorities) ─

function toStr(v: any): string {
  if (Array.isArray(v)) return v.map(s => String(s ?? "").trim()).filter(Boolean).join("\n\n");
  return String(v ?? "");
}

function toPriority(v: any): "high" | "medium" | "low" {
  if (typeof v === "number") return v <= 1 ? "high" : v <= 3 ? "medium" : "low";
  const s = String(v ?? "medium").toLowerCase();
  if (s === "high" || s === "1" || s === "critical") return "high";
  if (s === "low"  || s === "4" || s === "5")        return "low";
  return "medium";
}

function normalizePlan(raw: any): FinancialPlan {
  const es = raw?.executiveSummary ?? {};
  return {
    ...raw,
    executiveSummary: {
      score:        Number(es.score ?? 3),
      headline:     toStr(es.headline),
      narrative:    toStr(es.narrative),
      keyStrengths: (Array.isArray(es.keyStrengths) ? es.keyStrengths : []).map(toStr),
      keyGaps:      (Array.isArray(es.keyGaps)      ? es.keyGaps      : []).map(toStr),
    },
    sections: (Array.isArray(raw?.sections) ? raw.sections : []).map((s: any) => ({
      ...s,
      narrative:       toStr(s.narrative),
      recommendations: (Array.isArray(s.recommendations) ? s.recommendations : []).map((r: any) => ({
        ...r,
        priority: toPriority(r.priority),
        action:   toStr(r.action),
        impact:   toStr(r.impact),
        timeline: toStr(r.timeline),
      })),
    })),
    priorityActions: (Array.isArray(raw?.priorityActions) ? raw.priorityActions : []).map((a: any) => ({
      ...a,
      priority:    toPriority(a.priority),
      description: toStr(a.description),
      title:       toStr(a.title),
      timeline:    toStr(a.timeline),
    })),
    disclaimer: toStr(raw?.disclaimer),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const token = () => localStorage.getItem("fp_token") ?? "";

const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");

const SECTION_ICONS: Record<string, any> = {
  retirement:        TrendingUp,
  risk_management:   Shield,
  debt_cashflow:     CreditCard,
  tax_efficiency:    Receipt,
  investment_strategy: BarChart3,
  estate_planning:   ScrollText,
  education:         GraduationCap,
  goals:             Target,
};

const STATUS_CONFIG = {
  on_track:        { label: "On Track",        color: "text-green-700",  bg: "bg-green-50  border-green-200",  icon: CheckCircle,    dot: "bg-green-500" },
  needs_attention: { label: "Needs Attention", color: "text-amber-700",  bg: "bg-amber-50  border-amber-200",  icon: AlertTriangle,  dot: "bg-amber-500" },
  at_risk:         { label: "At Risk",         color: "text-red-700",    bg: "bg-red-50    border-red-200",    icon: XCircle,        dot: "bg-red-500" },
  not_started:     { label: "Not Started",     color: "text-gray-500",   bg: "bg-gray-50   border-gray-200",   icon: Clock,          dot: "bg-gray-300" },
};

const PRIORITY_CONFIG = {
  high:   { color: "text-red-700   bg-red-50   border-red-200",   dot: "bg-red-500" },
  medium: { color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500" },
  low:    { color: "text-blue-700  bg-blue-50  border-blue-200",  dot: "bg-blue-500" },
};

const TIMELINE_LABELS: Record<string, string> = {
  immediate:  "Immediate",
  "3_months": "3 months",
  "6_months": "6 months",
  "1_year":   "1 year",
  ongoing:    "Ongoing",
};

function ScoreRing({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const color = score >= 4 ? "#16a34a" : score >= 3 ? "#d97706" : "#dc2626";
  const c = 2 * Math.PI * 20;
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="4" />
        <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-bold" style={{ color }}>{score}/5</span>
      </div>
    </div>
  );
}

// ── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ section, forceExpand = false }: { section: PlanSection; forceExpand?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isExpanded = expanded || forceExpand;
  const Icon   = SECTION_ICONS[section.id] ?? Target;
  const status = STATUS_CONFIG[section.status] ?? STATUS_CONFIG.needs_attention;
  const StatusIcon = status.icon;

  return (
    <div className={`fp-section-card border rounded-xl overflow-hidden transition-all ${status.bg}`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-80 transition-opacity fp-print-hide"
      >
        <ScoreRing score={section.score} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Icon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
            <span className="font-semibold text-gray-900 text-sm">{section.title}</span>
            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.color} ${status.bg}`}>
              <StatusIcon className="w-2.5 h-2.5" />
              {status.label}
            </span>
          </div>
          {!isExpanded && (
            <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{(String(section.narrative ?? "")).split("\n")[0].slice(0, 120)}...</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          <span className="text-[10px] text-gray-400">{section.recommendations.length} rec{section.recommendations.length !== 1 ? "s" : ""}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-white/50 pt-3 fp-section-expanded">
          {/* Narrative */}
          <div className="prose prose-sm max-w-none mb-4">
            {(String(section.narrative ?? "")).split("\n\n").map((para, i) => (
              para.trim() && <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{para.trim()}</p>
            ))}
          </div>

          {/* Recommendations */}
          {section.recommendations.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Recommendations</p>
              {section.recommendations.map((rec, i) => {
                const p = PRIORITY_CONFIG[rec.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.medium;
                const priorityLabel = String(rec.priority ?? "medium").toUpperCase();
                return (
                  <div key={i} className="bg-white rounded-lg border border-white/80 p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${p.color}`}>
                            {priorityLabel}
                          </span>
                          <span className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar className="w-2.5 h-2.5" />
                            {TIMELINE_LABELS[rec.timeline] ?? rec.timeline}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{rec.action}</p>
                        {rec.impact && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            <span className="font-medium text-green-700">Impact:</span> {rec.impact}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Priority Actions ──────────────────────────────────────────────────────────

function PriorityActionsPanel({ actions }: { actions: PriorityAction[] }) {
  return (
    <div className="bg-[#0c1e3a] rounded-xl p-4 text-white">
      <div className="flex items-center gap-2 mb-3">
        <Star className="w-4 h-4 text-yellow-400" />
        <h3 className="font-bold text-sm">Top Priority Actions</h3>
        <span className="text-[10px] text-white/50 ml-auto">Ranked by impact</span>
      </div>
      <div className="space-y-2">
        {actions.map(action => {
          const isHigh = action.priority === "high";
          return (
            <div key={action.rank} className="flex items-start gap-3 bg-white/10 rounded-lg px-3 py-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold mt-0.5 ${
                isHigh ? "bg-red-400 text-white" : "bg-white/20 text-white"
              }`}>
                {action.rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">{action.title}</p>
                <p className="text-xs text-white/80 mt-0.5 leading-relaxed">{action.description}</p>
              </div>
              <div className="text-[9px] text-white/40 flex-shrink-0 mt-0.5">
                {TIMELINE_LABELS[action.timeline] ?? action.timeline}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Overall Score Card ────────────────────────────────────────────────────────

function OverallScoreCard({ plan }: { plan: FinancialPlan }) {
  const { executiveSummary: es, dataSnapshot: ds } = plan;
  const color = es.score >= 4 ? "text-green-600" : es.score >= 3 ? "text-amber-600" : "text-red-600";
  const bg    = es.score >= 4 ? "bg-green-50 border-green-200" : es.score >= 3 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`border rounded-xl p-4 ${bg}`}>
      <div className="flex items-start gap-4">
        {/* Big score */}
        <div className="text-center flex-shrink-0">
          <div className={`text-4xl font-bold ${color}`}>{es.score}<span className="text-lg text-gray-400">/5</span></div>
          <p className="text-[10px] text-gray-500 mt-1">Overall</p>
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${color} mb-1`}>{es.headline}</p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt$(ds.netWorth)}</p>
              <p className="text-[10px] text-gray-400">Net Worth</p>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-gray-900">{fmt$(ds.totalDebt)}</p>
              <p className="text-[10px] text-gray-400">Total Debt</p>
            </div>
            <div className="text-center">
              <p className={`text-sm font-bold ${ds.successRate !== null ? (ds.successRate >= 85 ? "text-green-600" : ds.successRate >= 70 ? "text-amber-600" : "text-red-600") : "text-gray-400"}`}>
                {ds.successRate !== null ? `${ds.successRate.toFixed(0)}%` : "—"}
              </p>
              <p className="text-[10px] text-gray-400">Retirement Success</p>
            </div>
          </div>
        </div>
      </div>

      {/* Section score summary */}
      <div className="mt-3 pt-3 border-t border-white/50">
        <div className="grid grid-cols-4 gap-1.5">
          {plan.sections.slice(0, 8).map(s => {
            const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.needs_attention;
            return (
              <div key={s.id} className="text-center">
                <div className={`w-2 h-2 rounded-full mx-auto mb-0.5 ${sc.dot}`} />
                <p className="text-[9px] text-gray-500 leading-tight">{(s.title ?? "").split(" ")[0]}</p>
                <p className="text-[9px] font-bold text-gray-700">{s.score}/5</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Executive Summary ─────────────────────────────────────────────────────────

function ExecutiveSummary({ es }: { es: FinancialPlan["executiveSummary"] }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-3">Executive Summary</p>
      <div className="space-y-2 mb-4">
        {String(es.narrative ?? "").split("\n\n").map((para, i) => (
          para.trim() && <p key={i} className="text-sm text-gray-700 leading-relaxed">{para.trim()}</p>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide mb-1.5">Key Strengths</p>
          <ul className="space-y-1">
            {es.keyStrengths.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-bold text-red-700 uppercase tracking-wide mb-1.5">Key Gaps</p>
          <ul className="space-y-1">
            {es.keyGaps.map((g, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                <ArrowRight className="w-3 h-3 text-red-500 flex-shrink-0 mt-0.5" />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FinancialPlanTab({ clientId, clientName, t = translations.en }: { clientId: number; clientName?: string; t?: T }) {
  const [plan, setPlan]               = useState<FinancialPlan | null>(null);
  const [saved, setSaved]             = useState<SavedPlan[]>([]);
  const [loading, setLoading]         = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [view, setView]               = useState<"plan" | "history">("plan");
  const [expandAll, setExpandAll]     = useState(false);
  const [streamProgress, setStreamProgress] = useState<string>("");

  // Inject print styles once
  useEffect(() => {
    const id = "fp-plan-print-styles";
    if (!document.getElementById(id)) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `@media print { .fp-print-hide { display: none !important; } }`;
      document.head.appendChild(style);
    }
  }, []);

  const [printing, setPrinting] = useState(false);

  async function printPlan() {
    if (!plan) return;
    setPrinting(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/financial-plan-report`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      if (!res.ok) { let msg = t.plan.error; try { const e = await res.json(); msg = e.message ?? msg; } catch {} throw new Error(msg); }
      const pdfBlob = await res.blob();
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.download = `${clientName ?? "Financial_Plan"}_${new Date().toISOString().slice(0,10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setPrinting(false);
    }
  }

  useEffect(() => { loadSaved(); }, [clientId]);

  function loadFromHistory(s: SavedPlan) {
    console.log("[load-history] plan:", s.plan ? "exists" : "null", "keys:", s.plan ? Object.keys(s.plan) : []);
    if (s.plan) { setPlan(normalizePlan(s.plan)); setView("plan"); }
    else { setError("This saved plan could not be loaded — the data may be corrupted."); }
  }

  async function loadSaved() {
    setLoadingSaved(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/saved-plans`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (res.ok) setSaved(await res.json());
    } catch {}
    finally { setLoadingSaved(false); }
  }

  async function generate() {
    setLoading(true);
    setError(null);
    setStreamProgress("");

    try {
      const res = await fetch(`/api/clients/${clientId}/generate-plan-stream`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body:    JSON.stringify({}),
      });

      if (!res.ok || !res.body) {
        let message = `Generation failed (${res.status})`;
        try { const e = await res.json(); message = e.message ?? message; } catch {}
        throw new Error(message);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";
      let charCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (!payload) continue;

          if (payload.startsWith("[ERROR]::")) {
            throw new Error(payload.slice(9));
          }

          if (payload.startsWith("[DONE]::")) {
            // Decode the complete plan JSON from base64
            const doneBytes = Uint8Array.from(atob(payload.slice(8)), c => c.charCodeAt(0));
            const planJson = JSON.parse(new TextDecoder("utf-8").decode(doneBytes));
            setPlan(normalizePlan(planJson));
            setView("plan");
            setStreamProgress("");
            await loadSaved();
            return;
          }

          // Regular chunk — base64-encoded text fragment
          try {
            const chunk = atob(payload);
            charCount += chunk.length;
            setStreamProgress(`Writing plan… ${charCount.toLocaleString()} chars`);
          } catch { /* ignore decode errors on partial chunks */ }
        }
      }

      throw new Error("Stream ended without a complete plan. Please try again.");

    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
      setStreamProgress("");
    }
  }

  async function deleteSaved(id: number) {
    if (!confirm("Delete this saved plan?")) return;
    await fetch(`/api/saved-plans/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token()}` },
    });
    await loadSaved();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between fp-print-hide">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t.plan.title}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {t.plan.aiGeneratedDesc}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {plan && (
            <>
              <button onClick={() => setExpandAll(v => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
                {expandAll ? "Collapse all" : t.plan.expandAll}
              </button>
              <button onClick={printPlan} disabled={printing}
                className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg disabled:opacity-50">
                {printing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
                {printing ? t.common.saving : t.plan.print}
              </button>
            </>
          )}
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-xl text-sm"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating plan…</>
              : <><Sparkles className="w-4 h-4" /> {plan ? t.plan.regenerate : t.plan.generate}</>
            }
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Loader2 className="w-8 h-8 text-[#0c1e3a] animate-spin mx-auto mb-4" />
          <p className="font-semibold text-gray-700">Analysing client data…</p>
          <p className="text-sm text-gray-400 mt-1">
            {streamProgress || "Connecting to Claude…"}
          </p>
          <div className="mt-4 flex justify-center gap-1 flex-wrap">
            {["Net Worth", "Retirement", "Insurance", "Debt", "Tax", "Estate", "Goals", "Education"].map(a => (
              <span key={a} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
          {streamProgress && (
            <div className="mt-3 w-48 mx-auto bg-gray-100 rounded-full h-1.5 overflow-hidden">
              <div className="h-full bg-[#0c1e3a] rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      {(plan || saved.length > 0) && !loading && (
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button onClick={() => setView("plan")}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "plan" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            Current Plan
          </button>
          <button onClick={() => setView("history")}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${view === "history" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
            History ({saved.length})
          </button>
        </div>
      )}

      {/* History view */}
      {view === "history" && (
        <div className="space-y-3">
          <p className="text-xs text-gray-400">Previously generated plans — click Load to view or regenerate from current data.</p>
          {loadingSaved && <p className="text-sm text-gray-400">Loading…</p>}
          {saved.length === 0 && !loadingSaved && (
            <div className="text-center py-8 text-sm text-gray-400">No saved plans yet — generate one above.</div>
          )}
          {saved.map(s => {
            const p = s.plan;
            const score = p?.executiveSummary?.score;
            const scoreColor = score ? (score >= 4 ? "text-green-600" : score >= 3 ? "text-amber-600" : "text-red-600") : "text-gray-400";
            const sections = p?.sections?.length ?? 0;
            const actions  = p?.priorityActions?.length ?? 0;
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {score && <span className={`text-lg font-bold ${scoreColor}`}>{score}/5</span>}
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                      <p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => loadFromHistory(s)}
                      className="text-xs text-[#0c1e3a] font-semibold border border-[#0c1e3a]/20 px-3 py-1.5 rounded-lg hover:bg-[#0c1e3a]/5">
                      Load
                    </button>
                    <button onClick={() => deleteSaved(s.id)}
                      className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </div>
                {p && (
                  <div className="px-4 py-3">
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{p.executiveSummary?.headline}</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                        <p className="text-sm font-bold text-gray-900">{fmt$(p.dataSnapshot?.netWorth ?? 0)}</p>
                        <p className="text-[10px] text-gray-400">Net Worth</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                        <p className="text-sm font-bold text-gray-900">{sections}</p>
                        <p className="text-[10px] text-gray-400">Sections</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
                        <p className="text-sm font-bold text-gray-900">{actions}</p>
                        <p className="text-[10px] text-gray-400">Priority Actions</p>
                      </div>
                    </div>
                    {/* Section score dots */}
                    {p.sections && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {p.sections.map((sec: any) => {
                          const st = STATUS_CONFIG[sec.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.needs_attention;
                          return (
                            <span key={sec.id} className={`text-[9px] px-2 py-0.5 rounded-full border font-semibold ${st.bg} ${st.color}`}>
                              {(sec.title ?? "").split(" ")[0]} {sec.score}/5
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Plan view */}
      {view === "plan" && plan && !loading && (
        <div id="fp-plan-print-root" className="space-y-4">
          {/* Print header — only shows when printing */}
          <div className="hidden print:block mb-4 pb-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Financial Plan — {plan.clientName}</h1>
            <p className="text-sm text-gray-500">Generated {new Date(plan.generatedAt).toLocaleDateString("en-CA", { dateStyle: "long" })}</p>
          </div>

          {/* Generated at */}
          <p className="text-[10px] text-gray-400 fp-print-hide">
            Generated {new Date(plan.generatedAt).toLocaleString("en-CA")} for {plan.clientName}
          </p>

          {/* Overall score */}
          {plan.executiveSummary && <OverallScoreCard plan={plan} />}

          {/* Executive summary */}
          {plan.executiveSummary && <ExecutiveSummary es={plan.executiveSummary} />}

          {/* Priority actions */}
          {plan.priorityActions?.length > 0 && (
            <div className="fp-priority-actions">
              <PriorityActionsPanel actions={plan.priorityActions} />
            </div>
          )}

          {/* Section cards */}
          {plan.sections?.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2 fp-print-hide">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Planning Sections</p>
              </div>
              <div className="space-y-2">
                {plan.sections.map(section => (
                  <SectionCard key={section.id} section={section} forceExpand={expandAll} />
                ))}
              </div>
            </div>
          )}

          {/* Show raw if structure is unexpected */}
          {!plan.executiveSummary && !plan.sections && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-700 font-semibold mb-2">Plan structure unexpected</p>
              <pre className="text-xs text-gray-600 overflow-auto max-h-96">{JSON.stringify(plan, null, 2)}</pre>
            </div>
          )}

          {/* Disclaimer */}
          {plan.disclaimer && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[10px] text-gray-400 leading-relaxed">{plan.disclaimer}</p>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!plan && !loading && (
        <div className="bg-white border border-dashed border-gray-200 rounded-xl p-12 text-center">
          <Sparkles className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="font-semibold text-gray-500">{t.plan.noPlanYet}</p>
          <p className="text-sm text-gray-400 mt-1 mb-5">
            {t.plan.generatePlanHint}
          </p>
          <button onClick={generate} disabled={loading}
            className="inline-flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
            <Sparkles className="w-4 h-4" />
            {t.plan.generateFinancialPlan}
          </button>
        </div>
      )}
    </div>
  );
}
