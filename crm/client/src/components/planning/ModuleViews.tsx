import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";
import type { SimulationResult } from "@/hooks/use-plans";
import { Shield, GraduationCap, Landmark, CreditCard, Clock } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

function fmt(val: number): string {
  if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val.toFixed(0)}`;
}

export function CppOasTimingView({ assumptions, scenario, cppStartAge, oasStartAge, planToAge }: {
  assumptions: Array<{ scenario: string; cppStartAge: number; oasStartAge: number; planToAge: number }>;
}) {
  const { isFrench: isFr } = useLanguage();
  const cppMonthly2025 = 1364.60;
  const oasMonthly2025 = 727.67;

  const timingData = useMemo(() => {
    const ages = [60, 65, 70];
    return ages.map(age => {
      const cppFactor = age === 60 ? 0.64 : age === 65 ? 1.0 : 1.42;
      const oasFactor = age === 65 ? 1.0 : age === 70 ? 1.36 : 0.64;
      const cppMonthly = Math.round(cppMonthly2025 * cppFactor);
      const oasMonthly = Math.round(oasMonthly2025 * (age >= 65 ? oasFactor : 0));
      const total = cppMonthly + oasMonthly;
      const breakEvenVs65 = age === 65 ? null :
        age === 60 ? Math.round(65 + (cppMonthly2025 * 1.0 - cppMonthly2025 * 0.64) * 60 / (cppMonthly2025 * 1.0 * 12)) :
        Math.round(65 + (cppMonthly2025 * 1.42 - cppMonthly2025) * 60 / (cppMonthly2025 * 0.42 * 12));
      return { age, cppMonthly, oasMonthly, total, breakEvenVs65, cppFactor: `${(cppFactor * 100).toFixed(0)}%` };
    });
  }, []);

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="cpp-oas-timing">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-violet-600" />
        <h3 className="text-lg font-bold font-display">{isFr ? "Comparaison RPC/SV" : "CPP/OAS Timing Comparison"}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{isFr ? "Comparer le revenu mensuel projeté à différents âges de début" : "Compare projected monthly income at different start ages"}</p>
      <div className="grid grid-cols-3 gap-4">
        {timingData.map(d => (
          <div key={d.age} className={`border rounded-xl p-4 text-center ${d.age === 65 ? 'border-primary bg-primary/5' : 'border-border'}`} data-testid={`cpp-timing-age-${d.age}`}>
            <p className="text-2xl font-bold text-primary">{isFr ? `Âge ${d.age}` : `Age ${d.age}`}</p>
            <div className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? "RPC" : "CPP"}</span><span className="font-semibold">${d.cppMonthly}/mo</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? "SV" : "OAS"}</span><span className="font-semibold">${d.oasMonthly}/mo</span></div>
              <div className="border-t pt-2 flex justify-between"><span className="font-semibold">Total</span><span className="font-bold text-primary">${d.total}/mo</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? "Facteur RPC" : "CPP Factor"}</span><span className="text-xs font-medium">{d.cppFactor}</span></div>
              {d.breakEvenVs65 !== null && (
                <div className="flex justify-between"><span className="text-muted-foreground">{isFr ? "Seuil de rentabilité vs 65" : "Break-even vs 65"}</span><span className="text-xs font-medium">{isFr ? `~Âge ${d.breakEvenVs65}` : `~Age ${d.breakEvenVs65}`}</span></div>
              )}
            </div>
          </div>
        ))}
      </div>
      {assumptions.length > 0 && (
        <div className="mt-4 p-3 bg-muted/50 rounded-xl text-xs text-muted-foreground">
          {isFr ? `Le plan actuel utilise le RPC à ${assumptions[0].cppStartAge} ans, la SV à ${assumptions[0].oasStartAge} ans, plan jusqu'à ${assumptions[0].planToAge} ans` : `Current plan uses CPP at age ${assumptions[0].cppStartAge}, OAS at age ${assumptions[0].oasStartAge}, plan to age ${assumptions[0].planToAge}`}
        </div>
      )}
    </div>
  );
}

export function InsuranceMethodComparison({ analyses, id, annualIncome, recommendedLifeCoverage, lifeCoverageGap, recommendedDisabilityCoverage, disabilityCoverageGap, recommendedCriticalIllnessCoverage, criticalIllnessCoverageGap }: { // eslint-disable-line
  analyses: Array<{
    id: number;
    annualIncome: string;
    recommendedLifeCoverage: string | null;
    lifeCoverageGap: string | null;
    recommendedDisabilityCoverage: string | null;
    disabilityCoverageGap: string | null;
    recommendedCriticalIllnessCoverage: string | null;
    criticalIllnessCoverageGap: string | null;
  }>;
}) {
  const { isFrench: isFr } = useLanguage();
  const latest = analyses.length > 0 ? analyses[analyses.length - 1] : null;

  if (!latest) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-6 text-center text-muted-foreground" data-testid="empty-insurance-methods">
        <Shield className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{isFr ? "Aucune donnée d'analyse d'assurance disponible" : "No insurance analysis data available"}</p>
      </div>
    );
  }

  const chartData = [
    { type: "Life", recommended: Number(latest.recommendedLifeCoverage || 0), gap: Number(latest.lifeCoverageGap || 0) },
    { type: "Disability", recommended: Number(latest.recommendedDisabilityCoverage || 0) * 12, gap: Number(latest.disabilityCoverageGap || 0) * 12 },
    { type: "Critical Illness", recommended: Number(latest.recommendedCriticalIllnessCoverage || 0), gap: Number(latest.criticalIllnessCoverageGap || 0) },
  ].filter(d => d.recommended > 0);

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="insurance-method-comparison">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-purple-600" />
        <h3 className="text-lg font-bold font-display">{isFr ? "Analyse des lacunes de couverture" : "Coverage Gap Analysis"}</h3>
      </div>
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ left: 10, right: 20 }}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="type" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={65} />
            <Tooltip formatter={(value: number) => fmt(value)} />
            <Legend />
            <Bar dataKey="recommended" name="Recommended" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="gap" name="Gap" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          <div className="border border-border/50 rounded-xl p-4">
            <p className="text-sm font-semibold">Latest Analysis</p>
            <p className="text-2xl font-bold text-primary mt-1">Income: ${Number(latest.annualIncome).toLocaleString()}/yr</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function RespFundingGauge({ results, savings, childName, estimatedCost, currentBalance, monthlyContribution }: {
  results: SimulationResult[];
  savings: Array<{ childName: string; estimatedCost: string; currentBalance: string; monthlyContribution: string }>;
}) {
  const { isFrench: isFr } = useLanguage();
  const edResult = results.find(r => r.module === "education");
  const successRate = edResult ? Math.round(Number(edResult.successRate) * 100) : null;

  if (!savings.length && !edResult) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-6 text-center text-muted-foreground" data-testid="empty-resp-gauge">
        <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{isFr ? "Aucune donnée REEE disponible" : "No RESP data available"}</p>
      </div>
    );
  }

  const totalCost = savings.reduce((s, e) => s + Number(e.estimatedCost || 0), 0);
  const totalBal = savings.reduce((s, e) => s + Number(e.currentBalance || 0), 0);
  const totalMonthly = savings.reduce((s, e) => s + Number(e.monthlyContribution || 0), 0);
  const fundedPct = totalCost > 0 ? Math.min(100, Math.round((totalBal / totalCost) * 100)) : 0;

  const target90Monthly = totalCost > 0 && totalBal < totalCost
    ? Math.round((totalCost * 0.9 - totalBal) / (15 * 12))
    : 0;

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="resp-funding-gauge">
      <div className="flex items-center gap-2 mb-4">
        <GraduationCap className="w-5 h-5 text-teal-600" />
        <h3 className="text-lg font-bold font-display">{isFr ? "Progrès du financement REEE" : "RESP Funding Progress"}</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase">{isFr ? "Coût cible total" : "Total Cost Target"}</p>
          <p className="text-lg font-bold">${totalCost.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">{isFr ? "Solde actuel" : "Current Balance"}</p>
          <p className="text-lg font-bold text-green-600">${totalBal.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase">{isFr ? "Cotisation mensuelle" : "Monthly Contribution"}</p>
          <p className="text-lg font-bold">${totalMonthly.toLocaleString()}</p>
        </div>
        {successRate !== null && (
          <div>
            <p className="text-xs text-muted-foreground uppercase">{isFr ? "Probabilité de succès" : "Success Probability"}</p>
            <p className={`text-lg font-bold ${successRate >= 80 ? 'text-green-600' : successRate >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>{successRate}%</p>
          </div>
        )}
      </div>
      <div className="w-full bg-muted rounded-full h-4 mb-2" data-testid="resp-progress-bar">
        <div
          className={`h-4 rounded-full transition-all ${fundedPct >= 80 ? 'bg-green-500' : fundedPct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
          style={{ width: `${fundedPct}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{isFr ? `${fundedPct}% financé` : `${fundedPct}% funded`}</p>
      {target90Monthly > 0 && (
        <p className="text-sm text-violet-600 mt-2 font-medium" data-testid="text-resp-target-monthly">
          {isFr ? `Pour 90% de succès : ~${target90Monthly}$/mois requis` : `For 90% funding success: ~$${target90Monthly}/month required`}
        </p>
      )}
    </div>
  );
}

export function EstateScorecard({ notes, province, category }: {
  notes: Array<{ category: string }>;
  province?: string;
}) {
  const { isFrench: isFr } = useLanguage();
  const probateFees: Record<string, { name: string; description: string }> = {
    ontario: { name: "Ontario", description: "$5 per $1K (first $50K) + $15 per $1K thereafter" },
    quebec: { name: "Quebec", description: "No probate fees (notarized wills)" },
    british_columbia: { name: "British Columbia", description: "$0-$25K: none; $25K-$50K: $6/$1K; >$50K: $14/$1K" },
    alberta: { name: "Alberta", description: "Max $525 (flat fee structure)" },
    manitoba: { name: "Manitoba", description: "$70 + $7 per $1K over $10K" },
    saskatchewan: { name: "Saskatchewan", description: "$7 per $1K of estate value" },
    nova_scotia: { name: "Nova Scotia", description: "$87.10 + $16.74 per $1K over $10K" },
    new_brunswick: { name: "New Brunswick", description: "$5 per $1K of estate value" },
    newfoundland: { name: "Newfoundland", description: "$60 per $1K on first $1K; then $6 per $1K" },
    pei: { name: "PEI", description: "$4 per $1K of estate value (approx.)" },
  };

  const hasWill = notes.some(n => n.category === "Will");
  const hasPoa = notes.some(n => n.category === "Power of Attorney");
  const hasTrust = notes.some(n => n.category === "Trust");
  const hasBeneficiary = notes.some(n => n.category === "Beneficiary Designations");

  const checkItems = [
    { label: isFr ? "Testament" : "Will", done: hasWill },
    { label: isFr ? "Procuration" : "Power of Attorney", done: hasPoa },
    { label: isFr ? "Fiducie" : "Trust", done: hasTrust },
    { label: isFr ? "Désignations de bénéficiaires" : "Beneficiary Designations", done: hasBeneficiary },
  ];

  const score = checkItems.filter(i => i.done).length;
  const scoreColor = score >= 3 ? "text-green-600" : score >= 2 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="estate-scorecard">
      <div className="flex items-center gap-2 mb-4">
        <Landmark className="w-5 h-5 text-indigo-600" />
        <h3 className="text-lg font-bold font-display">{isFr ? "Bilan de l'efficacité successorale" : "Estate Efficiency Scorecard"}</h3>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold mb-2">{isFr ? "Préparation successorale" : "Estate Readiness"}</p>
          <p className={`text-3xl font-bold ${scoreColor}`}>{score}/{checkItems.length}</p>
          <div className="mt-3 space-y-2">
            {checkItems.map(item => (
              <div key={item.label} className="flex items-center gap-2 text-sm" data-testid={`estate-check-${item.label.toLowerCase().replace(/\s+/g, '-')}`}>
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${item.done ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {item.done ? '\u2713' : '\u2717'}
                </span>
                <span className={item.done ? '' : 'text-muted-foreground'}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold mb-2">{isFr ? "Frais d'homologation" : "Probate Fee Schedule"}</p>
          {province && probateFees[province] ? (
            <div className="p-3 bg-muted/50 rounded-xl">
              <p className="font-semibold text-sm">{probateFees[province].name}</p>
              <p className="text-xs text-muted-foreground mt-1">{probateFees[province].description}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{isFr ? "Sélectionnez une province dans les hypothèses pour voir les frais d'homologation" : "Select a province in assumptions to see probate fees"}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function DebtPayoffTimeline({ debts }: {
  debts: Array<{ id: number; name: string; balance: string; interestRate: string; minimumPayment: string }>;
}) {
  const { isFrench: isFr } = useLanguage();
  const timelineData = useMemo(() => {
    if (debts.length === 0) return [];
    return debts
      .filter(d => Number(d.balance) > 0)
      .map(d => {
        const balance = Number(d.balance);
        const rate = Number(d.interestRate) / 100 / 12;
        const payment = Math.max(Number(d.minimumPayment), 1);
        let months = 0;
        if (rate > 0) {
          const val = Math.log(payment / (payment - balance * rate)) / Math.log(1 + rate);
          months = Math.ceil(isFinite(val) && val > 0 ? val : balance / payment);
        } else {
          months = Math.ceil(balance / payment);
        }
        const totalInterest = Math.max(0, payment * months - balance);
        return { name: d.name, balance, months: Math.min(months, 600), years: +(Math.min(months, 600) / 12).toFixed(1), totalInterest, payment };
      })
      .sort((a, b) => a.months - b.months);
  }, [debts]);

  if (timelineData.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-2xl p-6 text-center text-muted-foreground" data-testid="empty-debt-timeline">
        <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">{isFr ? "Aucune donnée de dette pour la chronologie" : "No debt data for timeline"}</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl p-6" data-testid="debt-payoff-timeline">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="w-5 h-5 text-orange-600" />
        <h3 className="text-lg font-bold font-display">{isFr ? "Calendrier de remboursement des dettes" : "Debt Payoff Timeline"}</h3>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(180, timelineData.length * 45)}>
        <BarChart data={timelineData} layout="vertical" margin={{ left: 100, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
          <XAxis type="number" label={{ value: isFr ? "Années avant remboursement" : "Years to Payoff", position: "insideBottom", offset: -2 }} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
          <Tooltip formatter={(value: number, name: string) => name === "years" ? `${value} years` : fmt(value)} />
          <Bar dataKey="years" name={isFr ? "Années avant remboursement" : "Years to Payoff"} radius={[0, 4, 4, 0]}>
            {timelineData.map((entry) => (
              <Cell key={entry.name} fill={entry.years > 10 ? "#ef4444" : entry.years > 5 ? "#f59e0b" : "#22c55e"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1">
        {timelineData.map(d => (
          <div key={d.name} className="flex justify-between text-xs text-muted-foreground" data-testid={`debt-timeline-${d.name.toLowerCase().replace(/\s+/g, '-')}`}>
            <span>{d.name}</span>
            <span>
              {isFr ? `${d.years} ans | ${d.payment}$/mois | Intérêts : ${fmt(d.totalInterest)}` : `${d.years}yr | $${d.payment}/mo | Interest: ${fmt(d.totalInterest)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
