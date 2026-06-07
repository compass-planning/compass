import { useState, useEffect } from "react";
import { api } from "../lib/api";
import { type T } from "../i18n/translations";
import { Plus, Trash2, Pencil, Save, X, Building2 } from "lucide-react";

interface PensionPlan {
  id: number;
  pensionType: string;
  subscriberOwner: string | null;
  employerName: string | null;
  accrualRate: string | null;
  yearsOfService: string | null;
  projectedYearsAtRetirement: string | null;
  bestAverageEarnings: string | null;
  currentBalance: string | null;
  employerMatchPct: string | null;
  retirementAge: number | null;
  indexingType: string | null;
  indexingRate: string | null;
  bridgeBenefit: string | null;
  bridgeBenefitEndAge: number | null;
  survivorBenefitPct: string | null;
  isVested: boolean | null;
  notes: string | null;
  annuityMonthlyAmount: string | null;
  annuityStartAge: number | null;
  annuityIsVested: boolean | null;
}

// These existing fields are repurposed for no_pension:
// currentBalance      → annual savings contribution
// bestAverageEarnings → desired retirement income
// accrualRate         → expected return rate (0.04/0.06/0.08)
// indexingType        → risk profile
// yearsOfService      → life expectancy / planning horizon
// survivorBenefitPct  → CPP start age
// projectedYearsAtRetirement → OAS start age
// bridgeBenefit       → part-time bridge income
// bridgeBenefitEndAge → bridge income ends age

const PENSION_TYPES = [
  { key: "dbpp",          label: "DBPP — Defined Benefit" },
  { key: "dcpp",          label: "DCPP — Defined Contribution" },
  { key: "group_rrsp",    label: "Group RRSP" },
  { key: "dpsp",          label: "DPSP — Deferred Profit Sharing" },
  { key: "life_annuity",  label: "Life Annuity" },
  { key: "no_pension", label: "No Pension — Investment Plan" },
];
const INDEXING_TYPES = [
  { key: "none",    label: "No Indexing" },
  { key: "cpi",     label: "CPI Indexed (full)" },
  { key: "partial", label: "Partial CPI (50%)" },
  { key: "fixed",   label: "Fixed Rate" },
];
function indexingLabel(key: string, t: T): string {
  const m: Record<string,string> = {
    none: t.retirement.noIndexing,
    cpi:  "CPI",
    partial: "CPI 50%",
    fixed: "Fixed",
  };
  return m[key] ?? key;
}

const fmt$ = (v: string | number | null) => {
  if (!v) return "—";
  return "$" + Number(v).toLocaleString("en-CA", { maximumFractionDigits: 0 });
};

function calcDBPPAnnual(plan: PensionPlan): number {
  const rate   = Number(plan.accrualRate || 0);
  const years  = Number(plan.projectedYearsAtRetirement || plan.yearsOfService || 0);
  const salary = Number(plan.bestAverageEarnings || 0);
  return Math.round(rate * years * salary);
}

function calcDCPPDrawdown(plan: PensionPlan): number {
  return Math.round(Number(plan.currentBalance || 0) * 0.04);
}

function pensionLabel(type: string) {
  if (type === "no_pension") return "Inv. Plan";
  return PENSION_TYPES.find(t => t.key === type)?.label.split(" — ")[0] ?? type.toUpperCase();
}

function SummaryBar({ items }: { items: { label: string; value: string; color: string; bg: string }[] }) {
  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-xl p-4`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{i.label}</p>
          <p className={`text-xl font-bold ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}

const TH = ({ children, right }: { children?: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide ${right ? "text-right" : "text-left"}`}>{children}</th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm ${right ? "text-right" : ""}`}>{children}</td>
);

const INPUT = "fp-input";

const PENSION_TYPE_MAP: Record<string, string> = {
  "DBPP": "dbpp",
  "DCPP": "dcpp",
  "Group RRSP": "group_rrsp",
  "DPSP": "dpsp",
  "No Pension": "no_pension",
};

const emptyPlan = (owner = "primary", retirementAge = 65, pensionType = "dbpp", salary: string | number | null = ""): any => ({
  pensionType, subscriberOwner: owner, employerName: "", accrualRate: "0.06",
  yearsOfService: "90", projectedYearsAtRetirement: "65",
  bestAverageEarnings: salary ? String(salary) : "",
  currentBalance: "", employerMatchPct: "", retirementAge,
  indexingType: "balanced", indexingRate: "", bridgeBenefit: "",
  bridgeBenefitEndAge: 65, survivorBenefitPct: "0.60", isVested: true, notes: "",
});

export function PensionTab({ clientId, client, person = "primary", t }: {
  clientId: number; client?: any; person?: string; t: T;
}) {
  const [plans, setPlans]         = useState<PensionPlan[]>([]);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm]           = useState<any>(emptyPlan());
  const [busy, setBusy]           = useState(false);

  const activePerson = person === "spouse" ? "spouse" : "primary";
  const clientName   = client?.firstName ?? "Client";
  const spouseName   = client?.spouseFirstName ?? "Spouse";
  const hasSpouse    = !!client?.spouseFirstName;

  const filteredPlans = plans.filter(p =>
    activePerson === "primary" ? p.subscriberOwner !== "spouse" : p.subscriberOwner === "spouse"
  );

  const load = () => api.get<PensionPlan[]>(`/api/clients/${clientId}/pensions`).then(setPlans).catch(() => {});
  useEffect(() => { load(); }, [clientId]);

  // Auto-sync projected years when retirement age changes
  useEffect(() => {
    if (!plans.length || !client) return;
    const updates: Promise<any>[] = [];
    plans.forEach(p => {
      const isPrimary = p.subscriberOwner !== "spouse";
      const dob    = isPrimary ? client.dateOfBirth : client.spouseDateOfBirth;
      const retAge = isPrimary ? (client.retirementAge ?? 65) : (client.spouseRetirementAge ?? 65);
      const age    = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25*24*60*60*1000)) : null;
      if (!age || !p.yearsOfService) return;
      const newProj = String(Number(p.yearsOfService) + (retAge - age));
      if (newProj !== p.projectedYearsAtRetirement) {
        updates.push(api.patch(`/api/pensions/${p.id}`, { projectedYearsAtRetirement: newProj }));
      }
    });
    if (updates.length > 0) Promise.all(updates).then(load);
  }, [client?.retirementAge, client?.spouseRetirementAge]);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  function openNew() {
    const isPrimary = activePerson === "primary";
    const retAge = isPrimary ? (client?.retirementAge ?? 65) : (client?.spouseRetirementAge ?? 65);
    const rawType = isPrimary ? client?.pensionType : client?.spousePensionType;
    const pType = (rawType && PENSION_TYPE_MAP[rawType]) || "dbpp";
    const salary = isPrimary ? client?.annualIncome : client?.spouseAnnualIncome;
    setEditingId(null);
    setForm(emptyPlan(activePerson, retAge, pType, salary));
    setShowForm(true);
  }

  function openEdit(p: PensionPlan) {
  setEditingId(p.id);
  if (p.pensionType === "no_pension" && p.notes) {
    try {
      const n = JSON.parse(p.notes);
      setForm({
        ...p,
        bestAverageEarnings: n.desiredIncome ?? "",
        currentBalance:      n.annualContrib ?? "",
        survivorBenefitPct:  n.cppStartAge ?? "65",
        projectedYearsAtRetirement: n.oasStartAge ?? "65",
        yearsOfService:      n.planningHorizon ?? "90",
        indexingType:        n.riskProfile ?? "balanced",
        indexingRate:        n.spendingProfile ?? "mixed",
        bridgeBenefit:       n.bridgeIncome ?? "",
        bridgeBenefitEndAge: n.bridgeEndsAge ?? 70,
        notes:               n.userNotes ?? "",
        isVested: true,
      });
    } catch { setForm({ ...p, isVested: p.isVested ?? true }); }
  } else {
    setForm({ ...p, isVested: p.isVested ?? true });
  }
  setShowForm(true);
}

 async function save() {
  setBusy(true);
  try {
    let payload = { ...form };

    // For no_pension, pack extra fields into notes as JSON
    // and map to DB-safe columns
    if (form.pensionType === "no_pension") {
      payload = {
        ...form,
        // survivorBenefitPct stores CPP age as text — convert to safe decimal
        survivorBenefitPct: null,
        // projectedYearsAtRetirement stores OAS age — clear it
        projectedYearsAtRetirement: null,
        // Store everything in notes as JSON
        notes: JSON.stringify({
          desiredIncome:    form.bestAverageEarnings,
          annualContrib:    form.currentBalance,
          cppStartAge:      form.survivorBenefitPct,
          oasStartAge:      form.projectedYearsAtRetirement,
          planningHorizon:  form.yearsOfService,
          riskProfile:      form.indexingType,
          spendingProfile:  form.indexingRate,
          bridgeIncome:     form.bridgeBenefit,
          bridgeEndsAge:    form.bridgeBenefitEndAge,
          userNotes:        form.notes,
        }),
      };
    }

    if (editingId) await api.patch(`/api/pensions/${editingId}`, payload);
    else           await api.post(`/api/clients/${clientId}/pensions`, payload);
    setShowForm(false); load();
  } finally { setBusy(false); }
}

  async function del(id: number) {
    if (!confirm("Delete this pension plan?")) return;
    await api.delete(`/api/pensions/${id}`); load();
  }

  // ── Summary stats ────────────────────────────────────────────────────────────
  const dbppIncome = filteredPlans
    .filter(p => p.pensionType === "dbpp")
    .reduce((s, p) => s + calcDBPPAnnual(p), 0);
  const dcppDrawdown = filteredPlans
    .filter(p => p.pensionType === "dcpp" || p.pensionType === "group_rrsp")
    .reduce((s, p) => s + calcDCPPDrawdown(p), 0);
  const totalDCPP = filteredPlans
    .filter(p => p.pensionType !== "dbpp")
    .reduce((s, p) => s + Number(p.currentBalance || 0), 0);
  

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Summary bar */}
      <SummaryBar items={[
        { label: t.retirement.dbppIncomeYr,  value: dbppIncome > 0 ? fmt$(dbppIncome) : "—",    color: "text-blue-600",    bg: "bg-blue-50"    },
        { label: t.retirement.dcGrspBalance, value: totalDCPP  > 0 ? fmt$(totalDCPP)  : "—",    color: "text-violet-600",  bg: "bg-violet-50"  },
        { label: t.retirement.dcDrawdownYr,  value: dcppDrawdown > 0 ? fmt$(dcppDrawdown) : "—", color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: t.retirement.plansOnFile,   value: String(filteredPlans.length),                color: "text-gray-700",    bg: "bg-gray-100"   },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t.retirement.pensionPlans}</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {filteredPlans.length} {t.retirement.plansOnFile}
          </p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> {t.retirement.addPlan}
        </button>
      </div>

      {/* Table */}
      {filteredPlans.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">{t.retirement.noPensionPlans}</p>
          <p className="text-sm text-gray-400 mt-1">{t.retirement.addPensionTypes}</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <TH>Type</TH>
                <TH>Owner</TH>
                <TH>Employer</TH>
                <TH right>Projected income / yr</TH>
                <TH right>Balance</TH>
                <TH>Years service</TH>
                <TH>Vested</TH>
                <TH></TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPlans.map(p => {
                const income = p.pensionType === "dbpp" ? calcDBPPAnnual(p) : p.pensionType === "no_pension" ? 0 : calcDCPPDrawdown(p);
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <TD>
                      <span className="bg-[#0c1e3a]/10 text-[#0c1e3a] text-xs font-semibold px-2 py-0.5 rounded-full">
                        {pensionLabel(p.pensionType)}
                      </span>
                    </TD>
                    <TD>
                      <span className="text-gray-600 text-xs">
                        {p.subscriberOwner === "spouse" ? spouseName : clientName}
                      </span>
                    </TD>
                    <TD><span className="font-medium text-gray-800">{p.employerName || "—"}</span></TD>
                    <TD right>
                      {income > 0
                        ? <span className="font-semibold text-emerald-700">{fmt$(income)}</span>
                        : <span className="text-gray-400">—</span>}
                    </TD>
                    <TD right>
                      {Number(p.currentBalance) > 0
                        ? <span className="font-semibold text-blue-700">{fmt$(p.currentBalance)}</span>
                        : <span className="text-gray-400">—</span>}
                    </TD>
                    <TD>
                      <span className="text-gray-600">
                        {p.yearsOfService ? `${p.yearsOfService} yrs` : "—"}
                        {p.projectedYearsAtRetirement && p.projectedYearsAtRetirement !== p.yearsOfService
                          ? <span className="text-gray-400 ml-1">(→ {p.projectedYearsAtRetirement} at ret.)</span>
                          : null}
                      </span>
                    </TD>
                    <TD>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.isVested ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                        {p.isVested ? "Vested" : "Not vested"}
                      </span>
                    </TD>
                    <TD>
                      <div className="flex gap-1">
                        <button onClick={() => openEdit(p)} className="p-1.5 text-gray-400 hover:text-[#0c1e3a] transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => del(p.id)} className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* DBPP income note */}
      {filteredPlans.some(p => p.pensionType === "dbpp") && (
        <p className="text-xs text-gray-400 mt-3">
          DBPP income = accrual rate × projected years × best average earnings. DC/GRSP drawdown based on 4% rule.
        </p>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl my-4">
            <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editingId ? t.retirement.editPensionPlan : t.retirement.addPensionPlan}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-6 space-y-6">
              {/* Type + Owner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.planType}</label>
                  <select value={form.pensionType} onChange={e => upd("pensionType", e.target.value)} className={INPUT}>
                    {PENSION_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Owner</label>
                  <select value={form.subscriberOwner} onChange={e => upd("subscriberOwner", e.target.value)} className={INPUT}>
                    <option value="primary">{clientName}</option>
                    {hasSpouse && <option value="spouse">{spouseName}</option>}
                  </select>
                </div>
              </div>

              {/* Employer */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.employerName}</label>
                  <input value={form.employerName ?? ""} onChange={e => upd("employerName", e.target.value)} className={INPUT} placeholder="e.g. Ontario Teachers'" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.pensionStartAge}</label>
                  <input type="number" value={form.retirementAge ?? 65} onChange={e => upd("retirementAge", +e.target.value)} className={INPUT} />
                </div>
              </div>

              {/* DBPP fields */}
              {form.pensionType === "dbpp" && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">{t.retirement.definedBenefitDetails}</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.accrualRate}</label>
                      <input type="number" step="0.001" value={form.accrualRate ?? "0.02"} onChange={e => upd("accrualRate", e.target.value)} className={INPUT} />
                      <p className="text-[10px] text-gray-400 mt-0.5">e.g. 0.02 = 2% per year</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.yearsOfService}</label>
                      <input type="number" value={form.yearsOfService ?? ""} onChange={e => upd("yearsOfService", e.target.value)} className={INPUT} placeholder="Current years" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.projectedYearsAtRet}</label>
                      <input type="number" value={form.projectedYearsAtRetirement ?? ""} onChange={e => upd("projectedYearsAtRetirement", e.target.value)} className={INPUT} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.bestAvgEarnings}</label>
                      <input type="number" value={form.bestAverageEarnings ?? ""} onChange={e => upd("bestAverageEarnings", e.target.value)} className={INPUT} placeholder="Best 5-year avg" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.indexingLabel}</label>
                      <select value={form.indexingType ?? "none"} onChange={e => upd("indexingType", e.target.value)} className={INPUT}>
                        {INDEXING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.bridgeBenefit}</label>
                      <input type="number" value={form.bridgeBenefit ?? ""} onChange={e => upd("bridgeBenefit", e.target.value)} className={INPUT} placeholder="Optional" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.bridgeEndsAge}</label>
                      <input type="number" value={form.bridgeBenefitEndAge ?? 65} onChange={e => upd("bridgeBenefitEndAge", +e.target.value)} className={INPUT} />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.survivorBenefitLabel}</label>
                      <select value={form.survivorBenefitPct ?? "0.60"} onChange={e => upd("survivorBenefitPct", e.target.value)} className={INPUT}>
                        <option value="0">None</option>
                        <option value="0.50">50%</option>
                        <option value="0.60">60%</option>
                        <option value="0.662">66.2%</option>
                        <option value="1.0">100%</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {/* DC / Group RRSP / DPSP fields */}
              {(form.pensionType === "dcpp" || form.pensionType === "group_rrsp" || form.pensionType === "dpsp") && (
                <>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Balance Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Current Balance ($)</label>
                      <input type="number" value={form.currentBalance ?? ""} onChange={e => upd("currentBalance", e.target.value)} className={INPUT} placeholder="0" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500 mb-1 block">Employer Match %</label>
                      <input type="number" step="0.5" value={form.employerMatchPct ?? ""} onChange={e => upd("employerMatchPct", e.target.value)} className={INPUT} placeholder="e.g. 4" />
                    </div>
                  </div>
                </>
              )}

{form.pensionType === "life_annuity" && (
  <>
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Life Annuity Details</p>
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Payment Amount ($)</label>
        <input type="number" value={form.currentBalance ?? ""} onChange={e => upd("currentBalance", e.target.value)} className={INPUT} placeholder="0" />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Payment Frequency</label>
        <select value={form.indexingType ?? "monthly"} onChange={e => upd("indexingType", e.target.value)} className={INPUT}>
          <option value="monthly">Monthly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
    </div>
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Start Age</label>
        <input type="number" value={form.retirementAge ?? 65} onChange={e => upd("retirementAge", +e.target.value)} className={INPUT} />
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.survivorBenefitLabel}</label>
        <select value={form.survivorBenefitPct ?? "0"} onChange={e => upd("survivorBenefitPct", e.target.value)} className={INPUT}>
          <option value="0">None</option>
          <option value="0.50">50%</option>
          <option value="0.60">60%</option>
          <option value="0.662">66.2%</option>
          <option value="1.0">100%</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">{t.retirement.indexingLabel}</label>
        <select value={form.indexingType ?? "none"} onChange={e => upd("indexingType", e.target.value)} className={INPUT}>
          {INDEXING_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
    </div>
    {/* Live preview */}
    {form.currentBalance && (
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-purple-600 uppercase tracking-widest mb-1">Annuity Income</p>
        <p className="text-2xl font-bold text-purple-800">
          {fmt$(form.indexingType === "annual" ? Number(form.currentBalance) : Number(form.currentBalance) * 12)}/yr
        </p>
        <p className="text-xs text-purple-500 mt-0.5">
          {fmt$(form.currentBalance)}/{form.indexingType === "annual" ? "yr" : "mo"} · Survivor {form.survivorBenefitPct > 0 ? `${Math.round(Number(form.survivorBenefitPct) * 100)}%` : "none"}
        </p>
      </div>
    )}
  </>
)}

{/* No Pension — Investment Plan fields */}
{form.pensionType === "no_pension" && (
  <>
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Retirement Investment Profile</p>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Desired Retirement Income ($/yr)</label>
        <input type="number" value={form.bestAverageEarnings ?? ""} onChange={e => upd("bestAverageEarnings", e.target.value)} className={INPUT} placeholder="e.g. 80000" />
        <p className="text-[10px] text-gray-400 mt-0.5">Total annual income needed in retirement</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Annual Savings Contribution ($/yr)</label>
        <input type="number" value={form.currentBalance ?? ""} onChange={e => upd("currentBalance", e.target.value)} className={INPUT} placeholder="e.g. 25000" />
        <p className="text-[10px] text-gray-400 mt-0.5">Combined RRSP + TFSA + other annual contributions</p>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">CPP Start Age</label>
        <select value={form.survivorBenefitPct ?? "65"} onChange={e => upd("survivorBenefitPct", e.target.value)} className={INPUT}>
          <option value="60">60 — Early (reduced)</option>
          <option value="65">65 — Standard</option>
          <option value="67">67 — Deferred</option>
          <option value="70">70 — Maximum (+42%)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">OAS Start Age</label>
        <select value={form.projectedYearsAtRetirement ?? "65"} onChange={e => upd("projectedYearsAtRetirement", e.target.value)} className={INPUT}>
          <option value="65">65 — Standard</option>
          <option value="67">67 — Deferred</option>
          <option value="70">70 — Maximum (+36%)</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Planning Horizon (age)</label>
        <input type="number" value={form.yearsOfService ?? "90"} onChange={e => upd("yearsOfService", e.target.value)} className={INPUT} placeholder="90" />
        <p className="text-[10px] text-gray-400 mt-0.5">Life expectancy for plan modelling</p>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Investment Risk Profile</label>
        <select value={form.indexingType ?? "balanced"} onChange={e => upd("indexingType", e.target.value)} className={INPUT}>
          <option value="conservative">Conservative — 4% expected return</option>
          <option value="balanced">Balanced — 6% expected return</option>
          <option value="growth">Growth — 8% expected return</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 mb-1 block">Spending Profile</label>
        <select value={form.indexingRate ?? "mixed"} onChange={e => upd("indexingRate", e.target.value)} className={INPUT}>
          <option value="essential">Mostly Essential — stable, predictable</option>
          <option value="mixed">Mixed — essential + discretionary</option>
          <option value="discretionary">Lifestyle-heavy — travel, giving, flex</option>
        </select>
      </div>
    </div>

    <div className="pt-2 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Part-Time / Bridge Income (optional)</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Bridge Income ($/yr)</label>
          <input type="number" value={form.bridgeBenefit ?? ""} onChange={e => upd("bridgeBenefit", e.target.value)} className={INPUT} placeholder="e.g. 20000" />
          <p className="text-[10px] text-gray-400 mt-0.5">Part-time work, consulting, rental etc.</p>
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">Bridge Income Ends (age)</label>
          <input type="number" value={form.bridgeBenefitEndAge ?? ""} onChange={e => upd("bridgeBenefitEndAge", +e.target.value)} className={INPUT} placeholder="e.g. 70" />
        </div>
      </div>
    </div>

    {/* Live summary */}
    {form.bestAverageEarnings && form.currentBalance && (
      <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Investment Plan Summary</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-[10px] text-blue-500 mb-0.5">Income Goal</p>
            <p className="text-base font-bold text-blue-900">{fmt$(Number(form.bestAverageEarnings))}/yr</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-500 mb-0.5">Gov. Benefits</p>
            <p className="text-base font-bold text-blue-900">~$19K/yr</p>
            <p className="text-[10px] text-blue-400">CPP + OAS estimate</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-500 mb-0.5">Portfolio Must Cover</p>
            <p className="text-base font-bold text-blue-900">{fmt$(Math.max(0, Number(form.bestAverageEarnings) - 19000))}/yr</p>
          </div>
        </div>
      </div>
    )}
  </>
)}

              {/* Vested + Notes */}
              <div className="grid grid-cols-2 gap-3 items-start">
                <label className="flex items-center gap-2 cursor-pointer pt-1">
                  <input type="checkbox" checked={!!form.isVested} onChange={e => upd("isVested", e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                  <span className="text-sm font-medium text-gray-700">{t.retirement.planIsVested}</span>
                </label>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Notes</label>
                  <textarea value={form.notes ?? ""} onChange={e => upd("notes", e.target.value)} className={INPUT} rows={2} placeholder="Optional" />
                </div>
              </div>

              {/* Live DBPP preview */}
              {form.pensionType === "dbpp" && form.accrualRate && form.projectedYearsAtRetirement && form.bestAverageEarnings && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-1">Projected DBPP Income</p>
                  <p className="text-2xl font-bold text-blue-800">
                    {fmt$(Number(form.accrualRate) * Number(form.projectedYearsAtRetirement) * Number(form.bestAverageEarnings))}/yr
                  </p>
                  <p className="text-xs text-blue-500 mt-0.5">
                    {(Number(form.accrualRate) * 100).toFixed(1)}% × {form.projectedYearsAtRetirement} yrs × {fmt$(form.bestAverageEarnings)} best avg earnings
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
              <button onClick={save} disabled={busy}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                <Save className="w-4 h-4" /> {busy ? t.common.saving : editingId ? t.common.save : t.retirement.addPlan}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
