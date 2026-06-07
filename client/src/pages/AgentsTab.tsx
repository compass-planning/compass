/**
 * AgentsTab.tsx
 * Merged Agent Management + Agents list.
 * - GA can create/edit/delete agents directly from this tab
 * - Jurisdiction (CA/US) set at creation, locked forever
 * - Province (CA) / State (US) mandatory on create and edit
 */

import { useState, useEffect } from "react";
import { api } from "../lib/api";
import {
  ChevronRight, Users, User, FileText,
  Plus, Pencil, Trash2, X, Eye, EyeOff, MapPin,
} from "lucide-react";
import { initials, avatarBg } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FaUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  agentId: string | null;
  agency: string | null;
  phone: string | null;
  level: "standard" | "enhanced";
  role: string;
  jurisdiction: "CA" | "US";
  address: string | null;
  city: string | null;
  province: string | null;
  usState: string | null;
  postalCode: string | null;
  createdAt?: string;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  province: string | null;
  annualIncome: string | null;
  jurisdiction?: string;
}

interface Plan {
  id: number;
  name: string;
  status: string;
  createdAt: string;
}

type View = "agents" | "clients" | "plans";

const INPUT = "w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 outline-none transition";
const INPUT_ERR = "w-full px-3 py-2.5 rounded-xl border border-red-300 text-sm focus:ring-2 focus:ring-red-400/30 focus:border-red-400 outline-none transition";

const CA_PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];
const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY",
];

const EMPTY_FORM = {
  firstName: "", lastName: "", email: "", password: "",
  agentId: "", agency: "", phone: "",
  level: "standard" as "standard" | "enhanced",
  jurisdiction: "CA" as "CA" | "US",
  address: "", city: "", province: "", usState: "", postalCode: "",
};

// ── Jurisdiction badge ────────────────────────────────────────────────────────

function JurisdictionBadge({ jurisdiction }: { jurisdiction?: string }) {
  if (!jurisdiction) return null;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
      jurisdiction === "US"
        ? "bg-blue-100 text-blue-700"
        : "bg-red-100 text-red-700"
    }`}>
      {jurisdiction === "US" ? "🇺🇸 US" : "🇨🇦 CA"}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AgentsTab({ onSelectClient }: { onSelectClient?: (clientId: number, planId: number | null) => void }) {
  const [view, setView]                   = useState<View>("agents");
  const [agents, setAgents]               = useState<FaUser[]>([]);
  const [clients, setClients]             = useState<Client[]>([]);
  const [plans, setPlans]                 = useState<Plan[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<FaUser | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading]             = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]     = useState<number | null>(null);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [showPw, setShowPw]     = useState(false);

  // Derived: which region list + labels to show
  const isUS = form.jurisdiction === "US";
  const regionLabel  = isUS ? "State" : "Province";
  const regionList   = isUS ? US_STATES : CA_PROVINCES;
  const regionValue  = isUS ? form.usState : form.province;
  const postalLabel  = isUS ? "ZIP Code" : "Postal Code";
  const postalPlaceholder = isUS ? "e.g. 06510" : "e.g. K1A 0A6";

  const loadAgents = () => {
    setLoading(true);
    api.get<FaUser[]>("/api/auth/users").then(setAgents).finally(() => setLoading(false));
  };

  useEffect(() => { loadAgents(); }, []);

  const u = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Validation
  const regionMissing = isUS ? !form.usState : !form.province;
  // Province/State mandatory for NEW agents only — existing agents may pre-date address fields
  const canSubmit = !busy && !!form.firstName && !!form.lastName &&
    (editId ? true : (!!form.email && !!form.password && !regionMissing));

  // ── Navigation ──────────────────────────────────────────────────────────────

  function selectAgent(agent: FaUser) {
    setSelectedAgent(agent);
    setLoading(true);
    api.get<Client[]>(`/api/clients?agentId=${agent.id}`)
      .then(setClients)
      .finally(() => setLoading(false));
    setView("clients");
  }

  function selectClient(client: Client) {
    setSelectedClient(client);
    setLoading(true);
    api.get<Plan[]>(`/api/clients/${client.id}/plans`)
      .then(setPlans)
      .finally(() => setLoading(false));
    setView("plans");
  }

  function backToAgents() {
    setView("agents"); setSelectedAgent(null); setClients([]);
  }

  function backToClients() {
    setView("clients"); setSelectedClient(null); setPlans([]);
  }

  // ── Agent CRUD ──────────────────────────────────────────────────────────────

  function openCreate() {
    setForm({ ...EMPTY_FORM });
    setEditId(null); setError(""); setShowForm(true);
  }

  function openEdit(fa: FaUser) {
    setForm({
      firstName:    fa.firstName,
      lastName:     fa.lastName,
      email:        fa.email,
      password:     "",
      agentId:      fa.agentId ?? "",
      agency:       fa.agency ?? "",
      phone:        fa.phone ?? "",
      level:        fa.level,
      jurisdiction: fa.jurisdiction ?? "CA",
      address:      fa.address ?? "",
      city:         fa.city ?? "",
      province:     fa.province ?? "",
      usState:      fa.usState ?? "",
      postalCode:   fa.postalCode ?? "",
    });
    setEditId(fa.id); setError(""); setShowForm(true);
  }

  async function handleSubmit() {
    setError(""); setBusy(true);
    try {
      if (editId) {
        const body: any = {
          firstName:  form.firstName  || undefined,
          lastName:   form.lastName   || undefined,
          agentId:    form.agentId    || undefined,
          agency:     form.agency     || undefined,
          phone:      form.phone      || undefined,
          level:      form.level,
          address:    form.address    || undefined,
          city:       form.city       || undefined,
          province:   form.jurisdiction === "CA" ? (form.province   || undefined) : undefined,
          usState:    form.jurisdiction === "US" ? (form.usState    || undefined) : undefined,
          postalCode: form.postalCode  || undefined,
        };
        if (form.password) body.password = form.password;
        await api.patch(`/api/auth/users/${editId}`, body);
      } else {
        await api.post("/api/auth/users", {
          ...form,
          province: form.jurisdiction === "CA" ? form.province : undefined,
          usState:  form.jurisdiction === "US" ? form.usState  : undefined,
        });
      }
      setShowForm(false);
      loadAgents();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete ${name}? Their clients will remain but become unassigned.`)) return;
    await api.delete(`/api/auth/users/${id}`);
    loadAgents();
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  function agentLocation(fa: FaUser): string {
    const parts: string[] = [];
    if (fa.city) parts.push(fa.city);
    if (fa.jurisdiction === "CA" && fa.province) parts.push(fa.province);
    if (fa.jurisdiction === "US" && fa.usState) parts.push(fa.usState);
    return parts.join(", ") || "—";
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
        <button onClick={backToAgents} className={view === "agents" ? "font-bold text-gray-900" : "hover:text-gray-600"}>
          Agents
        </button>
        {selectedAgent && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <button onClick={backToClients} className={view === "clients" ? "font-bold text-gray-900" : "hover:text-gray-600"}>
              {selectedAgent.firstName} {selectedAgent.lastName}
            </button>
          </>
        )}
        {selectedClient && (
          <>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-bold text-gray-900">
              {selectedClient.firstName} {selectedClient.lastName}
            </span>
          </>
        )}
      </div>

      {/* ── Agents list ── */}
      {view === "agents" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Field Agents</h1>
              <p className="text-sm text-gray-400 mt-0.5">{agents.length} agent{agents.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <Plus className="w-4 h-4" /> Add Agent
            </button>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <User className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No field agents yet</p>
              <button onClick={openCreate} className="mt-3 text-blue-600 text-sm hover:underline font-semibold">
                Create your first agent
              </button>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Agent ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Agency</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Level</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">Jurisdiction</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {agents.map(fa => (
                    <tr key={fa.id} className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => selectAgent(fa)}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full ${avatarBg(fa.firstName + fa.lastName)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                            {initials(fa.firstName, fa.lastName)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{fa.firstName} {fa.lastName}</p>
                            <p className="text-xs text-gray-400">{fa.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{fa.agentId || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{fa.agency || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                          <MapPin className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          {agentLocation(fa)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                          fa.level === "enhanced" ? "bg-cyan-100 text-cyan-700" : "bg-gray-100 text-gray-600"
                        }`}>
                          {fa.level === "enhanced" ? "Enhanced" : "Standard"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <JurisdictionBadge jurisdiction={fa.jurisdiction} />
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(fa)}
                            className="p-1.5 text-gray-400 hover:text-[#0c1e3a] transition-colors">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(fa.id, `${fa.firstName} ${fa.lastName}`)}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Clients list ── */}
      {view === "clients" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {selectedAgent?.firstName}{"'s Clients"}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm text-gray-400">{clients.length} client{clients.length !== 1 ? "s" : ""}</span>
                {selectedAgent?.jurisdiction && <JurisdictionBadge jurisdiction={selectedAgent.jurisdiction} />}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : clients.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No clients yet</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {clients.map((client, i) => (
                <button key={client.id} onClick={() => selectClient(client)}
                  className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarBg(client.firstName + client.lastName)} flex items-center justify-center text-white text-sm font-bold`}>
                      {initials(client.firstName, client.lastName)}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{client.firstName} {client.lastName}</p>
                      <p className="text-xs text-gray-400">
                        {client.email ?? ""}
                        {client.province ? ` · ${client.province}` : ""}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Plans list ── */}
      {view === "plans" && (
        <>
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {selectedClient?.lastName}{"'s Plans"}
            </h1>
            <span className="text-sm text-gray-400">{plans.length} plan{plans.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="text-center py-16 text-gray-400">Loading…</div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
              <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-semibold">No plans yet</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {plans.map((plan, i) => (
                <button key={plan.id} onClick={() => onSelectClient?.(selectedClient!.id, plan.id)}
                  className={`w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors text-left ${i > 0 ? "border-t border-gray-100" : ""}`}>
                  <div>
                    <p className="font-semibold text-gray-900">{plan.name}</p>
                    <p className="text-xs text-gray-400">{new Date(plan.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      plan.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {plan.status}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Create / Edit modal ── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex-shrink-0 flex justify-between items-center px-6 pt-6 pb-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">
                {editId ? "Edit Agent" : "New Field Agent"}
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="px-4 py-1.5 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  {busy ? "Saving…" : editId ? "Save Changes" : "Create Agent"}
                </button>
                <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 ml-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

              {/* Name */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">First Name</label>
                  <input value={form.firstName} onChange={e => u("firstName", e.target.value)}
                    className={INPUT} placeholder="First name" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Last Name</label>
                  <input value={form.lastName} onChange={e => u("lastName", e.target.value)}
                    className={INPUT} placeholder="Last name" />
                </div>
              </div>

              {/* Email — create only */}
              {!editId && (
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Email (Login)</label>
                  <input type="email" value={form.email} onChange={e => u("email", e.target.value)}
                    className={INPUT} placeholder="agent@example.com" />
                </div>
              )}

              {/* Password */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {editId ? "New Password (leave blank to keep current)" : "Temporary Password"}
                </label>
                <div className="relative">
                  <input type={showPw ? "text" : "password"} value={form.password}
                    onChange={e => u("password", e.target.value)}
                    className={INPUT + " pr-11"}
                    placeholder={editId ? "Leave blank to keep current" : "Min 12 characters"} />
                  <button type="button" onClick={() => setShowPw(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {!editId && <p className="text-xs text-gray-400 mt-1">Min 12 characters. Agent will be prompted to reset on first login.</p>}
              </div>

              {/* Agent ID + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Agent ID</label>
                  <input value={form.agentId} onChange={e => u("agentId", e.target.value)}
                    className={INPUT} placeholder="Optional" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Phone</label>
                  <input value={form.phone} onChange={e => u("phone", e.target.value)}
                    className={INPUT} placeholder="Optional" />
                </div>
              </div>

              {/* Agency */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Agency</label>
                <input value={form.agency} onChange={e => u("agency", e.target.value)}
                  className={INPUT} placeholder="Optional" />
              </div>

              {/* ── Address section ─────────────────────────────────────────── */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center gap-1.5 mb-3">
                  <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Address</span>
                </div>

                {/* Street address */}
                <div className="mb-3">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">Street Address</label>
                  <input value={form.address} onChange={e => u("address", e.target.value)}
                    className={INPUT} placeholder="e.g. 123 Main St" />
                </div>

                {/* City + Province/State */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">City</label>
                    <input value={form.city} onChange={e => u("city", e.target.value)}
                      className={INPUT} placeholder="City" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 mb-1 block">
                      {regionLabel}
                      <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <select
                      value={regionValue}
                      onChange={e => u(isUS ? "usState" : "province", e.target.value)}
                      className={regionMissing ? INPUT_ERR : INPUT}
                    >
                      <option value="">— Select {regionLabel} —</option>
                      {regionList.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    {regionMissing && (
                      <p className="text-xs text-red-500 mt-0.5">{regionLabel} is required</p>
                    )}
                  </div>
                </div>

                {/* Postal / ZIP */}
                <div className="w-1/2">
                  <label className="text-xs font-semibold text-gray-500 mb-1 block">{postalLabel}</label>
                  <input value={form.postalCode} onChange={e => u("postalCode", e.target.value)}
                    className={INPUT} placeholder={postalPlaceholder} />
                </div>
              </div>

              {/* Access Level */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">Access Level</label>
                <select value={form.level} onChange={e => u("level", e.target.value)} className={INPUT}>
                  <option value="standard">Standard — Clients, Policies, FNA</option>
                  <option value="enhanced">Enhanced — All Modules</option>
                </select>
              </div>

              {/* Jurisdiction — create only, locked on edit */}
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  Planning Jurisdiction
                  {editId && <span className="ml-2 text-gray-400 font-normal">(locked after creation)</span>}
                </label>
                {editId ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm">
                    <JurisdictionBadge jurisdiction={form.jurisdiction} />
                    <span className="text-gray-500">
                      {form.jurisdiction === "US" ? "United States — 401(k), IRA, Social Security" : "Canada — RRSP, TFSA, CPP/OAS"}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: "CA", flag: "🇨🇦", label: "Canada", sub: "RRSP · TFSA · CPP/OAS" },
                      { value: "US", flag: "🇺🇸", label: "United States", sub: "401(k) · IRA · Social Security" },
                    ].map(opt => (
                      <button key={opt.value} type="button"
                        onClick={() => {
                          u("jurisdiction", opt.value);
                          // Clear region when switching jurisdiction
                          setForm(f => ({ ...f, jurisdiction: opt.value as "CA" | "US", province: "", usState: "" }));
                        }}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          form.jurisdiction === opt.value
                            ? "border-[#0c1e3a] bg-[#0c1e3a]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}>
                        <span className="text-xl mt-0.5">{opt.flag}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{opt.sub}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            </div>

            <div className="flex-shrink-0 flex justify-end px-6 pb-4 pt-3 border-t border-gray-100">
              <button onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-gray-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
