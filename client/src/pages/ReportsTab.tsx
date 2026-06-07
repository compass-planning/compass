import { useState } from "react";
import { FileText, Download, Loader2, BookOpen, Archive, Clock, Trash2, ExternalLink } from "lucide-react";
import { translations, type T } from "../i18n/translations";

interface ReportSection {
  id: string;
  label: string;
  description: string;
  category: string;
  sections: string[];  // planning engine sections to request
}


interface SavedReport {
  id: number;
  title: string;
  locale: string;
  sections: string;
  generatedAt: string;
}

function makeReportSections(t: T): ReportSection[] {
  return [
    { id: "comprehensive",        label: t.report.comprehensivePlan,   description: t.report.comprehensiveDesc,          category: "summary",    sections: ["all"] },
    { id: "one-page",             label: t.report.onePageSummary,      description: t.report.onePageDesc,                category: "summary",    sections: ["retirement","tax","insurance"] },
    { id: "net-worth",            label: t.report.netWorthStatement,   description: t.report.netWorthStatementDesc,      category: "networth",   sections: ["networth"] },
    { id: "asset-allocation",     label: t.report.assetAllocation,     description: t.report.assetAllocationDesc,        category: "networth",   sections: ["networth"] },
    { id: "retirement",           label: t.report.retirementProjection,description: t.report.retirementProjectionDesc,   category: "retirement", sections: ["retirement","rrsp","tfsa"] },
    { id: "retirement-readiness", label: t.report.retirementReadiness, description: t.report.retirementReadinessDesc,    category: "retirement", sections: ["retirement"] },
    { id: "insurance",            label: t.report.insuranceAnalysis,   description: t.report.insuranceAnalysisDesc,      category: "insurance",  sections: ["insurance"] },
    { id: "cash-flow",            label: t.report.cashFlowReport,      description: t.report.cashFlowReportDesc,         category: "cashflow",   sections: ["cashflow","debt"] },
    { id: "goal-status",          label: t.report.goalStatus,          description: t.report.goalStatusDesc,             category: "goals",      sections: ["goals"] },
    { id: "tax-strategy",         label: t.report.taxStrategy,         description: t.report.taxStrategyDesc,            category: "taxestate",  sections: ["tax","rrsp","tfsa","capitalGains","incomeSplitting"] },
    { id: "estate-summary",       label: t.report.estateSummary,       description: t.report.estateSummaryDesc,          category: "taxestate",  sections: ["estate"] },
  ];
}

const CATEGORY_COLORS: Record<string, string> = {
  "summary":    "bg-[#0c1e3a]",
  "networth":   "bg-blue-600",
  "retirement": "bg-teal-600",
  "insurance":  "bg-purple-600",
  "cashflow":   "bg-amber-500",
  "goals":      "bg-green-600",
  "taxestate":  "bg-indigo-600",
};

const CATEGORY_ORDER = ["summary","networth","retirement","insurance","cashflow","goals","taxestate"];

export function ReportsTab({ clientId, t = translations.en, locale = 'en' }: { clientId: number; t?: T; locale?: string }) {
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [savedList, setSavedList]   = useState<SavedReport[]>([]);
  const [savedView, setSavedView]   = useState<"builder"|"saved">("builder");
  const [reportLocale, setReportLocale] = useState<string>(locale);
  const [saving, setSaving]         = useState(false);
  const [saveName, setSaveName]     = useState("");
  const [loadingSaved, setLoadingSaved] = useState(false);

  // Load saved reports
  const loadSaved = async () => {
    setLoadingSaved(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/saved-reports`,
        { headers: { Authorization: `Bearer ${token()}` } });
      if (res.ok) setSavedList(await res.json());
    } catch {}
    finally { setLoadingSaved(false); }
  };

  // Open a saved report
  const openSaved = async (id: number) => {
    try {
      const res = await fetch(`/api/saved-reports/${id}`,
        { headers: { Authorization: `Bearer ${token()}` } });
      if (!res.ok) return;
      const row = await res.json();
      const blob = new Blob([row.htmlContent], { type: "text/html" });
      const url  = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch {}
  };

  // Delete a saved report
  const deleteSaved = async (id: number) => {
    if (!confirm(t.report.deleteReportConfirm ?? "Delete this saved report?")) return;
    await fetch(`/api/saved-reports/${id}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token()}` } });
    setSavedList(prev => prev.filter(r => r.id !== id));
  };
  const REPORT_SECTIONS = makeReportSections(t);
  const CATEGORY_LABELS: Record<string, string> = {
    "summary":    t.report.catSummary,
    "networth":   t.report.catNetWorth,
    "retirement": t.report.catRetirement,
    "insurance":  t.report.catInsurance,
    "cashflow":   t.report.catCashFlow,
    "goals":      t.report.catGoals,
    "taxestate":  t.report.catTaxEstate,
  };
  const token = () => localStorage.getItem("fp_token") ?? "";

  // ── Fetch a report from the planning engine ─────────────────────────────────
  async function fetchHtml(section: ReportSection): Promise<string> {
    const sections = section.sections[0] === "all" ? "all" : section.sections;
    try {
      const res = await fetch(`/api/planning/report/${clientId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ sections, locale: reportLocale }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return `<p style="color:red;padding:20px;font-family:sans-serif;">
          <strong>Report generation failed (${section.label}):</strong> ${(err as any).error ?? res.statusText}<br/>
          <small>Make sure the client has retirement projections and financial data entered.</small>
        </p>`;
      }
      return res.text();
    } catch (e: any) {
      return `<p style="color:red;padding:20px;font-family:sans-serif;">Network error: ${e.message}</p>`;
    }
  }

  function stripBody(html: string): string {
    const m = html.match(/<body>([\s\S]*)<\/body>/i);
    return m ? m[1] : html;
  }

  function stripStyle(html: string): string {
    const m = html.match(/<style>([\s\S]*?)<\/style>/i);
    return m ? m[1] : "";
  }

  // ── Open a single report in a new tab ──────────────────────────────────────
  async function openSingle(section: ReportSection) {
    const html = await fetchHtml(section);
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  }

  // ── Generate combined report ───────────────────────────────────────────────
  async function generateCombined() {
    if (!selected.size) return;
    setGenerating(true);
    try {
      const sections = REPORT_SECTIONS.filter(s => selected.has(s.id));

      // Comprehensive generates standalone — open directly
      if (sections.length === 1 && sections[0].sections[0] === "all") {
        const html = await fetchHtml(sections[0]);
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
        return;
      }

      // Multiple reports — combine body content, use first report's style/head
      const htmlParts = await Promise.all(sections.map(s => fetchHtml(s)));
      const css = stripStyle(htmlParts[0]);
      const bodies = htmlParts.map(h => stripBody(h));
      const combined = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Financial Report</title>
<style>${css}.report-divider{page-break-before:always;}</style>
</head>
<body>
${bodies.join('\n<div class="report-divider"></div>\n')}
</body>
</html>`;
      const blob = new Blob([combined], { type: "text/html" });
      window.open(URL.createObjectURL(blob), "_blank");
    } finally {
      setGenerating(false);
    }
  }

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setSelected(new Set(REPORT_SECTIONS.map(s => s.id)));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      {/* Tab toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setSavedView("builder")}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${savedView==="builder" ? "bg-[var(--brand-navy)] text-white" : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}>
          <BookOpen className="w-3.5 h-3.5" />{t.report.reportBuilder ?? "Report Builder"}
        </button>
        <button onClick={() => { setSavedView("saved"); loadSaved(); }}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${savedView==="saved" ? "bg-[var(--brand-navy)] text-white" : "bg-[var(--bg-input)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}>
          <Archive className="w-3.5 h-3.5" />{t.report.savedReports ?? "Saved Reports"}
          {savedList.length > 0 && <span className="ml-1 bg-white/20 text-xs px-1.5 py-0.5 rounded-full">{savedList.length}</span>}
        </button>
      </div>

      {savedView === "saved" && (
        <div className="space-y-3">
          {loadingSaved && <div className="flex items-center gap-2 text-[var(--text-secondary)] text-sm"><Loader2 className="w-4 h-4 animate-spin" />{t.common.loading}</div>}
          {!loadingSaved && savedList.length === 0 && (
            <div className="text-center py-12 text-[var(--text-tertiary)]">
              <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t.report.noSavedReports ?? "No saved reports yet. Generate a report to save it here."}</p>
            </div>
          )}
          {savedList.map(r => (
            <div key={r.id} className="flex items-center justify-between p-4 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-xl">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-[var(--brand-teal)] flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">{r.title}</p>
                  <p className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {new Date(r.generatedAt).toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", { year:"numeric", month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                    <span className="ml-2 uppercase tracking-wide">{r.locale}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => openSaved(r.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--brand-navy)] text-white text-xs font-medium rounded-lg hover:opacity-80 transition-opacity">
                  <ExternalLink className="w-3.5 h-3.5" />{t.report.open ?? "Open"}
                </button>
                <button onClick={() => deleteSaved(r.id)}
                  className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {savedView === "builder" && <>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0c1e3a]" /> {t.report.reportBuilder}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">{t.report.selectAndGenerate}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Report language toggle — independent of UI language */}
          <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden text-xs">
            <button
              onClick={() => setReportLocale("en")}
              className={`px-2.5 py-1.5 font-medium transition-colors ${reportLocale === "en" ? "bg-[#0c1e3a] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >EN</button>
            <button
              onClick={() => setReportLocale("fr")}
              className={`px-2.5 py-1.5 font-medium transition-colors ${reportLocale === "fr" ? "bg-[#0c1e3a] text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >FR</button>
          </div>
          <button onClick={selectAll}  className="text-xs text-slate-500 hover:text-slate-800 transition-colors">{t.report.all}</button>
          <button onClick={selectNone} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">{t.report.none}</button>
          {selected.size > 0 && (
            <button
              onClick={generateCombined}
              disabled={generating}
              className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {t.report.generating}</>
                : <><FileText className="w-4 h-4" /> Generate ({selected.size})</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Report sections by category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORY_ORDER.map(cat => {
          const catSections = REPORT_SECTIONS.filter(s => s.category === cat);
          if (!catSections.length) return null;
          const dotColor = CATEGORY_COLORS[cat] ?? "bg-slate-400";
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Category header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <span className="text-sm font-semibold text-slate-800">{CATEGORY_LABELS[cat] ?? cat}</span>
                </div>
                <button
                  onClick={() => {
                    const allSelected = catSections.every(s => selected.has(s.id));
                    setSelected(prev => {
                      const next = new Set(prev);
                      catSections.forEach(s => allSelected ? next.delete(s.id) : next.add(s.id));
                      return next;
                    });
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {catSections.every(s => selected.has(s.id)) ? t.report.deselectAll : t.report.selectAll}
                </button>
              </div>

              {/* Reports in category */}
              <div className="divide-y divide-slate-50">
                {catSections.map(section => (
                  <div
                    key={section.id}
                    className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${selected.has(section.id) ? "bg-blue-50/50" : ""}`}
                    onClick={() => toggle(section.id)}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      selected.has(section.id) ? "bg-[#0c1e3a] border-[#0c1e3a]" : "border-slate-300"
                    }`}>
                      {selected.has(section.id) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>

                    {/* Label */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{section.label}</p>
                      <p className="text-[11px] text-slate-400 truncate">{section.description}</p>
                    </div>

                    {/* Open button */}
                    <button
                      onClick={e => { e.stopPropagation(); openSingle(section); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title={`Open ${section.label}`}
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0c1e3a] text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selected.size} report{selected.size > 1 ? "s" : ""} selected</span>
          <button
            onClick={generateCombined}
            disabled={generating}
            className="flex items-center gap-2 bg-white text-[#0c1e3a] text-sm font-bold px-4 py-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating…</>
              : <><FileText className="w-4 h-4" /> Generate in One Tab</>
            }
          </button>
          <button onClick={selectNone} className="text-white/50 hover:text-white transition-colors text-sm">Clear</button>
        </div>
      )}
    </>}
  </div>
  );
}
