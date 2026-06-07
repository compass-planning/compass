import { useScenarioComparison, useSimulationResults } from "@/hooks/use-plans";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function SuccessGauge({ rate, label }: { rate: number; label: string }) {
  const pct = Math.round(rate * 100);
  const color = pct >= 80 ? "text-green-600" : pct >= 60 ? "text-yellow-600" : "text-red-600";
  const bg = pct >= 80 ? "bg-green-100" : pct >= 60 ? "bg-yellow-100" : "bg-red-100";
  const ring = pct >= 80 ? "stroke-green-500" : pct >= 60 ? "stroke-yellow-500" : "stroke-red-500";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center" data-testid={`gauge-success-${label.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className="stroke-muted/30" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="8" className={ring}
            strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xl font-bold ${color}`}>{pct}%</span>
        </div>
      </div>
      <span className={`text-xs font-semibold mt-2 px-2 py-0.5 rounded-full ${bg} ${color}`}>{label}</span>
    </div>
  );
}

function fmt(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toLocaleString()}`;
}

const moduleLabels: Record<string, string> = {
  retirement: "Retirement",
  insurance: "Insurance",
  education: "Education (RESP)",
  debt: "Debt Payoff",
};

const scenarioLabels: Record<string, string> = {
  Conservative: "Stress",
  Moderate: "Base",
  Aggressive: "Optimistic",
};

export function ScenarioComparison({ planId }: { planId: number }) {
  const { data: comparison, isLoading } = useScenarioComparison(planId);
  const { data: simResults = [] } = useSimulationResults(planId);

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading scenario comparison...</div>;
  if (!comparison || Object.keys(comparison).length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground" data-testid="empty-scenario-comparison">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No simulation results yet</p>
        <p className="text-sm mt-1">Set up assumptions and run a simulation to see scenario comparisons</p>
      </div>
    );
  }

  const scenarios = ["Conservative", "Moderate", "Aggressive"];

  return (
    <div className="space-y-6" data-testid="scenario-comparison-panel">
      {Object.entries(comparison).map(([mod, entry]) => {
        const scenarioData = entry.scenarios;
        const availableScenarios = scenarios.filter(s => scenarioData[s]);
        if (availableScenarios.length === 0) return null;

        const modResults = simResults.filter(r => r.module === mod);

        return (
          <div key={mod} className="border border-border rounded-2xl p-6" data-testid={`scenario-module-${mod}`}>
            <h3 className="text-lg font-bold font-display mb-4">{moduleLabels[mod] || mod}</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {availableScenarios.map(scenario => {
                const d = scenarioData[scenario];
                if (!d) return null;
                const modResult = modResults.find(r => r.scenario === scenario);
                return (
                  <div key={scenario} className="border border-border/50 rounded-xl p-4 space-y-3" data-testid={`scenario-card-${mod}-${scenario.toLowerCase()}`}>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{scenarioLabels[scenario] || scenario}</p>
                    </div>
                    <SuccessGauge rate={d.successRate} label={scenario} />
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">P10 (Worst)</span><span className="font-semibold text-red-600">{fmt(d.p10)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P25</span><span className="font-semibold">{fmt(d.p25)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P50 (Median)</span><span className="font-bold text-primary">{fmt(d.p50)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P75</span><span className="font-semibold">{fmt(d.p75)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">P90 (Best)</span><span className="font-semibold text-green-600">{fmt(d.p90)}</span></div>
                    </div>
                    {modResult && (
                      <div className="pt-2 border-t text-xs text-muted-foreground text-center">
                        {modResult.simulationCount.toLocaleString()} sims | {modResult.yearsProjected}yr
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ScenarioSummaryCards({ planId }: { planId: number }) {
  const { data: simResults = [] } = useSimulationResults(planId);

  const byModule = simResults.reduce<Record<string, typeof simResults>>((acc, r) => {
    if (!acc[r.module]) acc[r.module] = [];
    acc[r.module].push(r);
    return acc;
  }, {});

  if (Object.keys(byModule).length === 0) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="scenario-summary-cards">
      {Object.entries(byModule).map(([mod, results]) => {
        const base = results.find(r => r.scenario === "Moderate") || results[0];
        const rate = Math.round(Number(base.successRate) * 100);
        const color = rate >= 80 ? "text-green-600 bg-green-50 border-green-200" : rate >= 60 ? "text-yellow-600 bg-yellow-50 border-yellow-200" : "text-red-600 bg-red-50 border-red-200";
        return (
          <div key={mod} className={`border rounded-2xl p-4 ${color}`} data-testid={`summary-card-${mod}`}>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{moduleLabels[mod] || mod}</p>
            <p className="text-3xl font-bold mt-1">{rate}%</p>
            <p className="text-xs mt-1">Probability of Success</p>
            <div className="flex items-center text-xs mt-2 space-x-1">
              {results.length > 1 ? (
                <>
                  {Number(results[0].successRate) > Number(results[results.length - 1].successRate)
                    ? <TrendingDown className="w-3 h-3" />
                    : <TrendingUp className="w-3 h-3" />}
                  <span>{results.length} scenarios</span>
                </>
              ) : (
                <><Minus className="w-3 h-3" /><span>1 scenario</span></>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
