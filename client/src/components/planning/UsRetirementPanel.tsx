/**
 * UsRetirementPanel.tsx
 * US Retirement Monte Carlo projection panel.
 * Mirrors RetirementProjectionForm.tsx (Canadian) in structure.
 *
 * Features:
 *   - 401k / Roth / Taxable account inputs
 *   - Social Security timing (PIA + claim age)
 *   - Monte Carlo success rate with percentile bands
 *   - RMD start age (SECURE 2.0 aware)
 *   - Couple support
 *   - Saves to retirement_projections table
 */

import { useState, useMemo } from "react";
import {
  TrendingUp, DollarSign, PiggyBank, Calculator,
  AlertTriangle, CheckCircle, ChevronDown, ChevronUp,
  Loader2, Save, Info,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsProjectionResult {
  successRate:             number;
  medianBalance:           number;
  shortfallSurplus:        number;
  medianFinalWealth:       number;
  p10FinalWealth:          number;
  p25FinalWealth:          number;
  p75FinalWealth:          number;
  p90FinalWealth:          number;
  medianAnnualTax:         number;
  medianEffectiveRate:     number;
  rmdStartAge:             number;
  ssFra:                   number;
  ssAnnualBenefit:         number;
  totalGovBenefitAnnual:   number;
  percentileBands: {
    p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[];
  };
}

interface Props {
  clientId:   number;
  client?:    any;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
const pct   = (n: number) => `${(n * 100).toFixed(1)}%`;

async function usTaxApi(path: string, body: object) {
  const token = localStorage.getItem("fp_token");
  const res   = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

function Field({ label, children, tip }: { label: string; children: React.ReactNode; tip?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-muted-foreground mb-1">
        {label}
        {tip && <span className="ml-1 text-[10px] text-muted-foreground/60 font-normal">({tip})</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", placeholder = "" }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary" />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function StatCard({ label, value, sub, tone = "default" }: {
  label: string; value: string; sub?: string;
  tone?: "green" | "red" | "amber" | "blue" | "default";
}) {
  const colors = {
    green:   "bg-green-50 border-green-200 text-green-700",
    red:     "bg-red-50 border-red-200 text-red-700",
    amber:   "bg-amber-50 border-amber-200 text-amber-700",
    blue:    "bg-blue-50 border-blue-200 text-blue-700",
    default: "bg-muted/30 border-border text-foreground",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-70">{sub}</p>}
    </div>
  );
}

// ── Inline mini chart (SVG percentile fan) ────────────────────────────────────

function PercentileFan({ bands, yearsToProject }: {
  bands: UsProjectionResult["percentileBands"];
  yearsToProject: number;
}) {
  const W = 500, H = 200, PAD = 40;
  const years = bands.p50.length;
  if (years === 0) return null;

  const allVals = [...bands.p10, ...bands.p90].filter(v => v >= 0);
  const maxVal  = Math.max(...allVals, 1);
  const minVal  = 0;

  const xScale = (i: number) => PAD + (i / (years - 1)) * (W - PAD * 2);
  const yScale = (v: number) => H - PAD - ((v - minVal) / (maxVal - minVal)) * (H - PAD * 2);

  const pathD = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(" ");

  const areaD = (top: number[], bot: number[]) => {
    const fwd = top.map((v, i) => `${i === 0 ? "M" : "L"}${xScale(i).toFixed(1)},${yScale(v).toFixed(1)}`).join(" ");
    const bck = [...bot].reverse().map((v, i) => `L${xScale(bot.length - 1 - i).toFixed(1)},${yScale(v).toFixed(1)}`).join(" ");
    return `${fwd} ${bck} Z`;
  };

  // Y-axis labels
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    val: minVal + t * (maxVal - minVal),
    y:   yScale(minVal + t * (maxVal - minVal)),
  }));

  const fmtM = (v: number) => v >= 1_000_000 ? `$${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `$${Math.round(v / 1000)}K` : `$${Math.round(v)}`;

  return (
    <div className="border border-border rounded-xl p-4 bg-white">
      <p className="text-sm font-semibold mb-3">Portfolio Projection — Percentile Fan</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 200 }}>
        {/* Bands */}
        <path d={areaD(bands.p90, bands.p10)} fill="rgba(59,130,246,0.08)" />
        <path d={areaD(bands.p75, bands.p25)} fill="rgba(59,130,246,0.15)" />
        {/* Lines */}
        <path d={pathD(bands.p90)} fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1" strokeDasharray="4 2" />
        <path d={pathD(bands.p10)} fill="none" stroke="rgba(239,68,68,0.4)"  strokeWidth="1" strokeDasharray="4 2" />
        <path d={pathD(bands.p75)} fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" />
        <path d={pathD(bands.p25)} fill="none" stroke="rgba(59,130,246,0.6)" strokeWidth="1.5" />
        <path d={pathD(bands.p50)} fill="none" stroke="rgb(37,99,235)"       strokeWidth="2.5" />
        {/* Y-axis */}
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD - 4} y1={t.y} x2={W - PAD + 4} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{fmtM(t.val)}</text>
          </g>
        ))}
        {/* X-axis labels */}
        {[0, Math.floor(years / 4), Math.floor(years / 2), Math.floor(years * 3 / 4), years - 1].map(i => (
          <text key={i} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize="9" fill="#94a3b8">
            Yr {i}
          </text>
        ))}
      </svg>
      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-600 inline-block" />Median</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 bg-blue-300 inline-block" />25th–75th %ile</span>
        <span className="flex items-center gap-1"><span className="w-4 h-0.5 border-t border-dashed border-blue-300 inline-block" />10th–90th %ile</span>
      </div>
    </div>
  );
}

// ── Client-side deterministic preview (before Monte Carlo) ────────────────────

function calcPreview(f: ReturnType<typeof buildDefaults>) {
  const age     = +f.currentAge    || 45;
  const ret     = +f.retirementAge || 65;
  const life    = +f.lifeExpectancy|| 90;
  const pretax  = +f.pretaxBalance || 0;
  const roth    = +f.rothBalance   || 0;
  const taxable = +f.taxableBalance|| 0;
  const contrib = (+f.annualPretaxContrib || 0) + (+f.annualRothContrib || 0) + (+f.employerMatch || 0);
  const rate    = (+f.expectedReturn || 7) / 100;
  const infl    = (+f.inflationRate  || 2.5) / 100;
  const desired = +f.desiredRetirementIncome || 0;
  const ss      = +f.ssMonthlyAtFra || 0;
  const pension = +f.pensionIncome  || 0;

  const yToRet = Math.max(0, ret - age);
  const yInRet = Math.max(1, life - ret);

  let total = pretax + roth + taxable;
  for (let i = 0; i < yToRet; i++) total = (total + contrib) * (1 + rate);

  const ssAnnual = ss * 12;
  const govIncome = ssAnnual + pension;
  const desiredAtRet = desired * Math.pow(1 + infl, yToRet);
  const withdrawal = Math.max(0, desiredAtRet - govIncome);

  const realRate = rate - infl;
  const swr = realRate > 0 && total > 0
    ? total * realRate / (1 - Math.pow(1 + realRate, -yInRet))
    : total / Math.max(1, yInRet);

  const funded = desired > 0 ? Math.min(100, Math.round(swr / Math.max(1, withdrawal) * 100)) : 100;

  return {
    projectedTotal: Math.round(total),
    swr:            Math.round(swr),
    surplus:        Math.round(swr - withdrawal),
    funded,
    govIncome:      Math.round(govIncome),
    ssAnnual,
  };
}

// ── Default form builder ──────────────────────────────────────────────────────

function buildDefaults(client?: any) {
  const dob     = client?.dateOfBirth;
  const age     = dob ? new Date().getFullYear() - new Date(dob).getFullYear() : 45;
  const birthYr = dob ? new Date(dob).getFullYear() : new Date().getFullYear() - age;
  return {
    currentAge:              String(age),
    retirementAge:           String(client?.retirementAge ?? 65),
    lifeExpectancy:          "90",
    birthYear:               String(birthYr),
    filingStatus:            client?.filingStatus ?? "single",
    usState:                 client?.usState ?? "CA",
    pretaxBalance:           "",
    rothBalance:             "",
    taxableBalance:          "",
    annualPretaxContrib:     "23500",
    annualRothContrib:       "7000",
    annualTaxableContrib:    "0",
    employerMatch:           "0",
    currentIncome:           String(+client?.annualIncome || 0),
    desiredRetirementIncome: String(+client?.desiredRetirementIncome || 0),
    pensionIncome:           "0",
    pensionCola:             "2.0",
    ssMonthlyAtFra:          "0",
    ssClaimAge:              "67",
    expectedReturn:          "7.0",
    stdDev:                  "10.0",
    inflationRate:           "2.5",
    equityAllocation:        "60",
    isCouple:                String(!!client?.spouseFirstName),
    spouseAge:               "",
    spouseBirthYear:         "",
    spouseRetirementAge:     "65",
    spousePretaxBalance:     "",
    spouseRothBalance:       "",
    spouseSsMonthlyAtFra:    "",
    spouseSsClaimAge:        "67",
    simulations:             "1000",
    notes:                   "",
  };
}

const US_STATES = ["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC",
  "ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"];

// ── Main Component ────────────────────────────────────────────────────────────

export function UsRetirementPanel({ clientId, client }: Props) {
  const [form, setForm]       = useState(() => buildDefaults(client));
  const [result, setResult]   = useState<UsProjectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [showAdv, setShowAdv] = useState(false);
  const [showCouple, setShowCouple] = useState(!!client?.spouseFirstName);

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const preview = useMemo(() => calcPreview(form), [form]);

  const run = async () => {
    setLoading(true); setError("");
    try {
      const data = await usTaxApi(`/api/us-tax/${clientId}/us-retirement`, {
        currentAge:              +form.currentAge,
        retirementAge:           +form.retirementAge,
        lifeExpectancy:          +form.lifeExpectancy,
        birthYear:               +form.birthYear,
        filingStatus:             form.filingStatus,
        usState:                  form.usState,
        pretaxBalance:           +form.pretaxBalance   || 0,
        rothBalance:             +form.rothBalance     || 0,
        taxableBalance:          +form.taxableBalance  || 0,
        annualPretaxContrib:     +form.annualPretaxContrib  || 0,
        annualRothContrib:       +form.annualRothContrib    || 0,
        annualTaxableContrib:    +form.annualTaxableContrib || 0,
        employerMatch:           +form.employerMatch   || 0,
        currentIncome:           +form.currentIncome   || 0,
        desiredRetirementIncome: +form.desiredRetirementIncome || 0,
        pensionIncome:           +form.pensionIncome   || 0,
        pensionCola:             +form.pensionCola / 100,
        ssMonthlyAtFra:          +form.ssMonthlyAtFra  || 0,
        ssClaimAge:              +form.ssClaimAge,
        expectedReturn:          +form.expectedReturn  / 100,
        stdDev:                  +form.stdDev          / 100,
        inflationRate:           +form.inflationRate   / 100,
        equityAllocation:        +form.equityAllocation / 100,
        isCouple:                showCouple,
        ...(showCouple && {
          spouseAge:           +form.spouseAge        || undefined,
          spouseBirthYear:     +form.spouseBirthYear  || undefined,
          spouseRetirementAge: +form.spouseRetirementAge || undefined,
          spousePretaxBalance: +form.spousePretaxBalance || undefined,
          spouseRothBalance:   +form.spouseRothBalance   || undefined,
          spouseSsMonthlyAtFra:+form.spouseSsMonthlyAtFra|| undefined,
          spouseSsClaimAge:    +form.spouseSsClaimAge    || undefined,
        }),
        simulations: +form.simulations || 1000,
      });
      setResult(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await fetch(`/api/clients/${clientId}/retirement`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}` },
        body: JSON.stringify({
          person:                  "primary",
          label:                   `US Retirement — ${new Date().toLocaleDateString()}`,
          currentAge:              +form.currentAge,
          retirementAge:           +form.retirementAge,
          lifeExpectancy:          +form.lifeExpectancy,
          currentSavings:          String((+form.pretaxBalance||0) + (+form.rothBalance||0) + (+form.taxableBalance||0)),
          annualContribution:      form.annualPretaxContrib,
          expectedReturn:          String(+form.expectedReturn / 100),
          inflationRate:           String(+form.inflationRate  / 100),
          desiredRetirementIncome: form.desiredRetirementIncome,
          pensionIncome:           form.pensionIncome,
          successRate:             String(result.successRate),
          projectedBalance:        String(result.medianBalance),
          shortfallSurplus:        String(result.shortfallSurplus),
          notes:                   form.notes || `US Monte Carlo — SS $${Math.round(+form.ssMonthlyAtFra)}/mo at FRA, claim age ${form.ssClaimAge}. RMD starts age ${result.rmdStartAge}.`,
        }),
      });
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const successColor = (r: number) =>
    r >= 80 ? "green" : r >= 60 ? "amber" : "red";

  const yearsToProject = Math.max(0, +form.lifeExpectancy - +form.currentAge);

  return (
    <div className="space-y-6">

      {/* ── Live preview strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Projected at Retirement" value={fmt$(preview.projectedTotal)} tone="blue" />
        <StatCard label="Sustainable Withdrawal" value={fmt$(preview.swr)} sub="per year (real rate)" />
        <StatCard label="Gov. Income (SS + Pension)" value={fmt$(preview.govIncome)} sub="annual" tone="blue" />
        <StatCard
          label="Pre-Monte Carlo Funded"
          value={`${preview.funded}%`}
          tone={preview.funded >= 90 ? "green" : preview.funded >= 70 ? "amber" : "red"}
        />
      </div>

      {/* ── Demographics ── */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Demographics & Goal</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Current Age">
            <Input value={form.currentAge} onChange={set("currentAge")} type="number" />
          </Field>
          <Field label="Retirement Age">
            <Input value={form.retirementAge} onChange={set("retirementAge")} type="number" />
          </Field>
          <Field label="Life Expectancy">
            <Input value={form.lifeExpectancy} onChange={set("lifeExpectancy")} type="number" />
          </Field>
          <Field label="Birth Year">
            <Input value={form.birthYear} onChange={set("birthYear")} type="number" />
          </Field>
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
          <Field label="Desired Retirement Income" tip="today's $">
            <Input value={form.desiredRetirementIncome} onChange={set("desiredRetirementIncome")} type="number" />
          </Field>
          <Field label="Current Income">
            <Input value={form.currentIncome} onChange={set("currentIncome")} type="number" />
          </Field>
        </div>
      </div>

      {/* ── Account Balances ── */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Account Balances (Today)</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Pre-Tax Balance" tip="401k + IRA">
            <Input value={form.pretaxBalance} onChange={set("pretaxBalance")} type="number" placeholder="0" />
          </Field>
          <Field label="Roth Balance" tip="Roth 401k + Roth IRA">
            <Input value={form.rothBalance} onChange={set("rothBalance")} type="number" placeholder="0" />
          </Field>
          <Field label="Taxable / Brokerage">
            <Input value={form.taxableBalance} onChange={set("taxableBalance")} type="number" placeholder="0" />
          </Field>
        </div>
        <p className="text-sm font-semibold pt-1">Annual Contributions</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Pre-Tax Contrib" tip="401k/403b">
            <Input value={form.annualPretaxContrib} onChange={set("annualPretaxContrib")} type="number" />
          </Field>
          <Field label="Employer Match">
            <Input value={form.employerMatch} onChange={set("employerMatch")} type="number" />
          </Field>
          <Field label="Roth Contrib" tip="IRA/Roth 401k">
            <Input value={form.annualRothContrib} onChange={set("annualRothContrib")} type="number" />
          </Field>
          <Field label="Taxable Contrib">
            <Input value={form.annualTaxableContrib} onChange={set("annualTaxableContrib")} type="number" />
          </Field>
        </div>
      </div>

      {/* ── Social Security ── */}
      <div className="border border-border rounded-xl p-4 space-y-4">
        <p className="text-sm font-semibold">Social Security & Pension</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="SS Monthly at FRA (PIA)" tip="from SSA.gov">
            <Input value={form.ssMonthlyAtFra} onChange={set("ssMonthlyAtFra")} type="number" placeholder="0" />
          </Field>
          <Field label="Planned Claim Age" tip="62–70">
            <Input value={form.ssClaimAge} onChange={set("ssClaimAge")} type="number" />
          </Field>
          <Field label="Pension Income" tip="annual DB pension">
            <Input value={form.pensionIncome} onChange={set("pensionIncome")} type="number" placeholder="0" />
          </Field>
          <Field label="Pension COLA %" tip="annual increase">
            <Input value={form.pensionCola} onChange={set("pensionCola")} type="number" placeholder="2.0" />
          </Field>
        </div>
      </div>

      {/* ── Couple toggle ── */}
      <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
        <input type="checkbox" checked={showCouple} onChange={e => setShowCouple(e.target.checked)}
          className="rounded" />
        Include Spouse
      </label>

      {showCouple && (
        <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
          <p className="text-sm font-semibold">Spouse Details</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Spouse Age"><Input value={form.spouseAge} onChange={set("spouseAge")} type="number" /></Field>
            <Field label="Spouse Birth Year"><Input value={form.spouseBirthYear} onChange={set("spouseBirthYear")} type="number" /></Field>
            <Field label="Spouse Retirement Age"><Input value={form.spouseRetirementAge} onChange={set("spouseRetirementAge")} type="number" /></Field>
            <Field label="Spouse Pre-Tax Balance"><Input value={form.spousePretaxBalance} onChange={set("spousePretaxBalance")} type="number" /></Field>
            <Field label="Spouse Roth Balance"><Input value={form.spouseRothBalance} onChange={set("spouseRothBalance")} type="number" /></Field>
            <Field label="Spouse SS Monthly at FRA"><Input value={form.spouseSsMonthlyAtFra} onChange={set("spouseSsMonthlyAtFra")} type="number" /></Field>
            <Field label="Spouse SS Claim Age"><Input value={form.spouseSsClaimAge} onChange={set("spouseSsClaimAge")} type="number" /></Field>
          </div>
        </div>
      )}

      {/* ── Advanced assumptions ── */}
      <button onClick={() => setShowAdv(a => !a)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
        {showAdv ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        Advanced Assumptions
      </button>

      {showAdv && (
        <div className="border border-border rounded-xl p-4 bg-muted/20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="Expected Return %" tip="nominal annual">
              <Input value={form.expectedReturn} onChange={set("expectedReturn")} type="number" placeholder="7.0" />
            </Field>
            <Field label="Std Deviation %" tip="annual volatility">
              <Input value={form.stdDev} onChange={set("stdDev")} type="number" placeholder="10.0" />
            </Field>
            <Field label="Inflation Rate %">
              <Input value={form.inflationRate} onChange={set("inflationRate")} type="number" placeholder="2.5" />
            </Field>
            <Field label="Equity Allocation %" tip="e.g. 60 = 60/40">
              <Input value={form.equityAllocation} onChange={set("equityAllocation")} type="number" placeholder="60" />
            </Field>
            <Field label="Simulations" tip="1000 recommended">
              <Select value={form.simulations} onChange={set("simulations")} options={[
                { value: "500",  label: "500 (fast)" },
                { value: "1000", label: "1,000 (standard)" },
                { value: "2000", label: "2,000 (precise)" },
              ]} />
            </Field>
          </div>
        </div>
      )}

      {/* ── Notes ── */}
      <div>
        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Notes</label>
        <textarea value={form.notes} onChange={e => set("notes")(e.target.value)} rows={2}
          className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm resize-none focus:ring-2 focus:ring-primary/20"
          placeholder="Planning notes…" />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-3">
        <button onClick={run} disabled={loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition">
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Running {form.simulations} simulations…</>
                   : <><Calculator className="w-4 h-4" /> Run Monte Carlo</>}
        </button>
        {result && (
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-semibold hover:bg-muted/40 disabled:opacity-50 transition">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Result
          </button>
        )}
      </div>

      {/* ── Results ── */}
      {result && (
        <div className="space-y-5 animate-in fade-in duration-300">

          {/* Key metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Monte Carlo Success Rate"
              value={`${result.successRate}%`}
              sub={`${form.simulations} simulations`}
              tone={successColor(result.successRate) as any}
            />
            <StatCard label="Median Final Wealth" value={fmt$(result.medianBalance)}
              sub="50th percentile" tone="blue" />
            <StatCard
              label="Surplus / Shortfall"
              value={fmt$(Math.abs(result.shortfallSurplus))}
              sub={result.shortfallSurplus >= 0 ? "projected surplus" : "projected shortfall"}
              tone={result.shortfallSurplus >= 0 ? "green" : "red"}
            />
            <StatCard label="Median Annual Tax" value={fmt$(result.medianAnnualTax)}
              sub={pct(result.medianEffectiveRate) + " effective"} />
          </div>

          {/* Wealth percentiles */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "10th %ile", val: result.p10FinalWealth, tone: "red"     },
              { label: "25th %ile", val: result.p25FinalWealth, tone: "amber"   },
              { label: "Median",    val: result.medianFinalWealth, tone: "blue"  },
              { label: "75th %ile", val: result.p75FinalWealth, tone: "green"   },
              { label: "90th %ile", val: result.p90FinalWealth, tone: "green"   },
            ].map(s => (
              <StatCard key={s.label} label={s.label} value={fmt$(s.val)} tone={s.tone as any} />
            ))}
          </div>

          {/* SS & retirement details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="SS Annual Benefit" value={fmt$(result.ssAnnualBenefit)}
              sub={`Claim age ${form.ssClaimAge} (FRA ${result.ssFra})`} tone="blue" />
            <StatCard label="Total Gov. Income" value={fmt$(result.totalGovBenefitAnnual)}
              sub="SS + pension" />
            <StatCard label="RMD Starts" value={`Age ${result.rmdStartAge}`}
              sub="IRS Uniform Lifetime Table" tone="blue" />
            <StatCard label="Filing Status"
              value={form.filingStatus === "mfj" ? "Married / Joint" : form.filingStatus.toUpperCase()}
              sub={`${form.usState} state tax`} />
          </div>

          {/* Percentile fan chart */}
          <PercentileFan bands={result.percentileBands} yearsToProject={yearsToProject} />

          {/* Guidance */}
          <div className={`p-4 rounded-xl border text-sm ${
            result.successRate >= 80
              ? "bg-green-50 border-green-200 text-green-800"
              : result.successRate >= 60
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <div className="flex items-start gap-2">
              {result.successRate >= 80
                ? <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
              <div>
                <p className="font-semibold mb-1">
                  {result.successRate >= 80 ? "Plan looks well-funded" :
                   result.successRate >= 60 ? "Plan needs attention" :
                   "Plan is underfunded — action required"}
                </p>
                <p>
                  {result.successRate >= 80
                    ? `${result.successRate}% of simulations maintained positive wealth through age ${form.lifeExpectancy}. ` +
                      (result.ssAnnualBenefit > 0 ? `SS of ${fmt$(result.ssAnnualBenefit)}/yr provides a solid income floor. ` : "") +
                      `RMDs begin at age ${result.rmdStartAge} — consider Roth conversions before then to reduce future tax drag.`
                    : result.successRate >= 60
                      ? `${result.successRate}% success rate. Consider: increasing contributions, delaying SS to age 70 (+${Math.round((1 - (result.ssAnnualBenefit / Math.max(1, (+form.ssMonthlyAtFra || 1) * 12))) * -100 + 24)}%), ` +
                        `reducing desired spending, or retiring 1–2 years later.`
                      : `Only ${result.successRate}% of simulations succeed. Significant changes needed: ` +
                        `increase savings rate, reduce retirement spending goal to ${fmt$(Math.round(result.totalGovBenefitAnnual * 1.5))}/yr, ` +
                        `or delay retirement to age ${+form.retirementAge + 2}.`
                  }
                </p>
              </div>
            </div>
          </div>

          {/* SECURE 2.0 note */}
          <div className="flex gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              <strong>SECURE 2.0 Act:</strong> RMDs start at age {result.rmdStartAge} for birth year {form.birthYear}.
              Roth accounts have no RMDs — consider converting pre-tax funds during the
              {" "}<strong>Roth conversion window</strong> (retirement to age {result.rmdStartAge}).
              Withdrawals follow the optimal order: Roth → taxable → pre-tax.
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
