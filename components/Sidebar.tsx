import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain, TrendingUp,
  UserCheck, FileText, Target, Sparkles, UserCog,
  CreditCard, Globe, GraduationCap, Building2,
  ChevronRight, Settings
} from "lucide-react";
import { cn } from "../lib/utils";
import { useLocale } from "../hooks/useLocale";

export type Tab =
  | "agents"
  | "clients" | "overview" | "dashboard"
  | "networth" | "goals" | "debt"
  | "retirementhub" | "protection"
  | "expenses"
  | "taxestate" | "ai"
  | "documents" | "fp" | "profile";

interface Props {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  clientName?: string;
  role?: string;
  level?: string;
}

// ── Tab groups ────────────────────────────────────────────────────────────────
function useTabGroups(t: any) {
  return [
    {
      group: "agency",
      label: null,
      tabs: [
        { key: "agents",  label: t("nav.agents"),  icon: UserCheck, gaOnly: true },
        { key: "clients", label: t("nav.clients"), icon: Users },
      ]
    },
    {
      group: "client",
      label: t("nav.overview"),
      tabs: [
        { key: "overview",   label: t("nav.overview"),      icon: LayoutDashboard },
        { key: "dashboard",  label: t("nav.dashboard"),     icon: TrendingUp },
        { key: "profile",    label: t("nav.clientProfile"), icon: UserCog },
      ]
    },
    {
      group: "planning",
      label: t("nav.financialPlanning"),
      tabs: [
        { key: "networth",      label: t("nav.netWorth"),    icon: Scale },
        { key: "goals",         label: t("nav.goals"),       icon: Target },
        { key: "debt",          label: t("nav.debt"),        icon: CreditCard },
        { key: "retirementhub", label: t("nav.retirement"),  icon: PiggyBank },
        { key: "protection",    label: t("nav.insurance"),   icon: Shield },
        { key: "expenses",      label: t("nav.cashFlow"),    icon: Receipt },
        { key: "taxestate",     label: t("nav.tax"),         icon: Building2 },
      ]
    },
    {
      group: "outputs",
      label: t("nav.reports"),
      tabs: [
        { key: "ai",        label: "AI Insights",          icon: Brain },
        { key: "documents", label: "Documents",            icon: FileText },
        { key: "fp",        label: t("planning.financialPlan"), icon: Sparkles },
      ]
    },
  ];
}

const STANDARD_TABS: Tab[] = ["clients", "networth", "protection", "documents"];
const PLAN_TABS: Tab[] = [
  "overview", "profile", "dashboard", "networth", "goals", "debt", "retirementhub", "protection",
  "expenses", "taxestate", "ai", "documents", "fp"
];
const NO_CLIENT_TABS: Tab[] = ["clients", "agents"];

export function Sidebar({ activeTab, onTab, clientName, role, level }: Props) {
  const { t, locale, setLocale, isForced } = useLocale();
  const groups = useTabGroups(t);
  const isGA = role === "ga";
  const isStandard = !isGA && level === "standard";
  const hasClient = !!clientName;

  return (
    <aside className="w-56 flex-shrink-0 min-h-screen bg-[#0c1e3a] flex flex-col select-none">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <img
          src="/compass-logo.svg"
          alt="Compass Planning"
          className="w-full max-w-[130px] mx-auto block object-contain"
        />
        <p className="text-[10px] text-white/40 font-medium tracking-widest text-center mt-2 uppercase">
          Financial Planning
        </p>
      </div>

      {/* Active client pill */}
      {clientName && (
        <div className="mx-3 mt-3 px-3 py-2 bg-white/10 rounded-lg border border-white/10">
          <div className="text-[9px] text-white/40 uppercase tracking-widest mb-0.5">Active Client</div>
          <div className="text-xs text-white font-semibold truncate">{clientName}</div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-1">
        {groups.map(group => {
          const visibleTabs = group.tabs.filter(tab => {
            if ((tab as any).gaOnly && !isGA) return false;
            if (isStandard && !STANDARD_TABS.includes(tab.key as Tab)) return false;
            return true;
          });
          if (!visibleTabs.length) return null;

          return (
            <div key={group.group}>
              {group.label && (
                <div className="px-3 pt-3 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                    {group.label}
                  </span>
                </div>
              )}
              {visibleTabs.map(tab => {
                const key = tab.key as Tab;
                const isActive = activeTab === key;
                const disabled = PLAN_TABS.includes(key) && !hasClient && !NO_CLIENT_TABS.includes(key);
                const Icon = tab.icon;

                return (
                  <button
                    key={key}
                    onClick={() => !disabled && onTab(key)}
                    title={disabled ? "Select a client first" : tab.label}
                    disabled={disabled}
                    className={cn(
                      "group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 focus:outline-none",
                      isActive
                        ? "bg-white/15 text-white shadow-sm"
                        : disabled
                          ? "text-white/20 cursor-not-allowed"
                          : "text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                    )}
                  >
                    <Icon className={cn(
                      "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                      isActive ? "text-cyan-400" : "text-white/40 group-hover:text-white/70"
                    )} />
                    <span className="text-[12px] font-medium flex-1">{tab.label}</span>
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10 space-y-2">

        {/* Language toggle */}
        {!isForced ? (
          <div className="flex items-center gap-1 justify-center">
            <Globe className="w-3 h-3 text-white/30" />
            {(["en", "fr"] as const).map(lang => (
              <button
                key={lang}
                onClick={() => setLocale(lang)}
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded transition-colors uppercase",
                  locale === lang
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "text-white/30 hover:text-white/60"
                )}
              >{lang}</button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1 justify-center text-white/30">
            <Globe className="w-3 h-3" />
            <span className="text-[10px]">Français (Québec)</span>
          </div>
        )}

        {/* Role badge */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-[10px] text-white/40">
            {isGA ? "General Agent" : `FA · ${isStandard ? "Standard" : "Enhanced"}`}
          </span>
        </div>

        {/* Status dot */}
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] text-white/30">All systems operational</span>
        </div>
      </div>
    </aside>
  );
}
