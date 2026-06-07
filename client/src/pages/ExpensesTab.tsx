import { useState, useEffect, useRef } from "react";
import { translations, type T } from "../i18n/translations";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

// Category keys stored in DB (always English)
const EXPENSE_CATEGORIES = [
  "Housing", "Utilities", "Food & Groceries", "Transportation",
  "Healthcare", "Insurance Premiums", "Childcare & Education",
  "Entertainment & Leisure", "Clothing & Personal Care",
  "Savings & Investments", "Debt Payments", "Travel", "Other",
];

const CAT_COLORS: Record<string, string> = {
  "Housing":                  "#3b82f6",
  "Utilities":                "#06b6d4",
  "Food & Groceries":         "#10b981",
  "Transportation":           "#8b5cf6",
  "Healthcare":               "#ef4444",
  "Insurance Premiums":       "#f59e0b",
  "Childcare & Education":    "#ec4899",
  "Entertainment & Leisure":  "#14b8a6",
  "Clothing & Personal Care": "#a78bfa",
  "Savings & Investments":    "#22c55e",
  "Debt Payments":            "#f97316",
  "Travel":                   "#0ea5e9",
  "Other":                    "#94a3b8",
};

// Translate a category key to the current locale
function catLabel(cat: string, t: import("../i18n/translations").T): string {
  const map: Record<string, string> = {
    "Housing":                  t.cashFlow.housing,
    "Utilities":                t.cashFlow.utilities,
    "Food & Groceries":         t.cashFlow.foodGroceries,
    "Transportation":           t.cashFlow.transportation,
    "Healthcare":               t.cashFlow.healthcare,
    "Insurance Premiums":       t.cashFlow.insurancePremiums,
    "Childcare & Education":    t.cashFlow.childcareEducation,
    "Entertainment & Leisure":  t.cashFlow.entertainmentLeisure,
    "Clothing & Personal Care": t.cashFlow.clothingPersonalCare,
    "Savings & Investments":    t.cashFlow.savingsInvestments,
    "Debt Payments":            t.cashFlow.debtPayments,
    "Travel":                   t.cashFlow.travel,
    "Other":                    t.common.other,
  };
  return map[cat] ?? cat;
}

interface Expense {
  id: number;
  category: string;
  description: string | null;
  monthlyAmount: string;
  isEssential: boolean;
  includeInRetirement: boolean;
  retirementAdjustmentPct: number;
  notes: string | null;
}

async function apiReq(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem("fp_token");
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message ?? `HTTP ${res.status}`); }
  return res.status === 204 ? null : res.json();
}

const fmt = (n: number) => `$${Math.round(n).toLocaleString("en-CA")}`;

function Metric({ label, value, color = "text-slate-900" }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-right">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

export function ExpensesTab({ clientId, addTrigger = 0, t = translations.en }: { clientId: number; addTrigger?: number; t?: T }) {
  const qc = useQueryClient();
  const key = ["expenses", clientId];

  const { data: expenses = [] } = useQuery<Expense[]>({
    queryKey: key,
    queryFn: () => apiReq("GET", `/api/clients/${clientId}/expenses`),
  });

  const createExp = useMutation({ mutationFn: (d: any) => apiReq("POST", `/api/clients/${clientId}/expenses`, d), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const updateExp = useMutation({ mutationFn: ({ id, ...d }: any) => apiReq("PATCH", `/api/clients/${clientId}/expenses/${id}`, d), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });
  const deleteExp = useMutation({ mutationFn: (id: number) => apiReq("DELETE", `/api/clients/${clientId}/expenses/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: key }) });

  // Listen for global quick-add event (triggered by A key)
  useEffect(() => {
    function handler(e: Event) {
      const detail = (e as CustomEvent).detail;
      if (detail?.tab === "expenses") { resetForm(); setShowForm(true); }
    }
    window.addEventListener("fp:quickadd", handler);
    return () => window.removeEventListener("fp:quickadd", handler);
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  const catLabel = (cat: string): string => ({
    "Housing": t.cashFlow.housing, "Utilities": t.cashFlow.utilities,
    "Food & Groceries": t.cashFlow.food, "Transportation": t.cashFlow.transportation,
    "Healthcare": t.cashFlow.healthcare, "Insurance Premiums": t.cashFlow.insurance,
    "Entertainment & Leisure": t.cashFlow.entertainment,
    "Clothing & Personal Care": t.cashFlow.personal,
    "Savings & Investments": t.cashFlow.savings, "Other": t.cashFlow.other,
  } as Record<string,string>)[cat] ?? cat;

  const [selected, setSelected] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [kbIndex, setKbIndex] = useState(0);
  const [form, setForm] = useState({ category: "Housing", description: "", monthlyAmount: "", isEssential: true, includeInRetirement: true, retirementAdjustmentPct: "100", notes: "" });

  // Global A key trigger
  useEffect(() => {
    if (addTrigger > 0) { resetForm(); setShowForm(true); }
  }, [addTrigger]);

  // ref populated after sortedCats declared below
  const sortedCatsRef = useRef<{ cat: string; items: Expense[]; total: number; retTotal: number }[]>([]);

  // Derived
  const totalMonthly      = expenses.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0);
  const retirementMonthly = expenses.filter(e => e.includeInRetirement).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0);
  const requiredPortfolio = retirementMonthly * 12 / 0.04;

  const byCategory = expenses.reduce<Record<string, Expense[]>>((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e); return acc;
  }, {});

  const sortedCats = Object.entries(byCategory)
    .map(([cat, items]) => ({
      cat,
      items,
      total: items.reduce((s, e) => s + parseFloat(e.monthlyAmount || "0"), 0),
      retTotal: items.filter(e => e.includeInRetirement).reduce((s, e) => s + parseFloat(e.monthlyAmount || "0") * (e.retirementAdjustmentPct || 100) / 100, 0),
    }))
    .sort((a, b) => b.total - a.total);

  // Keep ref in sync for keyboard handler
  sortedCatsRef.current = sortedCats;

  // Arrow nav for category list
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (showForm) return;
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
      const cats = sortedCatsRef.current;
      if (e.key === "ArrowDown") { e.preventDefault(); setKbIndex(i => Math.min(i + 1, cats.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setKbIndex(i => Math.max(i - 1, 0)); }
      if (e.key === "Enter")     { e.preventDefault(); const cat = cats[kbIndex]?.cat; if (cat) setSelected(s => s === cat ? null : cat); }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showForm, kbIndex]);

  const pieData = sortedCats.map(({ cat, total }) => ({ name: cat, value: Math.round(total) }));

  const selectedCat = selected ? sortedCats.find(c => c.cat === selected) : sortedCats[0] ?? null;
  const activeCat   = hovered ?? selected ?? null;

  const biggestCat    = sortedCats[0];
  const biggestSaving = biggestCat ? biggestCat.total * 0.10 * 12 / 0.04 : 0;

  function resetForm() {
    setForm({ category: "Housing", description: "", monthlyAmount: "", isEssential: true, includeInRetirement: true, retirementAdjustmentPct: "100", notes: "" });
    setEditing(null); setShowForm(false);
  }

  function startEdit(e: Expense) {
    setForm({ category: e.category, description: e.description || "", monthlyAmount: e.monthlyAmount, isEssential: e.isEssential, includeInRetirement: e.includeInRetirement, retirementAdjustmentPct: String(e.retirementAdjustmentPct || 100), notes: e.notes || "" });
    setEditing(e.id); setShowForm(true);
  }

  function handleSubmit() {
    const payload = { ...form, retirementAdjustmentPct: parseInt(form.retirementAdjustmentPct) || 100 };
    if (editing !== null) updateExp.mutate({ id: editing, ...payload }, { onSuccess: resetForm });
    else createExp.mutate(payload, { onSuccess: resetForm });
  }

  if (expenses.length === 0) {
    return (
      <div className="h-full flex flex-col bg-slate-50">
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">{t.cashFlow.title}</p>
            <p className="text-lg font-semibold text-slate-900">{t.cashFlow.noExpensesYet}</p>
          </div>
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
            <Plus className="w-4 h-4" /> {t.cashFlow.addExpense}
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-slate-500 font-semibold mb-2">{t.cashFlow.addHouseholdExpenses}</p>
            <button onClick={() => { resetForm(); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition">
              <Plus className="w-4 h-4" /> {t.cashFlow.addFirstExpense}
            </button>
          </div>
        </div>
        {showForm && <ExpenseForm form={form} setForm={setForm} editing={editing} onSubmit={handleSubmit} onClose={resetForm} creating={createExp.isPending} updating={updateExp.isPending} t={t} />}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50">

      {/* HEADER — command center */}
      <div className="px-6 py-3 border-b border-slate-200 bg-white flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-wide">{t.cashFlow.title}</p>
          <p className="text-base font-semibold text-slate-900">{t.cashFlow.monthlyExpenses}</p>
        </div>
        <div className="flex items-center gap-8">
          <Metric label={t.common.monthly}   value={`${fmt(totalMonthly)}/mo`} />
          <Metric label={t.cashFlow.retirement2} value={`${fmt(retirementMonthly)}/mo`} />
          <Metric label={t.cashFlow.requiredPortfolio} value={fmt(requiredPortfolio)} color="text-amber-600" />
          <button onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg shadow-sm hover:shadow-md transition">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* MAIN GRID */}
      <div className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: "300px 1fr" }}>

        {/* LEFT — dense category list */}
        <div className="border-r border-slate-200 bg-white overflow-y-auto pb-10">
          <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{t.cashFlow.categories}</p>
            <p className="text-xs text-slate-400">{sortedCats.length}</p>
          </div>
          {sortedCats.map(({ cat, items, total, retTotal }, catI) => {
            const pct    = totalMonthly > 0 ? Math.round((total / totalMonthly) * 100) : 0;
            const isActive   = activeCat === cat;
            const isSelected = selected === cat;
            const isKbFocus  = kbIndex === catI;
            return (
              <div
                key={cat}
                onClick={() => setSelected(isSelected ? null : cat)}
                onMouseEnter={() => setHovered(cat)}
                onMouseLeave={() => setHovered(null)}
                className={`px-4 py-3 border-b border-slate-100 cursor-pointer transition-colors ${
                  isSelected ? "bg-blue-50 border-l-2 border-l-blue-500" : isKbFocus ? "bg-slate-100 ring-1 ring-inset ring-slate-300" : isActive ? "bg-slate-50" : "hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[cat] ?? "#94a3b8" }} />
                    <span className="text-sm text-slate-700 truncate">{cat}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 ml-2 flex-shrink-0">{fmt(total)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full rounded transition-all duration-300" style={{ width: `${pct}%`, backgroundColor: isActive ? CAT_COLORS[cat] ?? "#94a3b8" : "#cbd5e1" }} />
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{pct}%</span>
                </div>
                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                  <span>{fmt(total * 12)}/yr</span>
                  {retTotal !== total && <span className="text-amber-500">{fmt(retTotal)}/mo ret.</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* RIGHT — visual + analysis */}
        <div className="overflow-y-auto p-5 pb-20 space-y-5">

          {/* Donut chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t.cashFlow.spendingBreakdown}</p>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="40%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={2} dataKey="value"
                    onMouseEnter={(_, i) => setHovered(pieData[i]?.name ?? null)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CAT_COLORS[entry.name] ?? "#94a3b8"}
                        opacity={activeCat && activeCat !== entry.name ? 0.35 : 1}
                        stroke={activeCat === entry.name ? "#1e293b" : "transparent"}
                        strokeWidth={1.5}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={{ zIndex: 50 }}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(value: number) => [`${fmt(value)}/mo`, ""]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drill-down — selected category */}
          {selectedCat && (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CAT_COLORS[selectedCat.cat] ?? "#94a3b8" }} />
                  <p className="text-sm font-semibold text-slate-900">{selectedCat.cat}</p>
                </div>
                <button
                  onClick={() => { resetForm(); setForm(f => ({ ...f, category: selectedCat.cat })); setShowForm(true); }}
                  className="text-xs text-blue-600 hover:underline"
                >+ Add</button>
              </div>
              <div className="flex gap-6 mb-4">
                <div><p className="text-xs text-slate-400">{t.common.monthly}</p><p className="text-lg font-bold text-slate-900">{fmt(selectedCat.total)}</p></div>
                <div><p className="text-xs text-slate-400">{t.cashFlow.yearlyView}</p><p className="text-lg font-bold text-slate-900">{fmt(selectedCat.total * 12)}</p></div>
                {selectedCat.retTotal !== selectedCat.total && (
                  <div><p className="text-xs text-slate-400">{t.cashFlow.inRetirement}</p><p className="text-lg font-bold text-amber-600">{fmt(selectedCat.retTotal)}/mo</p></div>
                )}
              </div>
              <div className="space-y-1">
                {selectedCat.items.map(e => (
                  <div key={e.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 group">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.isEssential ? "bg-red-400" : "bg-blue-400"}`} title={e.isEssential ? t.cashFlow.essential2 : t.common.discretionary} />
                      <span className="text-sm text-slate-600 truncate">{e.description || selectedCat.cat}</span>
                      {e.includeInRetirement && e.retirementAdjustmentPct !== 100 && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 px-1 py-0.5 rounded">{e.retirementAdjustmentPct}% ret.</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-sm font-medium text-slate-700">{fmt(parseFloat(e.monthlyAmount))}</span>
                      <button onClick={() => startEdit(e)} className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-blue-600"><Pencil className="w-3 h-3" /></button>
                      <button onClick={() => { if (confirm(t.common.deleteConfirm)) deleteExp.mutate(e.id); }} className="p-0.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bar chart */}
          <div className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">{t.common.allCategories}</p>
            <div style={{ height: Math.max(120, sortedCats.length * 28) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sortedCats.map(c => ({ name: c.cat.split(" ")[0], value: Math.round(c.total), full: c.cat }))} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={60} />
                  <Tooltip
                    wrapperStyle={{ zIndex: 50 }}
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", fontSize: "12px" }}
                    formatter={(v: number, _: any, props: any) => [`${fmt(v)}/mo`, props?.payload?.full ?? ""]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {sortedCats.map(({ cat }) => (
                      <Cell key={cat} fill={activeCat === cat ? CAT_COLORS[cat] ?? "#94a3b8" : "#e2e8f0"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Retirement guardrail */}
          {retirementMonthly > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-medium text-amber-700">{t.cashFlow.retirementImpact}</p>
              <p className="text-sm text-amber-600 mt-1">
                Spending requires <strong>{fmt(requiredPortfolio)}</strong> invested (4% rule) to sustain <strong>{fmt(retirementMonthly * 12)}/yr</strong>.
              </p>
            </div>
          )}

          {/* Actionability */}
          {biggestCat && biggestSaving > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
              Reducing <strong>{biggestCat.cat}</strong> by 10% lowers required portfolio by ~<strong>{fmt(biggestSaving)}</strong>.
            </div>
          )}

        </div>
      </div>

      {/* Add/Edit form */}
      {showForm && <ExpenseForm form={form} setForm={setForm} editing={editing} onSubmit={handleSubmit} onClose={resetForm} creating={createExp.isPending} updating={updateExp.isPending} t={t} />}
    </div>
  );
}

function ExpenseForm({ form, setForm, editing, onSubmit, onClose, creating, updating, t = translations.en }: any) {
  return (
    <div className="fixed inset-0 z-[200] flex">
      <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="w-full max-w-lg bg-white shadow-2xl flex flex-col h-full border-l border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">{editing !== null ? t.cashFlow.editExpense2 : t.cashFlow.addExpense}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400"><Plus className="w-4 h-4 rotate-45" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-24 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-1 text-slate-600">{t.cashFlow.category}</label>
              <select value={form.category} onChange={(e: any) => setForm((f: any) => ({ ...f, category: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1 text-slate-600">{t.cashFlow.monthlyAmountLbl}</label>
              <input type="number" min="0" step="10" value={form.monthlyAmount} onChange={(e: any) => setForm((f: any) => ({ ...f, monthlyAmount: e.target.value }))} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" placeholder="0" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1 text-slate-600">Description <span className="font-normal text-slate-400">(optional)</span></label>
            <input value={form.description} onChange={(e: any) => setForm((f: any) => ({ ...f, description: e.target.value }))} placeholder={t.cashFlow.mortgagePlaceholder} className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="space-y-3 bg-slate-50 rounded-xl p-4 border border-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t.cashFlow.retirementPlanning}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.isEssential} onChange={(e: any) => setForm((f: any) => ({ ...f, isEssential: e.target.checked }))} className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm font-medium text-slate-700">{t.cashFlow.essentialExpense}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.includeInRetirement} onChange={(e: any) => setForm((f: any) => ({ ...f, includeInRetirement: e.target.checked }))} className="w-4 h-4 rounded accent-blue-600" />
              <span className="text-sm font-medium text-slate-700">{t.cashFlow.includeInRetirement}</span>
            </label>
            {form.includeInRetirement && (
              <div>
                <label className="text-sm font-semibold block mb-1 text-slate-600">{t.cashFlow.retirementAdjustment} <span className="text-blue-600">{form.retirementAdjustmentPct}%</span></label>
                <input type="range" min="0" max="150" step="5" value={form.retirementAdjustmentPct} onChange={(e: any) => setForm((f: any) => ({ ...f, retirementAdjustmentPct: e.target.value }))} className="w-full accent-blue-600" />
                <p className="text-xs text-slate-400 mt-1">{fmt(parseFloat(form.monthlyAmount || "0") * parseInt(form.retirementAdjustmentPct) / 100)}{t.cashFlow.moInRetirement}</p>
              </div>
            )}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
          <button onClick={onSubmit} disabled={creating || updating || !form.monthlyAmount}
            className="px-6 py-2.5 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 text-white hover:shadow-md disabled:opacity-50 transition">
            {editing !== null ? t.cashFlow.saveChanges2 : t.cashFlow.addExpense}
          </button>
        </div>
      </div>
    </div>
  );
}
