/**
 * RetirementStrategist.tsx
 * The Strategist — AI-driven ranked retirement optimization recommendations.
 *
 * Pulls data from the client file (RRSP, pension, CPP/OAS ages, retirement age)
 * and runs lightweight simulations to rank improvement levers by impact.
 *
 * Philosophy: "What single change would most improve this plan?"
 */

import { useState, useEffect, useMemo } from "react";
import {
  Sparkles, TrendingUp, Clock, DollarSign, Shield,
  ArrowRight, ChevronDown, ChevronUp, RefreshCw,
  CheckCircle, AlertTriangle, Info, Zap,
} from "lucide-react";
import { api } from "../../lib/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NWEntry { id: number; type: string; category: string; value: string; owner: string; }
interface PensionPlan {
  id: number; pensionType: string; currentBalance: string | null;
  accrualRate: string | null; projectedYearsAtRetirement: string | null;
  bestAverageEarnings: string | null; pensionIncome?: string | null;
}
interface RetirementProj {
  id: number; person?: string; currentAge: number; retirementAge: number; lifeExpectancy: number;
  currentSavings: string; annualContribution: string; desiredRetirementIncome: string;
  expectedReturn: string; inflationRate: string; pensionIncome: string;
  cppStartAge: number; oasStartAge: number; successRate: string;
}

interface Recommendation {
  id:       string;
  category: "timing" | "savings" | "tax" | "income" | "risk" | "estate";
  priority: "critical" | "high" | "medium" | "low";
  title:    string;
  impact:   string;         // e.g. "+8% success rate"
  impactVal: number;        // for sorting
  description: string;
  action:   string;         // advisor action
  detail?:  string;         // expanded detail
}

interface Props {
  clientId: number;
  client?:  any;
  person?:  string;
}

// ── Simple simulation ─────────────────────────────────────────────────────────

const RRIF_MIN: Record<number, number> = {
  71: 0.0528, 72: 0.054, 73: 0.0553, 74: 0.0567, 75: 0.0582,
  76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
};
const CPP_BASE = 10800;
const OAS_BASE = 8568;

function simSuccessRate(opts: {
  rrsp: number; tfsa: number; nonReg: number; pension: number;
  annualContrib: number; desiredIncome: number;
  currentAge: number; retAge: number; lifeExp: number;
  cppAge: number; oasAge: number;
  returnRate?: number; inflRate?: number;
  simCount?: number;
}): number {
  const {
    rrsp, tfsa, nonReg, pension, annualContrib, desiredIncome,
    currentAge, retAge, lifeExp, cppAge, oasAge,
    returnRate = 0.06, inflRate = 0.025, simCount = 200,
  } = opts;
  const stdDev = 0.10;
  let success = 0;

  for (let s = 0; s < simCount; s++) {
    let pRrsp = rrsp, pTfsa = tfsa, pNonReg = nonReg;
    let spending = desiredIncome;
    let failed = false;

    for (let yr = 0; yr < lifeExp - currentAge; yr++) {
      const age = currentAge + yr;
      const z = Math.sqrt(-2 * Math.log(Math.random() + 1e-10)) * Math.cos(2 * Math.PI * Math.random());
      const rr = returnRate + stdDev * z;

      if (age < retAge) {
        pRrsp  = (pRrsp  + annualContrib * 0.7) * (1 + rr);
        pTfsa  = (pTfsa  + annualContrib * 0.3) * (1 + rr);
        pNonReg = pNonReg * (1 + rr);
      } else {
        pRrsp  = Math.max(0, pRrsp  * (1 + rr));
        pTfsa  = Math.max(0, pTfsa  * (1 + rr));
        pNonReg = Math.max(0, pNonReg * (1 + rr));

        const cpp = age >= cppAge ? CPP_BASE : 0;
        const oas = age >= oasAge ? OAS_BASE : 0;
        const gov = cpp + oas + pension;

        let shortfall = Math.max(0, spending - gov);
        if (shortfall > 0) { const d = Math.min(shortfall, pTfsa);  pTfsa  -= d; shortfall -= d; }
        if (shortfall > 0) { const d = Math.min(shortfall, pNonReg); pNonReg -= d; shortfall -= d; }
        if (shortfall > 0) { const d = Math.min(shortfall, pRrsp);  pRrsp  -= d; shortfall -= d; }
        if (shortfall > 2000) { failed = true; break; }
        spending *= (1 + inflRate);
      }
    }
    if (!failed && pRrsp + pTfsa + pNonReg > 0) success++;
  }
  return Math.round(success / simCount * 100);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => n >= 1_000_000
  ? `$${(n / 1_000_000).toFixed(1)}M`
  : `$${Math.round(n / 1000)}K`;

const CATEGORY_COLORS: Record<string, string> = {
  timing:  "blue",
  savings: "emerald",
  tax:     "purple",
  income:  "cyan",
  risk:    "amber",
  estate:  "rose",
};
const CATEGORY_LABELS: Record<string, string> = {
  timing:  "Timing",
  savings: "Savings",
  tax:     "Tax",
  income:  "Income",
  risk:    "Risk",
  estate:  "Estate",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "text-red-600 bg-red-50 border-red-100",
  high:     "text-amber-600 bg-amber-50 border-amber-100",
  medium:   "text-blue-600 bg-blue-50 border-blue-100",
  low:      "text-slate-500 bg-slate-50 border-slate-100",
};

// ── Main Component ────────────────────────────────────────────────────────────

export function RetirementStrategist({ clientId, client, person = "primary" }: Props) {
  const [nw,         setNw]         = useState<NWEntry[]>([]);
  const [pensions,   setPensions]   = useState<PensionPlan[]>([]);
  const [projections,setProjections]= useState<RetirementProj[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [running,    setRunning]    = useState(false);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [baseRate,   setBaseRate]   = useState<number | null>(null);


function runAnalysis() {
  setRunning(true);
  setTimeout(() => {
    const rate = simSuccessRate(baseOpts);
    setBaseRate(rate);
    setRunning(false);
  }, 100);
}

  useEffect(() => {
    Promise.all([
      api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`),
      api.get<PensionPlan[]>(`/api/clients/${clientId}/pensions`),
      api.get<RetirementProj[]>(`/api/clients/${clientId}/retirement`),
    ]).then(([nwData, pensData, projData]) => {
      setNw(nwData ?? []);
      setPensions(pensData ?? []);
      setProjections(Array.isArray(projData) ? projData : projData ? [projData] : []);
    }).finally(() => setLoading(false));
  }, [clientId]);


  // ── Build data picture ────────────────────────────────────────────────────

  const personKey = person === "combined" ? "primary" : (person ?? "primary");
  const proj = projections.find(p => (p.person ?? "primary") === personKey)
    ?? projections[0];

  const nwSum = (cat: string, owner?: string) =>
    nw.filter(e => e.type === "asset" && e.category === cat && (!owner || e.owner === owner))
      .reduce((s, e) => s + Number(e.value), 0);

  const rrsp   = person === "combined" ? nwSum("RRSP")             : person === "spouse" ? nwSum("RRSP", "spouse")             : nwSum("RRSP", "primary")             + nwSum("RRSP", "joint");
  const tfsa   = person === "combined" ? nwSum("TFSA")             : person === "spouse" ? nwSum("TFSA", "spouse")             : nwSum("TFSA", "primary")             + nwSum("TFSA", "joint");
  const nonReg = person === "combined" ? nwSum("Non-Registered")   : person === "spouse" ? nwSum("Non-Registered", "spouse")   : nwSum("Non-Registered", "primary")   + nwSum("Non-Registered", "joint");
  const totalSavings = rrsp + tfsa + nonReg;

  const pensionIncome = pensions.reduce((s, p) => {
    if (p.pensionType === "dbpp") return s + Number(p.accrualRate || 0) * Number(p.projectedYearsAtRetirement || 0) * Number(p.bestAverageEarnings || 0);
    return s;
  }, 0);

  const currentAge = proj?.currentAge ?? (() => {
    const dob = person === "spouse"
      ? (client?.spouseDateOfBirth ?? client?.spouseDob)
      : (client?.dateOfBirth ?? client?.dob);
    return dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : 45;
  })();
  const retAge     = proj?.retirementAge ?? (person === "spouse" ? client?.spouseRetirementAge : client?.retirementAge) ?? 65;
  const lifeExp    = proj?.lifeExpectancy ?? 90;
  const annualContrib = Number(proj?.annualContribution ?? 0);
  const desired    = Number(proj?.desiredRetirementIncome ?? (person === "spouse" ? client?.spouseDesiredRetirementIncome : client?.desiredRetirementIncome) ?? 80000);
  const cppAge     = proj?.cppStartAge ?? 65;
  const oasAge     = proj?.oasStartAge ?? 65;
  const hasPension = pensionIncome > 0;
  const hasRrsp    = rrsp > 0;
  const hasTfsa    = tfsa > 0;
  const yearsToRet = Math.max(0, retAge - currentAge);
  const income     = Number(client?.annualIncome ?? 0);
  const [goal, setGoal] = useState<"spending" | "tax" | "estate">("spending");

  const baseOpts = {
    rrsp, tfsa, nonReg, pension: pensionIncome,
    annualContrib, desiredIncome: desired,
    currentAge, retAge, lifeExp, cppAge, oasAge,
  };

  // Run baseline on mount
  useEffect(() => {
  if (loading) return;
  runAnalysis();
}, [loading]);



  // ── Generate recommendations ──────────────────────────────────────────────
const goalWeights: Record<string, number> = {
  spending: goal === "spending" ? 1.5 : 1,
  tax:      goal === "tax"      ? 1.5 : 1,
  estate:   goal === "estate"   ? 1.5 : 1,
};
const applyWeight = (id: string, val: number) => {
  if (goal === "tax"     && ["cpp-delay","oas-delay","rrsp-meltdown","tfsa-build"].includes(id)) return val * 1.5;
  if (goal === "estate"  && ["tfsa-build","income-floor","longevity"].includes(id)) return val * 1.5;
  if (goal === "spending"&& ["retire-later","max-rrsp","low-success"].includes(id)) return val * 1.5;
  return val;
};
  
  
  const recommendations = useMemo((): Recommendation[] => {
    if (baseRate === null) return [];
    const recs: Recommendation[] = [];

    // 1. CPP delay
    if (cppAge < 70) {
      const cppBoost = (70 - cppAge) * 0.084; // 8.4% per year
      const newRate = Math.min(100, simSuccessRate({ ...baseOpts, cppAge: 70 }));
      const delta = newRate - baseRate;
      recs.push({
        id: "cpp-delay", category: "timing", priority: delta >= 5 ? "high" : "medium",
        title: "Delay CPP to Age 70",
        impact: delta > 0 ? `+${delta}% success rate` : "Minimal impact at current balance",
        impactVal: delta,
        description: `Delaying CPP from ${cppAge} to 70 increases the monthly benefit by ${Math.round(cppBoost * 100)}% — permanently. This is ${fmt$(Math.round(CPP_BASE * cppBoost))} more per year, inflation-indexed for life.`,
        action: "Review CPP Statement of Contributions and update claim age to 70.",
        detail: `Break-even age vs claiming at ${cppAge}: approximately ${Math.round(cppAge + (cppAge - 60) * 2 + 5)} years old. For clients expected to live past this, delay almost always wins.`,
      });
    }

    // 2. OAS delay
    if (oasAge < 70) {
      const oasBoost = (70 - oasAge) * 0.072;
      const newRate = Math.min(100, simSuccessRate({ ...baseOpts, oasAge: 70 }));
      const delta = newRate - baseRate;
      recs.push({
        id: "oas-delay", category: "timing", priority: delta >= 4 ? "medium" : "low",
        title: "Delay OAS to Age 70",
        impact: delta > 0 ? `+${delta}% success rate` : "Modest benefit",
        impactVal: delta,
        description: `Deferring OAS from ${oasAge} to 70 increases the benefit by ${Math.round(oasBoost * 100)}% — that's ${fmt$(Math.round(OAS_BASE * oasBoost))} more per year for life.`,
        action: "Register OAS deferral through Service Canada. Pension rollback if needed.",
        detail: "OAS clawback threshold is ~$90,997 (2024). If RRSP meltdown income pushes income above this, delaying OAS avoids clawback during peak withdrawal years.",
      });
    }

    // 3. Retire 2 years later
    if (retAge < 67 && yearsToRet > 0) {
      const newRate = Math.min(100, simSuccessRate({ ...baseOpts, retAge: retAge + 2 }));
      const delta = newRate - baseRate;
      recs.push({
        id: "retire-later", category: "timing", priority: delta >= 8 ? "high" : "medium",
        title: `Retire at ${retAge + 2} Instead of ${retAge}`,
        impact: `+${delta}% success rate`,
        impactVal: delta,
        description: `Two additional working years adds ${fmt$(annualContrib * 2)} in contributions, reduces the retirement period by 2 years, and delays the drawdown start.`,
        action: "Model the 2-year delay scenario and present to client with total impact breakdown.",
        detail: `At the current savings rate, two more years generates approximately ${fmt$(annualContrib * 2 + totalSavings * 0.12)} in additional wealth at retirement (contributions + growth).`,
      });
    }

    // 4. Increase RRSP contributions
    if (income > 0 && annualContrib < income * 0.18) {
      const maxContrib = Math.min(income * 0.18, 31560); // 2024 RRSP limit
      const addlContrib = maxContrib - annualContrib;
      if (addlContrib > 2000) {
        const newRate = Math.min(100, simSuccessRate({ ...baseOpts, annualContrib: annualContrib + addlContrib }));
        const delta = newRate - baseRate;
        recs.push({
          id: "max-rrsp", category: "savings", priority: delta >= 5 ? "high" : "medium",
          title: "Maximize RRSP Contributions",
          impact: `+${delta}% success rate · ${fmt$(addlContrib)}/yr more`,
          impactVal: delta,
          description: `Client is contributing ${fmt$(annualContrib)}/yr but could contribute ${fmt$(Math.round(maxContrib))}/yr (18% of income or $31,560 limit). The additional ${fmt$(Math.round(addlContrib))}/yr would compound significantly over ${yearsToRet} years.`,
          action: "Check NOA for available RRSP room. Set up automatic top-up contribution.",
          detail: `At 6% return over ${yearsToRet} years, the additional contributions grow to approximately ${fmt$(Math.round(addlContrib * ((Math.pow(1.06, yearsToRet) - 1) / 0.06)))} at retirement.`,
        });
      }
    }

    // 5. TFSA room — if under-contributing
    if (!hasTfsa || tfsa < 50000) {
      const newRate = Math.min(100, simSuccessRate({ ...baseOpts, tfsa: tfsa + 7000 * Math.min(yearsToRet, 10) }));
      const delta = newRate - baseRate;
      recs.push({
        id: "tfsa-build", category: "tax", priority: "medium",
        title: "Build TFSA as Tax-Free Income Buffer",
        impact: delta > 0 ? `+${delta}% success rate` : "Tax efficiency improvement",
        impactVal: delta,
        description: `TFSA balance is ${fmt$(tfsa)}. Maximizing TFSA contributions (${fmt$(7000)}/yr) creates a tax-free withdrawal pool for retirement — critical for managing OAS clawback and marginal rates.`,
        action: "Confirm available TFSA room via CRA My Account. Redirect surplus income to TFSA.",
        detail: "TFSA withdrawals don't count as income — they won't trigger OAS clawback, affect GIS, or push taxable income into higher brackets. This is the most tax-efficient long-term buffer available.",
      });
    }

    // 6. RRSP Meltdown strategy
    if (hasRrsp && rrsp > 200000 && retAge > currentAge && cppAge >= 65) {
      const annualTax = rrsp * 0.05 * 0.30; // rough tax on systematic draw
      recs.push({
        id: "rrsp-meltdown", category: "tax", priority: "high",
        title: "RRSP Meltdown Before Age 65",
        impact: `~${fmt$(annualTax * (65 - Math.max(currentAge, retAge)))} lifetime tax saved`,
        impactVal: 7,
        description: `With ${fmt$(rrsp)} in RRSP, systematic withdrawals before CPP/OAS kick in can smooth taxable income and avoid forced RRIF minimums piling on top of government income later.`,
        action: "Use the RRSP Meltdown tab to model the optimal draw strategy — typically the 'Moderate' scenario fills the 30% bracket each year.",
        detail: "Key window: ages " + Math.max(currentAge, retAge) + "–65 when income is lowest. Draw enough RRSP to fill the bracket just below the OAS clawback threshold ($90,997).",
      });
    }

    // 7. Insurance gap — no pension case
    if (!hasPension && desired > (CPP_BASE + OAS_BASE)) {
      const gap = desired - CPP_BASE - OAS_BASE;
      recs.push({
        id: "income-floor", category: "income", priority: "medium",
        title: "Build a Guaranteed Income Floor",
        impact: `${fmt$(gap)}/yr gap to cover`,
        impactVal: 4,
        description: `Without a DB pension, government benefits (CPP + OAS = ${fmt$(CPP_BASE + OAS_BASE)}/yr) cover only a portion of the ${fmt$(desired)}/yr income goal. The ${fmt$(gap)}/yr gap must come from the portfolio — consider partial annuitization to guarantee floor income.`,
        action: "Model a life annuity purchase (e.g., $150K → ~$9,000/yr guaranteed) to cover essential spending. Compare to bond ladder strategy.",
        detail: "Annuity pricing: approximately $100K purchases $550–$650/mo for a 65-year-old male (joint-life lower). Guaranteed for life regardless of market performance.",
      });
    }

    // 8. Life expectancy — longevity risk
    if (lifeExp < 90) {
      recs.push({
        id: "longevity", category: "risk", priority: "medium",
        title: "Plan to Age 95 for Longevity Risk",
        impact: "Risk mitigation",
        impactVal: 3,
        description: `Current plan models to age ${lifeExp}. A 65-year-old Canadian has a 50% chance of living to 87 (male) or 89 (female), and a 25% chance of reaching 93+. Running out of money at 88 is a real risk.`,
        action: "Extend the planning horizon to 95 and re-run the Monte Carlo. Consider longevity annuity (deferred to age 80+) for catastrophic longevity protection.",
        detail: "The cost of planning to 95 vs 85 is relatively modest — extending the horizon by 10 years in the projection typically reduces the success rate by 8–15%. Knowing this cost upfront is valuable.",
      });
    }

    // 9. Low success rate — critical action
    if (baseRate < 70) {
      recs.push({
        id: "low-success", category: "risk", priority: "critical",
        title: "Plan at Risk — Immediate Review Required",
        impact: `${baseRate}% success rate`,
        impactVal: 20,
        description: `The current plan has only a ${baseRate}% chance of sustaining income to age ${lifeExp}. This is below the 80% threshold generally considered acceptable for retirement planning.`,
        action: "Schedule a comprehensive retirement review. Prioritize the highest-impact recommendations above and model the combined effect.",
        detail: "To reach 80%+ success, the most effective levers in order are: (1) delay retirement, (2) increase savings rate, (3) delay CPP to 70, (4) reduce desired spending by 10–15%.",
      });
    }

    // Sort by impactVal descending
    return recs
  .map(r => ({ ...r, impactVal: applyWeight(r.id, r.impactVal) }))
  .sort((a, b) => b.impactVal - a.impactVal);
  }, [baseRate, rrsp, tfsa, nonReg, pensionIncome, currentAge, retAge, lifeExp, cppAge, oasAge, annualContrib, desired, income, goal]);

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Loading plan data…</span>
        </div>
      </div>
    );
  }

  if (!proj && totalSavings === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mb-4 shadow-lg">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 mb-2">Set Up the Plan First</h2>
        <p className="text-sm text-slate-500 max-w-sm">
          Add net worth entries (RRSP, TFSA) and a retirement projection to generate personalized recommendations.
        </p>
      </div>
    );
  }

  const criticalCount = recommendations.filter(r => r.priority === "critical").length;
  const highCount     = recommendations.filter(r => r.priority === "high").length;

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4">
  <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
    Primary Planning Goal — recommendations ranked accordingly
  </div>
  <div className="grid grid-cols-3 gap-3">
    {([
      { key: "spending", label: "Maximize Retirement Spending", desc: "Live well, never run out", icon: "💰", color: "emerald" },
      { key: "tax",      label: "Minimize Lifetime Taxes",      desc: "Keep more of what you've built", icon: "📊", color: "purple" },
      { key: "estate",   label: "Maximize After-Tax Estate",    desc: "Leave the largest legacy", icon: "🏛️", color: "blue" },
    ] as const).map(g => (
      <button key={g.key} onClick={() => setGoal(g.key)}
        className={`text-left p-3.5 rounded-xl border-2 transition-all ${
          goal === g.key
            ? g.color === "emerald" ? "border-emerald-400 bg-emerald-50"
            : g.color === "purple"  ? "border-purple-400 bg-purple-50"
            : "border-blue-400 bg-blue-50"
            : "border-slate-200 bg-white hover:border-slate-300"
        }`}>
        <div className="text-lg mb-1">{g.icon}</div>
        <div className={`text-xs font-bold mb-0.5 ${
          goal === g.key
            ? g.color === "emerald" ? "text-emerald-800"
            : g.color === "purple"  ? "text-purple-800"
            : "text-blue-800"
            : "text-slate-700"
        }`}>{g.label}</div>
        <div className="text-[10px] text-slate-400 leading-relaxed">{g.desc}</div>
      </button>
    ))}
  </div>
</div>
      {/* Header strip */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">The Strategist</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Retirement Optimization Report</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {recommendations.length} opportunities · ranked for {goal === "spending" ? "maximum retirement income" : goal === "tax" ? "minimum lifetime tax" : "maximum estate value"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {running && (
           <button onClick={runAnalysis} disabled={running}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${running ? "animate-spin" : ""}`} />
            {running ? "Analyzing…" : "Re-run Analysis"}
           </button>
          )}
          {baseRate !== null && !running && (
            <div className={`text-center px-4 py-2.5 rounded-xl border ${
              baseRate >= 80 ? "bg-emerald-50 border-emerald-200" :
              baseRate >= 60 ? "bg-amber-50 border-amber-200" :
              "bg-red-50 border-red-200"
            }`}>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Success Rate</div>
              <div className={`text-2xl font-bold ${
                baseRate >= 80 ? "text-emerald-600" : baseRate >= 60 ? "text-amber-600" : "text-red-600"
              }`}>{baseRate}%</div>
              <div className="text-[9px] text-slate-400">current plan</div>
            </div>
          )}
        </div>
      </div>

      {/* Alert banner */}
      {(criticalCount > 0 || highCount > 0) && (
        <div className={`flex items-start gap-3 p-3.5 rounded-xl border ${
          criticalCount > 0 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"
        }`}>
          <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${criticalCount > 0 ? "text-red-500" : "text-amber-500"}`} />
          <p className={`text-sm font-medium ${criticalCount > 0 ? "text-red-700" : "text-amber-700"}`}>
            {criticalCount > 0
              ? `${criticalCount} critical issue${criticalCount > 1 ? "s" : ""} detected — immediate action required`
              : `${highCount} high-priority recommendation${highCount > 1 ? "s" : ""} that could materially improve this plan`}
          </p>
        </div>
      )}

      {/* Plan snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Savings",       value: fmt$(totalSavings),          sub: "RRSP + TFSA + Non-Reg" },
          { label: "Retirement Age",      value: `Age ${retAge}`,             sub: `${yearsToRet} years away` },
          { label: "Desired Income",      value: fmt$(desired) + "/yr",       sub: "retirement goal" },
          { label: "Gov. Benefits",       value: fmt$(CPP_BASE + OAS_BASE) + "/yr", sub: `CPP @ ${cppAge} · OAS @ ${oasAge}` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-3.5">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1">{s.label}</div>
            <div className="text-sm font-bold text-slate-900">{s.value}</div>
            <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Ranked Recommendations — Highest Impact First
        </div>
        {recommendations.map((rec, i) => {
          const color     = CATEGORY_COLORS[rec.category];
          const isOpen    = expanded === rec.id;
          const priorityCls = PRIORITY_COLORS[rec.priority];

          return (
            <div key={rec.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div
                className="flex items-start gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : rec.id)}
              >
                {/* Rank */}
                <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-slate-500 mt-0.5">
                  {i + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">{rec.title}</span>
                    <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${priorityCls}`}>
                      {rec.priority}
                    </span>
                    <span className={`text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-${color}-50 text-${color}-600 border border-${color}-100`}>
                      {CATEGORY_LABELS[rec.category]}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{rec.description}</p>
                </div>

                {/* Impact + chevron */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-600">{rec.impact}</div>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3 bg-slate-50/50 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Advisor Action</div>
                      <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-3">
                        <ArrowRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">{rec.action}</p>
                      </div>
                    </div>
                    {rec.detail && (
                      <div>
                        <div className="text-[9px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Planning Detail</div>
                        <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-lg p-3">
                          <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 leading-relaxed">{rec.detail}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {recommendations.length === 0 && !running && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-emerald-800">Plan looks well-optimized</p>
              <p className="text-xs text-emerald-600 mt-0.5">No significant optimization opportunities detected at this time.</p>
            </div>
          </div>
        )}
      </div>

      {/* Combined impact note */}
      {recommendations.length > 1 && baseRate !== null && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
          <Zap className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <strong>Combined impact:</strong> Implementing the top 3 recommendations simultaneously could improve the success rate by more than the sum of individual impacts due to compounding effects. Model scenarios in the Projection tab to confirm.
          </span>
        </div>
      )}
    </div>
  );
}
