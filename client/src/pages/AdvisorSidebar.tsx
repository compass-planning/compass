/**
 * AdvisorSidebar — Compass Planning advisor navigation.
 *
 * Top-level tabs (always visible):
 *   • Clients  — client list / dashboard
 *   • Setup    — account info, billing, subscription
 *
 * Per-client tabs (visible only when a client is selected):
 *   Overview, Dashboard, Profile
 *   Net Worth, Goals, Debt, Retirement, Insurance, Cash Flow, Tax & Estate
 *   AI Insights, Documents, Financial Plan
 */
import React from "react";
import {
  Users, LayoutDashboard, Scale, PiggyBank,
  Shield, Receipt, Brain, TrendingUp,
  FileText, Target, Sparkles, UserCog,
  CreditCard, Building2, Globe, LogOut,
  Settings,
} from "lucide-react";
import { CompassLogo } from "../components/CompassLogo";

export type AdvisorTab =
  // top-level
  | "clients"
  | "setup"
  // per-client
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

// ── Nav structure ─────────────────────────────────────────────────────────────
interface TabDef {
  key: AdvisorTab;
  labelEn: string;
  labelFr: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  requiresClient?: boolean;
}

interface Group {
  group: string;
  labelEn: string | null;
  labelFr: string | null;
  tabs: TabDef[];
  onlyWhenClient?: boolean; // whole group hidden until client selected
}

const GROUPS: Group[] = [
  {
    group: "top",
    labelEn: null,
    labelFr: null,
    tabs: [
      { key: "clients", labelEn: "Clients",       labelFr: "Clients",         icon: Users },
      { key: "setup",   labelEn: "Setup",          labelFr: "Configuration",   icon: Settings },
    ],
  },
  {
    group: "client",
    labelEn: "Client Overview",
    labelFr: "Aperçu client",
    onlyWhenClient: true,
    tabs: [
      { key: "overview",  labelEn: "Overview",        labelFr: "Aperçu",          icon: LayoutDashboard, requiresClient: true },
      { key: "dashboard", labelEn: "Dashboard",       labelFr: "Tableau",         icon: TrendingUp,      requiresClient: true },
      { key: "profile",   labelEn: "Client Profile",  labelFr: "Profil client",   icon: UserCog,         requiresClient: true },
    ],
  },
  {
    group: "planning",
    labelEn: "Financial Planning",
    labelFr: "Planification",
    onlyWhenClient: true,
    tabs: [
      { key: "networth",      labelEn: "Net Worth",    labelFr: "Valeur nette",    icon: Scale,       requiresClient: true },
      { key: "goals",         labelEn: "Goals",        labelFr: "Objectifs",       icon: Target,      requiresClient: true },
      { key: "debt",          labelEn: "Debt",         labelFr: "Dettes",          icon: CreditCard,  requiresClient: true },
      { key: "retirementhub", labelEn: "Retirement",   labelFr: "Retraite",        icon: PiggyBank,   requiresClient: true },
      { key: "protection",    labelEn: "Insurance",    labelFr: "Assurance",       icon: Shield,      requiresClient: true },
      { key: "expenses",      labelEn: "Cash Flow",    labelFr: "Flux de trésor.", icon: Receipt,     requiresClient: true },
      { key: "taxestate",     labelEn: "Tax & Estate", labelFr: "Impôt & Succès",  icon: Building2,   requiresClient: true },
    ],
  },
  {
    group: "outputs",
    labelEn: "Reports & AI",
    labelFr: "Rapports & IA",
    onlyWhenClient: true,
    tabs: [
      { key: "ai",        labelEn: "AI Insights",     labelFr: "Insights IA",     icon: Brain,    requiresClient: true },
      { key: "documents", labelEn: "Documents",       labelFr: "Documents",       icon: FileText, requiresClient: true },
      { key: "fp",        labelEn: "Financial Plan",  labelFr: "Plan financier",  icon: Sparkles, requiresClient: true },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function AdvisorSidebar({
  activeTab,
  onTab,
  clientName,
  advisorName,
  onLogout,
  locale = "en",
  onLocaleChange,
}: Props) {
  const hasClient = Boolean(clientName);
  const label = (tab: TabDef) => locale === "fr" ? tab.labelFr : tab.labelEn;
  const grpLabel = (g: Group) => locale === "fr" ? g.labelFr : g.labelEn;

  return (
    <aside
      className="w-56 flex-shrink-0 min-h-screen flex flex-col select-none"
      style={{ background: "#0f0a1e" }}
    >
      {/* ── Logo ───────────────────────────────────────────────────────── */}
      <div
        className="px-4 pt-5 pb-4"
        style={{ borderBottom: "1px solid rgba(167,139,250,0.15)" }}
      >
        <CompassLogo variant="sidebar" edition="Advisor Edition" light />
      </div>

      {/* ── Active client pill ──────────────────────────────────────────── */}
      <div className="px-3 pt-3">
        {hasClient ? (
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.25)",
            }}
          >
            <div
              className="text-[9px] uppercase tracking-widest mb-0.5"
              style={{ color: "rgba(167,139,250,0.6)" }}
            >
              Active Client
            </div>
            <div className="text-xs font-semibold truncate text-white">{clientName}</div>
          </div>
        ) : (
          <div
            className="px-3 py-2 rounded-lg"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
              No client selected
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden space-y-0.5">
        {GROUPS.map(group => {
          // Hide per-client groups when no client is selected
          if (group.onlyWhenClient && !hasClient) return null;

          return (
            <div key={group.group} className="mb-1">
              {grpLabel(group) && (
                <div className="px-3 pt-3 pb-1">
                  <span
                    className="text-[9px] font-bold uppercase tracking-widest"
                    style={{ color: "rgba(255,255,255,0.22)" }}
                  >
                    {grpLabel(group)}
                  </span>
                </div>
              )}
              {group.tabs.map(tab => {
                const isActive = activeTab === tab.key;
                const Icon = tab.icon;

                return (
                  <NavButton
                    key={tab.key}
                    isActive={isActive}
                    label={label(tab)}
                    Icon={Icon}
                    onClick={() => onTab(tab.key)}
                  />
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <div
        className="px-3 pb-4 pt-3 space-y-2.5"
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
          <div className="text-center px-1">
            <span
              className="block text-[10px] truncate"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              {advisorName}
            </span>
          </div>
        )}

        {/* Status + logout */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.22)" }}>
              Online
            </span>
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

// ── NavButton (internal) ──────────────────────────────────────────────────────
function NavButton({
  isActive,
  label,
  Icon,
  onClick,
}: {
  isActive: boolean;
  label: string;
  Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all duration-150 focus:outline-none"
      style={
        isActive
          ? {
              background: "rgba(124,58,237,0.2)",
              border: "1px solid rgba(124,58,237,0.3)",
            }
          : { border: "1px solid transparent" }
      }
      onMouseEnter={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
      }}
      onMouseLeave={e => {
        if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "";
      }}
    >
      <Icon
        className="w-3.5 h-3.5 flex-shrink-0 transition-colors"
        style={{ color: isActive ? "#a78bfa" : "rgba(255,255,255,0.35)" }}
      />
      <span
        className="text-[12px] font-medium flex-1"
        style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.55)" }}
      >
        {label}
      </span>
      {isActive && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: "#a78bfa" }}
        />
      )}
    </button>
  );
}
