import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { SimulationResult } from "@/hooks/use-plans";
import { useLanguage } from "@/contexts/LanguageContext";

interface PercentileChartProps {
  result: SimulationResult;
  title?: string;
  xLabel?: string;
}

function fmtCurrency(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function PercentileChart({
  result,
  title,
  xLabel,
}: PercentileChartProps) {
  const { isFrench: isFr } = useLanguage();
  const chartData = useMemo(() => {
    if (!result.percentileBands) return [];
    const bands = result.percentileBands;
    const len = bands.p50?.length || 0;
    return Array.from({ length: len }, (_, i) => ({
      year: i,
      p10: bands.p10?.[i] ?? 0,
      p25: bands.p25?.[i] ?? 0,
      p50: bands.p50?.[i] ?? 0,
      p75: bands.p75?.[i] ?? 0,
      p90: bands.p90?.[i] ?? 0,
    }));
  }, [result.percentileBands]);

  if (chartData.length === 0) {
    return (
      <div
        className="border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground"
        data-testid="empty-percentile-chart"
      >
        {isFr ? "Aucune donnée de bande de percentile disponible" : "No percentile band data available"}
      </div>
    );
  }

  return (
    <div
      className="border border-border rounded-2xl p-5"
      data-testid={`percentile-chart-${result.module}-${result.scenario}`}
    >
      {title && (
        <h4 className="text-sm font-bold font-display mb-3">{title}</h4>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart
          data={chartData}
          margin={{ top: 5, right: 20, bottom: 5, left: 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis
            dataKey="year"
            label={{
              value: xLabel || (isFr ? "Année" : "Year"),
              position: "insideBottom",
              offset: -2,
            }}
            tick={{ fontSize: 11 }}
          />
          <YAxis
            tickFormatter={fmtCurrency}
            tick={{ fontSize: 11 }}
            width={65}
          />
          <Tooltip
            formatter={(value: number) => fmtCurrency(value)}
            labelFormatter={(label: number) => `Year ${label}`}
          />
          <Legend verticalAlign="top" height={30} />
          <Area
            type="monotone"
            dataKey="p90"
            name={isFr ? "90e percentile" : "90th Percentile"}
            stackId="band"
            fill="#dcfce7"
            stroke="#22c55e"
            fillOpacity={0.3}
          />
          <Area
            type="monotone"
            dataKey="p75"
            name={isFr ? "75e percentile" : "75th Percentile"}
            stackId="band2"
            fill="#bbf7d0"
            stroke="#4ade80"
            fillOpacity={0.25}
          />
          <Area
            type="monotone"
            dataKey="p50"
            name={isFr ? "Médiane" : "Median"}
            stroke="#3b82f6"
            fill="#dbeafe"
            fillOpacity={0.4}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="p25"
            name={isFr ? "25e percentile" : "25th Percentile"}
            stackId="band3"
            fill="#fef08a"
            stroke="#eab308"
            fillOpacity={0.2}
          />
          <Area
            type="monotone"
            dataKey="p10"
            name={isFr ? "10e percentile" : "10th Percentile"}
            stackId="band4"
            fill="#fecaca"
            stroke="#ef4444"
            fillOpacity={0.2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-4 mt-2 text-xs text-muted-foreground">
        <span>{result.simulationCount.toLocaleString()} simulations</span>
        <span>{isFr ? `${result.yearsProjected} années projetées` : `${result.yearsProjected} years projected`}</span>
        {result.calculatedAt && (
          <span>
            {isFr ? `Calculé le ${new Date(result.calculatedAt).toLocaleDateString()}` : `Calculated ${new Date(result.calculatedAt).toLocaleDateString()}`}
          </span>
        )}
      </div>
    </div>
  );
}

export function PercentileChartGrid({
  results,
}: {
  results: SimulationResult[];
}) {
  const { isFrench: isFr } = useLanguage();

  const moduleLabels: Record<string, string> = {
    retirement: isFr ? "Projection de retraite" : "Retirement Projection",
    insurance: isFr ? "Couverture d'assurance" : "Insurance Coverage",
    education: isFr ? "Épargne REEE" : "RESP Savings",
    debt: isFr ? "Remboursement de dettes" : "Debt Payoff",
  };

  const xLabels: Record<string, string> = {
    retirement: isFr ? "Année" : "Year",
    education: "Child Age",
    debt: isFr ? "Année" : "Year",
    insurance: isFr ? "Année" : "Year",
  };

  if (results.length === 0) return null;

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      data-testid="percentile-chart-grid"
    >
      {results.map((r) => (
        <PercentileChart
          key={`${r.module}-${r.scenario}`}
          result={r}
          title={`${moduleLabels[r.module] || r.module} - ${r.scenario}`}
          xLabel={xLabels[r.module]}
        />
      ))}
    </div>
  );
}
