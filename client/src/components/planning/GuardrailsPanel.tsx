import { useState, useMemo } from "react";
import { Shield, TrendingDown, TrendingUp, ToggleLeft, ToggleRight, Info } from "lucide-react";
// Types mirrored from server/engine/simulation/guardrails.ts
interface GuardrailParams {
  floorPct:   number;
  ceilingPct: number;
  flexDown:   number;
  flexUp:     number;
}
interface GuardrailTrigger {
  year:              number;
  age:               number;
  targetPathBalance: number;
  floorBalance:      number;
  ceilingBalance:    number;
  reducedSpending:   number;
  increasedSpending: number;
  baseSpending:      number;
}
interface GuardrailResult {
  baseSuccessRate:     number;
  adjustedSuccessRate: number;
  successRateGain:     number;
  params:              GuardrailParams;
  triggerTable:        GuardrailTrigger[];
  recommendation:      string;
}

// ── Types ────────────────────────────────────────────────────────────────────

interface SimBands {
  p10: number[]; p25: number[]; p50: number[];
  p75: number[]; p90: number[]; labels: number[];
}

interface Props {
  // From the simulation result
  percentileBands:    SimBands;
  successRate:        number;        // base success rate (0-1)
  baseWithdrawal:     number;        // annual withdrawal net of CPP/OAS/pension
  retirementAge:      number;
  currentAge:         number;
  paths?:             number[][];    // full paths if available
}

const fmt$ = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-CA", { maximumFractionDigits: 0 });
const fmtPct = (n: number) => (n * 100).toFixed(1) + "%";

// ── Slider Input ─────────────────────────────────────────────────────────────

function SliderInput({
  label, value, min, max, step, format, onChange, hint,
}: {
  label: string; value: number; min: number; max: number;
  step: number; format: (v: number) => string;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-gray-600">{label}</label>
        <span className="text-sm font-bold text-[#0c1e3a]">{format(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 appearance-none rounded-full bg-gray-200 accent-[#0c1e3a]" />
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Success Rate Comparison ───────────────────────────────────────────────────

function SuccessComparison({ base, adjusted }: { base: number; adjusted: number }) {
  const gain = adjusted - base;
  const color = adjusted >= 0.85 ? "text-green-600" : adjusted >= 0.70 ? "text-amber-600" : "text-red-600";
  const bg    = adjusted >= 0.85 ? "bg-green-50 border-green-200" : adjusted >= 0.70 ? "bg-amber-50 border-amber-200" : "bg-red-50 border-red-200";

  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center justify-between">
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">Base success rate</p>
          <p className="text-2xl font-bold text-gray-700">{fmtPct(base)}</p>
          <p className="text-[10px] text-gray-400">no guardrails</p>
        </div>
        <div className="flex flex-col items-center gap-1 px-4">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <span className={`text-sm font-bold ${gain > 0 ? "text-green-600" : "text-gray-400"}`}>
            {gain > 0 ? `+${(gain * 100).toFixed(1)}pp` : "±0"}
          </span>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-500 mb-1">With guardrails</p>
          <p className={`text-2xl font-bold ${color}`}>{fmtPct(adjusted)}</p>
          <p className="text-[10px] text-gray-400">spending flexibility applied</p>
        </div>
      </div>
    </div>
  );
}

// ── Trigger Table ─────────────────────────────────────────────────────────────

function TriggerTable({ triggers, showAll }: { triggers: GuardrailTrigger[]; showAll: boolean }) {
  const rows = showAll ? triggers : triggers.filter((_, i) => i % 2 === 0).slice(0, 15);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#0c1e3a] text-white">
            <th className="px-3 py-2 text-left font-semibold">Age</th>
            <th className="px-3 py-2 text-right font-semibold">Target Portfolio</th>
            <th className="px-3 py-2 text-right font-semibold">⬇ Cut trigger</th>
            <th className="px-3 py-2 text-right font-semibold">⬆ Boost trigger</th>
            <th className="px-3 py-2 text-right font-semibold">Base spending</th>
            <th className="px-3 py-2 text-right font-semibold text-red-300">Reduced spending</th>
            <th className="px-3 py-2 text-right font-semibold text-green-300">Boosted spending</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.age} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className="px-3 py-2 font-semibold text-gray-700">Age {r.age}</td>
              <td className="px-3 py-2 text-right text-gray-900 font-medium">{fmt$(r.targetPathBalance)}</td>
              <td className="px-3 py-2 text-right text-amber-700">{fmt$(r.floorBalance)}</td>
              <td className="px-3 py-2 text-right text-blue-700">{fmt$(r.ceilingBalance)}</td>
              <td className="px-3 py-2 text-right text-gray-700">{fmt$(r.baseSpending)}</td>
              <td className="px-3 py-2 text-right text-red-700 font-semibold">{fmt$(r.reducedSpending)}</td>
              <td className="px-3 py-2 text-right text-green-700 font-semibold">{fmt$(r.increasedSpending)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function GuardrailsPanel({
  percentileBands, successRate, baseWithdrawal, retirementAge, currentAge, paths,
}: Props) {
  const [params, setParams] = useState<GuardrailParams>({
    floorPct:   0.80,
    ceilingPct: 1.20,
    flexDown:   0.10,
    flexUp:     0.10,
  });
  const [showAllRows, setShowAllRows] = useState(false);
  const upd = (k: keyof GuardrailParams, v: number) => setParams(p => ({ ...p, [k]: v }));

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const medianPath = percentileBands.p50;

  // Client-side guardrail calculation
  const result = useMemo<GuardrailResult | null>(() => {
    if (!percentileBands.p50.length || baseWithdrawal <= 0) return null;

    // Build synthetic paths from percentile bands if full paths not available
    const syntheticPaths: number[][] = [];
    const n = 200; // use 200 synthetic paths for client-side speed
    const years = percentileBands.p50.length;

    if (paths && paths.length > 0) {
      // Use real paths (sampled for performance)
      const step = Math.max(1, Math.floor(paths.length / 500));
      for (let i = 0; i < paths.length; i += step) {
        syntheticPaths.push(paths[i]);
      }
    } else {
      // Interpolate between percentile bands
      for (let p = 0; p <= 100; p += 100 / n) {
        const path: number[] = [];
        const t = p / 100;
        for (let yr = 0; yr < years; yr++) {
          const lo = percentileBands.p10[yr] ?? 0;
          const hi = percentileBands.p90[yr] ?? 0;
          path.push(lo + (hi - lo) * t);
        }
        syntheticPaths.push(path);
      }
    }

    if (syntheticPaths.length === 0) return null;

    // Import applySpendingFlexibility — since this runs client-side we inline the logic
    return applyFlexibilityLocal(
      syntheticPaths, medianPath, baseWithdrawal,
      yearsToRetirement, params, retirementAge, 0.02,
    );
  }, [percentileBands, baseWithdrawal, params, yearsToRetirement, retirementAge, paths]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#0c1e3a] flex items-center justify-center">
          <Shield className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900">Spending Flexibility Guardrails</h3>
          <p className="text-xs text-gray-400">Set spending floor/ceiling triggers to see how flexibility improves plan resilience</p>
        </div>
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2.5">
        <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-800 leading-relaxed">
          Guardrails work by dynamically adjusting retirement spending based on portfolio performance.
          If your portfolio drops below the <strong>floor trigger</strong>, you reduce spending by your flexibility %.
          If it rises above the <strong>ceiling trigger</strong>, you can spend more.
          This converts a static success rate into an actionable spending rule.
        </p>
      </div>

      {/* Input controls */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Guardrail Parameters</p>
        <div className="grid grid-cols-2 gap-5">
          <SliderInput
            label="Spending cut trigger (floor)"
            value={params.floorPct}
            min={0.60} max={0.95} step={0.05}
            format={v => `Portfolio < ${(v * 100).toFixed(0)}% of target`}
            onChange={v => upd("floorPct", v)}
            hint="Reduce spending when portfolio falls below this % of the median path"
          />
          <SliderInput
            label="Spending boost trigger (ceiling)"
            value={params.ceilingPct}
            min={1.05} max={1.50} step={0.05}
            format={v => `Portfolio > ${(v * 100).toFixed(0)}% of target`}
            onChange={v => upd("ceilingPct", v)}
            hint="Increase spending when portfolio exceeds this % of the median path"
          />
          <SliderInput
            label="Spending flexibility (downside)"
            value={params.flexDown}
            min={0.05} max={0.30} step={0.05}
            format={v => `Reduce spending by ${(v * 100).toFixed(0)}%`}
            onChange={v => upd("flexDown", v)}
            hint="How much are you willing to cut spending in a bad year?"
          />
          <SliderInput
            label="Spending flexibility (upside)"
            value={params.flexUp}
            min={0.05} max={0.30} step={0.05}
            format={v => `Increase spending by ${(v * 100).toFixed(0)}%`}
            onChange={v => upd("flexUp", v)}
            hint="How much extra can you spend in a good year?"
          />
        </div>
      </div>

      {/* Results */}
      {result && (
        <>
          <SuccessComparison base={result.baseSuccessRate} adjusted={result.adjustedSuccessRate} />

          {/* Recommendation */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Advisor Insight</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.recommendation}</p>
          </div>

          {/* Spending amounts at retirement */}
          {result.triggerTable.length > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Base annual spending", value: result.triggerTable[0].baseSpending, color: "text-gray-900", bg: "bg-white border-gray-200" },
                { label: `Reduced (floor triggered)`, value: result.triggerTable[0].reducedSpending, color: "text-red-700", bg: "bg-red-50 border-red-200", icon: TrendingDown },
                { label: `Increased (ceiling triggered)`, value: result.triggerTable[0].increasedSpending, color: "text-green-700", bg: "bg-green-50 border-green-200", icon: TrendingUp },
              ].map(s => {
                const Icon = (s as any).icon;
                return (
                  <div key={s.label} className={`border rounded-xl p-3 ${s.bg}`}>
                    {Icon && <Icon className={`w-4 h-4 mb-1 ${s.color}`} />}
                    <p className={`text-lg font-bold ${s.color}`}>{fmt$(s.value)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    <p className="text-[10px] text-gray-400">at retirement</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trigger table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-700">Year-by-Year Guardrail Triggers</p>
              <button onClick={() => setShowAllRows(v => !v)}
                className="text-xs text-[#0c1e3a] font-semibold hover:underline">
                {showAllRows ? "Show fewer" : "Show all years"}
              </button>
            </div>
            <TriggerTable triggers={result.triggerTable} showAll={showAllRows} />
          </div>

          {/* How to use callout */}
          <div className="bg-[#0c1e3a]/5 border border-[#0c1e3a]/15 rounded-xl p-4">
            <p className="text-xs font-bold text-[#0c1e3a] mb-2">How to use this with your client</p>
            <ol className="text-xs text-gray-600 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Review the portfolio balance at each annual meeting against the "Target Portfolio" column</li>
              <li>If the balance is below the "Cut trigger" — implement the "Reduced spending" amount for that year</li>
              <li>If the balance is above the "Boost trigger" — the client can increase spending to the "Boosted spending" amount</li>
              <li>Return to base spending once the portfolio returns to the target path</li>
            </ol>
          </div>
        </>
      )}

      {!result && baseWithdrawal <= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
          <p className="text-sm text-amber-700">Enter a desired retirement income in the projection form to enable guardrail analysis.</p>
        </div>
      )}
    </div>
  );
}

// ── Client-side flexibility calculation (mirrors server guardrails.ts) ─────────

function applyFlexibilityLocal(
  paths: number[][], medianPath: number[], baseWithdrawal: number,
  retirementYear: number, params: GuardrailParams,
  retirementAge: number, inflationRate: number,
): GuardrailResult {
  const N = paths.length;
  const years = paths[0]?.length ?? 0;
  let baseSuccess = 0;
  let adjSuccess  = 0;

  for (const path of paths) {
    if (path[path.length - 1] > 0) baseSuccess++;

    let bal      = path[retirementYear] ?? 0;
    let survived = true;

    for (let yr = retirementYear; yr < path.length - 1; yr++) {
      const prevBal = path[yr];
      const nextBal = path[yr + 1];
      const ret     = prevBal > 0 ? (nextBal + baseWithdrawal - prevBal) / prevBal : 0;
      bal = bal * (1 + Math.max(-0.5, Math.min(0.5, ret)));

      const target = medianPath[yr] ?? medianPath[medianPath.length - 1] ?? 1;
      let spending = baseWithdrawal;
      if (target > 0) {
        if (bal < target * params.floorPct)   spending = baseWithdrawal * (1 - params.flexDown);
        else if (bal > target * params.ceilingPct) spending = baseWithdrawal * (1 + params.flexUp);
      }
      bal -= spending;
      if (bal <= 0) { survived = false; break; }
    }
    if (survived && bal > 0) adjSuccess++;
  }

  const baseRate = baseSuccess / N;
  const adjRate  = adjSuccess  / N;
  const gain     = adjRate - baseRate;

  // Build trigger table
  const triggerTable: GuardrailTrigger[] = [];
  const retYears = years - retirementYear;
  for (let i = 0; i < Math.min(retYears, 30); i++) {
    const idx    = retirementYear + i;
    const target = medianPath[idx] ?? 0;
    const infl   = Math.pow(1 + inflationRate, i);
    const base   = baseWithdrawal * infl;
    triggerTable.push({
      year:              new Date().getFullYear() + i,
      age:               retirementAge + i,
      targetPathBalance: Math.round(target),
      floorBalance:      Math.round(target * params.floorPct),
      ceilingBalance:    Math.round(target * params.ceilingPct),
      baseSpending:      Math.round(base),
      reducedSpending:   Math.round(base * (1 - params.flexDown)),
      increasedSpending: Math.round(base * (1 + params.flexUp)),
    });
  }

  const gainPct    = (gain * 100).toFixed(0);
  const flexPct    = (params.flexDown * 100).toFixed(0);
  const reducedAmt = Math.round(baseWithdrawal * (1 - params.flexDown)).toLocaleString("en-CA");
  let recommendation = "";
  if (gain > 0.05) {
    recommendation = `Applying a ${flexPct}% spending flexibility guardrail increases plan success from ${(baseRate * 100).toFixed(0)}% to ${(adjRate * 100).toFixed(0)}% — a ${gainPct}-point improvement. In down years, reduce annual withdrawals to $${reducedAmt}.`;
  } else if (gain > 0.01) {
    recommendation = `Spending flexibility adds ${gainPct} percentage points (${(baseRate * 100).toFixed(0)}% → ${(adjRate * 100).toFixed(0)}%). The plan is already reasonably strong; guardrails provide a useful safety margin.`;
  } else {
    recommendation = `Your plan has a ${(baseRate * 100).toFixed(0)}% base success rate. Spending flexibility adds minimal uplift here — consider increasing contributions or adjusting retirement age for greater impact.`;
  }

  return { baseSuccessRate: baseRate, adjustedSuccessRate: adjRate, successRateGain: gain, params, triggerTable, recommendation };
}
