import {
  LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain, TrendingUp,
  FileText, Target, Sparkles, UserCog,
  CreditCard, Globe, Building2, Home,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useLocale } from "../hooks/useLocale";

export type Tab =
  | "overview" | "dashboard"
  | "networth" | "goals" | "debt"
  | "retirementhub" | "protection"
  | "expenses"
  | "taxestate" | "ai"
  | "documents" | "fp" | "profile";

interface Props {
  activeTab: Tab;
  onTab: (t: Tab) => void;
  userName?: string;
}

function useTabGroups(t: any) {
  return [
    {
      group: "home",
      label: null,
      tabs: [
        { key: "overview",  label: "My Dashboard",          icon: Home },
        { key: "dashboard", label: t("nav.dashboard"),      icon: TrendingUp },
        { key: "profile",   label: "My Profile",            icon: UserCog },
      ],
    },
    {
      group: "planning",
      label: "My Plan",
      tabs: [
        { key: "networth",      label: t("nav.netWorth"),   icon: Scale },
        { key: "goals",         label: t("nav.goals"),      icon: Target },
        { key: "debt",          label: t("nav.debt"),       icon: CreditCard },
        { key: "retirementhub", label: t("nav.retirement"), icon: PiggyBank },
        { key: "protection",    label: t("nav.insurance"),  icon: Shield },
        { key: "expenses",      label: t("nav.cashFlow"),   icon: Receipt },
        { key: "taxestate",     label: t("nav.tax"),        icon: Building2 },
      ],
    },
    {
      group: "outputs",
      label: "Reports",
      tabs: [
        { key: "ai",        label: "AI Insights",                   icon: Brain },
        { key: "documents", label: "Documents",                     icon: FileText },
        { key: "fp",        label: t("planning.financialPlan"),     icon: Sparkles },
      ],
    },
  ];
}

export function Sidebar({ activeTab, onTab, userName }: Props) {
  const { t, locale, setLocale, isForced } = useLocale();
  const groups = useTabGroups(t);

  return (
    <aside className="w-56 flex-shrink-0 min-h-screen bg-[#2d1b69] flex flex-col select-none">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <img
          src="/compass-logo.svg"
          alt="Compass Planning"
          className="w-full max-w-[150px] mx-auto block object-contain"
        />
      </div>

      {/* User pill */}
      {userName && (
        <div className="mx-3 mt-3 px-3 py-2 bg-white/10 rounded-lg border border-white/10">
          <div className="text-[9px] text-white/40 uppercase tracking-widest mb-0.5">My Plan</div>
          <div className="text-xs text-white font-semibold truncate">{userName}</div>
        </div>
      )}

      {/* Nav — all tabs always accessible */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-1">
        {groups.map(group => (
          <div key={group.group}>
            {group.label && (
              <div className="px-3 pt-3 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">
                  {group.label}
                </span>
              </div>
            )}
            {group.tabs.map(tab => {
              const key = tab.key as Tab;
              const isActive = activeTab === key;
              const Icon = tab.icon;
              return (
                <button
                  key={key}
                  onClick={() => onTab(key)}
                  className={cn(
                    "group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 focus:outline-none",
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
                  )}
                >
                  <Icon className={cn(
                    "w-3.5 h-3.5 flex-shrink-0 transition-colors",
                    isActive ? "text-violet-400" : "text-white/40 group-hover:text-white/70"
                  )} />
                  <span className="text-[12px] font-medium flex-1">{tab.label}</span>
                  {isActive && <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 pt-2 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-1 justify-center">
          <Globe className="w-3 h-3 text-white/30" />
          {(["en", "fr"] as const).map(lang => (
            <button
              key={lang}
              onClick={() => setLocale(lang)}
              className={cn(
                "text-[10px] font-bold px-2 py-0.5 rounded transition-colors uppercase",
                locale === lang ? "bg-violet-500/20 text-violet-400" : "text-white/30 hover:text-white/60"
              )}
            >{lang}</button>
          ))}
          {isForced && locale === "fr" && <span className="text-[10px] text-white/20 ml-0.5">(QC)</span>}
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
          <span className="text-[10px] text-white/30">All systems operational</span>
        </div>
      </div>
    </aside>
  );
}
