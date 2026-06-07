import { useLocale } from '../hooks/useLocale';
import { translations, type T } from '../i18n/translations';
/**
 * MultiEntryTabs.tsx
 * Net Worth, Retirement, Insurance, RESP, Debt tabs
 * — all support adding multiple rows before saving
 */
import { toast } from "@/hooks/use-toast";
import { useState, useEffect, useContext, useCallback } from "react";
import { NWSubtabCtx } from "../components/layout/PlanningDocFlow";
import { api } from "../lib/api";
import { fmt$, fmtPct, cn } from "../lib/utils";
import { Plus, Trash2, Save, X, Pencil, Mic } from "lucide-react";
import { DrawdownTab } from "../components/planning/DrawdownTab";
import { VoiceAddDialog } from "../components/VoiceAddDialog";
import { DebtDashboard } from "../components/planning/DebtDashboard";
import { MonteCarloResults } from "../components/MonteCarloResults";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ── Shared mini components ────────────────────────────────────────────────────
const TH = ({ children }: { children?: React.ReactNode }) =>(
  <th className="text-left px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">{children}</th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={cn("px-3 py-2.5 text-sm", right && "text-right")}>{children}</td>
);
function Card({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm", className)}>{children}</div>;
}
function SummaryBar({ items }: { items: { label: string; value: string; color: string; bg: string }[] }) {
  return (
    <div className="grid gap-4 mb-5" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
      {items.map(i => (
        <div key={i.label} className={`${i.bg} rounded-xl p-4`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{i.label}</p>
          <p className={`text-xl font-bold ${i.color}`}>{i.value}</p>
        </div>
      ))}
    </div>
  );
}
function InlineInput({ value, onChange, type = "text", placeholder, className, maxLength }: { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; className?: string; maxLength?: number }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength}
      className={cn("border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500", className)} />
  );
}
function InlineSelect({ value, onChange, options, labelMap }: { value: string; onChange: (v: string) => void; options: string[]; labelMap?: Record<string, string> }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
      {options.map(o => <option key={o} value={o}>{labelMap?.[o] ?? o}</option>)}
    </select>
  );
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
// Note: Pension lives in the Retirement Hub (Pension sub-tab); RESP lives in the
// Net Worth → Education sub-tab. They are intentionally absent from the Assets list.
const NW_ASSET_CATS = ["Principal Residence","Real Estate (other)","RRSP","TFSA","Non-Registered","Cash / Bank","Business","Employer Stock Options","Other Asset"];

function assetCatLabel(cat: string, t: T): string {
  const m: Record<string, string> = {
    "Principal Residence":    t.netWorth.catPrincipalResidence,
    "Real Estate (other)":    t.netWorth.catRealEstate,
    "RRSP":                   t.netWorth.catRRSP,
    "TFSA":                   t.netWorth.catTFSA,
    "Non-Registered":           t.netWorth.catNonRegistered,
    "Cash / Bank":            t.netWorth.catCashBank,
    "Business":               t.netWorth.catBusiness,
    "Employer Stock Options": t.netWorth.catEmployerStock,
    "Other Asset":            t.netWorth.catOtherAsset,
    "Mortgage":                  t.netWorth.catMortgage,
    "Other Liability":        t.netWorth.catOtherLiability,
    "HELOC":                  t.netWorth.catHELOC,
    "Car Loan":               t.netWorth.catCarLoan,
    "Credit Card":            t.netWorth.catCreditCard,
    "Student Loan":           t.netWorth.catStudentLoan,
    "Line of Credit":         t.netWorth.catLineOfCredit,
    "Property Taxes Owing":   t.netWorth.catPropertyTax,
    "Personal Taxes Owing":   t.netWorth.catPersonalTax,
  };
  return m[cat] ?? cat;
}

function debtTypeLabel(type: string, t: T): string {
  const m: Record<string, string> = {
    "mortgage":       t.debt.typeMortgage,
    "heloc":          t.debt.typeHeloc,
    "car_loan":       t.debt.typeCarLoan,
    "credit_card":    t.debt.typeCreditCard,
    "student_loan":   t.debt.typeStudentLoan,
    "line_of_credit": t.debt.typeLineOfCredit,
    "other":          t.debt.typeOther,
  };
  return m[type] ?? type;
}

function strategyLabel(s: string, t: T): string {
  const m: Record<string, string> = {
    "avalanche": t.debt.stratAvalanche,
    "snowball":  t.debt.stratSnowball,
  };
  return m[s] ?? s;
}

function holdingLabel(h: string, t: T): string {
  const m: Record<string, string> = {
    "Mutual Funds": t.netWorth.holdingMutualFunds,
    "Stock":        t.netWorth.holdingStock,
    "GIC":          t.netWorth.holdingGIC,
    "Annuity":      t.netWorth.holdingAnnuity,
  };
  return m[h] ?? h;
}

function propertyTypeLabel(p: string, t: T): string {
  const m: Record<string, string> = {
    "Family Occupied":  t.netWorth.propFamilyOccupied,
    "Cottage":          t.netWorth.propCottage,
    "Rental Property":  t.netWorth.propRental,
  };
  return m[p] ?? p;
}
const NW_ASSET_COLORS: Record<string, string> = {
  "Principal Residence":     "#22d3ee",
  "Real Estate (other)":     "#60a5fa",
  "RRSP":                    "#34d399",
  "TFSA":                    "#fbbf24",
  "Non-Registered":            "#c084fc",
  "Cash / Bank":             "#06b6d4",
  "Business":                "#a78bfa",
  "Employer Stock Options":  "#fb923c",
  "Other Asset":             "#f43f5e",
};
const NW_LIAB_CATS = ["Mortgage","HELOC","Car Loan","Credit Card","Student Loan","Line of Credit","Property Taxes Owing","Personal Taxes Owing","Other Liability"];
const DEBT_TYPES    = ["mortgage","heloc","car_loan","credit_card","student_loan","line_of_credit","other"];
const PENSION_TYPES = ["DBPP","DCPP","Self-Directed","Matching Contributions"];
const HOLDING_TYPES = ["Mutual Funds","Stock","GIC","Annuity"];
const PROPERTY_TYPES = ["Family Occupied","Cottage","Rental Property"];

// ── NET WORTH ─────────────────────────────────────────────────────────────────
interface NWEntry { id: number; type: string; category: string; name: string; owner: string; value: string; notes: string | null; metadata: any; }
type NWDraft = {
  type: "asset"|"liability"; category: string; name: string; owner: string; value: string; notes: string;
  isSpousal: boolean; rrspContributor: string;
  pensionType: string; matchPct: string;
  monthlyPayment: string;
  respBeneficiary: string;
  holdingType: string;
  jointWithSpouse: boolean;
  stockOptionType: string;
  propertyType: string;
  purchasePrice: string;
  rentalIncome: string;
  rentalExpenses: string;
  mortgageBalance: string;       // For Principal Residence / Real Estate (other) — auto-creates a linked Mortgage liability
  mortgageMonthlyPayment: string;
  includeInDebt: boolean;
};

function emptyDraft(type: "asset"|"liability", t = translations.en as T): NWDraft {
  return {
    type, category: type === "asset" ? "Principal Residence" : "Mortgage",
    name: "", owner: "primary", value: "", notes: "",
    isSpousal: false, rrspContributor: "",
    pensionType: "DBPP", matchPct: "",
    monthlyPayment: "",
    respBeneficiary: "",
    holdingType: "",
    jointWithSpouse: false,
    stockOptionType: "RSU",
    propertyType: "Family Occupied",
    purchasePrice: "",
    rentalIncome: "",
    rentalExpenses: "",
    mortgageBalance: "",
    mortgageMonthlyPayment: "",
    includeInDebt: false,
  };
}

function ExtraFields({ draft, onChange, spouseName, dependants, t }: { draft: NWDraft; onChange: (k: keyof NWDraft, v: any) => void; spouseName: string; dependants?: any[]; t: T }) {
  const elems: React.ReactNode[] = [];

  if (draft.category === "RRSP") {
    elems.push(
      <div key="spousal" className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
          <input type="checkbox" checked={draft.isSpousal} onChange={e => onChange("isSpousal", e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--accent-cyan)]" />
          Spousal RRSP
        </label>
        {draft.isSpousal && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--text-tertiary)]">{t.netWorth.contributor + ":"}</span>
            <select value={draft.rrspContributor} onChange={e => onChange("rrspContributor", e.target.value)} className={SELECT_CLS}>
              <option value="">{t.netWorth.selectContributor}</option>
              <option value="client">{t.common.primary}</option>
              <option value="spouse">{t.common.spouse}</option>
            </select>
          </div>
        )}
      </div>
    );
  }

  if (["RRSP","TFSA","Non-Registered"].includes(draft.category)) {
    elems.push(
      <div key="holdingType" className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--text-tertiary)]">Type:</span>
        <select value={draft.holdingType} onChange={e => onChange("holdingType", e.target.value)} className={SELECT_CLS}>
          <option value="">Select type…</option>
          {HOLDING_TYPES.map(h => <option key={h} value={h}>{holdingLabel(h, t)}</option>)}
        </select>
      </div>
    );
  }

  if (draft.category === "Non-Registered" && spouseName) {
    elems.push(
      <label key={t.common.joint} className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
        <input type="checkbox" checked={draft.jointWithSpouse} onChange={e => onChange("jointWithSpouse", e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--accent-cyan)]" />
        Jointly held with spouse
        <span className="text-[10px] text-[var(--text-tertiary)]">(sets owner to Joint)</span>
      </label>
    );
  }

  if (draft.category === "Employer Stock Options") {
    elems.push(
      <div key="stockopt" className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--text-tertiary)]">{t.netWorth.subType + ":"}</span>
        <select value={draft.stockOptionType} onChange={e => onChange("stockOptionType", e.target.value)} className={SELECT_CLS}>
          <option value="RSU">RSU — Restricted Stock Unit</option>
          <option value="ESU">ESU — Employee Stock Unit</option>
        </select>
      </div>
    );
  }

  if (draft.category === "Principal Residence") {
    elems.push(
      <div key="realestate-pr" className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">{t.netWorth.catMortgage} ($):</span>
          <InlineInput value={draft.mortgageBalance} onChange={v => onChange("mortgageBalance", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">{t.cashFlow.title} ($):</span>
          <InlineInput value={draft.mortgageMonthlyPayment} onChange={v => onChange("mortgageMonthlyPayment", v)} type="number" placeholder="0" className="w-28" />
        </div>
        {Number(draft.mortgageBalance) > 0 && (
          <span className="text-[10px] text-[var(--accent-cyan)] italic">"Adds a linked Mortgage to the Liabilities tab"</span>
        )}
      </div>
    );
  }

  if (draft.category === "Real Estate (other)") {
    elems.push(
      <div key="realestate-other" className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">{t.netWorth.propertyType + ":"}</span>
          <select value={draft.propertyType} onChange={e => onChange("propertyType", e.target.value)} className={SELECT_CLS}>
            {PROPERTY_TYPES.map(p => <option key={p} value={p}>{propertyTypeLabel(p, t)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Purchase price ($):</span>
          <InlineInput value={draft.purchasePrice} onChange={v => onChange("purchasePrice", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">{t.netWorth.catMortgage} ($):</span>
          <InlineInput value={draft.mortgageBalance} onChange={v => onChange("mortgageBalance", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">{t.cashFlow.title} ($):</span>
          <InlineInput value={draft.mortgageMonthlyPayment} onChange={v => onChange("mortgageMonthlyPayment", v)} type="number" placeholder="0" className="w-28" />
        </div>
        {draft.propertyType === "Rental Property" && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-tertiary)]">Annual rental income ($):</span>
              <InlineInput value={draft.rentalIncome} onChange={v => onChange("rentalIncome", v)} type="number" placeholder="0" className="w-28" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-tertiary)]">Annual expenses ($):</span>
              <InlineInput value={draft.rentalExpenses} onChange={v => onChange("rentalExpenses", v)} type="number" placeholder="0" className="w-28" />
            </div>
          </>
        )}
        {Number(draft.mortgageBalance) > 0 && (
          <span className="text-[10px] text-[var(--accent-cyan)] italic">"Adds a linked Mortgage to the Liabilities tab"</span>
        )}
      </div>
    );
  }

  if (!elems.length) return null;
  return <div className="flex flex-wrap gap-3 mt-2 pt-1 border-t border-[var(--border-subtle)]">{elems}</div>;
}

type NWEditForm = Partial<NWEntry & {
  isSpousal: boolean; rrspContributor: string; pensionType: string; matchPct: string;
  monthlyPayment: string; respBeneficiary: string;
  holdingType: string; jointWithSpouse: boolean; stockOptionType: string;
  propertyType: string; purchasePrice: string; rentalIncome: string; rentalExpenses: string;
}>;

// ─────────────────────────────────────────────────────────────────────────────
// REPLACE everything from line 242 to the end of the NetWorthTab function
// (up to but NOT including "// ── RETIREMENT TAB" comment)
// with the code below.
// ─────────────────────────────────────────────────────────────────────────────

// ── Helper sub-components ────────────────────────────────────────────────────

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide font-semibold text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-bold ${tone ?? "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function CategorySection({
  title, total, color, children, onAdd,
}: {
  title: string; total: string; color?: string; children: React.ReactNode; onAdd?: () => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div
        onClick={() => setOpen(o => !o)}
        className="flex justify-between items-center px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors select-none"
      >
        <div className="flex items-center gap-2.5">
          {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
          <p className="font-semibold text-slate-900 text-sm">{title}</p>
          <span className="text-xs text-slate-400">{open ? "▲" : "▼"}</span>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-emerald-600">{total}</p>
          {onAdd && (
            <button
              onClick={e => { e.stopPropagation(); onAdd(); }}
              className="text-xs text-cyan-500 border border-cyan-200 px-2 py-0.5 rounded-full hover:bg-cyan-50 transition-colors"
            >
              + Add
            </button>
          )}
        </div>
      </div>
      {open && <div className="border-t border-slate-100">{children}</div>}
    </div>
  );
}

function AssetRow({
  entry, onEdit, onDelete, ownerLabel, metaBadge, isAsset,
}: {
  entry: NWEntry; onEdit: () => void; onDelete: () => void;
  ownerLabel: string; metaBadge: React.ReactNode; isAsset: boolean;
}) {
  const { locale } = useLocale();
  const t = translations[locale as "en"|"fr"] ?? translations.en;
  return (
    <div className="group flex justify-between items-center px-5 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-900">{entry.name || entry.category}</p>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">{ownerLabel}</span>
        </div>
        {metaBadge && <div className="mt-0.5">{metaBadge}</div>}
      </div>
      <div className="flex items-center gap-4">
        <p className={`text-sm font-semibold ${isAsset ? "text-emerald-600" : "text-red-500"}`}>
          {fmt$(entry.value)}
        </p>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button onClick={onEdit} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title={t.common.edit}>
            <Pencil className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title={t.common.delete}>
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── normalizeCat — remap legacy category names ────────────────────────────────
function normalizeCat(e: NWEntry, t = translations.en as T): NWEntry {
  if (e.category === "ESU" || e.category === "RSU")
    return { ...e, category: "Employer Stock Options", metadata: { ...(e.metadata ?? {}), stockOptionType: e.category } };
  if (e.category === "Real Estate")
    return { ...e, category: "Real Estate (other)" };
  if (e.category === "RRSP/TFSA" || e.category === "Registered Investments (RRSP/TFSA)")
    return { ...e, category: "RRSP" };
  return e;
}

const LABEL_CLS = "text-[10px] text-slate-400 uppercase font-semibold block mb-0.5";
const SELECT_CLS = "border border-slate-200 bg-white text-slate-800 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:border-cyan-400";

function CustomTooltip({ active, payload, totalA }: { active?: boolean; payload?: any[]; totalA: number }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const pct = totalA > 0 ? (d.value / totalA) * 100 : 0;
    return (
      <div className="rounded-lg px-3 py-2 text-xs shadow-lg bg-slate-900 border border-white/10">
        <div className="font-semibold mb-0.5" style={{ color: d.color }}>{d.name}</div>
        <div className="text-white">{fmt$(d.value)}</div>
        <div className="text-slate-400">{pct.toFixed(1)}% of total</div>
      </div>
    );
  };

// ── NetWorthTab ───────────────────────────────────────────────────────────────
export function NetWorthTab({ clientId, client, t }: { clientId: number; t: T; client?: { firstName: string; lastName: string; spouseFirstName?: string | null; spouseLastName?: string | null } }) {
  const [entries, setEntries] = useState<NWEntry[]>([]);
  const [drafts, setDrafts]   = useState<NWDraft[]>([]);
  const [saving, setSaving]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { sub: nwTab } = useContext(NWSubtabCtx);
  const [editForm, setEditForm] = useState<NWEditForm>({});
  const [voiceOpen, setVoiceOpen] = useState<null | "asset" | "liability">(null);

  const spouseName  = client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "";
  const primaryName = client ? `${client.firstName} ${client.lastName}` : t.common.primary;

  const load = () => api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`).then(raw => setEntries(raw.map(e => normalizeCat(e))));
  useEffect(() => { load(); }, [clientId]);

  const assets = entries.filter(e => e.type === "asset");
  const liabs  = entries.filter(e => e.type === "liability");
  const totalA = assets.reduce((s, e) => s + Number(e.value), 0);
  const totalL = liabs.reduce((s, e) => s + Number(e.value), 0);
  const netWorth = totalA - totalL;

  function addDraft(type: "asset" | "liability") {
    setDrafts(d => [...d, emptyDraft(type)]);
  }
  function addVoiceDraft(type: "asset" | "liability", parsed: Record<string, string>) {
    const base = emptyDraft(type);
    const cats = type === "asset" ? NW_ASSET_CATS : NW_LIAB_CATS;
    const safeFallback = type === "asset" ? "Other Asset" : "Other Liability";
    let category = base.category || safeFallback;
    if (parsed.category) {
      const match = cats.find(c => c.toLowerCase() === parsed.category.toLowerCase());
      category = match ?? safeFallback;
    }
    setDrafts(d => [...d, {
      ...base, category,
      name: parsed.name ?? base.name,
      owner: (parsed.owner === "spouse" || parsed.owner === "joint" ? parsed.owner : "primary"),
      value: String(parsed.value ?? "").replace(/[^0-9.]/g, "") || base.value,
      notes: parsed.notes ?? base.notes,
      monthlyPayment: parsed.monthlyPayment ?? base.monthlyPayment,
      mortgageBalance: parsed.mortgageBalance ?? base.mortgageBalance,
      mortgageMonthlyPayment: parsed.mortgageMonthlyPayment ?? base.mortgageMonthlyPayment,
    }]);
  }
  function updateDraft(i: number, k: keyof NWDraft, v: any) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }
  function removeDraft(i: number) { setDrafts(d => d.filter((_, idx) => idx !== i)); }

  function startEdit(e: NWEntry) {
    const m = (e.metadata ?? {}) as any;
    const cat = e.category === "ESU" || e.category === "RSU" ? "Employer Stock Options" : e.category;
    setEditingId(+e.id);
    setEditForm({
      ...e, category: cat, notes: e.notes ?? "",
      isSpousal: !!m.spousal, rrspContributor: m.contributor ?? "",
      pensionType: m.pensionType ?? "DBPP", matchPct: m.matchPct ?? "",
      monthlyPayment: m.monthlyPayment ?? "", respBeneficiary: m.respBeneficiary ?? "",
      holdingType: m.holdingType ?? "", jointWithSpouse: e.owner === "joint",
      stockOptionType: m.stockOptionType ?? (e.category === "ESU" ? "ESU" : "RSU"),
      propertyType: m.propertyType ?? "Family Occupied",
      purchasePrice: m.purchasePrice ? String(m.purchasePrice) : "",
      rentalIncome: m.rentalIncome ? String(m.rentalIncome) : "",
      rentalExpenses: m.rentalExpenses ? String(m.rentalExpenses) : "",
    });
  }

  function buildMeta(form: NWEditForm): Record<string, any> {
    const m: any = {};
    const cat = form.category ?? "";
    if (cat === "RRSP" && form.isSpousal) { m.spousal = true; m.contributor = form.rrspContributor; }
    if ((form as any).monthlyPayment) m.monthlyPayment = (form as any).monthlyPayment;
    if (["RRSP", "TFSA", "Non-Registered"].includes(cat) && form.holdingType) m.holdingType = form.holdingType;
    if (cat === "Employer Stock Options" && form.stockOptionType) m.stockOptionType = form.stockOptionType;
    if (cat === "Real Estate (other)") {
      if (form.propertyType) m.propertyType = form.propertyType;
      if (form.purchasePrice) m.purchasePrice = form.purchasePrice;
      if (form.propertyType === "Rental Property") {
        if (form.rentalIncome) m.rentalIncome = form.rentalIncome;
        if (form.rentalExpenses) m.rentalExpenses = form.rentalExpenses;
      }
    }
    return m;
  }

  async function saveEdit() {
    if (!editingId || !editForm.value) return;
    setSaving(true);
    try {
      const m = buildMeta(editForm);
      let owner = editForm.owner ?? "primary";
      if (editForm.jointWithSpouse && editForm.category === "Non-Registered") owner = "joint";
      await api.put(`/api/net-worth/${editingId}`, {
        category: editForm.category, name: editForm.name || editForm.category,
        owner, value: editForm.value, notes: editForm.notes || null,
        metadata: Object.keys(m).length ? m : null,
      });
      setEditingId(null); setEditForm({});
      await load();
    } finally { setSaving(false); }
  }

  function isDraftSavable(d: NWDraft) {
    const isProperty = d.category === "Principal Residence" || d.category === "Real Estate (other)";
    if (isProperty) return Number(d.value || 0) > 0 || Number(d.purchasePrice || 0) > 0 || Number(d.mortgageBalance || 0) > 0;
    return Boolean(d.value);
  }

  async function saveAll() {
    const valid = drafts.filter(isDraftSavable);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(async d => {
        const m = buildMeta(d as any);
        let owner = d.owner;
        if (d.jointWithSpouse && d.category === "Non-Registered") owner = "joint";
        const propName = d.name || d.category;
        const isProperty = d.category === "Principal Residence" || d.category === "Real Estate (other)";
        const mortgageVal = Number(d.mortgageBalance || 0);
        const assetValue = isProperty && !Number(d.value || 0) && Number(d.purchasePrice || 0) > 0 ? d.purchasePrice : d.value;
        await api.post(`/api/clients/${clientId}/net-worth`, {
          type: d.type, category: d.category,
          name: propName, owner, value: assetValue, notes: d.notes || null,
          metadata: Object.keys(m).length ? m : null,
        });
        if (isProperty && mortgageVal > 0) {
          const mortgageMeta: any = { linkedAssetName: propName };
          if (d.mortgageMonthlyPayment) mortgageMeta.monthlyPayment = d.mortgageMonthlyPayment;
          await api.post(`/api/clients/${clientId}/net-worth`, {
            type: "liability", category: "Mortgage",
            name: `Mortgage — ${propName}`, owner,
            value: String(mortgageVal), notes: `Linked to ${propName}`,
            metadata: mortgageMeta,
          });
        }
        // Auto-create debt entry if checkbox checked
        if (d.type === "liability" && d.includeInDebt && Number(d.value || 0) > 0) {
          await api.post(`/api/clients/${clientId}/debt`, {
            name:           propName,
            category:       d.category,
            balance:        d.value,
            interestRate:   "0",
            minimumPayment: d.monthlyPayment || "0",
            payoffStrategy: "avalanche",
            notes:          `Linked from Net Worth — ${d.category}`,
          });
        }
      }));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm(t.netWorth.deleteEntry)) return;
    await api.delete(`/api/net-worth/${id}`); await load();
  }

  function ownerLabel(entry: NWEntry) {
    return entry.owner === "spouse" ? (spouseName || t.common.spouse) : entry.owner === "joint" ? "Joint" : primaryName;
  }

  function metaBadge(entry: NWEntry) {
    const m = (entry.metadata ?? {}) as any;
    const chips: React.ReactNode[] = [];
    if (entry.category === "RRSP" && m.spousal)
      chips.push(<span key="sp" className="text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded font-mono">Spousal · {m.contributor}</span>);
    if (m.linkedAssetName && entry.category === "Mortgage")
      chips.push(<span key="lnk" className="text-[10px] bg-cyan-50 text-cyan-600 px-1.5 py-0.5 rounded font-mono">↪ {m.linkedAssetName}</span>);
    if (m.holdingType)
      chips.push(<span key="ht" className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{m.holdingType}</span>);
    if (m.propertyType)
      chips.push(<span key="pt" className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">{m.propertyType}</span>);
    if (m.rentalIncome) {
      const net = Number(m.rentalIncome) - Number(m.rentalExpenses || 0);
      chips.push(<span key="rent" className="text-[10px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono">Rental {net >= 0 ? "+" : ""}{fmt$(net)}/yr</span>);
    }
    if (!chips.length) return null;
    return <div className="flex flex-wrap gap-1 mt-0.5">{chips}</div>;
  }

  // Education sub-tab
  if (nwTab === "education") {
    return <RespTab clientId={clientId} client={client} t={t} />;
  }

  const isAssets = nwTab !== "liabilities";
  const activeRows = isAssets ? assets : liabs;
  const activeCats = isAssets ? NW_ASSET_CATS : NW_LIAB_CATS;
  const activeDrafts = drafts.filter(d => d.type === (isAssets ? "asset" : "liability"));

  // Pie chart data
  const pieData = NW_ASSET_CATS
    .map(cat => ({
      name: cat,
      value: assets.filter(a => a.category === cat).reduce((s, a) => s + Number(a.value), 0),
      color: NW_ASSET_COLORS[cat] ?? "#6b7280",
    }))
    .filter(d => d.value > 0);

  return (
    <div className="p-6 h-full flex flex-col">

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <SummaryCard label={t.netWorth.totalNetWorth} value={fmt$(netWorth)} tone={netWorth >= 0 ? "text-slate-900" : "text-red-500"} />
        <SummaryCard label={t.netWorth.totalAssets} value={fmt$(totalA)} tone="text-emerald-600" />
        <SummaryCard label={t.netWorth.totalLiabilities} value={fmt$(totalL)} tone="text-red-500" />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0 h-full">

        {/* ── Left 2/3 ───────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4 overflow-y-auto min-h-0 h-full pr-2 pb-20">

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => addDraft("asset")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="w-4 h-4" />{t.netWorth.addAsset}
              </button>
              <button
                onClick={() => addDraft("liability")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />{t.netWorth.addLiability}
              </button>
            </div>
            <button
              onClick={() => setVoiceOpen(isAssets ? "asset" : "liability")}
              className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full hover:border-cyan-400 hover:text-cyan-500 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" /> {t.netWorth.voice}
            </button>
          </div>

          {/* New entry drafts */}
          {activeDrafts.length > 0 && (
            <div className="bg-white border border-cyan-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-700">{isAssets ? t.netWorth.newAssets : t.netWorth.newLiabilities}</span>
                <div className="flex gap-2">
                  <button onClick={() => setDrafts([])} className="text-xs text-slate-400 px-3 py-1 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                    {t.debt.discardAll}
                  </button>
                  <button onClick={saveAll} disabled={saving}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0c1e3a] px-3 py-1 rounded-lg disabled:opacity-50 hover:bg-[#0e2a4a] transition-colors"
                  >
                    <Save className="w-3 h-3" /> {saving ? t.common.savingEllipsis : `Save ${drafts.filter(isDraftSavable).length} Entries`}
                  </button>
                </div>
              </div>
              {activeDrafts.map((d, ri) => {
                const draftIdx = drafts.indexOf(d);
                return (
                  <div key={ri} className="px-5 py-4 border-b border-slate-50 last:border-0">
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <div>
                        <label className={LABEL_CLS}>{t.common.owner}</label>
                        <select value={d.owner} onChange={e => updateDraft(draftIdx, "owner", e.target.value)} className={SELECT_CLS}>
                          <option value="primary">{primaryName || t.common.primary}</option>
                          {spouseName && <option value="spouse">{spouseName}</option>}
                          {spouseName && <option value="joint">{t.common.joint}</option>}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>{t.common.category}</label>
                        <select value={d.category} onChange={e => updateDraft(draftIdx, "category", e.target.value)} className={SELECT_CLS}>
                          {activeCats.map(c => <option key={c} value={c}>{assetCatLabel(c, t)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>{t.common.name} / {t.common.notes}</label>
                        <InlineInput value={d.name} onChange={v => updateDraft(draftIdx, "name", v)} placeholder={d.category} />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>{isAssets ? t.netWorth.marketValue : t.netWorth.balanceOwing}</label>
                        <div className="flex gap-1">
                          <InlineInput type="number" value={d.value} onChange={v => updateDraft(draftIdx, "value", v)} placeholder="0" />
                          <button onClick={() => removeDraft(draftIdx)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {!isAssets && (
  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer mt-1">
    <input
      type="checkbox"
      checked={d.includeInDebt}
      onChange={e => updateDraft(draftIdx, "includeInDebt", e.target.checked)}
      className="w-3.5 h-3.5 rounded"
    />
    Include in Debt Tracker
  </label>
)}
                    <ExtraFields draft={d} onChange={(k, v) => updateDraft(draftIdx, k, v)} spouseName={spouseName} dependants={[]} t={t} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Category sections */}
          {activeCats.map(cat => {
            const catRows = activeRows.filter(e => e.category === cat);
            if (!catRows.length) return null;
            const catTotal = catRows.reduce((s, e) => s + Number(e.value), 0);
            return (
              <CategorySection
                key={cat}
                title={cat}
                total={fmt$(catTotal)}
                color={isAssets ? (NW_ASSET_COLORS[cat] ?? "#94a3b8") : "#f87171"}
              >
                {catRows.map(e => (
                  editingId === e.id ? (
                    // ── Inline edit form ──────────────────────────────────────
                    <div key={e.id} className="px-5 py-4 bg-slate-50 border-b border-slate-100">
                      <div className="grid grid-cols-4 gap-3 mb-2">
                        <div>
                          <label className={LABEL_CLS}>{t.common.owner}</label>
                          <select value={editForm.owner ?? "primary"} onChange={ev => setEditForm(f => ({ ...f, owner: ev.target.value }))} className={SELECT_CLS}>
                            <option value="primary">{primaryName || t.common.primary}</option>
                            {spouseName && <option value="spouse">{spouseName}</option>}
                            {spouseName && <option value="joint">{t.common.joint}</option>}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLS}>{t.common.category}</label>
                          <select value={editForm.category ?? ""} onChange={ev => setEditForm(f => ({ ...f, category: ev.target.value }))} className={SELECT_CLS}>
                            {activeCats.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLS}>{t.common.name}</label>
                          <InlineInput value={editForm.name ?? ""} onChange={v => setEditForm(f => ({ ...f, name: v }))} placeholder={editForm.category} />
                        </div>
                        <div>
                          <label className={LABEL_CLS}>{isAssets ? t.netWorth.marketValue : t.netWorth.balanceOwing}</label>
                          <InlineInput type="number" value={editForm.value ?? ""} onChange={v => setEditForm(f => ({ ...f, value: v }))} placeholder="0" />
                        </div>
                      </div>
                      {/* Extra fields for edit */}
                      <div className="flex flex-wrap gap-3 mb-3">
                        {["RRSP", "TFSA", "Non-Registered"].includes(editForm.category ?? "") && (
                          <>
                            {editForm.category === "RRSP" && (
                              <>
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                  <input type="checkbox" checked={!!editForm.isSpousal} onChange={ev => setEditForm(f => ({ ...f, isSpousal: ev.target.checked }))} className="w-3.5 h-3.5 rounded" />
                                  Spousal RRSP
                                </label>
                                {editForm.isSpousal && (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs text-slate-400">{t.netWorth.contributor + ":"}</span>
                                    <select value={editForm.rrspContributor ?? ""} onChange={ev => setEditForm(f => ({ ...f, rrspContributor: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                      <option value="">Select…</option>
                                      <option value="client">{primaryName || t.common.primary}</option>
                                      {spouseName && <option value="spouse">{spouseName}</option>}
                                    </select>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">{t.netWorth.holdingType + ":"}</span>
                              <select value={editForm.holdingType ?? ""} onChange={ev => setEditForm(f => ({ ...f, holdingType: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                <option value="">Select…</option>
                                {HOLDING_TYPES.map(h => <option key={h} value={h}>{holdingLabel(h, t)}</option>)}
                              </select>
                            </div>
                            {editForm.category === "Non-Registered" && spouseName && (
                              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                <input type="checkbox" checked={!!editForm.jointWithSpouse} onChange={ev => setEditForm(f => ({ ...f, jointWithSpouse: ev.target.checked, owner: ev.target.checked ? "joint" : f.owner }))} className="w-3.5 h-3.5 rounded" />
                                Jointly held with spouse
                              </label>
                            )}
                          </>
                        )}
                        {editForm.category === "Real Estate (other)" && (
                          <>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">{t.netWorth.propertyType + ":"}</span>
                              <select value={editForm.propertyType ?? "Family Occupied"} onChange={ev => setEditForm(f => ({ ...f, propertyType: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                {PROPERTY_TYPES.map(p => <option key={p} value={p}>{propertyTypeLabel(p, t)}</option>)}
                              </select>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">Purchase price ($):</span>
                              <InlineInput value={editForm.purchasePrice ?? ""} onChange={v => setEditForm(f => ({ ...f, purchasePrice: v }))} type="number" placeholder="0" className="w-28" />
                            </div>
                            {editForm.propertyType === "Rental Property" && (
                              <>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">Rental income/yr ($):</span>
                                  <InlineInput value={editForm.rentalIncome ?? ""} onChange={v => setEditForm(f => ({ ...f, rentalIncome: v }))} type="number" placeholder="0" className="w-28" />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">Expenses/yr ($):</span>
                                  <InlineInput value={editForm.rentalExpenses ?? ""} onChange={v => setEditForm(f => ({ ...f, rentalExpenses: v }))} type="number" placeholder="0" className="w-28" />
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-sm text-slate-500 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">{t.common.cancel}</button>
                        <button onClick={saveEdit} disabled={saving} className="text-sm font-semibold text-white bg-[#0c1e3a] px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#0e2a4a] transition-colors">
                          {saving ? t.common.savingEllipsis : t.common.save}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <AssetRow
                      key={e.id}
                      entry={e}
                      onEdit={() => startEdit(e)}
                      onDelete={() => del(e.id)}
                      ownerLabel={ownerLabel(e)}
                      metaBadge={metaBadge(e)}
                      isAsset={isAssets}
                    />
                  )
                ))}
              </CategorySection>
            );
          })}

          {activeRows.length === 0 && activeDrafts.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center shadow-sm">
              <p className="text-slate-400 text-sm">{t.netWorth.noAssetsYet}</p>
              <button onClick={() => addDraft(isAssets ? "asset" : "liability")} className="mt-3 text-cyan-500 text-sm hover:underline">
                {isAssets ? t.netWorth.addFirstAsset : t.netWorth.addFirstLiability}
              </button>
            </div>
          )}

        </div>

        {/* ── Right 1/3 ──────────────────────────────────────────────────── */}
        <div className="space-y-4 overflow-y-auto min-h-0 h-full pb-20">

          {/* Pie chart */}
          {totalA > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">Asset Allocation</p>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                      paddingAngle={2} dataKey="value" startAngle={90} endAngle={-270}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="transparent" />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip totalA={totalA} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 mt-3">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-xs text-slate-500 flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-semibold text-slate-700">{fmt$(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Net Worth summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t.netWorth.summaryPanel}</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t.netWorth.totalAssets}</span>
                <span className="font-semibold text-emerald-600">{fmt$(totalA)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{t.netWorth.totalLiabilities}</span>
                <span className="font-semibold text-red-500">{fmt$(totalL)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                <span className="font-semibold text-slate-900">{t.netWorth.totalNetWorth}</span>
                <span className={`font-bold text-lg ${netWorth >= 0 ? "text-slate-900" : "text-red-500"}`}>
                  {fmt$(netWorth)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Add */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">{t.netWorth.quickAdd}</p>
            <div className="space-y-1.5">
              {(isAssets ? NW_ASSET_CATS : NW_LIAB_CATS).map(cat => (
                <button key={cat} onClick={() => {
                  const d = emptyDraft(isAssets ? "asset" : "liability");
                  d.category = cat;
                  setDrafts(prev => [...prev, d]);
                }}
                  className="w-full text-left text-xs text-slate-500 hover:text-cyan-600 hover:bg-cyan-50 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                >
                  {isAssets && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: NW_ASSET_COLORS[cat] ?? "#94a3b8" }} />}
                  + {assetCatLabel(cat, t)}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Voice dialog */}
      {voiceOpen && (
        <VoiceAddDialog
          title={`Voice-Add ${voiceOpen === "asset" ? "Asset" : t.common.liability}`}
          moduleId={`net-worth-${voiceOpen}`}
          prompt={voiceOpen === "asset"
            ? `Try: "TFSA at TD worth twenty-five thousand, jointly with spouse"`
            : `Try: "RBC mortgage balance 320 thousand, monthly payment 1850"`}
          fieldSchema={[
            { key: "category", label: t.common.category, description: `Type of ${voiceOpen}`, enum: voiceOpen === "asset" ? NW_ASSET_CATS : NW_LIAB_CATS },
            { key: "name", label: t.common.name, description: "Description" },
            { key: "value", label: voiceOpen === "asset" ? "Value" : t.common.balance, description: "Amount in dollars" },
            { key: "owner", label: t.common.owner, description: "Who owns it", enum: ["primary", "spouse", "joint"] },
            ...(voiceOpen === "liability" ? [{ key: "monthlyPayment", label: "Monthly Pmt", description: "Monthly payment" }] : []),
          ]}
          onConfirm={(parsed: Record<string, string>) => { addVoiceDraft(voiceOpen, parsed); setVoiceOpen(null); }}
          onClose={() => setVoiceOpen(null)}
        />
      )}

    </div>
  );
}

// ── RETIREMENT TAB ─────────────────────────────────────────────────────────────

// CPP adjustment: -0.6%/month before 65, +0.7%/month after 65
function adjustCPP(monthlyBase: number, startAge: number): number {
  const monthsDiff = (startAge - 65) * 12;
  const factor = monthsDiff < 0
    ? 1 + monthsDiff * 0.006
    : 1 + monthsDiff * 0.007;
  return Math.round(monthlyBase * Math.max(factor, 0.36));
}

// OAS adjustment: +0.6%/month after 65 (max at 70 = +36%)
function adjustOAS(monthlyBase: number, startAge: number): number {
  const monthsDiff = Math.max(0, (startAge - 65) * 12);
  return Math.round(monthlyBase * (1 + monthsDiff * 0.006));
}

// Portfolio drawdown: project balance then apply 4% rule
function projectedAnnualDrawdown(
  currentBalance: number,
  annualContrib: number,
  expectedReturn: number,
  yearsToRetirement: number
): number {
  let bal = currentBalance;
  for (let i = 0; i < yearsToRetirement; i++) {
    bal = (bal + annualContrib) * (1 + expectedReturn);
  }
  return Math.round(bal * 0.04);
}

interface RetirementProj { 
  id: number; label: string | null; currentAge: number|null; retirementAge: number|null; 
  rrspBalance: string|null; tfsaBalance: string|null; nonRegBalance: string|null; 
  annualContribution: string|null; expectedReturn: string|null; inflationRate: string|null; 
  desiredRetirementIncome: string|null; cppStartAge: number|null; oasStartAge: number|null; 
  cppMonthly: string|null; oasMonthly: string|null; projectedBalance: string|null; 
  successRate: string|null; notes: string|null; createdAt?: string; 
}
type RetDraft = { 
  label: string; currentAge: string; retirementAge: string; 
  rrspBalance: string; tfsaBalance: string; nonRegBalance: string; 
  annualContribution: string; expectedReturn: string; inflationRate: string; 
  desiredRetirementIncome: string; cppStartAge: string; oasStartAge: string; 
  cppMonthly: string; oasMonthly: string; notes: string; 
};

export function RetirementTab({ clientId, client, person = "primary" }: { clientId: number; client?: any; person?: string }) {
  const { locale } = useLocale();
  const t = translations[locale as "en"|"fr"] ?? translations.en;
  const calcAge = useCallback((dob: string | null) => 
  dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
, []);
  const clientAge = calcAge(client?.dateOfBirth);
  const spouseAge = calcAge(client?.spouseDateOfBirth);
  const clientName = client ? client.firstName : t.common.primary;
  const spouseName = client?.spouseFirstName ?? t.common.spouse;
  const isSpouse   = person === "spouse";
  const isCouple   = person === "combined";
  const activeAge  = isSpouse ? spouseAge : clientAge;
  const activeRetAge = isSpouse ? (client?.spouseRetirementAge ?? 65) : (client?.retirementAge ?? 65);
  const activeDesiredIncome = isCouple
    ? String((Number(client?.desiredRetirementIncome ?? 0) + Number(client?.spouseDesiredRetirementIncome ?? 0)))
    : isSpouse
      ? String(client?.spouseDesiredRetirementIncome ?? 0)
      : String(client?.desiredRetirementIncome ?? 0);
  const emptyDraft = (label: string, age?: string): RetDraft => ({
    label,
    currentAge: age ?? (activeAge ? String(activeAge) : ""),
    retirementAge: String(activeRetAge),
    rrspBalance: "0", tfsaBalance: "0", nonRegBalance: "0",
    annualContribution: "0", expectedReturn: "6.5", inflationRate: "2.5",
    desiredRetirementIncome: activeDesiredIncome,
    cppStartAge: "65", oasStartAge: "65", cppMonthly: "900", oasMonthly: "700",
    notes: "",
  });

  const [rows, setRows]         = useState<RetirementProj[]>([]);
  const [drafts, setDrafts]     = useState<RetDraft[]>([]);
  const [saving, setSaving]     = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [netWorth, setNetWorth] = useState<any[]>([]);
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<"projections"|"drawdown">("projections");

  const [expenses, setExpenses]   = useState<any[]>([]);
  const [pensions, setPensions]   = useState<any[]>([]);
  const load = () => api.get<RetirementProj[]>(`/api/clients/${clientId}/retirement`).then(setRows);
  useEffect(() => {
    load();
    api.get<any[]>(`/api/clients/${clientId}/net-worth`).then(setNetWorth);
    api.get<any[]>(`/api/clients/${clientId}/expenses`).then(setExpenses);
    api.get<any[]>(`/api/clients/${clientId}/pensions`).then(setPensions);
  }, [clientId]);

  // When client retirement age changes, patch affected projections
  useEffect(() => {
    if (!rows.length || !client) return;
    const updates: Promise<any>[] = [];
    rows.forEach(r => {
      const isSpouseRow = r.label === client.spouseFirstName || (r.label === "Spouse" || r.label === t.common.spouse);
      const correctRetAge = isSpouseRow
        ? (client.spouseRetirementAge ?? 65)
        : (client.retirementAge ?? 65);
      if (r.retirementAge !== correctRetAge) {
        updates.push(api.patch(`/api/retirement/${r.id}`, { retirementAge: correctRetAge }));
      }
    });
    if (updates.length > 0) Promise.all(updates).then(load);
  }, [client?.retirementAge, client?.spouseRetirementAge]);

  const fmt$ = (v: any) => { const n = parseFloat(v ?? "0"); if (!n) return "-"; return "$" + n.toLocaleString("en-CA", { maximumFractionDigits: 0 }); };
  const fmtPct = (v: any) => { const n = parseFloat(v ?? "0"); if (!n) return "-"; return n + "%"; };

  function addDraft() {
    const primary = netWorth.filter(e => e.type === "asset" && e.owner !== "spouse" && e.owner !== "joint");
    const spouse  = netWorth.filter(e => e.type === "asset" && e.owner === "spouse");
    const joint   = netWorth.filter(e => e.type === "asset" && e.owner === "joint");
    const hasSpouse = spouse.length > 0 || !!client?.spouseFirstName;
    const sum = (arr: any[], cat: string) => arr.filter(e => e.category === cat).reduce((s: number, e: any) => s + Number(e.value), 0);
    const pRrsp   = sum(primary, "RRSP")   + sum(joint, "RRSP")   / 2;
    const pTfsa   = sum(primary, "TFSA")   + sum(joint, "TFSA")   / 2;
    const pNonReg = sum(primary, "Non-Registered") + sum(joint, "Non-Registered") / 2;
    const sRrsp   = sum(spouse,  "RRSP")   + sum(joint, "RRSP")   / 2;
    const sTfsa   = sum(spouse,  "TFSA")   + sum(joint, "TFSA")   / 2;
    const sNonReg = sum(spouse,  "Non-Registered") + sum(joint, "Non-Registered") / 2;

 // Calculate pension income from DBPP plans
    const dbppIncome = pensions
      .filter((p: any) => p.pensionType === "dbpp")
      .reduce((s: number, p: any) => {
        const rate   = Number(p.accrualRate || 0);
        const years  = Number(p.projectedYearsAtRetirement || p.yearsOfService || 0);
        const salary = Number(p.bestAverageEarnings || 0);
        return s + (rate * years * salary);
      }, 0);
    const dcppBalance = pensions
      .filter((p: any) => p.pensionType !== "dbpp")
      .reduce((s: number, p: any) => s + Number(p.currentBalance || 0), 0);


// Calculate retirement income need from expenses
    const retirementExpenses = expenses.filter((e: any) => e.includeInRetirement);
    const annualExpenseNeed = retirementExpenses.reduce((s: number, e: any) => {
      const monthly = Number(e.monthlyAmount || 0);
      const adj = Number(e.retirementAdjustmentPct ?? 100) / 100;
      return s + (monthly * 12 * adj);
    }, 0);
    const expenseBasedIncome = annualExpenseNeed > 0 ? String(Math.round(annualExpenseNeed)) : (client?.desiredRetirementIncome ? String(client.desiredRetirementIncome) : "0");
      
    const newDrafts: RetDraft[] = [];
    const combinedIncome = annualExpenseNeed > 0 ? String(Math.round(annualExpenseNeed))
      : String(Number(client?.desiredRetirementIncome ?? 0) + Number(client?.spouseDesiredRetirementIncome ?? 0));
    const primaryIncome  = client?.desiredRetirementIncome ? String(client.desiredRetirementIncome) : expenseBasedIncome;
    const spouseIncome   = client?.spouseDesiredRetirementIncome ? String(client.spouseDesiredRetirementIncome) : expenseBasedIncome;

    if (person === "combined" || person === "primary") {
      if (person === "combined") {
        newDrafts.push({
          ...emptyDraft(`${clientName} & ${spouseName}`),
          rrspBalance:             String(Math.round(pRrsp + sRrsp)),
          tfsaBalance:             String(Math.round(pTfsa + sTfsa)),
          nonRegBalance:           String(Math.round(pNonReg + sNonReg + dcppBalance)),
          desiredRetirementIncome: combinedIncome,
        });
      } else {
        newDrafts.push({
          ...emptyDraft(clientName, clientAge ? String(clientAge) : ""),
          rrspBalance:             String(Math.round(pRrsp)),
          tfsaBalance:             String(Math.round(pTfsa)),
          nonRegBalance:           String(Math.round(pNonReg)),
          desiredRetirementIncome: primaryIncome,
        });
      }
    }
    if (person === "spouse" && hasSpouse) {
      newDrafts.push({
        ...emptyDraft(spouseName, spouseAge ? String(spouseAge) : ""),
        rrspBalance:             String(Math.round(sRrsp)),
        tfsaBalance:             String(Math.round(sTfsa)),
        nonRegBalance:           String(Math.round(sNonReg)),
        desiredRetirementIncome: spouseIncome,
      });
    }
    setDrafts(prev => [...prev, ...newDrafts]);
  }

  function startEdit(p: RetirementProj) {
    setEditingId(p.id);
    setDrafts([{
      label: p.label ?? clientName,
      currentAge: p.currentAge ? String(p.currentAge) : "",
      retirementAge: p.retirementAge ? String(p.retirementAge) : "65",
      rrspBalance: p.rrspBalance ?? "0",
      tfsaBalance: p.tfsaBalance ?? "0",
      nonRegBalance: p.nonRegBalance ?? "0",
      annualContribution: p.annualContribution ?? "0",
      expectedReturn: p.expectedReturn ?? "6.5",
      inflationRate: p.inflationRate ?? "2.5",
      desiredRetirementIncome: p.desiredRetirementIncome ?? "0",
      cppStartAge: p.cppStartAge ? String(p.cppStartAge) : "65",
      oasStartAge: p.oasStartAge ? String(p.oasStartAge) : "65",
      cppMonthly: p.cppMonthly ?? "900",
      oasMonthly: p.oasMonthly ?? "700",
      notes: p.notes ?? "",
    }]);
  }

  async function saveAll() {
    const valid = drafts.filter(d => d.currentAge && d.retirementAge);
    if (!valid.length) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/api/retirement/${editingId}`, valid[0]);
        setEditingId(null);
      } else {
        await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/retirement`, d)));
      }
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm(t.netWorth.deleteProjection)) return;
    await api.delete(`/api/retirement/${id}`);
    await load();
  }

  async function runSim() {
    setSimulating(true);
    try {
      const r = await api.post<any>(`/api/clients/${clientId}/simulate`, { simulations: 1000, equityAllocation: 60, equityReturn: 7.0, equityStdDev: 12.0, bondReturn: 4.0, bondStdDev: 5.0, inflationRate: 2.5, lifeExpectancy: 90 });
      setSimResult(r);
      await load();
    } catch (e: any) { alert(e.message); }
    finally { setSimulating(false); }
  }

  // Filter rows and drafts by person
  const filteredRows = rows.filter(r => {
    if (person === "primary")  return !r.label?.includes("&") && r.label !== spouseName && r.label !== t.common.spouse;
    if (person === "spouse")   return r.label === spouseName || (r.label === "Spouse" || r.label === t.common.spouse);
    return true; // combined shows all
  });
  const filteredDrafts = drafts.filter(d => {
    if (person === "primary")  return !d.label?.includes("&") && d.label !== spouseName && d.label !== t.common.spouse;
    if (person === "spouse")   return d.label === spouseName || (d.label === "Spouse" || (d.label === "Spouse" || d.label === t.common.spouse));
    return true;
  });

  // Group by retirementAge + desiredRetirementIncome
  const groups: RetirementProj[][] = [];
  const used = new Set<number>();
  for (const p of filteredRows) {
    if (used.has(p.id)) continue;
    const siblings = filteredRows.filter(r => !used.has(r.id) && r.retirementAge === p.retirementAge && r.desiredRetirementIncome === p.desiredRetirementIncome && r.id !== p.id);
    const group = [p, ...siblings];
    group.forEach(r => used.add(r.id));
    groups.push(group);
  }

  const labelColor = (label: string | null) => {
    if (!label) return "text-blue-600";
    if (label.includes("&")) return "text-indigo-600";
    if (label === spouseName || (label === "Spouse" || label === t.common.spouse)) return "text-pink-600";
    return "text-blue-600";
  };

 return (
    <div className="p-6 max-w-5xl mx-auto">
      {simResult && <MonteCarloResults result={simResult} onClose={() => setSimResult(null)} onPrint={() => window.print()} />}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(["projections","drawdown"] as const).map(key => (
          <button key={key} onClick={() => setActiveSubTab(key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeSubTab === key ? "bg-white border border-b-white border-gray-200 text-[#0c1e3a] -mb-px" : "text-gray-500 hover:text-gray-700"}`}>
            {key === "projections" ? t.netWorth.retirementProjections : t.netWorth.drawdownStrategies}
          </button>
        ))}
      </div>
      {activeSubTab === "drawdown" && <DrawdownTab clientId={clientId} client={client} />}
      {activeSubTab === "projections" && (
      <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">{t.netWorth.retirementProjections}</h2>
        <div className="flex gap-2">
          <button onClick={runSim} disabled={simulating}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
            {simulating ? t.common.running : t.netWorth.retirementCheckup}
          </button>
          <button onClick={addDraft}
            className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Add Projection
          </button>
        </div>
      </div>
      {filteredDrafts.length > 0 && (
        <div className="space-y-4 mb-5">
          {filteredDrafts.map((d, i) => {
            const i2 = drafts.indexOf(d);
            return (
            <Card key={i} className="p-5 border-blue-200 bg-blue-50/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">{editingId ? `Editing: ${d.label}` : d.label}</h3>
                <button onClick={() => setDrafts(x => x.filter((_, idx) => idx !== i2))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {([
                  [t.common.primary,"label","text"],["Current Age","currentAge","number"],["Retirement Age","retirementAge","number"],
                  ["RRSP Balance","rrspBalance","number"],["TFSA Balance","tfsaBalance","number"],["Non-Reg Balance","nonRegBalance","number"],
                  ["Annual Contribution","annualContribution","number"],["Expected Return %","expectedReturn","number"],["Desired Income","desiredRetirementIncome","number"],
                  ["CPP Monthly","cppMonthly","number"],["OAS Monthly","oasMonthly","number"],
                ] as [string,string,string][]).map(([l, k, t]) => (
                  <div key={k}>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">{l}</label>
                    <input type={t} step="any" value={(d as any)[k]}
                      onChange={e => setDrafts(x => x.map((x2, idx) => idx === i ? { ...x2, [k]: e.target.value } : x2))}
                      className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">CPP Start Age</label>
                  <select value={(d as any).cppStartAge}
                    onChange={e => setDrafts(x => x.map((x2, idx) => idx === i2 ? { ...x2, cppStartAge: e.target.value } : x2))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
                    {[60,61,62,63,64,65,66,67,68,69,70,71].map(age => {
                      const monthsDiff = (age - 65) * 12;
                      const pct = monthsDiff < 0 ? monthsDiff * 0.6 : monthsDiff * 0.7;
                      const label = age < 65 ? `reduced ${pct.toFixed(0)}%` : age === 65 ? "standard" : `+${pct.toFixed(0)}% enhanced`;
                      return <option key={age} value={age}>{age} — {label}</option>;
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">OAS Start Age</label>
                  <select value={(d as any).oasStartAge}
                    onChange={e => setDrafts(x => x.map((x2, idx) => idx === i2 ? { ...x2, oasStartAge: e.target.value } : x2))}
                    className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white">
                    {[65,66,67,68,69,70].map(age => {
                      const pct = (age - 65) * 7.2;
                      return <option key={age} value={age}>{age} — {pct > 0 ? `+${pct.toFixed(0)}% enhanced` : "standard"}</option>;
                    })}
                  </select>
                </div>
              </div>
            </Card>
            );
          })}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setDrafts([]); setEditingId(null); }} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">{t.common.cancel}</button>
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving2 : editingId ? t.common.saveChanges : `Save ${drafts.length} Projection${drafts.length > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      )}
      {filteredRows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No projections yet. Click Add Projection to create one.</Card>
      )}
      <div className="space-y-4">
        {groups.map((group, gi) => {
          const main = group.find(p => p.label?.includes("&")) ?? group[0];
          return (
            <Card key={gi} className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Retirement Plan — Target Age {main.retirementAge}</h3>
                <span className="text-xs text-gray-400">{main.createdAt ? new Date(main.createdAt).toLocaleDateString() : ""}</span>
              </div>
              <div className="space-y-4">
                {group.map(p => {
                  const cppBase   = Number(p.cppMonthly || 900);
                  const cppAge    = Number(p.cppStartAge || 65);
                  const oasBase   = Number(p.oasMonthly || 700);
                  const oasAge    = Number(p.oasStartAge || 65);
                  const adjCPP    = adjustCPP(cppBase, cppAge);
                  const adjOAS    = adjustOAS(oasBase, oasAge);
                  const annualCPP = adjCPP * 12;
                  const annualOAS = adjOAS * 12;
                  const totalBal  = Number(p.rrspBalance || 0) + Number(p.tfsaBalance || 0) + Number(p.nonRegBalance || 0);
                  const yrs       = Math.max(0, (p.retirementAge ?? 65) - (p.currentAge ?? 45));
                  const ret       = Number(p.expectedReturn || 0.06);
                  const contrib   = Number(p.annualContribution || 0);
                  const drawdown  = projectedAnnualDrawdown(totalBal, contrib, ret, yrs);
                  const projIncome = annualCPP + annualOAS + drawdown;
                  const desired   = Number(p.desiredRetirementIncome || 0);
                  const gap       = projIncome - desired;
                  const hasDesired = desired > 0;

                  return (
                    <div key={p.id} className="border border-gray-100 rounded-xl p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-sm font-bold ${labelColor(p.label)}`}>{p.label ?? clientName}</span>
                          <span className="text-xs text-gray-400">Age {p.currentAge} → {p.retirementAge}</span>
                          {p.successRate && (
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${Number(p.successRate) >= 85 ? "bg-emerald-100 text-emerald-700" : Number(p.successRate) >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-600"}`}>
                              {p.successRate}% success
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => startEdit(p)} className="p-1 text-gray-300 hover:text-[#0c1e3a]"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => del(p.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>

                      {/* Income summary row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="bg-blue-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-blue-600 uppercase">Projected Income</p>
                          <p className="text-lg font-bold text-blue-700">{fmt$(projIncome)}/yr</p>
                          <p className="text-[10px] text-blue-400 mt-0.5">CPP + OAS + portfolio</p>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-purple-600 uppercase">{t.retirement.desiredIncome}</p>
                          <p className="text-lg font-bold text-purple-700">{hasDesired ? `${fmt$(desired)}/yr` : "—"}</p>
                          <p className="text-[10px] text-purple-400 mt-0.5">retirement target</p>
                        </div>
                        <div className={`rounded-xl p-3 ${!hasDesired ? "bg-gray-50" : gap >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                          <p className={`text-[10px] font-bold uppercase ${!hasDesired ? "text-gray-400" : gap >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {!hasDesired ? t.common.shortfall : gap >= 0 ? t.common.surplus : t.common.shortfall}
                          </p>
                          <p className={`text-lg font-bold ${!hasDesired ? "text-gray-400" : gap >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {!hasDesired ? "—" : `${gap >= 0 ? "+" : ""}${fmt$(gap)}/yr`}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${!hasDesired ? "text-gray-300" : gap >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {!hasDesired ? t.retirement.setDesiredIncome : t.retirement.perYear}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase">Portfolio Drawdown</p>
                          <p className="text-lg font-bold text-gray-700">{fmt$(drawdown)}/yr</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">4% rule on projected balance</p>
                        </div>
                      </div>

                      {/* CPP / OAS / Assets row */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-amber-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-amber-600 uppercase">CPP (start age {cppAge})</p>
                          <p className="text-base font-bold text-amber-700">{fmt$(annualCPP)}/yr</p>
                          <p className="text-[10px] text-amber-500 mt-0.5">
                            {fmt$(adjCPP)}/mo
                            {cppAge !== 65 && (
                              <span className="ml-1">
                                ({cppAge < 65
                                  ? `-${Math.round((1 - adjCPP / cppBase) * 100)}%`
                                  : `+${Math.round((adjCPP / cppBase - 1) * 100)}%`} vs age 65)
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="bg-teal-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-teal-600 uppercase">OAS (start age {oasAge})</p>
                          <p className="text-base font-bold text-teal-700">{fmt$(annualOAS)}/yr</p>
                          <p className="text-[10px] text-teal-500 mt-0.5">
                            {fmt$(adjOAS)}/mo
                            {oasAge > 65 && <span className="ml-1">(+{((oasAge - 65) * 7.2).toFixed(0)}% enhanced)</span>}
                          </p>
                        </div>
                        <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">Current Portfolio</p>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <p className="text-[10px] text-gray-400">RRSP</p>
                              <p className="text-sm font-semibold text-gray-700">{fmt$(p.rrspBalance)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400">TFSA</p>
                              <p className="text-sm font-semibold text-gray-700">{fmt$(p.tfsaBalance)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400">Non-Reg</p>
                              <p className="text-sm font-semibold text-gray-700">{fmt$(p.nonRegBalance)}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>
      </div>
      )}
    </div>
  );
}
// ── INSURANCE ─────────────────────────────────────────────────────────────────
interface InsuranceRec { id: number; method: string; annualIncome: string|null; yearsToReplace: number|null; existingLifeCoverage: string|null; existingDisability: string|null; existingCriticalIllness: string|null; recommendedLife: string|null; recommendedDisability: string|null; recommendedCriticalIllness: string|null; lifeGap: string|null; disabilityGap: string|null; criticalIllnessGap: string|null; notes: string|null; }
type InsDraft = { method: string; annualIncome: string; yearsToReplace: string; existingLifeCoverage: string; existingDisability: string; existingCriticalIllness: string; notes: string; };
const emptyIns = (): InsDraft => ({ method:"dime", annualIncome:"", yearsToReplace:"20", existingLifeCoverage:"", existingDisability:"", existingCriticalIllness:"", notes:"" });

export function InsuranceTab({ clientId }: { clientId: number }) {
  const { locale } = useLocale();
  const t = translations[locale as "en"|"fr"] ?? translations.en;
  const [rows, setRows]     = useState<InsuranceRec[]>([]);
  const [drafts, setDrafts] = useState<InsDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<InsuranceRec[]>(`/api/clients/${clientId}/insurance`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  function updateDraft(i: number, k: keyof InsDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

    async function saveAll() {
    const valid = drafts.filter(d => d.annualIncome);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/insurance`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }
 

  async function del(id: number) {
    if (!confirm(t.common.deleteConfirm)) return;
    await api.delete(`/api/insurance/${id}`); await load();
  }

  const GapCell = ({ val }: { val: string|null }) => (
    <span className={`font-bold ${Number(val ?? 0) > 0 ? "text-red-500" : "text-emerald-600"}`}>{fmt$(val)}</span>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Insurance Analyses</h2>
        <button onClick={() => setDrafts(d => [...d, emptyIns()])}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Analysis
        </button>
      </div>

      {drafts.map((d, i) => (
        <Card key={i} className="mb-4 p-5 border-blue-200 bg-blue-50/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">New Insurance Analysis {drafts.length > 1 ? `#${i+1}` : ""}</h3>
            <button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-400 hover:text-red-500"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Method</label>
              <InlineSelect value={d.method} onChange={v => updateDraft(i,"method",v)} options={["dime","hlv","needs"]} /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Annual Income ($)</label>
              <InlineInput value={d.annualIncome} onChange={v => updateDraft(i,"annualIncome",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Years to Replace</label>
              <InlineInput value={d.yearsToReplace} onChange={v => updateDraft(i,"yearsToReplace",v)} type="number" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing Life ($)</label>
              <InlineInput value={d.existingLifeCoverage} onChange={v => updateDraft(i,"existingLifeCoverage",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing Disability ($)</label>
              <InlineInput value={d.existingDisability} onChange={v => updateDraft(i,"existingDisability",v)} type="number" /></div>
            <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Existing CI ($)</label>
              <InlineInput value={d.existingCriticalIllness} onChange={v => updateDraft(i,"existingCriticalIllness",v)} type="number" /></div>
          </div>
        </Card>
      ))}

      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 mb-5">
          <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Discard</button>
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
            <Save className="w-3.5 h-3.5" /> {saving ? t.common.savingEllipsis : `Save ${drafts.length} Analysis`}
          </button>
        </div>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No insurance analyses yet.</Card>
      )}
      <div className="space-y-4">
        {rows.map(a => (
          <Card key={a.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full uppercase">{a.method}</span>
              <button onClick={() => del(a.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[[t.netWorth.lifeInsurance,"existingLifeCoverage","recommendedLife","lifeGap"],
                [t.insurance.disability,"existingDisability","recommendedDisability","disabilityGap"],
                [t.insurance.criticalIllness,"existingCriticalIllness","recommendedCriticalIllness","criticalIllnessGap"]].map(([title,ex,rec,gap]) => (
                <div key={title} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-bold text-gray-400 uppercase mb-2">{title}</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span className="text-gray-500">Existing</span><span className="font-medium">{fmt$((a as any)[ex])}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Recommended</span><span className="font-medium">{fmt$((a as any)[rec])}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Gap</span><GapCell val={(a as any)[gap]} /></div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── RESP / EDUCATION ──────────────────────────────────────────────────────────
interface EduPlan { id: number; childName: string; childDob: string|null; currentRespBalance: string|null; annualContribution: string|null; targetAmount: string|null; projectedBalance: string|null; cespGrant: string|null; notes: string|null; }
type EduDraft = { childName: string; childDob: string; currentRespBalance: string; annualContribution: string; targetAmount: string; notes: string; };
const emptyEdu = (): EduDraft => ({ childName:"", childDob:"", currentRespBalance:"", annualContribution:"2500", targetAmount:"", notes:"" });

// Dark-themed education sub-tab used inside the Net Worth hub
function EducationSubTab({ clientId, client, t = translations.en }: { clientId: number; client?: any; t?: T }) {
  const [rows, setRows]     = useState<EduPlan[]>([]);
  const [drafts, setDrafts] = useState<EduDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [netWorth, setNetWorth] = useState<any[]>([]);
  const load = () => api.get<EduPlan[]>(`/api/clients/${clientId}/education`).then(setRows);
  useEffect(() => {
    load();
    api.get<any[]>(`/api/clients/${clientId}/net-worth`).then(setNetWorth);
  }, [clientId]);

  function addDraft() {
    const deps: any[] = Array.isArray(client?.dependants) ? client.dependants : [];
    const respEntries = netWorth.filter(e => e.category === "RESP");
    const totalResp = respEntries.reduce((s: number, e: any) => s + Number(e.value || 0), 0);
    if (deps.length === 0) {
      setDrafts(d => [...d, { ...emptyEdu(), currentRespBalance: String(totalResp || "") }]);
    } else if (deps.length === 1) {
      const dep = deps[0];
      setDrafts(d => [...d, { ...emptyEdu(), childName: dep.name ?? "", childDob: dep.dob ?? "", currentRespBalance: String(totalResp || "") }]);
    } else {
      const perChild = deps.length > 0 ? Math.round(totalResp / deps.length) : 0;
      const newDrafts = deps.map((dep: any) => ({ ...emptyEdu(), childName: dep.name ?? "", childDob: dep.dob ?? "", currentRespBalance: String(perChild || "") }));
      setDrafts(d => [...d, ...newDrafts]);
    }
  }
  const [voiceOpen, setVoiceOpen] = useState(false);
  function addVoiceDraft(parsed: Record<string, string>) {
    setDrafts(d => [...d, {
      ...emptyEdu(),
      childName:          parsed.childName          ?? "",
      childDob:           parsed.childDob           ?? "",
      currentRespBalance: parsed.currentRespBalance ?? "",
      annualContribution: parsed.annualContribution ?? "2500",
      targetAmount:       parsed.targetAmount       ?? "",
      notes:              parsed.notes              ?? "",
    }]);
  }

  function updateDraft(i: number, k: keyof EduDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  async function saveAll() {
    const valid = drafts.filter(d => d.childName);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/education`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm(t.common.deleteConfirm)) return;
    await api.delete(`/api/education/${id}`); await load();
  }

  function handleDob(i: number, raw: string) {
    const digits = raw.replace(/\D/g,"").slice(0,8);
    let f = digits;
    if (digits.length > 4) f = digits.slice(0,4)+"-"+digits.slice(4);
    if (digits.length > 6) f = digits.slice(0,4)+"-"+digits.slice(4,6)+"-"+digits.slice(6);
    updateDraft(i,"childDob",f);
  }

  const totalResp = rows.reduce((s, r) => s + Number(r.currentRespBalance || 0), 0);
  const totalTarget = rows.reduce((s, r) => s + Number(r.targetAmount || 0), 0);

  return (
    <div>
      {/* KPI tiles */}
      <div className="grid grid-cols-2 gap-3 mt-5 mb-5">
        <div className="fp-insightled-card p-4">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">{t.netWorth.eduTotalRESP}</p>
          <p className="text-2xl font-bold text-[var(--accent-cyan)] font-mono">{fmt$(totalResp)}</p>
        </div>
        <div className="fp-insightled-card p-4">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">{t.netWorth.eduTotalTarget}</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] font-mono">{totalTarget ? fmt$(totalTarget) : "—"}</p>
        </div>
      </div>

      {/* Table header */}
      <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">{t.netWorth.educationPlansTitle}</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOpen(true)}
              title={t.netWorth.voiceAddChild}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)] text-xs font-semibold transition-colors"
            >
              <Mic className="w-3.5 h-3.5" /> {t.netWorth.voice}
            </button>
            <button
              onClick={addDraft}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[var(--accent-cyan)] to-[var(--accent-blue)] text-[var(--bg-base)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Add Child
            </button>
          </div>
        </div>

        {voiceOpen && (
          <VoiceAddDialog
            title={t.common.voiceAddEduc}
            moduleId="education-plan"
            prompt={`Try: "Sarah, born June 12 2015, RESP balance 12 thousand, contributing twenty-five hundred a year, target sixty thousand"`}
            fieldSchema={[
              { key: "childName",          label: t.netWorth.childName, description: "Full first name" },
              { key: "childDob",           label: "DOB",        description: "Date of birth (YYYY-MM-DD)" },
              { key: "currentRespBalance", label: t.netWorth.respBalance, description: "Current RESP balance, number only" },
              { key: "annualContribution", label: t.netWorth.annualContribNum, description: "Annual contribution, number only" },
              { key: "targetAmount",       label: "Target", description: "Target amount, number only" },
              { key: "notes",              label: "Notes", description: "Free-form notes" },
            ]}
            onConfirm={(fields) => { addVoiceDraft(fields); setVoiceOpen(false); }}
            onClose={() => setVoiceOpen(false)}
          />
        )}

        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-card)]/60 border-b border-[var(--border-subtle)]">
            <tr>
              {[t.netWorth.eduChild, t.netWorth.eduDOB, t.netWorth.eduRESPBalance, t.netWorth.eduAnnualContrib, t.netWorth.eduTarget, "CESG", t.netWorth.eduProjected, t.common.notes, ""].map(h => (
                <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-3 py-2.5 font-medium text-[var(--text-primary)]">{r.childName}</td>
                <td className="px-3 py-2.5 text-[var(--text-secondary)] font-mono text-xs">{r.childDob ?? "—"}</td>
                <td className="px-3 py-2.5 font-semibold font-mono text-[var(--accent-cyan)]">{fmt$(r.currentRespBalance)}</td>
                <td className="px-3 py-2.5 font-mono text-[var(--text-secondary)]">{fmt$(r.annualContribution)}</td>
                <td className="px-3 py-2.5 font-mono text-[var(--text-secondary)]">{r.targetAmount ? fmt$(r.targetAmount) : "—"}</td>
                <td className="px-3 py-2.5 font-mono text-[var(--accent-green)]">{r.cespGrant ? fmt$(r.cespGrant) : "—"}</td>
                <td className="px-3 py-2.5 font-mono text-[var(--text-secondary)]">{r.projectedBalance ? fmt$(r.projectedBalance) : "—"}</td>
                <td className="px-3 py-2.5 text-[var(--text-tertiary)] text-xs">{r.notes ?? ""}</td>
                <td className="px-3 py-2.5">
                  <button onClick={() => del(r.id)} className="text-[var(--text-tertiary)]/30 hover:text-[var(--accent-rose)] transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}

            {/* Draft rows */}
            {drafts.map((d, i) => (
              <tr key={`draft-${i}`} className="bg-[var(--accent-cyan)]/[0.03] border-b border-[var(--accent-cyan)]/10">
                <td className="px-3 py-2">
                  <input value={d.childName} onChange={e => updateDraft(i,"childName",e.target.value)} placeholder="Child name"
                    className="w-full bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2">
                  <input value={d.childDob} onChange={e => handleDob(i,e.target.value)} placeholder="YYYY-MM-DD" maxLength={10}
                    className="w-28 bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2">
                  <input value={d.currentRespBalance} onChange={e => updateDraft(i,"currentRespBalance",e.target.value)} type="number" placeholder="0"
                    className="w-28 bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2">
                  <input value={d.annualContribution} onChange={e => updateDraft(i,"annualContribution",e.target.value)} type="number" placeholder="2500"
                    className="w-24 bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2">
                  <input value={d.targetAmount} onChange={e => updateDraft(i,"targetAmount",e.target.value)} type="number" placeholder="0"
                    className="w-24 bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">auto</td>
                <td className="px-3 py-2 text-[var(--text-tertiary)] text-xs">—</td>
                <td className="px-3 py-2">
                  <input value={d.notes} onChange={e => updateDraft(i,"notes",e.target.value)} placeholder="Notes"
                    className="w-28 bg-[var(--bg-base)] border border-[var(--border-light)] rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-cyan)]" />
                </td>
                <td className="px-3 py-2">
                  <button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-[var(--text-tertiary)]/50 hover:text-[var(--accent-rose)] transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && drafts.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[var(--text-tertiary)] text-sm">
                  {t.netWorth.noEducationPlans}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Save / discard */}
      {drafts.length > 0 && (
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={() => setDrafts([])} className="text-sm text-[var(--text-tertiary)] px-4 py-2 border border-[var(--border-light)] rounded-lg hover:bg-white/5 transition-colors">
            Discard All
          </button>
          <button onClick={saveAll} disabled={saving || !drafts.some(d => d.childName)}
            className="flex items-center gap-1.5 bg-[var(--accent-cyan)] text-[var(--bg-base)] text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 hover:bg-[var(--accent-cyan)]/90 transition-colors">
            <Save className="w-3.5 h-3.5" /> {saving ? t.common.savingEllipsis : `Save ${drafts.filter(d=>d.childName).length} Child${drafts.filter(d=>d.childName).length !== 1 ? "ren" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use EducationSubTab (rendered inside NetWorthTab) instead. Kept for API compatibility. */
export function RespTab({ clientId, client, t = translations.en }: { clientId: number; client?: any; t?: T }) {
  return <EducationSubTab clientId={clientId} client={client} t={t} />;
}

// ── DEBT ──────────────────────────────────────────────────────────────────────
interface DebtEntry { id: number; name: string; type: string; category?: string; balance: string; interestRate: string|null; minimumPayment: string|null; payoffStrategy: string|null; notes: string|null; }
type DebtDraft = { name: string; type: string; balance: string; interestRate: string; minimumPayment: string; payoffStrategy: string; notes: string; };
const emptyDebt = (): DebtDraft => ({ name:"", type:"credit_card", balance:"", interestRate:"", minimumPayment:"", payoffStrategy:"avalanche", notes:"" });

export function DebtTab({ clientId, t }: { clientId: number; t: T }) {
  const [rows, setRows]     = useState<DebtEntry[]>([]);
  const [drafts, setDrafts] = useState<DebtDraft[]>([]);
  const [saving, setSaving] = useState(false);

  const load = () => api.get<DebtEntry[]>(`/api/clients/${clientId}/liabilities`).then(setRows);
  useEffect(() => { load(); }, [clientId]);

  const totalDebt = rows.reduce((s, d) => s + Number(d.balance), 0);
  function updateDraft(i: number, k: keyof DebtDraft, v: string) { setDrafts(d => d.map((x, idx) => idx === i ? { ...x, [k]: v } : x)); }

  async function saveAll() {
    const valid = drafts.filter(d => d.name && d.balance);
    if (!valid.length) return;
    setSaving(true);
    try {
      await Promise.all(valid.map(d => api.post(`/api/clients/${clientId}/debt`, d)));
      setDrafts([]);
      await load();
    } finally { setSaving(false); }
  }

  async function del(id: number) {
    if (!confirm(t.common.deleteConfirm)) return;
    await api.delete(`/api/debt/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t.debt.debtCashFlow}</h2>
          {rows.length > 0 && <p className="text-sm font-bold text-red-500">Total: {fmt$(totalDebt)}</p>}
        </div>
        <button onClick={() => setDrafts(d => [...d, emptyDebt()])}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> {t.debt.addDebt}
        </button>
      </div>
     <DebtDashboard rows={rows} />
      {/* Draft debt rows */}
      {drafts.length > 0 && (
        <Card className="mb-5 border-blue-200 bg-blue-50/20">
          <div className="p-3 border-b border-blue-100">
            <h3 className="font-bold text-gray-800 text-sm">{t.debt.newDebtsHint}</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr><TH>{t.debt.colName}</TH><TH>{t.debt.colType}</TH><TH>{t.debt.colBalance}</TH><TH>{t.debt.colRate}</TH><TH>{t.debt.colMinPayment}</TH><TH>{t.debt.colStrategy}</TH><TH></TH></tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {drafts.map((d, i) => (
                <tr key={i}>
                  <TD><InlineInput value={d.name} onChange={v => updateDraft(i,"name",v)} placeholder="e.g. TD Visa" /></TD>
                  <TD><InlineSelect value={d.type} onChange={v => updateDraft(i,"type",v)} options={DEBT_TYPES} labelMap={Object.fromEntries(DEBT_TYPES.map(dt => [dt, debtTypeLabel(dt, t)]))} /></TD>
                  <TD><InlineInput value={d.balance} onChange={v => updateDraft(i,"balance",v)} type="number" /></TD>
                  <TD><InlineInput value={d.interestRate} onChange={v => updateDraft(i,"interestRate",v)} type="number" /></TD>
                  <TD><InlineInput value={d.minimumPayment} onChange={v => updateDraft(i,"minimumPayment",v)} type="number" /></TD>
                  <TD><InlineSelect value={d.payoffStrategy} onChange={v => updateDraft(i,"payoffStrategy",v)} options={["avalanche","snowball"]} labelMap={{ avalanche: t.debt.stratAvalanche, snowball: t.debt.stratSnowball }} /></TD>
                  <TD><button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></TD>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 p-3">
            <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">{t.debt.discard}</button>
            <button onClick={saveAll} disabled={saving || !drafts.some(d => d.name && d.balance)}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? t.common.saving : `${t.debt.saveDebts} ${drafts.filter(d=>d.name&&d.balance).length}`}
            </button>
          </div>
        </Card>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">{t.debt.noDebtsYet}</Card>
      )}
      {rows.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr><TH>{t.debt.colName}</TH><TH>{t.debt.colType}</TH><TH>{t.common.balance}</TH><TH>{t.common.rate}</TH><TH>{t.debt.colMinPayment}</TH><TH>{t.debt.colStrategy}</TH><TH></TH></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(d => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <TD><span className="font-medium text-gray-800">{d.name}</span></TD>
                  <TD><span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{(d.type ?? d.category ?? "").replace("_"," ")}</span></TD>
                  <TD right><span className="font-bold text-red-500">{fmt$(d.balance)}</span></TD>
                  <TD right>{fmtPct(d.interestRate)}</TD>
                  <TD right>{fmt$(d.minimumPayment)}</TD>
                  <TD><span className={`text-xs px-2 py-0.5 rounded-full ${d.payoffStrategy === "avalanche" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>{d.payoffStrategy}</span></TD>
                  <TD><button onClick={() => del(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></TD>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-300 bg-gray-50">
                <td colSpan={2} className="px-3 py-3 font-bold text-gray-900 text-sm">Total</td>
                <td className="px-3 py-3 text-right font-bold text-red-500 text-sm">{fmt$(totalDebt)}</td>
                <td colSpan={4}></td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}



















