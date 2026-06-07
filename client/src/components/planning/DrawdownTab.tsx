import { useState, useEffect } from "react";
import { TrendingDown, DollarSign, Percent, ChevronDown, ChevronUp, Info } from "lucide-react";
const apiFetch = async (url: string, init?: RequestInit) => { const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, ...(init?.headers ?? {}) } }); if (!res.ok) throw new Error(await res.text()); return res.json(); };

interface DrawdownYear {
  age: number; year: number;
  rrspBalance: number; tfsaBalance: number; nonRegBalance: number; totalWealth: number;
  rrspWithdrawal: number; tfsaWithdrawal: number; nonRegWithdrawal: number;
  cppIncome: number; oasIncome: number; pensionIncome: number;
  totalIncome: number; federalTax: number; provincialTax: number; totalTax: number;
  effectiveRate: number; afterTaxIncome: number; rrifMinimum: number;
}
interface DrawdownResult {
  strategy: string; strategyLabel: string; years: DrawdownYear[];
  totalLifetimeTax: number; totalAfterTax: number; finalWealth: number;
  wealthAtAge90: number; portfolioLasts: number | null; averageEffRate: number;
  taxSavingsVsWorst?: number;
}
interface DrawdownResults {
  rrspFirst: DrawdownResult; tfsaFirst: DrawdownResult; blended: DrawdownResult;
}

const fmt$ = (n: number) => n < 0 ? `-$${Math.abs(Math.round(n)).toLocaleString()}` : `$${Math.round(n).toLocaleString()}`;
const fmtPct = (n: number) => `${(n * 100).toFixed(1)}%`;

const PROVINCES = ["ON","BC","AB","QC","MB","SK","NS","NB","PE","NL","NT","NU","YT"];

const STRATEGY_COLORS = {
  rrspFirst: { bg: "bg-blue-50",   border: "border-blue-200",  text: "text-blue-700",  badge: "bg-blue-600"  },
  tfsaFirst: { bg: "bg-teal-50",   border: "border-teal-200",  text: "text-teal-700",  badge: "bg-teal-600"  },
  blended:   { bg: "bg-purple-50", border: "border-purple-200",text: "text-purple-700",badge: "bg-purple-600" },
};

export function DrawdownTab({ clientId, client }: { clientId: number; client?: any }) {
  const [form, setForm] = useState({
    currentAge: String(client?.dateOfBirth ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (365.25*24*60*60*1000)) : 50),
    retirementAge: String(client?.retirementAge ?? 65),
    lifeExpectancy: "90",
    province: client?.province ?? "ON",
    rrspBalance: "",
    tfsaBalance: "",
    nonRegBalance: "",
    nonRegAcb: "",
    desiredAnnualIncome: String(client?.desiredRetirementIncome ?? ""),
    cppAnnual: "12000",
    oasAnnual: "8500",
    cppStartAge: "65",
    oasStartAge: "65",
    pensionIncome: "0",
    expectedReturn: "6",
    inflationRate: "2",
  });
  const [results, setResults] = useState<DrawdownResults | null>(null);
  useEffect(() => {
    apiFetch(`/api/clients/${clientId}/pensions`).then((pensions: any[]) => {
      const dbppIncome = pensions
        .filter(p => p.pensionType === "dbpp")
        .reduce((s, p) => {
          const rate = Number(p.accrualRate || 0);
          const years = Number(p.projectedYearsAtRetirement || p.yearsOfService || 0);
          const salary = Number(p.bestAverageEarnings || 0);
          return s + (rate * years * salary);
        }, 0);
      const dcppBalance = pensions
        .filter(p => p.pensionType !== "dbpp")
        .reduce((s, p) => s + Number(p.currentBalance || 0), 0);
      if (dbppIncome > 0 || dcppBalance > 0) {
        setForm(f => ({
          ...f,
          pensionIncome: dbppIncome > 0 ? String(Math.round(dbppIncome)) : f.pensionIncome,
          nonRegBalance: dcppBalance > 0 ? String(Math.round(Number(f.nonRegBalance || 0) + dcppBalance)) : f.nonRegBalance,
        }));
      }
    }).catch(() => {});
  }, [clientId]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeStrategy, setActiveStrategy] = useState<"rrspFirst"|"tfsaFirst"|"blended">("blended");
  const [showTable, setShowTable] = useState(false);
  const [showChart, setShowChart] = useState(true);

  const upd = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function runAnalysis() {
    setLoading(true); setError("");
    try {
      const token = localStorage.getItem("fp_token") ?? "";
      const res = await fetch(`/api/clients/${clientId}/drawdown`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          currentAge:          +form.currentAge,
          retirementAge:       +form.retirementAge,
          lifeExpectancy:      +form.lifeExpectancy,
          province:            form.province,
          rrspBalance:         +form.rrspBalance || 0,
          tfsaBalance:         +form.tfsaBalance || 0,
          nonRegBalance:       +form.nonRegBalance || 0,
          nonRegAcb:           +form.nonRegAcb || 0,
          desiredAnnualIncome: +form.desiredAnnualIncome || 0,
          cppAnnual:           +form.cppAnnual || 0,
          oasAnnual:           +form.oasAnnual || 0,
          cppStartAge:         +form.cppStartAge || 65,
          oasStartAge:         +form.oasStartAge || 65,
          pensionIncome:       +form.pensionIncome || 0,
          expectedReturn:      +form.expectedReturn / 100,
          inflationRate:       +form.inflationRate / 100,
          bpa:                 16129,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).message ?? "Failed");
      setResults(await res.json());
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  const strats = results ? [
    { key: "blended"   as const, data: results.blended   },
    { key: "rrspFirst" as const, data: results.rrspFirst },
    { key: "tfsaFirst" as const, data: results.tfsaFirst },
  ] : [];

  const bestTax = results ? Math.min(results.rrspFirst.totalLifetimeTax, results.tfsaFirst.totalLifetimeTax, results.blended.totalLifetimeTax) : 0;

  // Simple SVG wealth chart
  function WealthChart({ data }: { data: DrawdownResult }) {
    const years = data.years;
    if (!years.length) return null;
    const maxW = Math.max(...years.map(y => y.totalWealth)) || 1;
    const w = 600, h = 160, pad = 30;
    const xScale = (i: number) => pad + (i / (years.length - 1)) * (w - 2 * pad);
    const yScale = (v: number) => h - pad - (v / maxW) * (h - 2 * pad);
    const rrspPts  = years.map((y, i) => `${xScale(i)},${yScale(y.rrspBalance)}`).join(" ");
    const tfsaPts  = years.map((y, i) => `${xScale(i)},${yScale(y.tfsaBalance)}`).join(" ");
    const totalPts = years.map((y, i) => `${xScale(i)},${yScale(y.totalWealth)}`).join(" ");
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{maxHeight:160}}>
        <polyline points={rrspPts}  fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <polyline points={tfsaPts}  fill="none" stroke="#14b8a6" strokeWidth="1.5" />
        <polyline points={totalPts} fill="none" stroke="#8b5cf6" strokeWidth="2" strokeDasharray="4 2" />
        {years.filter((_,i) => i % 5 === 0).map((y, i) => (
          <text key={i} x={xScale(years.indexOf(y))} y={h - 5} fontSize="9" textAnchor="middle" fill="#9ca3af">{y.age}</text>
        ))}
        <line x1={pad} y1={pad} x2={pad} y2={h-pad} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={pad} y1={h-pad} x2={w-pad} y2={h-pad} stroke="#e5e7eb" strokeWidth="1" />
      </svg>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <TrendingDown className="w-5 h-5 text-purple-600" />
        <h2 className="text-xl font-bold text-gray-900">Drawdown Strategy Comparison</h2>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4">Retirement Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Current Age",        key: "currentAge",        type: "number" },
            { label: "Retirement Age",     key: "retirementAge",     type: "number" },
            { label: "Life Expectancy",    key: "lifeExpectancy",    type: "number" },
            { label: "Province",           key: "province",          type: "select"  },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
              {f.type === "select" ? (
                <select value={form[f.key as keyof typeof form]} onChange={e => upd(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              ) : (
                <input type="number" value={form[f.key as keyof typeof form]} onChange={e => upd(f.key, e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "RRSP/RRIF Balance ($)",  key: "rrspBalance" },
            { label: "TFSA Balance ($)",        key: "tfsaBalance" },
            { label: "Non-Reg Balance ($)",     key: "nonRegBalance" },
            { label: "Non-Reg ACB ($)",         key: "nonRegAcb" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
              <input type="number" value={form[f.key as keyof typeof form]} onChange={e => upd(f.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" placeholder="0" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: "Desired Annual Income ($)", key: "desiredAnnualIncome" },
            { label: "CPP Annual ($)",            key: "cppAnnual" },
            { label: "OAS Annual ($)",            key: "oasAnnual" },
            { label: "Other Pension ($)",         key: "pensionIncome" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
              <input type="number" value={form[f.key as keyof typeof form]} onChange={e => upd(f.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" placeholder="0" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          {[
            { label: "CPP Start Age",     key: "cppStartAge" },
            { label: "OAS Start Age",     key: "oasStartAge" },
            { label: "Expected Return (%)", key: "expectedReturn" },
            { label: "Inflation Rate (%)",  key: "inflationRate" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-500 block mb-1">{f.label}</label>
              <input type="number" value={form[f.key as keyof typeof form]} onChange={e => upd(f.key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300" />
            </div>
          ))}
        </div>
        {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
        <button onClick={runAnalysis} disabled={loading}
          className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-xl text-sm">
          <TrendingDown className="w-4 h-4" />
          {loading ? "Calculating…" : "Run Drawdown Analysis"}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Strategy Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {strats.map(({ key, data }) => {
              const c = STRATEGY_COLORS[key];
              const isBest = data.totalLifetimeTax === bestTax;
              return (
                <button key={key} onClick={() => setActiveStrategy(key)}
                  className={`text-left p-4 rounded-xl border-2 transition-all ${c.bg} ${activeStrategy === key ? c.border : "border-transparent"}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-xs font-bold px-2 py-1 rounded-full text-white ${c.badge}`}>{data.strategyLabel}</span>
                    {isBest && <span className="text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">BEST TAX</span>}
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase font-semibold">Lifetime Tax</p>
                      <p className={`text-lg font-bold ${c.text}`}>{fmt$(data.totalLifetimeTax)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-gray-400">Avg Rate</p>
                        <p className="font-semibold text-gray-700">{fmtPct(data.averageEffRate)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Wealth @ 90</p>
                        <p className="font-semibold text-gray-700">{fmt$(data.wealthAtAge90)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Final Wealth</p>
                        <p className="font-semibold text-gray-700">{fmt$(data.finalWealth)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Portfolio Lasts</p>
                        <p className={`font-semibold ${data.portfolioLasts ? "text-red-600" : "text-green-600"}`}>
                          {data.portfolioLasts ? `Age ${data.portfolioLasts}` : "Full life"}
                        </p>
                      </div>
                    </div>
                    {typeof data.taxSavingsVsWorst === "number" && data.taxSavingsVsWorst > 0 && (
                      <p className="text-[10px] text-green-600 font-semibold">
                        Saves {fmt$(data.taxSavingsVsWorst)} vs worst strategy
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Strategy Detail */}
          {(() => {
            const active = results[activeStrategy];
            const c = STRATEGY_COLORS[activeStrategy];
            return (
              <div className={`rounded-xl border ${c.border} ${c.bg} p-5`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`font-bold ${c.text}`}>{active.strategyLabel} — Detail</h3>
                  <div className="flex gap-2">
                    <button onClick={() => setShowChart(!showChart)}
                      className="text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                      {showChart ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Chart
                    </button>
                    <button onClick={() => setShowTable(!showTable)}
                      className="text-xs font-semibold text-gray-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg hover:bg-gray-50 flex items-center gap-1">
                      {showTable ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Year-by-Year
                    </button>
                  </div>
                </div>

                {/* Tax Impact Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {[
                    { label: "Total Lifetime Tax",   value: fmt$(active.totalLifetimeTax),   icon: <DollarSign className="w-4 h-4" /> },
                    { label: "Total After-Tax Income", value: fmt$(active.totalAfterTax),    icon: <DollarSign className="w-4 h-4" /> },
                    { label: "Average Effective Rate", value: fmtPct(active.averageEffRate), icon: <Percent className="w-4 h-4" />    },
                    { label: "Final Wealth",           value: fmt$(active.finalWealth),       icon: <TrendingDown className="w-4 h-4" /> },
                  ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl p-3 border border-white/60">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold">{card.label}</p>
                      <p className={`text-base font-bold mt-0.5 ${c.text}`}>{card.value}</p>
                    </div>
                  ))}
                </div>

                {/* Chart */}
                {showChart && (
                  <div className="bg-white rounded-xl p-4 border border-white/60 mb-4">
                    <div className="flex items-center gap-4 mb-2 text-[10px] text-gray-500">
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-500 inline-block"></span>RRSP/RRIF</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-teal-500 inline-block"></span>TFSA</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-1 border-t-2 border-dashed border-purple-500 inline-block"></span>Total</span>
                    </div>
                    <WealthChart data={active} />
                  </div>
                )}

                {/* Year-by-Year Table */}
                {showTable && (
                  <div className="bg-white rounded-xl border border-white/60 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          {["Age","Year","RRSP Bal","TFSA Bal","RRSP W/D","TFSA W/D","CPP","OAS","Total Income","Tax","Eff. Rate","After-Tax","Total Wealth"].map(h => (
                            <th key={h} className="px-2 py-2 text-left font-semibold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {active.years.map(y => (
                          <tr key={y.age} className={`hover:bg-gray-50 ${y.age === 71 ? "bg-yellow-50" : ""}`}>
                            <td className="px-2 py-1.5 font-semibold text-gray-700">{y.age}{y.age === 71 ? " ⚡" : ""}</td>
                            <td className="px-2 py-1.5 text-gray-500">{y.year}</td>
                            <td className="px-2 py-1.5">{fmt$(y.rrspBalance)}</td>
                            <td className="px-2 py-1.5">{fmt$(y.tfsaBalance)}</td>
                            <td className="px-2 py-1.5 text-blue-600">{fmt$(y.rrspWithdrawal)}</td>
                            <td className="px-2 py-1.5 text-teal-600">{fmt$(y.tfsaWithdrawal)}</td>
                            <td className="px-2 py-1.5 text-green-600">{fmt$(y.cppIncome)}</td>
                            <td className="px-2 py-1.5 text-green-600">{fmt$(y.oasIncome)}</td>
                            <td className="px-2 py-1.5 font-semibold">{fmt$(y.totalIncome)}</td>
                            <td className="px-2 py-1.5 text-red-500">{fmt$(y.totalTax)}</td>
                            <td className="px-2 py-1.5 text-orange-500">{fmtPct(y.effectiveRate)}</td>
                            <td className="px-2 py-1.5 text-green-700 font-semibold">{fmt$(y.afterTaxIncome)}</td>
                            <td className="px-2 py-1.5 font-bold">{fmt$(y.totalWealth)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-[9px] text-gray-400 px-3 py-2">⚡ Age 71 = RRIF conversion year (minimum withdrawals apply)</p>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Insights */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex gap-2 items-start">
              <Info className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-800 space-y-1">
                <p><strong>Blended Strategy</strong> typically saves the most tax by spreading RRSP withdrawals across lower brackets while using TFSA for tax-free top-ups.</p>
                <p><strong>TFSA First</strong> preserves TFSA tax-free growth but may trigger higher taxes later when RRIF minimums force large taxable withdrawals.</p>
                <p><strong>RRSP First</strong> depletes RRSP early, reducing OAS clawback risk for high-income retirees, but may waste TFSA tax-free growth potential.</p>
                <p className="text-amber-600">Results are projections only. Consult a tax advisor for personalized guidance.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

