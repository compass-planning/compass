import { useLocale } from "../../hooks/useLocale";
import { translations, type T } from "../../i18n/translations";
import { useState, useEffect, useMemo } from "react";
import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ── Auth helper ───────────────────────────────────────────────────────────────

function authHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`,
  };
}

async function apiFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? "Request failed");
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface RetirementProjection {
  id?: number;
  clientId?: number;
  person?: string;   // "primary" | "spouse"
  label?: string;
  currentAge?: number;
  retirementAge?: number;
  lifeExpectancy?: number;
  currentSavings?: string;
  rrspBalance?: string;
  tfsaBalance?: string;
  nonRegBalance?: string;
  annualContribution?: string;
  annualTfsaContribution?: string;
  tfsaContributionsMade?: string;
  expectedReturn?: string;
  inflationRate?: string;
  desiredRetirementIncome?: string;
  pensionIncome?: string;
  cppStartAge?: number;
  oasStartAge?: number;
  cppMonthly?: string;
  oasMonthly?: string;
  projectedBalance?: string;
  shortfallSurplus?: string;
  successRate?: string;
  notes?: string;
}

interface Props {
  clientId: number;
  clientName?: string;
  projection?: RetirementProjection;
  onSaved?: (proj: RetirementProjection) => void;
  onCancel?: () => void;
  t?: T;
}

// ── Form state defaults ───────────────────────────────────────────────────────

const DEFAULTS = {
  label: "",
  currentAge: 40,
  retirementAge: 65,
  lifeExpectancy: 90,
  rrspBalance: "",
  tfsaBalance: "",
  tfsaContributionsMade: "",
  nonRegBalance: "",
  annualContribution: "",
  annualTfsaContribution: "7000",
  expectedReturn: "6.5",
  inflationRate: "2.0",
  desiredRetirementIncome: "",
  pensionIncome: "0",
  cppMonthly: "1364",
  cppStartAge: 65,
  oasMonthly: "713",
  oasStartAge: 65,
  notes: "",
};

type FormState = typeof DEFAULTS;

// ── Live calculation ──────────────────────────────────────────────────────────

function calcProjection(f: FormState) {
  const age     = +f.currentAge    || 40;
  const ret     = +f.retirementAge || 65;
  const life    = +f.lifeExpectancy|| 90;
  const rrsp    = +f.rrspBalance   || 0;
  const tfsa    = +f.tfsaBalance   || 0;
  const nonReg  = +f.nonRegBalance || 0;
  const contrib = +f.annualContribution || 0;
  const tfsaC   = +f.annualTfsaContribution || 0;
  const rate    = (+f.expectedReturn || 6.5) / 100;
  const infl    = (+f.inflationRate  || 2.0) / 100;
  const desired = +f.desiredRetirementIncome || 0;
  const pension = +f.pensionIncome  || 0;
  const cpp     = +f.cppMonthly     || 900;
  const cppAge  = +f.cppStartAge    || 65;
  const oas     = +f.oasMonthly     || 700;
  const oasAge  = +f.oasStartAge    || 65;

  const yToRet = Math.max(0, ret - age);
  const yInRet = Math.max(1, life - ret);

  // Accumulate to retirement
  let pRrsp = rrsp, pTfsa = tfsa, pNonReg = nonReg;
  for (let i = 0; i < yToRet; i++) {
    pRrsp   = (pRrsp   + contrib) * (1 + rate);
    pTfsa   = (pTfsa   + tfsaC)  * (1 + rate);
    pNonReg =  pNonReg            * (1 + rate);
  }
  const projRrsp   = Math.round(pRrsp);
  const projTfsa   = Math.round(pTfsa);
  const projNonReg = Math.round(pNonReg);
  const projTotal  = projRrsp + projTfsa + projNonReg;

  // CPP/OAS adjusted amounts (what they'll actually receive when they start)
  // CPP: -0.6%/month before 65, +0.7%/month after 65
  const cppFactor = cppAge <= 65
    ? 1 - 0.006 * (65 - cppAge) * 12
    : 1 + 0.007 * (cppAge - 65) * 12;
  // OAS: +0.6%/month after 65 (max defer to 70)
  const oasFactor = oasAge <= 65 ? 1 : 1 + 0.006 * (oasAge - 65) * 12;

  const cppMonthlyAdjusted = Math.round(cpp * cppFactor);
  const oasMonthlyAdjusted = Math.round(oas * oasFactor);

  // Annual amounts — only count if started by retirement age
  const cppAnnual = ret >= cppAge ? cppMonthlyAdjusted * 12 : 0;
  const oasAnnual = ret >= oasAge ? oasMonthlyAdjusted * 12 : 0;

  // Future value of gov income at retirement (inflation-adjusted from today)
  const cppAnnualAtRet = cppAnnual > 0 ? cppAnnual * Math.pow(1 + infl, yToRet) : 0;
  const oasAnnualAtRet = oasAnnual > 0 ? oasAnnual * Math.pow(1 + infl, yToRet) : 0;
  const pensionAtRet   = pension   > 0 ? pension   * Math.pow(1 + infl, yToRet) : 0;
  const govIncome      = cppAnnualAtRet + oasAnnualAtRet + pensionAtRet;

  // Desired income — today's dollars and inflation-adjusted at retirement
  const desiredToday  = desired;
  const desiredAtRet  = desired > 0 ? Math.round(desired * Math.pow(1 + infl, yToRet)) : 0;

  // Withdrawal needed from portfolio per year (in retirement dollars)
  const withdrawal = Math.max(0, desiredAtRet - govIncome);

  // Sustainable withdrawal (real-rate annuity)
  const realRate = rate - infl;
  const swr = realRate > 0 && projTotal > 0
    ? projTotal * realRate / (1 - Math.pow(1 + realRate, -yInRet))
    : projTotal / Math.max(1, yInRet);

  const surplus       = Math.round(swr - withdrawal);
  const funded        = desiredAtRet > 0 ? Math.min(100, Math.round((swr / desiredAtRet) * 100)) : 100;
  // Non-inflation-adjusted: compare swr against today's desired income
  const fundedNominal = desired > 0 ? Math.min(100, Math.round((swr / desired) * 100)) : 100;

  // RRIF: RRSP must convert by Dec 31 of the year client turns 71.
  // Defer RRSP withdrawals — RRSP keeps growing tax-deferred to 71, then RRIF minimums apply.
  const rrifAge = 71;
  const yearsRrspGrows = Math.max(0, rrifAge - ret); // extra RRSP growth after retirement before RRIF
  const rrspAtRrif = Math.round(projRrsp * Math.pow(1 + rate, yearsRrspGrows));

  // RRIF minimum factors (CRA prescribed, age 71-95+)
  const RRIF_FACTORS: Record<number, number> = {
    71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
    76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
    81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
    86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
    91: 0.1306, 92: 0.1449, 93: 0.1634, 94: 0.1879,
  };
  const rrifMinAtAge = (age: number, bal: number) => {
    if (age < 71) return bal / Math.max(1, 90 - age); // formula: 1/(90-age)
    return bal * (RRIF_FACTORS[Math.min(age, 94)] ?? 0.20);
  };
  const rrifMinYear71 = Math.round(rrifMinAtAge(71, rrspAtRrif));

  return {
    projTotal, projRrsp, projTfsa, projNonReg,
    govIncome: Math.round(govIncome),
    cppAdjusted: Math.round(cppAnnualAtRet),
    oasAdjusted: Math.round(oasAnnualAtRet),
    pensionAdjusted: Math.round(pensionAtRet),
    cppMonthlyAdjusted, oasMonthlyAdjusted,
    withdrawal: Math.round(withdrawal),
    surplus, funded, fundedNominal,
    desiredToday: Math.round(desiredToday),
    desiredAtRet,
    rrspAtRrif,
    rrifMinYear71,
  };
}

function fmt(n: number) {
  return "$" + Math.abs(Math.round(n)).toLocaleString();
}

// ── EditableField (hybrid preview → click → edit) ────────────────────────────

function EditableField({ label, value, onSave, type = "text", format, placeholder }: {
  label: string;
  value: string | number;
  onSave: (v: string) => void;
  type?: "text" | "number";
  format?: (v: string) => string;
  placeholder?: string;
}) {
  const { locale } = useLocale();
  const t = translations[locale as "en"|"fr"] ?? translations.en;
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(value));

  React.useEffect(() => { if (!editing) setVal(String(value)); }, [value, editing]);

  function commit(v: string) {
    setEditing(false);
    if (v !== String(value)) onSave(v);
  }

  const display = format ? format(String(value)) : String(value) || placeholder || "—";

  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      {editing ? (
        <input
          autoFocus
          type={type}
          value={val}
          placeholder={placeholder}
          onChange={e => setVal(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); commit(val); }
            if (e.key === "Escape") { setEditing(false); setVal(String(value)); }
          }}
          className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm font-medium focus:ring-2 focus:ring-blue-400 outline-none transition"
        />
      ) : (
        <p
          onClick={() => setEditing(true)}
          title={t.common.clickToEdit}
          className="text-sm font-semibold text-slate-900 cursor-pointer hover:bg-slate-100 px-1.5 py-0.5 rounded transition-colors -ml-1.5"
        >
          {display || <span className="text-slate-300 font-normal italic">{t.common.clickToSet}</span>}
        </p>
      )}
    </div>
  );
}

// ── Section (collapsible) ─────────────────────────────────────────────────────

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl transition-all duration-200 hover:shadow-sm">
      <div
        onClick={() => setOpen(!open)}
        className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-slate-50 transition rounded-2xl"
      >
        <p className="text-sm font-medium text-slate-700">{title}</p>
        <span className="text-slate-400 text-sm">{open ? "−" : "+"}</span>
      </div>
      {open && (
        <div className="px-5 pb-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export function RetirementProjectionForm({ clientId, clientName, projection, onSaved, onCancel, t = translations.en }: Props) {
  const qc = useQueryClient();

  // Initialise form from an existing projection or defaults
  const [f, setF] = useState<FormState>(() => ({
    ...DEFAULTS,
    ...(projection
      ? {
          label:                    projection.label              ?? "",
          currentAge:               projection.currentAge         ?? DEFAULTS.currentAge,
          retirementAge:            projection.retirementAge      ?? DEFAULTS.retirementAge,
          lifeExpectancy:           projection.lifeExpectancy     ?? DEFAULTS.lifeExpectancy,
          rrspBalance:              projection.rrspBalance        ?? "",
          tfsaBalance:              projection.tfsaBalance        ?? "",
          tfsaContributionsMade:   (projection as any).tfsaContributionsMade ?? "",
          nonRegBalance:            projection.nonRegBalance      ?? "",
          annualContribution:       projection.annualContribution ?? "",
          annualTfsaContribution:   projection.annualTfsaContribution ?? "7000",
          expectedReturn:           projection.expectedReturn     ?? "6.5",
          inflationRate:            projection.inflationRate      ?? "2.0",
          desiredRetirementIncome:  projection.desiredRetirementIncome ?? "",
          pensionIncome:            projection.pensionIncome      ?? "0",
          cppMonthly:               projection.cppMonthly        ?? "900",
          cppStartAge:              projection.cppStartAge        ?? 65,
          oasMonthly:               projection.oasMonthly        ?? "700",
          oasStartAge:              projection.oasStartAge        ?? 65,
          notes:                    projection.notes              ?? "",
        }
      : {}),
  }));

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setF(prev => ({ ...prev, [field]: e.target.type === "number" ? e.target.value : e.target.value }));
  };

  const calc = useMemo(() => calcProjection(f), [f]);

  // ── Save mutation ───────────────────────────────────────────────────────────
  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        person:                  (projection as any)?.person ?? "primary",
        label:                   f.label || undefined,
        currentAge:              +f.currentAge,
        retirementAge:           +f.retirementAge,
        lifeExpectancy:          +f.lifeExpectancy,
        rrspBalance:             f.rrspBalance   || "0",
        tfsaBalance:             f.tfsaBalance   || "0",
        tfsaContributionsMade:   f.tfsaContributionsMade || null,
        nonRegBalance:           f.nonRegBalance || "0",
        annualContribution:      f.annualContribution       || "0",
        annualTfsaContribution:  f.annualTfsaContribution   || "0",
        expectedReturn:          f.expectedReturn,
        inflationRate:           f.inflationRate,
        desiredRetirementIncome: f.desiredRetirementIncome  || "0",
        pensionIncome:           f.pensionIncome,
        cppMonthly:              f.cppMonthly,
        cppStartAge:             +f.cppStartAge,
        oasMonthly:              f.oasMonthly,
        oasStartAge:             +f.oasStartAge,
        projectedBalance:        String(calc.projTotal),
        shortfallSurplus:        String(calc.surplus),
        successRate:             String(calc.funded),
        notes:                   f.notes || undefined,
      };

      if (projection?.id) {
        return apiFetch(`/api/retirement/${projection.id}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      return apiFetch(`/api/clients/${clientId}/retirement`, { method: "POST", body: JSON.stringify(body) });
    },
    onSuccess: async (saved) => {
      // Run the proper Canadian engine immediately after save to update stored values
      if (saved?.id) {
        try {
          const token = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
          await fetch(`/api/clients/${clientId}/retirement/${saved.id}/project`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            credentials: "include",
          });
        } catch {}  // Non-blocking — projection was saved, engine is best-effort
      }
      qc.invalidateQueries({ queryKey: [`/api/clients/${clientId}/retirement`] });
      onSaved?.(saved);
    },
  });

  // ── Funding bar color ───────────────────────────────────────────────────────
  const barColor   = calc.funded >= 90 ? "#16a34a" : calc.funded >= 70 ? "#d97706" : "#dc2626";
  const surplusCol = calc.surplus >= 0 ? "#16a34a" : "#dc2626";

  const cppNotStarted = +f.retirementAge < +f.cppStartAge;
  const oasNotStarted = +f.retirementAge < +f.oasStartAge;

  // ── Metric cards ────────────────────────────────────────────────────────────
  const metrics = [
    {
      label: `Projected portfolio at ${f.retirementAge}`,
      value: fmt(calc.projTotal),
      sub: `RRSP ${fmt(calc.projRrsp)} · TFSA ${fmt(calc.projTfsa)} · Non-Reg ${fmt(calc.projNonReg)}`,
    },
    {
      label: t.retirement.guaranteedIncomeAtRet,
      value: calc.govIncome > 0 ? fmt(calc.govIncome) : "—",
      sub: [
        cppNotStarted
          ? `CPP starts age ${f.cppStartAge} (${fmt(calc.cppMonthlyAdjusted)}/mo)`
          : calc.cppAdjusted > 0 ? `CPP ${fmt(calc.cppAdjusted)}/yr` : null,
        oasNotStarted
          ? `OAS starts age ${f.oasStartAge}`
          : calc.oasAdjusted > 0 ? `OAS ${fmt(calc.oasAdjusted)}/yr` : null,
        calc.pensionAdjusted > 0 ? `Pension ${fmt(calc.pensionAdjusted)}/yr` : null,
      ].filter(Boolean).join(' · ') || t.retirement.noIncomeByRet,
      warn: cppNotStarted || oasNotStarted,
    },
    {
      label: t.retirement.desiredIncomeLabel,
      value: fmt(calc.desiredToday),
      sub: calc.desiredAtRet > 0
        ? `Today · inflation-adjusted ${fmt(calc.desiredAtRet)}/yr at age ${f.retirementAge}`
        : t.retirement.enterDesiredIncome,
    },
    {
      label: calc.surplus >= 0 ? t.retirement.surplusYr : t.retirement.shortfallYr,
      value: fmt(Math.abs(calc.surplus)),
      sub:   calc.surplus >= 0 ? t.retirement.portfolioSustains : t.retirement.annualGap,
      color: surplusCol,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{t.retirement.title}</h1>
          <p className="text-sm text-slate-500">{t.retirement.projectionSubtitle}</p>
        </div>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 p-1 text-lg leading-none">✕</button>
        )}
      </div>

      {/* ── Results (always visible, top) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 transition-all duration-200 hover:shadow-sm">
            <p className="text-xs text-slate-500">{m.label}</p>
            <p className="text-xl font-semibold mt-1" style={{ color: m.color ?? "#0f172a" }}>{m.value}</p>
            <p className={`text-[10px] mt-0.5 ${(m as any).warn ? "text-amber-500" : "text-slate-400"}`}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Funding bars */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 transition-all duration-200 hover:shadow-sm">
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-slate-500">{t.retirement.incomeAdjusted}</p>
            <span className="text-sm font-medium" style={{ color: barColor }}>{calc.funded}% funded</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${calc.funded}%`, backgroundColor: barColor }} />
          </div>
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-slate-500">Income coverage (today's dollars)</p>
            <span className="text-sm font-medium" style={{ color: calc.fundedNominal >= 90 ? "#16a34a" : calc.fundedNominal >= 70 ? "#d97706" : "#dc2626" }}>{calc.fundedNominal}% funded</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${calc.fundedNominal}%`, backgroundColor: calc.fundedNominal >= 90 ? "#16a34a" : calc.fundedNominal >= 70 ? "#d97706" : "#dc2626" }} />
          </div>
        </div>
        {calc.desiredAtRet > 0 && (
          <p className="text-xs text-slate-400">
            Based on {(+f.expectedReturn - +f.inflationRate).toFixed(1)}% real return over {Math.max(1, +f.lifeExpectancy - +f.retirementAge)}-year retirement
            {" · "}Desired income inflation-adjusted to {fmt(calc.desiredAtRet)}/yr at age {f.retirementAge}
          </p>
        )}
      </div>

      {/* ── Core Inputs — inline preview → click → edit ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-4">Retirement Setup <span className="text-xs text-slate-400 font-normal">· click any field to edit</span></p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <EditableField label={t.common.name}            value={f.label}                    onSave={v => setF(p => ({ ...p, label: v }))}                       placeholder={t.retirement.baseCaseLabel} />
          <EditableField label={t.common.currentAge}      value={f.currentAge}               onSave={v => setF(p => ({ ...p, currentAge: Number(v) }))}          type="number" format={v => `${v} yrs`} />
          <EditableField label={t.scenarioComparison.retirementAge}   value={f.retirementAge}            onSave={v => setF(p => ({ ...p, retirementAge: Number(v) }))}       type="number" format={v => `${v} yrs`} />
          <EditableField label={t.common.lifeExpectancy}  value={f.lifeExpectancy}           onSave={v => setF(p => ({ ...p, lifeExpectancy: Number(v) }))}      type="number" format={v => `${v} yrs`} />
          <EditableField label={t.retirement.desiredIncome}   value={f.desiredRetirementIncome}  onSave={v => setF(p => ({ ...p, desiredRetirementIncome: v }))}     type="number" format={v => `$${Number(v).toLocaleString("en-CA")}/yr`} />
          <EditableField label={t.retirement.pensionDb}     value={f.pensionIncome}            onSave={v => setF(p => ({ ...p, pensionIncome: v }))}               type="number" format={v => `$${Number(v).toLocaleString("en-CA")}/yr`} />
        </div>
      </div>

      {/* ── Portfolio (collapsible) ── */}
      <Section title={t.netWorth.portfolio}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.rrspBalance}</label>
            <input type="number" value={f.rrspBalance} onChange={set("rrspBalance")} placeholder="0" className="fp-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.tfsaBalance}</label>
            <input type="number" value={f.tfsaBalance} onChange={set("tfsaBalance")} placeholder="0" className="fp-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.tfsaContribMade}</label>
            <input type="number" value={f.tfsaContributionsMade} onChange={set("tfsaContributionsMade")} placeholder="e.g. 45000" className="fp-input" />
            <p className="text-[10px] text-slate-400 mt-0.5">Total contributions ever made — excludes growth. Used to calculate available room.</p>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.nonRegBalance}</label>
            <input type="number" value={f.nonRegBalance} onChange={set("nonRegBalance")} placeholder="0" className="fp-input" />
          </div>
        </div>
      </Section>

      {/* ── Growth & Contributions (collapsible) ── */}
      <Section title={t.retirement.growthContrib}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.annualRrspContrib}</label>
            <input type="number" value={f.annualContribution} onChange={set("annualContribution")} placeholder="0" className="fp-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.annualTfsaContrib}</label>
            <input type="number" value={f.annualTfsaContribution} onChange={set("annualTfsaContribution")} placeholder="7000" className="fp-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.expectedReturn}</label>
            <input type="number" step="0.1" value={f.expectedReturn} onChange={set("expectedReturn")} className="fp-input" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t.retirement.inflationRate}</label>
            <input type="number" step="0.1" value={f.inflationRate} onChange={set("inflationRate")} className="fp-input" />
          </div>
        </div>
      </Section>

      {/* ── Government Benefits (collapsible) ── */}
      <Section title={t.retirement.govBenefits}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">CPP monthly at 65 ($) <span className="text-slate-400">· 2026 max $1,364</span></label>
              <input type="number" value={f.cppMonthly} onChange={set("cppMonthly")} className="fp-input" />
              {calc.cppMonthlyAdjusted !== +f.cppMonthly && (
                <p className="text-xs text-blue-500 mt-1">Adjusted at age {f.cppStartAge}: ${calc.cppMonthlyAdjusted}/mo</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.retirement.cppStartAge}</label>
              <select value={f.cppStartAge} onChange={set("cppStartAge")} className="fp-input">
                <option value={60}>60 — reduced 36%</option>
                <option value={61}>61 — reduced 30%</option>
                <option value={62}>62 — reduced 24%</option>
                <option value={63}>63 — reduced 18%</option>
                <option value={64}>64 — reduced 12%</option>
                <option value={65}>65 — standard (100%)</option>
                <option value={66}>66 — enhanced 8.4%</option>
                <option value={67}>67 — enhanced 16.8%</option>
                <option value={68}>68 — enhanced 25.2%</option>
                <option value={69}>69 — enhanced 33.6%</option>
                <option value={70}>70 — maximum +42%</option>
              </select>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">OAS monthly at 65 ($) <span className="text-slate-400">· 2026 max $713</span></label>
              <input type="number" value={f.oasMonthly} onChange={set("oasMonthly")} className="fp-input" />
              {calc.oasMonthlyAdjusted !== +f.oasMonthly && (
                <p className="text-xs text-blue-500 mt-1">Adjusted at age {f.oasStartAge}: ${calc.oasMonthlyAdjusted}/mo</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t.retirement.oasStartAge}</label>
              <select value={f.oasStartAge} onChange={set("oasStartAge")} className="fp-input">
                <option value={65}>65 — standard (100%)</option>
                <option value={66}>66 — enhanced 7.2%</option>
                <option value={67}>67 — enhanced 14.4%</option>
                <option value={68}>68 — enhanced 21.6%</option>
                <option value={69}>69 — enhanced 28.8%</option>
                <option value={70}>70 — maximum +36%</option>
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* ── Insights ── */}
      {calc.rrspAtRrif > 0 && +f.retirementAge < 71 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-700">
          RRIF conversion at age 71 · RRSP grows to {fmt(calc.rrspAtRrif)} by age 71 · First year minimum withdrawal: {fmt(calc.rrifMinYear71)}/yr (5.28%)
        </div>
      )}

      {/* ── Notes ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 transition-all duration-200 hover:shadow-sm">
        <p className="text-sm font-medium text-slate-600 mb-2">{t.common.notes}</p>
        <textarea
          value={f.notes}
          onChange={set("notes")}
          rows={3}
          placeholder="Advisor notes, assumptions, follow-up items…"
          className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-400 outline-none transition resize-none"
        />
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-3 pb-6">
        {onCancel && (
          <button onClick={onCancel} className="px-5 py-2 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition">
            Cancel
          </button>
        )}
        <button
          onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}
          className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {saveMut.isPending ? t.common.savingEllipsis : projection?.id ? t.retirement.updateProjection : `Save projection`}
        </button>
      </div>

      {saveMut.isError && (
        <p className="text-xs text-red-500 mt-3 text-right">{(saveMut.error as Error).message}</p>
      )}

    </div>
  );
}

// ── Retirement Projections Tab ─────────────────────────────────────────────────
// Drop-in replacement for the existing retirement tab.
// Usage: <RetirementTab clientId={clientId} />

export function RetirementTab({ clientId, clientName, person: personProp, t = translations.en }: { clientId: number; clientName?: string; person?: string; t?: T }) {
  const qc = useQueryClient();
  const view = (personProp ?? "primary") as "primary" | "spouse" | "combined";
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<RetirementProjection | null>(null);
  const [checkupLoading, setCheckupLoading] = useState(false);
  const [checkupError, setCheckupError] = useState<string | null>(null);

  const runCheckup = async () => {
  setCheckupLoading(true);
  setCheckupError(null);
  try {
    const token = localStorage.getItem("fp_token") ?? "";
    const res = await fetch(`/api/reports/${clientId}/retirement`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Report error: ${res.status}`);
    const html = await res.text();
    const win = window.open("", "_blank");
    if (win) { win.document.write(html); win.document.close(); }
    else setCheckupError("Pop-up blocked — please allow pop-ups for this site");
  } catch (e: any) {
    setCheckupError(e.message ?? t.retirement.checkupFailed);
  } finally {
    setCheckupLoading(false);
  }
};

  // Fetch all projections for this client
  const { data: allProjections = [], isLoading } = useQuery<RetirementProjection[]>({
  queryKey: [`/api/clients/${clientId}/retirement`, view],
  queryFn: () => apiFetch(`/api/clients/${clientId}/retirement`),
    enabled: !!clientId && clientId > 0,
  });

  // ── Engine data: auto-run for all projections on load ─────────────────────
  const [engineData, setEngineData]       = React.useState<Record<number, any>>({});
  const [engineRunning, setEngineRunning] = React.useState<Set<number>>(new Set());

  React.useEffect(() => {
    if (!allProjections.length) return;
    const token = localStorage.getItem("authToken") || localStorage.getItem("fp_token") || "";
    const headers: HeadersInit = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    allProjections.forEach(p => {
      if (!p.id || engineData[p.id] || engineRunning.has(p.id!)) return;
      setEngineRunning(prev => new Set(prev).add(p.id!));
      fetch(`/api/clients/${clientId}/retirement/${p.id}/project`, {
        method: "POST", headers, credentials: "include",
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setEngineData(prev => ({ ...prev, [p.id!]: data })); })
        .catch(() => {})
        .finally(() => setEngineRunning(prev => { const s = new Set(prev); s.delete(p.id!); return s; }));
    });
  }, [allProjections, clientId]);  // eslint-disable-line

  const primaryProjections = allProjections.filter(p => (p.person ?? "primary") === "primary");
  const spouseProjections  = allProjections.filter(p => p.person === "spouse");

  // Fetch supporting data for seeding new projections
  const { data: clientData } = useQuery<any>({
    queryKey: [`/api/clients/${clientId}`],
    queryFn: () => apiFetch(`/api/clients/${clientId}`),
    enabled: !!clientId && clientId > 0,
  });
  const { data: nwEntries = [] } = useQuery<any[]>({
    queryKey: [`/api/clients/${clientId}/net-worth`],
    queryFn: () => apiFetch(`/api/clients/${clientId}/net-worth`),
    enabled: !!clientId && clientId > 0,
  });
  const { data: pensions = [] } = useQuery<any[]>({
    queryKey: [`/api/clients/${clientId}/pensions`],
    queryFn: () => apiFetch(`/api/clients/${clientId}/pensions`),
    enabled: !!clientId && clientId > 0,
  });

  const hasSpouse = !!(clientData?.spouseFirstName);

  // Build seeded defaults for primary or spouse
  const buildSeeds = (person: "primary" | "spouse") => {
    if (!clientData) return {};
    const nwSum = (category: string, owner?: string) =>
      nwEntries.filter((e: any) => e.category === category && (!owner || e.owner === owner))
               .reduce((s: number, e: any) => s + parseFloat(e.value || "0"), 0);

    if (person === "spouse") {
      const rrsp   = nwSum("RRSP", "primary")   + nwSum("RRSP", "joint");
      const tfsa   = nwSum("TFSA", "primary")   + nwSum("TFSA", "joint");
      const nonReg = nwSum(t.retirement.nonReg, "primary") + nwSum(t.retirement.nonReg, "joint");
      const dob    = clientData.spouseDateOfBirth ? new Date(clientData.spouseDateOfBirth) : null;
      return {
        person:                  "spouse",
        currentAge:              dob ? new Date().getFullYear() - dob.getFullYear() : undefined,
        retirementAge:           clientData.spouseRetirementAge ?? undefined,
        desiredRetirementIncome: clientData.spouseDesiredRetirementIncome ?? undefined,
        rrspBalance:             rrsp   > 0 ? String(Math.round(rrsp))   : undefined,
        tfsaBalance:             tfsa   > 0 ? String(Math.round(tfsa))   : undefined,
        nonRegBalance:           nonReg > 0 ? String(Math.round(nonReg)) : undefined,
      };
    }

    const rrsp   = nwSum("RRSP", "primary")   + nwSum("RRSP", "joint");
    const tfsa   = nwSum("TFSA", "primary")   + nwSum("TFSA", "joint");
    const nonReg = nwSum(t.retirement.nonReg, "primary") + nwSum(t.retirement.nonReg, "joint");
    const pensionIncome = pensions.reduce((sum: number, p: any) => {
      if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings)
        return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
      if (p.pensionType === "dcpp" && p.currentBalance)
        return sum + Number(p.currentBalance) * 0.04;
      return sum;
    }, 0);
    const dob = clientData.dateOfBirth ? new Date(clientData.dateOfBirth) : null;
    return {
      person:                  "primary",
      currentAge:              dob ? new Date().getFullYear() - dob.getFullYear() : undefined,
      retirementAge:           clientData.retirementAge ?? undefined,
      desiredRetirementIncome: clientData.desiredRetirementIncome ?? undefined,
      rrspBalance:             rrsp   > 0 ? String(Math.round(rrsp))   : undefined,
      tfsaBalance:             tfsa   > 0 ? String(Math.round(tfsa))   : undefined,
      nonRegBalance:           nonReg > 0 ? String(Math.round(nonReg)) : undefined,
      pensionIncome:           pensionIncome > 0 ? String(Math.round(pensionIncome)) : undefined,
    };
  };

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/retirement-projections/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/clients/${clientId}/retirement`] }),
  });

  if (adding || editing) {
    const person = editing ? (editing.person as "primary" | "spouse" ?? "primary") : (view === "combined" ? "primary" : view);
    return (
      <RetirementProjectionForm
        t={t}
        clientId={clientId}
        clientName={person === "spouse" ? (clientData?.spouseFirstName ?? t.common.spouse) : clientName}
        projection={editing ?? buildSeeds(person) as any}
        onSaved={() => { setAdding(false); setEditing(null); }}
        onCancel={() => { setAdding(false); setEditing(null); }}
      />
    );
  }

  // ── Combined view calculation ────────────────────────────────────────────────
  const combinedCalc = (() => {
    const p = primaryProjections[0];
    const s = spouseProjections[0];
    if (!p && !s) return null;
    // Prefer engine results; fall back to stored values
    const pEng = p?.id ? engineData[p.id]?.summary : null;
    const sEng = s?.id ? engineData[s.id]?.summary : null;
    const totalPortfolio = (pEng?.portfolioAtRetirement ?? Number(p?.projectedBalance ?? 0))
                         + (sEng?.portfolioAtRetirement ?? Number(s?.projectedBalance ?? 0));
    const totalDesired   = Number(p?.desiredRetirementIncome ?? 0) + Number(s?.desiredRetirementIncome ?? 0);
    const totalSurplus   = (pEng?.annualSurplusAtRetirement ?? Number(p?.shortfallSurplus ?? 0))
                         + (sEng?.annualSurplusAtRetirement ?? Number(s?.shortfallSurplus ?? 0));
    const avgSuccess     = ((pEng?.fundingRateAtRetirement ?? Number(p?.successRate ?? 0))
                         +  (sEng?.fundingRateAtRetirement ?? Number(s?.successRate ?? 0)))
                         / (p && s ? 2 : 1);
    return { totalPortfolio, totalDesired, totalSurplus, avgSuccess };
  })();

  const activeProjections = view === "primary" ? primaryProjections
    : view === "spouse" ? spouseProjections
    : allProjections;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-gray-900">{t.retirement.retirementProjections}</h3>
        <div className="flex gap-2 items-center">
          {checkupError && <span className="text-xs text-red-500">{checkupError}</span>}
          <button
            onClick={runCheckup}
            disabled={checkupLoading}
            className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {checkupLoading ? t.common.saving : t.retirement.retirementCheckup}
          </button>
          <button onClick={() => setAdding(true)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
            {t.retirement.addProjection}
          </button>
        </div>
      </div>

      {/* Combined summary */}
      {view === "combined" && combinedCalc && (
        <div className="border border-blue-200 bg-blue-50 rounded-xl p-5 mb-5">
          <p className="text-xs font-semibold tracking-widest text-blue-600 uppercase mb-3">{t.retirement.householdCombined}</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: t.retirement.combinedPortfolio, value: "$" + Math.round(combinedCalc.totalPortfolio).toLocaleString() },
              { label: t.retirement.combinedDesired, value: "$" + Math.round(combinedCalc.totalDesired).toLocaleString() + "/yr" },
              { label: combinedCalc.totalSurplus >= 0 ? t.retirement.combinedSurplusNote : t.retirement.combinedShortfall,
                value: "$" + Math.abs(Math.round(combinedCalc.totalSurplus)).toLocaleString() + "/yr",
                color: combinedCalc.totalSurplus >= 0 ? "#16a34a" : "#dc2626" },
              { label: t.retirement.avgFundingRate, value: Math.round(combinedCalc.avgSuccess) + "%" },
            ].map((m, i) => (
              <div key={i} className="bg-white rounded-lg px-3 py-2.5">
                <p className="text-xs text-gray-500 mb-0.5">{m.label}</p>
                <p className="text-sm font-semibold" style={{ color: (m as any).color ?? "#111827" }}>{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading / empty */}
      {isLoading && <p className="text-sm text-gray-400 py-8 text-center">{t.common.loading}</p>}
      {!isLoading && activeProjections.length === 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl py-12 text-center">
          <p className="text-gray-400 text-sm mb-3">
            {t.retirement.noProjectionsYet}
          </p>
          <button onClick={() => setAdding(true)} className="text-sm text-blue-600 hover:underline">
            {t.retirement.createFirstProjection}
          </button>
        </div>
      )}

      {/* Projection cards */}
      <div className="space-y-4">
        {activeProjections.map((proj) => {
          const isPerson  = (proj.person ?? "primary") as "primary" | "spouse";
          const personName = isPerson === "spouse" ? (clientData?.spouseFirstName ?? t.common.spouse) : (clientName ?? t.common.primary);

          // Income phase calculations
          const desiredIncome   = Number(proj.desiredRetirementIncome ?? 0);
          const pensionIncome   = Number(proj.pensionIncome ?? 0);
          const cppMonthly      = Number(proj.cppMonthly ?? 0);
          const oasMonthly      = Number(proj.oasMonthly ?? 0);
          const cppStartAge     = Number(proj.cppStartAge ?? 65);
          const oasStartAge     = Number(proj.oasStartAge ?? 65);
          const retirementAge   = Number(proj.retirementAge ?? 65);

          // CPP deferral bonus: +0.7% per month deferred past 60 (approx 8.4%/yr)
          const cppDeferralYears = Math.max(0, cppStartAge - 65);
          const cppAdjusted = cppMonthly * (1 + cppDeferralYears * 0.084);

          // OAS deferral bonus: +0.6% per month deferred past 65
          const oasDeferralYears = Math.max(0, oasStartAge - 65);
          const oasAdjusted = oasMonthly * (1 + oasDeferralYears * 0.072);

          // Phase 1: Retirement → CPP start (pension only, portfolio fills gap)
          const phase1GuaranteedAnnual = pensionIncome;
          const phase1PortfolioNeeded  = Math.max(0, desiredIncome - phase1GuaranteedAnnual);

          // Phase 2: CPP start → OAS start
          const phase2GuaranteedAnnual = pensionIncome + cppAdjusted * 12;
          const phase2PortfolioNeeded  = Math.max(0, desiredIncome - phase2GuaranteedAnnual);

          // Phase 3: OAS start onward
          const phase3GuaranteedAnnual = pensionIncome + cppAdjusted * 12 + oasAdjusted * 12;
          const phase3PortfolioNeeded  = Math.max(0, desiredIncome - phase3GuaranteedAnnual);

          // Prefer engine-computed values when available
          const eng = proj.id ? engineData[proj.id] : null;
          const engSummary = eng?.summary;
          const isEngineRunning = proj.id ? engineRunning.has(proj.id) : false;
          const projectedBalance = engSummary?.portfolioAtRetirement ?? Number(proj.projectedBalance ?? 0);
          const funded           = engSummary?.fundingRateAtRetirement ?? (proj.successRate ? +proj.successRate : null);
          const surplus          = engSummary?.annualSurplusAtRetirement ?? Number(proj.shortfallSurplus ?? 0);
          const estateValue      = engSummary?.estateValueAtDeath ?? 0;
          const guaranteedIncome = engSummary?.guaranteedIncomeAtRet ?? 0;
          const rrifMin          = engSummary?.rrifMinYear1 ?? 0;
          const lifetimeTax      = engSummary?.lifetimeTaxPaid ?? 0;
          const hasEngineData    = !!engSummary;
          const barColor  = funded === null ? "#9ca3af" : funded >= 90 ? "#16a34a" : funded >= 70 ? "#d97706" : "#dc2626";

          return (
            <div key={proj.id} className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors">
              {/* Card header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-900 text-sm">{proj.label || personName}</h4>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    isPerson === "spouse" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"
                  }`}>{isPerson === "spouse" ? t.common.spouse : t.common.primary}</span>
                  <span className="text-xs text-gray-400">Age {proj.currentAge} → {proj.retirementAge} · to age {proj.lifeExpectancy}</span>
                  {isEngineRunning && <span className="text-[10px] text-gray-400 animate-pulse">{t.common.calculating}</span>}
                  {hasEngineData && !isEngineRunning && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Engine ✓</span>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(proj)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-100">Edit</button>
                  <button onClick={() => proj.id && confirm(t.retirement.deleteProjection) && deleteMut.mutate(proj.id)} className="text-xs px-2.5 py-1 border border-red-100 rounded-lg text-red-500 hover:bg-red-50">{t.common.delete}</button>
                </div>
              </div>

              <div className="p-4 space-y-4">
                {/* Top KPIs */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.retirement.projectedPortfolio}</p>
                    <p className="text-base font-bold text-gray-900">${Math.round(projectedBalance).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400">at retirement age {retirementAge}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg px-3 py-2.5">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{t.retirement.desiredIncome}</p>
                    <p className="text-base font-bold text-gray-900">${Math.round(desiredIncome).toLocaleString()}/yr</p>
                    <p className="text-[10px] text-gray-400">${Math.round(desiredIncome / 12).toLocaleString()}/mo target</p>
                  </div>
                  <div className={`rounded-lg px-3 py-2.5 ${surplus >= 0 ? "bg-green-50" : "bg-red-50"}`}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{surplus >= 0 ? t.retirement.annualSurplusAtRet : t.retirement.annualShortfall}</p>
                    <p className={`text-base font-bold ${surplus >= 0 ? "text-green-700" : "text-red-700"}`}>${Math.abs(Math.round(surplus)).toLocaleString()}/yr</p>
                    <p className="text-[10px] text-gray-400">at retirement</p>
                  </div>
                </div>

                {/* Income phases */}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">{t.retirement.incomeByPhase}</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      {
                        label:      `At Retirement (age ${retirementAge})`,
                        guaranteed: phase1GuaranteedAnnual,
                        portfolio:  phase1PortfolioNeeded,
                        sources:    pensionIncome > 0 ? `Pension: $${Math.round(pensionIncome / 12).toLocaleString()}/mo` : t.retirement.noPension,
                        note:       cppStartAge > retirementAge ? `CPP starts age ${cppStartAge}` : t.retirement.cppIncluded,
                        color:      "border-[#0c1e3a]/20 bg-[#0c1e3a]/3",
                      },
                      {
                        label:      `CPP Starts (age ${cppStartAge})`,
                        guaranteed: phase2GuaranteedAnnual,
                        portfolio:  phase2PortfolioNeeded,
                        sources:    `CPP: $${Math.round(cppAdjusted).toLocaleString()}/mo${cppDeferralYears > 0 ? ` (+${(cppDeferralYears * 8.4).toFixed(0)}% deferral)` : ""}`,
                        note:       oasStartAge > cppStartAge ? `OAS starts age ${oasStartAge}` : t.retirement.oasIncluded,
                        color:      "border-blue-200 bg-blue-50/50",
                      },
                      {
                        label:      `OAS Starts (age ${oasStartAge})`,
                        guaranteed: phase3GuaranteedAnnual,
                        portfolio:  phase3PortfolioNeeded,
                        sources:    `OAS: $${Math.round(oasAdjusted).toLocaleString()}/mo${oasDeferralYears > 0 ? ` (+${(oasDeferralYears * 7.2).toFixed(0)}% deferral)` : ""}`,
                        note:       phase3PortfolioNeeded <= 0 ? t.retirement.fullyCovered : `Portfolio covers gap`,
                        color:      phase3PortfolioNeeded <= 0 ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50",
                      },
                    ].map((phase, i) => (
                      <div key={i} className={`rounded-lg border p-2.5 ${phase.color}`}>
                        <p className="text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">{phase.label}</p>
                        <p className="text-sm font-bold text-gray-900">${Math.round(phase.guaranteed / 12).toLocaleString()}<span className="text-[10px] font-normal text-gray-400">/mo guaranteed</span></p>
                        {phase.portfolio > 0 && (
                          <p className="text-xs text-amber-700 mt-0.5">+${Math.round(phase.portfolio / 12).toLocaleString()}/mo from portfolio</p>
                        )}
                        <p className="text-[10px] text-gray-500 mt-1.5 border-t border-white/50 pt-1">{phase.sources}</p>
                        <p className={`text-[10px] mt-0.5 ${phase.portfolio <= 0 ? "text-green-600 font-semibold" : "text-gray-400"}`}>{phase.note}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Success rate bar */}
                {funded !== null && (
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-500">Plan funding rate — probability income goal is met through age {proj.lifeExpectancy}</span>
                      <span className="text-xs font-semibold" style={{ color: barColor }}>{funded}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(funded, 100)}%`, backgroundColor: barColor }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {funded >= 90 ? t.retirement.strongPlan :
                       funded >= 70 ? t.retirement.moderatePlan :
                       t.retirement.atRiskPlan}
                    </p>
                  </div>
                )}

                {/* Engine metrics — only shown when engine has run */}
                {hasEngineData && (
                  <div className="border-t border-gray-100 pt-3 mt-1">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Canadian Engine Results
                    </p>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        {
                          label: t.retirement.estateAtLife,
                          value: estateValue > 0 ? "$" + Math.round(estateValue / 1000).toLocaleString() + "K" : "—",
                          sub: t.retirement.ageLabel + (proj.lifeExpectancy ?? 90),
                          color: estateValue > 0 ? "#16a34a" : "#dc2626",
                        },
                        {
                          label: t.retirement.guaranteedIncome2,
                          value: guaranteedIncome > 0 ? "$" + Math.round(guaranteedIncome).toLocaleString() + "/yr" : "—",
                          sub: t.retirement.cppOasPension,
                          color: "#0c1e3a",
                        },
                        {
                          label: t.scenarioComparison.rrifMinAt71,
                          value: rrifMin > 0 ? "$" + Math.round(rrifMin).toLocaleString() + "/yr" : "N/A",
                          sub: t.retirement.mandatoryWithdrawal,
                          color: rrifMin > 0 ? "#d97706" : "#9ca3af",
                        },
                        {
                          label: t.retirement.lifetimeTaxLabel,
                          value: lifetimeTax > 0 ? "$" + Math.round(lifetimeTax / 1000).toLocaleString() + "K" : "—",
                          sub: t.retirement.retirementPeriod,
                          color: "#64748b",
                        },
                      ].map((m, i) => (
                        <div key={i} className="bg-slate-50 rounded-lg px-2.5 py-2">
                          <p className="text-[10px] text-gray-400 mb-0.5">{m.label}</p>
                          <p className="text-xs font-bold" style={{ color: m.color }}>{m.value}</p>
                          <p className="text-[10px] text-gray-400">{m.sub}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
export default RetirementProjectionForm;
