/**
 * DITab.tsx — Disability Income Planning Module
 */

import { useState, useEffect, useMemo } from "react";
import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Save, Trash2, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, TrendingUp, Briefcase } from "lucide-react";
import { translations, type T } from "../../i18n/translations";

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

interface Props { clientId: number; client?: any; t?: T; }

interface FormState {
  person:               string;
  label:                string;
  currentAge:           number;
  province:             string;
  grossMonthlyIncome:   number;
  occupationClass:      string;
  definition:           string;
  waitingPeriodDays:    number;
  benefitPeriod:        string;
  groupDiMonthly:       number;
  groupDiEmployerPaid:  boolean;
  individualDiMonthly:  number;
  cppDisabilityMonthly: number;
  partialDisabilityPct: number;
  colaPct:              number;
  notes:                string;
}

interface DIResult {
  grossMonthlyIncome:        number;
  targetMonthlyBenefit:      number;
  targetMonthlyBenefitHigh:  number;
  existing: { groupGross: number; groupAfterTax: number; individual: number; cppDisability: number; totalAfterTax: number };
  coverageGap:               number;
  coverageGapHigh:           number;
  replacementRatio:          number;
  replacementRatioTarget:    number;
  isAdequate:                boolean;
  waitingPeriodCost:         number;
  emergencyFundMonths:       number;
  claimProbability:          { ownOcc: number; anyOcc: number; ownVsAnyGap: number };
  maxBenefit:                { totalAtTarget: number; yearsOfCoverage: number };
  cola:                      { benefitAtYear5: number; benefitAtYear10: number; addedValueAtYear10: number };
  partialDisability:         { triggerIncomeThreshold: number; partialBenefit: number };
  taxTreatment:              { groupTaxable: boolean; groupEffectiveRate: number; individualTaxFree: boolean; recommendation: string };
}

interface SavedAnalysis extends FormState { id: number; result?: DIResult; resultData?: DIResult; createdAt: string; }

// ── Constants ─────────────────────────────────────────────────────────────────


const DEFAULT_FORM: FormState = {
  person: "primary", label: "", currentAge: 45, province: "ON",
  grossMonthlyIncome: 8000, occupationClass: "3A", definition: "own_occ",
  waitingPeriodDays: 90, benefitPeriod: "age65",
  groupDiMonthly: 0, groupDiEmployerPaid: true,
  individualDiMonthly: 0, cppDisabilityMonthly: 0,
  partialDisabilityPct: 50, colaPct: 2, notes: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) return (n < 0 ? "-$" : "$") + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return (n < 0 ? "-$" : "$") + Math.round(abs / 1_000).toLocaleString() + "K";
  return (n < 0 ? "-$" : "$") + abs.toLocaleString();
};
const pct = (n: number) => `${Math.round(n * 100)}%`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text", min, max, step, prefix }:
  { value: any; onChange: (v: any) => void; type?: string; min?: number; max?: number; step?: number; prefix?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
      <input type={type} value={value} min={min} max={max} step={step}
        onChange={e => onChange(type === "number" ? +e.target.value : e.target.value)}
        className={`w-full border border-gray-200 rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]/30 ${prefix ? "pl-7 pr-3" : "px-3"}`} />
    </div>
  );
}
function Select({ value, onChange, options }: { value: any; onChange: (v: any) => void; options: { value: any; label: string }[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0891b2]/30 bg-white">
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

// ── Replacement Ratio Gauge ───────────────────────────────────────────────────

function ReplacementGauge({ ratio, t }: { ratio: number; t: T }) {
  const capped  = Math.min(100, ratio);
  const color   = ratio >= 70 ? "#16a34a" : ratio >= 50 ? "#d97706" : "#dc2626";
  const data    = [{ name: "ratio", value: capped, fill: color }];
  return (
    <div className="flex flex-col items-center">
      <div className="w-36 h-20 relative">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="90%" innerRadius="70%" outerRadius="100%"
            startAngle={180} endAngle={0} data={data}>
            <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
            <RadialBar background dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <p className="text-2xl font-bold" style={{ color }}>{ratio}%</p>
          <p className="text-[10px] text-gray-400">{t.di.replacementRatio}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <div className="h-0.5 w-8 bg-gray-200 rounded" />
        <span className="text-[10px] text-gray-400">{t.di.target}</span>
        <div className="h-0.5 w-8 bg-gray-200 rounded" />
      </div>
    </div>
  );
}

// ── Claim probability bar ─────────────────────────────────────────────────────

function ProbBar({ label, prob, color }: { label: string; prob: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${prob * 100}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{pct(prob)}</span>
    </div>
  );
}

// ── Live client-side calc ─────────────────────────────────────────────────────

function calcLive(form: FormState): DIResult {
  const gross = form.grossMonthlyIncome;
  const MTR: Record<string, number> = { AB: 0.30, BC: 0.33, MB: 0.37, NB: 0.35, NL: 0.35, NS: 0.37, ON: 0.33, PE: 0.35, QC: 0.40, SK: 0.33 };
  const mtr = MTR[form.province] ?? 0.33;

  const target     = Math.round(gross * 0.70);
  const targetHigh = Math.round(gross * 0.85);
  const groupAfterTax = form.groupDiEmployerPaid ? Math.round(form.groupDiMonthly * (1 - mtr)) : form.groupDiMonthly;
  const cppDAfterTax  = Math.round(form.cppDisabilityMonthly * (1 - mtr));
  const totalAfterTax = groupAfterTax + form.individualDiMonthly + cppDAfterTax;
  const gap     = Math.max(0, target - totalAfterTax);
  const gapHigh = Math.max(0, targetHigh - totalAfterTax);
  const ratio   = gross > 0 ? Math.round((totalAfterTax / gross) * 100) : 0;

  const OCC: Record<string, { own: number; any: number }> = {
    '4A': { own: 0.32, any: 0.12 }, '3A': { own: 0.35, any: 0.15 },
    '2A': { own: 0.38, any: 0.18 }, 'A':  { own: 0.44, any: 0.24 }, 'B': { own: 0.52, any: 0.32 },
  };
  const occ = OCC[form.occupationClass] ?? OCC['3A'];

  const bpYears = form.benefitPeriod === '2yr' ? 2 : form.benefitPeriod === '5yr' ? 5
    : form.benefitPeriod === '10yr' ? 10 : form.benefitPeriod === 'age65'
    ? Math.max(1, 65 - form.currentAge) : Math.max(1, 70 - form.currentAge);

  const cola = form.colaPct / 100;
  const triggerThreshold = Math.round(gross * (form.partialDisabilityPct / 100));

  return {
    grossMonthlyIncome: gross,
    targetMonthlyBenefit: target,
    targetMonthlyBenefitHigh: targetHigh,
    existing: { groupGross: form.groupDiMonthly, groupAfterTax, individual: form.individualDiMonthly, cppDisability: cppDAfterTax, totalAfterTax },
    coverageGap: gap, coverageGapHigh: gapHigh,
    replacementRatio: ratio, replacementRatioTarget: 70, isAdequate: ratio >= 70,
    waitingPeriodCost: Math.round(gross * form.waitingPeriodDays / 30),
    emergencyFundMonths: Math.ceil(form.waitingPeriodDays / 30) + 1,
    claimProbability: { ownOcc: occ.own, anyOcc: occ.any, ownVsAnyGap: Math.round(gross * (occ.own - occ.any) * 12) },
    maxBenefit: { totalAtTarget: Math.round(gap * 12 * bpYears), yearsOfCoverage: bpYears },
    cola: {
      benefitAtYear5:      Math.round(gap * Math.pow(1 + cola, 5)),
      benefitAtYear10:     Math.round(gap * Math.pow(1 + cola, 10)),
      addedValueAtYear10:  Math.round(Array.from({ length: 10 }, (_, i) => (gap * Math.pow(1 + cola, i + 1) - gap) * 12).reduce((a, b) => a + b, 0)),
    },
    partialDisability: { triggerIncomeThreshold: triggerThreshold, partialBenefit: Math.round(((gross - triggerThreshold) / gross) * gap) },
    taxTreatment: {
      groupTaxable: form.groupDiMonthly > 0 && form.groupDiEmployerPaid,
      groupEffectiveRate: mtr,
      individualTaxFree: true,
      recommendation: form.groupDiMonthly > 0 && form.groupDiEmployerPaid
        ? `Group DI of $${form.groupDiMonthly.toLocaleString()}/mo is taxable (employer-paid). Net benefit after ${Math.round(mtr*100)}% tax: $${groupAfterTax.toLocaleString()}/mo.`
        : `Individual DI of $${form.individualDiMonthly.toLocaleString()}/mo is tax-free on claim.`,
    },
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DITab({ clientId, client, t = translations.en }: Props) {
  const [analyses,  setAnalyses]  = useState<SavedAnalysis[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [editing,   setEditing]   = useState<number | null>(null);
  const [showList,  setShowList]  = useState(true);
  const [form,      setForm]      = useState<FormState>({
    ...DEFAULT_FORM,
    province:   client?.province  || "ON",
    currentAge: client?.dateOfBirth ? new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear() : 45,
  });

  const token   = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
  const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const opts    = { headers, credentials: "include" as RequestCredentials };

  useEffect(() => {
    fetch(`/api/clients/${clientId}/di-analyses`, opts)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAnalyses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  const r = useMemo(() => calcLive(form), [form]);
  const set = (k: keyof FormState) => (v: any) => setForm(f => ({ ...f, [k]: v }));
  const OCC_CLASSES = [
    { value: "4A", label: "4A — Physicians, lawyers, professionals" },
    { value: "3A", label: "3A — Financial advisors, engineers, managers" },
    { value: "2A", label: "2A — Teachers, nurses, office supervisors" },
    { value: "A",  label: "A — Skilled trades, technicians" },
    { value: "B",  label: "B — Heavy labour, manual workers" },
  ];
  const DEFINITIONS = [
    { value: "own_occ", label: t.di.ownOcc },
    { value: "regular", label: t.di.regularOcc },
    { value: "any_occ", label: t.di.anyOcc },
  ];
  const WAITING_PERIODS = [
    { value: 30,  label: t.di.days30 },
    { value: 60,  label: t.di.days60 },
    { value: 90,  label: t.di.days90 },
    { value: 120, label: t.di.days120 },
    { value: 180, label: t.di.days180 },
    { value: 365, label: t.di.days365 },
  ];
  const BENEFIT_PERIODS = [
    { value: "2yr",   label: t.di.yr2 },
    { value: "5yr",   label: t.di.yr5 },
    { value: "10yr",  label: t.di.yr10 },
    { value: "age65", label: t.di.toAge65 },
    { value: "age70", label: t.di.toAge70 },
  ];

  async function handleSave() {
    setSaving(true);
    try {
      const body = { ...form, partialDisabilityPct: form.partialDisabilityPct / 100, colaPct: form.colaPct / 100 };
      const url    = editing ? `/api/clients/${clientId}/di-analyses/${editing}` : `/api/clients/${clientId}/di-analyses`;
      const method = editing ? "PATCH" : "POST";
      const res    = await fetch(url, { ...opts, method, body: JSON.stringify(body) });
      const data   = await res.json();
      const entry  = { ...data, result: data.result || data.resultData };
      setAnalyses(prev => editing ? prev.map(a => a.id === editing ? entry : a) : [entry, ...prev]);
      setEditing(null); setShowList(true);
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.di.deleteAnalysis)) return;
    await fetch(`/api/clients/${clientId}/di-analyses/${id}`, { ...opts, method: "DELETE" });
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }

  function loadForEdit(a: SavedAnalysis) {
    setForm({ ...DEFAULT_FORM, ...a, partialDisabilityPct: Number(a.partialDisabilityPct) * 100, colaPct: Number(a.colaPct) * 100 });
    setEditing(a.id); setShowList(false);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* Saved list */}
      {analyses.length > 0 && (
        <div>
          <button onClick={() => setShowList(v => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-600 hover:text-gray-800 mb-2">
            {showList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Saved Analyses ({analyses.length})
          </button>
          {showList && (
            <div className="space-y-2">
              {analyses.map(a => {
                const res = a.result || a.resultData;
                return (
                  <div key={a.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between hover:border-gray-300">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{a.label || `DI Analysis — ${a.occupationClass} / ${a.definition}`}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        ${Number(a.grossMonthlyIncome).toLocaleString()}/mo gross
                        {res && ` · ${res.replacementRatio}% replacement · Gap: ${fmt$(res.coverageGap)}/mo`}
                        {res?.isAdequate ? " · ✓ Adequate" : res ? " · ⚠ Gap exists" : ""}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => loadForEdit(a)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">Edit</button>
                      <button onClick={() => handleDelete(a.id)} className="text-xs px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => { setForm({ ...DEFAULT_FORM, province: client?.province||"ON" }); setEditing(null); setShowList(false); }}
                className="text-sm text-[#0891b2] hover:underline mt-1">+ New Analysis</button>
            </div>
          )}
        </div>
      )}

      {(analyses.length === 0 || !showList) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT: Inputs ────────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Briefcase className="w-4 h-4 text-[#0891b2]" />
              <h3 className="text-sm font-bold text-gray-800">{t.di.analysisInputs}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.common.currentAge}>
                <Input type="number" value={form.currentAge} onChange={set("currentAge")} min={20} max={64} />
              </Field>
              <Field label={t.common.province}>
                <Select value={form.province} onChange={set("province")} options={PROVINCES.map(p => ({ value: p, label: p }))} />
              </Field>
            </div>

            <Field label={t.di.grossMonthlyIncome}>
              <Input type="number" value={form.grossMonthlyIncome} onChange={set("grossMonthlyIncome")} min={0} step={500} prefix="$" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.di.occupationClass}>
                <Select value={form.occupationClass} onChange={set("occupationClass")} options={OCC_CLASSES} />
              </Field>
              <Field label={t.di.diDefinition}>
                <Select value={form.definition} onChange={set("definition")} options={DEFINITIONS} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.di.waitingPeriod}>
                <Select value={form.waitingPeriodDays} onChange={v => set("waitingPeriodDays")(+v)} options={WAITING_PERIODS} />
              </Field>
              <Field label={t.di.benefitPeriod}>
                <Select value={form.benefitPeriod} onChange={set("benefitPeriod")} options={BENEFIT_PERIODS} />
              </Field>
            </div>

            {/* Existing coverage */}
            <div className="bg-gray-50 rounded-xl p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{t.di.existingCoverage}</p>
              <Field label={t.di.groupDi}>
                <Input type="number" value={form.groupDiMonthly} onChange={set("groupDiMonthly")} min={0} step={100} prefix="$" />
              </Field>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="empPaid" checked={form.groupDiEmployerPaid}
                  onChange={e => set("groupDiEmployerPaid")(e.target.checked)}
                  className="rounded" />
                <label htmlFor="empPaid" className="text-xs text-gray-600">{t.di.employerPaid}</label>
              </div>
              <Field label={t.di.individualDi}>
                <Input type="number" value={form.individualDiMonthly} onChange={set("individualDiMonthly")} min={0} step={100} prefix="$" />
              </Field>
              <Field label={t.di.cppDisability}>
                <Input type="number" value={form.cppDisabilityMonthly} onChange={set("cppDisabilityMonthly")} min={0} step={100} prefix="$" />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.di.partialDisThreshold}>
                <Input type="number" value={form.partialDisabilityPct} onChange={set("partialDisabilityPct")} min={20} max={80} prefix="%" />
              </Field>
              <Field label={t.di.colaRider}>
                <Input type="number" value={form.colaPct} onChange={set("colaPct")} min={0} max={5} step={0.5} prefix="%" />
              </Field>
            </div>

            <Field label={t.di.label}><Input value={form.label} onChange={set("label")} /></Field>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? t.common.savingEllipsis : editing ? t.di.updateAnalysis : t.di.saveAnalysis}
            </button>
          </div>

          {/* ── RIGHT: Results ────────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {/* Adequacy banner */}
            <div className={`flex items-start gap-3 rounded-xl px-4 py-3 border ${
              r.isAdequate ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}>
              {r.isAdequate
                ? <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                : <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />}
              <p className={`text-sm ${r.isAdequate ? "text-emerald-700" : "text-red-700"}`}>
                {r.isAdequate
                  ? `Coverage is adequate — ${r.replacementRatio}% income replacement meets the 70% Canadian standard.`
                  : `Coverage gap of ${fmt$(r.coverageGap)}/mo. Current coverage replaces only ${r.replacementRatio}% of gross income (target: 70%).`}
              </p>
            </div>

            {/* Gauge + top stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-start">
              <div className="sm:col-span-1 flex justify-center">
                <ReplacementGauge ratio={r.replacementRatio} t={t} />
              </div>
              {[
                { label: t.di.coverageGap70,  value: fmt$(r.coverageGap) + "/mo",     color: r.coverageGap === 0 ? "#16a34a" : "#dc2626" },
                { label: t.di.coverageGap85,  value: fmt$(r.coverageGapHigh) + "/mo", color: r.coverageGapHigh === 0 ? "#16a34a" : "#d97706" },
                { label: t.di.totalBenefitPeriod,value: fmt$(r.maxBenefit.totalAtTarget), color: "#0c1e3a",
                  sub: `over ${r.maxBenefit.yearsOfCoverage} yrs at 70%` },
              ].map((c, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{c.label}</p>
                  <p className="text-base font-bold" style={{ color: c.color }}>{c.value}</p>
                  {c.sub && <p className="text-[10px] text-gray-400">{c.sub}</p>}
                </div>
              ))}
            </div>

            {/* Coverage breakdown */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.di.coverageBreakdown}</p>
              <div className="space-y-2">
                {[
                  { label: t.di.grossMonthly,         value: fmt$(r.grossMonthlyIncome) + "/mo", bold: true },
                  { label: t.di.target70,               value: fmt$(r.targetMonthlyBenefit) + "/mo",     color: "#0c1e3a" },
                  { label: t.di.target85,               value: fmt$(r.targetMonthlyBenefitHigh) + "/mo", color: "#64748b" },
                  { label: t.di.groupDiGross,             value: fmt$(r.existing.groupGross) + "/mo" },
                  { label: `Group DI (after ${Math.round(r.taxTreatment.groupEffectiveRate * 100)}% tax)`,
                    value: fmt$(r.existing.groupAfterTax) + "/mo",
                    note: r.taxTreatment.groupTaxable ? t.di.taxable : t.common.taxFreeEmployeePaid },
                  { label: t.di.individualDi2,                value: fmt$(r.existing.individual) + "/mo", note: t.di.taxFree },
                  { label: t.di.cppDisAfterTax,   value: fmt$(r.existing.cppDisability) + "/mo" },
                  { label: t.di.totalExisting,      value: fmt$(r.existing.totalAfterTax) + "/mo", bold: true, color: r.isAdequate ? "#16a34a" : "#dc2626" },
                  { label: t.di.recommendedDi,    value: fmt$(r.coverageGap) + "/mo", bold: true, color: r.coverageGap > 0 ? "#dc2626" : "#16a34a" },
                ].map((row, i) => (
                  <div key={i} className={`flex justify-between text-xs py-1 ${i < 8 ? "border-b border-gray-200" : ""}`}>
                    <span className={`${row.bold ? "font-semibold text-gray-700" : "text-gray-500"}`}>{row.label}</span>
                    <div className="text-right">
                      <span className={`${row.bold ? "font-bold" : "font-semibold"} text-xs`} style={{ color: row.color || "#374151" }}>{row.value}</span>
                      {row.note && <p className="text-[10px] text-gray-400">{row.note}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Claim probability */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Lifetime Claim Probability — Class {form.occupationClass}
              </p>
              <div className="space-y-2.5">
                <ProbBar label={t.di.ownOccupation} prob={r.claimProbability.ownOcc} color="#dc2626" />
                <ProbBar label={t.di.anyOccupation} prob={r.claimProbability.anyOcc} color="#d97706" />
              </div>
              {form.definition === "any_occ" && r.claimProbability.ownVsAnyGap > 0 && (
                <div className="mt-3 flex items-start gap-2 bg-amber-50 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Any-occ definition leaves <strong>{fmt$(r.claimProbability.ownVsAnyGap)}/yr</strong> of income
                    at risk that own-occ would cover. Consider upgrading the definition.
                  </p>
                </div>
              )}
            </div>

            {/* Two column — waiting period + COLA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.di.waitingCost}</p>
                <p className="text-xl font-bold text-[#0c1e3a]">{fmt$(r.waitingPeriodCost)}</p>
                <p className="text-xs text-gray-400 mt-1">out-of-pocket during {form.waitingPeriodDays}-day wait</p>
                <p className="text-xs text-gray-500 mt-2">
                  Requires <strong>{r.emergencyFundMonths} months</strong> emergency fund to bridge the elimination period.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  COLA Rider ({form.colaPct}%/yr)
                </p>
                {r.coverageGap > 0 ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">{t.di.benefitToday}</span>
                        <span className="font-semibold">{fmt$(r.coverageGap)}/mo</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">At year 5</span>
                        <span className="font-semibold text-emerald-600">{fmt$(r.cola.benefitAtYear5)}/mo</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">At year 10</span>
                        <span className="font-semibold text-emerald-600">{fmt$(r.cola.benefitAtYear10)}/mo</span>
                      </div>
                    </div>
                    <p className="text-xs text-emerald-600 mt-2 font-semibold">
                      +{fmt$(r.cola.addedValueAtYear10)} added value over 10yr vs no COLA
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-gray-400">No coverage gap — COLA would apply to any new coverage purchased.</p>
                )}
              </div>
            </div>

            {/* Partial disability */}
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Partial Disability / Return to Work
              </p>
              <p className="text-xs text-gray-600">
                If income drops below <strong>{fmt$(r.partialDisability.triggerIncomeThreshold)}/mo</strong> ({form.partialDisabilityPct}% of gross),
                partial disability benefit of <strong>{fmt$(r.partialDisability.partialBenefit)}/mo</strong> activates
                proportionally to the income reduction.
              </p>
            </div>

            {/* Tax treatment */}
            <div className={`rounded-xl p-4 border ${r.taxTreatment.groupTaxable ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${r.taxTreatment.groupTaxable ? "text-amber-600" : "text-emerald-600"}`}>
                Tax Treatment
              </p>
              <p className="text-xs text-gray-700">{r.taxTreatment.recommendation}</p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
