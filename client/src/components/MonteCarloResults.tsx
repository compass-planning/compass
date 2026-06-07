import { useState } from "react";
import { fmt$, fmtPct } from "../lib/utils";

interface SimResult {
  successRate: number;
  successCount: number;
  simulations: number;
  yearsProjected: number;
  retirementAge: number;
  lifeExpectancy: number;
  percentileBands: {
    p10: number[]; p25: number[]; p50: number[];
    p75: number[]; p90: number[]; labels: number[];
  };
  finalBalancePercentiles: { p10: number; p25: number; p50: number; p75: number; p90: number };
  guardrails: { floor: number; ceiling: number; spendingFlexDown: number; spendingFlexUp: number; triggerRate: number };
  inputs: {
    currentAge: number; retirementAge: number; lifeExpectancy: number;
    startingPortfolio: number; annualContrib: number; desiredIncome: number;
    equityAllocation: number; equityReturn: number; bondReturn: number; inflationRate: number;
    cppMonthly: number; oasMonthly: number; cppAge: number; oasAge: number;
  };
}

function SuccessGauge({ rate }: { rate: number }) {
  const pct = rate * 100;
  const color = pct >= 85 ? "#10b981" : pct >= 70 ? "#f59e0b" : "#ef4444";
  const label = pct >= 85 ? "On Track" : pct >= 70 ? "Moderate Risk" : "Action Required";
  const circumference = 2 * Math.PI * 54;
  const offset = circumference * (1 - rate);

  return (
    <div className="flex flex-col items-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r="54" fill="none" stroke="#e5e7eb" strokeWidth="12" />
        <circle cx="70" cy="70" r="54" fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 70 70)" />
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="bold" fill={color}>
          {pct.toFixed(0)}%
        </text>
        <text x="70" y="85" textAnchor="middle" fontSize="10" fill="#6b7280">Success Rate</text>
      </svg>
      <span className="text-sm font-bold mt-1" style={{ color }}>{label}</span>
      <span className="text-xs text-gray-400">{`${(rate * 100).toFixed(0)}% of ${(1000).toLocaleString()} simulations`}</span>
    </div>
  );
}

function PercentileChart({ bands }: { bands: SimResult["percentileBands"] }) {
  const W = 680, H = 260, PAD = { top: 20, right: 20, bottom: 40, left: 70 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allVals = [...bands.p10, ...bands.p90].filter(v => v > 0);
  const maxVal  = Math.max(...allVals, 1);
  const n = bands.labels.length;

  const xScale = (i: number) => PAD.left + (i / (n - 1)) * chartW;
  const yScale = (v: number) => PAD.top + chartH - (v / maxVal) * chartH;

  const pathD = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");

  const areaD = (lo: number[], hi: number[]) => {
    const top  = hi.map((v, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");
    const bot  = lo.slice().reverse().map((v, i) => `L ${xScale(n-1-i).toFixed(1)} ${yScale(v).toFixed(1)}`).join(" ");
    return `${top} ${bot} Z`;
  };

  // Retirement age marker
  const retIdx = bands.labels.findIndex(a => a >= 65) ?? Math.floor(n * 0.4);

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ v: t * maxVal, y: yScale(t * maxVal) }));

  const fmtM = (v: number) => v >= 1000000 ? `$${(v/1000000).toFixed(1)}M` : v >= 1000 ? `$${(v/1000).toFixed(0)}K` : `$${v.toFixed(0)}`;

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      {/* Grid lines */}
      {ticks.map(t => (
        <g key={t.v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={t.y} y2={t.y} stroke="#f3f4f6" strokeWidth="1" />
          <text x={PAD.left - 8} y={t.y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">{fmtM(t.v)}</text>
        </g>
      ))}

      {/* Retirement marker */}
      {retIdx > 0 && (
        <g>
          <line x1={xScale(retIdx)} x2={xScale(retIdx)} y1={PAD.top} y2={H - PAD.bottom} stroke="#6366f1" strokeWidth="1" strokeDasharray="4,3" />
          <text x={xScale(retIdx) + 4} y={PAD.top + 12} fontSize="9" fill="#6366f1">Retirement</text>
        </g>
      )}

      {/* Shaded bands */}
      <path d={areaD(bands.p10, bands.p90)} fill="#3b82f6" opacity="0.08" />
      <path d={areaD(bands.p25, bands.p75)} fill="#3b82f6" opacity="0.12" />

      {/* Percentile lines */}
      <path d={pathD(bands.p10)} fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4,3" />
      <path d={pathD(bands.p25)} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      <path d={pathD(bands.p50)} fill="none" stroke="#2563eb" strokeWidth="2.5" />
      <path d={pathD(bands.p75)} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      <path d={pathD(bands.p90)} fill="none" stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="4,3" />

      {/* X-axis labels */}
      {bands.labels.filter((_, i) => i % Math.ceil(n / 10) === 0).map((age, _, arr) => {
        const i = bands.labels.indexOf(age);
        return (
          <text key={age} x={xScale(i)} y={H - PAD.bottom + 16} textAnchor="middle" fontSize="10" fill="#9ca3af">
            Age {age}
          </text>
        );
      })}

      {/* Legend */}
      {[
        { color: "#93c5fd", label: "10th / 90th percentile", dash: true },
        { color: "#60a5fa", label: "25th / 75th percentile", dash: false },
        { color: "#2563eb", label: "Median (50th)",          dash: false },
      ].map((l, i) => (
        <g key={l.label} transform={`translate(${PAD.left + i * 200}, ${H - 10})`}>
          <line x1="0" x2="16" y1="0" y2="0" stroke={l.color} strokeWidth="2" strokeDasharray={l.dash ? "4,3" : undefined} />
          <text x="20" y="4" fontSize="9" fill="#6b7280">{l.label}</text>
        </g>
      ))}
    </svg>
  );
}

interface Props {
  result: SimResult;
  onClose: () => void;
  onPrint: () => void;
}

export function MonteCarloResults({ result, onClose, onPrint }: Props) {
  const { successRate, finalBalancePercentiles: fp, guardrails, inputs, percentileBands } = result;
  const successPct = successRate * 100;

  const scenarios = [
    { label: "Best Case (90th percentile)",     value: fp.p90, color: "text-emerald-600" },
    { label: "Optimistic (75th percentile)",    value: fp.p75, color: "text-blue-600" },
    { label: "Median (50th percentile)",        value: fp.p50, color: "text-indigo-600" },
    { label: "Pessimistic (25th percentile)",   value: fp.p25, color: "text-amber-600" },
    { label: "Worst Case (10th percentile)",    value: fp.p10, color: "text-red-500" },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-[#0c1e3a] rounded-t-2xl">
            <div>
              <h2 className="text-white font-bold text-lg">Monte Carlo Retirement Analysis</h2>
              <p className="text-white/50 text-xs">{result.simulations.toLocaleString()} simulations · {result.yearsProjected} years projected</p>
            </div>
            <div className="flex gap-2">
              <button onClick={onPrint} className="text-xs text-white/70 hover:text-white border border-white/20 px-3 py-1.5 rounded-lg">
                Print Report
              </button>
              <button onClick={onClose} className="text-white/60 hover:text-white text-xl leading-none px-2">×</button>
            </div>
          </div>

          <div className="p-6">
            {/* Top row: gauge + final balances */}
            <div className="grid grid-cols-3 gap-5 mb-6">
              <div className="flex flex-col items-center justify-center bg-gray-50 rounded-xl p-4">
                <SuccessGauge rate={successRate} />
              </div>
              <div className="col-span-2 bg-gray-50 rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-3 text-sm">Final Portfolio Balance at Age {result.lifeExpectancy}</h3>
                <div className="space-y-2">
                  {scenarios.map(s => (
                    <div key={s.label} className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">{s.label}</span>
                      <span className={`text-sm font-bold ${s.color}`}>{fmt$(s.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <h3 className="font-bold text-gray-800 mb-3 text-sm">Portfolio Projection — {result.simulations.toLocaleString()} Simulations</h3>
              <PercentileChart bands={percentileBands} />
            </div>

            {/* Guardrails */}
            <div className="grid grid-cols-2 gap-5 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <h3 className="font-bold text-amber-800 text-sm mb-3">⚠ Guardrail Rules</h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-amber-700">Spending cut triggers when portfolio drops below</span><span className="font-bold text-amber-900">{(guardrails.floor * 100).toFixed(0)}% of target</span></div>
                  <div className="flex justify-between"><span className="text-amber-700">Spending increase triggers when portfolio exceeds</span><span className="font-bold text-amber-900">{(guardrails.ceiling * 100).toFixed(0)}% of target</span></div>
                  <div className="flex justify-between"><span className="text-amber-700">Maximum spending reduction</span><span className="font-bold text-amber-900">{(guardrails.spendingFlexDown * 100).toFixed(0)}%</span></div>
                  <div className="flex justify-between"><span className="text-amber-700">Maximum spending increase</span><span className="font-bold text-amber-900">{(guardrails.spendingFlexUp * 100).toFixed(0)}%</span></div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-bold text-blue-800 text-sm mb-3">Simulation Inputs</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-blue-700">Starting Portfolio</span><span className="font-bold text-blue-900">{fmt$(inputs.startingPortfolio)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Annual Contribution</span><span className="font-bold text-blue-900">{fmt$(inputs.annualContrib)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Desired Retirement Income</span><span className="font-bold text-blue-900">{fmt$(inputs.desiredIncome)}</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Equity / Bond Split</span><span className="font-bold text-blue-900">{inputs.equityAllocation}% / {100 - inputs.equityAllocation}%</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Expected Return</span><span className="font-bold text-blue-900">{inputs.equityReturn}% eq / {inputs.bondReturn}% bd</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">Inflation Rate</span><span className="font-bold text-blue-900">{inputs.inflationRate}%</span></div>
                  <div className="flex justify-between"><span className="text-blue-700">CPP / OAS</span><span className="font-bold text-blue-900">{fmt$(inputs.cppMonthly)}/mo · {fmt$(inputs.oasMonthly)}/mo</span></div>
                </div>
              </div>
            </div>

            {/* Recommendation */}
            <div className={`rounded-xl p-4 border ${successPct >= 85 ? "bg-emerald-50 border-emerald-200" : successPct >= 70 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200"}`}>
              <p className={`font-bold text-sm mb-1 ${successPct >= 85 ? "text-emerald-800" : successPct >= 70 ? "text-amber-800" : "text-red-800"}`}>
                {successPct >= 85 ? "✓ Plan is On Track" : successPct >= 70 ? "⚠ Plan Needs Attention" : "✗ Significant Risk — Action Required"}
              </p>
              <p className={`text-xs ${successPct >= 85 ? "text-emerald-700" : successPct >= 70 ? "text-amber-700" : "text-red-700"}`}>
                {successPct >= 85
                  ? `With ${successPct.toFixed(0)}% probability of success, the plan is well-positioned. Continue monitoring annually and adjust for major life changes.`
                  : successPct >= 70
                  ? `The plan has a ${successPct.toFixed(0)}% success rate. Consider increasing contributions, delaying retirement by 1-2 years, or reducing desired retirement income.`
                  : `Only ${successPct.toFixed(0)}% of simulations resulted in a successful outcome. Significant changes are needed — increase savings, reduce spending targets, or consider working longer.`
                }
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
