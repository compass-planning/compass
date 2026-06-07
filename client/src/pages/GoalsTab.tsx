import { translations, type T } from "../i18n/translations";
import { Component, type ReactNode } from "react";

class GoalErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <p className="font-bold mb-1">Goal form error (share with dev):</p>
          <pre className="text-xs overflow-auto">{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { toast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { InlineEdit } from "@/components/ui/InlineEdit";
import {
  Target, Plus, Trash2, Pencil, X, Save, TrendingDown, TrendingUp,
  RefreshCw, Home, Car, GraduationCap, Plane, Shield, Star, DollarSign,
  Calendar, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Mic,
} from "lucide-react";
import { VoiceAddDialog } from "../components/VoiceAddDialog";

// ── Types ────────────────────────────────────────────────────────────────────

interface Goal {
  id: number;
  goalType: string;
  title: string;
  targetAmount: string | null;
  currentAmount: string | null;
  targetDate: string | null;
  status: string;
  notes: string | null;
  // projection fields
  cashflowType: string | null;
  targetYear: number | null;
  projectionImpact: boolean | null;
  priority: number | null;
  monthlyContribution: string | null;
  inflationAdjust: boolean | null;
  startYear: number | null;
  endYear: number | null;
  annualAmount: string | null;
  fundingSource: string | null;
}

// ── Goal type config ─────────────────────────────────────────────────────────

// ── Static data (no translated strings — safe at module level) ───────────────
const GOAL_TYPE_STATIC = [
  { key: "major_purchase",   icon: Home,         cashflowType: "outflow"           },
  { key: "windfall",         icon: TrendingUp,   cashflowType: "inflow"            },
  { key: "education",        icon: GraduationCap,cashflowType: "savings_target"    },
  { key: "emergency_fund",   icon: Shield,       cashflowType: "savings_target"    },
  { key: "travel_lifestyle", icon: Plane,        cashflowType: "recurring_expense" },
  { key: "debt_free",        icon: TrendingDown, cashflowType: "outflow"           },
  { key: "retirement",       icon: Star,         cashflowType: "savings_target"    },
  { key: "custom",           icon: Target,       cashflowType: "savings_target"    },
];

// Static key→colour only; labels come from t
const PRIORITY_COLORS: Record<number, string> = {
  1: "text-rose-600   bg-rose-50   border-rose-200",
  2: "text-amber-600  bg-amber-50  border-amber-200",
  3: "text-blue-600   bg-blue-50   border-blue-200",
  4: "text-slate-600  bg-slate-100 border-slate-200",
  5: "text-slate-500  bg-slate-50  border-slate-200",
};

const STATUS_DOTS: Record<string, string> = {
  in_progress: "bg-blue-500",
  on_track:    "bg-green-500",
  at_risk:     "bg-amber-500",
  completed:   "bg-gray-400",
};

// ── Factory functions — call these inside components where t is available ─────
function goalTypes(t: T) {
  return [
    { key: "major_purchase",   label: t.goals.majorPurchase,   icon: Home,         cashflowType: "outflow",           desc: t.goals.majorPurchaseDesc },
    { key: "windfall",         label: t.goals.windfall,        icon: TrendingUp,   cashflowType: "inflow",            desc: t.goals.windfallDesc      },
    { key: "education",        label: t.goals.education,       icon: GraduationCap,cashflowType: "savings_target",    desc: t.goals.educationDesc     },
    { key: "emergency_fund",   label: t.goals.emergencyFund,   icon: Shield,       cashflowType: "savings_target",    desc: t.goals.emergencyFundDesc },
    { key: "travel_lifestyle", label: t.goals.travelLifestyle, icon: Plane,        cashflowType: "recurring_expense", desc: t.goals.travelDesc        },
    { key: "debt_free",        label: t.goals.debtFree,        icon: TrendingDown, cashflowType: "outflow",           desc: t.goals.debtFreeDesc      },
    { key: "retirement",       label: t.goals.retirement,      icon: Star,         cashflowType: "savings_target",    desc: t.goals.retirementDesc    },
    { key: "custom",           label: t.goals.customGoal,      icon: Target,       cashflowType: "savings_target",    desc: t.goals.customGoalDesc    },
  ];
}

function fundingSources(t: T) {
  return [
    { key: "non_reg",   label: t.goals.nonRegistered },
    { key: "tfsa",      label: "TFSA"                },
    { key: "rrsp",      label: "RRSP"                },
    { key: "cash",      label: t.goals.cashSavings   },
    { key: "automatic", label: t.goals.autoEngine    },
  ];
}

function priorityLabels(t: T): Record<number, { label: string; color: string }> {
  return {
    1: { label: t.common.critical,   color: PRIORITY_COLORS[1] },
    2: { label: t.common.high,       color: PRIORITY_COLORS[2] },
    3: { label: t.common.medium,     color: PRIORITY_COLORS[3] },
    4: { label: t.common.low,        color: PRIORITY_COLORS[4] },
    5: { label: t.common.niceToHave, color: PRIORITY_COLORS[5] },
  };
}

function statusConfig(t: T): Record<string, { label: string; dot: string }> {
  return {
    in_progress: { label: t.common.inProgress, dot: STATUS_DOTS.in_progress },
    on_track:    { label: t.common.onTrack,    dot: STATUS_DOTS.on_track    },
    at_risk:     { label: t.common.atRisk,     dot: STATUS_DOTS.at_risk     },
    completed:   { label: t.goals.completed,   dot: STATUS_DOTS.completed   },
  };
}

// Keep GOAL_TYPES at module level for emptyForm (uses only cashflowType, not labels)
const GOAL_TYPES = GOAL_TYPE_STATIC;

const CURRENT_YEAR = new Date().getFullYear();

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: string | number | null) =>
  n ? "$" + Number(n).toLocaleString("en-CA", { maximumFractionDigits: 0 }) : "—";

function emptyForm(typeKey = "major_purchase") {
  const typeInfo = GOAL_TYPES.find(t => t.key === typeKey) ?? GOAL_TYPES[0];
  return {
    goalType:           typeKey,
    title:              "",
    targetAmount:       "",
    currentAmount:      "",
    targetDate:         "",
    status:             "in_progress",
    notes:              "",
    cashflowType:       typeInfo.cashflowType,
    targetYear:         String(CURRENT_YEAR + 5),
    projectionImpact:   false,
    priority:           3,
    monthlyContribution:"",
    inflationAdjust:    true,
    startYear:          String(CURRENT_YEAR + 1),
    endYear:            String(CURRENT_YEAR + 5),
    annualAmount:       "",
    fundingSource:      "non_reg",
  };
}

// ── Timeline Component ───────────────────────────────────────────────────────

function GoalTimeline({ goals, clientAge }: { goals: Goal[]; clientAge?: number }) {
  const startYear = CURRENT_YEAR;
  const endYear   = CURRENT_YEAR + (clientAge ? Math.max(5, 90 - clientAge) : 30);
  const span      = endYear - startYear;
  const impactGoals = goals.filter(g => g.targetYear || g.startYear);

  if (impactGoals.length === 0) return null;

  const pct = (year: number) => Math.max(0, Math.min(100, ((year - startYear) / span) * 100));

  return (
    <div className="relative h-10">
      <div className="relative h-8">
        {/* Track */}
        <div className="absolute top-3.5 left-0 right-0 h-0.5 bg-slate-200 rounded" />
        {/* Year labels */}
        {[0, 25, 50, 75, 100].map(p => {
          const yr = Math.round(startYear + (span * p / 100));
          return (
            <span key={p} className="absolute top-5 text-[9px] text-slate-400 -translate-x-1/2" style={{ left: `${p}%` }}>
              {yr}
            </span>
          );
        })}
        {/* Goal pins */}
        {impactGoals.map(g => {
          const year = g.cashflowType === "recurring_expense" ? (g.startYear ?? CURRENT_YEAR) : (g.targetYear ?? CURRENT_YEAR);
          const left = pct(year);
          const typeInfo = GOAL_TYPES.find(t => t.key === g.goalType) ?? GOAL_TYPES[7];
          const Icon = typeInfo.icon;
          const isOutflow = g.cashflowType === "outflow" || g.cashflowType === "recurring_expense";
          return (
            <div key={g.id} className="absolute -translate-x-1/2 top-0 flex flex-col items-center" style={{ left: `${left}%` }}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${isOutflow ? "bg-rose-50" : "bg-emerald-50"}`}
                title={`${g.title} (${year})`}>
                <Icon className={`w-3.5 h-3.5 ${isOutflow ? "text-rose-500" : "text-emerald-600"}`} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Goal Card ────────────────────────────────────────────────────────────────

function GoalCard({ goal, t, onEdit, onDelete, onInlineUpdate }: { goal: Goal; t: T; onEdit: () => void; onDelete: () => void; onInlineUpdate: (id: number, data: Partial<Goal>) => void }) {
  const GOAL_TYPES      = goalTypes(t);
  const FUNDING_SOURCES = fundingSources(t);
  const PRIORITY_LABELS = priorityLabels(t);
  const STATUS_CONFIG   = statusConfig(t);
  const typeInfo  = GOAL_TYPES.find(t => t.key === goal.goalType) ?? GOAL_TYPES[7];
  const Icon      = typeInfo.icon;
  const priority  = PRIORITY_LABELS[goal.priority ?? 3] ?? PRIORITY_LABELS[3];
  const status    = STATUS_CONFIG[goal.status] ?? STATUS_CONFIG.in_progress;
  const isOutflow = goal.cashflowType === "outflow" || goal.cashflowType === "recurring_expense";
  const hasProgress = goal.cashflowType === "savings_target" && goal.targetAmount && Number(goal.targetAmount) > 0;
  const pct = hasProgress ? Math.min(100, (Number(goal.currentAmount || 0) / Number(goal.targetAmount)) * 100) : 0;
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(goal.notes ?? "");
  const [notesSaving, setNotesSaving] = useState(false);

  async function saveNotes() {
    setNotesSaving(true);
    try { await onInlineUpdate(goal.id, { notes }); } finally { setNotesSaving(false); }
  }

  return (
    <div className={`bg-white border rounded-2xl p-5 hover:shadow-sm transition-shadow ${goal.projectionImpact ? "border-cyan-300 ring-1 ring-cyan-200" : "border-slate-200"}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isOutflow ? "bg-rose-50" : "bg-blue-50"}`}>
            <Icon className={`w-5 h-5 ${isOutflow ? "text-rose-500" : "text-blue-500"}`} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-slate-900 text-sm" onClick={e => e.stopPropagation()}>
              <InlineEdit
                value={goal.title}
                onSave={v => onInlineUpdate(goal.id, { title: v } as any)}
                className="font-semibold text-slate-900 text-sm"
                placeholder={t.goals.goalTitle}
              />
            </div>
            <p className="text-xs text-slate-500">{typeInfo.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {goal.projectionImpact && (
            <span className="text-[9px] font-bold bg-cyan-500 text-white px-1.5 py-0.5 rounded">{t.goals.inPlan}</span>
          )}
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-md font-medium">
            {status.label}
          </span>
          <button onClick={onEdit} className="p-1 text-slate-400 hover:text-blue-600"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Key numbers — inline editable */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {goal.cashflowType === "recurring_expense" ? (
          <>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 mb-0.5">{t.goals.annualCost}</p>
              <div className="text-sm font-bold text-slate-900 font-mono" onClick={e => e.stopPropagation()}>
                <InlineEdit
                  value={goal.annualAmount ?? "0"}
                  type="number"
                  format={v => fmt$(Number(v))}
                  onSave={v => onInlineUpdate(goal.id, { annualAmount: v } as any)}
                  inputClassName="w-28"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 mb-0.5">{t.plan.timeline}</p>
              <p className="text-sm font-bold text-slate-900 font-mono">{goal.startYear} – {goal.endYear}</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 mb-0.5">
                {goal.cashflowType === "inflow" ? t.goals.expectedAmount : t.goals.targetAmount}
              </p>
              <div className={`text-sm font-bold font-mono ${isOutflow ? "text-rose-500" : goal.cashflowType === "inflow" ? "text-emerald-600" : "text-slate-900"}`} onClick={e => e.stopPropagation()}>
                <InlineEdit
                  value={goal.targetAmount ?? "0"}
                  type="number"
                  format={v => `${isOutflow && goal.cashflowType !== "inflow" ? "−" : ""}${fmt$(Number(v))}`}
                  onSave={v => onInlineUpdate(goal.id, { targetAmount: v } as any)}
                  inputClassName="w-28"
                />
              </div>
            </div>
            <div className="bg-slate-50 rounded-xl px-3 py-2">
              <p className="text-[10px] text-slate-500 mb-0.5">{t.goals.targetYear}</p>
              <div className="text-sm font-bold text-slate-900 font-mono" onClick={e => e.stopPropagation()}>
                <InlineEdit
                  value={String(goal.targetYear ?? "")}
                  type="number"
                  format={v => String(v) || "—"}
                  onSave={v => onInlineUpdate(goal.id, { targetYear: Number(v) } as any)}
                  inputClassName="w-20"
                  placeholder={t.common.year}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Progress bar */}
      {hasProgress && (
        <div className="mb-3">
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>{fmt$(goal.currentAmount)} saved</span>
            <span>{pct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Monthly contribution */}
      {goal.monthlyContribution && Number(goal.monthlyContribution) > 0 && (
        <p className="text-xs text-slate-600 mb-2">
          <span className="font-semibold font-mono">{fmt$(goal.monthlyContribution)}/mo</span> contributing
        </p>
      )}

      {/* Footer + expand toggle */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${priority.color}`}>
          {priority.label}
        </span>
        <div className="flex items-center gap-2">
          {goal.fundingSource && goal.fundingSource !== "automatic" && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
              {FUNDING_SOURCES.find(f => f.key === goal.fundingSource)?.label ?? goal.fundingSource}
            </span>
          )}
          <button
            onClick={() => setNotesOpen(o => !o)}
            className="text-xs text-blue-600 hover:underline"
          >
            {notesOpen ? t.common.hideNotes : (goal.notes ? t.common.notesDown : t.common.addNotes)}
          </button>
        </div>
      </div>

      {/* Expand — notes */}
      {notesOpen && (
        <div className="mt-3 space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Add advisor notes, assumptions, follow-up items…"
            rows={3}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none transition resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setNotes(goal.notes ?? ""); setNotesOpen(false); }} className="text-xs text-slate-500 hover:text-slate-700">{t.common.cancel}</button>
            <button onClick={saveNotes} disabled={notesSaving} className="text-xs text-blue-600 font-semibold hover:underline disabled:opacity-50">
              {notesSaving ? t.common.saving : t.goals.saveNotes}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Goal Form ────────────────────────────────────────────────────────────────

function GoalForm({
  initial, onSave, onCancel, busy, clientId, t,
}: {
  initial: ReturnType<typeof emptyForm>;
  onSave: (f: ReturnType<typeof emptyForm>) => void;
  onCancel: () => void;
  busy: boolean;
  clientId: number;
  t: T;
}) {
  const GOAL_TYPES      = goalTypes(t);
  const FUNDING_SOURCES = fundingSources(t);
  const PRIORITY_LABELS = priorityLabels(t);
  const STATUS_CONFIG   = statusConfig(t);
  const [form, setForm] = useState(initial);
  const [liabilities, setLiabilities] = useState<Array<{
    id: number; name: string | null; category: string | null;
    balance: number; interestRate: number | null;
    minimumPayment: number | null; annualCost: number | null; source: string;
  }>>([]);
  const [selectedLiabilities, setSelectedLiabilities] = useState<Set<number>>(new Set());
  const upd = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));
  const typeInfo = GOAL_TYPES.find(t => t.key === form.goalType) ?? GOAL_TYPES[0];

  // Load liabilities when debt_free type selected
  useEffect(() => {
    if (form.goalType === "debt_free" && liabilities.length === 0) {
      api.get<any[]>(`/api/clients/${clientId}/liabilities`)
        .then(setLiabilities)
        .catch(() => {});
    }
  }, [form.goalType]);

  function toggleLiability(id: number) {
    setSelectedLiabilities(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);

      // Recalculate totals from new selection
      const selected = liabilities.filter(l => next.has(l.id));
      const totalBalance = selected.reduce((s, l) => s + l.balance, 0);
      const totalAnnual  = selected.reduce((s, l) => s + (l.annualCost ?? 0), 0);
      const names = selected.map(l => l.name || l.category || t.goals.debt).join(", ");

      setForm(f => ({
        ...f,
        title:        selected.length === 1 ? `Pay off ${names}` : selected.length > 1 ? `Pay off: ${names}` : f.title,
        targetAmount: String(Math.round(totalBalance)),
        annualAmount: totalAnnual > 0 ? String(Math.round(totalAnnual)) : f.annualAmount,
        cashflowType: "outflow",
      }));

      return next;
    });
  }

  // When goalType changes, update cashflowType to default for that type
  function changeType(key: string) {
    const info = GOAL_TYPES.find(t => t.key === key) ?? GOAL_TYPES[0];
    setForm(f => ({ ...f, goalType: key, cashflowType: info.cashflowType }));
  }

  const isRecurring = form.cashflowType === "recurring_expense";
  const isSavings   = form.cashflowType === "savings_target";
  const isOneTime   = form.cashflowType === "outflow" || form.cashflowType === "inflow";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--bg-card)] border-b border-[var(--border-subtle)] px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="text-base font-bold text-[var(--text-primary)]">{initial.title ? t.goals.editGoal : t.goals.newGoal}</h3>
          <button onClick={onCancel} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Goal Type */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1.5">{t.goals.goalType}</label>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_TYPES.map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => changeType(t.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs transition-all ${
                      form.goalType === t.key
                        ? "border-[var(--accent-cyan)] bg-[var(--accent-cyan)]/10 text-[var(--accent-cyan)] font-semibold"
                        : "border-[var(--border-light)] text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-white/5"
                    }`}>
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">{typeInfo.desc}</p>
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.goalTitleLabel}</label>
            <input value={form.title} onChange={e => upd("title", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0 placeholder:text-[var(--text-tertiary)]"
              placeholder={typeInfo.label + " " + t.goals.title} />
          </div>

          {/* Cashflow type override */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.cashflowType}</label>
            <select value={form.cashflowType} onChange={e => upd("cashflowType", e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0">
              <option value="outflow">One-time outflow (expense)</option>
              <option value="inflow">One-time inflow (receipt)</option>
              <option value="savings_target">Savings target (accumulation)</option>
              <option value="recurring_expense">Recurring annual expense</option>
            </select>
          </div>

          {/* Liability multi-select for debt_free goals */}
          {form.goalType === "debt_free" && liabilities.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1.5">
                Select Liabilities to Pay Off
                {selectedLiabilities.size > 0 && (
                  <span className="ml-2 text-[var(--accent-cyan)] font-bold">{selectedLiabilities.size} selected</span>
                )}
              </label>
              <div className="border border-[var(--border-light)] rounded-xl overflow-hidden divide-y divide-[var(--border-subtle)]">
                {liabilities.map(l => {
                  const isSelected = selectedLiabilities.has(l.id);
                  const label = l.name || l.category || `Liability #${l.id}`;
                  return (
                    <div key={l.id} onClick={() => toggleLiability(l.id)}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${isSelected ? "bg-[var(--accent-cyan)]/[0.07]" : "hover:bg-white/5"}`}>
                      <div className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? "bg-[var(--accent-cyan)] border-[var(--accent-cyan)]" : "border-[var(--border-light)]"}`}>
                        {isSelected && <svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" fill={t.report.none} strokeLinecap="round"/></svg>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text-primary)]">{label}</p>
                        <p className="text-xs text-[var(--text-tertiary)]">
                          {l.interestRate != null ? `${l.interestRate}% · ` : ""}
                          {l.minimumPayment ? `$${l.minimumPayment.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo` : ""}
                          {l.annualCost ? ` · $${l.annualCost.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr` : ""}
                        </p>
                      </div>
                      <p className={`text-sm font-bold flex-shrink-0 font-mono ${isSelected ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"}`}>
                        ${l.balance.toLocaleString("en-CA", { maximumFractionDigits: 0 })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Totals row */}
              {selectedLiabilities.size > 0 && (() => {
                const sel = liabilities.filter(l => selectedLiabilities.has(l.id));
                const totalBalance = sel.reduce((s, l) => s + l.balance, 0);
                const totalAnnual  = sel.reduce((s, l) => s + (l.annualCost ?? 0), 0);
                const totalMonthly = sel.reduce((s, l) => s + (l.minimumPayment ?? 0), 0);
                return (
                  <div className="mt-2 bg-[var(--accent-cyan)]/[0.07] rounded-xl px-3 py-2.5 grid grid-cols-3 gap-2">
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">Total Balance</p>
                      <p className="text-sm font-bold text-[var(--accent-cyan)] font-mono">${totalBalance.toLocaleString("en-CA", { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">Monthly Payments</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] font-mono">${totalMonthly.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/mo</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--text-tertiary)]">{t.goals.annualCost}</p>
                      <p className="text-sm font-bold text-[var(--text-primary)] font-mono">${totalAnnual.toLocaleString("en-CA", { maximumFractionDigits: 0 })}/yr</p>
                    </div>
                  </div>
                );
              })()}
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1.5">Selecting liabilities auto-fills the title, target amount, and annual cost below</p>
            </div>
          )}

          {/* One-time fields */}
          {isOneTime && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">
                  {form.cashflowType === "inflow" ? t.goals.expectedAmount : t.goals.targetAmount}
                </label>
                <input type="number" value={form.targetAmount} onChange={e => upd("targetAmount", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0" placeholder="0" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.targetYear}</label>
                <input type="number" value={form.targetYear} onChange={e => upd("targetYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
            </div>
          )}

          {/* Savings target fields */}
          {isSavings && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Target Amount ($)</label>
                  <input type="number" value={form.targetAmount} onChange={e => upd("targetAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0" placeholder="0" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Current Balance ($)</label>
                  <input type="number" value={form.currentAmount} onChange={e => upd("currentAmount", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0" placeholder="0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.targetYear}</label>
                  <input type="number" value={form.targetYear} onChange={e => upd("targetYear", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0"
                    min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Monthly Contribution ($)</label>
                  <input type="number" value={form.monthlyContribution} onChange={e => upd("monthlyContribution", e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0" placeholder="0" />
                </div>
              </div>
            </>
          )}

          {/* Recurring expense fields */}
          {isRecurring && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.startYear}</label>
                <input type="number" value={form.startYear} onChange={e => upd("startYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.endYear}</label>
                <input type="number" value={form.endYear} onChange={e => upd("endYear", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0"
                  min={CURRENT_YEAR} max={CURRENT_YEAR + 60} />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Annual Cost ($)</label>
                <input type="number" value={form.annualAmount} onChange={e => upd("annualAmount", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0" placeholder="0" />
              </div>
            </div>
          )}

          {/* Priority, status, funding */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Priority</label>
              <select value={form.priority} onChange={e => upd("priority", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0">
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Status</label>
              <select value={form.status} onChange={e => upd("status", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">{t.goals.fundingSource}</label>
              <select value={form.fundingSource} onChange={e => upd("fundingSource", e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0">
                {FUNDING_SOURCES.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Inflation adjust */}
          <div className="flex items-center justify-between bg-[var(--bg-panel)] border border-[var(--border-subtle)] rounded-xl px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)]">{t.goals.inflationAdjust}</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Grow the goal amount with inflation to target year</p>
            </div>
            <button onClick={() => upd("inflationAdjust", !form.inflationAdjust)}
              className={`transition-colors ${form.inflationAdjust ? "text-[var(--accent-cyan)]" : "text-[var(--text-tertiary)]"}`}>
              {form.inflationAdjust ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {/* Projection impact toggle */}
          <div className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all ${
            form.projectionImpact ? "bg-[var(--accent-cyan)]/[0.07] border-[var(--accent-cyan)]/25" : "bg-[var(--bg-panel)] border-[var(--border-subtle)]"
          }`}>
            <div>
              <p className={`text-xs font-semibold ${form.projectionImpact ? "text-[var(--accent-cyan)]" : "text-[var(--text-secondary)]"}`}>
                Include in Monte Carlo projection
              </p>
              <p className="text-[10px] text-[var(--text-tertiary)]">
                {form.projectionImpact
                  ? t.goals.injectedAsCashflow
                  : t.goals.enableRetirement}
              </p>
            </div>
            <button onClick={() => upd("projectionImpact", !form.projectionImpact)}
              className={`transition-colors ${form.projectionImpact ? "text-[var(--accent-cyan)]" : "text-[var(--text-tertiary)]"}`}>
              {form.projectionImpact ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold text-[var(--text-tertiary)] block mb-1">Notes (optional)</label>
            <textarea value={form.notes} onChange={e => upd("notes", e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-light)] bg-[var(--bg-panel)] text-[var(--text-primary)] text-sm resize-none focus:outline-none focus:border-[var(--accent-cyan)] focus:ring-0 placeholder:text-[var(--text-tertiary)]"
              placeholder={t.goals.additionalContext} />
          </div>
        </div>

        <div className="sticky bottom-0 bg-[var(--bg-card)] border-t border-[var(--border-subtle)] px-6 py-4 flex gap-3 justify-end rounded-b-2xl">
          <button onClick={onCancel} className="text-sm text-[var(--text-secondary)] px-4 py-2 hover:text-[var(--text-primary)]">{t.common.cancel}</button>
          <button onClick={() => onSave(form)} disabled={busy || !form.title}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] hover:opacity-90 disabled:opacity-50 text-[var(--bg-base)] text-sm font-semibold px-5 py-2.5 rounded-xl">
            <Save className="w-3.5 h-3.5" />
            {busy ? t.common.saving : t.goals.saveGoal}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Summary Bar ──────────────────────────────────────────────────────────────

function Stat({ label, value, color = "text-slate-900" }: any) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>
        {value}
      </p>
    </div>
  );
}

function GoalsSummary({ goals, t }: { goals: Goal[]; t: T }) {
  const totalOutflows = goals
    .filter(g => g.cashflowType === "outflow" || g.cashflowType === "recurring_expense")
    .reduce((s, g) => {
      if (g.cashflowType === "recurring_expense" && g.annualAmount && g.startYear && g.endYear) {
        return s + parseFloat(g.annualAmount) * (g.endYear - g.startYear + 1);
      }
      return s + parseFloat(g.targetAmount || "0");
    }, 0);
  const totalInflows = goals
    .filter(g => g.cashflowType === "inflow")
    .reduce((s, g) => s + parseFloat(g.targetAmount || "0"), 0);
  const inPlan = goals.filter(g => g.projectionImpact).length;
  const totalMonthly = goals
    .filter(g => g.cashflowType === "savings_target" && g.monthlyContribution)
    .reduce((s, g) => s + parseFloat(g.monthlyContribution || "0"), 0);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
      <Stat label={t.goals.totalGoals}        value={goals.length}        color="text-slate-900" />
      <Stat label={t.goals.projectedOutflows} value={fmt$(totalOutflows)} color="text-red-500" />
      <Stat label={t.goals.expectedInflows}   value={fmt$(totalInflows)}  color="text-emerald-600" />
      <Stat label={t.goals.inMonteCarlo}     value={inPlan}              color="text-blue-600" />
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function GoalsTab({ clientId, client, t = translations.en }: { clientId: number; client?: any; t?: T }) {
  const [goals, setGoals]       = useState<Goal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [busy, setBusy]         = useState(false);
  const [filter, setFilter]     = useState<"all" | "plan" | "savings" | "events">("all");

  const clientAge = client?.dateOfBirth
    ? new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()
    : undefined;

  const load = () => api.get<Goal[]>(`/api/clients/${clientId}/goals`).then(setGoals).catch(() => {});
  useEffect(() => { load(); }, [clientId]);

  function openNew() {
    setEditingGoal(null);
    setShowForm(true);
  }

  const [voiceOpen, setVoiceOpen] = useState(false);
  async function addVoiceGoal(parsed: Record<string, string>) {
    const goalType = ["retirement","savings","debt","education","home","travel","other"].includes(parsed.goalType ?? "")
      ? parsed.goalType
      : "other";
    const draft = {
      ...emptyForm(),
      title:        parsed.title || t.goals.untitledGoal,
      goalType,
      targetAmount: String(parsed.targetAmount ?? "").replace(/[^0-9.]/g, "") || "",
      targetDate:   parsed.targetDate ?? "",
      notes:        parsed.notes ?? "",
    };
    setBusy(true);
    try {
      await api.post(`/api/clients/${clientId}/goals`, draft);
      await load();
    } catch (e: any) { toast({ title: t.common.error, description: e.message, variant: "destructive" }); }
    finally { setBusy(false); setVoiceOpen(false); }
  }

  function openEdit(g: Goal) {
    setEditingGoal(g);
    setShowForm(true);
  }

  async function save(form: ReturnType<typeof emptyForm>) {
    if (!form.title) return;
    setBusy(true);
    try {
      if (editingGoal) {
        await api.patch(`/api/goals/${editingGoal.id}`, form);
      } else {
        await api.post(`/api/clients/${clientId}/goals`, form);
      }
      setShowForm(false);
      setEditingGoal(null);
      await load();
    } catch (e: any) { toast({ title: t.common.error, description: e.message, variant: "destructive" }); }
    finally { setBusy(false); }
  }

  async function inlineUpdate(id: number, data: Partial<Goal>) {
    try {
      await api.patch(`/api/goals/${id}`, data);
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...data } : g));
    } catch (e: any) { toast({ title: t.common.error, description: e.message, variant: "destructive" }); }
  }

  async function del(id: number) {
    if (!confirm(t.goals.deleteThisGoal)) return;
    await api.delete(`/api/goals/${id}`);
    await load();
  }

  const formInitial = useMemo(() => {
    if (!editingGoal) return emptyForm();
    return {
      goalType:            editingGoal.goalType,
      title:               editingGoal.title,
      targetAmount:        editingGoal.targetAmount  ?? "",
      currentAmount:       editingGoal.currentAmount ?? "",
      targetDate:          editingGoal.targetDate    ?? "",
      status:              editingGoal.status,
      notes:               editingGoal.notes         ?? "",
      cashflowType:        editingGoal.cashflowType  ?? "savings_target",
      targetYear:          String(editingGoal.targetYear  ?? CURRENT_YEAR + 5),
      projectionImpact:    editingGoal.projectionImpact ?? false,
      priority:            editingGoal.priority ?? 3,
      monthlyContribution: editingGoal.monthlyContribution ?? "",
      inflationAdjust:     editingGoal.inflationAdjust ?? true,
      startYear:           String(editingGoal.startYear ?? CURRENT_YEAR + 1),
      endYear:             String(editingGoal.endYear   ?? CURRENT_YEAR + 5),
      annualAmount:        editingGoal.annualAmount ?? "",
      fundingSource:       editingGoal.fundingSource ?? "non_reg",
    };
  }, [editingGoal]);

  const filtered = useMemo(() => {
    if (filter === "all")     return goals.filter(g => g.status !== "completed");
    if (filter === "plan")    return goals.filter(g => g.projectionImpact);
    if (filter === "savings") return goals.filter(g => g.cashflowType === "savings_target");
    if (filter === "events")  return goals.filter(g => g.cashflowType === "outflow" || g.cashflowType === "inflow" || g.cashflowType === "recurring_expense");
    return goals;
  }, [goals, filter]);

  const completed = goals.filter(g => g.status === "completed");

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t.goals.financialGoals}</h1>
          <p className="text-sm text-slate-500">{t.goals.planAndPrioritize}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceOpen(true)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 bg-white px-3 py-2 rounded-lg transition"
          >
            <Mic className="w-3.5 h-3.5" /> {t.netWorth.voice}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-md text-white px-4 py-2 rounded-lg shadow-sm transition">
            <Plus className="w-4 h-4" /> {t.goals.addGoal}
          </button>
        </div>
      </div>

      {voiceOpen && (
        <VoiceAddDialog
          title={t.common.voiceAddGoal}
          moduleId="goal"
          prompt={`Try: "Retire at 60 with 1.5 million, target 2045"`}
          fieldSchema={[
            { key: "title",        label: t.common.name, description: t.goals.shortGoalTitle },
            { key: "goalType",     label: t.common.type, description: t.goals.categoryOfGoal,
              enum: ["retirement", "savings", "debt", "education", "home", "travel", "other"] },
            { key: "targetAmount", label: t.goals.targetAmountLabel, description: t.goals.targetAmountHint },
            { key: "targetDate",   label: t.goals.targetDate, description: t.goals.targetDateHint },
            { key: "notes",        label: t.common.notes, description: t.common.notes },
          ]}
          onConfirm={addVoiceGoal}
          onClose={() => setVoiceOpen(false)}
        />
      )}

      {/* Summary stats */}
      {goals.length > 0 && <GoalsSummary goals={goals} t={t} />}

      {/* Timeline card */}
      {goals.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{t.goals.timeline}</p>
          <GoalTimeline goals={goals} clientAge={clientAge} />
        </div>
      )}

      {/* Filter tabs */}
      {goals.length > 0 && (
        <div className="flex gap-2 bg-slate-100 p-1 rounded-lg w-fit">
          {[
            { key: "all",     label: t.common.active },
            { key: "plan",    label: `In Plan (${goals.filter(g => g.projectionImpact).length})` },
            { key: "savings", label: t.goals.cashSavings },
            { key: "events",  label: t.goals.cashflowEvents },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key as any)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-all ${
                filter === f.key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Goal cards */}
      {filtered.length === 0 && goals.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <Target className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">{t.goals.noGoalsYet}</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">{t.goals.addGoalsHint}</p>
          <button onClick={openNew}
            className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:shadow-md text-white px-4 py-2 rounded-lg shadow-sm transition">
            <Plus className="w-4 h-4" /> {t.goals.addFirstGoal}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-sm text-slate-500">No goals in this category</div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          {filtered
            .sort((a, b) => (a.priority ?? 3) - (b.priority ?? 3))
            .map(g => (
              <GoalCard key={g.id} goal={g} t={t} onEdit={() => openEdit(g)} onDelete={() => del(g.id)} onInlineUpdate={inlineUpdate} />
            ))}
        </div>
      )}

      {/* Completed goals (collapsed) */}
      {completed.length > 0 && (
        <details className="group">
          <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700 flex items-center gap-1 select-none">
            <ChevronDown className="w-3.5 h-3.5 group-open:rotate-180 transition-transform" />
            {completed.length} completed goal{completed.length > 1 ? "s" : ""}
          </summary>
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 mt-3 opacity-60">
            {completed.map(g => (
              <GoalCard key={g.id} goal={g} t={t} onEdit={() => openEdit(g)} onDelete={() => del(g.id)} onInlineUpdate={inlineUpdate} />
            ))}
          </div>
        </details>
      )}

      {/* Form */}
      {showForm && (
        <GoalErrorBoundary>
          <GoalForm
            initial={formInitial}
            onSave={save}
            onCancel={() => { setShowForm(false); setEditingGoal(null); }}
            busy={busy}
            clientId={clientId}
            t={t}
          />
        </GoalErrorBoundary>
      )}
    </div>
  );
}

