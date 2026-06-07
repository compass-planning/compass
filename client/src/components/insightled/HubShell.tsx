import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SubTab {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: string;
  badgeTone?: "cyan" | "amber" | "green" | "purple" | "rose";
}

interface PersonToggleConfig {
  person: "primary" | "spouse" | "combined";
  onPersonChange: (p: "primary" | "spouse" | "combined") => void;
  primaryLabel: string;
  spouseLabel?: string | null;
  showCombined?: boolean;
}

export interface HubShellProps {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Optional sub-tab strip below the header. Omit for a single-screen page. */
  subtabs?: SubTab[];
  activeSubtab?: string;
  onSubtabChange?: (key: string) => void;
  /** Optional Primary | Spouse | Combined toggle in the header. */
  personToggle?: PersonToggleConfig;
  contentClassName?: string;
  children: ReactNode;
}

const BADGE_TONE: Record<NonNullable<SubTab["badgeTone"]>, string> = {
  cyan:   "bg-cyan-50 text-cyan-700",
  amber:  "bg-amber-50 text-amber-700",
  green:  "bg-emerald-50 text-emerald-700",
  purple: "bg-violet-50 text-violet-700",
  rose:   "bg-rose-50 text-rose-700",
};

export function HubShell({
  icon: Icon,
  title,
  subtitle,
  actions,
  subtabs,
  activeSubtab,
  onSubtabChange,
  personToggle,
  contentClassName,
  children,
}: HubShellProps) {
  return (
    <div className="fp-insightled flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 px-8 py-5 flex items-center justify-between border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 p-[2px] flex-shrink-0 shadow-sm">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center">
              <Icon className="w-6 h-6 text-cyan-600" />
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 truncate">{title}</h1>
            {subtitle && (
              <div className="flex items-center gap-3 text-sm text-slate-500 mt-1 flex-wrap">
                {subtitle}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {personToggle && personToggle.spouseLabel && (
            <PersonChips {...personToggle} />
          )}
          {actions}
        </div>
      </header>

      {/* Sub-tabs strip */}
      {subtabs && subtabs.length > 0 && activeSubtab && onSubtabChange && (
        <div className="flex-shrink-0 px-8 pt-3 border-b border-slate-200/80 bg-white">
          <div className="flex items-center gap-1">
            {subtabs.map(t => {
              const isActive = t.key === activeSubtab;
              const Icon2 = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => onSubtabChange(t.key)}
                  className={cn(
                    "px-4 py-3 text-sm transition-colors flex items-center gap-2",
                    isActive
                      ? "fp-insightled-subtab-active font-semibold"
                      : "fp-insightled-subtab-inactive font-medium"
                  )}
                >
                  {Icon2 && <Icon2 className={cn("w-4 h-4", isActive && "text-cyan-600")} />}
                  {t.label}
                  {t.badge && (
                    <span className={cn(
                      "ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono",
                      BADGE_TONE[t.badgeTone ?? "cyan"]
                    )}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Content area — wraps children in .fp-insightled scope so legacy tabs get themed */}
      <div className={`flex-1 min-h-0 fp-insightled-scrollbar bg-slate-100 ${contentClassName ?? "overflow-y-auto"}`}>
        {children}
      </div>
    </div>
  );
}

function PersonChips({ person, onPersonChange, primaryLabel, spouseLabel, showCombined = true }: PersonToggleConfig) {
  const base = "px-4 py-1.5 rounded-lg text-sm font-semibold transition-all";
  const activeCls = "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-sm";
  const inactiveCls = "text-slate-500 hover:text-slate-800";
  return (
    <div className="flex gap-1 bg-white/70 backdrop-blur rounded-xl p-1 border border-slate-200/80 shadow-sm">
      <button
        onClick={() => onPersonChange("primary")}
        className={cn(base, person === "primary" ? activeCls : inactiveCls)}
      >
        {primaryLabel}
      </button>
      {spouseLabel && (
        <button
          onClick={() => onPersonChange("spouse")}
          className={cn(base, person === "spouse" ? activeCls : inactiveCls)}
        >
          {spouseLabel}
        </button>
      )}
      {showCombined && (
        <button
          onClick={() => onPersonChange("combined")}
          className={cn(base, person === "combined" ? activeCls : inactiveCls)}
        >
          Combined
        </button>
      )}
    </div>
  );
}
