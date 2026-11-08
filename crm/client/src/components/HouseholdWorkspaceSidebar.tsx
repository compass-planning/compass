/**
import { useLanguage } from "@/contexts/LanguageContext";
 * HouseholdWorkspaceSidebar — bilingual version
 */

import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link } from "wouter";
import {
  ArrowLeft, Target, PiggyBank, Shield, DollarSign,
  FileText, Calendar, Activity, Briefcase, Lightbulb,
  TrendingUp, ChevronDown, ChevronRight, AlertTriangle,
  Brain, Receipt, Scale, CheckSquare, ScrollText, UserCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  province?: string | null;
  email?: string | null;
}

interface Overview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  retirementProjections: number;
  insuranceAnalyses: number;
  educationPlans: number;
  taxNotes: number;
  estateNotes: number;
  aiRecommendations: number;
  pendingAi: number;
  plans: number;
}

export type WorkspaceSection =
  | "profile"
  | "fp.overview" | "fp.goals" | "fp.networth" | "fp.retirement" | "fp.cashflow" | "fp.pension"
  | "protection.insurance" | "protection.gaps"
  | "estate.estate" | "estate.tax"
  | "activity.notes" | "activity.meetings" | "activity.tasks"
  | "documents.policies" | "documents.files"
  | "opportunities";

function calcScores(ov: Overview | null) {
  if (!ov) return { retirement: 0, protection: 0, estate: 0, tax: 0, overall: 0 };
  const retirement  = ov.retirementProjections > 0 ? Math.min(100, 55 + ov.retirementProjections * 15) : 0;
  const protection  = ov.insuranceAnalyses     > 0 ? Math.min(100, 60 + ov.insuranceAnalyses * 20)     : 0;
  const estate      = ov.estateNotes           > 0 ? Math.min(100, 65 + ov.estateNotes * 15)           : 0;
  const tax         = ov.taxNotes              > 0 ? Math.min(100, 60 + ov.taxNotes * 15)              : 15;
  const overall     = Math.round((retirement + protection + estate + tax) / 4);
  return { retirement, protection, estate, tax, overall };
}

function scoreColor(s: number) {
  if (s >= 75) return "#10b981";
  if (s >= 50) return "#3b82f6";
  if (s >= 25) return "#f59e0b";
  return "#ef4444";
}


function tFn(dict: any, key: string): string {
  const parts = key.split(".");
  let cur = dict;
  for (const p of parts) { if (cur == null) return key; cur = cur[p]; }
  return typeof cur === "string" ? cur : key;
}

function ScoreRing({ score, size = 36 }: { score: number; size?: number }) {
  const r = (size / 2) - 3;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = scoreColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="3" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

function NavSection({ label, icon: Icon, color, bg, items, activeSection, onSelect, defaultOpen = false }: {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  items: { key: WorkspaceSection; label: string; icon: React.ElementType; badge?: number }[];
  activeSection: WorkspaceSection;
  onSelect: (s: WorkspaceSection) => void;
  defaultOpen?: boolean;
}) {
  const isActive = items.some(i => i.key === activeSection);
  const [open, setOpen] = useState(defaultOpen || isActive);

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
      >
        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${bg}`}>
          <Icon className={`w-3 h-3 ${color}`} />
        </div>
        <span className="text-xs font-semibold text-slate-700 flex-1">{label}</span>
        {open
          ? <ChevronDown className="w-3 h-3 text-slate-300" />
          : <ChevronRight className="w-3 h-3 text-slate-300" />
        }
      </button>
      {open && (
        <div className="ml-4 pl-3 border-l border-slate-100 mb-1">
          {items.map(item => (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                activeSection === item.key
                  ? "bg-violet-50 text-violet-700 font-semibold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              <div className="flex items-center gap-2">
                <item.icon className="w-3 h-3 flex-shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge != null && item.badge > 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function HouseholdWorkspaceSidebar({ client, activeSection, onSectionChange }: {
  client: Client;
  activeSection: WorkspaceSection;
  onSectionChange: (s: WorkspaceSection) => void;
  s?: WorkspaceSection;
}) {
  const { t: _tObj } = useLanguage();
  const t = (key: string) => tFn(_tObj as any, key);

  const { data: overview } = useQuery<Overview>({
    queryKey: ["overview", client.id],
    queryFn: async () => {
      const r = await fetch(`/api/crm/clients/${client.id}/overview`);
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });

  const scores = calcScores(overview ?? null);
  const overall = scores.overall;
  const overallColor = scoreColor(overall);

  const alerts: string[] = [];
  if (!overview?.retirementProjections) alerts.push(t("household.noRetirement"));
  if (!overview?.insuranceAnalyses) alerts.push(t("household.noInsurance"));
  if ((overview?.pendingAi ?? 0) > 0) alerts.push(`${overview?.pendingAi ?? 0} ${t("household.aiPending")}`);

  const navSections = [
    {
      label: t("household.financialPlan"),
      icon: Brain, color: "text-violet-600", bg: "bg-violet-50",
      defaultOpen: true,
      items: [
        { key: "fp.overview"   as WorkspaceSection, label: t("nav.overview"),   icon: Lightbulb },
        { key: "fp.networth"   as WorkspaceSection, label: t("nav.netWorth"),   icon: DollarSign, badge: overview?.netWorth === 0 ? 1 : 0 },
        { key: "fp.goals"      as WorkspaceSection, label: t("nav.goals"),      icon: Target },
        { key: "fp.retirement" as WorkspaceSection, label: t("nav.retirement"), icon: PiggyBank, badge: overview?.retirementProjections === 0 ? 1 : 0 },
        { key: "fp.cashflow"   as WorkspaceSection, label: t("nav.cashFlow"),   icon: TrendingUp },
        { key: "fp.pension"    as WorkspaceSection, label: t("nav.retirement"), icon: Receipt },
      ],
    },
    {
      label: t("household.protection"),
      icon: Shield, color: "text-purple-600", bg: "bg-purple-50",
      items: [
        { key: "protection.insurance" as WorkspaceSection, label: t("nav.insurance"), icon: Shield, badge: overview?.insuranceAnalyses === 0 ? 1 : 0 },
        { key: "protection.gaps"      as WorkspaceSection, label: t("household.gaps"), icon: AlertTriangle },
      ],
    },
    {
      label: t("household.estate") + " & " + t("household.tax"),
      icon: Scale, color: "text-indigo-600", bg: "bg-indigo-50",
      items: [
        { key: "estate.estate" as WorkspaceSection, label: t("nav.estate"), icon: Briefcase, badge: overview?.estateNotes === 0 ? 1 : 0 },
        { key: "estate.tax"    as WorkspaceSection, label: t("nav.tax"),    icon: Receipt,   badge: overview?.taxNotes === 0 ? 1 : 0 },
      ],
    },
    {
      label: t("household.activity"),
      icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50",
      items: [
        { key: "activity.notes"    as WorkspaceSection, label: t("household.notes"),    icon: FileText },
        { key: "activity.meetings" as WorkspaceSection, label: t("household.meetings"), icon: Calendar },
        { key: "activity.tasks"    as WorkspaceSection, label: t("household.tasks"),    icon: CheckSquare },
      ],
    },
    {
      label: t("household.documents"),
      icon: ScrollText, color: "text-slate-600", bg: "bg-slate-100",
      items: [
        { key: "documents.policies" as WorkspaceSection, label: t("household.policies"), icon: Shield },
        { key: "documents.files"    as WorkspaceSection, label: t("household.files"),    icon: FileText },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Back + client header */}
      <div className="p-3 border-b border-slate-100">
        <Link href="/clients"
          className="flex items-center gap-1.5 text-[10px] text-slate-400 hover:text-slate-700 mb-3 transition-colors w-fit">
          <ArrowLeft className="w-3 h-3" /> {t("client.allClients")}
        </Link>

        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => onSectionChange("fp.overview")}>
            <ScoreRing score={overall} size={44} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] font-bold" style={{ color: overallColor }}>{overall}</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <button onClick={() => onSectionChange("profile")}
              className="text-sm font-bold text-slate-900 truncate block hover:text-violet-700 transition-colors text-left w-full">
              {client.firstName} {client.lastName}
            </button>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {client.province && (
                <span className="text-[9px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                  {client.province}
                </span>
              )}
              {alerts.length > 0 && (
                <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  {alerts.length} {alerts.length > 1 ? t("household.alertsPlural") : t("household.alerts")}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile link */}
      <div className="px-3 py-2 border-b border-slate-100">
        <button
          onClick={() => onSectionChange("profile")}
          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
            activeSection === "profile"
              ? "bg-violet-50 text-violet-700 font-semibold"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <UserCircle className="w-3.5 h-3.5" />
          {t("household.profile")}
        </button>
      </div>

      {/* Nav sections */}
      <div className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => (
          <NavSection
            key={section.label}
            label={section.label}
            icon={section.icon}
            color={section.color}
            bg={section.bg}
            items={section.items}
            activeSection={activeSection}
            onSelect={onSectionChange}
            defaultOpen={section.defaultOpen}
          />
        ))}

        {/* Opportunities */}
        <button
          onClick={() => onSectionChange("opportunities")}
          className={`w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            activeSection === "opportunities"
              ? "bg-violet-50 text-violet-700 font-semibold"
              : "text-slate-500 hover:bg-slate-50"
          }`}
        >
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 bg-amber-50">
            <Target className="w-3 h-3 text-amber-600" />
          </div>
          <span className="font-semibold text-slate-700">{t("household.opportunities")}</span>
        </button>
      </div>
    </div>
  );
}
