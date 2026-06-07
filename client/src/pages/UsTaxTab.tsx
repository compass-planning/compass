/**
 * UsTaxTab.tsx
 * US Tax Planning tab for compass-planning.
 * Mirrors TaxTab (Canadian) in structure — same subtab pill nav,
 * same form/results layout, wired to /api/us-tax/:clientId/* endpoints.
 *
 * Subtabs:
 *   Planning Notes  → reuses TaxNotesPanel (shared, jurisdiction-agnostic)
 *   401(k) Room     → mirrors RRSP Room
 *   IRA / Roth      → mirrors TFSA Room
 *   Tax Projection  → US year-by-year engine
 *   Capital Gains   → LTCG / STCG / NIIT / step-up
 *   Social Security → mirrors CPP/OAS timing
 *   Roth Conversion → new; no Canadian equivalent
 */

import React, { useState } from "react";
import { UsRetirementPanel } from "../components/planning/UsRetirementPanel";
import {
  DollarSign, TrendingUp, TrendingDown, Calculator,
  PiggyBank, BarChart3, AlertTriangle, CheckCircle,
  ChevronDown, ChevronUp, Info, Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type UsSubTab =
  | "projection"
  | "401k"
  | "ira"
  | "capgains"
  | "ss"
  | "roth"
  | "retirement";

const US_SUBTABS: Array<{ key: UsSubTab; label: string }> = [
  { key: "projection", label: "Tax Projection"   },
  { key: "401k",       label: "401(k) Room"      },
  { key: "ira",        label: "IRA / Roth"       },
  { key: "capgains",   label: "Capital Gains"    },
  { key: "ss",         label: "Social Security"  },
  { key: "roth",       label: "Roth Conversion"  },
  { key: "retirement", label: "Retirement" },
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

// ── API helper ────────────────────────────────────────────────────────────────

async function usTaxApi(path: string, body: object): Promise<any> {
  const token = localStorage.getItem("fp_token");
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token ?? ""}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function fmt$(n: number) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Shared field components ───────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ResultCard({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string; tone?: "green" | "red" | "amber" | "blue" | "default";
}) {
  const colors = {
    green:   "text-green-700 bg-green-50 border-green-200",
    red:     "text-red-700 bg-red-50 border-red-200",
    amber:   "text-amber-700 bg-amber-50 border-amber-200",
    blue:    "text-blue-700 bg-blue-50 border-blue-200",
    default: "text-foreground bg-muted/30 border-border",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

function RunButton({ loading, onClick, label = "Calculate" }: {
  loading: boolean; onClick: () => void; label?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
      {loading ? "Calculating…" : label}
    </button>
  );
}

// ── 401(k) Room Panel ─────────────────────────────────────────────────────────

function Panel401k({ clientId, prefill }: { clientId: number; prefill?: any }) {
  const [form, setForm] = useState({
    age:                String(prefill?.age ?? "45"),
    currentBalance:     "0",
    contributionsMade:  "0",
    annualContribution: "23500",
    employerMatch:      "0",
    marginalRate:       "0.24",
    growthRate:         "0.07",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/401k-room`, {
        ...form,
        age: Number(form.age),
        currentBalance: Number(form.currentBalance),
        contributionsMade: Number(form.contributionsMade),
        annualContribution: Number(form.annualContribution),
        employerMatch: Number(form.employerMatch),
        marginalRate: Number(form.marginalRate),
        growthRate: Number(form.growthRate),
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Age"><Input value={form.age} onChange={set("age")} type="number" /></Field>
        <Field label="Current Balance"><Input value={form.currentBalance} onChange={set("currentBalance")} type="number" /></Field>
        <Field label="Contributions Made YTD"><Input value={form.contributionsMade} onChange={set("contributionsMade")} type="number" /></Field>
        <Field label="Annual Contribution Goal"><Input value={form.annualContribution} onChange={set("annualContribution")} type="number" /></Field>
        <Field label="Employer Match / Year"><Input value={form.employerMatch} onChange={set("employerMatch")} type="number" /></Field>
        <Field label="Marginal Tax Rate"><Input value={form.marginalRate} onChange={set("marginalRate")} placeholder="0.24" /></Field>
        <Field label="Expected Growth Rate"><Input value={form.growthRate} onChange={set("growthRate")} placeholder="0.07" /></Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} />

      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Employee Limit" value={fmt$(result.summary.employeeLimit)} tone="blue" />
            <ResultCard label="Catch-up Allowed" value={fmt$(result.summary.catchupAllowed)}
              sub={result.catchupEligibility.superCatchup ? "Super catch-up (age 60–63)" : result.catchupEligibility.age50Plus ? "Age 50+ catch-up" : "Not yet eligible"}
              tone={result.summary.catchupAllowed > 0 ? "green" : "default"} />
            <ResultCard label="Remaining Room" value={fmt$(result.summary.remainingRoom)} tone={result.summary.remainingRoom > 0 ? "amber" : "green"} />
            <ResultCard label="Annual Tax Saving" value={fmt$(result.summary.annualTaxSaving)} tone="green" />
          </div>

          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-semibold">30-Year Pre-Tax vs. Taxable Comparison</p>
            <div className="grid grid-cols-3 gap-3">
              <ResultCard label="Pre-Tax (401k)" value={fmt$(result.thirtyYearProjection.pretaxBalanceFinal)} tone="green" />
              <ResultCard label="Taxable Account" value={fmt$(result.thirtyYearProjection.taxableBalanceFinal)} />
              <ResultCard label="401(k) Advantage" value={fmt$(result.thirtyYearProjection.pretaxAdvantage)} tone="blue" />
            </div>
          </div>

          {result.catchupEligibility.superCatchup && (
            <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span><strong>SECURE 2.0 Super Catch-Up:</strong> Ages 60–63 can contribute an extra ${result.catchupEligibility.catchupAmount.toLocaleString()} above the standard catch-up. This window is limited — maximize contributions now.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── IRA / Roth Panel ──────────────────────────────────────────────────────────

function PanelIra({ clientId, prefill }: { clientId: number; prefill?: any }) {
  const [form, setForm] = useState({
    age:                 String(prefill?.age ?? "45"),
    filingStatus:        "single",
    magi:                String(prefill?.wagesIncome ?? "100000"),
    currentRothBalance:  "0",
    contributionsMade:   "0",
    annualContribution:  "7000",
    marginalRate:        "0.22",
    growthRate:          "0.07",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/ira-room`, {
        ...form,
        age: Number(form.age),
        magi: Number(form.magi),
        currentRothBalance: Number(form.currentRothBalance),
        contributionsMade: Number(form.contributionsMade),
        annualContribution: Number(form.annualContribution),
        marginalRate: Number(form.marginalRate),
        growthRate: Number(form.growthRate),
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Age"><Input value={form.age} onChange={set("age")} type="number" /></Field>
        <Field label="Filing Status">
          <Select value={form.filingStatus} onChange={set("filingStatus")} options={[
            { value: "single", label: "Single" },
            { value: "mfj", label: "Married Filing Jointly" },
            { value: "mfs", label: "Married Filing Separately" },
            { value: "hoh", label: "Head of Household" },
          ]} />
        </Field>
        <Field label="MAGI"><Input value={form.magi} onChange={set("magi")} type="number" /></Field>
        <Field label="Current Roth Balance"><Input value={form.currentRothBalance} onChange={set("currentRothBalance")} type="number" /></Field>
        <Field label="Contributions Made YTD"><Input value={form.contributionsMade} onChange={set("contributionsMade")} type="number" /></Field>
        <Field label="Annual Contribution Goal"><Input value={form.annualContribution} onChange={set("annualContribution")} type="number" /></Field>
        <Field label="Marginal Tax Rate"><Input value={form.marginalRate} onChange={set("marginalRate")} placeholder="0.22" /></Field>
        <Field label="Expected Growth Rate"><Input value={form.growthRate} onChange={set("growthRate")} placeholder="0.07" /></Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} />

      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="IRA Limit" value={fmt$(result.summary.totalLimit)} tone="blue" />
            <ResultCard label="Roth Allowed" value={fmt$(result.summary.rothContribAllowed)}
              tone={result.summary.rothContribAllowed > 0 ? "green" : "red"} />
            <ResultCard label="Remaining Room" value={fmt$(result.summary.remainingRoom)}
              tone={result.summary.remainingRoom > 0 ? "amber" : "green"} />
            <ResultCard label="Roth Eligibility"
              value={result.rothPhaseout.fullyEligible ? "Fully Eligible" : result.rothPhaseout.partiallyEligible ? "Partial" : "Ineligible"}
              sub={`MAGI: ${fmt$(result.rothPhaseout.currentMagi)}`}
              tone={result.rothPhaseout.fullyEligible ? "green" : result.rothPhaseout.partiallyEligible ? "amber" : "red"} />
          </div>

          {result.backdoorRoth.recommended && (
            <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-2">
              <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                <Info className="w-4 h-4" /> Backdoor Roth Recommended
              </p>
              <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                {result.backdoorRoth.steps.map((step: string, i: number) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
            <p className="text-sm font-semibold">30-Year Roth vs. Taxable Comparison</p>
            <div className="grid grid-cols-3 gap-3">
              <ResultCard label="Roth Balance" value={fmt$(result.thirtyYearProjection.rothBalanceFinal)} tone="green" />
              <ResultCard label="Taxable Account" value={fmt$(result.thirtyYearProjection.taxableBalanceFinal)} />
              <ResultCard label="Roth Advantage" value={fmt$(result.thirtyYearProjection.rothAdvantage)} tone="blue" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tax Projection Panel ──────────────────────────────────────────────────────

function PanelProjection({ clientId, prefill }: { clientId: number; prefill?: any }) {
  const [form, setForm] = useState({
    currentAge:              String(prefill?.age ?? "45"),
    retirementAge:           String(prefill?.retirementAge ?? "65"),
    planToAge:               "90",
    birthYear:               String(prefill?.birthYear ?? "1980"),
    filingStatus:            "single",
    usState:                 prefill?.usState ?? "CA",
    wagesIncome:             String(prefill?.wagesIncome ?? prefill?.annualIncome ?? "100000"),
    pretaxBalance:           String(prefill?.pretaxBalance ?? "0"),
    pretaxAnnualContrib:     String(prefill?.pretaxAnnualContrib ?? "23500"),
    employerMatch:           "0",
    rothBalance:             String(prefill?.rothBalance ?? "0"),
    rothAnnualContrib:       "7000",
    taxableBalance:          String(prefill?.taxableBalance ?? "0"),
    taxableGrowthRate:       "0.07",
    ssMonthlyBenefitAtFra:   "0",
    ssClaimAge:              "67",
    desiredRetirementIncome: String(prefill?.desiredRetirementIncome ?? "60000"),
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showTable, setShowTable] = useState(false);
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/us-projection`, {
        ...form,
        currentAge:              Number(form.currentAge),
        retirementAge:           Number(form.retirementAge),
        planToAge:               Number(form.planToAge),
        birthYear:               Number(form.birthYear),
        wagesIncome:             Number(form.wagesIncome),
        pretaxBalance:           Number(form.pretaxBalance),
        pretaxAnnualContrib:     Number(form.pretaxAnnualContrib),
        employerMatch:           Number(form.employerMatch),
        rothBalance:             Number(form.rothBalance),
        rothAnnualContrib:       Number(form.rothAnnualContrib),
        taxableBalance:          Number(form.taxableBalance),
        taxableGrowthRate:       Number(form.taxableGrowthRate),
        pretaxGrowthRate:        0.07,
        rothGrowthRate:          0.07,
        dividendYield:           0.02,
        ssMonthlyBenefitAtFra:   Number(form.ssMonthlyBenefitAtFra),
        ssClaimAge:              Number(form.ssClaimAge),
        pensionAnnualIncome:     0,
        pensionCola:             0.02,
        desiredRetirementIncome: Number(form.desiredRetirementIncome),
        retirementIncomeGrowth:  0.025,
        incomeGrowthRate:        0.03,
        tradIraBalance:          0,
        tradIraAnnualContrib:    0,
        taxableCostBasis:        0,
        taxableAnnualContrib:    0,
        hsaBalance:              0,
        hsaAnnualContrib:        0,
        hsaGrowthRate:           0.05,
        otherOrdinaryIncome:     0,
        qualifiedDividends:      0,
        ordinaryDividends:       0,
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Current Age"><Input value={form.currentAge} onChange={set("currentAge")} type="number" /></Field>
        <Field label="Retirement Age"><Input value={form.retirementAge} onChange={set("retirementAge")} type="number" /></Field>
        <Field label="Plan to Age"><Input value={form.planToAge} onChange={set("planToAge")} type="number" /></Field>
        <Field label="Birth Year"><Input value={form.birthYear} onChange={set("birthYear")} type="number" /></Field>
        <Field label="Filing Status">
          <Select value={form.filingStatus} onChange={set("filingStatus")} options={[
            { value: "single", label: "Single" },
            { value: "mfj",    label: "Married Filing Jointly" },
            { value: "mfs",    label: "Married Filing Separately" },
            { value: "hoh",    label: "Head of Household" },
          ]} />
        </Field>
        <Field label="State">
          <Select value={form.usState} onChange={set("usState")}
            options={US_STATES.map(s => ({ value: s, label: s }))} />
        </Field>
        <Field label="Annual Wages"><Input value={form.wagesIncome} onChange={set("wagesIncome")} type="number" /></Field>
        <Field label="Desired Retirement Income"><Input value={form.desiredRetirementIncome} onChange={set("desiredRetirementIncome")} type="number" /></Field>
        <Field label="Pre-Tax Balance (401k/IRA)"><Input value={form.pretaxBalance} onChange={set("pretaxBalance")} type="number" /></Field>
        <Field label="Annual Pre-Tax Contrib"><Input value={form.pretaxAnnualContrib} onChange={set("pretaxAnnualContrib")} type="number" /></Field>
        <Field label="Roth Balance"><Input value={form.rothBalance} onChange={set("rothBalance")} type="number" /></Field>
        <Field label="Annual Roth Contrib"><Input value={form.rothAnnualContrib} onChange={set("rothAnnualContrib")} type="number" /></Field>
        <Field label="Taxable Account Balance"><Input value={form.taxableBalance} onChange={set("taxableBalance")} type="number" /></Field>
        <Field label="SS Monthly Benefit at FRA"><Input value={form.ssMonthlyBenefitAtFra} onChange={set("ssMonthlyBenefitAtFra")} type="number" /></Field>
        <Field label="SS Claim Age"><Input value={form.ssClaimAge} onChange={set("ssClaimAge")} type="number" /></Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} />

      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Lifetime Tax" value={fmt$(result.summary.totalLifetimeTax)} tone="red" />
            <ResultCard label="Avg Effective Rate" value={pct(result.summary.averageEffectiveRate)} />
            <ResultCard label="Final Wealth" value={fmt$(result.summary.projectedFinalWealth)} tone="green" />
            <ResultCard label="Success Probability" value={pct(result.summary.successProbability)}
              tone={result.summary.successProbability >= 0.8 ? "green" : "amber"} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="RMD Starts" value={`Age ${result.summary.rmdStartAge}`}
              sub="IRS Uniform Lifetime Table" tone="blue" />
            <ResultCard label="SS Full Retirement Age" value={`${result.summary.ssFra}`} tone="blue" />
            {result.summary.conversionWindowYears > 0 && (
              <ResultCard label="Roth Window"
                value={`${result.summary.conversionWindowYears} yrs`}
                sub={`Ages ${result.summary.conversionWindowStart}–${result.summary.conversionWindowEnd}`}
                tone="amber" />
            )}
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setShowTable(t => !t)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold hover:bg-muted/40 transition"
            >
              <span>Year-by-Year Projection ({result.projections.length} years)</span>
              {showTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showTable && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr>
                      {["Year","Age","Phase","Wages","SS Benefit","RMD","Total AGI","Tax","Eff Rate","Marg Rate","Net Income","Total Wealth","Roth Window"].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.projections as any[]).map((row: any) => (
                      <tr key={row.year} className={`border-t border-border hover:bg-muted/20 ${row.inRothConversionWindow ? "bg-amber-50/40" : ""}`}>
                        <td className="px-3 py-1.5 font-medium">{row.year}</td>
                        <td className="px-3 py-1.5">{row.age}</td>
                        <td className="px-3 py-1.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${row.phase === "retirement" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {row.phase === "retirement" ? "Ret" : "Acc"}
                          </span>
                        </td>
                        <td className="px-3 py-1.5">{fmt$(row.wagesIncome)}</td>
                        <td className="px-3 py-1.5">{fmt$(row.ssBenefit)}</td>
                        <td className="px-3 py-1.5">{row.rmdRequired ? fmt$(row.rmdWithdrawal) : "—"}</td>
                        <td className="px-3 py-1.5 font-medium">{fmt$(row.totalAgi)}</td>
                        <td className="px-3 py-1.5 text-red-600">{fmt$(row.totalTax)}</td>
                        <td className="px-3 py-1.5">{pct(row.effectiveRate)}</td>
                        <td className="px-3 py-1.5">{pct(row.marginalRate)}</td>
                        <td className="px-3 py-1.5 text-green-600">{fmt$(row.netIncome)}</td>
                        <td className="px-3 py-1.5 font-semibold">{fmt$(row.totalWealth)}</td>
                        <td className="px-3 py-1.5">
                          {row.inRothConversionWindow && <span className="text-amber-600 font-semibold">✓</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Capital Gains Panel ───────────────────────────────────────────────────────

function PanelCapGains({ clientId, client }: { clientId: number; client?: any }) {
  const [filingStatus, setFilingStatus] = useState("single");
  const [usState, setUsState] = useState(client?.usState ?? "CA");
  const [ordinaryIncome, setOrdinaryIncome] = useState("100000");
  const [positions, setPositions] = useState([
    { name: "", fmv: "", costBasis: "", isLongTerm: true },
  ]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const addRow = () => setPositions(p => [...p, { name: "", fmv: "", costBasis: "", isLongTerm: true }]);
  const updateRow = (i: number, k: string, v: any) => setPositions(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const removeRow = (i: number) => setPositions(p => p.filter((_, idx) => idx !== i));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/us-capital-gains`, {
        positions: positions.map(p => ({
          name: p.name,
          fmv: Number(p.fmv),
          costBasis: Number(p.costBasis),
          isLongTerm: p.isLongTerm,
        })),
        ordinaryIncome: Number(ordinaryIncome),
        filingStatus,
        usState,
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Filing Status">
          <Select value={filingStatus} onChange={setFilingStatus} options={[
            { value: "single", label: "Single" },
            { value: "mfj",    label: "Married Filing Jointly" },
            { value: "mfs",    label: "Married Filing Separately" },
            { value: "hoh",    label: "Head of Household" },
          ]} />
        </Field>
        <Field label="State">
          <Select value={usState} onChange={setUsState}
            options={US_STATES.map(s => ({ value: s, label: s }))} />
        </Field>
        <Field label="Other Ordinary Income"><Input value={ordinaryIncome} onChange={setOrdinaryIncome} type="number" /></Field>
      </div>

      {/* Positions table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="bg-muted/40 px-4 py-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Holdings</p>
          <button onClick={addRow} className="text-xs text-primary hover:underline font-semibold">+ Add Position</button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/20">
            <tr>
              {["Name / Ticker", "FMV", "Cost Basis", "Term", ""].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p, i) => (
              <tr key={i} className="border-t border-border">
                <td className="px-3 py-2"><input value={p.name} onChange={e => updateRow(i, "name", e.target.value)} className="w-full text-sm border border-border rounded-lg px-2 py-1" placeholder="AAPL" /></td>
                <td className="px-3 py-2"><input value={p.fmv} onChange={e => updateRow(i, "fmv", e.target.value)} type="number" className="w-28 text-sm border border-border rounded-lg px-2 py-1" /></td>
                <td className="px-3 py-2"><input value={p.costBasis} onChange={e => updateRow(i, "costBasis", e.target.value)} type="number" className="w-28 text-sm border border-border rounded-lg px-2 py-1" /></td>
                <td className="px-3 py-2">
                  <select value={p.isLongTerm ? "lt" : "st"} onChange={e => updateRow(i, "isLongTerm", e.target.value === "lt")}
                    className="text-sm border border-border rounded-lg px-2 py-1">
                    <option value="lt">Long-term</option>
                    <option value="st">Short-term</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  {positions.length > 1 && (
                    <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-destructive text-xs">✕</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} />

      {result && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Unrealized LTCG" value={fmt$(result.totalUnrealizedLtcg)} tone="blue" />
            <ResultCard label="Unrealized STCG" value={fmt$(result.totalUnrealizedStcg)} tone="amber" />
            <ResultCard label="Unrealized Losses" value={fmt$(result.totalUnrealizedLoss)} tone="green"
              sub="Available to harvest" />
          </div>

          {result.stepUpOpportunity && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
              <strong>Step-Up in Basis:</strong> {result.stepUpOpportunity}
            </div>
          )}

          <div className="border border-border rounded-xl overflow-hidden">
            <p className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Realization Scenarios</p>
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr>
                  {["Scenario","Amount","LTCG Tax","NIIT","State Tax","Total Tax","Net Proceeds","Effective Rate"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.scenarios as any[]).map((s: any) => (
                  <tr key={s.name} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{s.name}</td>
                    <td className="px-3 py-2">{fmt$(s.amountRealized)}</td>
                    <td className="px-3 py-2 text-red-600">{fmt$(s.ltcgTax)}</td>
                    <td className="px-3 py-2 text-red-600">{fmt$(s.niit)}</td>
                    <td className="px-3 py-2 text-red-600">{fmt$(s.stateTax)}</td>
                    <td className="px-3 py-2 font-semibold text-red-700">{fmt$(s.totalTax)}</td>
                    <td className="px-3 py-2 text-green-600 font-semibold">{fmt$(s.netProceeds)}</td>
                    <td className="px-3 py-2">{pct(s.effectiveTaxRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.rothConversionInterplay && (
            <p className="text-xs text-muted-foreground p-3 bg-muted/20 rounded-xl">{result.rothConversionInterplay}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Social Security Panel ─────────────────────────────────────────────────────

function PanelSS({ clientId, prefill }: { clientId: number; prefill?: any }) {
  const [form, setForm] = useState({
    birthYear:                   String(prefill?.birthYear ?? "1960"),
    ssMonthlyBenefitAtFra:       "0",
    filingStatus:                "single",
    provisionalIncomeAtRetirement: "0",
    hasSpouse:                   false,
    spousePia:                   "0",
    spouseBirthYear:             String(prefill?.spouseBirthYear ?? "1962"),
    age:                         String(prefill?.age ?? "55"),
    spouseAge:                   "55",
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (v: string | boolean) => setForm(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/ss-timing`, {
        ...form,
        birthYear: Number(form.birthYear),
        ssMonthlyBenefitAtFra: Number(form.ssMonthlyBenefitAtFra),
        provisionalIncomeAtRetirement: Number(form.provisionalIncomeAtRetirement),
        spousePia: Number(form.spousePia),
        spouseBirthYear: Number(form.spouseBirthYear),
        age: Number(form.age),
        spouseAge: Number(form.spouseAge),
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Birth Year"><Input value={form.birthYear} onChange={set("birthYear")} type="number" /></Field>
        <Field label="SS Monthly Benefit at FRA (PIA)"><Input value={form.ssMonthlyBenefitAtFra} onChange={set("ssMonthlyBenefitAtFra")} type="number" /></Field>
        <Field label="Filing Status">
          <Select value={form.filingStatus} onChange={set("filingStatus")} options={[
            { value: "single", label: "Single" },
            { value: "mfj",    label: "Married" },
          ]} />
        </Field>
        <Field label="Provisional Income at Retirement"><Input value={form.provisionalIncomeAtRetirement} onChange={set("provisionalIncomeAtRetirement")} type="number" /></Field>
      </div>

      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={form.hasSpouse} onChange={e => set("hasSpouse")(e.target.checked)}
          className="rounded" />
        Include Spouse Analysis
      </label>

      {form.hasSpouse && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 border border-border rounded-xl bg-muted/20">
          <Field label="Spouse PIA (monthly)"><Input value={form.spousePia} onChange={set("spousePia")} type="number" /></Field>
          <Field label="Spouse Birth Year"><Input value={form.spouseBirthYear} onChange={set("spouseBirthYear")} type="number" /></Field>
          <Field label="Your Age"><Input value={form.age} onChange={set("age")} type="number" /></Field>
          <Field label="Spouse Age"><Input value={form.spouseAge} onChange={set("spouseAge")} type="number" /></Field>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} label="Analyze Timing" />

      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <ResultCard label="PIA (monthly)" value={fmt$(result.pia)} tone="blue" />
            <ResultCard label="Full Retirement Age" value={`${result.fra}`} tone="blue" />
            <ResultCard label="Recommended Age" value={`${result.recommendedAge}`} tone="green"
              sub="Based on your profile" />
          </div>

          <p className="text-sm text-muted-foreground p-3 bg-muted/20 rounded-xl">{result.recommendedReasoning}</p>

          <div className="border border-border rounded-xl overflow-hidden">
            <p className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Claiming Age Comparison</p>
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr>
                  {["Age","Monthly Benefit","Annual","Adjustment","Lifetime to 85","Lifetime to 90","Break-Even vs Prior"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.options as any[]).map((o: any) => (
                  <tr key={o.claimAge} className={`border-t border-border hover:bg-muted/20 ${o.claimAge === result.recommendedAge ? "bg-green-50/50 font-semibold" : ""}`}>
                    <td className="px-3 py-2">
                      {o.claimAge}
                      {o.claimAge === result.fra && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1 rounded">FRA</span>}
                      {o.claimAge === result.recommendedAge && <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">Rec</span>}
                    </td>
                    <td className="px-3 py-2">{fmt$(o.monthlyBenefit)}</td>
                    <td className="px-3 py-2">{fmt$(o.annualBenefit)}</td>
                    <td className="px-3 py-2 text-xs">{o.adjustmentLabel}</td>
                    <td className="px-3 py-2">{fmt$(o.lifetimeBenefitTo85)}</td>
                    <td className="px-3 py-2">{fmt$(o.lifetimeBenefitTo90)}</td>
                    <td className="px-3 py-2">{o.breakEvenVsPriorAge ? `Age ${o.breakEvenVsPriorAge}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.spouseAnalysis && (
            <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
              <p className="text-sm font-semibold">Spousal Benefit Strategy</p>
              <div className="grid grid-cols-3 gap-3">
                <ResultCard label="Spouse Own Benefit" value={fmt$(result.spouseAnalysis.spouseOwnBenefit)} sub="Annual" />
                <ResultCard label="Spousal Benefit" value={fmt$(result.spouseAnalysis.spousalBenefit)} sub="Annual (50% of higher PIA)" tone="blue" />
                <ResultCard label="Survivor Benefit" value={fmt$(result.spouseAnalysis.survivorBenefit)} sub="Annual at higher earner age 70" tone="green" />
              </div>
              <p className="text-sm text-muted-foreground">{result.spouseAnalysis.recommendedStrategy}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Roth Conversion Panel ─────────────────────────────────────────────────────

function PanelRothConversion({ clientId, prefill }: { clientId: number; prefill?: any }) {
  const [form, setForm] = useState({
    currentAge:       String(prefill?.age ?? "55"),
    birthYear:        String(prefill?.birthYear ?? "1970"),
    retirementAge:    String(prefill?.retirementAge ?? "65"),
    ssClaimAge:       "67",
    filingStatus:     "single",
    usState:          prefill?.usState ?? "CA",
    tradIraBalance:   "0",
    rothBalance:      "0",
    ordinaryIncome:   String(prefill?.wagesIncome ?? "80000"),
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/roth-conversion`, {
        ...form,
        currentAge:    Number(form.currentAge),
        birthYear:     Number(form.birthYear),
        retirementAge: Number(form.retirementAge),
        ssClaimAge:    Number(form.ssClaimAge),
        tradIraBalance: Number(form.tradIraBalance),
        rothBalance:   Number(form.rothBalance),
        ordinaryIncome: Number(form.ordinaryIncome),
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Current Age"><Input value={form.currentAge} onChange={set("currentAge")} type="number" /></Field>
        <Field label="Birth Year"><Input value={form.birthYear} onChange={set("birthYear")} type="number" /></Field>
        <Field label="Retirement Age"><Input value={form.retirementAge} onChange={set("retirementAge")} type="number" /></Field>
        <Field label="SS Claim Age"><Input value={form.ssClaimAge} onChange={set("ssClaimAge")} type="number" /></Field>
        <Field label="Filing Status">
          <Select value={form.filingStatus} onChange={set("filingStatus")} options={[
            { value: "single", label: "Single" },
            { value: "mfj",    label: "Married Filing Jointly" },
            { value: "mfs",    label: "Married Filing Separately" },
            { value: "hoh",    label: "Head of Household" },
          ]} />
        </Field>
        <Field label="State">
          <Select value={form.usState} onChange={set("usState")}
            options={US_STATES.map(s => ({ value: s, label: s }))} />
        </Field>
        <Field label="Traditional IRA / 401k Balance"><Input value={form.tradIraBalance} onChange={set("tradIraBalance")} type="number" /></Field>
        <Field label="Current Roth Balance"><Input value={form.rothBalance} onChange={set("rothBalance")} type="number" /></Field>
        <Field label="Current Ordinary Income"><Input value={form.ordinaryIncome} onChange={set("ordinaryIncome")} type="number" /></Field>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <RunButton loading={loading} onClick={run} label="Analyze Conversion" />

      {result && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ResultCard label="Conversion Window" value={`${result.yearsInConversionWindow} yrs`}
              tone={result.yearsInConversionWindow > 0 ? "green" : "amber"} />
            <ResultCard label="RMD Starts" value={`Age ${result.rmdStartAge}`} tone="blue" />
            <ResultCard label="Recommended Annual" value={fmt$(result.recommendedAnnualConversion)}
              sub="Fill current bracket" tone="green" />
          </div>

          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
            {result.reasoning}
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <p className="px-4 py-2 bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conversion Scenarios</p>
            <table className="w-full text-sm">
              <thead className="bg-muted/20">
                <tr>
                  {["Scenario","Amount","Additional Tax","Marginal Rate","Lifetime Savings","Break-Even"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(result.scenarios as any[]).map((s: any) => (
                  <tr key={s.label} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{s.label}</td>
                    <td className="px-3 py-2">{fmt$(s.conversionAmount)}</td>
                    <td className="px-3 py-2 text-red-600">{fmt$(s.additionalTax)}</td>
                    <td className="px-3 py-2">{pct(s.marginalRateOnConversion)}</td>
                    <td className="px-3 py-2">
                      <span className={s.netTaxSavingsLifetime > 0 ? "text-green-600 font-semibold" : "text-red-600"}>
                        {s.netTaxSavingsLifetime > 0 ? "+" : ""}{fmt$(s.netTaxSavingsLifetime)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {s.breakEvenYears >= 40 ? "40+ yrs" : `${s.breakEvenYears} yrs`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main UsTaxTab component ───────────────────────────────────────────────────

export function UsTaxTab({
  clientId,
  client,
}: {
  clientId: number;
  client?: any;
}) {
  const [activeSubTab, setActiveSubTab] = useState<UsSubTab>("projection");

  // Build prefill from client record
  const dob      = client?.dateOfBirth;
  const age      = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 45;
  const birthYear = dob ? new Date(dob).getFullYear() : new Date().getFullYear() - age;

  const prefill = {
    age:                     age,
    birthYear:               birthYear,
    retirementAge:           client?.retirementAge ?? 65,
    annualIncome:            Number(client?.annualIncome ?? 0),
    wagesIncome:             Number(client?.annualIncome ?? 0),
    desiredRetirementIncome: Number(client?.desiredRetirementIncome ?? 0),
    usState:                 client?.usState ?? "CA",
    filingStatus:            client?.filingStatus ?? "single",
    spouseBirthYear:         client?.spouseDateOfBirth
      ? new Date(client.spouseDateOfBirth).getFullYear()
      : birthYear - 2,
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300 px-1">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h2 className="text-xl font-display font-bold">US Tax Planning</h2>
        <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
          {client?.usState ?? "US"} — {client?.filingStatus ?? "single"}
        </span>
      </div>

      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl overflow-x-auto flex-wrap">
        {US_SUBTABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveSubTab(t.key)}
            className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
              activeSubTab === t.key
                ? "bg-white text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="animate-in fade-in duration-200">
        {activeSubTab === "projection" && <PanelProjection  clientId={clientId} prefill={prefill} />}
        {activeSubTab === "401k"       && <Panel401k        clientId={clientId} prefill={prefill} />}
        {activeSubTab === "ira"        && <PanelIra         clientId={clientId} prefill={prefill} />}
        {activeSubTab === "capgains"   && <PanelCapGains    clientId={clientId} client={client} />}
        {activeSubTab === "ss"         && <PanelSS          clientId={clientId} prefill={prefill} />}
        {activeSubTab === "roth"       && <PanelRothConversion clientId={clientId} prefill={prefill} />}
        {activeSubTab === "retirement" && <UsRetirementPanel clientId={clientId} client={client} />}
      </div>
    </div>
  );
}
