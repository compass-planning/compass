import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain, TrendingUp,
  UserCheck, FileText, Target, Sparkles, UserCog,
  CreditCard, Building2, Globe, Settings, LogOut,
  Compass,
} from "lucide-react";

// Simple cn util (avoids dep on clsx when not available at call site)
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type AdvisorTab =
  | "clients"
  | "overview"
  | "dashboard"
  | "networth"
  | "goals"
  | "debt"
  | "retirementhub"
  | "protection"
  | "expenses"
  | "taxestate"
  | "ai"
  | "documents"
  | "fp"
  | "profile";

interface Props {
  activeTab: AdvisorTab;
  onTab: (t: AdvisorTab) => void;
  clientName?: string;
  advisorName?: string;
  onLogout?: () => void;
  locale?: "en" | "fr";
  onLocaleChange?: (l: "en" | "fr") => void;
}

interface TabDef {
  key: AdvisorTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface Group {
  group: string;
  label: string | null;
  tabs: TabDef[];
}

function tabGroups(locale: "en" | "fr"): Group[] {
  const en = locale === "en";
  return [
    {
      group: "advisor",
      label: null,
      tabs: [
        { key: "clients", label: en ? "Clients" : "Clients", icon: Users },
      ],
    },
    {
      group: "client",
      label: en ? "Client Overview" : "Aperçu client",
      tabs: [
        { key: "overview",  label: en ? "Overview"       : "Aperçu",        icon: LayoutDashboard },
        { key: "dashboard", label: en ? "Dashboard"      : "Tableau",        icon: TrendingUp },
        { key: "profile",   label: en ? "Client Profile" : "Profil client",  icon: UserCog },
      ],
    },
    {
      group: "planning",
      label: en ? "Financial Planning" : "Planification",
      tabs: [
        { key: "networth",      label: en ? "Net Worth"   : "Valeur nette",   icon: Scale },
        { key: "goals",         label: en ? "Goals"       : "Objectifs",      icon: Target },
        { key: "debt",          label: en ? "Debt"        : "Dettes",         icon: CreditCard },
        { key: "retirementhub", label: en ? "Retirement"  : "Retraite",       icon: PiggyBank },
        { key: "protection",    label: en ? "Insurance"   : "Assurance",      icon: Shield },
        { key: "expenses",      label: en ? "Cash Flow"   : "Flux de trésor", icon: Receipt },
        { key: "taxestate",     label: en ? "Tax & Estate": "Impôt & Succès", icon: Building2 },
      ],
    },
    {
      group: "outputs",
      label: en ? "Reports & AI" : "Rapports & IA",
      tabs: [
        { key: "ai",        label: "AI Insights",        icon: Brain },
        { key: "documents", label: en ? "Documents" : "Documents", icon: FileText },
        { key: "fp",        label: en ? "Financial Plan" : "Plan financier",  icon: Sparkles },
      ],
    },
  ];
}

// Tabs that require an active client
const CLIENT_REQUIRED: AdvisorTab[] = [
  "overview", "dashboard", "profile", "networth", "goals", "debt",
  "retirementhub", "protection", "expenses", "taxestate", "ai", "documents", "fp",
];

export function AdvisorSidebar({
  activeTab,
  onTab,
  clientName,
  advisorName,
  onLogout,
  locale = "en",
  onLocaleChange,
}: Props) {
  const groups = tabGroups(locale);
  const hasClient = Boolean(clientName);

  return (
    <aside className="w-56 flex-shrink-0 min-h-screen flex flex-col select-none" style={{ background: "#0f0a1e" }}>

      {/* ── Logo ─────────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(167,139,250,0.15)" }}>
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)" }}
          >
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-white text-sm font-bold leading-none">Compass</div>
            <div className="text-[10px] font-medium uppercase tracking-widest" style={{ color: "#a78bfa" }}>
              Advisor
            </div>
          </div>
        </div>
      </div>

      {/* ── Active client pill ─────────────────────────────────────── */}
      {clientName ? (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg"
          style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.25)" }}
        >
          <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "rgba(167,139,250,0.6)" }}>
            Active Client
          </div>
          <div className="text-xs font-semibold truncate text-white">{clientName}</div>
        </div>
      ) : (
        <div
          className="mx-3 mt-3 px-3 py-2 rounded-lg"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
            No client selected
          </div>
        </div>
      )}

      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-1">
        {groups.map(group => {
          const visibleTabs = group.tabs;
          if (!visibleTabs.length) return null;

          return (
            <div key={group.group}>
              {group.label && (
                <div className="px-3 pt-3 pb-1">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.25)" }}
                  >
                    {group.label}
                  </span>
                </div>
              )}
              {visibleTabs.map(tab => {
                const key = tab.key;
                const isActive = activeTab === key;
                const disabled = CLIENT_REQUIRED.includes(key) && !hasClient;
                const Icon = tab.icon;

                return (
                  <button
                    key={key}
                    onClick={() => !disabled && onTab(key)}
                    title={disabled ? "Select a client first" : tab.label}
                    disabled={disabled}
                    className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 focus:outline-none"
                    style={
                      isActive
                        ? {
                            background: "rgba(124,58,237,0.2)",
                            border: "1px solid rgba(124,58,237,0.3)",
                          }
                        : disabled
                        ? { opacity: 0.25, cursor: "not-allowed" }
                        : { border: "1px solid transparent" }
                    }
                    onMouseEnter={e => {
                      if (!isActive && !disabled)
                        (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
                    }}
                    onMouseLeave={e => {
                      if (!isActive && !disabled)
                        (e.currentTarget as HTMLButtonElement).style.background = "";
                    }}
                  >
                    <Icon
                      className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
                      style={{ color: isActive ? "#a78bfa" : "rgba(255,255,255,0.35)" } as React.CSSProperties}
                    />
                    <span
                      className="text-[12px] font-medium flex-1"
                      style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.55)" }}
                    >
                      {tab.label}
                    </span>
                    {isActive && (
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: "#a78bfa" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div
        className="px-3 pb-4 pt-3 space-y-3"
        style={{ borderTop: "1px solid rgba(167,139,250,0.12)" }}
      >
        {/* Language toggle */}
        {onLocaleChange && (
          <div className="flex items-center gap-1 justify-center">
            <Globe className="w-3 h-3" style={{ color: "rgba(255,255,255,0.25)" }} />
            {(["en", "fr"] as const).map(lang => (
              <button
                key={lang}
                onClick={() => onLocaleChange(lang)}
                className="text-[10px] font-bold px-2 py-0.5 rounded transition-colors uppercase"
                style={
                  locale === lang
                    ? { background: "rgba(124,58,237,0.25)", color: "#a78bfa" }
                    : { color: "rgba(255,255,255,0.3)" }
                }
              >
                {lang}
              </button>
            ))}
          </div>
        )}

        {/* Advisor name */}
        {advisorName && (
          <div className="text-center">
            <span
              className="inline-block text-[10px] px-2 py-0.5 rounded-full truncate max-w-full"
              style={{ background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.35)" }}
            >
              {advisorName}
            </span>
          </div>
        )}

        {/* Status + logout */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>Online</span>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Sign out"
              className="p-1 rounded transition-colors"
              style={{ color: "rgba(255,255,255,0.25)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.25)")}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
