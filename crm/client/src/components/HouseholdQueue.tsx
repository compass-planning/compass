/**
 * HouseholdQueue — bilingual version
 */

import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect, useCallback } from "react";
import { Search, Plus, Trash2, ChevronUp, ChevronDown, Users } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "@/hooks/use-toast";

interface Client {
  id: number; firstName: string; lastName: string;
  email: string | null; phone: string | null;
  province: string | null;
}

interface Overview {
  netWorth: number; totalAssets: number; totalLiabilities: number;
  totalDebt: number; retirementProjections: number; insuranceAnalyses: number;
  educationPlans: number; taxNotes: number; estateNotes: number;
  aiRecommendations: number; pendingAi: number; plans: number;
}

interface Props {
  onSelect: (clientId: number) => void;
}

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

function householdScore(ov: Overview | null): number {
  if (!ov) return 0;
  let s = 100;
  if (ov.retirementProjections === 0) s -= 22;
  if (ov.insuranceAnalyses     === 0) s -= 18;
  if (ov.pendingAi > 0)               s -= Math.min(25, ov.pendingAi * 8);
  if (ov.netWorth <= 0)               s -= 10;
  return Math.max(0, s);
}

function scoreLabel(s: number, isFr: boolean) {
  if (s >= 85) return { label: isFr ? "Optimisé"         : "Optimized",     cls: "text-emerald-600 bg-emerald-50 border-emerald-100", dot: "bg-emerald-400" };
  if (s >= 70) return { label: isFr ? "Révision requise" : "Review Needed", cls: "text-violet-600    bg-violet-50    border-violet-100",    dot: "bg-violet-400" };
  if (s >= 50) return { label: isFr ? "Lacunes"          : "Planning Gaps", cls: "text-amber-600   bg-amber-50   border-amber-100",   dot: "bg-amber-400" };
  return              { label: isFr ? "Critique"         : "Critical",      cls: "text-red-600    bg-red-50     border-red-100",      dot: "bg-red-400" };
}

function fmtNw(nw: number | null): string {
  if (nw === null) return "—";
  if (Math.abs(nw) >= 1_000_000) return `$${(nw / 1_000_000).toFixed(1)}M`;
  if (Math.abs(nw) >= 1_000)     return `$${Math.round(nw / 1000)}K`;
  return `$${Math.round(nw)}`;
}

function fmtAum(n: number): string {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${Math.round(n / 1000)}K`;
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

const BG = ["bg-violet-500","bg-violet-500","bg-emerald-500","bg-orange-500","bg-pink-500","bg-teal-500","bg-indigo-500","bg-rose-500"];
function avatarBg(name: string) {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return BG[Math.abs(h) % BG.length];
}


function tFn(dict: any, key: string): string {
  const parts = key.split(".");
  let cur = dict;
  for (const p of parts) { if (cur == null) return key; cur = cur[p]; }
  return typeof cur === "string" ? cur : key;
}

function HouseholdRow({ c, onSelect, onDelete, onOvReady, keyboardActive }: {
  c: Client;
  onSelect: (clientId: number) => void;
  onDelete: (id: number) => void;
  onOvReady?: (id: number, ov: Overview) => void;
  keyboardActive?: boolean;
}) {
  const { isFrench: isFr } = useLanguage();
  const [ov, setOv]           = useState<Overview | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get<Overview>(`/api/crm/clients/${c.id}/overview`).then(data => {
      setOv(data);
      onOvReady?.(c.id, data);
    }).catch(() => {});
  }, [c.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = householdScore(ov);
  const { label: statusLabel, cls: statusCls, dot } = scoreLabel(score, isFr);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(isFr ? "Supprimer ce client et toutes ses données?" : "Delete this client and all their data?")) return;
    try {
      await api.delete(`/api/crm/clients/${c.id}`);
      onDelete(c.id);
      toast({ title: isFr ? "Client supprimé" : "Client deleted" });
    } catch {
      toast({ title: isFr ? "Erreur" : "Error", variant: "destructive" });
    }
  };

  return (
    <div
      className={`group bg-white border rounded-xl transition-all duration-150 cursor-pointer ${
        keyboardActive ? "border-violet-400 shadow-md" : "border-slate-200 hover:border-violet-300 hover:shadow-sm"
      }`}
      onClick={() => onSelect(c.id)}
      tabIndex={0}
      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onSelect(c.id); }}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarBg(c.firstName + c.lastName)}`}>
          {initials(c.firstName, c.lastName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-900 truncate">{c.firstName} {c.lastName}</p>
          {c.email && <p className="text-[11px] text-slate-400 truncate">{c.email}</p>}
        </div>
        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusCls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
          {statusLabel}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={e => { e.stopPropagation(); setExpanded(x => !x); }}
            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <button onClick={handleDelete} className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && ov && (
        <div className="px-3 pb-3 grid grid-cols-3 gap-2 border-t border-slate-50 pt-2 mt-1">
          <div className="text-center">
            <p className="text-[10px] text-slate-400">{isFr ? "Valeur nette" : "Net Worth"}</p>
            <p className="text-xs font-bold text-slate-700">{fmtNw(ov.netWorth)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400">{isFr ? "Retraite" : "Retirement"}</p>
            <p className="text-xs font-bold text-slate-700">{ov.retirementProjections > 0 ? "✓" : "—"}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-slate-400">{isFr ? "Assurance" : "Insurance"}</p>
            <p className="text-xs font-bold text-slate-700">{ov.insuranceAnalyses > 0 ? "✓" : "—"}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function HouseholdQueue({ onSelect }: Props) {
  const { t: _tObj, isFrench: isFr } = useLanguage();
  // Several of this component's strings were filed under the "goals" block in translations.ts;
  // fall back there so "client.householdQueue" etc. render text instead of the raw key.
  const t = (key: string) => {
    const v = tFn(_tObj as any, key);
    return v === key ? tFn(_tObj as any, key.replace(/^client\./, "goals.")) : v;
  };
  const [clients, setClients]     = useState<Client[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [province, setProvince]   = useState("");
  const [overviews, setOverviews] = useState<Record<number, Overview>>({});
  const [showAdd, setShowAdd]     = useState(false);
  const [kbIndex, setKbIndex]     = useState(-1);

  // New client form
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", province: "" });

  const load = useCallback(() => {
    setLoading(true);
    api.get<Client[]>("/api/crm/clients")
      .then(setClients)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = clients.filter(c => {
    const term = search.toLowerCase();
    const matchName = `${c.firstName} ${c.lastName} ${c.email ?? ""}`.toLowerCase().includes(term);
    const matchProv = !province || c.province === province;
    return matchName && matchProv;
  });

  const totalNW = Object.values(overviews).reduce((s, o) => s + (o.netWorth || 0), 0);
  const avgScore = filtered.length
    ? Math.round(filtered.reduce((s, c) => s + householdScore(overviews[c.id] ?? null), 0) / filtered.length)
    : 0;

  const handleAdd = async () => {
    if (!form.firstName || !form.lastName) return;
    try {
      await api.post("/api/crm/clients", form);
      setForm({ firstName: "", lastName: "", email: "", phone: "", province: "" });
      setShowAdd(false);
      load();
    } catch {
      toast({ title: isFr ? "Erreur lors de l'ajout" : "Error adding client", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#f8fafc" }}>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">{t("client.householdQueue")}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {filtered.length} {t("client.households")} · {t("client.avgScore")}: {avgScore}
              {totalNW > 0 && ` · AUM: ${fmtAum(totalNW)}`}
            </p>
          </div>
          <button
            onClick={() => setShowAdd(s => !s)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#5b21b6] hover:bg-[#4c1d95] text-white text-xs font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {t("client.newHousehold")}
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <p className="text-xs font-semibold text-slate-700">{t("client.addHousehold")}</p>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder={t("auth.firstName")} value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <input placeholder={t("auth.lastName")} value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <input placeholder={t("client.email")} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
              <input placeholder={t("client.phone")} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className="px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/30" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdd} className="px-3 py-1.5 bg-[#5b21b6] text-white text-xs font-semibold rounded-lg">{t("action.add")}</button>
              <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg">{t("action.cancel")}</button>
            </div>
          </div>
        )}

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={t("client.searchHouseholds")}
              value={search}
              onChange={e => { setSearch(e.target.value); setKbIndex(-1); }}
              className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-violet-400/30"
            />
          </div>
          <select
            value={province}
            onChange={e => setProvince(e.target.value)}
            className="border border-slate-200 rounded-lg text-xs px-2 py-2 focus:outline-none"
          >
            <option value="">{t("client.province")}</option>
            {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          [...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Users className="w-12 h-12 text-slate-200 mb-3" />
            <p className="text-sm font-semibold text-slate-500">
              {search ? t("client.noClientsFound") : t("client.noClients")}
            </p>
          </div>
        ) : (
          filtered.map((c, i) => (
            <HouseholdRow
              key={c.id}
              c={c}
              onSelect={onSelect}
              onDelete={id => setClients(cs => cs.filter(x => x.id !== id))}
              onOvReady={(id, ov) => setOverviews(o => ({ ...o, [id]: ov }))}
              keyboardActive={kbIndex === i}
            />
          ))
        )}
      </div>
    </div>
  );
}
