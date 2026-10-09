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
function InlineSelect({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-white">
      {options.map(o => <option key={o}>{o}</option>)}
    </select>
  );
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
// Note: Pension lives in the Retirement Hub (Pension sub-tab); RESP lives in the
// Net Worth → Education sub-tab. They are intentionally absent from the Assets list.
const NW_ASSET_CATS = ["Principal Residence","Real Estate (other)","RRSP","TFSA","Non-Registered","Cash / Bank","Business","Employer Stock Options","Other Asset"];
const NW_ASSET_COLORS: Record<string, string> = {
  "Principal Residence":     "#22d3ee",
  "Real Estate (other)":     "#60a5fa",
  "RRSP":                    "#34d399",
  "TFSA":                    "#fbbf24",
  "Non-Registered":          "#c084fc",
  "Cash / Bank":             "#06b6d4",
  "Business":                "#a78bfa",
  "Employer Stock Options":  "#fb923c",
  "Other Asset":             "#f43f5e",
};
const NW_LIAB_CATS = ["Mortgage","HELOC","Car Loan","Credit Card","Student Loan","Line of Credit","Property Taxes Owing","Personal Taxes Owing","Other Liability"];
const DEBT_TYPES    = ["mortgage","heloc","car_loan","credit_card","student_loan","line_of_credit","other"];
const PENSION_TYPES = ["DBPP","DCPP","Self-Directed","Matching Contributions"];
const HOLDING_TYPES = ["Mutual Funds","Stock","GIC","Annuity"];

// ── Canadian Mutual Funds — curated list by fund family ───────────────────────
// Phase 2: add fundCode to each entry and auto-fetch NAV from Fund Library API
export interface MutualFundOption {
  family: string;
  name: string;
  code: string; // reserved for Phase 2 NAV auto-fetch
}
export const CANADIAN_MUTUAL_FUNDS: MutualFundOption[] = [
  // RBC
  { family: "RBC", name: "RBC Canadian Equity Fund", code: "RBF460" },
  { family: "RBC", name: "RBC U.S. Equity Fund", code: "RBF462" },
  { family: "RBC", name: "RBC Global Equity Fund", code: "RBF463" },
  { family: "RBC", name: "RBC Balanced Fund", code: "RBF459" },
  { family: "RBC", name: "RBC Bond Fund", code: "RBF458" },
  { family: "RBC", name: "RBC Money Market Fund", code: "RBF556" },
  { family: "RBC", name: "RBC Canadian Dividend Fund", code: "RBF267" },
  { family: "RBC", name: "RBC North American Growth Fund", code: "RBF557" },
  { family: "RBC", name: "RBC Emerging Markets Equity Fund", code: "RBF477" },
  { family: "RBC", name: "RBC Conservative Growth & Income Fund", code: "RBF264" },
  { family: "RBC", name: "RBC Balanced Growth & Income Fund", code: "RBF265" },
  { family: "RBC", name: "RBC Select Balanced Portfolio", code: "RBF285" },
  { family: "RBC", name: "RBC Select Conservative Portfolio", code: "RBF284" },
  { family: "RBC", name: "RBC Select Growth Portfolio", code: "RBF286" },
  // TD
  { family: "TD", name: "TD Canadian Bond Fund", code: "TDB900" },
  { family: "TD", name: "TD Canadian Equity Fund", code: "TDB902" },
  { family: "TD", name: "TD Balanced Growth Fund", code: "TDB622" },
  { family: "TD", name: "TD Dividend Growth Fund", code: "TDB183" },
  { family: "TD", name: "TD U.S. Blue Chip Equity Fund", code: "TDB904" },
  { family: "TD", name: "TD Global Multi-Asset Fund", code: "TDB963" },
  { family: "TD", name: "TD Money Market Fund", code: "TDB8150" },
  { family: "TD", name: "TD Comfort Balanced Growth Portfolio", code: "TDB972" },
  { family: "TD", name: "TD Comfort Conservative Income Portfolio", code: "TDB971" },
  { family: "TD", name: "TD Comfort Aggressive Growth Portfolio", code: "TDB974" },
  { family: "TD", name: "TD Emerging Markets Fund", code: "TDB909" },
  { family: "TD", name: "TD International Growth Fund", code: "TDB906" },
  { family: "TD", name: "TD Managed Income Portfolio", code: "TDB968" },
  { family: "TD", name: "TD Managed Balanced Growth Portfolio", code: "TDB969" },
  // Fidelity
  { family: "Fidelity", name: "Fidelity Canadian Growth Company Fund", code: "FID200" },
  { family: "Fidelity", name: "Fidelity True North Fund", code: "FID227" },
  { family: "Fidelity", name: "Fidelity Canadian Bond Fund", code: "FID220" },
  { family: "Fidelity", name: "Fidelity Balanced Fund", code: "FID214" },
  { family: "Fidelity", name: "Fidelity Global Fund", code: "FID206" },
  { family: "Fidelity", name: "Fidelity U.S. Focused Stock Fund", code: "FID233" },
  { family: "Fidelity", name: "Fidelity Monthly Income Fund", code: "FID519" },
  { family: "Fidelity", name: "Fidelity NorthStar Fund", code: "FID229" },
  { family: "Fidelity", name: "Fidelity AsiaStar Fund", code: "FID218" },
  { family: "Fidelity", name: "Fidelity Emerging Markets Fund", code: "FID209" },
  { family: "Fidelity", name: "Fidelity Conservative Income Fund", code: "FID528" },
  { family: "Fidelity", name: "Fidelity Dividend Fund", code: "FID231" },
  // Mackenzie
  { family: "Mackenzie", name: "Mackenzie Canadian All Cap Balanced Fund", code: "MFC1744" },
  { family: "Mackenzie", name: "Mackenzie Income Fund", code: "MFC162" },
  { family: "Mackenzie", name: "Mackenzie Canadian Growth Fund", code: "MFC1580" },
  { family: "Mackenzie", name: "Mackenzie Global Dividend Fund", code: "MFC5552" },
  { family: "Mackenzie", name: "Mackenzie Ivy Canadian Fund", code: "MFC822" },
  { family: "Mackenzie", name: "Mackenzie Ivy Foreign Equity Fund", code: "MFC823" },
  { family: "Mackenzie", name: "Mackenzie Balanced Fund", code: "MFC1573" },
  { family: "Mackenzie", name: "Mackenzie U.S. Mid Cap Growth Fund", code: "MFC1597" },
  { family: "Mackenzie", name: "Mackenzie Emerging Markets Fund", code: "MFC5533" },
  { family: "Mackenzie", name: "Mackenzie Strategic Income Fund", code: "MFC1577" },
  { family: "Mackenzie", name: "Mackenzie Canadian Bond Fund", code: "MFC161" },
  { family: "Mackenzie", name: "Mackenzie Maximum Diversification Developed Markets Index ETF Fund", code: "MFC8765" },
  // CI Financial
  { family: "CI", name: "CI Canadian Investment Fund", code: "CIG11100" },
  { family: "CI", name: "CI American Fund", code: "CIG11200" },
  { family: "CI", name: "CI International Fund", code: "CIG11300" },
  { family: "CI", name: "CI Balanced Fund", code: "CIG11108" },
  { family: "CI", name: "CI Income Fund", code: "CIG11120" },
  { family: "CI", name: "CI Global Fund", code: "CIG11360" },
  { family: "CI", name: "CI Short-Term Government Bond Fund", code: "CIG11130" },
  { family: "CI", name: "CI Cambridge Canadian Equity Fund", code: "CIG3340" },
  { family: "CI", name: "CI Cambridge Global Equity Fund", code: "CIG3345" },
  { family: "CI", name: "CI Cambridge Income Fund", code: "CIG3336" },
  { family: "CI", name: "CI Signature Diversified Yield Fund", code: "CIG50007" },
  { family: "CI", name: "CI Signature Select Canadian Fund", code: "CIG50004" },
  // Dynamic
  { family: "Dynamic", name: "Dynamic Canadian Balanced Fund", code: "DYN006" },
  { family: "Dynamic", name: "Dynamic Equity Income Fund", code: "DYN027" },
  { family: "Dynamic", name: "Dynamic Global Discovery Fund", code: "DYN210" },
  { family: "Dynamic", name: "Dynamic Global Dividend Fund", code: "DYN211" },
  { family: "Dynamic", name: "Dynamic U.S. Equity Fund", code: "DYN076" },
  { family: "Dynamic", name: "Dynamic Canadian Bond Fund", code: "DYN010" },
  { family: "Dynamic", name: "Dynamic Small Business Fund", code: "DYN029" },
  { family: "Dynamic", name: "Dynamic Power American Growth Fund", code: "DYN049" },
  { family: "Dynamic", name: "Dynamic Strategic Yield Fund", code: "DYN1059" },
  // Manulife / Manulife Investment Management
  { family: "Manulife", name: "Manulife Canadian Equity Fund", code: "MMF1570" },
  { family: "Manulife", name: "Manulife Balanced Fund", code: "MMF1578" },
  { family: "Manulife", name: "Manulife Bond Fund", code: "MMF1560" },
  { family: "Manulife", name: "Manulife Dividend Income Fund", code: "MMF1566" },
  { family: "Manulife", name: "Manulife Global Equity Fund", code: "MMF1576" },
  { family: "Manulife", name: "Manulife U.S. Equity Fund", code: "MMF1577" },
  { family: "Manulife", name: "Manulife Monthly Income Fund", code: "MMF5530" },
  { family: "Manulife", name: "Manulife Global Multi-Asset Class Fund", code: "MMF5575" },
  { family: "Manulife", name: "Manulife Strategic Income Fund", code: "MMF5594" },
  // IG / Investors Group
  { family: "IG Wealth", name: "IG Mackenzie Canadian Bond Fund", code: "IGI615" },
  { family: "IG Wealth", name: "IG Mackenzie Global Equity Fund", code: "IGI682" },
  { family: "IG Wealth", name: "IG Mackenzie Canadian Equity Fund", code: "IGI680" },
  { family: "IG Wealth", name: "IG Mackenzie Balanced Fund", code: "IGI633" },
  { family: "IG Wealth", name: "IG Mackenzie U.S. Equity Fund", code: "IGI681" },
  { family: "IG Wealth", name: "IG Mackenzie Income Portfolio", code: "IGI655" },
  { family: "IG Wealth", name: "IG Mackenzie Conservative Portfolio", code: "IGI656" },
  { family: "IG Wealth", name: "IG Mackenzie Balanced Portfolio", code: "IGI657" },
  { family: "IG Wealth", name: "IG Mackenzie Growth Portfolio", code: "IGI658" },
  // BMO
  { family: "BMO", name: "BMO Canadian Balanced Fund", code: "BMO20302" },
  { family: "BMO", name: "BMO Canadian Equity Fund", code: "BMO20301" },
  { family: "BMO", name: "BMO U.S. Equity Fund", code: "BMO20303" },
  { family: "BMO", name: "BMO Bond Fund", code: "BMO20306" },
  { family: "BMO", name: "BMO Dividend Fund", code: "BMO20307" },
  { family: "BMO", name: "BMO Global Equity Fund", code: "BMO20325" },
  { family: "BMO", name: "BMO Income ETF Portfolio", code: "BMO50001" },
  { family: "BMO", name: "BMO Conservative ETF Portfolio", code: "BMO50002" },
  { family: "BMO", name: "BMO Balanced ETF Portfolio", code: "BMO50003" },
  { family: "BMO", name: "BMO Growth ETF Portfolio", code: "BMO50004" },
  { family: "BMO", name: "BMO Aggressive Growth ETF Portfolio", code: "BMO50005" },
  // CIBC / Renaissance
  { family: "CIBC", name: "CIBC Canadian Bond Fund", code: "CIB506" },
  { family: "CIBC", name: "CIBC Canadian Equity Fund", code: "CIB504" },
  { family: "CIBC", name: "CIBC Balanced Fund", code: "CIB503" },
  { family: "CIBC", name: "CIBC U.S. Equity Fund", code: "CIB505" },
  { family: "CIBC", name: "CIBC Global Equity Fund", code: "CIB534" },
  { family: "CIBC", name: "CIBC Dividend Growth Fund", code: "CIB512" },
  { family: "CIBC", name: "CIBC Monthly Income Fund", code: "CIB559" },
  { family: "CIBC", name: "Renaissance Canadian Bond Fund", code: "ATL202" },
  { family: "CIBC", name: "Renaissance Balanced Growth Fund", code: "ATL227" },
  { family: "CIBC", name: "Renaissance Canadian Equity Fund", code: "ATL203" },
  // Desjardins
  { family: "Desjardins", name: "Desjardins Canadian Bond Fund", code: "DES303" },
  { family: "Desjardins", name: "Desjardins Canadian Equity Fund", code: "DES301" },
  { family: "Desjardins", name: "Desjardins Balanced Fund", code: "DES302" },
  { family: "Desjardins", name: "Desjardins U.S. Equity Fund", code: "DES304" },
  { family: "Desjardins", name: "Desjardins Global Equity Fund", code: "DES305" },
  { family: "Desjardins", name: "Desjardins Dividend Growth Fund", code: "DES310" },
  // Sunlife / Sun Life Global Investments
  { family: "Sun Life", name: "Sun Life MFS Canadian Equity Fund", code: "SLA301" },
  { family: "Sun Life", name: "Sun Life MFS U.S. Growth Fund", code: "SLA302" },
  { family: "Sun Life", name: "Sun Life MFS Global Growth Fund", code: "SLA303" },
  { family: "Sun Life", name: "Sun Life Granite Conservative Portfolio", code: "SLA401" },
  { family: "Sun Life", name: "Sun Life Granite Moderate Portfolio", code: "SLA402" },
  { family: "Sun Life", name: "Sun Life Granite Balanced Portfolio", code: "SLA403" },
  { family: "Sun Life", name: "Sun Life Granite Growth Portfolio", code: "SLA404" },
  { family: "Sun Life", name: "Sun Life Granite Maximum Growth Portfolio", code: "SLA405" },
  // Ninepoint
  { family: "Ninepoint", name: "Ninepoint Canadian Equity Fund", code: "NIN001" },
  { family: "Ninepoint", name: "Ninepoint Energy Fund", code: "NIN002" },
  { family: "Ninepoint", name: "Ninepoint Alternative Health Fund", code: "NIN003" },
  { family: "Ninepoint", name: "Ninepoint High Income Equity Fund", code: "NIN004" },
  // Empire Life
  { family: "Empire Life", name: "Empire Life Equity Fund", code: "EMP101" },
  { family: "Empire Life", name: "Empire Life Balanced Fund", code: "EMP102" },
  { family: "Empire Life", name: "Empire Life Fixed Income Fund", code: "EMP103" },
  { family: "Empire Life", name: "Empire Life Monthly Income Fund", code: "EMP104" },
  // Industrial Alliance
  { family: "iA Financial", name: "iA Canadian Equity Fund", code: "IAF201" },
  { family: "iA Financial", name: "iA Balanced Fund", code: "IAF202" },
  { family: "iA Financial", name: "iA Bond Fund", code: "IAF203" },
  { family: "iA Financial", name: "iA U.S. Equity Fund", code: "IAF204" },
  { family: "iA Financial", name: "iA Global Equity Fund", code: "IAF205" },
  { family: "iA Financial", name: "iA Dividend Fund", code: "IAF206" },
  // National Bank
  { family: "National Bank", name: "National Bank Canadian Bond Fund", code: "NBF101" },
  { family: "National Bank", name: "National Bank Balanced Fund", code: "NBF102" },
  { family: "National Bank", name: "National Bank Canadian Equity Fund", code: "NBF103" },
  { family: "National Bank", name: "National Bank U.S. Equity Fund", code: "NBF104" },
  { family: "National Bank", name: "National Bank Global Equity Fund", code: "NBF105" },
  { family: "National Bank", name: "National Bank Dividend Fund", code: "NBF106" },
  // Invesco
  { family: "Invesco", name: "Invesco Canadian Premier Growth Fund", code: "AIM101" },
  { family: "Invesco", name: "Invesco Balanced Risk Allocation Fund", code: "AIM102" },
  { family: "Invesco", name: "Invesco Canadian Core Plus Bond Fund", code: "AIM103" },
  { family: "Invesco", name: "Invesco Global Companies Fund", code: "AIM104" },
  // Horizons ETF managed funds
  { family: "Horizons", name: "Horizons Active Canadian Bond ETF Fund", code: "HOR001" },
  { family: "Horizons", name: "Horizons Active Floating Rate Bond ETF Fund", code: "HOR002" },
  { family: "Horizons", name: "Horizons Active Global Dividend Fund", code: "HOR003" },
];

// Get sorted unique fund families
export const FUND_FAMILIES = [...new Set(CANADIAN_MUTUAL_FUNDS.map(f => f.family))].sort();

// ── Fund holding line item ────────────────────────────────────────────────────
export interface FundHolding {
  name: string;
  code: string;   // reserved for Phase 2 NAV auto-fetch
  value: string;  // market value in $
}

// ── FundSearchInput — single searchable combobox row ─────────────────────────
function FundSearchInput({
  onSelect,
  alreadySelected,
}: {
  onSelect: (f: MutualFundOption) => void;
  alreadySelected: string[]; // codes already picked
}) {
  const [query, setQuery]   = useState("");
  const [open, setOpen]     = useState(false);
  const [family, setFamily] = useState("");

  const filtered = CANADIAN_MUTUAL_FUNDS.filter(f => {
    if (alreadySelected.includes(f.code)) return false;
    if (family && f.family !== family) return false;
    if (!query) return true;
    return f.name.toLowerCase().includes(query.toLowerCase()) || f.family.toLowerCase().includes(query.toLowerCase());
  }).slice(0, 40);

  function pick(f: MutualFundOption) {
    setQuery("");
    setOpen(false);
    onSelect(f);
  }

  return (
    <div className="relative">
      <div className="flex gap-1.5 mb-1">
        <select
          value={family}
          onChange={e => { setFamily(e.target.value); setOpen(true); }}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 flex-shrink-0"
        >
          <option value="">All families</option>
          {FUND_FAMILIES.map(f => <option key={f}>{f}</option>)}
        </select>
        {family && (
          <button type="button" onClick={() => { setFamily(""); }} className="text-slate-400 hover:text-slate-600 text-xs px-1">✕</button>
        )}
      </div>
      <input
        type="text"
        value={query}
        placeholder="Search and add a fund…"
        onChange={e => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="border border-dashed border-cyan-300 rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 bg-cyan-50/40 placeholder-slate-400"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
          {filtered.map(f => (
            <button
              key={f.code}
              type="button"
              onMouseDown={() => pick(f)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="text-sm text-slate-800">{f.name}</span>
              <span className="ml-2 text-[10px] text-slate-400 font-mono">{f.family}</span>
            </button>
          ))}
        </div>
      )}
      {open && query.length > 1 && filtered.length === 0 && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm text-slate-400">
          No matching funds found.
        </div>
      )}
    </div>
  );
}

// ── MultiFundSelector — multi-fund list with per-fund value fields ─────────────
// holdings: array of { name, code, value }
// onChange: called with updated array; parent rolls up total value
function MultiFundSelector({
  holdings,
  onChange,
}: {
  holdings: FundHolding[];
  onChange: (holdings: FundHolding[]) => void;
}) {
  function addFund(f: MutualFundOption) {
    onChange([...holdings, { name: f.name, code: f.code, value: "" }]);
  }
  function removeFund(idx: number) {
    onChange(holdings.filter((_, i) => i !== idx));
  }
  function updateValue(idx: number, value: string) {
    onChange(holdings.map((h, i) => i === idx ? { ...h, value } : h));
  }
  const total = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
  const alreadySelected = holdings.map(h => h.code);

  return (
    <div className="col-span-4 mt-1 space-y-2 border border-cyan-100 rounded-xl p-3 bg-cyan-50/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-cyan-700">Mutual Fund Holdings</span>
        {holdings.length > 0 && (
          <span className="text-xs text-slate-500 font-mono">Total: <span className="font-semibold text-slate-700">${total.toLocaleString()}</span></span>
        )}
      </div>
      {/* Selected fund rows */}
      {holdings.map((h, idx) => (
        <div key={`${h.code}-${idx}`} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-gray-100 shadow-sm">
          <span className="text-xs text-slate-700 flex-1 min-w-0 truncate" title={h.name}>{h.name}</span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:block flex-shrink-0">{h.code}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs text-slate-400">$</span>
            <input
              type="number"
              value={h.value}
              onChange={e => updateValue(idx, e.target.value)}
              placeholder="0"
              className="border border-gray-200 rounded-md px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={() => removeFund(idx)}
            className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0 ml-1"
            title="Remove fund"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      {/* Search to add more */}
      <FundSearchInput onSelect={addFund} alreadySelected={alreadySelected} />
      {holdings.length === 0 && (
        <p className="text-[11px] text-slate-400 text-center py-1">Search above to add one or more funds.</p>
      )}
    </div>
  );
}
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
  funds: FundHolding[];  // multi-fund holdings when holdingType === "Mutual Funds"
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

function emptyDraft(type: "asset"|"liability"): NWDraft {
  return {
    type, category: type === "asset" ? "Principal Residence" : "Mortgage",
    name: "", owner: "primary", value: "", notes: "",
    isSpousal: false, rrspContributor: "",
    pensionType: "DBPP", matchPct: "",
    monthlyPayment: "",
    respBeneficiary: "",
    holdingType: "",
    funds: [],
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

function ExtraFields({ draft, onChange, spouseName, dependants }: { draft: NWDraft; onChange: (k: keyof NWDraft, v: any) => void; spouseName: string; dependants?: any[] }) {
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
            <span className="text-xs text-[var(--text-tertiary)]">Contributor:</span>
            <select value={draft.rrspContributor} onChange={e => onChange("rrspContributor", e.target.value)} className={SELECT_CLS}>
              <option value="">Select contributor</option>
              <option value="client">Client</option>
              <option value="spouse">Spouse</option>
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
          {HOLDING_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>
    );
  }

  if (draft.category === "Non-Registered" && spouseName) {
    elems.push(
      <label key="joint" className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] cursor-pointer">
        <input type="checkbox" checked={draft.jointWithSpouse} onChange={e => onChange("jointWithSpouse", e.target.checked)} className="w-3.5 h-3.5 rounded accent-[var(--accent-cyan)]" />
        Jointly held with spouse
        <span className="text-[10px] text-[var(--text-tertiary)]">(sets owner to Joint)</span>
      </label>
    );
  }

  if (draft.category === "Employer Stock Options") {
    elems.push(
      <div key="stockopt" className="flex items-center gap-1.5">
        <span className="text-xs text-[var(--text-tertiary)]">Sub-type:</span>
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
          <span className="text-xs text-[var(--text-tertiary)]">Mortgage balance ($):</span>
          <InlineInput value={draft.mortgageBalance} onChange={v => onChange("mortgageBalance", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Monthly payment ($):</span>
          <InlineInput value={draft.mortgageMonthlyPayment} onChange={v => onChange("mortgageMonthlyPayment", v)} type="number" placeholder="0" className="w-28" />
        </div>
        {Number(draft.mortgageBalance) > 0 && (
          <span className="text-[10px] text-[var(--accent-cyan)] italic">{ct("netWorth.linkedMortgage")}</span>
        )}
      </div>
    );
  }

  if (draft.category === "Real Estate (other)") {
    elems.push(
      <div key="realestate-other" className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Property type:</span>
          <select value={draft.propertyType} onChange={e => onChange("propertyType", e.target.value)} className={SELECT_CLS}>
            {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Purchase price ($):</span>
          <InlineInput value={draft.purchasePrice} onChange={v => onChange("purchasePrice", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Mortgage balance ($):</span>
          <InlineInput value={draft.mortgageBalance} onChange={v => onChange("mortgageBalance", v)} type="number" placeholder="0" className="w-28" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-[var(--text-tertiary)]">Monthly payment ($):</span>
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
          <span className="text-[10px] text-[var(--accent-cyan)] italic">{ct("netWorth.linkedMortgage")}</span>
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
          <button onClick={onEdit} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
            <Pencil className="w-3.5 h-3.5 text-blue-400" />
          </button>
          <button onClick={onDelete} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── normalizeCat — remap legacy category names ────────────────────────────────
function normalizeCat(e: NWEntry): NWEntry {
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
export function NetWorthTab({ clientId, client }: { clientId: number; client?: { firstName: string; lastName: string; spouseFirstName?: string | null; spouseLastName?: string | null } }) {
  const { ct } = useClientLocale();
  const [entries, setEntries] = useState<NWEntry[]>([]);
  const [drafts, setDrafts]   = useState<NWDraft[]>([]);
  const [saving, setSaving]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const { sub: nwTab } = useContext(NWSubtabCtx);
  const [editForm, setEditForm] = useState<NWEditForm>({});
  const [voiceOpen, setVoiceOpen] = useState<null | "asset" | "liability">(null);

  const spouseName  = client?.spouseFirstName ? `${client.spouseFirstName} ${client.spouseLastName ?? ""}`.trim() : "";
  const primaryName = client ? `${client.firstName} ${client.lastName}` : "Primary";

  const load = () => api.get<NWEntry[]>(`/api/clients/${clientId}/net-worth`).then(raw => setEntries(raw.map(normalizeCat)));
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
      holdingType: m.holdingType ?? "",
      funds: m.funds ?? [],
      jointWithSpouse: e.owner === "joint",
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
    if (["RRSP", "TFSA", "Non-Registered"].includes(cat) && form.holdingType) {
      m.holdingType = form.holdingType;
      if (form.holdingType === "Mutual Funds") {
        const funds: FundHolding[] = (form as any).funds ?? [];
        if (funds.length > 0) m.funds = funds;
      }
    }
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
    const editFunds: FundHolding[] = (editForm as any).funds ?? [];
    const isEditMutualFunds = editForm.holdingType === "Mutual Funds" && editFunds.length > 0;
    const editRolledValue = isEditMutualFunds
      ? String(editFunds.reduce((s, h) => s + (Number(h.value) || 0), 0))
      : editForm.value;
    if (!editingId || !editRolledValue) return;
    setSaving(true);
    try {
      const m = buildMeta(editForm);
      let owner = editForm.owner ?? "primary";
      if (editForm.jointWithSpouse && editForm.category === "Non-Registered") owner = "joint";
      const editDisplayName = isEditMutualFunds
        ? (editFunds.length === 1 ? editFunds[0].name : `${editFunds.length} Mutual Funds — ${editForm.category}`)
        : (editForm.name || editForm.category);
      await api.put(`/api/net-worth/${editingId}`, {
        category: editForm.category, name: editDisplayName,
        owner, value: editRolledValue, notes: editForm.notes || null,
        metadata: Object.keys(m).length ? m : null,
      });
      setEditingId(null); setEditForm({});
      await load();
    } finally { setSaving(false); }
  }

  function isDraftSavable(d: NWDraft) {
    const isProperty = d.category === "Principal Residence" || d.category === "Real Estate (other)";
    if (isProperty) return Number(d.value || 0) > 0 || Number(d.purchasePrice || 0) > 0 || Number(d.mortgageBalance || 0) > 0;
    if (d.holdingType === "Mutual Funds") return d.funds.length > 0 && d.funds.some(h => Number(h.value) > 0);
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
        // For mutual funds, build a display name from the fund list
        const isMutualFunds = d.holdingType === "Mutual Funds" && d.funds.length > 0;
        const fundDisplayName = isMutualFunds
          ? (d.funds.length === 1 ? d.funds[0].name : `${d.funds.length} Mutual Funds — ${d.category}`)
          : null;
        const propName = fundDisplayName || d.name || d.category;
        // Roll-up value from individual fund values when in mutual-fund mode
        const rolledValue = isMutualFunds
          ? String(d.funds.reduce((s, h) => s + (Number(h.value) || 0), 0))
          : undefined;
        const isProperty = d.category === "Principal Residence" || d.category === "Real Estate (other)";
        const mortgageVal = Number(d.mortgageBalance || 0);
        const assetValue = isMutualFunds ? rolledValue
          : isProperty && !Number(d.value || 0) && Number(d.purchasePrice || 0) > 0 ? d.purchasePrice : d.value;
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
    if (!confirm("Delete this entry?")) return;
    await api.delete(`/api/net-worth/${id}`); await load();
  }

  function ownerLabel(entry: NWEntry) {
    return entry.owner === "spouse" ? (spouseName || "Spouse") : entry.owner === "joint" ? "Joint" : primaryName;
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
    return <RespTab clientId={clientId} client={client} />;
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
        <SummaryCard label={ct("netWorth.netWorth")} value={fmt$(netWorth)} tone={netWorth >= 0 ? "text-slate-900" : "text-red-500"} />
        <SummaryCard label={ct("netWorth.totalAssets")} value={fmt$(totalA)} tone="text-emerald-600" />
        <SummaryCard label={ct("netWorth.totalLiabilities")} value={fmt$(totalL)} tone="text-red-500" />
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6 flex-1 min-h-0 h-full">

        {/* ── Left 2/3 ───────────────────────────────────────────────────── */}
        <div className="col-span-2 space-y-4 overflow-y-auto min-h-0 h-full pr-2">

          {/* Action bar */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => addDraft("asset")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
              >
                <Plus className="w-4 h-4" />{ct("netWorth.addAsset")}
              </button>
              <button
                onClick={() => addDraft("liability")}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                <Plus className="w-4 h-4" />{ct("netWorth.addLiability")}
              </button>
            </div>
            <button
              onClick={() => setVoiceOpen(isAssets ? "asset" : "liability")}
              className="flex items-center gap-1.5 text-xs text-slate-500 border border-slate-200 px-3 py-1.5 rounded-full hover:border-cyan-400 hover:text-cyan-500 transition-colors"
            >
              <Mic className="w-3.5 h-3.5" /> Voice
            </button>
          </div>

          {/* New entry drafts */}
          {activeDrafts.length > 0 && (
            <div className="bg-white border border-cyan-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-3 bg-cyan-50 border-b border-cyan-100 flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-700">{ct(isAssets ? "netWorth.newAssets" : "netWorth.newLiabilities")}</span>
                <div className="flex gap-2">
                  <button onClick={() => setDrafts([])} className="text-xs text-slate-400 px-3 py-1 border border-slate-200 rounded-lg hover:bg-white transition-colors">
                    Discard All
                  </button>
                  <button onClick={saveAll} disabled={saving}
                    className="flex items-center gap-1.5 text-xs font-semibold text-white bg-[#0c1e3a] px-3 py-1 rounded-lg disabled:opacity-50 hover:bg-[#0e2a4a] transition-colors"
                  >
                    <Save className="w-3 h-3" /> {saving ? "Saving…" : `Save ${drafts.filter(isDraftSavable).length} Entries`}
                  </button>
                </div>
              </div>
              {activeDrafts.map((d, ri) => {
                const draftIdx = drafts.indexOf(d);
                return (
                  <div key={ri} className="px-5 py-4 border-b border-slate-50 last:border-0">
                    <div className="grid grid-cols-4 gap-3 mb-2">
                      <div>
                        <label className={LABEL_CLS}>Owner</label>
                        <select value={d.owner} onChange={e => updateDraft(draftIdx, "owner", e.target.value)} className={SELECT_CLS}>
                          <option value="primary">{primaryName || "Primary"}</option>
                          {spouseName && <option value="spouse">{spouseName}</option>}
                          {spouseName && <option value="joint">Joint</option>}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Category</label>
                        <select value={d.category} onChange={e => updateDraft(draftIdx, "category", e.target.value)} className={SELECT_CLS}>
                          {activeCats.map(c => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Name / Description</label>
                        <InlineInput
                          value={d.holdingType === "Mutual Funds" ? (d.funds.length > 0 ? `${d.funds.length} fund${d.funds.length > 1 ? "s" : ""} selected` : "") : d.name}
                          onChange={v => updateDraft(draftIdx, "name", v)}
                          placeholder={d.holdingType === "Mutual Funds" ? "Funds selected below ↓" : d.category}
                          className={d.holdingType === "Mutual Funds" ? "bg-slate-50 text-slate-400 cursor-default" : ""}
                          // read-only display when mutual funds mode — actual input is MultiFundSelector
                        />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>{isAssets ? ct("netWorth.marketValue") : ct("netWorth.balanceOwing")}</label>
                        <div className="flex gap-1">
                          <InlineInput
                            type="number"
                            value={d.holdingType === "Mutual Funds"
                              ? String(d.funds.reduce((s, h) => s + (Number(h.value) || 0), 0) || "")
                              : d.value}
                            onChange={v => {
                              if (d.holdingType !== "Mutual Funds") updateDraft(draftIdx, "value", v);
                            }}
                            placeholder={d.holdingType === "Mutual Funds" ? "Auto from funds" : "0"}
                            className={d.holdingType === "Mutual Funds" ? "bg-slate-50 text-slate-500 cursor-default" : ""}
                          />
                          <button onClick={() => removeDraft(draftIdx)} className="text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Multi-fund selector — spans full width when holding type is Mutual Funds */}
                    {d.holdingType === "Mutual Funds" && (
                      <div className="grid grid-cols-4 gap-3 mt-1">
                        <MultiFundSelector
                          holdings={d.funds}
                          onChange={holdings => {
                            const total = holdings.reduce((s, h) => s + (Number(h.value) || 0), 0);
                            setDrafts(prev => prev.map((x, idx) => idx === draftIdx
                              ? { ...x, funds: holdings, value: total > 0 ? String(total) : x.value }
                              : x
                            ));
                          }}
                        />
                      </div>
                    )}
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
                    <ExtraFields draft={d} onChange={(k, v) => updateDraft(draftIdx, k, v)} spouseName={spouseName} dependants={[]} />
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
                          <label className={LABEL_CLS}>Owner</label>
                          <select value={editForm.owner ?? "primary"} onChange={ev => setEditForm(f => ({ ...f, owner: ev.target.value }))} className={SELECT_CLS}>
                            <option value="primary">{primaryName || "Primary"}</option>
                            {spouseName && <option value="spouse">{spouseName}</option>}
                            {spouseName && <option value="joint">Joint</option>}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLS}>Category</label>
                          <select value={editForm.category ?? ""} onChange={ev => setEditForm(f => ({ ...f, category: ev.target.value }))} className={SELECT_CLS}>
                            {activeCats.map(c => <option key={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={LABEL_CLS}>Name / Description</label>
                          <InlineInput
                            value={editForm.holdingType === "Mutual Funds"
                              ? ((editForm as any).funds?.length > 0 ? `${(editForm as any).funds.length} fund${(editForm as any).funds.length > 1 ? "s" : ""} selected` : "")
                              : (editForm.name ?? "")}
                            onChange={v => { if (editForm.holdingType !== "Mutual Funds") setEditForm(f => ({ ...f, name: v })); }}
                            placeholder={editForm.holdingType === "Mutual Funds" ? "Funds selected below ↓" : editForm.category}
                            className={editForm.holdingType === "Mutual Funds" ? "bg-slate-50 text-slate-400 cursor-default" : ""}
                          />
                        </div>
                        <div>
                          <label className={LABEL_CLS}>{isAssets ? ct("netWorth.marketValue") : ct("netWorth.balanceOwing")}</label>
                          <InlineInput
                            type="number"
                            value={editForm.holdingType === "Mutual Funds"
                              ? String(((editForm as any).funds ?? []).reduce((s: number, h: FundHolding) => s + (Number(h.value) || 0), 0) || "")
                              : (editForm.value ?? "")}
                            onChange={v => { if (editForm.holdingType !== "Mutual Funds") setEditForm(f => ({ ...f, value: v })); }}
                            placeholder={editForm.holdingType === "Mutual Funds" ? "Auto from funds" : "0"}
                            className={editForm.holdingType === "Mutual Funds" ? "bg-slate-50 text-slate-500 cursor-default" : ""}
                          />
                        </div>
                      </div>
                      {/* Multi-fund selector for edit form */}
                      {editForm.holdingType === "Mutual Funds" && (
                        <div className="mb-2">
                          <MultiFundSelector
                            holdings={(editForm as any).funds ?? []}
                            onChange={funds => {
                              const total = funds.reduce((s: number, h: FundHolding) => s + (Number(h.value) || 0), 0);
                              setEditForm(f => ({
                                ...f,
                                funds,
                                value: total > 0 ? String(total) : f.value,
                                metadata: { ...(f.metadata ?? {}), funds },
                              } as any));
                            }}
                          />
                        </div>
                      )}
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
                                    <span className="text-xs text-slate-400">Contributor:</span>
                                    <select value={editForm.rrspContributor ?? ""} onChange={ev => setEditForm(f => ({ ...f, rrspContributor: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                      <option value="">Select…</option>
                                      <option value="client">{primaryName || "Client"}</option>
                                      {spouseName && <option value="spouse">{spouseName}</option>}
                                    </select>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-400">Holding type:</span>
                              <select value={editForm.holdingType ?? ""} onChange={ev => setEditForm(f => ({ ...f, holdingType: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                <option value="">Select…</option>
                                {HOLDING_TYPES.map(t => <option key={t}>{t}</option>)}
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
                              <span className="text-xs text-slate-400">Property type:</span>
                              <select value={editForm.propertyType ?? "Family Occupied"} onChange={ev => setEditForm(f => ({ ...f, propertyType: ev.target.value }))} className="border border-slate-200 rounded-lg px-2 py-1 text-sm">
                                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
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
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="text-sm text-slate-500 px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                        <button onClick={saveEdit} disabled={saving} className="text-sm font-semibold text-white bg-[#0c1e3a] px-4 py-1.5 rounded-lg disabled:opacity-50 hover:bg-[#0e2a4a] transition-colors">
                          {saving ? "Saving…" : "Save"}
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
              <p className="text-slate-400 text-sm">No {isAssets ? "assets" : "liabilities"} added yet</p>
              <button onClick={() => addDraft(isAssets ? "asset" : "liability")} className="mt-3 text-cyan-500 text-sm hover:underline">
                {ct("netWorth.addFirst")} {isAssets ? ct("netWorth.asset") : ct("netWorth.liability")}
              </button>
            </div>
          )}

        </div>

        {/* ── Right 1/3 ──────────────────────────────────────────────────── */}
        <div className="space-y-4 overflow-y-auto min-h-0 h-full">

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
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Summary</p>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{ct("netWorth.totalAssets")}</span>
                <span className="font-semibold text-emerald-600">{fmt$(totalA)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-500">{ct("netWorth.totalLiabilities")}</span>
                <span className="font-semibold text-red-500">{fmt$(totalL)}</span>
              </div>
              <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
                <span className="font-semibold text-slate-900">{ct("netWorth.netWorth")}</span>
                <span className={`font-bold text-lg ${netWorth >= 0 ? "text-slate-900" : "text-red-500"}`}>
                  {fmt$(netWorth)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Add */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Quick Add</p>
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
                  + {cat}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* Voice dialog */}
      {voiceOpen && (
        <VoiceAddDialog
          title={`Voice-Add ${voiceOpen === "asset" ? "Asset" : "Liability"}`}
          moduleId={`net-worth-${voiceOpen}`}
          prompt={voiceOpen === "asset"
            ? `Try: "TFSA at TD worth twenty-five thousand, jointly with spouse"`
            : `Try: "RBC mortgage balance 320 thousand, monthly payment 1850"`}
          fieldSchema={[
            { key: "category", label: "Category", description: `Type of ${voiceOpen}`, enum: voiceOpen === "asset" ? NW_ASSET_CATS : NW_LIAB_CATS },
            { key: "name", label: "Name", description: "Description" },
            { key: "value", label: voiceOpen === "asset" ? "Value" : "Balance", description: "Amount in dollars" },
            { key: "owner", label: "Owner", description: "Who owns it", enum: ["primary", "spouse", "joint"] },
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
  const calcAge = useCallback((dob: string | null) => 
  dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
, []);
  const clientAge = calcAge(client?.dateOfBirth);
  const spouseAge = calcAge(client?.spouseDateOfBirth);
  const clientName = client ? client.firstName : "Primary";
  const spouseName = client?.spouseFirstName ?? "Spouse";
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
      const isSpouseRow = r.label === client.spouseFirstName || r.label === "Spouse";
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
    if (!confirm("Delete projection?")) return;
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
    if (person === "primary")  return !r.label?.includes("&") && r.label !== spouseName && r.label !== "Spouse";
    if (person === "spouse")   return r.label === spouseName || r.label === "Spouse";
    return true; // combined shows all
  });
  const filteredDrafts = drafts.filter(d => {
    if (person === "primary")  return !d.label?.includes("&") && d.label !== spouseName && d.label !== "Spouse";
    if (person === "spouse")   return d.label === spouseName || d.label === "Spouse";
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
    if (label === spouseName || label === "Spouse") return "text-pink-600";
    return "text-blue-600";
  };

 return (
    <div className="p-6 max-w-5xl mx-auto">
      {simResult && <MonteCarloResults result={simResult} onClose={() => setSimResult(null)} onPrint={() => window.print()} />}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {(["projections","drawdown"] as const).map(key => (
          <button key={key} onClick={() => setActiveSubTab(key)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeSubTab === key ? "bg-white border border-b-white border-gray-200 text-[#0c1e3a] -mb-px" : "text-gray-500 hover:text-gray-700"}`}>
            {key === "projections" ? "Retirement Projections" : "Drawdown Strategies"}
          </button>
        ))}
      </div>
      {activeSubTab === "drawdown" && <DrawdownTab clientId={clientId} client={client} />}
      {activeSubTab === "projections" && (
      <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-gray-900">Retirement Projections</h2>
        <div className="flex gap-2">
          <button onClick={runSim} disabled={simulating}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 rounded-lg">
            {simulating ? "Running..." : "Retirement Checkup"}
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
                  ["Client","label","text"],["Current Age","currentAge","number"],["Retirement Age","retirementAge","number"],
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
            <button onClick={() => { setDrafts([]); setEditingId(null); }} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Cancel</button>
            <button onClick={saveAll} disabled={saving}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : editingId ? "Save Changes" : `Save ${drafts.length} Projection${drafts.length > 1 ? "s" : ""}`}
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
                          <p className="text-[10px] font-bold text-purple-600 uppercase">Desired Income</p>
                          <p className="text-lg font-bold text-purple-700">{hasDesired ? `${fmt$(desired)}/yr` : "—"}</p>
                          <p className="text-[10px] text-purple-400 mt-0.5">retirement target</p>
                        </div>
                        <div className={`rounded-xl p-3 ${!hasDesired ? "bg-gray-50" : gap >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                          <p className={`text-[10px] font-bold uppercase ${!hasDesired ? "text-gray-400" : gap >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            {!hasDesired ? "Shortfall" : gap >= 0 ? "Surplus" : "Shortfall"}
                          </p>
                          <p className={`text-lg font-bold ${!hasDesired ? "text-gray-400" : gap >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                            {!hasDesired ? "—" : `${gap >= 0 ? "+" : ""}${fmt$(gap)}/yr`}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${!hasDesired ? "text-gray-300" : gap >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {!hasDesired ? "set desired income" : "per year"}
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
    if (!confirm("Delete?")) return;
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
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.length} Analysis`}
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
              {[["Life Insurance","existingLifeCoverage","recommendedLife","lifeGap"],
                ["Disability","existingDisability","recommendedDisability","disabilityGap"],
                ["Critical Illness","existingCriticalIllness","recommendedCriticalIllness","criticalIllnessGap"]].map(([title,ex,rec,gap]) => (
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
function EducationSubTab({ clientId, client }: { clientId: number; client?: any }) {
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
    if (!confirm("Delete?")) return;
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
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Total RESP Balance</p>
          <p className="text-2xl font-bold text-[var(--accent-cyan)] font-mono">{fmt$(totalResp)}</p>
        </div>
        <div className="fp-insightled-card p-4">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-1">Total Target</p>
          <p className="text-2xl font-bold text-[var(--text-primary)] font-mono">{totalTarget ? fmt$(totalTarget) : "—"}</p>
        </div>
      </div>

      {/* Table header */}
      <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-card)]">
          <h3 className="font-semibold text-[var(--text-primary)] text-sm">Children's Education Plans</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceOpen(true)}
              title="Voice add child"
              className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--border-light)] text-[var(--text-secondary)] hover:text-[var(--accent-cyan)] hover:border-[var(--accent-cyan)] text-xs font-semibold transition-colors"
            >
              <Mic className="w-3.5 h-3.5" /> Voice
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
            title="Voice-Add Education Plan"
            moduleId="education-plan"
            prompt={`Try: "Sarah, born June 12 2015, RESP balance 12 thousand, contributing twenty-five hundred a year, target sixty thousand"`}
            fieldSchema={[
              { key: "childName",          label: "Child Name", description: "Full first name" },
              { key: "childDob",           label: "DOB",        description: "Date of birth (YYYY-MM-DD)" },
              { key: "currentRespBalance", label: "RESP Balance", description: "Current RESP balance, number only" },
              { key: "annualContribution", label: "Annual Contrib", description: "Annual contribution, number only" },
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
              {["Child", "Date of Birth", "RESP Balance", "Annual Contrib", "Target", "CESG", "Projected", "Notes", ""].map(h => (
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
                  No education plans yet — click <span className="text-[var(--accent-cyan)]">Add Child</span> to get started
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
            <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.filter(d=>d.childName).length} Child${drafts.filter(d=>d.childName).length !== 1 ? "ren" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use EducationSubTab (rendered inside NetWorthTab) instead. Kept for API compatibility. */
export function RespTab({ clientId, client }: { clientId: number; client?: any }) {
  return <EducationSubTab clientId={clientId} client={client} />;
}

// ── DEBT ──────────────────────────────────────────────────────────────────────
interface DebtEntry { id: number; name: string; type: string; category?: string; balance: string; interestRate: string|null; minimumPayment: string|null; payoffStrategy: string|null; notes: string|null; }
type DebtDraft = { name: string; type: string; balance: string; interestRate: string; minimumPayment: string; payoffStrategy: string; notes: string; };
const emptyDebt = (): DebtDraft => ({ name:"", type:"credit_card", balance:"", interestRate:"", minimumPayment:"", payoffStrategy:"avalanche", notes:"" });

export function DebtTab({ clientId }: { clientId: number }) {
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
    if (!confirm("Delete?")) return;
    await api.delete(`/api/debt/${id}`); await load();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Debt &amp; Cash Flow</h2>
          {rows.length > 0 && <p className="text-sm font-bold text-red-500">Total: {fmt$(totalDebt)}</p>}
        </div>
        <button onClick={() => setDrafts(d => [...d, emptyDebt()])}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg">
          <Plus className="w-3.5 h-3.5" /> Add Debt
        </button>
      </div>
     <DebtDashboard rows={rows} />
      {/* Draft debt rows */}
      {drafts.length > 0 && (
        <Card className="mb-5 border-blue-200 bg-blue-50/20">
          <div className="p-3 border-b border-blue-100">
            <h3 className="font-bold text-gray-800 text-sm">New Debts — add as many as needed, then save all at once</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-blue-50 border-b border-blue-100">
              <tr><TH>Name</TH><TH>Type</TH><TH>Balance ($)</TH><TH>Rate (%)</TH><TH>Min Payment ($)</TH><TH>Strategy</TH><TH></TH></tr>
            </thead>
            <tbody className="divide-y divide-blue-100">
              {drafts.map((d, i) => (
                <tr key={i}>
                  <TD><InlineInput value={d.name} onChange={v => updateDraft(i,"name",v)} placeholder="e.g. TD Visa" /></TD>
                  <TD><InlineSelect value={d.type} onChange={v => updateDraft(i,"type",v)} options={DEBT_TYPES} /></TD>
                  <TD><InlineInput value={d.balance} onChange={v => updateDraft(i,"balance",v)} type="number" /></TD>
                  <TD><InlineInput value={d.interestRate} onChange={v => updateDraft(i,"interestRate",v)} type="number" /></TD>
                  <TD><InlineInput value={d.minimumPayment} onChange={v => updateDraft(i,"minimumPayment",v)} type="number" /></TD>
                  <TD><InlineSelect value={d.payoffStrategy} onChange={v => updateDraft(i,"payoffStrategy",v)} options={["avalanche","snowball"]} /></TD>
                  <TD><button onClick={() => setDrafts(x => x.filter((_,idx)=>idx!==i))} className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></TD>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end gap-2 p-3">
            <button onClick={() => setDrafts([])} className="text-sm text-gray-500 px-4 py-2 border border-gray-200 rounded-lg">Discard</button>
            <button onClick={saveAll} disabled={saving || !drafts.some(d => d.name && d.balance)}
              className="flex items-center gap-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg">
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : `Save ${drafts.filter(d=>d.name&&d.balance).length} Debts`}
            </button>
          </div>
        </Card>
      )}

      {rows.length === 0 && drafts.length === 0 && (
        <Card className="p-8 text-center text-gray-400">No debts recorded yet.</Card>
      )}
      {rows.length > 0 && (
        <Card>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr><TH>Name</TH><TH>Type</TH><TH>Balance</TH><TH>Rate</TH><TH>Min Payment</TH><TH>Strategy</TH><TH></TH></tr>
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



















