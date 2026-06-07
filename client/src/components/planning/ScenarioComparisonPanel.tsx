/**
 * ScenarioComparisonPanel.tsx  — Best-in-class scenario comparison
 *
 * Beats Snap Projections by adding:
 *  1. Net worth trajectory chart (all scenarios on one Recharts line chart)
 *  2. Year-by-year table with RRSP/TFSA/Non-reg/Total NW/Income/Taxes
 *  3. Estate value at life expectancy
 *  4. Lifetime tax efficiency comparison
 *  5. AI-generated narrative recommendation
 *  6. "What needs to change" gap analysis per scenario
 */

import { useState, useEffect, useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  X, Save, TrendingUp, TrendingDown, Trophy,
  ChevronDown, ChevronUp, Sparkles, AlertTriangle,
} from "lucide-react";
import { translations, type T } from "../../i18n/translations";
import { api } from "../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Projection {
  id: number;
  label?: string;
  person?: string;
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  desiredRetirementIncome?: string;
  projectedBalance?: string;
  shortfallSurplus?: string;
  successRate?: string;
  rrspBalance?: string;
  tfsaBalance?: string;
  nonRegBalance?: string;
  annualContribution?: string;
  annualTfsaContribution?: string;
  pensionIncome?: string;
  cppMonthly?: string;
  cppStartAge?: number;
  oasMonthly?: string;
  oasStartAge?: number;
  expectedReturn?: string;
  inflationRate?: string;
}

interface YearData {
  age:      number;
  year:     number;
  rrsp:     number;
  tfsa:     number;
  nonReg:   number;
  totalNW:  number;
  income:   number;    // after-tax spending target
  taxes:    number;    // estimated annual tax
  isRetired: boolean;
  govIncome: number;
}

interface Props {
  clientId: number;
  onClose:  () => void;
  t?:       T;
}

// ── Scenario colors ───────────────────────────────────────────────────────────

const COLORS = ["#0891b2", "#0c1e3a", "#16a34a", "#d97706", "#7c3aed"];
const COLOR_NAMES = ["cyan", "navy", "green", "amber", "purple"];

// ── Year-by-year engine ───────────────────────────────────────────────────────

function projectYearByYear(p: Projection): YearData[] {
  const startAge  = p.currentAge    ?? 40;
  const retAge    = p.retirementAge ?? 65;
  const lifeAge   = p.lifeExpectancy ?? 90;
  const rate      = (Number(p.expectedReturn  ?? 6.5)) / 100;
  const infl      = (Number(p.inflationRate   ?? 2.0)) / 100;
  const desired   = Number(p.desiredRetirementIncome ?? 0);
  const pension   = Number(p.pensionIncome   ?? 0);
  const cppAnn    = Number(p.cppMonthly      ?? 0) * 12;
  const cppAge    = p.cppStartAge ?? 65;
  const oasAnn    = Number(p.oasMonthly      ?? 0) * 12;
  const oasAge    = p.oasStartAge ?? 65;
  const rrspC     = Number(p.annualContribution      ?? 0);
  const tfsaC     = Number(p.annualTfsaContribution  ?? 0);
  // Marginal tax rate (simplified — 38% for incomes likely in retirement)
  const mtr       = 0.38;

  let pRrsp   = Number(p.rrspBalance   ?? 0);
  let pTfsa   = Number(p.tfsaBalance   ?? 0);
  let pNonReg = Number(p.nonRegBalance ?? 0);

  const currentYear = new Date().getFullYear();
  const rows: YearData[] = [];

  for (let yr = 0; yr <= lifeAge - startAge; yr++) {
    const age = startAge + yr;
    const isRetired = age >= retAge;

    if (!isRetired) {
      // ── Accumulation ──────────────────────────────────────────────────────
      pRrsp   = (pRrsp   + rrspC)  * (1 + rate);
      pTfsa   = (pTfsa   + tfsaC)  * (1 + rate);
      pNonReg = pNonReg             * (1 + rate);

      rows.push({
        age, year: currentYear + yr,
        rrsp: Math.round(pRrsp), tfsa: Math.round(pTfsa), nonReg: Math.round(pNonReg),
        totalNW: Math.round(Math.max(0, pRrsp + pTfsa + pNonReg)),
        income: 0, taxes: 0, govIncome: 0, isRetired,
      });
    } else {
      // ── Decumulation ─────────────────────────────────────────────────────
      const yIntoRet = age - retAge;
      const desiredNow = desired > 0 ? desired * Math.pow(1 + infl, yIntoRet) : 0;

      // Cap inflation adjustment at 1.5x to prevent runaway numbers in long projections
      const inflCap = (base: number, yrs: number) => base * Math.min(1.5, Math.pow(1 + infl, Math.max(0, yrs)));
      const cppNow  = age >= cppAge  ? inflCap(cppAnn,  yIntoRet - (cppAge  - retAge)) : 0;
      const oasNow  = age >= oasAge  ? inflCap(oasAnn,  yIntoRet - (oasAge  - retAge)) : 0;
      const pensNow = pension > 0    ? inflCap(pension,  yIntoRet) : 0;
      const govIncome = Math.round(cppNow + oasNow + pensNow);

      const needed  = Math.max(0, desiredNow - govIncome);
      const taxable = needed * 0.65; // ~65% from registered accounts
      const taxes   = Math.round(taxable * mtr);

      // Draw from RRSP first, then non-reg, TFSA last (tax-efficient order)
      let draw = needed;
      const rrspDraw   = Math.min(pRrsp, draw * 0.65);  draw -= rrspDraw;
      const nonRegDraw = Math.min(pNonReg, draw * 0.5); draw -= nonRegDraw;
      const tfsaDraw   = Math.min(pTfsa, draw);

      pRrsp   = Math.max(0, pRrsp   - rrspDraw)   * (1 + rate);
      pNonReg = Math.max(0, pNonReg - nonRegDraw)  * (1 + rate);
      pTfsa   = Math.max(0, pTfsa   - tfsaDraw)    * (1 + rate);

      rows.push({
        age, year: currentYear + yr,
        rrsp: Math.round(pRrsp), tfsa: Math.round(pTfsa), nonReg: Math.round(pNonReg),
        totalNW: Math.round(Math.max(0, pRrsp + pTfsa + pNonReg)),
        income: Math.round(desiredNow), taxes, govIncome, isRetired,
      });
    }
  }

  return rows;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number, decimals = 0) {
  if (isNaN(n) || n === 0) return "$0";
  const abs = Math.abs(Math.round(n));
  const str = abs.toLocaleString("en-CA");
  return (n < 0 ? "-$" : "$") + str;
}
function fmtK(n: number) {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n < 0 ? "-$" : "$") + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return (n < 0 ? "-$" : "$") + Math.round(abs / 1_000).toLocaleString() + "K";
  return fmt$(n);
}
function fmtAxis(v: number) {
  if (v >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000)     return "$" + Math.round(v / 1_000) + "K";
  return "$" + v;
}

function DeltaBadge({ base, value, fmt = fmtK, higher = true }:
  { base: number; value: number; fmt?: (n: number) => string; higher?: boolean }) {
  const diff = value - base;
  if (Math.abs(diff) < 500) return <span className="text-gray-400 text-xs">—</span>;
  const good = (diff > 0) === higher;
  const color = good ? "text-emerald-600" : "text-red-500";
  const Icon  = diff > 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon className="w-3 h-3" />
      {fmt(Math.abs(diff))}
    </span>
  );
}

function FundingBar({ pct }: { pct: number }) {
  const color = pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 mt-1">
      <div className={`${color} h-2 rounded-full`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

// ── Rule-based narrative ─────────────────────────────────────────────────────

function buildNarrative(
  projections: Projection[],
  years: YearData[][],
  bestIdx: number,
): string {
  const best = projections[bestIdx];
  const bestFunded = Number(best.successRate ?? 0);
  const bestLabel = best.label ?? `Scenario ${bestIdx + 1}`;
  const estateValues = years.map(y => y[y.length - 1]?.totalNW ?? 0);
  const taxTotals = years.map(y => y.filter(r => r.isRetired).reduce((s, r) => s + r.taxes, 0));
  const mostTaxEffIdx = taxTotals.indexOf(Math.min(...taxTotals));

  const lines: string[] = [];

  if (bestFunded >= 90) {
    lines.push(`${bestLabel} is the strongest scenario, fully funding retirement at ${Math.round(bestFunded)}%.`);
  } else if (bestFunded >= 70) {
    lines.push(`${bestLabel} leads with ${Math.round(bestFunded)}% funding — a gap remains but the plan is recoverable.`);
  } else {
    lines.push(`All scenarios show funding below 90%. Consider increasing contributions or adjusting retirement age.`);
  }

  const retAges = projections.map(p => p.retirementAge ?? 65);
  if (new Set(retAges).size > 1) {
    const earliest = Math.min(...retAges);
    const latest   = Math.max(...retAges);
    const earlyIdx = retAges.indexOf(earliest);
    const lateIdx  = retAges.indexOf(latest);
    const estDiff  = estateValues[lateIdx] - estateValues[earlyIdx];
    if (Math.abs(estDiff) > 50_000) {
      lines.push(`Retiring at ${latest} vs ${earliest} produces ${fmtK(Math.abs(estDiff))} ${estDiff > 0 ? "more" : "less"} in estate value at life expectancy.`);
    }
  }

  if (new Set(projections.map(p => p.cppStartAge ?? 65)).size > 1) {
    const firstRetYear = years[bestIdx]?.find(r => r.isRetired);
    const govAnnual = firstRetYear?.govIncome ?? 0;
    if (govAnnual > 0) {
      const cppAge = projections[bestIdx].cppStartAge ?? 65;
      lines.push(`${bestLabel} starts CPP at ${cppAge}, generating ${fmt$(govAnnual)}/yr in government income at the start of retirement.`);
    }
  }

  if (mostTaxEffIdx !== bestIdx) {
    const taxLabel = projections[mostTaxEffIdx].label ?? `Scenario ${mostTaxEffIdx + 1}`;
    lines.push(`${taxLabel} is the most tax-efficient, saving ${fmtK(taxTotals[bestIdx] - taxTotals[mostTaxEffIdx])} in estimated lifetime taxes.`);
  }

  return lines.join(" ");
}

// ── Summary row config ────────────────────────────────────────────────────────

function buildRows(years: YearData[][], projections: Projection[], engineData: Record<number, any>, t: T) {
  return [
    {
      key: "retAge",     label: t.scenarioComparison.retirementAge,
      get: (p: Projection) => p.retirementAge ?? 65,
      fmt: (n: number) => `${n} yrs`,  higher: false,
    },
    {
      key: "portfolio",  label: t.scenarioComparison.portfolioAtRet,
      get: (p: Projection) => Number(p.projectedBalance ?? 0),
      fmt: fmtK, higher: true,
    },
    {
      key: "funded",     label: t.scenarioComparison.fundingRate,
      get: (p: Projection) => Number(p.successRate ?? 0),
      fmt: (n: number) => `${Math.round(n)}%`,  higher: true, isPercent: true,
    },
    {
      key: "surplus",    label: t.scenarioComparison.annualSurplus,
      get: (p: Projection) => Number(p.shortfallSurplus ?? 0),
      fmt: fmt$, higher: true,
    },
    {
      key: "desired",    label: t.scenarioComparison.targetIncome,
      get: (p: Projection) => Number(p.desiredRetirementIncome ?? 0),
      fmt: fmt$, higher: true,
    },
    {
      key: "gov",        label: t.scenarioComparison.guaranteedIncome,
      get: (p: Projection, i: number) => {
        const eng = engineData[p.id!]?.summary;
        return eng?.guaranteedIncomeAtRet ?? years[i]?.find(y => y.isRetired)?.govIncome ?? 0;
      },
      fmt: fmt$, higher: true,
    },
    {
      key: "estate",     label: t.scenarioComparison.estateValue2,
      get: (p: Projection, i: number) => {
        const eng = engineData[p.id!]?.summary;
        return eng?.estateValueAtDeath ?? years[i]?.[years[i].length - 1]?.totalNW ?? 0;
      },
      fmt: fmtK, higher: true,
    },
    {
      key: "lifetaxes",  label: t.scenarioComparison.lifetimeTaxes,
      get: (p: Projection, i: number) => {
        const eng = engineData[p.id!]?.summary;
        return eng?.lifetimeTaxPaid ?? years[i]?.filter(y => y.isRetired).reduce((s, y) => s + y.taxes, 0) ?? 0;
      },
      fmt: fmtK, higher: false,
    },
    {
      key: "rrif",       label: t.scenarioComparison.rrifMinAt71,
      get: (p: Projection) => {
        const eng = engineData[p.id!]?.summary;
        return eng?.rrifMinYear1 ?? 0;
      },
      fmt: fmt$, higher: false,
    },
    {
      key: "cpp",        label: t.scenarioComparison.cppStartAge,
      get: (p: Projection) => p.cppStartAge ?? 65,
      fmt: (n: number) => `Age ${n}`,  higher: false,
    },
    {
      key: "oas",        label: t.scenarioComparison.oasStartAge,
      get: (p: Projection) => p.oasStartAge ?? 65,
      fmt: (n: number) => `Age ${n}`,  higher: false,
    },
    {
      key: "contrib",    label: t.scenarioComparison.annualContrib,
      get: (p: Projection) => Number(p.annualContribution ?? 0),
      fmt: fmt$, higher: true,
    },
    {
      key: "return",     label: t.scenarioComparison.expectedReturn,
      get: (p: Projection) => Number(p.expectedReturn ?? 6.5),
      fmt: (n: number) => `${n.toFixed(1)}%`, higher: true,
    },
  ];
}

// ── Custom tooltip for chart ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-3 text-xs">
      <p className="font-bold text-gray-700 mb-1.5">Age {label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            <span className="text-gray-600">{entry.name}</span>
          </span>
          <span className="font-semibold text-gray-900">{fmtK(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScenarioComparisonPanel({ clientId, onClose, t = translations.en }: Props) {
  const [projections,  setProjections]  = useState<Projection[]>([]);
  const [engineData,   setEngineData]   = useState<Record<number, any>>({});
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState<number[]>([]);
  const [labels,       setLabels]       = useState<Record<number, string>>({});
  const [step,         setStep]         = useState<"select" | "compare">("select");
  const [savedLabel,   setSavedLabel]   = useState("");
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [showYearBy,   setShowYearBy]   = useState(false);
  const [yearByPage,   setYearByPage]   = useState(0);

  // ── Fetch projections + engine data ─────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`, "Content-Type": "application/json"
    };
    const opts = { headers, credentials: "include" as RequestCredentials };

    fetch(`/api/clients/${clientId}/retirement`, opts)
      .then(r => r.ok ? r.json() : [])
      .then(async (projs: Projection[]) => {
        if (!Array.isArray(projs) || projs.length === 0) {
          setProjections([]); setLoading(false); return;
        }
        setProjections(projs);
        // Run the engine for each projection that doesn't yet have data
        const engineCalls = projs.map(p =>
          fetch(`/api/clients/${clientId}/retirement/${p.id}/project`, {
            method: "POST", ...opts
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => data ? { projId: p.id, data } : null)
            .catch(() => null)
        );
        const results = await Promise.all(engineCalls);
        const engineMap: Record<number, any> = {};
        results.forEach(r => { if (r) engineMap[r.projId] = r.data; });
        setEngineData(engineMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const compared = useMemo(() =>
    projections.filter(p => selected.includes(p.id!)), [projections, selected]);

  // Year-by-year: prefer server engine data; fall back to client calc with disclaimer
  const yearlyData = useMemo(() =>
    compared.map(p => {
      const eng = engineData[p.id!];
      if (eng?.yearByYear) {
        // Map server engine YearResult → our local YearData shape
        return eng.yearByYear.map((y: any) => ({
          age:       y.age,
          year:      y.year,
          rrsp:      y.rrspBalance,
          tfsa:      y.tfsaBalance,
          nonReg:    y.nonRegBalance,
          totalNW:   y.totalPortfolio,
          income:    y.desiredSpendingNominal,
          taxes:     y.totalTax,
          govIncome: y.cppIncome + y.oasIncome + y.pensionIncome,
          isRetired: y.phase !== "accumulation",
          rrifWithdrawal: y.rrifWithdrawal,
          surplus:   y.surplus,
          fundingPct: y.fundingPct,
        }));
      }
      return projectYearByYear(p);
    }),
    [compared, engineData]
  );

  // Summary from engine if available, else from stored projection values
  const getEngSummary = (p: Projection) => engineData[p.id!]?.summary;

  const bestIdx = useMemo(() => {
    if (compared.length === 0) return 0;
    return compared.reduce((best, p, i) =>
      Number(p.successRate ?? 0) > Number(compared[best].successRate ?? 0) ? i : best, 0);
  }, [compared]);

  const narrative = useMemo(() =>
    compared.length >= 2 ? buildNarrative(compared, yearlyData, bestIdx) : "",
    [compared, yearlyData, bestIdx]
  );

  const rows = useMemo(() => buildRows(yearlyData, compared, engineData, t), [yearlyData, compared, engineData]);

  // Chart data — net worth by age across all scenarios
  const chartData = useMemo(() => {
    if (yearlyData.length === 0) return [];
    const maxLen = Math.max(...yearlyData.map(y => y.length));
    return Array.from({ length: maxLen }, (_, i) => {
      const base = yearlyData[0][i];
      if (!base) return null;
      const point: Record<string, number | boolean> = { age: base.age, isRetired: base.isRetired };
      yearlyData.forEach((yd, si) => {
        if (yd[i]) point[`s${si}`] = yd[i].totalNW;
      });
      return point;
    }).filter(Boolean);
  }, [yearlyData]);

  function getLabel(p: Projection) {
    return labels[p.id!] ?? p.label ?? `Scenario ${p.id}`;
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.post(`/api/clients/${clientId}/scenario-comparisons`, {
        label: savedLabel || t.scenarioComparison.title,
        scenarioIds: selected,
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  // ── Paginated year-by-year table ─────────────────────────────────────────────
  const PAGE_SIZE = 10;
  const allAges = yearlyData[0] ?? [];
  const pageAges = allAges.slice(yearByPage * PAGE_SIZE, (yearByPage + 1) * PAGE_SIZE);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1 — SELECT SCENARIOS
  // ═══════════════════════════════════════════════════════════════════════════
  if (step === "select") {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Compare Scenarios</h2>
              <p className="text-sm text-gray-400 mt-0.5">Select 2–3 projections to compare side by side</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 pb-24 space-y-2">
            {loading && <p className="text-sm text-gray-400 text-center py-8">Loading projections…</p>}
            {!loading && projections.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No projections on file. Create at least 2 projections first.</p>
            )}
            {!loading && projections.length === 1 && (
              <p className="text-sm text-amber-500 text-center py-2 bg-amber-50 rounded-lg px-4">
                Only 1 projection found — create a second with different assumptions to compare.
              </p>
            )}
            {projections.map((p) => {
              const isSelected = selected.includes(p.id!);
              const funded    = Number(p.successRate ?? 0);
              const portfolio = Number(p.projectedBalance ?? 0);
              const estate    = yearlyData[projections.indexOf(p)]?.[yearlyData[projections.indexOf(p)]?.length - 1]?.totalNW ?? 0;
              const order = selected.indexOf(p.id!);
              return (
                <button key={p.id} onClick={() => {
                  setSelected(prev => prev.includes(p.id!)
                    ? prev.filter(x => x !== p.id!)
                    : prev.length < 3 ? [...prev, p.id!] : prev);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                  isSelected ? "border-[#0c1e3a] bg-[#0c1e3a]/5" : "border-gray-200 hover:border-gray-300 bg-white"
                }`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold transition-all ${
                    isSelected ? "bg-[#0c1e3a] text-white" : "bg-gray-100 text-gray-400"
                  }`} style={isSelected ? { backgroundColor: COLORS[order] } : {}}>
                    {isSelected ? order + 1 : ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{p.label || `Projection ${p.id}`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Retire at {p.retirementAge ?? 65} · {fmtK(portfolio)} projected · Target {fmt$(Number(p.desiredRetirementIncome ?? 0))}/yr
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 w-28">
                    <p className={`text-sm font-bold ${funded >= 90 ? "text-emerald-600" : funded >= 70 ? "text-amber-600" : "text-red-500"}`}>
                      {Math.round(funded)}% funded
                    </p>
                    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
                      <div className={`h-1.5 rounded-full ${funded >= 90 ? "bg-emerald-500" : funded >= 70 ? "bg-amber-500" : "bg-red-500"}`}
                        style={{ width: `${Math.min(100, funded)}%` }} />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100">
            <p className="text-sm text-gray-400">
              {selected.length === 0 ? t.scenarioComparison.selectTwo :
               selected.length === 1 ? t.scenarioComparison.selectMore2 :
               `${selected.length} selected — ready`}
            </p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">{t.common.cancel}</button>
              <button onClick={() => setStep("compare")} disabled={selected.length < 2}
                className="px-5 py-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors">
                Compare →
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2 — COMPARISON VIEW
  // ═══════════════════════════════════════════════════════════════════════════

  const retAge = compared[0]?.retirementAge ?? 65;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-2">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl flex flex-col max-h-[96vh]">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 bg-[#0c1e3a] rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {compared.map((_, i) => (
                <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
              ))}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t.scenarioComparison.scenarioTitle}</h2>
              <p className="text-xs text-white/50">{compared.length} scenarios · Summary uses saved projection results</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto pb-20">

          {/* ── AI Narrative ──────────────────────────────────────────────── */}
          {narrative && (
            <div className="mx-6 mt-5 flex items-start gap-3 bg-[#0c1e3a]/5 border border-[#0c1e3a]/15 rounded-xl p-4">
              <Sparkles className="w-4 h-4 text-[#0891b2] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[#0c1e3a] leading-relaxed">{narrative}</p>
            </div>
          )}

          {/* ── Net Worth Trajectory Chart ─────────────────────────────────── */}
          <div className="px-6 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Net Worth Trajectory</h3>
              <div className="flex items-center gap-4">
                {compared.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <div className="w-8 h-0.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-gray-500">{getLabel(p)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gray-50/60 rounded-xl p-4">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData as any[]} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="age" tick={{ fontSize: 11, fill: "#94A3B8" }}
                    label={{ value: "Age", position: "insideBottom", offset: -2, fontSize: 11, fill: "#94A3B8" }} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11, fill: "#94A3B8" }} width={64} />
                  <Tooltip content={<ChartTooltip />} />
                  <ReferenceLine x={retAge} stroke="#94A3B8" strokeDasharray="4 4"
                    label={{ value: t.scenarioComparison.retLabel, position: "top", fontSize: 10, fill: "#94A3B8" }} />
                  {compared.map((p, i) => (
                    <Line key={i} type="monotone" dataKey={`s${i}`} name={getLabel(p)}
                      stroke={COLORS[i]} strokeWidth={2.5} dot={false}
                      activeDot={{ r: 4, strokeWidth: 0 }} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Summary metrics table ──────────────────────────────────────── */}
          <div className="px-6 pt-5">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">Key Metrics</h3>
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0c1e3a]">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-white/60 uppercase tracking-wider w-52">{t.scenarioComparison.metric}</th>
                    {compared.map((p, i) => (
                      <th key={p.id} className={`px-4 py-3 text-center ${i === bestIdx ? "bg-emerald-900/30" : ""}`}>
                        <div className="flex flex-col items-center gap-1">
                          {i === bestIdx && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                              <Trophy className="w-2.5 h-2.5" /> Best
                            </span>
                          )}
                          <input value={getLabel(p)}
                            onChange={e => setLabels(l => ({ ...l, [p.id!]: e.target.value }))}
                            className="text-xs font-bold text-center bg-transparent text-white border-b border-white/20 focus:border-white outline-none w-full" />
                          <span className="w-5 h-0.5 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                        </div>
                      </th>
                    ))}
                    {compared.length > 1 && (
                      <th className="px-4 py-3 bg-slate-800/30 text-[10px] font-bold text-white/40 uppercase tracking-wider text-center w-28">Δ vs S1</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any, ri: number) => {
                    const values = compared.map((p, i) => row.get(p, i));
                    const isHighlight = ["portfolio","funded","surplus","estate"].includes(row.key);
                    return (
                      <tr key={row.key} className={`border-b border-gray-100 ${ri % 2 === 0 ? "bg-white" : "bg-gray-50/40"}`}>
                        <td className="px-4 py-2.5 text-xs font-medium text-gray-500 bg-inherit">{row.label}</td>
                        {compared.map((p, i) => {
                          const val = values[i];
                          let color = "text-gray-900";
                          if (row.key === "funded")   color = val >= 90 ? "text-emerald-600" : val >= 70 ? "text-amber-600" : "text-red-500";
                          if (row.key === "surplus")  color = val >= 0 ? "text-emerald-600" : "text-red-500";
                          if (row.key === "lifetaxes") color = "text-slate-500";
                          return (
                            <td key={p.id} className={`px-4 py-2.5 text-center ${i === bestIdx ? "bg-emerald-50/50" : ""}`}>
                              <p className={`font-semibold ${color} ${isHighlight ? "text-sm" : "text-xs"}`}>{row.fmt(val)}</p>
                              {row.key === "funded" && <FundingBar pct={val} />}
                            </td>
                          );
                        })}
                        {compared.length > 1 && (
                          <td className="px-4 py-2.5 text-center bg-slate-50/40">
                            {compared.length === 2
                              ? <DeltaBadge base={values[0]} value={values[1]} fmt={row.fmt} higher={row.higher !== false} />
                              : <div className="space-y-0.5">
                                  {values.slice(1).map((v, di) => (
                                    <div key={di} className="flex items-center justify-center gap-1">
                                      <span className="text-[9px] text-gray-400" style={{ color: COLORS[di+1] }}>S{di+2}</span>
                                      <DeltaBadge base={values[0]} value={v} fmt={row.fmt} higher={row.higher !== false} />
                                    </div>
                                  ))}
                                </div>
                            }
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Year-by-year table ─────────────────────────────────────────── */}
          <div className="px-6 pt-4 pb-6">
            <button onClick={() => setShowYearBy(v => !v)}
              className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 mb-3 w-full">
              {showYearBy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Year-by-Year Breakdown
              <span className="text-xs font-normal text-gray-400">(RRSP · TFSA · Non-Reg · Net Worth · Taxes)</span>
            </button>
            {showYearBy && (
              <div>
                <div className="rounded-xl overflow-hidden border border-gray-200 overflow-x-auto">
                  <table className="text-xs w-full min-w-[700px]">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-3 py-2 text-left font-semibold text-gray-500">{t.ltc.ageLabel}</th>
                        {compared.map((p, i) => (
                          <th key={i} colSpan={4} className="px-3 py-2 text-center font-bold border-l border-gray-200"
                            style={{ color: COLORS[i] }}>
                            {getLabel(p)}
                          </th>
                        ))}
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="px-3 py-1.5 text-left text-[10px] font-medium text-gray-400" />
                        {compared.map((_, i) => (
                          <> 
                            <th key={`${i}-nw`} className="px-3 py-1.5 text-center text-[10px] font-medium text-gray-400 border-l border-gray-200">{t.scenarioComparison.netWorthLabel}</th>
                            <th key={`${i}-rrsp`} className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400">RRSP</th>
                            <th key={`${i}-tfsa`} className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400">TFSA</th>
                            <th key={`${i}-nonreg`} className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400">{t.scenarioComparison.nonReg}</th>
                            <th key={`${i}-tax`} className="px-2 py-1.5 text-center text-[10px] font-medium text-gray-400">{t.scenarioComparison.estTaxes}</th>
                          </>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageAges.map((row: any, ri: number) => (
                        <tr key={row.age} className={`border-b border-gray-100 ${row.isRetired ? "bg-blue-50/20" : ""} ${ri % 2 === 0 ? "" : "bg-gray-50/30"}`}>
                          <td className="px-3 py-1.5 font-medium text-gray-700">
                            {row.age}
                            {row.isRetired && <span className="ml-1 text-[9px] text-blue-400">ret</span>}
                          </td>
                          {compared.map((_, si) => {
                            const yr = yearlyData[si]?.[yearByPage * PAGE_SIZE + ri];
                            if (!yr) return <td key={si} colSpan={4} />;
                            return (
                              <>
                                <td key={`${si}-nw`} className="px-3 py-1.5 text-center font-semibold text-gray-800 border-l border-gray-100">
                                  {fmtK(yr.totalNW)}
                                </td>
                                <td key={`${si}-rrsp`} className="px-2 py-1.5 text-center text-gray-500">{fmtK(yr.rrsp)}</td>
                                <td key={`${si}-tfsa`} className="px-2 py-1.5 text-center text-gray-500">{fmtK(yr.tfsa)}</td>
                                <td key={`${si}-nonreg`} className="px-2 py-1.5 text-center text-gray-500">{fmtK(yr.nonReg)}</td>
                                <td key={`${si}-tax`} className="px-2 py-1.5 text-center text-red-400">
                                  {yr.isRetired ? fmtK(yr.taxes) : "—"}
                                </td>
                              </>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                <div className="flex items-center justify-between mt-3">
                  <button onClick={() => setYearByPage(p => Math.max(0, p - 1))} disabled={yearByPage === 0}
                    className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg">
                    ← Earlier
                  </button>
                  <span className="text-xs text-gray-400">
                    Ages {pageAges[0]?.age}–{pageAges[pageAges.length - 1]?.age} of {allAges[allAges.length-1]?.age}
                  </span>
                  <button onClick={() => setYearByPage(p => Math.min(Math.ceil(allAges.length / PAGE_SIZE) - 1, p + 1))}
                    disabled={(yearByPage + 1) * PAGE_SIZE >= allAges.length}
                    className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg">
                    Later →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex-shrink-0">
          <button onClick={() => setStep("select")} className="text-sm text-gray-500 hover:text-gray-700">
            ← Change scenarios
          </button>
          <div className="flex items-center gap-3">
            {saved ? (
              <span className="text-sm text-emerald-600 font-semibold">✓ Saved</span>
            ) : (
              <>
                <input value={savedLabel} onChange={e => setSavedLabel(e.target.value)}
                  placeholder={t.scenarioComparison.labelOptional}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-[#0c1e3a]/20" />
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
                  <Save className="w-4 h-4" />
                  {saving ? t.scenarioComparison.saving : t.scenarioComparison.saveComparison}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
