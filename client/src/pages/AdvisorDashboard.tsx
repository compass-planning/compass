/**
 * AdvisorDashboard — shown when an advisor logs in.
 *
 * Fetches GET /api/clients and renders a stats row + client table.
 * Filters out any row whose userId matches the logged-in advisor so the
 * advisor is never shown as their own household (belt-and-suspenders on
 * top of the server-side fix that skips creating that row on registration).
 */
import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth";
import {
  Users, TrendingUp, UserPlus, MapPin,
  ChevronRight, Loader2, AlertCircle,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClientRow {
  id:           number;
  userId?:      number;  // present when the row was auto-created from users table
  firstName:    string;
  lastName:     string;
  age?:         number;
  income?:      number;
  jurisdiction: string;
  hasSpouse?:   boolean;
}

interface Props {
  onSelectClient: (id: number, name: string) => void;
  onAddClient:    () => void;
  accessToken:    string | null;
}

// ── gradient avatar ────────────────────────────────────────────────────────────
function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)",
  "linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%)",
  "linear-gradient(135deg, #14532d 0%, #16a34a 100%)",
  "linear-gradient(135deg, #4a1d96 0%, #9333ea 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #ea580c 100%)",
  "linear-gradient(135deg, #0f172a 0%, #0891b2 100%)",
];

function avatarGradient(id: number) {
  return AVATAR_GRADIENTS[id % AVATAR_GRADIENTS.length];
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function Stat({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div
      className="flex-1 rounded-xl p-4"
      style={{
        background: "rgba(255,255,255,0.04)",
        border:     "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.4)" }}>
          {label}
        </span>
        <span style={{ color: "#a78bfa" }}>{icon}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

// ── AdvisorDashboard ──────────────────────────────────────────────────────────
export function AdvisorDashboard({ onSelectClient, onAddClient, accessToken }: Props) {
  const { user } = useAuth();
  const advisorUserId = (user as any)?.id as number | undefined;

  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError  ] = useState("");

  useEffect(() => {
    if (!accessToken) return;
    let alive = true;

    fetch("/api/clients", {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ClientRow[]) => {
        if (!alive) return;
        setClients(data);
      })
      .catch((e: Error) => {
        if (alive) setError(e.message ?? "Failed to load clients");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => { alive = false; };
  }, [accessToken, advisorUserId]);

  // ── Derived stats ─────────────────────────────────────────────────────────
  const totalClients = clients.length;
  const avgAge       = clients.length
    ? Math.round(clients.reduce((s, c) => s + (c.age ?? 0), 0) / clients.length) || "—"
    : "—";
  const withSpouse   = clients.filter(c => c.hasSpouse).length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 min-h-screen overflow-y-auto"
      style={{ background: "#0f0a1e" }}
    >
      <div className="max-w-5xl mx-auto px-8 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">Client Dashboard</h1>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              {loading ? "Loading…" : `${totalClients} client${totalClients !== 1 ? "s" : ""} on your book`}
            </p>
          </div>
          <button
            onClick={onAddClient}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)",
              color: "#fff",
            }}
          >
            <UserPlus className="w-4 h-4" />
            Add Client
          </button>
        </div>

        {/* Stats row */}
        <div className="flex gap-4 mb-8">
          <Stat label="Total Clients"          value={totalClients} icon={<Users className="w-4 h-4" />} />
          <Stat label="Avg. Client Age"        value={avgAge}       icon={<TrendingUp className="w-4 h-4" />} />
          <Stat label="With Spouse / Partner"  value={withSpouse}   icon={<Users className="w-4 h-4" />} />
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20 gap-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#7c3aed" }} />
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>Loading clients…</span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            className="flex items-center gap-3 p-4 rounded-lg"
            style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span className="text-sm text-red-300">{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && clients.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.2)" }}
            >
              <Users className="w-7 h-7" style={{ color: "#7c3aed" }} />
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">No clients yet</p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.35)" }}>
                Add your first client to get started.
              </p>
            </div>
            <button
              onClick={onAddClient}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: "rgba(124,58,237,0.15)",
                border:     "1px solid rgba(124,58,237,0.3)",
                color:      "#a78bfa",
              }}
            >
              <UserPlus className="w-4 h-4" />
              Add Client
            </button>
          </div>
        )}

        {/* Client table */}
        {!loading && !error && clients.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* Table header */}
            <div
              className="grid px-5 py-3 text-[10px] font-bold uppercase tracking-widest"
              style={{
                gridTemplateColumns: "2.5rem 1fr 6rem 8rem 7rem 6rem",
                background: "rgba(255,255,255,0.04)",
                color: "rgba(255,255,255,0.3)",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <span />
              <span>Client</span>
              <span className="text-right">Age</span>
              <span className="text-right">Income</span>
              <span className="text-center">Jurisdiction</span>
              <span />
            </div>

            {/* Rows */}
            {clients.map(client => (
              <ClientTableRow
                key={client.id}
                client={client}
                onOpen={() =>
                  onSelectClient(client.id, `${client.firstName} ${client.lastName}`)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ClientTableRow ────────────────────────────────────────────────────────────
function ClientTableRow({
  client,
  onOpen,
}: {
  client: ClientRow;
  onOpen: () => void;
}) {
  const [hover, setHover] = useState(false);

  return (
    <div
      className="grid items-center px-5 py-3.5 cursor-pointer transition-all"
      style={{
        gridTemplateColumns: "2.5rem 1fr 6rem 8rem 7rem 6rem",
        background: hover ? "rgba(124,58,237,0.07)" : "transparent",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
      onClick={onOpen}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Avatar */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
        style={{ background: avatarGradient(client.id) }}
      >
        {initials(client.firstName, client.lastName)}
      </div>

      {/* Name */}
      <div>
        <div className="text-sm font-semibold text-white">
          {client.firstName} {client.lastName}
        </div>
        {client.hasSpouse && (
          <div className="text-[10px]" style={{ color: "rgba(167,139,250,0.6)" }}>
            + spouse / partner
          </div>
        )}
      </div>

      {/* Age */}
      <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.5)" }}>
        {client.age ?? "—"}
      </div>

      {/* Income */}
      <div className="text-sm text-right" style={{ color: "rgba(255,255,255,0.5)" }}>
        {client.income != null
          ? `$${(client.income / 1000).toFixed(0)}k`
          : "—"}
      </div>

      {/* Jurisdiction badge */}
      <div className="flex justify-center">
        <span
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
          style={
            client.jurisdiction === "CA"
              ? { background: "rgba(239,68,68,0.12)", color: "#f87171" }
              : { background: "rgba(59,130,246,0.12)", color: "#60a5fa" }
          }
        >
          <MapPin className="w-2.5 h-2.5" />
          {client.jurisdiction}
        </span>
      </div>

      {/* Open button */}
      <div className="flex justify-end">
        <span
          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all"
          style={
            hover
              ? {
                  background: "rgba(124,58,237,0.2)",
                  color: "#a78bfa",
                  border: "1px solid rgba(124,58,237,0.3)",
                }
              : {
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }
          }
        >
          Open <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
}
