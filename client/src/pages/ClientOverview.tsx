import { useEffect, useState } from "react";
import { Users, PiggyBank, DollarSign, Shield, Target, Brain, ChevronRight } from "lucide-react";
import { translations, type T } from "../i18n/translations";

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  province?: string;
  annualIncome?: string;
  spouseFirstName?: string;
  spouseLastName?: string;
  spouseAnnualIncome?: string;
}

interface Overview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  retirementProjections: number;
  insuranceAnalyses: number;
  educationPlans: number;
  taxNotes: number;
  estateNotes: number;
  aiRecommendations: number;
  pendingAi: number;
  plans: number;
}

interface RetirementProjection {
  id: number;
  label: string;
  inputData: any;
  resultData?: any;
}

interface Policy {
  id: number;
  type: string;
  coverageAmount: string;
  premium: string;
  premiumFrequency: string;
}

interface Expense {
  id: number;
  monthlyAmount: string;
  includeInRetirement: boolean;
  retirementAdjustmentPct: number;
  category: string;
}

interface Goal {
  id: number;
  title: string;
  cashflowType: string;
  status: string;
}

async function get<T>(path: string): Promise<T> {
  const token = localStorage.getItem("fp_token");
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const fmt = (n: number) =>
  Math.abs(n) >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : Math.abs(n) >= 1000
    ? `$${Math.round(n / 1000).toLocaleString("en-CA")}K`
    : `$${Math.round(n).toLocaleString("en-CA")}`;

function Stat({ label, value, sub, color = "text-slate-900" }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function ModuleCard({ title, icon: Icon, value, insight, color = "text-blue-600", onClick }: {
  title: string; icon: any; value: string; insight: string; color?: string; onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:-translate-y-[1px] transition-all duration-200 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-slate-400" />
          <p className="text-sm font-medium text-slate-600">{title}</p>
        </div>
        {onClick && <ChevronRight className="w-4 h-4 text-slate-300" />}
      </div>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-1.5">{insight}</p>
    </div>
  );
}

export function ClientOverview({ client, onNavigate, t = translations.en }: { client: Client; onNavigate: (tab: string) => void; t?: T }) {
  const [ov, setOv]           = useState<Overview | null>(null);
  const [retPlans, setRetPlans] = useState<RetirementProjection[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [goals, setGoals]       = useState<Goal[]>([]);

  useEffect(() => {
    const id = client.id;
    Promise.all([
      get<Overview>(`/api/clients/${id}/overview`).then(setOv),
      get<RetirementProjection[]>(`/api/clients/${id}/retirement-projections`).then(setRetPlans),
      get<Policy[]>(`/api/clients/${id}/policies`).then(setPolicies),
      get<Expense[]>(`/api/clients/${id}/expenses`).then(setExpenses),
      get<Goal[]>(`/api/clients/${id}/goals`).then(setGoals),
    ]).catch(() => {});
  }, [client.id]);

  const householdName = `${client.firstName}${client.spouseFirstName ? ` & ${client.spouseFirstName}` : ""} ${client.lastName}`;

  // Retirement funded %
  const primaryPlan = retPlans.find(p => !p.inputData?.person || p.inputData?.person === "primary");
  const retFunded = primaryPlan?.resultData?.funded ?? primaryPlan?.resultData?.fundedPct ?? null;
  const retFundedStr = retFunded !== null ? `${Math.round(retFunded)}% funded` : retPlans.length > 0 ? `${retPlans.length} plan${retPlans.length > 1 ? "s" : ""}` : t.client.noRetirementPlan;

  // Life coverage
  const lifeCoverage = policies
    .filter(p => ["Term Life", "Whole Life", "Universal Life", "Term Life Insurance", "Whole Life Insurance"].some(t => p.type?.includes(t.split(" ")[0])))
    .reduce((s, p) => s + Number(p.coverageAmount || 0), 0);

  // Monthly expenses
  const totalMonthly = expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const topCat = Object.entries(
    expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + parseFloat(e.monthlyAmount || "0");
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0];

  // Active goals
  const activeGoals = goals.filter(g => g.status !== "completed");

  // Alerts
  const alerts: string[] = [];
  if (ov && ov.pendingAi > 0) alerts.push(`${ov.pendingAi} AI recommendation${ov.pendingAi > 1 ? "s" : ""} awaiting review`);
  if (retFunded !== null && retFunded < 80) alerts.push(`${t.client.retirementFundingBelow} ${Math.round(retFunded)}${t.client.belowTarget}`);
  if (lifeCoverage === 0 && policies.length > 0) alerts.push(t.common.noLifeInsurance);
  if (retPlans.length === 0) alerts.push(t.client.noRetProjectionFile);
  if (ov && ov.insuranceAnalyses === 0) alerts.push(t.client.noInsuranceAnalysisCompleted);

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{householdName} Household</h1>
          <p className="text-sm text-slate-500">
            {client.province ?? "—"}
            {client.annualIncome ? ` · Income: ${fmt(Number(client.annualIncome))}` : ""}
            {client.spouseAnnualIncome ? ` + ${fmt(Number(client.spouseAnnualIncome))}` : ""}
          </p>
        </div>
        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => onNavigate("expenses")} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-lg transition">{t.client.addExpenseBtn}</button>
          <button onClick={() => onNavigate("goals")} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-lg transition">{t.goals.addGoal}</button>
          <button onClick={() => onNavigate("networth")} className="flex items-center gap-1.5 text-xs font-medium bg-white border border-slate-200 text-slate-600 hover:border-blue-400 hover:text-blue-600 px-3 py-1.5 rounded-lg transition">{t.client.addAssetBtn}</button>
          <button onClick={() => onNavigate("retirementhub")} className="flex items-center gap-1.5 text-xs font-medium bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition">{t.client.addProjectionBtn}</button>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label={t.client.overview.netWorth}
          value={ov ? fmt(ov.netWorth) : "—"}
          sub={ov ? `${fmt(ov.totalAssets)} ${t.netWorth.assets}` : undefined}
          color={ov && ov.netWorth >= 0 ? "text-emerald-600" : "text-red-500"}
        />
        <Stat
          label={t.client.retirementCard}
          value={retFundedStr}
          sub={retPlans.length > 0 ? `${retPlans.length} projection${retPlans.length > 1 ? "s" : ""}` : undefined}
          color={retFunded !== null && retFunded < 80 ? "text-amber-600" : "text-blue-600"}
        />
        <Stat
          label={t.client.monthlySpend}
          value={totalMonthly > 0 ? `${fmt(totalMonthly)}/mo` : "—"}
          sub={topCat ? `${topCat[0]} is largest` : undefined}
        />
        <Stat
          label={t.client.lifeCoverage}
          value={lifeCoverage > 0 ? fmt(lifeCoverage) : policies.length === 0 ? "—" : t.client.noLifeIns}
          sub={policies.length > 0 ? `${policies.length} polic${policies.length > 1 ? "ies" : "y"}` : undefined}
          color={lifeCoverage === 0 && policies.length > 0 ? "text-red-500" : "text-slate-900"}
        />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm font-medium text-amber-700 mb-2">{t.client.advisorAlerts}</p>
          <ul className="text-sm text-amber-600 space-y-1">
            {alerts.map((a, i) => <li key={i}>• {a}</li>)}
          </ul>
        </div>
      )}

      {/* Module snapshots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModuleCard
          title={t.client.goalsCard}
          icon={Target}
          value={activeGoals.length > 0 ? `${activeGoals.length} ${activeGoals.length > 1 ? t.client.activeGoals2 : t.client.activeGoals}` : t.client.noGoalsCard}
          insight={activeGoals[0]?.title ?? t.client.addGoalsToTrack}
          color={activeGoals.length > 0 ? "text-blue-600" : "text-slate-400"}
          onClick={() => onNavigate("goals")}
        />
        <ModuleCard
          title={t.retirement.title}
          icon={PiggyBank}
          value={retFundedStr}
          insight={retFunded !== null && retFunded < 80 ? `${t.client.shortfallReview}` : retPlans.length === 0 ? t.client.addProjectionStart : t.client.onTrackAnnually}
          color={retFunded !== null && retFunded < 80 ? "text-amber-600" : retPlans.length === 0 ? "text-slate-400" : "text-emerald-600"}
          onClick={() => onNavigate("retirementhub")}
        />
        <ModuleCard
          title={t.client.cashFlowCard}
          icon={DollarSign}
          value={totalMonthly > 0 ? `${fmt(totalMonthly)}/mo` : t.client.noExpensesCard}
          insight={topCat ? `${topCat[0]} dominates at ${fmt(topCat[1])}/mo` : t.client.addExpensesForRet}
          color={totalMonthly > 0 ? "text-blue-600" : "text-slate-400"}
          onClick={() => onNavigate("expenses")}
        />
        <ModuleCard
          title={t.client.protectionCard}
          icon={Shield}
          value={lifeCoverage > 0 ? `${fmt(lifeCoverage)} life coverage` : policies.length > 0 ? `${policies.length} polic${policies.length > 1 ? "ies" : "y"} on file` : t.client.noPoliciesCard}
          insight={lifeCoverage === 0 && policies.length > 0 ? t.common.lifeInsGapReview : policies.length === 0 ? t.client.addInsurancePols : t.client.reviewCoverageAnnually}
          color={lifeCoverage === 0 && policies.length > 0 ? "text-red-500" : policies.length === 0 ? "text-slate-400" : "text-blue-600"}
          onClick={() => onNavigate("protection")}
        />
        {(ov?.educationPlans ?? 0) > 0 && (
          <ModuleCard
            title={t.client.educationResp}
            icon={Users}
            value={`${ov!.educationPlans} plan${ov!.educationPlans > 1 ? "s" : ""}`}
            insight={t.client.reviewContribRoom}
            onClick={() => onNavigate("fp")}
          />
        )}
        {(ov?.pendingAi ?? 0) > 0 && (
          <ModuleCard
            title={t.plan.aiInsights}
            icon={Brain}
            value={`${ov!.pendingAi} pending`}
            insight={t.client.reviewAiRecs}
            color="text-amber-600"
            onClick={() => onNavigate("ai")}
          />
        )}
      </div>

    </div>
  );
}
