import { useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  TrendingDown, Sparkles, ShieldCheck, ArrowUpRight, Info, Check,
  ChevronRight, ChevronDown, AlertTriangle,
} from "lucide-react";
import { api } from "../lib/api";

const grad = "linear-gradient(90deg, #2563eb 0%, #06b6d4 100%)";

interface Props {
  clientId: number;
  client?: any;
  person: "primary" | "spouse" | "combined";
}

interface NWEntry {
  id: number; type: string; category: string; name: string;
  owner: string; value: string;
}
interface PensionPlan {
  id: number; pensionType: string; subscriberOwner: string | null;
  accrualRate: string | null; projectedYearsAtRetirement: string | null;
  yearsOfService: string | null; bestAverageEarnings: string | null;
  currentBalance: string | null; retirementAge: number | null;
}

const ONT_BRACKETS = [
  { upTo: 55867, rate: 0.2005 },
  { upTo: 90997, rate: 0.2415 },
  { upTo: 106732, rate: 0.2965 },
  { upTo: 111733, rate: 0.3148 },
  { upTo: 150000, rate: 0.3389 },
  { upTo: 173205, rate: 0.3791 },
  { upTo: 220000, rate: 0.4341 },
  { upTo: 246752, rate: 0.4641 },
  { upTo: Infinity, rate: 0.5353 },
];
function marginalRate(income: number) {
  for (const b of ONT_BRACKETS) if (income <= b.upTo) return b.rate;
  return 0.5353;
}
function taxOn(income: number) {
  let tax = 0; let prev = 0;
  for (const b of ONT_BRACKETS) {
    const slice = Math.max(0, Math.min(income, b.upTo) - prev);
    tax += slice * b.rate;
    prev = b.upTo;
    if (income <= b.upTo) break;
  }
  return Math.round(tax);
}
const RRIF_MIN: Record<number, number> = {
  71: 0.0528, 72: 0.054, 73: 0.0553, 74: 0.0567, 75: 0.0582,
  76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
  81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
  86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
  91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879, 95: 0.20,
};
const OAS_THRESHOLD = 90997;
const OAS_FULL = 8400;
const CPP_FULL = 14400;

interface SimResult {
  rows: Array<{
    age: number; rrspDraw: number; rrifMin: number;
    cpp: number; oas: number; pension: number; nonReg: number;
    taxableIncome: number; tax: number; oasClawback: number; marginalRate: number;
    rrspBal: number; tfsaBal: number; nonRegBal: number;
    toTfsa: number; toNonReg: number;
  }>;
  totals: { lifetimeTax: number; oasClawback: number; estateAfterTax: number };
}

function simulate(opts: {
  startAge: number; endAge: number;
  rrspStart: number; tfsaStart: number; nonRegStart: number;
  pensionIncome: number; cppAge: number; oasAge: number;
  meltdownDraw: number; meltdownStart: number; meltdownEnd: number;
  growth: number; tfsaRoom: number;
}): SimResult {
  const r = opts.growth;
  let rrsp = opts.rrspStart, tfsa = opts.tfsaStart, nonReg = opts.nonRegStart;
  let lifetimeTax = 0, oasClawbackTotal = 0;
  const rows: SimResult["rows"] = [];

  for (let age = opts.startAge; age <= opts.endAge; age++) {
    rrsp *= (1 + r); tfsa *= (1 + r); nonReg *= (1 + r);
    const cpp = age >= opts.cppAge ? CPP_FULL : 0;
    const oasGross = age >= opts.oasAge ? OAS_FULL : 0;
    const pension = opts.pensionIncome;

    let rrspDraw = 0;
    let rrifMin = 0;
    if (age >= 71) {
      // After 71, RRSP is converted to RRIF — minimum withdrawal applies.
      // If the meltdown plan extends past 71, honour the larger of the two; otherwise minimums only.
      rrifMin = rrsp * (RRIF_MIN[age] ?? 0.20);
      const continueMeltdown = age <= opts.meltdownEnd ? opts.meltdownDraw : 0;
      rrspDraw = Math.max(rrifMin, continueMeltdown);
    } else if (age >= opts.meltdownStart && age <= opts.meltdownEnd) {
      rrspDraw = opts.meltdownDraw;
    }
    rrspDraw = Math.min(rrspDraw, rrsp);
    rrsp -= rrspDraw;

    const nonRegIncome = nonReg * 0.025;

    // Gross OAS is taxable; the clawback is a separate recovery tax of 15% on income above the threshold.
    const taxableIncome = rrspDraw + cpp + oasGross + pension + nonRegIncome;
    const oasClawback = oasGross > 0 && taxableIncome > OAS_THRESHOLD
      ? Math.min(oasGross, (taxableIncome - OAS_THRESHOLD) * 0.15)
      : 0;
    const baseTax = taxOn(taxableIncome);
    const tax = baseTax + oasClawback;
    const oasNet = oasGross - oasClawback;
    const mRate = marginalRate(taxableIncome);

    const spendingNeed = 60000;
    const cashBeforeDraw = cpp + oasNet + pension - tax;
    const surplus = rrspDraw + nonRegIncome - Math.max(0, spendingNeed - cashBeforeDraw);
    let toTfsa = 0, toNonReg = 0;
    if (surplus > 0) {
      toTfsa = Math.min(surplus, opts.tfsaRoom);
      tfsa += toTfsa;
      toNonReg = surplus - toTfsa;
      nonReg += toNonReg;
    }

    lifetimeTax += tax;
    oasClawbackTotal += oasClawback;
    rows.push({
      age, rrspDraw: Math.round(rrspDraw), rrifMin: Math.round(rrifMin),
      cpp, oas: Math.round(oasNet), pension, nonReg: Math.round(nonRegIncome),
      taxableIncome: Math.round(taxableIncome), tax, oasClawback: Math.round(oasClawback),
      marginalRate: mRate,
      rrspBal: Math.round(rrsp), tfsaBal: Math.round(tfsa), nonRegBal: Math.round(nonReg),
      toTfsa: Math.round(toTfsa), toNonReg: Math.round(toNonReg),
    });
  }
  const finalEstate = rows[rows.length - 1];
  const taxAtDeath = finalEstate ? taxOn(finalEstate.rrspBal) : 0;
  const estateAfterTax = finalEstate
    ? finalEstate.rrspBal - taxAtDeath + finalEstate.tfsaBal + finalEstate.nonRegBal
    : 0;
  return {
    rows,
    totals: {
      lifetimeTax: Math.round(lifetimeTax),
      oasClawback: Math.round(oasClawbackTotal),
      estateAfterTax: Math.round(estateAfterTax),
    },
  };
}

function Section({
  title, eyebrow, right, children, defaultOpen = true, summary,
}: {
  title: string; eyebrow?: string; right?: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean; summary?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      <header
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between px-6 py-4 cursor-pointer select-none hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase mb-1"
                style={{ background: grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                {eyebrow}
              </div>
            )}
            <div className="flex items-baseline gap-3">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              {!open && summary && <span className="text-xs text-slate-500 truncate">{summary}</span>}
            </div>
          </div>
        </div>
        <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">{right}</div>
      </header>
      {open && <div className="px-6 pb-6 pt-1 border-t border-slate-100">{children}</div>}
    </section>
  );
}

function KpiTile({
  label, value, sub, tone = "default", icon: Icon,
}: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "default"; icon?: any }) {
  const toneCls = tone === "good" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : "text-slate-900";
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-5 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: grad }} />
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-slate-400" />}
      </div>
      <div className={`text-3xl font-semibold tracking-tight ${toneCls}`}
        style={{ fontFamily: "JetBrains Mono, ui-monospace, monospace" }}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1.5">{sub}</div>}
    </div>
  );
}

const fmt$ = (n: number) => "$" + Math.round(n).toLocaleString("en-CA");
const fmtK = (n: number) => "$" + Math.round(n / 1000) + "k";

export function MeltdownTab({ clientId, client, person }: Props) {
  const [strategyIdx, setStrategyIdx] = useState(2);
  

  // Manual overrides — allow advisor to adjust without editing source records
const [overrides, setOverrides] = useState<{
  rrsp?: number; tfsa?: number; nonReg?: number; pension?: number;
  cppAge?: number; oasAge?: number; planEnd?: number; growth?: number;
  customDraw?: number; customStart?: number; customEnd?: number;
}>({});

const ov = (k: keyof typeof overrides) => (v: string) =>
  setOverrides(o => ({ ...o, [k]: v === "" ? undefined : Number(v) }));
const resetOverrides = () => setOverrides({});

  const nwQ = useQuery<NWEntry[]>({
    queryKey: [`/api/clients/${clientId}/net-worth`],
    queryFn: () => api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`),
  });
  const pensionsQ = useQuery<PensionPlan[]>({
    queryKey: [`/api/clients/${clientId}/pensions`],
    queryFn: () => api.get<PensionPlan[]>(`/api/clients/${clientId}/pensions`),
  });
  const retirementQ = useQuery<any>({
    queryKey: [`/api/clients/${clientId}/retirement`],
    queryFn: () => api.get<any>(`/api/clients/${clientId}/retirement`).catch(() => null),
  });
  const nw = nwQ.data ?? [];
  const pensions = pensionsQ.data ?? [];
  const retirement = retirementQ.data;
  const isLoading = nwQ.isLoading || pensionsQ.isLoading || retirementQ.isLoading;

  const ownerFilter = (e: NWEntry) => {
    if (person === "combined") return true;
    return (e.owner ?? "primary").toLowerCase() === person ||
           (e.owner ?? "").toLowerCase() === "joint";
  };
  const sumByCat = (cat: string) => nw
    .filter(e => e.type === "asset" && e.category === cat && ownerFilter(e))
    .reduce((s, e) => s + Number(e.value || 0), 0);

  const rrspStart = sumByCat("RRSP");
  const tfsaStart = sumByCat("TFSA");
  const nonRegStart = sumByCat("Non-Registered");

  const pensionIncome = pensions
    .filter(p => person === "combined" || (p.subscriberOwner ?? "primary") === person)
    .reduce((sum, p) => {
      if (p.pensionType === "dbpp") {
        const rate = Number(p.accrualRate || 0);
        const yrs = Number(p.projectedYearsAtRetirement || p.yearsOfService || 0);
        const sal = Number(p.bestAverageEarnings || 0);
        return sum + Math.round(rate * yrs * sal);
      }
      return sum + Math.round(Number(p.currentBalance || 0) * 0.04);
    }, 0);

  const proj = Array.isArray(retirement)
    ? retirement[0] ?? null
    : retirement?.projection ?? retirement?.projections?.[0] ?? null;
  const cppAge = proj?.cppStartAge ?? 65;
  const oasAge = proj?.oasStartAge ?? 65;
  const planEnd = proj?.planningHorizonAge ?? 95;
  const rrspEff       = overrides.rrsp     ?? rrspStart;
 const tfsaEff       = overrides.tfsa     ?? tfsaStart;
 const nonRegEff     = overrides.nonReg   ?? nonRegStart;
 const pensionEff    = overrides.pension  ?? pensionIncome;
 const cppAgeEff     = overrides.cppAge   ?? cppAge;
 const oasAgeEff     = overrides.oasAge   ?? oasAge;
 const planEndEff    = overrides.planEnd  ?? planEnd;
 const growthEff     = (overrides.growth  ?? 5) / 100;
  const startAge = (() => {
    if (proj?.retirementAge) return Number(proj.retirementAge);
    const dob = person === "spouse"
      ? (client?.spouseDateOfBirth ?? client?.spouseDob)
      : (client?.dateOfBirth ?? client?.dob);
    if (dob) {
      const age = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
      return Math.max(60, age + 1);
    }
    return 60;
  })();

  const strategies = [
    { name: "None", desc: "Baseline — RRIF minimums only", draw: 0, end: startAge },
    { name: "Light", desc: "Stay under OAS clawback (~$90k income)", draw: Math.round(rrspStart * 0.035), end: 70 },
    { name: "Moderate", desc: "Fill 30% bracket — recommended", draw: Math.round(rrspStart * 0.05), end: 70 },
    { name: "Aggressive", desc: "Fill 40% bracket — leveraged option", draw: Math.round(rrspStart * 0.07), end: 70 },
    { name: "Custom", desc: "Set your own annual draw", draw: overrides.customDraw ?? Math.round(rrspEff * 0.04), end: overrides.customEnd ?? 70, start: overrides.customStart ?? startAge },
  ];
  const active = strategies[strategyIdx];

  const baseline = useMemo(() => simulate({
  startAge, endAge: planEndEff, rrspStart: rrspEff, tfsaStart: tfsaEff, nonRegStart: nonRegEff,
  pensionIncome: pensionEff, cppAge: cppAgeEff, oasAge: oasAgeEff,
  meltdownDraw: 0, meltdownStart: startAge, meltdownEnd: startAge,
  growth: growthEff, tfsaRoom: 7000,
}), [startAge, planEndEff, rrspEff, tfsaEff, nonRegEff, pensionEff, cppAgeEff, oasAgeEff, growthEff]);

const meltdown = useMemo(() => simulate({
  startAge, endAge: planEndEff, rrspStart: rrspEff, tfsaStart: tfsaEff, nonRegStart: nonRegEff,
  pensionIncome: pensionEff, cppAge: cppAgeEff, oasAge: oasAgeEff,
  meltdownDraw: active.draw, meltdownStart: (active as any).start ?? startAge, meltdownEnd: active.end,
  growth: growthEff, tfsaRoom: 7000,
}), [startAge, planEndEff, rrspEff, tfsaEff, nonRegEff, pensionEff, cppAgeEff, oasAgeEff, growthEff, active.draw, active.end]);

  const lifetimeTaxSaved = baseline.totals.lifetimeTax - meltdown.totals.lifetimeTax;
  const estateUplift = meltdown.totals.estateAfterTax - baseline.totals.estateAfterTax;
  const oasClawbackAvoided = baseline.totals.oasClawback - meltdown.totals.oasClawback;

  const yearlyChart = baseline.rows.map((b, i) => ({
    age: b.age,
    baseTotal: b.taxableIncome,
    meltTotal: meltdown.rows[i]?.taxableIncome ?? 0,
  }));
  const balanceChart = baseline.rows.map((b, i) => ({
    age: b.age,
    baseRrsp: b.rrspBal,
    meltRrsp: meltdown.rows[i]?.rrspBal ?? 0,
    meltTfsa: meltdown.rows[i]?.tfsaBal ?? 0,
  }));
  const taxRateChart = baseline.rows.map((b, i) => ({
    age: b.age,
    base: Math.round(b.marginalRate * 100),
    meltdown: Math.round((meltdown.rows[i]?.marginalRate ?? 0) * 100),
  }));

  const tableRows = meltdown.rows.filter((_, i) => i % 5 === 0 || i === meltdown.rows.length - 1).slice(0, 8);

  if (isLoading) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white mb-4 animate-pulse" style={{ background: grad }}>
            <TrendingDown className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Loading meltdown simulator…</h2>
          <p className="text-sm text-slate-500">Pulling RRSP, TFSA, pension, and retirement assumptions.</p>
        </div>
      </div>
    );
  }

  if (rrspStart <= 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-white mb-4" style={{ background: grad }}>
            <TrendingDown className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900 mb-2">RRSP Meltdown Strategy</h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Add RRSP balances under <strong>Net Worth</strong> to run the meltdown simulator. We'll model baseline vs. meltdown scenarios to show lifetime tax saved, estate uplift, and OAS clawback avoided.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-100 min-h-full">
      <main className="max-w-[1320px] mx-auto px-2 py-2 space-y-6">

        <div className="grid grid-cols-3 gap-4">
          <KpiTile label="Lifetime Tax Saved"
            value={lifetimeTaxSaved >= 0 ? fmt$(lifetimeTaxSaved) : `-${fmt$(-lifetimeTaxSaved)}`}
            sub={`vs do-nothing baseline · age ${startAge}→${planEnd}`}
            tone={lifetimeTaxSaved >= 0 ? "good" : "warn"} icon={TrendingDown} />
          <KpiTile label="Estate Value Uplift"
            value={(estateUplift >= 0 ? "+" : "") + fmt$(estateUplift)}
            sub={`after-tax to heirs at age ${planEnd}`}
            tone={estateUplift >= 0 ? "good" : "warn"} icon={ArrowUpRight} />
          <KpiTile label="OAS Clawback Avoided"
            value={fmt$(oasClawbackAvoided)}
            sub={`baseline clawback ${fmt$(baseline.totals.oasClawback)} over plan`}
            tone="good" icon={ShieldCheck} />
        </div>

        <Section
          title="Strategy"
          eyebrow="Step 1 — Choose Aggressiveness"
          summary={`${active.name} · ${fmt$(active.draw)}/yr from age ${startAge} to ${active.end}`}
          right={
            <button className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" /> What does each option do?
            </button>
          }
        >
          <div className="grid grid-cols-5 gap-3 mb-5">
            {strategies.map((s, i) => {
              const variant = i === 0 ? null : simulate({
                startAge, endAge: planEnd, rrspStart, tfsaStart, nonRegStart,
                pensionIncome, cppAge, oasAge,
                meltdownDraw: s.draw, meltdownStart: startAge, meltdownEnd: s.end,
                growth: 0.05, tfsaRoom: 7000,
              });
              const saved = variant ? baseline.totals.lifetimeTax - variant.totals.lifetimeTax : 0;
              return (
                <button
                  key={s.name}
                  onClick={() => setStrategyIdx(i)}
                  className={`text-left rounded-xl border-2 p-3.5 transition-all ${
                    i === strategyIdx ? "border-blue-400 bg-blue-50/40" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-slate-900">{s.name}</span>
                    {i === strategyIdx && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <div className="text-[11px] text-slate-500 leading-snug min-h-[2.5em]">{s.desc}</div>
                  {saved > 0 && (
                    <div className="text-[11px] mt-2 font-semibold text-emerald-600"
                      style={{ fontFamily: "JetBrains Mono, monospace" }}>
                      +${(saved / 1000).toFixed(1)}k saved
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-50 text-sm">
            <Sparkles className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-slate-700">
              <strong className="text-slate-900">{active.name}</strong> · {active.desc} · target withdrawal{" "}
              <span className="font-semibold" style={{ fontFamily: "JetBrains Mono, monospace" }}>{fmt$(active.draw)}/yr</span>{" "}
              from age {startAge} to {active.end}
            </span>
          </div>
        </Section>

        <Section
  title="Assumptions"
  eyebrow="Pulled from Client File"
  defaultOpen={false}
  summary={`${fmtK(rrspEff)} RRSP · ${fmtK(tfsaEff)} TFSA · Age ${planEndEff} horizon`}
  right={
    <button onClick={resetOverrides}
      className="text-xs text-blue-600 hover:text-blue-800 font-medium">
      Reset to client values
    </button>
  }
>
  <div className="grid grid-cols-4 gap-4">
    {[
      { label: "RRSP Balance",       key: "rrsp",    val: rrspEff,    src: "Net Worth",        prefix: "$" },
      { label: "TFSA Balance",       key: "tfsa",    val: tfsaEff,    src: "Net Worth",        prefix: "$" },
      { label: "Non-Registered",     key: "nonReg",  val: nonRegEff,  src: "Net Worth",        prefix: "$" },
      { label: "DB Pension/yr",      key: "pension", val: pensionEff, src: "Pension",          prefix: "$" },
      { label: "CPP Start Age",      key: "cppAge",  val: cppAgeEff,  src: "Retirement Form",  prefix: ""  },
      { label: "OAS Start Age",      key: "oasAge",  val: oasAgeEff,  src: "Retirement Form",  prefix: ""  },
      { label: "Planning Horizon",   key: "planEnd", val: planEndEff, src: "Retirement Form",  prefix: "Age " },
      { label: "Growth Rate %",      key: "growth",  val: overrides.growth ?? 5, src: "Default 5%", prefix: "" },
    ].map(({ label, key, val, src, prefix }) => (
      <div key={label}>
        <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1">{label}</div>
        <div className="relative">
          {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">{prefix}</span>}
          <input
            type="number"
            value={overrides[key as keyof typeof overrides] ?? val}
            onChange={e => ov(key as keyof typeof overrides)(e.target.value)}
            className={`w-full bg-white border border-slate-200 rounded-lg py-1.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400 font-mono ${prefix ? "pl-7 pr-2" : "px-2.5"}`}
          />
          {overrides[key as keyof typeof overrides] !== undefined && (
            <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-500 rounded-full" title="Overridden" />
          )}
        </div>
        <div className="text-[9px] text-slate-400 mt-0.5">{src}</div>
      </div>
    ))}
  </div>
  {strategyIdx === 4 && (
    <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-4">
      <div>
        <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1">Custom Annual Draw</div>
        <input type="number" placeholder="e.g. 40000"
          value={overrides.customDraw ?? ""}
          onChange={e => ov("customDraw")(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
      </div>
      <div>
  <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1">Begin Meltdown Age</div>
  <input type="number" placeholder={String(startAge)}
    value={overrides.customStart ?? ""}
    onChange={e => ov("customStart")(e.target.value)}
    className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
</div>
      <div>
        <div className="text-[10px] font-semibold tracking-wider uppercase text-slate-500 mb-1">Draw Until Age</div>
        <input type="number" placeholder="e.g. 70"
          value={overrides.customEnd ?? ""}
          onChange={e => ov("customEnd")(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-semibold font-mono focus:outline-none focus:ring-1 focus:ring-blue-400/40 focus:border-blue-400" />
      </div>
    </div>
  )}
</Section>

        <div className="grid grid-cols-2 gap-4">
          <Section title="Taxable Income by Year" eyebrow="Smoothed vs. Spike" summary={`Bar chart, ages ${startAge}–${planEnd}`}
            right={
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" /> Baseline</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-cyan-500" /> Meltdown</div>
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={yearlyChart} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="age" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => fmt$(v)} />
                <Bar dataKey="baseTotal" name="Baseline" fill="#cbd5e1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="meltTotal" name="Meltdown" fill="#06b6d4" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-2">Baseline spikes at 71 when RRIF minimums kick in. Meltdown smooths the curve, keeping each year in a lower bracket.</p>
          </Section>

          <Section title="RRSP & TFSA Balance" eyebrow="Glide Path" summary={`Line chart, ages ${startAge}–${planEnd}`}>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={balanceChart} margin={{ top: 10, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="age" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => fmt$(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="baseRrsp" name="RRSP (baseline)" stroke="#cbd5e1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="meltRrsp" name="RRSP (meltdown)" stroke="#2563eb" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="meltTfsa" name="TFSA (meltdown)" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-slate-500 mt-2">RRSP shrinks deliberately while TFSA grows tax-free — same total wealth, better tax wrapper.</p>
          </Section>
        </div>

        <Section
          title="Marginal Tax Rate by Year"
          eyebrow="The Smoothing Effect"
          defaultOpen={false}
          summary="Lower curve = paying less tax overall"
          right={<span className="text-xs text-slate-500">Lower curve = paying less tax overall</span>}
        >
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={taxRateChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="meltGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="age" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => `${v}%`} domain={[15, 55]} />
              <Tooltip formatter={(v: any) => `${v}%`}
                contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="base" name="Baseline" stroke="#94a3b8" fill="url(#baseGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="meltdown" name="Meltdown" stroke="#06b6d4" fill="url(#meltGrad)" strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        <Section
          title="Year-by-Year Schedule"
          eyebrow="Full Transparency"
          defaultOpen={false}
          summary={`${meltdown.rows.length} rows · withdrawal, redirects, taxable income, marginal rate`}
          right={
            <button className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              View all {meltdown.rows.length} years <ChevronRight className="w-3.5 h-3.5" />
            </button>
          }
        >
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 text-left font-semibold">Age</th>
                  <th className="px-4 py-2.5 text-right font-semibold">RRSP Draw</th>
                  <th className="px-4 py-2.5 text-right font-semibold">→ TFSA</th>
                  <th className="px-4 py-2.5 text-right font-semibold">→ Non-Reg</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Taxable Income</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Tax Paid</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Marginal Rate</th>
                </tr>
              </thead>
              <tbody style={{ fontFamily: "JetBrains Mono, monospace" }}>
                {tableRows.map((r) => (
                  <tr key={r.age} className="border-t border-slate-100 text-slate-700">
                    <td className="px-4 py-2 font-semibold text-slate-900">{r.age}</td>
                    <td className="px-4 py-2 text-right">{fmt$(r.rrspDraw)}</td>
                    <td className="px-4 py-2 text-right text-emerald-600">{fmt$(r.toTfsa)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{fmt$(r.toNonReg)}</td>
                    <td className="px-4 py-2 text-right">{fmt$(r.taxableIncome)}</td>
                    <td className="px-4 py-2 text-right text-slate-900">{fmt$(r.tax)}</td>
                    <td className="px-4 py-2 text-right text-slate-500">{Math.round(r.marginalRate * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section
          title="Risks & Caveats"
          eyebrow="Read Before Adopting"
          defaultOpen={false}
          summary="3 caveats — review before committing"
        >
          <ul className="space-y-2 text-sm text-slate-700">
            {[
              "Assumes Ontario tax brackets stay roughly indexed to current law. A future top-bracket cut would shrink the meltdown advantage.",
              "Loses tax-deferred compounding on accelerated draws — recovered only if redirected to TFSA or efficient non-registered.",
              "If client dies before age 75, baseline scenario may slightly outperform due to spousal rollover preserving deferral.",
            ].map((t) => (
              <li key={t} className="flex gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-500 flex-shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </Section>

        <div className="rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: grad }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 0%, transparent 50%)" }} />
          <div className="relative flex items-center justify-between gap-6">
            <div>
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/80 mb-1">Ready to Commit</div>
              <h3 className="text-xl font-semibold tracking-tight">Adopt {active.name} Meltdown as the active strategy</h3>
              <p className="text-sm text-white/90 mt-1.5 max-w-2xl">
                A note will be added to {client?.firstName ?? "this client"}'s file with the strategy parameters and projected savings. Cross-module propagation to Projection / Net Worth / Tax & Estate is coming soon.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => toast({ title: `Adopted: ${active.name}`, description: `Tax saved: ${fmt$(lifetimeTaxSaved)} · Estate uplift: ${fmt$(estateUplift)}` })}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 transition-colors"
              >
                Save Draft
              </button>
              <button
                onClick={() => alert(`Adopted: ${active.name} meltdown.\nLifetime tax saved: ${fmt$(lifetimeTaxSaved)}\nEstate uplift: ${fmt$(estateUplift)}\n\nFull persistence + cross-module propagation will land in the next iteration.`)}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-white text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-2 shadow-lg"
              >
                <Check className="w-4 h-4" /> Adopt Strategy
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 pt-2 pb-4">
          Last simulation run: {new Date().toLocaleDateString("en-CA")} · {meltdown.rows.length} years modelled
        </div>
      </main>
    </div>
  );
}
