import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { SimulationResult } from "@/hooks/use-plans";

const paramLabels: Record<string, string> = {
  equityReturn: "Equity Return",
  equityVolatility: "Equity Volatility",
  bondReturn: "Bond Return",
  bondVolatility: "Bond Volatility",
  inflationMean: "Inflation Rate",
  inflationVolatility: "Inflation Vol",
  corrEquityBond: "Equity-Bond Corr",
  planToAge: "Plan-To Age",
  cppStartAge: "CPP Start Age",
  oasStartAge: "OAS Start Age",
};

export function SensitivityDisplay({ results }: { results: SimulationResult[] }) {
  const sensitivityData = useMemo(() => {
    const combined: Record<string, number[]> = {};
    for (const r of results) {
      if (!r.sensitivityData) continue;
      for (const [key, value] of Object.entries(r.sensitivityData)) {
        if (!combined[key]) combined[key] = [];
        combined[key].push(value as number);
      }
    }
    return Object.entries(combined)
      .map(([key, values]) => ({
        param: paramLabels[key] || key,
        impact: values.reduce((a, b) => a + Math.abs(b), 0) / values.length,
        rawKey: key,
      }))
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 10);
  }, [results]);

  if (sensitivityData.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-8 text-center text-muted-foreground" data-testid="empty-sensitivity">
        <p className="font-medium">No sensitivity data available</p>
        <p className="text-sm mt-1">Run simulations to see which assumptions impact results the most</p>
      </div>
    );
  }

  const maxImpact = Math.max(...sensitivityData.map(d => d.impact));

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="sensitivity-display">
      <h3 className="text-lg font-bold font-display mb-4">Sensitivity Analysis</h3>
      <p className="text-sm text-muted-foreground mb-4">Which assumptions have the biggest impact on outcomes</p>
      <ResponsiveContainer width="100%" height={Math.max(200, sensitivityData.length * 40)}>
        <BarChart data={sensitivityData} layout="vertical" margin={{ left: 120, right: 20, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
          <YAxis type="category" dataKey="param" tick={{ fontSize: 12 }} width={110} />
          <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}% impact`} />
          <Bar dataKey="impact" radius={[0, 4, 4, 0]}>
            {sensitivityData.map((entry, index) => (
              <Cell
                key={entry.rawKey}
                fill={entry.impact > maxImpact * 0.7 ? "#ef4444" : entry.impact > maxImpact * 0.4 ? "#f59e0b" : "#3b82f6"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex gap-4 text-xs text-muted-foreground justify-center">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500" /> High Impact</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-500" /> Medium</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500" /> Lower</span>
      </div>
    </div>
  );
}
