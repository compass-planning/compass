import { useState, useMemo, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useSearch } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useLeads, useLead, useCreateLead, useUpdateLead, useDeleteLead, useLeadActivities, useCreateLeadActivity } from "@/hooks/use-leads";
import { useStaffMembers, useCurrentStaff } from "@/hooks/use-users";
import { useQuery } from "@tanstack/react-query";
import { pipelineStages, leadSources, productInterestTypes } from "@shared/schema";
import type { Lead, StaffMember } from "@shared/schema";
import {
  X, Calendar, Phone, Mail, Target,
  ArrowRightCircle, Trash2, Search, Edit, ChevronDown, ChevronUp, Package, ExternalLink, UserPlus, ArrowRight
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { useWindowManager } from "@/contexts/WindowManagerContext";

/**
 * Who a lead can be assigned to. Sales managers get the general manager, themselves and their own advisors
 * (decided by the server); everyone else keeps the usual list of advisors.
 */
const advisorLabel = (a: StaffMember) => `${a.firstName} ${a.lastName}${a.role === "general_manager" ? " (General Manager)" : ""}`;

function useAdvisorChoices(allStaff: StaffMember[]): StaffMember[] {
  // One server-driven "who can I assign to" list for every role (clients, tasks and deals share it).
  const { data: assignable } = useQuery<StaffMember[]>({ queryKey: ["/api/crm/staff/assignable-advisors"] });
  return assignable ?? [];
}

function getStageConfig(isFr: boolean) {
  return {
  lead:        { label: isFr ? "Prospect"     : "Lead",        color: "text-violet-700",    bgColor: "bg-violet-50",    borderColor: "border-violet-200" },
  contacted:   { label: isFr ? "Contacté"     : "Contacted",   color: "text-amber-700",   bgColor: "bg-amber-50",   borderColor: "border-amber-200" },
  opportunity: { label: isFr ? "Opportunité"  : "Opportunity", color: "text-purple-700",  bgColor: "bg-purple-50",  borderColor: "border-purple-200" },
  proposal:    { label: isFr ? "Proposition"  : "Proposal",    color: "text-indigo-700",  bgColor: "bg-indigo-50",  borderColor: "border-indigo-200" },
  closed_won:  { label: isFr ? "Conclu"       : "Closed Won",  color: "text-emerald-700", bgColor: "bg-emerald-50", borderColor: "border-emerald-200" },
  follow_up:   { label: isFr ? "Suivi"        : "Follow Up",   color: "text-rose-700",    bgColor: "bg-rose-50",    borderColor: "border-rose-200" },
  };
}

function getSourceLabels(isFr: boolean): Record<string, string> {
  return isFr ? {
    referral: "Référence",
    cold_call: "Appel à froid",
    website: "Site web",
    social_media: "Médias sociaux",
    event: "Événement",
    partner: "Partenaire",
    other: "Autre",
  } : {
    referral: "Referral",
    cold_call: "Cold Call",
    website: "Website",
    social_media: "Social Media",
    event: "Event",
    partner: "Partner",
    other: "Other",
  };
}

function getProductInterestLabels(isFr: boolean): Record<string, string> {
  return isFr ? {
    insurance: "Assurance",
    mutual_fund: "Fonds communs",
    segregated_fund: "Fonds distincts",
  } : {
    insurance: "Insurance",
    mutual_fund: "Mutual Fund",
    segregated_fund: "Seg Fund",
  };
}

type SortField = "name" | "stage" | "source" | "advisor" | "age" | "interest";
type SortDir = "asc" | "desc";

export default function Pipeline() {
  const { isFrench: isFr } = useLanguage();
  const STAGE_CONFIG = getStageConfig(isFr);
  const SOURCE_LABELS = getSourceLabels(isFr);
  const PRODUCT_INTEREST_LABELS = getProductInterestLabels(isFr);
  const searchString = useSearch();
  const { data: allLeads = [], isLoading } = useLeads();
  const { data: allStaff } = useStaffMembers();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [_selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterAdvisorId, setFilterAdvisorId] = useState<number | null>(null);
  const [filterSource, setFilterSource] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const updateLead = useUpdateLead();

  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const leadId = params.get("leadId");
    if (leadId && allLeads.length > 0) {
      const lead = allLeads.find(l => l.id === Number(leadId));
      if (lead) setSelectedLead(lead);
    }
    const stageParam = params.get("stage");
    if (stageParam && pipelineStages.includes(stageParam as typeof pipelineStages[number])) {
      setFilterStage(stageParam);
    }
    const advisorParam = params.get("advisorId");
    if (advisorParam) {
      setFilterAdvisorId(Number(advisorParam));
    }
  }, [searchString, allLeads]);

  const _toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const getAdvisorName = (advisorId: number | null): string => {
    if (!advisorId) return "";
    const a = allStaff?.find(s => s.id === advisorId);
    return a ? `${a.firstName} ${a.lastName}` : "";
  };

  const leads = useMemo(() => {
    let filtered = allLeads;
    if (filterStage) filtered = filtered.filter(l => l.stage === filterStage);
    if (filterAdvisorId) filtered = filtered.filter(l => l.advisorId === filterAdvisorId);
    if (filterSource) filtered = filtered.filter(l => l.source === filterSource);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        `${l.firstName} ${l.lastName} ${l.email || ""} ${l.phone || ""}`.toLowerCase().includes(term)
      );
    }
    const sorted = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "stage":
          cmp = pipelineStages.indexOf(a.stage as typeof pipelineStages[number]) - pipelineStages.indexOf(b.stage as typeof pipelineStages[number]);
          break;
        case "source":
          cmp = (a.source || "").localeCompare(b.source || "");
          break;
        case "advisor":
          cmp = getAdvisorName(a.advisorId).localeCompare(getAdvisorName(b.advisorId));
          break;
        case "age":
          cmp = new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime();
          break;
        case "interest":
          cmp = (a.productInterest || "").localeCompare(b.productInterest || "");
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [allLeads, filterStage, filterAdvisorId, filterSource, searchTerm, sortField, sortDir, allStaff]);

  const _stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of pipelineStages) counts[s] = 0;
    for (const lead of allLeads) {
      if (counts[lead.stage] !== undefined) counts[lead.stage]++;
    }
    return counts;
  }, [allLeads]);

  const totalLeads = allLeads.length;
  const convertedCount = allLeads.filter(l => l.convertedClientId).length;
  const opportunityCount = allLeads.filter(l => l.stage === "opportunity" || l.stage === "proposal" || l.stage === "closed_won").length;

  const _handleStageChange = (lead: Lead, newStage: string) => {
    if (newStage !== lead.stage) {
      updateLead.mutate({ id: lead.id, stage: newStage });
    }
  };

  const _handleReassign = (lead: Lead, advisorId: number) => {
    if (advisorId !== lead.advisorId) {
      updateLead.mutate({ id: lead.id, advisorId });
    }
  };

  const _advisors = allStaff?.filter(u => ["advisor", "advisor_admin", "sales_manager"].includes(u.role)) ?? [];

  // Aliases so new insightled UI and old state declarations stay in sync
  const search = searchTerm;
  const setSearch = setSearchTerm;
  const stageFilter = filterStage;
  const setStageFilter = setFilterStage;
  const sourceFilter = filterSource;
  const setSourceFilter = setFilterSource;
  const advisorFilter = filterAdvisorId != null ? String(filterAdvisorId) : "all";
  const setAdvisorFilter = (v: string) => setFilterAdvisorId(v && v !== "all" ? Number(v) : null);
  const sortedLeads = leads;
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);

  const stageOrder = ["lead","contacted","opportunity","proposal","closed_won","follow_up"];
  const stageCounts2: Record<string,number> = {};
  stageOrder.forEach(s => { stageCounts2[s] = sortedLeads.filter(l => l.stage === s).length; });
  const convRate = totalLeads > 0 ? Math.round((convertedCount / totalLeads) * 100) : 0;

  // Lead opportunity scoring
  const scoreStage: Record<string,number> = { lead:20, contacted:35, opportunity:55, proposal:75, closed_won:100, follow_up:40 };
  const scoreSource: Record<string,number> = { referral:15, partner:10, event:8, website:5, social_media:3, cold_call:0, other:3 };
  function leadScore(lead: Lead) {
    const s = (scoreStage[lead.stage] ?? 20) + (scoreSource[lead.source ?? ""] ?? 0);
    const days = differenceInDays(new Date(), new Date(lead.createdAt!));
    return Math.min(100, Math.max(0, s - Math.floor(days / 30) * 3));
  }
  function scoreColor(s: number) {
    if (s >= 75) return "#10b981";
    if (s >= 50) return "#3b82f6";
    if (s >= 30) return "#f59e0b";
    return "#ef4444";
  }

  return (
    <AppLayout>
      <div className="fp-insightled" style={{ height: "100%", display: "flex", flexDirection: "column" }}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-white/90 backdrop-blur" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{isFr ? "CRM consultatif" : "Advisory CRM"}</p>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{isFr ? "Pipeline d'opportunités" : "Opportunity Pipeline"}</h1>
            </div>
            {/* Stage funnel summary */}
            <div className="hidden lg:flex items-center gap-1">
              {stageOrder.map((s, i) => {
                const cfg = STAGE_CONFIG[s];
                const count = stageCounts2[s] ?? 0;
                return (
                  <div key={s} className="flex items-center gap-1">
                    <div className={`px-2.5 py-1 rounded text-[10px] font-bold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                      {cfg.label} <span className="font-mono ml-1">{count}</span>
                    </div>
                    {i < stageOrder.length - 1 && <ArrowRight className="w-3 h-3" style={{ color: "var(--text-tertiary)" }} />}
                  </div>
                );
              })}
            </div>
          </div>
          <button onClick={() => setShowCreateModal(true)} data-testid="button-add-lead"
            className="px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all">
            {isFr ? "+ Nouveau prospect" : "+ New Lead"}
          </button>
        </div>

        {/* ── Main two-column workspace ──────────────────────────────────── */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* ── Left: Opportunity table ───────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Filters */}
            <div className="px-6 py-3 flex items-center gap-2 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={isFr ? "Rechercher des ménages..." : "Search households..."} data-testid="input-search-leads"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:border-violet-400"
                  style={{ borderColor: "var(--border-light)", color: "var(--text-primary)" }} />
              </div>
              <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} data-testid="select-stage-filter"
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none"
                style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}>
                <option value="all">{isFr ? "Toutes les étapes" : "All Stages"}</option>
                {Object.entries(STAGE_CONFIG).map(([s,c]) => <option key={s} value={s}>{c.label}</option>)}
              </select>
              <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} data-testid="select-source-filter"
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none"
                style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}>
                <option value="all">{isFr ? "Toutes les sources" : "All Sources"}</option>
                {Object.entries(SOURCE_LABELS).map(([s,l]) => <option key={s} value={s}>{l}</option>)}
              </select>
              <select value={advisorFilter} onChange={e => setAdvisorFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none"
                style={{ borderColor: "var(--border-light)", color: "var(--text-secondary)" }}>
                <option value="all">{isFr ? "Tous les conseillers" : "All Advisors"}</option>
                {allStaff?.map(s => <option key={s.id} value={String(s.id)}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: "var(--bg-soft)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <tr>
                    <th className="text-left pl-6 pr-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Ménage" : "Household"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Étape" : "Stage"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Opportunité" : "Opportunity"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Source" : "Source"}</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Jours" : "Days"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Conseiller" : "Advisor"}</th>
                    <th className="text-right pl-3 pr-6 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({length:5}).map((_,i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {Array.from({length:7}).map((_,j) => (
                          <td key={j} className="px-3 py-3"><div className="h-4 rounded animate-pulse" style={{ backgroundColor: "var(--bg-soft)", width: j===0?"140px":j===6?"48px":"80px" }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : sortedLeads.length === 0 ? (
                    <tr><td colSpan={7} className="py-16 text-center">
                      <div style={{ color: "var(--text-tertiary)" }}>
                        <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-semibold">{isFr ? "Aucune opportunité trouvée" : "No opportunities found"}</p>
                        <p className="text-xs mt-1">{isFr ? "Ajoutez un prospect pour démarrer votre pipeline" : "Add a lead to start your pipeline"}</p>
                        <button onClick={() => setShowCreateModal(true)}
                          className="mt-4 px-4 py-2 rounded-lg bg-brand-gradient text-white text-xs font-semibold">
                          {isFr ? "+ Ajouter le premier prospect" : "+ Add First Lead"}
                        </button>
                      </div>
                    </td></tr>
                  ) : sortedLeads.map(lead => {
                    const cfg = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.lead;
                    const advisor = lead.advisorId ? allStaff?.find(s => s.id === lead.advisorId) : null;
                    const days = differenceInDays(new Date(), new Date(lead.createdAt!));
                    const score = leadScore(lead);
                    const sc = scoreColor(score);
                    const r = 10; const circ = 2*Math.PI*r;
                    return (
                      <tr key={lead.id} data-testid={`row-lead-${lead.id}`}
                        className="group cursor-pointer transition-colors"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-soft)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        onClick={() => setSelectedLeadId(lead.id)}>
                        {/* Household */}
                        <td className="pl-6 pr-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-xs font-bold text-violet-700 flex-shrink-0">
                              {lead.firstName[0]}{lead.lastName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{lead.firstName} {lead.lastName}</p>
                              {lead.email && <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{lead.email}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Stage */}
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.bgColor} ${cfg.color} ${cfg.borderColor}`}>
                            {cfg.label}
                          </span>
                        </td>
                        {/* Product interest */}
                        <td className="px-3 py-3">
                          {lead.productInterest ? (
                            <span className="text-xs font-medium" style={{ color: "var(--accent-blue)" }}>
                              {PRODUCT_INTEREST_LABELS[lead.productInterest] ?? lead.productInterest}
                            </span>
                          ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                        {/* Source */}
                        <td className="px-3 py-3">
                          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{SOURCE_LABELS[lead.source ?? ""] ?? "—"}</span>
                        </td>
                        {/* Days */}
                        <td className="px-3 py-3 text-right">
                          <span className={`text-xs font-mono font-semibold ${days > 60 ? "text-red-500" : days > 30 ? "text-amber-600" : ""}`}
                            style={days <= 30 ? { color: "var(--text-secondary)" } : undefined}>{days}d</span>
                        </td>
                        {/* Advisor */}
                        <td className="px-3 py-3">
                          {advisor ? (
                            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{advisor.firstName} {advisor.lastName[0]}.</span>
                          ) : <span style={{ color: "var(--text-tertiary)" }}>—</span>}
                        </td>
                        {/* Score ring */}
                        <td className="pl-3 pr-6 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="relative w-6 h-6">
                              <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                                <circle cx="12" cy="12" r={r} fill="none" stroke="var(--bg-soft)" strokeWidth="2.5" />
                                <circle cx="12" cy="12" r={r} fill="none" stroke={sc} strokeWidth="2.5"
                                  strokeDasharray={`${(score/100)*circ} ${circ}`} strokeLinecap="round" />
                              </svg>
                              <span className="absolute inset-0 flex items-center justify-center" style={{ fontSize:"7px", fontWeight:700, color:sc }}>{score}</span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Right: Intelligence rail ──────────────────────────────────── */}
          <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>

            {/* Book metrics */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Résumé du pipeline" : "Pipeline Summary"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: isFr ? "Total prospects" : "Total Leads", value: totalLeads, color: "var(--accent-blue)" },
                  { label: isFr ? "Opportunités" : "Opportunities", value: opportunityCount, color: "var(--accent-purple)" },
                  { label: isFr ? "Convertis" : "Converted", value: convertedCount, color: "var(--accent-green)" },
                  { label: isFr ? "Taux conv." : "Conv. Rate", value: `${convRate}%`, color: convRate >= 20 ? "var(--accent-green)" : "var(--accent-amber)" },
                ].map(s => (
                  <div key={s.label} className="fp-insightled-card p-2.5">
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
                    <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Stage funnel */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Distribution par étape" : "Stage Distribution"}</p>
              {stageOrder.filter(s => s !== "closed_won").map(s => {
                const cfg = STAGE_CONFIG[s];
                const count = stageCounts2[s] ?? 0;
                const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
                return (
                  <div key={s} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-medium" style={{ color: "var(--text-secondary)" }}>{cfg.label}</span>
                      <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>{count}</span>
                    </div>
                    <div className="h-1 rounded-full w-full" style={{ backgroundColor: "var(--bg-base)" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: "var(--accent-blue)" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Top opportunities */}
            <div className="p-4">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Meilleures opportunités" : "Top Opportunities"}</p>
              {sortedLeads.filter(l => l.stage === "proposal" || l.stage === "opportunity").slice(0, 5).length === 0 ? (
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Aucune opportunité active" : "No active opportunities"}</p>
              ) : sortedLeads.filter(l => l.stage === "proposal" || l.stage === "opportunity").slice(0, 5).map(lead => {
                const score = leadScore(lead);
                return (
                  <div key={lead.id} className="flex items-center gap-2 py-2 border-b last:border-0 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ borderColor: "var(--border-subtle)" }} onClick={() => setSelectedLeadId(lead.id)}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: "var(--accent-blue)" }}>
                      {lead.firstName[0]}{lead.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{lead.firstName} {lead.lastName}</p>
                      <p className="text-[9px]" style={{ color: "var(--text-tertiary)" }}>{STAGE_CONFIG[lead.stage]?.label}</p>
                    </div>
                    <span className="text-[10px] font-mono font-bold" style={{ color: scoreColor(score) }}>{score}</span>
                  </div>
                );
              })}
            </div>

          </div>
        </div>

      </div>
      {showCreateModal && <CreateLeadModal allStaff={allStaff ?? []} onClose={() => setShowCreateModal(false)} />}
      {selectedLeadId && leads.find(l => l.id === selectedLeadId) && (
        <LeadDetailModal lead={leads.find(l => l.id === selectedLeadId)!} allStaff={allStaff ?? []} onClose={() => setSelectedLeadId(null)} />
      )}
    </AppLayout>
  );
}

function _StatCard({ icon: Icon, label, value, color, bg }: { icon: React.ElementType; label: string; value: string | number; color: string; bg: string }) {
  return (
    <div className="fp-insightled-card p-5" data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-4`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-tertiary)" }}>{label}</p>
      <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>{value}</p>
    </div>
  );
}

function _SortableHeader({ field, label, sortField, sortDir, onToggle }: { field: SortField; label: string; sortField: SortField; sortDir: SortDir; onToggle: (field: SortField) => void }) {
  const active = sortField === field;
  return (
    <th
      className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-foreground select-none transition-colors"
      onClick={() => onToggle(field)}
      data-testid={`sort-${field}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (
          sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3 opacity-30" />
        )}
      </span>
    </th>
  );
}

function _LeadRow({ lead, allStaff, onStageChange, onReassign, onClick, stage, advisorId }: { lead: Lead; allStaff: StaffMember[]; onStageChange: (stage: string) => void; onReassign: (advisorId: number) => void; onClick: () => void }) {
  const { isFrench: isFr } = useLanguage();
  const STAGE_CONFIG = getStageConfig(isFr);
  const SOURCE_LABELS = getSourceLabels(isFr);
  const PRODUCT_INTEREST_LABELS = getProductInterestLabels(isFr);
  const _advisor = lead.advisorId ? allStaff.find(s => s.id === lead.advisorId) : null;
  const advisors = useAdvisorChoices(allStaff);
  const daysInPipeline = differenceInDays(new Date(), new Date(lead.createdAt!));
  const config = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.lead;

  return (
    <tr
      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors cursor-pointer group"
      data-testid={`row-lead-${lead.id}`}
    >
      <td className="px-4 py-3" onClick={onClick}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {lead.firstName[0]}{lead.lastName[0]}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{lead.firstName} {lead.lastName}</p>
            {lead.convertedClientId && (
              <Link
                href={`/clients/${lead.convertedClientId}`}
                onClick={e => e.stopPropagation()}
                data-testid={`link-converted-client-${lead.id}`}
                className="text-[11px] font-semibold text-emerald-600 hover:underline flex items-center gap-0.5"
              >
                <ArrowRightCircle className="w-3 h-3" /> Client File
              </Link>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <div className="space-y-0.5">
          {lead.phone && (
            <p className="text-xs text-slate-500 flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</p>
          )}
          {lead.email && (
            <p className="text-xs text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        {lead.productInterest && (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            <Package className="w-3 h-3" />
            {PRODUCT_INTEREST_LABELS[lead.productInterest] || lead.productInterest}
          </span>
        )}
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        {lead.source && (
          <span className="text-xs font-medium text-slate-500 bg-muted px-2 py-1 rounded-full">
            {SOURCE_LABELS[lead.source] || lead.source}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <select
          value={lead.advisorId ?? ""}
          onChange={e => { e.stopPropagation(); onReassign(Number(e.target.value)); }}
          onClick={e => e.stopPropagation()}
          data-testid={`select-advisor-${lead.id}`}
          className="px-2 py-1.5 rounded-lg text-xs font-medium border border-border bg-background focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none pr-7 bg-no-repeat bg-[length:14px] bg-[right_4px_center] max-w-[140px] truncate"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
        >
          {advisors.map(a => <option key={a.id} value={a.id}>{advisorLabel(a)}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">
        <select
          value={lead.stage}
          onChange={e => { e.stopPropagation(); onStageChange(e.target.value); }}
          onClick={e => e.stopPropagation()}
          data-testid={`select-stage-${lead.id}`}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border ${config.borderColor} ${config.bgColor} ${config.color} focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none pr-7 bg-no-repeat bg-[length:14px] bg-[right_4px_center]`}
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")` }}
        >
          {pipelineStages.map(s => (
            <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3" onClick={onClick}>
        <span className="text-xs text-slate-500">{daysInPipeline}d</span>
      </td>
      <td className="px-4 py-3">
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          data-testid={`button-view-lead-${lead.id}`}
          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
        >
          <Edit className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

function CreateLeadModal({ allStaff, onClose }: { allStaff: StaffMember[]; onClose: () => void }) {
  const { isFrench: isFr } = useLanguage();
  const STAGE_CONFIG = getStageConfig(isFr);
  const SOURCE_LABELS = getSourceLabels(isFr);
  const PRODUCT_INTEREST_LABELS = getProductInterestLabels(isFr);
  const createLead = useCreateLead();
  const advisors = useAdvisorChoices(allStaff);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    source: "",
    productInterest: "",
    notes: "",
    advisorId: null as number | null,
  });
  // Default new deals to the person creating them (not whoever happens to be first in the list).
  const { data: meForDefault } = useCurrentStaff();
  useEffect(() => {
    if (formData.advisorId == null && meForDefault && advisors.some(a => a.id === meForDefault.id)) {
      setFormData(f => ({ ...f, advisorId: meForDefault.id }));
    }
  }, [meForDefault, advisors]); // eslint-disable-line react-hooks/exhaustive-deps
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email && !formData.phone) {
      setError("At least one of email or phone is required.");
      return;
    }
    if (!formData.advisorId) {
      setError("A sales rep must be assigned.");
      return;
    }
    setError("");
    createLead.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email || null,
      phone: formData.phone || null,
      source: formData.source || null,
      productInterest: formData.productInterest || null,
      notes: formData.notes || null,
      advisorId: formData.advisorId,
    }, { onSuccess: () => onClose() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border bg-background/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">New Lead</h2>
            <p className="text-sm text-slate-500 mt-1">Add a new prospect to your pipeline.</p>
          </div>
          <button onClick={onClose} data-testid="button-close-create-lead" className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto" data-testid="form-create-lead">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 font-medium" data-testid="text-form-error">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">First Name *</label>
              <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} data-testid="input-lead-first-name" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Last Name *</label>
              <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} data-testid="input-lead-last-name" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Phone</label>
              <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} data-testid="input-lead-phone" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Email</label>
              <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} data-testid="input-lead-email" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Product Interest</label>
              <select value={formData.productInterest} onChange={e => setFormData({...formData, productInterest: e.target.value})} data-testid="select-lead-product-interest" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background">
                <option value="">Select product</option>
                {productInterestTypes.map(p => <option key={p} value={p}>{PRODUCT_INTEREST_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">Source</label>
              <select value={formData.source} onChange={e => setFormData({...formData, source: e.target.value})} data-testid="select-lead-source" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background">
                <option value="">Select source</option>
                {leadSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">Assigned Sales Rep *</label>
            <select value={formData.advisorId ?? ""} onChange={e => setFormData({...formData, advisorId: Number(e.target.value)})} data-testid="select-lead-advisor" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background" required>
              {advisors.map(a => <option key={a.id} value={a.id}>{advisorLabel(a)}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-500">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} data-testid="input-lead-notes" className="w-full px-4 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-background min-h-[60px]" />
          </div>
          <div className="pt-3 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createLead.isPending} data-testid="button-submit-lead" className="px-5 py-2.5 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
              {createLead.isPending ? (isFr ? "Création..." : "Creating...") : (isFr ? "Créer un prospect" : "Create Lead")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function LeadDetailContent({ leadId }: { leadId: number }) {
  const { isFrench: isFr } = useLanguage();
  const STAGE_CONFIG = getStageConfig(isFr);
  const SOURCE_LABELS = getSourceLabels(isFr);
  const PRODUCT_INTEREST_LABELS = getProductInterestLabels(isFr);
  const { data: lead } = useLead(leadId);
  const { data: allStaffData } = useStaffMembers();
  const allStaff = allStaffData ?? [];
  const updateLead = useUpdateLead();
  const _deleteLead = useDeleteLead();
  const { data: activities = [] } = useLeadActivities(leadId);
  const createActivity = useCreateLeadActivity();

  const [_isEditing, setIsEditing] = useState(false);
  const [newActivity, setNewActivity] = useState({ type: "note", title: "", description: "" });

  if (!lead) return <div className="animate-pulse h-48 bg-muted rounded-xl" />;

  const advisors = useAdvisorChoices(allStaff);
  const _advisor = lead.advisorId ? allStaff.find(s => s.id === lead.advisorId) : null;
  const config = STAGE_CONFIG[lead.stage] || STAGE_CONFIG.lead;
  const daysInPipeline = differenceInDays(new Date(), new Date(lead.createdAt!));

  const stageHistory: Array<{ stage: string; date: string }> = (() => {
    try { return JSON.parse(lead.stageHistory || "[]"); }
    catch { return []; }
  })();

  const handleStageChange = (newStage: string) => {
    updateLead.mutate({ id: lead.id, stage: newStage });
  };

  const handleAddActivity = () => {
    if (!newActivity.title) return;
    createActivity.mutate({
      leadId: lead.id,
      type: newActivity.type,
      title: newActivity.title,
      description: newActivity.description || undefined,
    }, { onSuccess: () => setNewActivity({ type: "note", title: "", description: "" }) });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-bold text-slate-900">{lead.firstName} {lead.lastName}</h2>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${config.bgColor} ${config.color}`}>{config.label}</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {lead.productInterest && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
            <Package className="w-3 h-3" /> {PRODUCT_INTEREST_LABELS[lead.productInterest]}
          </span>
        )}
        {lead.source && <span className="text-xs text-slate-500">via {SOURCE_LABELS[lead.source] || lead.source}</span>}
        <span className="text-xs text-slate-500">{daysInPipeline}d in pipeline</span>
      </div>

      {lead.convertedClientId && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2">
          <ArrowRightCircle className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">Converted to client</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-500">Stage:</span>
        <select
          value={lead.stage}
          onChange={e => handleStageChange(e.target.value)}
          data-testid="select-popout-lead-stage"
          className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${config.borderColor} ${config.bgColor} ${config.color} cursor-pointer`}
        >
          {pipelineStages.map(s => <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        {lead.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" /> {lead.phone}</div>}
        {lead.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-500" /> {lead.email}</div>}
        <div className="flex items-center gap-2">
          <UserPlus className="w-3.5 h-3.5 text-slate-500" />
          <select
            value={lead.advisorId ?? ""}
            onChange={e => updateLead.mutate({ id: lead.id, advisorId: Number(e.target.value) })}
            data-testid="select-popout-reassign"
            className="px-2 py-1 rounded-lg text-xs font-medium border border-border bg-background focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            {advisors.map(a => <option key={a.id} value={a.id}>{advisorLabel(a)}</option>)}
          </select>
        </div>
      </div>
      {lead.notes && <div className="p-3 rounded-xl bg-muted/30 text-sm text-foreground/80">{lead.notes}</div>}

      {stageHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-bold mb-2">Stage History</h4>
          <div className="space-y-1.5">
            {stageHistory.map((entry, i) => {
              const sc = STAGE_CONFIG[entry.stage] || { label: entry.stage, color: "text-gray-700", bgColor: "bg-gray-50" };
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full font-bold ${sc.bgColor} ${sc.color}`}>{sc.label}</span>
                  <span className="text-slate-500">{format(new Date(entry.date), "MMM d, yyyy 'at' h:mm a")}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <h4 className="text-sm font-bold mb-2">Activity Notes</h4>
        <div className="space-y-2 mb-3">
          {activities.length === 0 && <p className="text-xs text-slate-500">No activity notes yet.</p>}
          {activities.map(act => {
            const actStaff = act.staffId ? allStaff.find(s => s.id === act.staffId) : null;
            return (
              <div key={act.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-semibold">{act.title}</span>
                  <span className="text-xs text-slate-500">{act.createdAt && format(new Date(act.createdAt), "MMM d")}</span>
                </div>
                {act.description && <p className="text-xs text-slate-500">{act.description}</p>}
                {actStaff && <p className="text-[10px] text-slate-500/60 mt-0.5">— {actStaff.firstName} {actStaff.lastName}</p>}
              </div>
            );
          })}
        </div>
        <div className="p-2.5 rounded-xl bg-muted/20 border border-border space-y-2">
          <div className="flex gap-2">
            <select value={newActivity.type} onChange={e => setNewActivity({...newActivity, type: e.target.value})} className="px-2 py-1.5 rounded-lg border border-border text-xs bg-background">
              <option value="note">Note</option>
              <option value="phone_call">Phone Call</option>
              <option value="email">Email</option>
              <option value="appointment">Appointment</option>
              <option value="follow_up">Follow Up</option>
            </select>
            <input value={newActivity.title} onChange={e => setNewActivity({...newActivity, title: e.target.value})} placeholder="Activity title" data-testid="input-popout-activity-title" className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs bg-background" />
          </div>
          <div className="flex justify-end">
            <button onClick={handleAddActivity} disabled={!newActivity.title || createActivity.isPending} data-testid="button-popout-add-activity" className="px-3 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50">
              {createActivity.isPending ? (isFr ? "Ajout..." : "Adding...") : (isFr ? "Ajouter une note" : "Add Note")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadDetailModal({ lead, allStaff, onClose }: { lead: Lead; allStaff: StaffMember[]; onClose: () => void }) {
  const { isFrench: isFr } = useLanguage();
  const STAGE_CONFIG = getStageConfig(isFr);
  const SOURCE_LABELS = getSourceLabels(isFr);
  const PRODUCT_INTEREST_LABELS = getProductInterestLabels(isFr);
  const { data: freshLead } = useLead(lead.id);
  const current = freshLead || lead;
  const updateLead = useUpdateLead();
  const deleteLead = useDeleteLead();
  const { data: activities = [] } = useLeadActivities(current.id);
  const createActivity = useCreateLeadActivity();
  const advisors = useAdvisorChoices(allStaff);
  const _advisor = current.advisorId ? allStaff.find(s => s.id === current.advisorId) : null;
  const { openWindow } = useWindowManager();

  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    firstName: current.firstName,
    lastName: current.lastName,
    email: current.email || "",
    phone: current.phone || "",
    source: current.source || "",
    productInterest: current.productInterest || "",
    notes: current.notes || "",
    advisorId: current.advisorId ?? null,
  });

  const [newActivity, setNewActivity] = useState({ type: "note", title: "", description: "" });

  const stageHistory = (() => {
    try { return JSON.parse(current.stageHistory || "[]"); }
    catch { return []; }
  })();

  const handlePopOut = () => {
    openWindow({
      id: `lead-${current.id}`,
      title: `${current.firstName} ${current.lastName} — Lead`,
      component: <LeadDetailContent leadId={current.id} />,
      width: 700,
      height: 600,
    });
    onClose();
  };

  const handleSaveEdit = () => {
    updateLead.mutate({
      id: current.id,
      firstName: editData.firstName,
      lastName: editData.lastName,
      email: editData.email || null,
      phone: editData.phone || null,
      source: editData.source || null,
      productInterest: editData.productInterest || null,
      notes: editData.notes || null,
      advisorId: editData.advisorId,
    }, { onSuccess: () => setIsEditing(false) });
  };

  const handleStageChange = (newStage: string) => {
    updateLead.mutate({ id: current.id, stage: newStage });
  };

  const handleDelete = () => {
    if (confirm("Delete this lead? This action cannot be undone.")) {
      deleteLead.mutate(current.id, { onSuccess: () => onClose() });
    }
  };

  const handleAddActivity = () => {
    if (!newActivity.title) return;
    createActivity.mutate({
      leadId: current.id,
      type: newActivity.type,
      title: newActivity.title,
      description: newActivity.description || undefined,
    }, { onSuccess: () => setNewActivity({ type: "note", title: "", description: "" }) });
  };

  const config = STAGE_CONFIG[current.stage] || STAGE_CONFIG.lead;
  const daysInPipeline = differenceInDays(new Date(), new Date(current.createdAt!));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border bg-background/50">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-slate-900" data-testid="text-lead-name">{current.firstName} {current.lastName}</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${config.bgColor} ${config.color}`} data-testid="text-lead-stage">
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5">
                {current.productInterest && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700">
                    <Package className="w-3 h-3" /> {PRODUCT_INTEREST_LABELS[current.productInterest]}
                  </span>
                )}
                {current.source && (
                  <span className="text-xs text-slate-500">via {SOURCE_LABELS[current.source] || current.source}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handlePopOut} data-testid="button-popout-lead" className="p-2 rounded-lg hover:bg-muted text-slate-500 hover:text-primary transition-colors" title="Pop out to floating window">
                <ExternalLink className="w-5 h-5" />
              </button>
              <button onClick={onClose} data-testid="button-close-lead-detail" className="p-2 rounded-lg hover:bg-muted"><X className="w-5 h-5" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {current.convertedClientId && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowRightCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700">Converted to client</span>
              </div>
              <Link href={`/clients/${current.convertedClientId}`} data-testid="link-converted-client" className="text-sm font-bold text-emerald-700 hover:text-emerald-800 underline">
                Open Client File →
              </Link>
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-500">Stage:</span>
            <select
              value={current.stage}
              onChange={e => handleStageChange(e.target.value)}
              data-testid="select-detail-stage"
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${config.borderColor} ${config.bgColor} ${config.color} focus:ring-2 focus:ring-primary/20 cursor-pointer`}
            >
              {pipelineStages.map(s => (
                <option key={s} value={s}>{STAGE_CONFIG[s].label}</option>
              ))}
            </select>
            {current.stage === "opportunity" && !current.convertedClientId && (
              <span className="text-xs text-purple-600 font-medium animate-pulse">Converting to client...</span>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3 p-4 rounded-xl bg-muted/30 border border-border">
              <div className="grid grid-cols-2 gap-3">
                <input value={editData.firstName} onChange={e => setEditData({...editData, firstName: e.target.value})} placeholder="First Name" data-testid="input-edit-lead-first-name" className="px-3 py-2 rounded-lg border border-border text-sm bg-background" />
                <input value={editData.lastName} onChange={e => setEditData({...editData, lastName: e.target.value})} placeholder="Last Name" data-testid="input-edit-lead-last-name" className="px-3 py-2 rounded-lg border border-border text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="tel" value={editData.phone} onChange={e => setEditData({...editData, phone: e.target.value})} placeholder="Phone" data-testid="input-edit-lead-phone" className="px-3 py-2 rounded-lg border border-border text-sm bg-background" />
                <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} placeholder="Email" data-testid="input-edit-lead-email" className="px-3 py-2 rounded-lg border border-border text-sm bg-background" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={editData.productInterest} onChange={e => setEditData({...editData, productInterest: e.target.value})} data-testid="select-edit-lead-product-interest" className="px-3 py-2 rounded-lg border border-border text-sm bg-background">
                  <option value="">Product Interest</option>
                  {productInterestTypes.map(p => <option key={p} value={p}>{PRODUCT_INTEREST_LABELS[p]}</option>)}
                </select>
                <select value={editData.source} onChange={e => setEditData({...editData, source: e.target.value})} data-testid="select-edit-lead-source" className="px-3 py-2 rounded-lg border border-border text-sm bg-background">
                  <option value="">Source</option>
                  {leadSources.map(s => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
                </select>
              </div>
              <select value={editData.advisorId ?? ""} onChange={e => setEditData({...editData, advisorId: Number(e.target.value)})} data-testid="select-edit-lead-advisor" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background" required>
                {advisors.map(a => <option key={a.id} value={a.id}>{advisorLabel(a)}</option>)}
              </select>
              <textarea value={editData.notes} onChange={e => setEditData({...editData, notes: e.target.value})} placeholder="Notes" data-testid="input-edit-lead-notes" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background min-h-[60px]" />
              <div className="flex justify-end gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-muted">Cancel</button>
                <button onClick={handleSaveEdit} disabled={updateLead.isPending} data-testid="button-save-lead-edit" className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50">
                  {updateLead.isPending ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Enregistrer" : "Save Changes")}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {current.phone && (
                  <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-slate-500" /> {current.phone}</div>
                )}
                {current.email && (
                  <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-slate-500" /> {current.email}</div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <UserPlus className="w-4 h-4 text-slate-500" />
                  <select
                    value={current.advisorId ?? ""}
                    onChange={e => updateLead.mutate({ id: current.id, advisorId: Number(e.target.value) })}
                    data-testid="select-detail-reassign"
                    className="px-2 py-1 rounded-lg text-sm font-medium border border-border bg-background focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    {advisors.map(a => <option key={a.id} value={a.id}>{advisorLabel(a)}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Calendar className="w-4 h-4" /> {daysInPipeline} days in pipeline
                </div>
                {current.createdAt && (
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" /> Created {format(new Date(current.createdAt), "MMM d, yyyy")}
                  </div>
                )}
              </div>
              {current.notes && (
                <div className="col-span-2 p-3 rounded-xl bg-muted/30 text-sm text-foreground/80">{current.notes}</div>
              )}
              <div className="col-span-2 flex gap-2">
                <button onClick={() => setIsEditing(true)} data-testid="button-edit-lead" className="px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors">Edit Details</button>
                <button onClick={handleDelete} data-testid="button-delete-lead" className="px-4 py-2 rounded-lg text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-1.5">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          )}

          {stageHistory.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-foreground mb-3">Stage History</h4>
              <div className="space-y-2">
                {stageHistory.map((entry: { stage: string; date: string }, i: number) => {
                  const sc = STAGE_CONFIG[entry.stage] || { label: entry.stage, color: "text-gray-700", bgColor: "bg-gray-50" };
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${sc.bgColor} ${sc.color}`}>{sc.label}</span>
                      <span className="text-slate-500">{format(new Date(entry.date), "MMM d, yyyy 'at' h:mm a")}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-sm font-bold text-foreground mb-3">Activity Notes</h4>
            <div className="space-y-2 mb-3">
              {activities.length === 0 && <p className="text-sm text-slate-500">No activity notes yet.</p>}
              {activities.map(act => {
                const actStaff = act.staffId ? allStaff.find(s => s.id === act.staffId) : null;
                return (
                  <div key={act.id} className="p-3 rounded-xl bg-muted/30 border border-border/50" data-testid={`activity-${act.id}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-semibold text-foreground">{act.title}</span>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="px-2 py-0.5 rounded-full bg-muted font-medium capitalize">{act.type.replace("_", " ")}</span>
                        {act.createdAt && format(new Date(act.createdAt), "MMM d")}
                      </div>
                    </div>
                    {act.description && <p className="text-sm text-slate-500">{act.description}</p>}
                    {actStaff && <p className="text-xs text-slate-500 mt-1">— {actStaff.firstName} {actStaff.lastName}</p>}
                  </div>
                );
              })}
            </div>
            <div className="p-3 rounded-xl bg-muted/20 border border-border space-y-2">
              <div className="flex gap-2">
                <select value={newActivity.type} onChange={e => setNewActivity({...newActivity, type: e.target.value})} className="px-3 py-2 rounded-lg border border-border text-sm bg-background">
                  <option value="note">Note</option>
                  <option value="phone_call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="appointment">Appointment</option>
                  <option value="follow_up">Follow Up</option>
                </select>
                <input value={newActivity.title} onChange={e => setNewActivity({...newActivity, title: e.target.value})} placeholder="Activity title" data-testid="input-activity-title" className="flex-1 px-3 py-2 rounded-lg border border-border text-sm bg-background" />
              </div>
              <textarea value={newActivity.description} onChange={e => setNewActivity({...newActivity, description: e.target.value})} placeholder="Description (optional)" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background min-h-[40px]" />
              <div className="flex justify-end">
                <button onClick={handleAddActivity} disabled={!newActivity.title || createActivity.isPending} data-testid="button-add-activity" className="px-4 py-2 rounded-lg text-sm bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50">
                  {createActivity.isPending ? (isFr ? "Ajout..." : "Adding...") : (isFr ? "Ajouter une note" : "Add Note")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
