// client/src/components/planning/DebtDashboard.tsx
// Household Liability Optimization — Phase 1
// Gradient: dark navy left → light blue-white right

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export interface DebtRow {
  id: number;
  name: string;
  type?: string;
  category?: string;
  balance: string | number;
  interestRate: string | number | null;
  minimumPayment: string | number | null;
  payoffStrategy?: string | null;
  source?: string;
}

// ── Calculations ──────────────────────────────────────────────────────────────

function monthsToPayoff(balance: number, annualRate: number, monthlyPayment: number): number | null {
  if (balance <= 0 || monthlyPayment <= 0) return null;
  const r = annualRate / 100 / 12;
  if (r === 0) return Math.ceil(balance / monthlyPayment);
  if (monthlyPayment <= balance * r) return null;
  return Math.ceil(-Math.log(1 - (balance * r) / monthlyPayment) / Math.log(1 + r));
}

function calcLifetimeInterest(balance: number, annualRate: number, monthlyPayment: number): number {
  const months = monthsToPayoff(balance, annualRate, monthlyPayment);
  if (months === null) return 0;
  return Math.max(0, monthlyPayment * months - balance);
}

// ── Display maps ──────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  // lowercase_underscore (debt entries)
  mortgage: "Mortgage", heloc: "HELOC", car_loan: "Car Loan",
  credit_card: "Credit Card", student_loan: "Student Loan",
  line_of_credit: "Line of Credit", other: "Other",
  // Title Case (from liabilities/net worth)
  "Mortgage": "Mortgage", "Car Loan": "Car Loan", "Credit Card": "Credit Card",
  "HELOC": "HELOC", "Student Loan": "Student Loan", "Line of Credit": "Line of Credit",
};

const TYPE_COLOR: Record<string, string> = {
  // lowercase_underscore
  mortgage: "#6366f1", heloc: "#f59e0b", car_loan: "#10b981",
  credit_card: "#ef4444", student_loan: "#8b5cf6",
  line_of_credit: "#06b6d4", other: "#f97316",
  // Title Case
  "Mortgage": "#6366f1", "Car Loan": "#10b981", "Credit Card": "#ef4444",
  "HELOC": "#f59e0b", "Student Loan": "#8b5cf6",
  "Line of Credit": "#06b6d4", "Other": "#f97316",
};

const fmt$ = (v: number) =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

const fmtPct = (v: number) => `${v.toFixed(2)}%`;

// ── KPI Card ─────────────────────────────────────────────────────────────────
// dark=true → white text (left side of gradient)
// dark=false → navy text (right side of gradient)

function KpiCard({ label, value, sub, dark, valueColor }: {
  label: string; value: string; sub?: string; dark: boolean; valueColor: string;
}) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4">
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${dark ? "text-slate-400" : "text-slate-700"}`}>
        {label}
      </span>
      <span className={`text-xl font-bold tabular-nums leading-tight ${valueColor}`}>
        {value}
      </span>
      {sub && (
        <span className={`text-[11px] ${dark ? "text-slate-400" : "text-slate-600"}`}>{sub}</span>
      )}
    </div>
  );
}

function DonutTooltip({ active, payload, total }: {
  active?: boolean;
  payload?: { payload: { label: string; value: number } }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
  return (
    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="font-semibold text-white mb-0.5">{d.label}</div>
      <div className="text-slate-300">{fmt$(d.value)}</div>
      <div className="text-slate-500">{pct}% of total</div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function DebtDashboard({ rows }: { rows: DebtRow[] }) {
  const computed = useMemo(() => {
    const debts = rows.map(r => ({
      ...r,
      balance:        parseFloat(String(r.balance)) || 0,
      interestRate:   parseFloat(String(r.interestRate ?? "0")) || 0,
      minimumPayment: parseFloat(String(r.minimumPayment ?? "0")) || 0,
      type:           r.type ?? r.category ?? "other",
    }));

    const totalDebt        = debts.reduce((s, d) => s + d.balance, 0);
    const monthlyServicing = debts.reduce((s, d) => s + d.minimumPayment, 0);
    const totalInterest    = debts.reduce((s, d) =>
      s + calcLifetimeInterest(d.balance, d.interestRate, d.minimumPayment), 0);
    const weightedRate = totalDebt > 0
      ? debts.reduce((s, d) => s + d.interestRate * d.balance, 0) / totalDebt : 0;

    const byType: Record<string, number> = {};
    for (const d of debts) byType[d.type] = (byType[d.type] ?? 0) + d.balance;
    const pieData = Object.entries(byType).map(([type, value]) => ({
      type, value, label: TYPE_LABEL[type] ?? type, color: TYPE_COLOR[type] ?? "#94a3b8",
    }));

    const now = new Date();
    const timeline = debts
      .map(d => {
        const months = monthsToPayoff(d.balance, d.interestRate, d.minimumPayment);
        if (!months) return null;
        const payoffDate = new Date(now.getFullYear(), now.getMonth() + months);
        return {
          name: d.name, type: d.type, months,
          payoffLabel: payoffDate.toLocaleDateString("en-CA", { month: "short", year: "numeric" }),
          interest: calcLifetimeInterest(d.balance, d.interestRate, d.minimumPayment),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.months - b.months);
    return { totalDebt, monthlyServicing, totalInterest, weightedRate, pieData, timeline };
  }, [rows]);

  if (rows.length === 0) return null;

  const { totalDebt, monthlyServicing, totalInterest, weightedRate, pieData, timeline } = computed;
  const maxMonths = timeline.length > 0 ? timeline[timeline.length - 1].months : 1;
  const rateTone  = weightedRate > 15 ? "text-red-500" : weightedRate > 8 ? "text-amber-500" : "text-emerald-700";

  return (
    <div
      className="mb-6 rounded-2xl overflow-hidden shadow-lg border border-slate-200"
      style={{ background: "linear-gradient(to right, #0d2025 0%, #4c72ac 40%, #8298b3 75%, #b3c9e6 100%)" }}
    >
      {/* ── KPI Strip ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
        {/* Left two KPIs — dark bg, light text */}
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.12)" }}>
          <KpiCard label="Total Liability" value={fmt$(totalDebt)} dark={true} valueColor="text-red-400" />
        </div>
        <div style={{ borderRight: "1px solid rgba(255,255,255,0.12)" }}>
          <KpiCard label="Monthly Servicing" value={fmt$(monthlyServicing)} sub="minimum payments" dark={true} valueColor="text-amber-300" />
        </div>
        {/* Right two KPIs — light bg, dark text */}
        <div style={{ borderRight: "1px solid rgba(100, 143, 200, 0.25)" }}>
          <KpiCard label="Avg Interest Rate" value={fmtPct(weightedRate)} sub="debt-weighted" dark={false} valueColor={rateTone} />
        </div>
        <div>
          <KpiCard label="Lifetime Interest" value={fmt$(totalInterest)} sub="at current payments" dark={false} valueColor="text-red-600" />
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5" style={{ minHeight: 180 }}>

        {/* Donut — dark side */}
        <div className="col-span-2 p-5" style={{ borderRight: "1px solid rgba(255,255,255,0.12)" }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Debt Composition
          </p>
          <div className="flex items-center gap-4">
            <div className="w-[120px] h-[120px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={34} outerRadius={54}
                    dataKey="value" strokeWidth={0} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip content={<DonutTooltip total={totalDebt} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-2 min-w-0 flex-1">
              {pieData.map(d => (
                <div key={d.type} className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-xs text-slate-300 truncate flex-1">{d.label}</span>
                  <span className="text-xs text-white font-medium flex-shrink-0 tabular-nums">{fmt$(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Timeline — light side */}
        <div className="col-span-3 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 mb-3">
            Payoff Timeline
          </p>
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400 italic mt-4">
              Enter minimum payments to see payoff projections.
            </p>
          ) : (
            <div className="space-y-2.5">
              {timeline.map((item, i) => {
                const barPct = Math.max(12, (item.months / maxMonths) * 100);
                const color  = TYPE_COLOR[item.type] ?? "#94a3b8";
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-slate-900 font-semibold truncate flex-shrink-0">
                      {item.name}
                    </div>
                    <div className="flex-1 relative h-5 bg-slate-300/70 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                        style={{ width: `${barPct}%`, backgroundColor: color + "99" }}
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-semibold"
                        style={{ color: "#0c1e3a" }}>
                        {item.payoffLabel}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 w-20 text-right flex-shrink-0 tabular-nums">
                      +{fmt$(item.interest)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
