/**
 * ScenarioBar.tsx — light theme
 */
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  activeScenario: string;
  onScenarioChange: (s: string) => void;
}

export function ScenarioBar({ activeScenario, onScenarioChange }: Props) {
  const { isFrench: isFr } = useLanguage();

  const SCENARIOS = [
    { key: "current",   label: isFr ? "Actuel" : "Current" },
    { key: "optimized", label: isFr ? "Optimisé" : "Optimized" },
    { key: "downside",  label: isFr ? "Défavorable" : "Downside" },
    { key: "tax",       label: isFr ? "Efficace fiscalement" : "Tax Efficient" },
    { key: "insurance", label: isFr ? "Assurance maximale" : "Insurance Max" },
  ];

  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white shadow-sm px-4 py-2.5">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-violet-500 flex-shrink-0" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold leading-none">{isFr ? "Moteur de scénarios" : "Scenario Engine"}</p>
          <p className="text-xs font-semibold text-slate-700 mt-0.5">
            {SCENARIOS.find(s => s.key === activeScenario)?.label ?? (isFr ? "Actuel" : "Current")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {SCENARIOS.map(s => (
          <button
            key={s.key}
            onClick={() => onScenarioChange(s.key)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              s.key === activeScenario
                ? "bg-gradient-to-r from-violet-600 to-violet-400 text-white shadow-sm"
                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
            )}
          >
            {s.label}
          </button>
        ))}
        <button className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-colors">
          {isFr ? "+ Nouveau" : "+ New"}
        </button>
      </div>
    </div>
  );
}
