import { useState, useEffect } from "react";
import { usePlanAssumptions, useUpsertAssumption, useSeedDefaults, useRunSimulation } from "@/hooks/use-plans";
import type { PlanAssumption } from "@/hooks/use-plans";
import { Settings, Play, Loader2, RefreshCw } from "lucide-react";

const fields: Array<{ key: keyof PlanAssumption; label: string; step: string; pct?: boolean; isInt?: boolean; group?: string }> = [
  { key: "equityReturn", label: "Equity Return", step: "0.001", pct: true, group: "returns" },
  { key: "equityVolatility", label: "Equity Volatility", step: "0.001", pct: true, group: "returns" },
  { key: "bondReturn", label: "Bond Return", step: "0.001", pct: true, group: "returns" },
  { key: "bondVolatility", label: "Bond Volatility", step: "0.001", pct: true, group: "returns" },
  { key: "inflationMean", label: "Inflation Rate", step: "0.001", pct: true, group: "returns" },
  { key: "inflationVolatility", label: "Inflation Volatility", step: "0.001", pct: true, group: "returns" },
  { key: "corrEquityBond", label: "Equity-Bond Correlation", step: "0.01", pct: false, group: "correlations" },
  { key: "corrEquityInflation", label: "Equity-Inflation Corr.", step: "0.01", pct: false, group: "correlations" },
  { key: "corrBondInflation", label: "Bond-Inflation Corr.", step: "0.01", pct: false, group: "correlations" },
  { key: "planToAge", label: "Plan To Age", step: "1", isInt: true, group: "planning" },
  { key: "cppStartAge", label: "CPP Start Age", step: "1", isInt: true, group: "planning" },
  { key: "oasStartAge", label: "OAS Start Age", step: "1", isInt: true, group: "planning" },
  { key: "simulationCount", label: "Simulation Count", step: "500", isInt: true, group: "planning" },
];

const provinces = ["ontario", "quebec", "british_columbia", "alberta", "manitoba", "saskatchewan", "nova_scotia", "new_brunswick", "newfoundland", "pei"];

export function AssumptionEditor({ planId }: { planId: number }) {
  const { data: assumptions = [], isLoading } = usePlanAssumptions(planId);
  const upsertAssumption = useUpsertAssumption();
  const seedDefaults = useSeedDefaults();
  const runSimulation = useRunSimulation();
  const [activeScenario, setActiveScenario] = useState<string>("Moderate");
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  const current = assumptions.find(a => a.scenario === activeScenario);

  useEffect(() => {
    if (current) {
      const vals: Record<string, string> = {};
      for (const f of fields) {
        const raw = current[f.key];
        if (f.pct) vals[f.key] = (Number(raw) * 100).toFixed(1);
        else vals[f.key] = String(raw);
      }
      vals.province = current.province;
       
      setEditing(vals);
       
      setDirty(false);
    }
  }, [current?.id, activeScenario]);

  const handleSave = () => {
    const data: Record<string, string | number> = { scenario: activeScenario };
    for (const f of fields) {
      if (f.pct) data[f.key] = String(Number(editing[f.key]) / 100);
      else if (f.isInt) data[f.key] = parseInt(editing[f.key]) || 0;
      else data[f.key] = editing[f.key];
    }
    data.province = editing.province || "ontario";
    upsertAssumption.mutate({ planId, data }, { onSuccess: () => setDirty(false) });
  };

  const handleRunSim = () => {
    runSimulation.mutate({ planId, scenario: activeScenario });
  };

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Loading assumptions...</div>;

  if (assumptions.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-8 text-center" data-testid="empty-assumptions">
        <Settings className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="font-medium text-muted-foreground">No assumptions configured</p>
        <p className="text-sm text-muted-foreground mt-1 mb-4">Seed default scenarios to get started</p>
        <button
          onClick={() => seedDefaults.mutate(planId)}
          disabled={seedDefaults.isPending}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl font-semibold disabled:opacity-50"
          data-testid="button-seed-defaults"
        >
          {seedDefaults.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Seed Default Scenarios"}
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="assumption-editor">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold font-display">Scenario Assumptions</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRunSim}
            disabled={runSimulation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-50"
            data-testid="button-run-simulation"
          >
            {runSimulation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Simulation
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {assumptions.map(a => (
          <button
            key={a.scenario}
            onClick={() => setActiveScenario(a.scenario)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeScenario === a.scenario
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
            data-testid={`button-scenario-${a.scenario.toLowerCase()}`}
          >
            {({ Conservative: "Stress", Moderate: "Base", Aggressive: "Optimistic" }[a.scenario] || a.scenario)}
          </button>
        ))}
      </div>

      {current && (
        <div className="space-y-4">
          {["returns", "correlations", "planning"].map(group => {
            const groupFields = fields.filter(f => f.group === group);
            const groupLabel = group === "returns" ? "Returns & Volatility" : group === "correlations" ? "Correlations" : "Planning Parameters";
            return (
              <div key={group}>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{groupLabel}</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {groupFields.map(f => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-muted-foreground">
                        {f.label}{f.pct ? " (%)" : ""}
                      </label>
                      <input
                        type="number"
                        step={f.step}
                        value={editing[f.key] || ""}
                        onChange={e => { setEditing({ ...editing, [f.key]: e.target.value }); setDirty(true); }}
                        className="w-full px-3 py-2 rounded-xl border mt-1 text-sm"
                        data-testid={`input-assumption-${f.key}`}
                      />
                    </div>
                  ))}
                  {group === "planning" && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground">Province</label>
                      <select
                        value={editing.province || "ontario"}
                        onChange={e => { setEditing({ ...editing, province: e.target.value }); setDirty(true); }}
                        className="w-full px-3 py-2 rounded-xl border mt-1 text-sm"
                        data-testid="select-assumption-province"
                      >
                        {provinces.map(p => <option key={p} value={p}>{p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {dirty && (
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => { if (current) { const vals: Record<string, string> = {}; for (const f of fields) { const raw = current[f.key]; if (f.pct) vals[f.key] = (Number(raw) * 100).toFixed(1); else vals[f.key] = String(raw); } vals.province = current.province; setEditing(vals); setDirty(false); } }}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted"
                data-testid="button-reset-assumptions"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />Reset
              </button>
              <button
                onClick={handleSave}
                disabled={upsertAssumption.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground disabled:opacity-50"
                data-testid="button-save-assumptions"
              >
                {upsertAssumption.isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
