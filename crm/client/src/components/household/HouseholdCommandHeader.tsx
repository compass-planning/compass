/**
 * HouseholdCommandHeader.tsx — light theme
 * Command header with 5 live metric chips.
 * All light colors — matches content area.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  ArrowLeft, Edit, Sparkles, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
interface Policy { type?: string; coverageAmount?: string | number; }

function MetricChip({ label, value, status, tone, loading }: {
  label: string; value: string; status: string;
  tone: "ok" | "warn" | "risk" | "neutral"; loading?: boolean;
}) {
  const border = tone === "ok" ? "border-emerald-200 bg-emerald-50" :
    tone === "warn" ? "border-amber-200 bg-amber-50" :
    tone === "risk" ? "border-red-200 bg-red-50" :
    "border-slate-200 bg-slate-50";
  const valColor = tone === "ok" ? "text-emerald-700" :
    tone === "warn" ? "text-amber-700" :
    tone === "risk" ? "text-red-700" : "text-slate-700";

  return (
    <div className={cn("rounded-xl border px-3 py-2.5 flex-1 min-w-0", border)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 truncate">{label}</p>
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin mt-1" />
      ) : (
        <>
          <p className={cn("text-sm font-bold leading-tight mt-0.5 truncate", valColor)}>{value}</p>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{status}</p>
        </>
      )}
    </div>
  );
}

interface Props {
  client: Record<string, unknown>;
  onEdit?: () => void;
  onPopOut?: () => void;
}

export function HouseholdCommandHeader({ client, onEdit, onPopOut: _onPopOut }: Props) {
  const { isFrench: isFr } = useLanguage();
  const { data: overview, isLoading: ovLoading } = useQuery<Record<string, unknown>>({
    queryKey: ["/api/crm/clients/:id/overview", client.id],
    queryFn: () => fetch(`/api/crm/clients/${client.id}/overview`, { credentials: "include" }).then(r => r.ok ? r.json() : null),
  });

  const { data: retPlans = [] } = useQuery<Policy[]>({
    queryKey: ["/api/crm/clients/:id/retirement-projections", client.id],
    queryFn: () => fetch(`/api/crm/clients/${client.id}/retirement-projections`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const { data: policies = [] } = useQuery<Policy[]>({
    queryKey: ["/api/crm/clients/:id/policies", client.id],
    queryFn: () => fetch(`/api/crm/clients/${client.id}/policies`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const householdName = client.spouseId
    ? `${client.firstName} ${client.lastName} Household`
    : `${client.firstName} ${client.lastName}`;

  const nw = overview ? Number(overview.netWorth ?? 0) : 0;
  const nwFmt = Math.abs(nw) >= 1_000_000 ? `$${(nw / 1_000_000).toFixed(1)}M` : `$${Math.round(nw / 1000)}K`;

  const primary = retPlans[0] as Record<string, unknown> | undefined;
  const retFunded = primary?.successRate ? Math.round(Number(primary.successRate)) : null;
  const retStr    = retFunded !== null ? `${retFunded}%` : retPlans.length > 0 ? `${retPlans.length} plan${retPlans.length > 1 ? "s" : ""}` : "—";
  const retTone   = retFunded === null ? "neutral" : retFunded >= 80 ? "ok" : retFunded >= 60 ? "warn" : "risk";

  const lifeCoverage = policies
    .filter((p: Policy) => ["Term Life","Whole Life","Universal Life"].some(t => (p.type ?? "").includes(t)))
    .reduce((s: number, p: Policy) => s + Number(p.coverageAmount || 0), 0);
  const insTone = lifeCoverage > 0 ? "ok" : policies.length > 0 ? "warn" : "neutral";

  const taxNotes = overview?.taxNotes ?? 0;
  const estateNotes = overview?.estateNotes ?? 0;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-4">
      {/* Top row */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/clients">
            <div className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </div>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 truncate" data-testid="text-client-name">
                {householdName}
              </h1>
              {onEdit && (
                <button onClick={onEdit} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0">
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {[client.province, client.annualIncome ? `$${Number(client.annualIncome).toLocaleString()}/yr` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>

        <button className="h-8 rounded-lg border border-violet-200 bg-violet-50 px-3 text-[11px] font-semibold text-violet-700 hover:bg-violet-100 transition-colors flex items-center gap-1.5 flex-shrink-0">
          <Sparkles className="h-3 w-3" />
          {isFr ? "Analyses IA" : "AI Insights"}
        </button>
      </div>

      {/* Metric strip */}
      <div className="flex items-stretch gap-2">
        <MetricChip label={isFr ? "Valeur nette" : "Net Worth"}    value={ovLoading ? "…" : nwFmt}       status={nw >= 0 ? (isFr ? "Positif" : "Positive") : (isFr ? "Révision" : "Review")} tone={nw >= 0 ? "ok" : "risk"} loading={ovLoading} />
        <MetricChip label={isFr ? "Retraite" : "Retirement"}   value={retStr}                          status={retFunded === null ? (isFr ? "Aucune projection" : "No projection") : retFunded >= 80 ? (isFr ? "Sur la bonne voie" : "On track") : (isFr ? "Révision requise" : "Review needed")} tone={retTone as "ok" | "warn" | "risk" | "neutral"} />
        <MetricChip label={isFr ? "Assurance" : "Insurance"}    value={lifeCoverage > 0 ? `$${Math.round(lifeCoverage/1000)}K` : "—"} status={lifeCoverage > 0 ? (isFr ? "Vie au dossier" : "Life on file") : (isFr ? "Non vérifié" : "Not verified")} tone={insTone as "ok" | "warn" | "risk" | "neutral"} />
        <MetricChip label={isFr ? "Stratégie fiscale" : "Tax Strategy"} value={taxNotes > 0 ? `${taxNotes} note${taxNotes > 1 ? "s" : ""}` : "—"} status={taxNotes > 0 ? (isFr ? "Notes au dossier" : "Notes on file") : (isFr ? "Non commencé" : "Not started")} tone={taxNotes > 0 ? "ok" : "neutral"} />
        <MetricChip label={isFr ? "Succession" : "Estate"}       value={estateNotes > 0 ? `${estateNotes} item${estateNotes > 1 ? "s" : ""}` : "—"} status={estateNotes > 0 ? (isFr ? "Notes au dossier" : "Notes on file") : (isFr ? "Non commencé" : "Not started")} tone={estateNotes > 0 ? "ok" : "neutral"} />
      </div>
    </div>
  );
}
