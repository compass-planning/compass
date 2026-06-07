/**
 * LTCTab.tsx — Long-Term Care Planning Module
 *
 * Features:
 *  - Pool selector tiles (3 / 5 / 10 year) with live duration preview
 *  - Daily benefit, elimination period, inflation protection inputs
 *  - Provincial cost comparison (auto-populated from province)
 *  - Results: pool summary, self-insure vs insure chart, break-even, hybrid panel
 *  - Save analysis to DB
 */

import { useState, useEffect, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  Shield, ChevronDown, ChevronUp, Save, Trash2,
  AlertTriangle, TrendingDown, Clock, Heart,
} from "lucide-react";
import { translations, type T } from "../../i18n/translations";

interface Props { clientId: number; client?: any; t?: T; }

type PoolYears = 3 | 5 | 10;

interface FormState {
  person:              string;
  label:               string;
  currentAge:          number;
  province:            string;
  dailyBenefit:        number;
  poolYears:           PoolYears;
  eliminationDays:     number;
  inflationProtection: string;
  estAnnualPremium:    number;
  careCostInflation:   number;
  estClaimAge:         number;
  careLevel:           string;
  hybridLifeBenefit:   number;
  hybridLtcPct:        number;
  notes:               string;
}

interface LTCResult {
  totalPoolDollars:      number;
  dailyBenefitAtClaim:   number;
  poolDuration:          { atFullRate: number; at80pctRate: number; at60pctRate: number };
  eliminationCost:       number;
  dailyBenefitWithRider: number;
  riderValueAdd:         number;
  selfInsure:            { totalCareCostAtClaim: number; selectedLevelCost: number; npvTodayFullRate: number; npvTodayAtPool: number };
  totalPremiumsToClaimAge: number;
  totalPremiumsToLife:   number;
  breakEvenAge:          number;
  breakEvenYears:        number;
  hybrid?:               { ltcPool: number; lifeBenefit: number; ltcMonthlyMax: number };
  provincialDailyCost:   number;
  adequacyGap:           number;
}

interface SavedAnalysis extends FormState {
  id: number;
  result: LTCResult;
  resultData?: LTCResult;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt$ = (n: number) => {
  const abs = Math.abs(Math.round(n));
  if (abs >= 1_000_000) return (n < 0 ? "-$" : "$") + (abs / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return (n < 0 ? "-$" : "$") + Math.round(abs / 1_000).toLocaleString() + "K";
  return (n < 0 ? "-$" : "$") + abs.toLocaleString();
};

const PROVINCES = ["AB","BC","MB","NB","NL","NS","ON","PE","QC","SK"];

const DEFAULT_FORM: FormState = {
  person: "primary", label: "", currentAge: 55, province: "ON",
  dailyBenefit: 200, poolYears: 5, eliminationDays: 90,
  inflationProtection: "none", estAnnualPremium: 0,
  careCostInflation: 4, estClaimAge: 80, careLevel: "semi_private",
  hybridLifeBenefit: 0, hybridLtcPct: 50, notes: "",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "#0c1e3a", highlight = false }:
  { label: string; value: string; sub?: string; color?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 ${highlight ? "bg-[#0c1e3a]" : "bg-gray-50"}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider mb-1 ${highlight ? "text-white/60" : "text-gray-400"}`}>{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-white" : ""}`} style={highlight ? {} : { color }}>{value}</p>
      {sub && <p className={`text-[10px] mt-0.5 ${highlight ? "text-white/50" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, type = "text", min, max, step, prefix, placeholder }:
  { value: any; onChange: (v: any) => void; type?: string; min?: number; max?: number; step?: number; prefix?: string; placeholder?: string }) {
  return (
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">{prefix}</span>}
      <input type={type} value={value} min={min} max={max} step={step}
        placeholder={placeholder} onChange={e => onChange(type === "number" ? +e.target.value : e.target.value)}
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

// ── Pool Selector Tile ────────────────────────────────────────────────────────

function PoolTile({ years, dailyBenefit, selected, onSelect, result }:
  { years: PoolYears; dailyBenefit: number; selected: boolean; onSelect: () => void; result?: LTCResult }) {
  const pool = Math.round(dailyBenefit * years * 365);
  const dur80 = result ? result.poolDuration.at80pctRate : years * (1 / 0.8);
  return (
    <button onClick={onSelect}
      className={`flex-1 rounded-xl border-2 px-4 py-4 text-left transition-all ${
        selected ? "border-[#0c1e3a] bg-[#0c1e3a]/5" : "border-gray-200 hover:border-gray-300 bg-white"
      }`}>
      <p className={`text-sm font-bold mb-1 ${selected ? "text-[#0c1e3a]" : "text-gray-700"}`}>{years}-Year Pool</p>
      <p className={`text-xl font-bold mb-2 ${selected ? "text-[#0891b2]" : "text-gray-900"}`}>{fmt$(pool)}</p>
      <p className="text-[10px] text-gray-500">At full rate: ~{years} yrs</p>
      <p className="text-[10px] text-gray-400">At 80% use: ~{dur80.toFixed(1)} yrs</p>
    </button>
  );
}

// ── Self-Insure vs Insure Chart ───────────────────────────────────────────────

function SelfInsureChart({ result, currentAge, t }: { result: LTCResult; currentAge: number; t: T }) {
  const data = useMemo(() => {
    const annualPremium = result.totalPremiumsToLife / Math.max(1, 90 - currentAge);
    return Array.from({ length: Math.min(40, 90 - currentAge) }, (_, i) => {
      const age = currentAge + i;
      return {
        age,
        premiums: Math.round(annualPremium * i),
        selfInsure: age >= result.breakEvenAge - 10
          ? Math.round(result.selfInsure.npvTodayAtPool * ((age - currentAge) / (90 - currentAge)))
          : 0,
      };
    });
  }, [result, currentAge]);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="age" tick={{ fontSize: 10, fill: "#94A3B8" }}
          label={{ value: t.ltc.ageLabel, position: "insideBottom", offset: -2, fontSize: 10, fill: "#94A3B8" }} />
        <YAxis tickFormatter={v => "$" + Math.round(v / 1000) + "K"} tick={{ fontSize: 10, fill: "#94A3B8" }} width={52} />
        <Tooltip formatter={(v: any) => "$" + Math.round(v).toLocaleString()} />
        <Bar dataKey="premiums"  name={t.ltc.cumulativePremiums2} fill="#0891b2" radius={[2,2,0,0]} />
        {result.breakEvenAge < 90 && (
          <ReferenceLine x={result.breakEvenAge} stroke="#dc2626" strokeDasharray="4 4"
            label={{ value: `Break-even ${result.breakEvenAge}`, position: "top", fontSize: 9, fill: "#dc2626" }} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function LTCTab({ clientId, client, t = translations.en }: Props) {
  const [analyses,    setAnalyses]    = useState<SavedAnalysis[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState<FormState>({
    ...DEFAULT_FORM,
    province: client?.province || "ON",
    currentAge: client?.dateOfBirth
      ? new Date().getFullYear() - new Date(client.dateOfBirth).getFullYear()
      : 55,
  });
  const [liveResult,  setLiveResult]  = useState<LTCResult | null>(null);
  const [showHybrid,  setShowHybrid]  = useState(false);
  const [editing,     setEditing]     = useState<number | null>(null);
  const [showList,    setShowList]    = useState(true);

  const token = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
  const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const opts = { headers, credentials: "include" as RequestCredentials };

  // ── Load saved analyses ────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`/api/clients/${clientId}/ltc-analyses`, opts)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAnalyses(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  // ── Live calculation (client-side estimate while user types) ─────────────
  useEffect(() => {
    const dailyBenefit = form.dailyBenefit || 0;
    const pool = dailyBenefit * form.poolYears * 365;
    const yearsToClaimAge = Math.max(0, form.estClaimAge - form.currentAge);
    const inflMult = form.inflationProtection === "5pct" ? Math.pow(1.05, yearsToClaimAge)
      : form.inflationProtection === "3pct" ? Math.pow(1.03, yearsToClaimAge)
      : form.inflationProtection === "cpi"  ? Math.pow(1.02, yearsToClaimAge) : 1;
    const dailyAtClaim = Math.round(dailyBenefit * inflMult);

    const PROV_COSTS: Record<string, Record<string, number>> = {
      ON: { basic: 185, semi_private: 240, private: 325 },
      QC: { basic:  95, semi_private: 165, private: 250 },
      BC: { basic: 195, semi_private: 260, private: 360 },
      AB: { basic: 175, semi_private: 230, private: 310 },
    };
    const provCosts = PROV_COSTS[form.province] || PROV_COSTS.ON;
    const dailyCostAtClaim = Math.round((provCosts[form.careLevel] || 240) * Math.pow(1 + form.careCostInflation / 100, yearsToClaimAge));
    const annualCare = dailyCostAtClaim * 365;
    const poolDuration = {
      atFullRate:  pool / (dailyAtClaim * 365),
      at80pctRate: pool / (dailyAtClaim * 0.8 * 365),
      at60pctRate: pool / (dailyAtClaim * 0.6 * 365),
    };
    const annualPremium = form.estAnnualPremium || Math.round(dailyBenefit * (
      form.currentAge < 50 ? 3.5 : form.currentAge < 55 ? 4.8 :
      form.currentAge < 60 ? 7.2 : form.currentAge < 65 ? 11.5 : 18
    ) * (form.poolYears === 3 ? 0.75 : form.poolYears === 10 ? 1.45 : 1));

    const npvCare = Math.round(annualCare * form.poolYears / Math.pow(1.04, yearsToClaimAge));
    const breakEvenYears = annualPremium > 0 ? Math.round(npvCare / annualPremium) : 999;

    setLiveResult({
      totalPoolDollars: Math.round(pool),
      dailyBenefitAtClaim: dailyAtClaim,
      poolDuration: {
        atFullRate:  Math.round(poolDuration.atFullRate  * 10) / 10,
        at80pctRate: Math.round(poolDuration.at80pctRate * 10) / 10,
        at60pctRate: Math.round(poolDuration.at60pctRate * 10) / 10,
      },
      eliminationCost: Math.round(dailyCostAtClaim * form.eliminationDays),
      dailyBenefitWithRider: dailyAtClaim,
      riderValueAdd: Math.round((dailyAtClaim - dailyBenefit) * form.poolYears * 365),
      selfInsure: {
        totalCareCostAtClaim: annualCare,
        selectedLevelCost: dailyCostAtClaim,
        npvTodayFullRate: npvCare,
        npvTodayAtPool: npvCare,
      },
      totalPremiumsToClaimAge: Math.round(annualPremium * yearsToClaimAge),
      totalPremiumsToLife: Math.round(annualPremium * Math.max(0, 90 - form.currentAge)),
      breakEvenAge: Math.min(95, form.currentAge + breakEvenYears),
      breakEvenYears,
      provincialDailyCost: provCosts[form.careLevel] || 240,
      adequacyGap: Math.max(0, (provCosts[form.careLevel] || 240) - dailyBenefit),
      hybrid: showHybrid && form.hybridLifeBenefit > 0 ? {
        ltcPool: Math.round(form.hybridLifeBenefit * form.hybridLtcPct / 100),
        lifeBenefit: Math.round(form.hybridLifeBenefit * (1 - form.hybridLtcPct / 100)),
        ltcMonthlyMax: Math.round(form.hybridLifeBenefit * form.hybridLtcPct / 100 / (form.poolYears * 12)),
      } : undefined,
    });
  }, [form, showHybrid]);

  const set = (k: keyof FormState) => (v: any) => setForm(f => ({ ...f, [k]: v }));
  // Translated option arrays — defined inside component so t is in scope
  const ELIM_OPTIONS = [
    { value: 0,   label: t.ltc.noDays },
    { value: 30,  label: t.ltc.days30 },
    { value: 60,  label: t.ltc.days60 },
    { value: 90,  label: t.ltc.days90 },
    { value: 180, label: t.ltc.days180 },
    { value: 365, label: t.ltc.days365 },
  ];
  const INFLATION_OPTIONS = [
    { value: "none", label: t.ltc.inflNone },
    { value: "cpi",  label: t.ltc.inflCpi },
    { value: "3pct", label: t.ltc.infl3pct },
    { value: "5pct", label: t.ltc.infl5pct },
  ];
  const CARE_LEVELS = [
    { value: "basic",        label: t.ltc.careBasic },
    { value: "semi_private", label: t.ltc.careSemi },
    { value: "private",      label: t.ltc.carePrivate },
  ];

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    try {
      const body = {
        ...form,
        careCostInflation: form.careCostInflation / 100,
        hybridLifeBenefit: showHybrid ? form.hybridLifeBenefit : undefined,
        hybridLtcPct:      showHybrid ? form.hybridLtcPct      : undefined,
      };
      const url  = editing
        ? `/api/clients/${clientId}/ltc-analyses/${editing}`
        : `/api/clients/${clientId}/ltc-analyses`;
      const method = editing ? "PATCH" : "POST";
      const res = await fetch(url, { ...opts, method, body: JSON.stringify(body) });
      const data = await res.json();
      const entry = { ...data, result: data.result || data.resultData };
      setAnalyses(prev => editing
        ? prev.map(a => a.id === editing ? entry : a)
        : [entry, ...prev]);
      setEditing(null);
      setShowList(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm(t.ltc.deleteAnalysis)) return;
    await fetch(`/api/clients/${clientId}/ltc-analyses/${id}`, { ...opts, method: "DELETE" });
    setAnalyses(prev => prev.filter(a => a.id !== id));
  }

  function loadForEdit(a: SavedAnalysis) {
    setForm({ ...DEFAULT_FORM, ...a, careCostInflation: Number(a.careCostInflation) * 100 });
    setShowHybrid(!!a.hybridLifeBenefit);
    setEditing(a.id);
    setShowList(false);
  }

  const r = liveResult;

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Saved analyses list ────────────────────────────────────────────── */}
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
                      <p className="font-semibold text-sm text-gray-900">
                        {a.label || `LTC Analysis — ${a.poolYears}-Year Pool`}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Age {a.currentAge} · ${a.dailyBenefit}/day · {a.poolYears}-yr pool
                        {res && ` · Pool: ${fmt$(res.totalPoolDollars)} · Break-even: age ${res.breakEvenAge}`}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => loadForEdit(a)}
                        className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(a.id)}
                        className="text-xs px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              <button onClick={() => { setForm({ ...DEFAULT_FORM, province: client?.province||"ON" }); setEditing(null); setShowList(false); }}
                className="text-sm text-[#0891b2] hover:underline mt-1">
                + New Analysis
              </button>
            </div>
          )}
        </div>
      )}

      {(analyses.length === 0 || !showList) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── LEFT: Input form ────────────────────────────────────────────── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-4 h-4 text-[#0891b2]" />
              <h3 className="text-sm font-bold text-gray-800">{t.ltc.analysisInputs}</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.common.currentAge}>
                <Input type="number" value={form.currentAge} onChange={set("currentAge")} min={40} max={80} />
              </Field>
              <Field label={t.common.province}>
                <Select value={form.province} onChange={set("province")}
                  options={PROVINCES.map(p => ({ value: p, label: p }))} />
              </Field>
            </div>

            <Field label={t.ltc.dailyBenefit}>
              <Input type="number" value={form.dailyBenefit} onChange={set("dailyBenefit")} min={50} step={25} prefix="$" />
            </Field>

            {/* Pool selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">{t.ltc.poolSize}</label>
              <div className="flex gap-2">
                {([3, 5, 10] as PoolYears[]).map(y => (
                  <PoolTile key={y} years={y} dailyBenefit={form.dailyBenefit}
                    selected={form.poolYears === y}
                    onSelect={() => set("poolYears")(y)}
                    result={liveResult || undefined} />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.ltc.eliminationPeriod}>
                <Select value={form.eliminationDays} onChange={v => set("eliminationDays")(+v)}
                  options={ELIM_OPTIONS.map(o => ({ value: o.value, label: o.label }))} />
              </Field>
              <Field label={t.ltc.careLevel}>
                <Select value={form.careLevel} onChange={set("careLevel")} options={CARE_LEVELS} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.ltc.inflationProtection}>
                <Select value={form.inflationProtection} onChange={set("inflationProtection")} options={INFLATION_OPTIONS} />
              </Field>
              <Field label={t.ltc.estClaimAge}>
                <Input type="number" value={form.estClaimAge} onChange={set("estClaimAge")} min={60} max={90} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t.ltc.annualPremium}>
                <Input type="number" value={String(form.estAnnualPremium ?? "")} onChange={set("estAnnualPremium")} prefix="$"
                  placeholder={t.ltc.estimatePlaceholder} />
              </Field>
              <Field label={t.ltc.careCostInflation}>
                <Input type="number" value={form.careCostInflation} onChange={set("careCostInflation")} min={0} max={10} step={0.5} prefix="%" />
              </Field>
            </div>

            {/* Hybrid product toggle */}
            <div>
              <button onClick={() => setShowHybrid(v => !v)}
                className="flex items-center gap-2 text-xs font-semibold text-[#0891b2] hover:underline">
                {showHybrid ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                Hybrid Life / LTC Product
              </button>
              {showHybrid && (
                <div className="mt-2 grid grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3">
                  <Field label={t.ltc.totalBenefit}>
                    <Input type="number" value={form.hybridLifeBenefit} onChange={set("hybridLifeBenefit")} prefix="$" />
                  </Field>
                  <Field label={t.ltc.pctAllocatedLtc}>
                    <Input type="number" value={form.hybridLtcPct} onChange={set("hybridLtcPct")} min={10} max={90} prefix="%" />
                  </Field>
                </div>
              )}
            </div>

            <Field label={t.ltc.label}>
              <Input value={form.label} onChange={set("label")} />
            </Field>

            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? t.common.savingEllipsis : editing ? t.ltc.updateAnalysis : t.ltc.saveAnalysis}
            </button>
          </div>

          {/* ── RIGHT: Results panel ─────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-4">

            {r && (
              <>
                {/* Adequacy warning */}
                {r.adequacyGap > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-700">
                      The {form.province} benchmark for {CARE_LEVELS.find(c => c.value === form.careLevel)?.label.toLowerCase()} care
                      is <strong>${Math.round(r.provincialDailyCost)}/day</strong>.
                      This benefit is <strong>${Math.round(r.adequacyGap)}/day short</strong> of the provincial rate.
                    </p>
                  </div>
                )}

                {/* Pool summary cards */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label={t.ltc.totalBenefitPool} value={fmt$(r.totalPoolDollars)}
                    sub={`${form.poolYears}-year pool`} highlight />
                  <StatCard label={t.ltc.dailyBenefitAtClaim}
                    value={`$${Math.round(r.dailyBenefitAtClaim)}/day`}
                    sub={`age ${form.estClaimAge}${form.inflationProtection !== "none" ? " (inflation adj.)" : ""}`}
                    color="#0891b2" />
                  <StatCard label={t.ltc.poolLastsFullRate}
                    value={`~${r.poolDuration.atFullRate.toFixed(1)} yrs`}
                    sub={`~${r.poolDuration.at80pctRate.toFixed(1)} yrs at 80% use`} />
                  <StatCard label={t.ltc.breakEvenAge}
                    value={r.breakEvenAge < 95 ? `Age ${r.breakEvenAge}` : t.ltc.beyond95}
                    sub={r.breakEvenAge < 95 ? `${r.breakEvenYears} yrs from now` : t.ltc.premiumsLessThanCare}
                    color={r.breakEvenAge < form.estClaimAge ? "#16a34a" : "#d97706"} />
                </div>

                {/* Pool duration bar */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Pool Duration by Utilization Rate
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: t.ltc.fullDailyRate, years: r.poolDuration.atFullRate, color: "#dc2626" },
                      { label:  t.ltc.rate80pct,  years: r.poolDuration.at80pctRate, color: "#d97706" },
                      { label:  t.ltc.rate60pct,  years: r.poolDuration.at60pctRate, color: "#16a34a" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-32 flex-shrink-0">{row.label}</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (row.years / (form.poolYears * 2)) * 100)}%`, backgroundColor: row.color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-700 w-16 text-right">
                          ~{row.years.toFixed(1)} yrs
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">
                    Pools last longer than stated benefit period because most claimants draw below the maximum daily rate.
                    At 80% utilization, a {form.poolYears}-year pool provides approximately {r.poolDuration.at80pctRate.toFixed(1)} years of coverage.
                  </p>
                </div>

                {/* Financial comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Self-insure cost */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.ltc.selfInsureCost}</p>
                    <div className="space-y-2">
                      {[
                        { label: t.ltc.dailyCostAtClaim2, value: `$${Math.round(r.selfInsure.selectedLevelCost)}/day` },
                        { label: t.ltc.annualCostAtClaim2, value: fmt$(r.selfInsure.totalCareCostAtClaim) + "/yr" },
                        { label: `NPV today (${form.poolYears}-yr pool)`, value: fmt$(r.selfInsure.npvTodayAtPool), highlight: true },
                        { label: t.ltc.eliminationCost2, value: fmt$(r.eliminationCost), note: `${form.eliminationDays} days out-of-pocket` },
                      ].map((row, i) => (
                        <div key={i} className={`flex justify-between text-sm py-1 ${i < 3 ? "border-b border-gray-200" : ""}`}>
                          <span className="text-gray-500 text-xs">{row.label}</span>
                          <div className="text-right">
                            <span className={`font-semibold text-xs ${row.highlight ? "text-[#0c1e3a]" : "text-gray-800"}`}>{row.value}</span>
                            {row.note && <p className="text-[10px] text-gray-400">{row.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Insure cost */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t.ltc.insuranceCost}</p>
                    <div className="space-y-2">
                      {[
                        { label: t.ltc.estAnnualPremium2, value: fmt$(form.estAnnualPremium || Math.round(form.dailyBenefit * (form.currentAge < 55 ? 4.8 : form.currentAge < 60 ? 7.2 : 11.5))) + "/yr" },
                        { label: `Premiums to age ${form.estClaimAge}`, value: fmt$(r.totalPremiumsToClaimAge) },
                        { label: t.ltc.premiumsToAge90, value: fmt$(r.totalPremiumsToLife), highlight: true },
                        { label: "Break-even vs self-insure", value: r.breakEvenAge < 95 ? `Age ${r.breakEvenAge}` : t.ltc.beyond95 },
                      ].map((row, i) => (
                        <div key={i} className={`flex justify-between text-sm py-1 ${i < 3 ? "border-b border-gray-200" : ""}`}>
                          <span className="text-gray-500 text-xs">{row.label}</span>
                          <span className={`font-semibold text-xs ${row.highlight ? "text-[#0c1e3a]" : "text-gray-800"}`}>{row.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cumulative premiums chart */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    Cumulative Premiums Over Time
                  </p>
                  <SelfInsureChart result={r} currentAge={form.currentAge} t={t} />
                </div>

                {/* Inflation rider value */}
                {form.inflationProtection !== "none" && r.riderValueAdd > 0 && (
                  <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                    <TrendingDown className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-700">
                      The inflation rider adds <strong>{fmt$(r.riderValueAdd)}</strong> to the total benefit pool
                      by age {form.estClaimAge} vs no inflation protection.
                    </p>
                  </div>
                )}

                {/* Hybrid product panel */}
                {showHybrid && r.hybrid && (
                  <div className="border border-[#0891b2]/30 rounded-xl p-4 bg-[#0891b2]/5">
                    <p className="text-xs font-semibold text-[#0891b2] uppercase tracking-wider mb-3">
                      Hybrid Life / LTC Breakdown
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      <StatCard label={t.ltc.ltcBenefitPool}    value={fmt$(r.hybrid.ltcPool)}        sub={`${form.hybridLtcPct}% of total`} color="#0891b2" />
                      <StatCard label={t.ltc.lifeDeathBenefit} value={fmt$(r.hybrid.lifeBenefit)}   sub={t.ltc.ifLtcNotClaimed} color="#0c1e3a" />
                      <StatCard label={t.ltc.approxMonthlyMax}  value={fmt$(r.hybrid.ltcMonthlyMax)}  sub={t.ltc.fromLtcPool} color="#16a34a" />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-3">
                      In a hybrid product, the LTC pool ({fmt$(r.hybrid.ltcPool)}) is drawn first.
                      Any unused LTC pool remains as death benefit. If LTC is never claimed,
                      the full {fmt$(form.hybridLifeBenefit)} passes to beneficiaries.
                    </p>
                  </div>
                )}
              </>
            )}

            {!r && (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Shield className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">{t.ltc.enterInputs}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
