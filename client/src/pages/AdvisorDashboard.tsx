/**
 * AdvisorDashboard — shown when an advisor logs in.
 * Lists all their clients with quick-action links.
 * Fetches GET /api/clients (existing endpoint, already authenticated).
 */
import { useEffect, useState } from "react";
import {
  Users, Search, Plus, TrendingUp, Shield, ChevronRight,
  Calendar, DollarSign, UserPlus, AlertCircle, RefreshCw,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email?: string;
  dateOfBirth?: string | null;
  annualIncome?: string | null;
  spouseFirstName?: string | null;
  spouseLastName?: string | null;
  retirementAge?: number | null;
  jurisdiction?: string;
  createdAt?: string;
}

interface Props {
  /** Called when the advisor selects a client — parent loads client detail view */
  onSelectClient: (clientId: number, clientName: string) => void;
  /** Called when the advisor clicks "+ New Client" */
  onAddClient?: () => void;
  accessToken?: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function formatIncome(v: string | null | undefined): string {
  const n = Number(v ?? 0);
  if (!n) return "—";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

function initials(first: string, last: string): string {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// Deterministic avatar colour from name
const AVATAR_COLORS = [
  ["#2d1b69", "#7c3aed"],
  ["#1e3a5f", "#2563eb"],
  ["#0f3d2e", "#059669"],
  ["#4a1942", "#9333ea"],
  ["#1c2e4a", "#0891b2"],
];
function avatarGradient(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  const [a, b] = AVATAR_COLORS[idx];
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AdvisorDashboard({ onSelectClient, onAddClient, accessToken }: Props) {
  const [clients, setClients] = useState<Client[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = async () => {
    setStatus("loading");
    setError("");
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
      const res = await fetch("/api/clients", { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Client[] = await res.json();
      setClients(data);
      setStatus("ready");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load clients");
      setStatus("error");
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = clients.filter(c => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(q) ||
      c.lastName.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  // ── Stats ─────────────────────────────────────────────────────────
  const totalClients = clients.length;
  const withSpouse = clients.filter(c => c.spouseFirstName).length;
  const avgAge = (() => {
    const ages = clients.map(c => ageFromDob(c.dateOfBirth)).filter((a): a is number => a !== null);
    if (!ages.length) return null;
    return Math.round(ages.reduce((s, a) => s + a, 0) / ages.length);
  })();

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ background: "#f1f5f9", minHeight: "100vh" }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="px-8 py-6 flex items-center justify-between"
        style={{ background: "#ffffff", borderBottom: "1px solid rgb(226 232 240 / 0.8)" }}
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: "#0f172a" }}>
            Client Dashboard
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "#64748b" }}>
            {totalClients} client{totalClients !== 1 ? "s" : ""} on file
          </p>
        </div>
        <button
          onClick={onAddClient}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-sm transition-all"
          style={{ background: "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          <UserPlus className="w-4 h-4" />
          New Client
        </button>
      </div>

      <div className="p-8 space-y-6">

        {/* ── Stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={Users}
            label="Total Clients"
            value={String(totalClients)}
            accent="#7c3aed"
          />
          <StatCard
            icon={TrendingUp}
            label="Avg Client Age"
            value={avgAge !== null ? `${avgAge} yrs` : "—"}
            accent="#2563eb"
          />
          <StatCard
            icon={Shield}
            label="Households w/ Spouse"
            value={String(withSpouse)}
            accent="#059669"
          />
        </div>

        {/* ── Search ────────────────────────────────────────────── */}
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "#94a3b8" }}
          />
          <input
            type="text"
            placeholder="Search by name or email…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm"
            style={{
              background: "#ffffff",
              border: "1px solid rgb(226 232 240)",
              color: "#0f172a",
              outline: "none",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed")}
            onBlur={e => (e.currentTarget.style.borderColor = "rgb(226 232 240)")}
          />
        </div>

        {/* ── Client list ───────────────────────────────────────── */}
        {status === "loading" && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: "rgba(124,58,237,0.2)", borderTopColor: "#7c3aed" }}
            />
            <span className="text-sm" style={{ color: "#94a3b8" }}>Loading clients…</span>
          </div>
        )}

        {status === "error" && (
          <div
            className="flex flex-col items-center justify-center py-12 gap-3 rounded-xl"
            style={{ background: "#fff5f5", border: "1px solid #fecaca" }}
          >
            <AlertCircle className="w-8 h-8" style={{ color: "#f43f5e" }} />
            <p className="text-sm font-medium" style={{ color: "#0f172a" }}>Could not load clients</p>
            <p className="text-xs" style={{ color: "#64748b" }}>{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: "#fff", border: "1px solid #e2e8f0", color: "#475569" }}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {status === "ready" && filtered.length === 0 && (
          <div
            className="flex flex-col items-center justify-center py-16 gap-4 rounded-xl"
            style={{ background: "#ffffff", border: "1px solid rgb(226 232 240 / 0.8)" }}
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.08)" }}
            >
              <Users className="w-8 h-8" style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-center">
              <p className="font-semibold" style={{ color: "#0f172a" }}>
                {query ? "No clients match your search" : "No clients yet"}
              </p>
              <p className="text-sm mt-1" style={{ color: "#64748b" }}>
                {query ? "Try a different name or email" : "Add your first client to get started"}
              </p>
            </div>
            {!query && (
              <button
                onClick={onAddClient}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)" }}
              >
                <Plus className="w-4 h-4" />
                Add First Client
              </button>
            )}
          </div>
        )}

        {status === "ready" && filtered.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "#ffffff", border: "1px solid rgb(226 232 240 / 0.8)" }}
          >
            {/* Table header */}
            <div
              className="grid grid-cols-12 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider"
              style={{ background: "#f8fafc", borderBottom: "1px solid rgb(226 232 240)", color: "#94a3b8" }}
            >
              <div className="col-span-4">Client</div>
              <div className="col-span-2">Age</div>
              <div className="col-span-2">Income</div>
              <div className="col-span-2">Jurisdiction</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            {/* Rows */}
            {filtered.map((client, i) => {
              const fullName = `${client.firstName} ${client.lastName}`;
              const spouseName = client.spouseFirstName
                ? `& ${client.spouseFirstName} ${client.spouseLastName ?? ""}`
                : null;
              const age = ageFromDob(client.dateOfBirth);
              const income = formatIncome(client.annualIncome);
              const jurisdiction = client.jurisdiction ?? "CA";

              return (
                <div
                  key={client.id}
                  className="grid grid-cols-12 px-5 py-4 items-center transition-colors cursor-pointer"
                  style={{
                    borderBottom: i < filtered.length - 1 ? "1px solid rgb(241 245 249)" : undefined,
                  }}
                  onClick={() => onSelectClient(client.id, fullName)}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}
                >
                  {/* Name + avatar */}
                  <div className="col-span-4 flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                      style={{ background: avatarGradient(fullName) }}
                    >
                      {initials(client.firstName, client.lastName)}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#0f172a" }}>
                        {fullName}
                      </div>
                      {spouseName && (
                        <div className="text-xs" style={{ color: "#94a3b8" }}>{spouseName}</div>
                      )}
                      {client.email && (
                        <div className="text-xs" style={{ color: "#94a3b8" }}>{client.email}</div>
                      )}
                    </div>
                  </div>

                  {/* Age */}
                  <div className="col-span-2 text-sm" style={{ color: "#475569" }}>
                    {age !== null ? `${age} yrs` : "—"}
                  </div>

                  {/* Income */}
                  <div className="col-span-2 text-sm font-mono" style={{ color: "#475569" }}>
                    {income}
                  </div>

                  {/* Jurisdiction */}
                  <div className="col-span-2">
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                      style={
                        jurisdiction === "US"
                          ? { background: "rgba(37,99,235,0.1)", color: "#2563eb" }
                          : { background: "rgba(124,58,237,0.1)", color: "#7c3aed" }
                      }
                    >
                      {jurisdiction}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="col-span-2 flex justify-end">
                    <button
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                      style={{
                        background: "rgba(124,58,237,0.08)",
                        color: "#7c3aed",
                        border: "1px solid rgba(124,58,237,0.2)",
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        onSelectClient(client.id, fullName);
                      }}
                    >
                      Open <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "#ffffff", border: "1px solid rgb(226 232 240 / 0.8)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: accent }} />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#94a3b8" }}>
          {label}
        </span>
      </div>
      <div className="text-2xl font-bold font-mono" style={{ color: "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}
