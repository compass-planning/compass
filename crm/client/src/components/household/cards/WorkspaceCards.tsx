/**
 * WorkspaceCards.tsx
 * All 4 planning workspace cards in one file.
 * Each card: real data, inline AI insight, expandable detail.
 *
 * RetirementWorkspaceCard
 * NetWorthWorkspaceCard
 * InsuranceWorkspaceCard
 * TaxStrategyCard
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PiggyBank, DollarSign, Shield, Receipt,
  AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Sparkles,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
interface Projection { id?: number; person?: string; retirementAge?: number; projectedBalance?: number; successRate?: number | string; rrspBalance?: number; tfsaBalance?: number; nonRegBalance?: number; shortfall?: number; }
interface NetWorthEntry { id?: number; type: string; category?: string; value?: string | number; name?: string; }
interface Policy { type?: string; coverageAmount?: string | number; }
interface InsuranceAnalysis { id?: number; worksheetData?: Record<string, unknown>; }
interface TaxAnalysis { id?: number; type?: string; province?: string; marginalRate?: number; }
interface TaxNote { id?: number; actionRequired?: boolean; category?: string; note?: string; }
import { FinancialPlanningContent } from "@/pages/FinancialPlanning";
import { useLanguage } from "@/contexts/LanguageContext";

// ── Shared components ─────────────────────────────────────────────────────────

function CardShell({
  title, icon: Icon, color, children, action, aiInsight, expandedContent, expanded, onToggleExpand,
}: {
  title: string;
  icon: typeof PiggyBank;
  color: string;  // Tailwind from-/to- classes
  children: React.ReactNode;
  action?: React.ReactNode;
  aiInsight?: string;
  expandedContent?: React.ReactNode;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-xl overflow-hidden flex flex-col shadow-sm hover:shadow-md transition-shadow">
      {/* Gradient accent bar */}
      <div className={cn("h-0.5 bg-gradient-to-r", color)} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className={cn("w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center", color)}>
            <Icon className="w-3.5 h-3.5 text-white" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {expandedContent && (
            <button
              onClick={onToggleExpand}
              className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-4">
        {children}
      </div>

      {/* AI insight bar */}
      {aiInsight && (
        <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 bg-slate-50/60">
          <Sparkles className="w-3 h-3 text-violet-500 flex-shrink-0" />
          <p className="text-[11px] text-slate-500 leading-relaxed">{aiInsight}</p>
        </div>
      )}

      {/* Expanded content */}
      {expanded && expandedContent && (
        <div className="border-t border-slate-200">
          {expandedContent}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone, sub }: { label: string; value: string; tone?: "ok" | "warn" | "risk" | "neutral"; sub?: string }) {
  const vClass = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "risk" ? "text-red-600" : "text-slate-900";
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("text-lg font-bold leading-tight mt-0.5", vClass)}>{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function fmtK(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${Math.round(n).toLocaleString("en-CA")}`;
}

// ── Retirement Workspace Card ─────────────────────────────────────────────────

export function RetirementWorkspaceCard({ clientId, scenario: _scenario }: { clientId: number; scenario: string | null | undefined }) {
  const { isFrench: isFr } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const { data: projections = [], isLoading } = useQuery<Projection[]>({
    queryKey: ["/api/crm/clients/:id/retirement-projections", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/retirement-projections`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const primary = (projections as Projection[]).find((p: Projection) => !p.person || p.person === "primary") ?? (projections as Projection[])[0];
  const spouse  = (projections as Projection[]).find((p: Projection) => p.person === "spouse");

  const balance      = primary ? Number(primary.projectedBalance ?? 0) : 0;
  const shortfall    = primary ? Number(primary.shortfallSurplus ?? 0) : 0;
  const successRate  = primary?.successRate ? `${Math.round(Number(primary.successRate))}%` : null;
  const retAge       = primary?.retirementAge ?? "—";
  const rrsp         = primary ? Number(primary.rrspBalance ?? 0) : 0;
  const tfsa         = primary ? Number(primary.tfsaBalance ?? 0) : 0;
  const nonReg       = primary ? Number(primary.nonRegBalance ?? 0) : 0;
  const _totalSavings = rrsp + tfsa + nonReg;

  const tone: "ok" | "warn" | "risk" | "neutral" =
    successRate === null ? "neutral" :
    Number(primary?.successRate ?? 0) >= 80 ? "ok" :
    Number(primary?.successRate ?? 0) >= 60 ? "warn" : "risk";

  const aiInsight = primary
    ? shortfall > 0
      ? isFr ? `Déficit projeté de ${fmtK(shortfall)} — envisagez d'augmenter les cotisations ou d'ajuster le revenu cible.` : `Projected shortfall of ${fmtK(shortfall)} — consider increasing contributions or adjusting target income.`
      : isFr ? `Sur la bonne voie — taux de succès Monte Carlo ${successRate} à la retraite à ${retAge} ans.` : `On track — ${successRate} Monte Carlo success rate at age ${retAge} retirement.`
    : isFr ? "Aucune projection de retraite. Ajoutez-en une pour modéliser la stratégie de retraite du ménage." : "No retirement projection found. Add one to model the household's retirement strategy.";

  return (
    <CardShell
      title={isFr ? "Retraite" : "Retirement"}
      icon={PiggyBank}
      color="from-violet-600 to-violet-400"
      aiInsight={aiInsight}
      expanded={expanded}
      onToggleExpand={() => setExpanded(e => !e)}
      expandedContent={
        <div className="max-h-[500px] overflow-y-auto">
          <FinancialPlanningContent initialClientId={clientId} />
        </div>
      }
      action={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
          {projections.length} {isFr ? `projection${projections.length !== 1 ? "s" : ""}` : `projection${projections.length !== 1 ? "s" : ""}`}
        </span>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : !primary ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">{isFr ? "Aucune projection de retraite" : "No retirement projection"}</p>
          <p className="text-xs text-slate-400 mt-1">{isFr ? "Allez à l'onglet Plans pour en ajouter une" : "Go to the Plans tab to add one"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Metric label={isFr ? "Solde projeté" : "Projected Balance"} value={fmtK(balance)} tone={shortfall > 0 ? "warn" : "ok"} />
            <Metric label={isFr ? "Taux de succès" : "Success Rate"} value={successRate ?? "—"} tone={tone} />
            <Metric label={isFr ? "Âge de retraite" : "Retirement Age"} value={String(retAge)} />
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100">
            <div className="text-center"><p className="text-[10px] text-slate-400">RRSP</p><p className="text-xs font-bold text-violet-600">{fmtK(rrsp)}</p></div>
            <div className="text-center"><p className="text-[10px] text-slate-400">TFSA</p><p className="text-xs font-bold text-teal-600">{fmtK(tfsa)}</p></div>
            <div className="text-center"><p className="text-[10px] text-slate-400">{isFr ? "Non enr." : "Non-Reg"}</p><p className="text-xs font-bold text-slate-600">{fmtK(nonReg)}</p></div>
          </div>
          {spouse && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-1.5">{isFr ? "Projection du conjoint" : "Spouse projection"}</p>
              <div className="grid grid-cols-2 gap-2">
                <Metric label={isFr ? "Solde" : "Balance"} value={fmtK(Number(spouse.projectedBalance ?? 0))} />
                <Metric label={isFr ? "Âge ret." : "Ret. Age"} value={String(spouse.retirementAge ?? "—")} />
              </div>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}

// ── Net Worth Workspace Card ──────────────────────────────────────────────────

export function NetWorthWorkspaceCard({ clientId }: { clientId: number }) {
  const { isFrench: isFr } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const { data: entries = [], isLoading } = useQuery<NetWorthEntry[]>({
    queryKey: ["/api/crm/clients/:id/net-worth", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/net-worth`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const assets      = (entries as NetWorthEntry[]).filter((e: NetWorthEntry) => e.type === "asset");
  const liabilities = (entries as NetWorthEntry[]).filter((e: NetWorthEntry) => e.type === "liability");
  const totalA = assets.reduce((s: number, e: NetWorthEntry) => s + Number(e.value ?? 0), 0);
  const totalL = liabilities.reduce((s: number, e: NetWorthEntry) => s + Number(e.value ?? 0), 0);
  const nw = totalA - totalL;

  // Category totals
  const catTotals = assets.reduce((acc: Record<string, number>, e: NetWorthEntry) => {
    acc[e.category] = (acc[e.category] ?? 0) + Number(e.value ?? 0);
    return acc;
  }, {});
  const topCats = Object.entries(catTotals).sort(([, a], [, b]) => b - a).slice(0, 3);

  const liabilityRatio = totalA > 0 ? totalL / totalA : 0;
  const tone: "ok" | "warn" | "risk" = liabilityRatio < 0.3 ? "ok" : liabilityRatio < 0.6 ? "warn" : "risk";

  const aiInsight = entries.length === 0
    ? isFr ? "Aucune donnée de valeur nette. Ajoutez des actifs et des passifs pour construire le bilan du ménage." : "No net worth data. Add assets and liabilities to build the household balance sheet."
    : liabilityRatio > 0.5
    ? isFr ? `Ratio de passif à ${Math.round(liabilityRatio * 100)}% des actifs — réviser la stratégie de réduction de la dette.` : `Liability ratio at ${Math.round(liabilityRatio * 100)}% of assets — review debt reduction strategy.`
    : isFr ? `Valeur nette ${fmtK(nw)} · Ratio dette/actif ${Math.round(liabilityRatio * 100)}% — position saine.` : `Net worth ${fmtK(nw)} · Debt-to-asset ratio ${Math.round(liabilityRatio * 100)}% — healthy position.`;

  return (
    <CardShell
      title={isFr ? "Valeur nette" : "Net Worth"}
      icon={DollarSign}
      color="from-emerald-600 to-teal-500"
      aiInsight={aiInsight}
      expanded={expanded}
      onToggleExpand={() => setExpanded(e => !e)}
      expandedContent={
        <div className="p-4">
          <p className="text-sm text-slate-500 text-center py-4">{isFr ? "Ouvrir l'onglet Plans pour l'éditeur complet" : "Open Plans tab for full net worth editor"}</p>
        </div>
      }
      action={
        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
          {isFr ? `${entries.length} entrée${entries.length !== 1 ? "s" : ""}` : `${entries.length} entr${entries.length !== 1 ? "ies" : "y"}`}
        </span>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : entries.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">{isFr ? "Aucune donnée de bilan" : "No balance sheet data"}</p>
          <p className="text-xs text-slate-400 mt-1">{isFr ? "Ajoutez des actifs pour construire le bilan" : "Add assets to build net worth picture"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Metric label={isFr ? "Valeur nette" : "Net Worth"} value={fmtK(nw)} tone={nw >= 0 ? "ok" : "risk"} />
            <Metric label={isFr ? "Actifs" : "Assets"} value={fmtK(totalA)} tone="ok" />
            <Metric label={isFr ? "Passifs" : "Liabilities"} value={fmtK(totalL)} tone={tone} />
          </div>
          {topCats.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-wide">{isFr ? "PRINCIPALES CATÉGORIES D'ACTIFS" : "Top Asset Categories"}</p>
              <div className="space-y-1.5">
                {topCats.map(([cat, val]) => {
                  const pct = totalA > 0 ? (val / totalA) * 100 : 0;
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-[10px] mb-0.5">
                          <span className="text-slate-600 truncate">{cat}</span>
                          <span className="text-slate-500 flex-shrink-0 ml-1">{fmtK(val)}</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}

// ── Insurance Workspace Card ──────────────────────────────────────────────────

export function InsuranceWorkspaceCard({ clientId }: { clientId: number }) {
  const { isFrench: isFr } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const { data: analyses = [], isLoading } = useQuery<InsuranceAnalysis[]>({
    queryKey: ["/api/crm/clients/:id/insurance-analyses", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/insurance-analyses`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/crm/clients/:id/policies", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/policies`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const latest = (analyses as InsuranceAnalysis[])[0];
  const ws = (latest?.worksheetData ?? {}) as Record<string, unknown>;
  const calc = ws.calc ?? {};
  const pNet = latest ? Math.max(0, parseFloat(calc.primaryNet ?? latest.lifeCoverageGap ?? "0")) : 0;
  const sNet = latest ? Math.max(0, parseFloat(calc.spouseNet ?? "0")) : 0;
  const lifeCoverage = (policies as Policy[])
    .filter((p: Policy) => ["Term Life","Whole Life","Universal Life"].some(t => (p.type??"").includes(t)))
    .reduce((s: number, p: Policy) => s + Number(p.coverageAmount ?? 0), 0);

  const hasGap = pNet > 0 || sNet > 0;
  const tone: "ok" | "warn" | "risk" | "neutral" = analyses.length === 0 ? "neutral" : hasGap ? "warn" : "ok";

  const aiInsight = analyses.length === 0
    ? isFr ? "Aucune analyse d'assurance. Effectuez une analyse des besoins familiaux pour identifier les lacunes de couverture." : "No insurance analysis completed. Run a family needs analysis to identify coverage gaps."
    : hasGap
    ? isFr ? `Lacune de couverture détectée — Principal : ${fmtK(pNet)}${sNet > 0 ? ` · Conjoint : ${fmtK(sNet)}` : ""}. Révision et action requises.` : `Coverage gap detected — Primary: ${fmtK(pNet)}${sNet > 0 ? ` · Spouse: ${fmtK(sNet)}` : ""}. Review and action required.`
    : isFr ? "Analyse de couverture complète — aucune lacune importante. Révision annuelle recommandée." : "Coverage analysis complete — no material gaps identified. Review annually.";

  return (
    <CardShell
      title={isFr ? "Assurance" : "Insurance"}
      icon={Shield}
      color="from-violet-600 to-purple-500"
      aiInsight={aiInsight}
      expanded={expanded}
      onToggleExpand={() => setExpanded(e => !e)}
      expandedContent={
        <div className="p-4">
          <p className="text-sm text-slate-500 text-center py-4">{isFr ? "Ouvrir Plans → Assurance pour la feuille FNA complète" : "Open Plans → Insurance for full FNA worksheet"}</p>
        </div>
      }
      action={
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          tone === "risk" || tone === "warn" ? "bg-red-50 text-red-700" :
          tone === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
        )}>
          {hasGap ? (isFr ? "Lacune détectée" : "Gap Detected") : analyses.length === 0 ? (isFr ? "Aucune analyse" : "No Analysis") : (isFr ? "Couvert" : "Covered")}
        </span>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center h-16"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-4">
          <p className="text-sm text-slate-500">{isFr ? "Aucune AFB effectuée" : "No FNA completed"}</p>
          <p className="text-xs text-slate-400 mt-1">{isFr ? "Lancez une analyse pour identifier les lacunes de couverture" : "Run analysis to identify coverage gaps"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Metric label={isFr ? "Couverture vie au dossier" : "Life Coverage on file"} value={lifeCoverage > 0 ? fmtK(lifeCoverage) : "—"} tone={lifeCoverage > 0 ? "ok" : "risk"} />
            <Metric label={isFr ? "Analyses complétées" : "Analyses completed"} value={String(analyses.length)} />
          </div>
          {(pNet > 0 || sNet > 0) && (
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">{isFr ? "LACUNES DE COUVERTURE" : "Coverage Gaps"}</p>
              {pNet > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[11px] text-red-700 font-medium">{latest?.primaryName ?? "Primary"}</span>
                  </div>
                  <span className="text-[11px] font-bold text-red-700">{fmtK(pNet)}</span>
                </div>
              )}
              {sNet > 0 && (
                <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[11px] text-red-700 font-medium">{latest?.spouseName ?? (isFr ? "Conjoint" : "Spouse")}</span>
                  </div>
                  <span className="text-[11px] font-bold text-red-700">{fmtK(sNet)}</span>
                </div>
              )}
            </div>
          )}
          {pNet === 0 && sNet === 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span className="text-[11px] text-emerald-700 font-medium">{isFr ? "Aucune lacune de couverture identifiée" : "No coverage gaps identified"}</span>
            </div>
          )}
        </div>
      )}
    </CardShell>
  );
}

// ── Tax Strategy Card ─────────────────────────────────────────────────────────

export function TaxStrategyCard({ clientId, client }: { clientId: number; client?: Record<string, unknown> }) {
  const { isFrench: isFr } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  const { data: taxNotes = [] } = useQuery<TaxNote[]>({
    queryKey: ["/api/crm/clients/:id/tax-planning-notes", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/tax-planning-notes`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const { data: taxAnalyses = [] } = useQuery<TaxAnalysis[]>({
    queryKey: ["/api/crm/tax/client/:id/analyses", clientId],
    queryFn: () => fetch(`/api/crm/tax/client/${clientId}/analyses`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const pendingNotes = (taxNotes as TaxNote[]).filter((n: TaxNote) => n.actionRequired);
  const hasProjection = (taxAnalyses as TaxAnalysis[]).some((a: TaxAnalysis) => a.type === "projection");
  const hasRrsp       = (taxAnalyses as TaxAnalysis[]).some((a: TaxAnalysis) => a.type === "rrsp-room");
  const hasTfsa       = (taxAnalyses as TaxAnalysis[]).some((a: TaxAnalysis) => a.type === "tfsa-room");
  const hasSplitting  = (taxAnalyses as TaxAnalysis[]).some((a: TaxAnalysis) => a.type === "splitting");

  const latestProjection = (taxAnalyses as TaxAnalysis[]).find((a: TaxAnalysis) => a.type === "projection");
  const lts = latestProjection?.resultData?.summary;

  const tone: "ok" | "warn" | "neutral" = taxAnalyses.length > 0 ? "ok" : pendingNotes.length > 0 ? "warn" : "neutral";

  const aiInsight = taxAnalyses.length === 0 && taxNotes.length === 0
    ? isFr ? "Aucune stratégie fiscale au dossier. Ajoutez des notes ou lancez une projection fiscale." : "No tax strategy on file. Add planning notes or run a tax projection to model lifetime tax."
    : lts
    ? isFr ? `Impôt à vie estimé à ${fmtK(lts.totalLifetimeTax)} · Taux effectif moyen ${(lts.averageEffectiveRate * 100).toFixed(1)}%` : `Lifetime tax estimated at ${fmtK(lts.totalLifetimeTax)} · Avg effective rate ${(lts.averageEffectiveRate * 100).toFixed(1)}%`
    : pendingNotes.length > 0
    ? isFr ? `${pendingNotes.length} élément${pendingNotes.length > 1 ? "s" : ""} fiscal${pendingNotes.length > 1 ? "aux" : ""} à traiter.` : `${pendingNotes.length} tax action item${pendingNotes.length > 1 ? "s" : ""} require attention.`
    : isFr ? `${taxNotes.length} note${taxNotes.length !== 1 ? "s" : ""} de planification · ${taxAnalyses.length} analyse${taxAnalyses.length !== 1 ? "s" : ""} complétée${taxAnalyses.length !== 1 ? "s" : ""}.` : `${taxNotes.length} planning note${taxNotes.length !== 1 ? "s" : ""} on file · ${taxAnalyses.length} analys${taxAnalyses.length !== 1 ? "es" : "is"} completed.`;

  const completedItems = [
    hasProjection ? (isFr ? "Projection fiscale" : "Tax Projection") : null,
    hasRrsp       ? (isFr ? "Droits REER" : "RRSP Room") : null,
    hasTfsa       ? (isFr ? "Droits CELI" : "TFSA Room") : null,
    hasSplitting  ? (isFr ? "Fractionnement" : "Income Split") : null,
  ].filter(Boolean);

  const missingItems = [
    !hasProjection ? (isFr ? "Projection fiscale" : "Tax Projection") : null,
    !hasRrsp       ? (isFr ? "Droits REER" : "RRSP Room") : null,
    !hasTfsa       ? (isFr ? "Droits CELI" : "TFSA Room") : null,
    client?.spouseFirstName && !hasSplitting ? (isFr ? "Fractionnement du revenu" : "Income Splitting") : null,
  ].filter(Boolean);

  return (
    <CardShell
      title={isFr ? "Stratégie fiscale" : "Tax Strategy"}
      icon={Receipt}
      color="from-amber-600 to-orange-500"
      aiInsight={aiInsight}
      expanded={expanded}
      onToggleExpand={() => setExpanded(e => !e)}
      expandedContent={
        <div className="p-4">
          <p className="text-sm text-slate-500 text-center py-4">{isFr ? "Ouvrir Plans → Fiscalité pour la suite complète" : "Open Plans → Tax for full analysis suite"}</p>
        </div>
      }
      action={
        <span className={cn(
          "text-[10px] font-semibold px-2 py-0.5 rounded-full",
          tone === "ok" ? "bg-amber-50 text-amber-700" :
          tone === "warn" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-500"
        )}>
          {isFr ? `${taxAnalyses.length} analyse${taxAnalyses.length !== 1 ? "s" : ""}` : `${taxAnalyses.length} analys${taxAnalyses.length !== 1 ? "es" : "is"}`}
        </span>
      }
    >
      <div className="space-y-3">
        {lts && (
          <div className="grid grid-cols-2 gap-3">
            <Metric label={isFr ? "Impôt à vie" : "Lifetime Tax"} value={fmtK(lts.totalLifetimeTax)} tone="warn" />
            <Metric label={isFr ? "Taux effectif" : "Effective Rate"} value={`${(lts.averageEffectiveRate * 100).toFixed(1)}%`} />
          </div>
        )}
        {!lts && taxNotes.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <Metric label={isFr ? "Notes de planification" : "Planning Notes"} value={String(taxNotes.length)} tone="ok" />
            <Metric label={isFr ? "Points d'action" : "Action Items"} value={String(pendingNotes.length)} tone={pendingNotes.length > 0 ? "warn" : "ok"} />
          </div>
        )}
        {!lts && taxNotes.length === 0 && (
          <div className="text-center py-2">
            <p className="text-sm text-slate-500">{isFr ? "Aucune stratégie fiscale commencée" : "No tax strategy started"}</p>
          </div>
        )}

        {/* Checklist */}
        <div className="pt-2 border-t border-slate-100 space-y-1">
          {completedItems.map(item => (
            <div key={item} className="flex items-center gap-2">
              <CheckCircle className="w-3 h-3 text-emerald-500 flex-shrink-0" />
              <span className="text-[11px] text-slate-600">{item}</span>
            </div>
          ))}
          {missingItems.slice(0, 3).map(item => (
            <div key={item} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0" />
              <span className="text-[11px] text-slate-400">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </CardShell>
  );
}
