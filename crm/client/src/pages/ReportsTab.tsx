import { useState } from "react";
import { FileText, Download, Loader2, BookOpen, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface ReportSection {
  id: string;
  label: string;
  description: string;
  category: string;
  sections: string[];
}

const REPORT_SECTIONS: ReportSection[] = [
  {
    id: "comprehensive",
    label: "Comprehensive Plan",
    description: "Full plan — all sections",
    category: "Summary",
    sections: ["all"],
  },
  {
    id: "one-page",
    label: "One Page Summary",
    description: "Executive summary",
    category: "Summary",
    sections: ["retirement", "tax", "insurance"],
  },
  {
    id: "net-worth",
    label: "Net Worth Statement",
    description: "Balance sheet",
    category: "Net Worth",
    sections: ["networth"],
  },
  {
    id: "asset-allocation",
    label: "Asset Allocation",
    description: "Asset breakdown by type",
    category: "Net Worth",
    sections: ["networth"],
  },
  {
    id: "retirement",
    label: "Retirement Projection",
    description: "Income projection & Monte Carlo",
    category: "Retirement",
    sections: ["retirement", "rrsp", "tfsa"],
  },
  {
    id: "retirement-readiness",
    label: "Retirement Readiness",
    description: "Success probability & gaps",
    category: "Retirement",
    sections: ["retirement"],
  },
  {
    id: "insurance",
    label: "Insurance Analysis",
    description: "DIME, disability & CI gaps",
    category: "Insurance",
    sections: ["insurance"],
  },
  {
    id: "cash-flow",
    label: "Cash Flow",
    description: "Income vs expenses",
    category: "Cash Flow",
    sections: ["cashflow", "debt"],
  },
  {
    id: "goal-status",
    label: "Goal Status",
    description: "Progress to financial goals",
    category: "Goals",
    sections: ["goals"],
  },
  {
    id: "tax-strategy",
    label: "Tax Strategy",
    description: "Tax projection & optimization",
    category: "Tax & Estate",
    sections: ["tax", "rrsp", "tfsa", "capitalGains", "incomeSplitting"],
  },
  {
    id: "estate-summary",
    label: "Estate Summary",
    description: "Estate value, tax & documents",
    category: "Tax & Estate",
    sections: ["estate"],
  },
];

// French label overrides for report names
const REPORT_LABELS_FR: Record<string, { label: string; description: string }> = {
  "comprehensive":        { label: "Plan financier complet",       description: "Plan complet — toutes les sections" },
  "one-page":             { label: "Résumé d'une page",            description: "Sommaire exécutif" },
  "net-worth":            { label: "État de la valeur nette",      description: "Bilan" },
  "asset-allocation":     { label: "Répartition des actifs",       description: "Répartition par type d'actif" },
  "retirement":           { label: "Projection de retraite",       description: "Projection de revenu et Monte-Carlo" },
  "retirement-readiness": { label: "Préparation à la retraite",    description: "Probabilité de succès et lacunes" },
  "insurance":            { label: "Analyse des assurances",       description: "DIME, invalidité et maladie grave" },
  "cash-flow":            { label: "Flux de trésorerie",           description: "Revenus vs dépenses" },
  "goal-status":          { label: "État des objectifs",           description: "Progrès vers les objectifs financiers" },
  "tax-strategy":         { label: "Stratégie fiscale",            description: "Projection et optimisation fiscale" },
  "estate-summary":       { label: "Résumé successoral",           description: "Valeur successorale, impôts et documents" },
};

const CATEGORIES_EN = ["Summary", "Net Worth", "Retirement", "Insurance", "Cash Flow", "Goals", "Tax & Estate"];
const CATEGORIES_FR = ["Sommaire", "Valeur nette", "Retraite", "Assurance", "Flux de trésorerie", "Objectifs", "Fiscalité et succession"];
const CATEGORY_MAP_FR: Record<string, string> = {
  "Summary": "Sommaire",
  "Net Worth": "Valeur nette",
  "Retirement": "Retraite",
  "Insurance": "Assurance",
  "Cash Flow": "Flux de trésorerie",
  "Goals": "Objectifs",
  "Tax & Estate": "Fiscalité et succession",
};

const CATEGORY_COLORS: Record<string, string> = {
  Summary: "bg-[#0c1e3a]",
  "Net Worth": "bg-violet-600",
  Retirement: "bg-teal-600",
  Insurance: "bg-purple-600",
  "Cash Flow": "bg-amber-500",
  Goals: "bg-green-600",
  "Tax & Estate": "bg-indigo-600",
};

export function ReportsTab({ clientId }: { clientId: number }) {
  const { locale } = useLanguage();

  // Report language can be set independently of the UI language
  const [reportLang, setReportLang] = useState<"en" | "fr">(locale as "en" | "fr");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);

  const isFr = reportLang === "fr";

  // Localised helpers
  function sectionLabel(s: ReportSection) {
    return isFr ? (REPORT_LABELS_FR[s.id]?.label ?? s.label) : s.label;
  }
  function sectionDesc(s: ReportSection) {
    return isFr ? (REPORT_LABELS_FR[s.id]?.description ?? s.description) : s.description;
  }
  function catLabel(cat: string) {
    return isFr ? (CATEGORY_MAP_FR[cat] ?? cat) : cat;
  }

  // ── Fetch a report from the planning engine ─────────────────────────────────
  async function fetchHtml(section: ReportSection): Promise<string> {
    const sections = section.sections[0] === "all" ? "all" : section.sections;
    try {
      const res = await fetch(`/api/crm/planning/report/${clientId}?language=${reportLang}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sections, language: reportLang }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return `<p style="color:red;padding:20px;font-family:sans-serif;">
          <strong>Report generation failed (${sectionLabel(section)}):</strong> ${(err as any).error ?? res.statusText}<br/>
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

  async function openSingle(section: ReportSection) {
    const html = await fetchHtml(section);
    const blob = new Blob([html], { type: "text/html" });
    window.open(URL.createObjectURL(blob), "_blank");
  }

  async function generateCombined() {
    if (!selected.size) return;
    setGenerating(true);
    try {
      const sections = REPORT_SECTIONS.filter((s) => selected.has(s.id));

      if (sections.length === 1 && sections[0].sections[0] === "all") {
        const html = await fetchHtml(sections[0]);
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
        return;
      }

      const htmlParts = await Promise.all(sections.map((s) => fetchHtml(s)));
      const css = stripStyle(htmlParts[0]);
      const bodies = htmlParts.map((h) => stripBody(h));
      const combined = `<!DOCTYPE html>
<html lang="${reportLang}">
<head>
<meta charset="UTF-8">
<title>${isFr ? "Rapport financier" : "Financial Report"}</title>
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
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll  = () => setSelected(new Set(REPORT_SECTIONS.map((s) => s.id)));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[#0c1e3a]" />
            {isFr ? "Générateur de rapports" : "Report Builder"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isFr
              ? "Sélectionnez des rapports et générez — tous utilisent le même format professionnel"
              : "Select reports and generate — all use the same professional format"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={selectAll}  className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            {isFr ? "Tout" : "All"}
          </button>
          <button onClick={selectNone} className="text-xs text-slate-500 hover:text-slate-800 transition-colors">
            {isFr ? "Aucun" : "None"}
          </button>
          {selected.size > 0 && (
            <button
              onClick={generateCombined}
              disabled={generating}
              className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition-all"
            >
              {generating
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {isFr ? "Génération…" : "Generating…"}</>
                : <><FileText className="w-4 h-4" /> {isFr ? `Générer (${selected.size})` : `Generate (${selected.size})`}</>
              }
            </button>
          )}
        </div>
      </div>

      {/* ── Report Language Toggle ─────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <Globe className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            {isFr ? "Langue des rapports" : "Report Language"}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isFr
              ? "Indépendant de la langue de l'interface — les rapports seront générés dans la langue sélectionnée"
              : "Independent of the UI language — reports will be generated in the selected language"}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          {(["en", "fr"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setReportLang(lang)}
              className={[
                "px-4 py-1.5 rounded-md text-xs font-semibold transition-colors",
                reportLang === lang
                  ? "bg-[#0c1e3a] text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-800",
              ].join(" ")}
            >
              {lang === "en" ? "English" : "Français"}
            </button>
          ))}
        </div>
      </div>

      {/* Report sections by category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES_EN.map((cat) => {
          const catSections = REPORT_SECTIONS.filter((s) => s.category === cat);
          if (!catSections.length) return null;
          const dotColor = CATEGORY_COLORS[cat] ?? "bg-slate-400";
          return (
            <div key={cat} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Category header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                  <span className="text-sm font-semibold text-slate-800">{catLabel(cat)}</span>
                </div>
                <button
                  onClick={() => {
                    const allSelected = catSections.every((s) => selected.has(s.id));
                    setSelected((prev) => {
                      const next = new Set(prev);
                      catSections.forEach((s) => allSelected ? next.delete(s.id) : next.add(s.id));
                      return next;
                    });
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {catSections.every((s) => selected.has(s.id))
                    ? (isFr ? "Désélectionner" : "Deselect all")
                    : (isFr ? "Tout sélectionner" : "Select all")}
                </button>
              </div>

              {/* Reports in category */}
              <div className="divide-y divide-slate-50">
                {catSections.map((section) => (
                  <div
                    key={section.id}
                    className={`group flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer ${selected.has(section.id) ? "bg-violet-50/50" : ""}`}
                    onClick={() => toggle(section.id)}
                  >
                    <div
                      className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        selected.has(section.id) ? "bg-[#0c1e3a] border-[#0c1e3a]" : "border-slate-300"
                      }`}
                    >
                      {selected.has(section.id) && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{sectionLabel(section)}</p>
                      <p className="text-[11px] text-slate-400 truncate">{sectionDesc(section)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); openSingle(section); }}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"
                      title={`Open ${sectionLabel(section)}`}
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
          <span className="text-sm font-medium">
            {selected.size} {isFr ? `rapport${selected.size > 1 ? "s" : ""} sélectionné${selected.size > 1 ? "s" : ""}` : `report${selected.size > 1 ? "s" : ""} selected`}
          </span>
          <div className="flex items-center gap-1 rounded-lg border border-white/20 p-0.5">
            {(["en", "fr"] as const).map((lang) => (
              <button
                key={lang}
                onClick={() => setReportLang(lang)}
                className={[
                  "px-2.5 py-1 rounded-md text-xs font-semibold transition-colors",
                  reportLang === lang ? "bg-white text-[#0c1e3a]" : "text-white/60 hover:text-white",
                ].join(" ")}
              >
                {lang.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={generateCombined}
            disabled={generating}
            className="flex items-center gap-2 bg-white text-[#0c1e3a] text-sm font-bold px-4 py-1.5 rounded-xl hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            {generating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {isFr ? "Génération…" : "Generating…"}</>
              : <><FileText className="w-4 h-4" /> {isFr ? "Générer dans un onglet" : "Generate in One Tab"}</>
            }
          </button>
          <button onClick={selectNone} className="text-white/50 hover:text-white transition-colors text-sm">
            {isFr ? "Effacer" : "Clear"}
          </button>
        </div>
      )}
    </div>
  );
}
