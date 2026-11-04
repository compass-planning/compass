import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/hooks/useT";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useStaffMembers, useCurrentStaff, useCreateStaffMember, useUpdateStaffMember, useDeleteStaffMember, useAdvisorAssignments, useAdvisorsByAdmin, useCreateAdvisorAssignment, useDeleteAdvisorAssignment } from "@/hooks/use-users";
import { useStaffDocuments, useCreateStaffDocument, useDeleteStaffDocument } from "@/hooks/use-staff-documents";
import { Plus, Search, Shield, ShieldCheck, Crown, Trash2, Edit, X, Users as UsersIcon, TrendingUp, ShieldAlert, FileText, Phone, Mail, MapPin, AlertTriangle, Link2, Eye, EyeOff, ChevronRight, Briefcase, Heart, Baby, Save, DollarSign, Target, Calendar, Clock, KeyRound, ShieldOff, Building2 } from "lucide-react";
import { format } from "date-fns";
import type { StaffMember, AdvisorAssignment, Client, StaffChild, Lead } from "@shared/schema";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function getRoleLabels(isFr: boolean): Record<string, string> {
  return isFr ? {
    general_manager: "Directeur général",
    office_admin: "Admin bureau",
    sales_manager: "Directeur des ventes",
    advisor_admin: "Admin conseiller",
    advisor: "Conseiller",
  } : {
    general_manager: "General Manager",
    office_admin: "Office Admin",
    sales_manager: "Sales Manager",
    advisor_admin: "Advisor Admin",
    advisor: "Advisor",
  };
}

const roleDescriptions: Record<string, string> = {
  general_manager: "Oversees all users. Can assign roles, manage team structure, and see all data across the organization.",
  office_admin: "Manages team members. Can see, edit, and add team members. Can view clients but not portfolios.",
  sales_manager: "Views their assigned team's clients and data. Has read access to their team's portfolios and meetings.",
  advisor_admin: "Manages assigned advisors. Can view and manage data for advisors assigned to them.",
  advisor: "Individual advisor. Can only see and manage their own clients and data.",
};

const roleIcons: Record<string, typeof Crown> = {
  general_manager: Crown,
  office_admin: UsersIcon,
  sales_manager: TrendingUp,
  advisor_admin: ShieldCheck,
  advisor: Shield,
};

const roleColors: Record<string, string> = {
  general_manager: "bg-amber-100 text-amber-700 border-amber-200",
  office_admin: "bg-rose-100 text-rose-700 border-rose-200",
  sales_manager: "bg-purple-100 text-purple-700 border-purple-200",
  advisor_admin: "bg-violet-100 text-violet-700 border-violet-200",
  advisor: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const maritalLabels: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
  common_law: "Common Law",
  separated: "Separated",
};

const staffDocTypeLabels: Record<string, string> = {
  id_document: "ID Document",
  contract: "Contract",
  certification: "Certification",
  license: "License",
  tax_form: "Tax Form",
  performance_review: "Performance Review",
  other: "Other",
};

const allRoles = ["general_manager", "office_admin", "sales_manager", "advisor_admin", "advisor"] as const;
const managerRoles = ["advisor_admin", "sales_manager"];

interface DashboardStats {
  totalAUM: number;
  activeClients: number;
  leadsCount: number;
  pendingSales: number;
}

function useDashboardStats(staffId?: number | null) {
  const url = staffId ? `/api/crm/dashboard/stats?staffId=${staffId}` : '/api/crm/dashboard/stats';
  return useQuery<DashboardStats>({
    queryKey: ['/api/crm/dashboard/stats', staffId ?? 'all'],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
  });
}

function useStaffChildren(staffId: number) {
  return useQuery<StaffChild[]>({
    queryKey: ['/api/crm/staff', staffId, 'children'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${staffId}/children`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch children");
      return res.json();
    },
    enabled: !!staffId,
  });
}

const teamAllowedRoles = ["general_manager", "office_admin", "sales_manager", "advisor_admin"];


function AdvisorClientCount({ advisorId }: { advisorId: number }) {
  const { data: clients } = useQuery({
    queryKey: ["/api/crm/clients", advisorId],
    queryFn: async () => {
      const r = await fetch(`/api/crm/clients?advisorId=${advisorId}`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60000,
  });
  const count = Array.isArray(clients) ? clients.length : 0;
  return (
    <span className="text-sm font-bold font-mono" style={{ color: count > 0 ? "var(--accent-blue)" : "var(--text-tertiary)" }}>
      {count > 0 ? count : "—"}
    </span>
  );
}

export default function UserManagement() {
  const { data: currentStaff, isLoading } = useCurrentStaff();
  const role = currentStaff?.role;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AppLayout>
    );
  }

  if (role && !teamAllowedRoles.includes(role)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center" data-testid="team-access-denied">
          <div className="p-4 rounded-2xl bg-destructive/10 mb-4">
            <ShieldOff className="w-12 h-12 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 text-foreground">Access Restricted</h2>
          <p className="text-slate-500 mt-2 max-w-md">
            You don't have permission to view the Team page. Please contact your manager if you believe this is an error.
          </p>
        </div>
      </AppLayout>
    );
  }

  if (role === "sales_manager" || role === "advisor_admin") {
    if (!currentStaff) return null;
    return <ManagerTeamView currentStaff={currentStaff} />;
  }

  return <GMTeamView currentRole={role} />;
}

function ManagerTeamView({ currentStaff }: { currentStaff: StaffMember }) {
  const { data: teamAdvisors, isLoading } = useAdvisorsByAdmin(currentStaff.id);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);

  return (
    <AppLayout>
      <div className="fp-insightled" style={{ minHeight: "100%", padding: "2rem" }}>
        <div>
          <h1 className="text-lg font-bold text-slate-900" data-testid="text-page-title">My Team</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {teamAdvisors?.length ?? 0} advisor{(teamAdvisors?.length ?? 0) !== 1 ? "s" : ""} assigned to your team.
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-56 bg-white border border-slate-200 rounded-xl" />)}
          </div>
        ) : !teamAdvisors || teamAdvisors.length === 0 ? (
          <div className="text-center py-16 bg-white border border-slate-200 rounded-xl border-dashed">
            <UsersIcon className="w-14 h-14 mx-auto text-slate-500/20 mb-3" />
            <h3 className="text-lg font-bold">No Team Members</h3>
            <p className="text-sm text-slate-500 mt-0.5">No advisors are currently assigned to your team.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamAdvisors.map(advisor => (
              <SMTeamMemberCard
                key={advisor.id}
                advisor={advisor}
                onViewProfile={() => setSelectedMember(advisor)}
              />
            ))}
          </div>
        )}
      </div>

      {selectedMember && (
        <StaffProfileModal member={selectedMember} onClose={() => setSelectedMember(null)} isGM={false} />
      )}
    </AppLayout>
  );
}

function SMTeamMemberCard({ advisor, onViewProfile }: { advisor: StaffMember; onViewProfile: () => void }) {
  const { data: advisorClients, isLoading } = useQuery<Client[]>({
    queryKey: ["/api/crm/staff", advisor.id, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${advisor.id}/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });
  const clientCount = advisorClients?.length ?? 0;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 group" data-testid={`card-sm-team-member-${advisor.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm">
          {advisor.firstName[0]}{advisor.lastName[0]}
        </div>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          <Shield className="w-3 h-3" />
          Advisor
        </span>
      </div>

      <h3 className="text-base font-bold text-slate-900" data-testid={`text-sm-advisor-name-${advisor.id}`}>
        {advisor.firstName} {advisor.lastName}
      </h3>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center text-sm text-slate-500">
          <Mail className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">{advisor.email}</span>
        </div>
        {advisor.phone && (
          <div className="flex items-center text-sm text-slate-500">
            <Phone className="w-4 h-4 mr-2 flex-shrink-0" />
            {advisor.phone}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        {isLoading ? (
          <div className="h-4 bg-muted rounded animate-pulse w-24" />
        ) : (
          <div className="flex items-center gap-2 text-sm">
            <Briefcase className="w-4 h-4 text-slate-500" />
            <span className="font-semibold" data-testid={`text-sm-client-count-${advisor.id}`}>
              {clientCount} client{clientCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          href={`/clients?advisorId=${advisor.id}`}
          data-testid={`button-view-clients-${advisor.id}`}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Eye className="w-4 h-4" />
          View Clients
        </Link>
        <button
          onClick={onViewProfile}
          data-testid={`button-view-profile-${advisor.id}`}
          className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
        >
          Profile
        </button>
      </div>
    </div>
  );
}

function GMTeamView({ _currentRole, currentRole }: { currentRole?: string }) {
  const { data: members, isLoading } = useStaffMembers();
  const { data: currentStaff } = useCurrentStaff();
  const { data: _assignments } = useAdvisorAssignments();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [_editingMember, setEditingMember] = useState<StaffMember | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);
  const [_isDetailEditing, setIsDetailEditing] = useState(false);
  const [, _setLocation] = useLocation();
  const { isFr } = useT();

  const isGM = currentStaff?.role === "general_manager";
  const canManageTeam = isGM || currentStaff?.role === "office_admin";
  const _isSM = currentStaff?.role === "sales_manager";

  const selectedMember = selectedStaffId ? members?.find(s => s.id === selectedStaffId) ?? null : null;
  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedStaffId);

  const formatAUM = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const filteredMembers = members?.filter(u => {
    const matchesSearch = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const roleColors: Record<string,string> = {
    general_manager: "bg-purple-50 text-purple-700 border-purple-200",
    sales_manager: "bg-violet-50 text-violet-700 border-violet-200",
    office_admin: "bg-slate-50 text-slate-700 border-slate-200",
    advisor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    advisor_admin: "bg-teal-50 text-teal-700 border-teal-200",
    field_agent: "bg-amber-50 text-amber-700 border-amber-200",
  };
  const roleLabels: Record<string,string> = {
    general_manager:"General Manager", sales_manager:"Sales Manager",
    office_admin:"Office Admin", advisor:"Advisor", advisor_admin:"Advisor Admin", field_agent:"Field Agent",
  };

  return (
    <AppLayout>
      <div className="fp-insightled" style={{ height: "100%", display: "flex", flexDirection: "column" }}>

        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between bg-white/90 backdrop-blur" style={{ borderColor: "var(--border-subtle)" }}>
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Infrastructure conseils" : "Advisory Infrastructure"}</p>
              <h1 className="text-xl font-bold tracking-tight" style={{ color: "var(--text-primary)" }}>{isFr ? "Centre des opérations" : "Advisory Operations Center"}</h1>
            </div>
            <div className="hidden lg:flex items-center gap-4">
              <div className="text-center">
                <p className="text-lg font-bold font-mono" style={{ color: "var(--accent-blue)" }}>
                  {statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0)}
                </p>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Actif géré" : "Total AUM"}</p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "var(--border-subtle)" }} />
              <div className="text-center">
                <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {statsLoading ? "—" : stats?.activeClients ?? 0}
                </p>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Ménages" : "Households"}</p>
              </div>
              <div className="w-px h-8" style={{ backgroundColor: "var(--border-subtle)" }} />
              <div className="text-center">
                <p className="text-lg font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  {filteredMembers?.length ?? 0}
                </p>
                <p className="text-[9px] uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Conseillers" : "Advisors"}</p>
              </div>
            </div>
          </div>
          {canManageTeam && (
            <button onClick={() => setIsAddOpen(true)} data-testid="button-add-user"
              className="px-4 py-2 rounded-lg bg-brand-gradient text-white text-sm font-semibold shadow-sm hover:opacity-90 transition-all">
              {isFr ? "+ Ajouter conseiller" : "+ Add Advisor"}
            </button>
          )}
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Main advisor table */}
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Filters */}
            <div className="px-6 py-2.5 flex items-center gap-2 border-b" style={{ borderColor: "var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>
              <div className="relative flex-1 max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--text-tertiary)" }} />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder={isFr ? "Rechercher des conseillers..." : "Search advisors..."} data-testid="input-search-team"
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-white focus:outline-none focus:border-violet-400"
                  style={{ borderColor: "var(--border-light)" }} />
              </div>
              <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-lg border bg-white focus:outline-none" style={{ borderColor: "var(--border-light)" }}>
                <option value="all">{isFr ? "Tous les rôles" : "All Roles"}</option>
                {Object.entries(roleLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full">
                <thead style={{ backgroundColor: "var(--bg-soft)", borderBottom: "1px solid var(--border-subtle)" }}>
                  <tr>
                    <th className="text-left pl-6 pr-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Conseiller" : "Advisor"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Rôle" : "Role"}</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Contact" : "Contact"}</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Clients" : "Clients"}</th>
                    <th className="text-right pl-3 pr-6 py-2.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Actions" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({length:5}).map((_,i) => (
                      <tr key={i} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        {Array.from({length:5}).map((_,j) => (
                          <td key={j} className="px-3 py-4"><div className="h-4 rounded animate-pulse" style={{ backgroundColor: "var(--bg-soft)" }} /></td>
                        ))}
                      </tr>
                    ))
                  ) : (filteredMembers?.length ?? 0) === 0 ? (
                    <tr><td colSpan={5} className="py-16 text-center" style={{ color: "var(--text-tertiary)" }}>
                      <UsersIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm font-semibold">No team members found</p>
                    </td></tr>
                  ) : filteredMembers?.map(member => {
                    const rc = roleColors[member.role] || "bg-slate-50 text-slate-700 border-slate-200";
                    const rl = getRoleLabels(isFr)[member.role] || member.role;
                    return (
                      <tr key={member.id} data-testid={`row-team-member-${member.id}`}
                        className="cursor-pointer transition-colors"
                        style={{ borderBottom: "1px solid var(--border-subtle)" }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = "var(--bg-soft)")}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = "transparent")}
                        onClick={() => { setSelectedStaffId(member.id); setIsDetailEditing(false); }}>
                        {/* Name */}
                        <td className="pl-6 pr-3 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                              style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))" }}>
                              {member.firstName[0]}{member.lastName[0]}
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}
                                data-testid={`text-member-name-${member.id}`}>{member.firstName} {member.lastName}</p>
                              {member.title && <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{member.title}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Role */}
                        <td className="px-3 py-3.5">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${rc}`}>{rl}</span>
                        </td>
                        {/* Contact */}
                        <td className="px-3 py-3.5">
                          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{member.email}</p>
                          {member.phone && <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{member.phone}</p>}
                        </td>
                        {/* Client count */}
                        <td className="px-3 py-3.5 text-right">
                          <AdvisorClientCount advisorId={member.id} />
                        </td>
                        {/* Actions */}
                        <td className="pl-3 pr-6 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canManageTeam && (
                              <>
                                <button data-testid={`button-edit-member-${member.id}`}
                                  onClick={e => { e.stopPropagation(); setEditingMember(member); }}
                                  className="p-1.5 rounded-lg transition-colors hover:bg-violet-50"
                                  style={{ color: "var(--text-tertiary)" }}><Edit className="w-3.5 h-3.5" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Intelligence rail */}
          <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto" style={{ borderLeft: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-soft)" }}>

            {/* Book overview */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Aperçu du portefeuille" : "Book Overview"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: isFr ? "Actif géré" : "Total AUM",    value: statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0),      color: "var(--accent-blue)" },
                  { label: isFr ? "Ménages" : "Households",      value: statsLoading ? "—" : String(stats?.activeClients ?? 0),    color: "var(--text-primary)" },
                  { label: isFr ? "En pipeline" : "In Pipeline", value: statsLoading ? "—" : String(stats?.leadsCount ?? 0),       color: "var(--accent-amber)" },
                  { label: isFr ? "Taille équipe" : "Team Size", value: String(filteredMembers?.length ?? 0),                       color: "var(--text-primary)" },
                ].map(s => (
                  <div key={s.label} className="fp-insightled-card p-2.5">
                    <p className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
                    <p className="text-base font-bold font-mono" style={{ color: s.color }}>{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Role distribution */}
            <div className="p-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Distribution des rôles" : "Role Distribution"}</p>
              {Object.entries(roleLabels).map(([role, label]) => {
                const count = members?.filter(m => m.role === role).length ?? 0;
                if (count === 0) return null;
                return (
                  <div key={role} className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: "var(--border-subtle)" }}>
                    <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Selected advisor detail */}
            {selectedMember && (
              <div className="p-4">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Conseiller sélectionné" : "Selected Advisor"}</p>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))" }}>
                    {selectedMember.firstName[0]}{selectedMember.lastName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>{selectedMember.firstName} {selectedMember.lastName}</p>
                    <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{getRoleLabels(isFr)[selectedMember.role]}</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Actif géré" : "AUM"}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                      {statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>{isFr ? "Clients" : "Clients"}</span>
                    <span className="text-[10px] font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                      {statsLoading ? "—" : stats?.activeClients ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {isAddOpen && (
        <AddStaffModal
          onClose={() => setIsAddOpen(false)}
          callerRole={currentStaff?.role}
        />
      )}
      {selectedMember && (
        <StaffProfileModal
          member={selectedMember}
          onClose={() => setSelectedStaffId(null)}
          isGM={isGM}
          callerRole={currentStaff?.role}
        />
      )}
    </AppLayout>
  );
}

function _ClickableStatCard({ title, value, icon: Icon, color, onClick, testId }: {
  title: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow duration-150 text-left cursor-pointer group w-full"
    >
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-lg ${color} group-hover:scale-110 transition-transform`}>
          <Icon className="w-6 h-6" />
        </div>
        <ChevronRight className="w-5 h-5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <p className="text-slate-500 font-medium">{title}</p>
      <h3 className="text-xl font-bold text-slate-900 font-mono">{value}</h3>
    </button>
  );
}

function _TeamMemberDetail({ member, allMembers, assignments, isEditing, canEdit, canResetPassword, onToggleEdit, onEditDone }: {
  member: StaffMember;
  allMembers: StaffMember[];
  assignments: AdvisorAssignment[];
  isEditing: boolean;
  canEdit: boolean;
  canResetPassword: boolean;
  onToggleEdit: () => void;
  onEditDone: () => void;
}) {
  const { data: staffKids = [] } = useStaffChildren(member.id);
  const updateStaff = useUpdateStaffMember();
  const { isFr } = useT();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showSetPassword, setShowSetPassword] = useState(false);

  const [formData, setFormData] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    personalEmail: member.personalEmail || "",
    phone: member.phone || "",
    address: member.address || "",
    role: member.role,
    maritalStatus: member.maritalStatus || "",
    spouseName: member.spouseName || "",
    spousePhone: member.spousePhone || "",
    spouseEmail: member.spouseEmail || "",
    spouseBirthday: member.spouseBirthday || "",
    anniversary: member.anniversary || "",
    contractDate: member.contractDate || "",
    emergencyContactName: member.emergencyContactName || "",
    emergencyContactPhone: member.emergencyContactPhone || "",
    emergencyContactRelation: member.emergencyContactRelation || "",
    sellsMutualFunds: member.sellsMutualFunds ?? false,
  });

  useEffect(() => {
    setFormData({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email,
      personalEmail: member.personalEmail || "",
      phone: member.phone || "",
      address: member.address || "",
      role: member.role,
      maritalStatus: member.maritalStatus || "",
      spouseName: member.spouseName || "",
      spousePhone: member.spousePhone || "",
      spouseEmail: member.spouseEmail || "",
      spouseBirthday: member.spouseBirthday || "",
      anniversary: member.anniversary || "",
      contractDate: member.contractDate || "",
      emergencyContactName: member.emergencyContactName || "",
      emergencyContactPhone: member.emergencyContactPhone || "",
      emergencyContactRelation: member.emergencyContactRelation || "",
      sellsMutualFunds: member.sellsMutualFunds ?? false,
    });
  }, [member.id, member.firstName, member.lastName, member.email, member.personalEmail, member.phone, member.address, member.role, member.maritalStatus, member.spouseName, member.spousePhone, member.spouseEmail, member.spouseBirthday, member.anniversary, member.contractDate, member.emergencyContactName, member.emergencyContactPhone, member.emergencyContactRelation, member.sellsMutualFunds]);

  const handleSave = () => {
    updateStaff.mutate({ id: member.id, ...formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/staff'] });
        queryClient.invalidateQueries({ queryKey: ['/api/crm/staff/me'] });
        toast({ title: "Saved", description: "Team member updated successfully." });
        onEditDone();
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to save changes. Please try again.", variant: "destructive" });
      }
    });
  };

  const RoleIcon = roleIcons[member.role] || Shield;

  return (
    <>
    {showSetPassword && <SetPasswordModal staffId={member.id} staffName={`${member.firstName} ${member.lastName}`} onClose={() => setShowSetPassword(false)} />}
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-6" data-testid="team-member-detail">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm">
            {member.firstName[0]}{member.lastName[0]}
          </div>
          <div>
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  value={formData.firstName}
                  onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                  data-testid="input-edit-firstName"
                  className="px-3 py-1.5 border border-border rounded-lg text-lg font-bold w-32 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  value={formData.lastName}
                  onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                  data-testid="input-edit-lastName"
                  className="px-3 py-1.5 border border-border rounded-lg text-lg font-bold w-32 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            ) : (
              <h2 className="text-lg font-bold text-slate-900" data-testid="text-member-name">
                {member.firstName} {member.lastName}
              </h2>
            )}
            <div className="flex items-center gap-2 mt-1">
              {isEditing ? (
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  data-testid="select-edit-role"
                  className="px-3 py-1 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {allRoles.map(r => (
                    <option key={r} value={r}>{getRoleLabels(isFr)[r]}</option>
                  ))}
                </select>
              ) : (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${roleColors[member.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>
                  <RoleIcon className="w-3.5 h-3.5" />
                  {getRoleLabels(isFr)[member.role] || member.role}
                </span>
              )}
              {["advisor", "advisor_admin", "sales_manager"].includes(isEditing ? formData.role : member.role) && (
                isEditing ? (
                  <label className="flex items-center gap-1.5 cursor-pointer ml-2" data-testid="checkbox-edit-sells-mutual-funds">
                    <input
                      type="checkbox"
                      checked={formData.sellsMutualFunds}
                      onChange={e => setFormData({ ...formData, sellsMutualFunds: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs font-medium text-slate-500">Sells Mutual Funds</span>
                  </label>
                ) : member.sellsMutualFunds ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200" data-testid="badge-sells-mutual-funds">
                    <Building2 className="w-3 h-3" />
                    Mutual Funds
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={updateStaff.isPending}
                data-testid="button-save-member"
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {updateStaff.isPending ? (isFr ? "Enregistrement..." : "Saving...") : "Save"}
              </button>
              <button
                onClick={() => {
                  setFormData({
                    firstName: member.firstName,
                    lastName: member.lastName,
                    email: member.email,
                    personalEmail: member.personalEmail || "",
                    phone: member.phone || "",
                    address: member.address || "",
                    role: member.role,
                    maritalStatus: member.maritalStatus || "",
                    spouseName: member.spouseName || "",
                    spousePhone: member.spousePhone || "",
                    spouseEmail: member.spouseEmail || "",
                    spouseBirthday: member.spouseBirthday || "",
                    anniversary: member.anniversary || "",
                    contractDate: member.contractDate || "",
                    emergencyContactName: member.emergencyContactName || "",
                    emergencyContactPhone: member.emergencyContactPhone || "",
                    emergencyContactRelation: member.emergencyContactRelation || "",
                  });
                  onEditDone();
                }}
                data-testid="button-cancel-edit"
                className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl font-semibold text-slate-500 hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </>
          ) : (canEdit || canResetPassword) ? (
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  onClick={onToggleEdit}
                  data-testid="button-edit-member"
                  className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl font-semibold text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              {canResetPassword && (
                <button
                  onClick={() => setShowSetPassword(true)}
                  data-testid="button-set-password"
                  className="flex items-center gap-2 px-5 py-2.5 border border-border rounded-xl font-semibold text-slate-500 hover:text-primary hover:border-primary/30 transition-all"
                >
                  <KeyRound className="w-4 h-4" />
                  Reset Password
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Mail className="w-4 h-4" /> Contact Information
          </h3>
          <InfoRow label="Work Email" value={isEditing ? formData.email : member.email} field="email" isEditing={isEditing} onChange={v => setFormData({...formData, email: v})} testId="email" />
          <InfoRow label="Personal Email" value={isEditing ? formData.personalEmail : (member.personalEmail || "")} field="personalEmail" isEditing={isEditing} onChange={v => setFormData({...formData, personalEmail: v})} testId="personalEmail" />
          <InfoRow label="Phone" value={isEditing ? formData.phone : (member.phone || "")} field="phone" isEditing={isEditing} onChange={v => setFormData({...formData, phone: v})} testId="phone" />
          <InfoRow label="Address" value={isEditing ? formData.address : (member.address || "")} field="address" isEditing={isEditing} onChange={v => setFormData({...formData, address: v})} testId="address" />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <Heart className="w-4 h-4" /> Personal & Family
          </h3>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Marital Status</label>
                <select
                  value={formData.maritalStatus}
                  onChange={e => setFormData({...formData, maritalStatus: e.target.value})}
                  data-testid="select-edit-maritalStatus"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Not specified</option>
                  {Object.entries(maritalLabels).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <InfoRow label="Spouse/Partner Name" value={formData.spouseName} field="spouseName" isEditing={isEditing} onChange={v => setFormData({...formData, spouseName: v})} testId="spouseName" />
              <InfoRow label="Spouse Phone" value={formData.spousePhone} field="spousePhone" isEditing={isEditing} onChange={v => setFormData({...formData, spousePhone: v})} testId="spousePhone" />
              <InfoRow label="Spouse Email" value={formData.spouseEmail} field="spouseEmail" isEditing={isEditing} onChange={v => setFormData({...formData, spouseEmail: v})} testId="spouseEmail" />
              <div>
                <label className="text-xs text-slate-500">Spouse Birthday</label>
                <input type="date" value={formData.spouseBirthday} onChange={e => setFormData({...formData, spouseBirthday: e.target.value})} data-testid="input-edit-inline-spouse-birthday"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Anniversary</label>
                <input type="date" value={formData.anniversary} onChange={e => setFormData({...formData, anniversary: e.target.value})} data-testid="input-edit-inline-anniversary"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Contract Date</label>
                <input type="date" value={formData.contractDate} onChange={e => setFormData({...formData, contractDate: e.target.value})} data-testid="input-edit-inline-contract-date"
                  className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <InfoRow label="Marital Status" value={member.maritalStatus ? (maritalLabels[member.maritalStatus] || member.maritalStatus) : ""} field="maritalStatus" isEditing={false} onChange={() => {}} testId="maritalStatus" />
              <InfoRow label="Spouse/Partner" value={member.spouseName || ""} field="spouseName" isEditing={false} onChange={() => {}} testId="spouseName" />
              {member.spousePhone && <InfoRow label="Spouse Phone" value={member.spousePhone} field="spousePhone" isEditing={false} onChange={() => {}} testId="spousePhone" />}
              {member.spouseEmail && <InfoRow label="Spouse Email" value={member.spouseEmail} field="spouseEmail" isEditing={false} onChange={() => {}} testId="spouseEmail" />}
              {member.spouseBirthday && <InfoRow label="Spouse Birthday" value={format(new Date(member.spouseBirthday), "MMM d, yyyy")} field="spouseBirthday" isEditing={false} onChange={() => {}} testId="spouseBirthday" />}
              {member.anniversary && <InfoRow label="Anniversary" value={format(new Date(member.anniversary), "MMM d, yyyy")} field="anniversary" isEditing={false} onChange={() => {}} testId="anniversary" />}
              {member.contractDate && <InfoRow label="Contract Date" value={format(new Date(member.contractDate), "MMM d, yyyy")} field="contractDate" isEditing={false} onChange={() => {}} testId="contractDate" />}
            </div>
          )}

          <ChildrenSection staffId={member.id} staffKids={staffKids} isEditing={isEditing} />
        </div>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Emergency Contact
          </h3>
          <InfoRow label="Name" value={isEditing ? formData.emergencyContactName : (member.emergencyContactName || "")} field="emergencyContactName" isEditing={isEditing} onChange={v => setFormData({...formData, emergencyContactName: v})} testId="emergencyContactName" />
          <InfoRow label="Phone" value={isEditing ? formData.emergencyContactPhone : (member.emergencyContactPhone || "")} field="emergencyContactPhone" isEditing={isEditing} onChange={v => setFormData({...formData, emergencyContactPhone: v})} testId="emergencyContactPhone" />
          <InfoRow label="Relationship" value={isEditing ? formData.emergencyContactRelation : (member.emergencyContactRelation || "")} field="emergencyContactRelation" isEditing={isEditing} onChange={v => setFormData({...formData, emergencyContactRelation: v})} testId="emergencyContactRelation" />
        </div>
      </div>

      <MemberAssignmentsSection member={member} allMembers={allMembers} assignments={assignments} canEdit={canEdit} />
    </div>
    </>
  );
}

function InfoRow({ label, value, isEditing, onChange, testId, field, v }: {
  label: string;
  value: string;
  field: string;
  isEditing: boolean;
  onChange: (v: string) => void;
  testId: string;
}) {
  if (isEditing) {
    return (
      <div>
        <label className="text-xs text-slate-500">{label}</label>
        <input
          value={value}
          onChange={e => onChange(e.target.value)}
          data-testid={`input-edit-${testId}`}
          className="w-full mt-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
          placeholder={label}
        />
      </div>
    );
  }
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium" data-testid={`text-${testId}`}>{value || "—"}</p>
    </div>
  );
}

function ChildrenSection({ staffId, staffKids, isEditing }: { staffId: number; staffKids: StaffChild[]; isEditing: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [newChildName, setNewChildName] = useState("");
  const [newChildDob, setNewChildDob] = useState("");
  const [editingChildId, setEditingChildId] = useState<number | null>(null);
  const [editChildName, setEditChildName] = useState("");
  const [editChildDob, setEditChildDob] = useState("");

  const addChild = useMutation({
    mutationFn: async (data: { name: string; dateOfBirth?: string | null }) => {
      await apiRequest("POST", `/api/crm/staff/${staffId}/children`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff', staffId, 'children'] });
      setNewChildName("");
      setNewChildDob("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add child.", variant: "destructive" });
    }
  });

  const updateChild = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name?: string; dateOfBirth?: string | null } }) => {
      await apiRequest("PUT", `/api/crm/staff-children/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff', staffId, 'children'] });
      setEditingChildId(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update child.", variant: "destructive" });
    }
  });

  const removeChild = useMutation({
    mutationFn: async (childId: number) => {
      await apiRequest("DELETE", `/api/crm/staff-children/${childId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff', staffId, 'children'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to remove child.", variant: "destructive" });
    }
  });

  const startEditChild = (kid: StaffChild) => {
    setEditingChildId(kid.id);
    setEditChildName(kid.name);
    setEditChildDob(kid.dateOfBirth || "");
  };

  if (!isEditing && staffKids.length === 0) return null;

  return (
    <div className="mt-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
        <Baby className="w-3.5 h-3.5" /> Children
      </h4>
      <div className="space-y-1.5">
        {staffKids.map(kid => (
          <div key={kid.id} data-testid={`staff-child-${kid.id}`}>
            {isEditing && editingChildId === kid.id ? (
              <div className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2">
                <input
                  value={editChildName}
                  onChange={e => setEditChildName(e.target.value)}
                  data-testid={`input-edit-child-name-${kid.id}`}
                  className="flex-1 px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="date"
                  value={editChildDob}
                  onChange={e => setEditChildDob(e.target.value)}
                  data-testid={`input-edit-child-dob-${kid.id}`}
                  className="px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => {
                    if (editChildName.trim()) {
                      updateChild.mutate({ id: kid.id, data: { name: editChildName.trim(), dateOfBirth: editChildDob || null } });
                    }
                  }}
                  disabled={!editChildName.trim() || updateChild.isPending}
                  data-testid={`button-save-child-${kid.id}`}
                  className="p-1 text-primary hover:text-primary/80"
                >
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingChildId(null)}
                  data-testid={`button-cancel-child-${kid.id}`}
                  className="p-1 text-slate-500 hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                <span className="font-medium">{kid.name}</span>
                <div className="flex items-center gap-2">
                  {kid.dateOfBirth && (
                    <span className="text-slate-500 text-xs">{format(new Date(kid.dateOfBirth), "MMM d, yyyy")}</span>
                  )}
                  {isEditing && (
                    <>
                      <button
                        onClick={() => startEditChild(kid)}
                        data-testid={`button-edit-child-${kid.id}`}
                        className="text-primary hover:text-primary/80 p-0.5"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeChild.mutate(kid.id)}
                        disabled={removeChild.isPending}
                        data-testid={`button-remove-child-${kid.id}`}
                        className="text-destructive hover:text-destructive/80 p-0.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
        {isEditing && (
          <div className="flex items-center gap-2 mt-2" data-testid="add-child-form">
            <input
              value={newChildName}
              onChange={e => setNewChildName(e.target.value)}
              placeholder="Child's name"
              data-testid="input-new-child-name"
              className="flex-1 px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <input
              type="date"
              value={newChildDob}
              onChange={e => setNewChildDob(e.target.value)}
              data-testid="input-new-child-dob"
              className="px-3 py-1.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              onClick={() => {
                if (newChildName.trim()) {
                  addChild.mutate({ name: newChildName.trim(), dateOfBirth: newChildDob || null });
                }
              }}
              disabled={!newChildName.trim() || addChild.isPending}
              data-testid="button-add-child"
              className="p-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberAssignmentsSection({ member, allMembers, assignments, canEdit }: {
  member: StaffMember;
  allMembers: StaffMember[];
  assignments: AdvisorAssignment[];
  canEdit: boolean;
}) {
  const createAssignment = useCreateAdvisorAssignment();
  const deleteAssignment = useDeleteAdvisorAssignment();
  const isManager = managerRoles.includes(member.role);
  const isAdvisor = member.role === "advisor";
  const { isFr } = useT();

  if (!isManager && !isAdvisor) return null;

  if (isManager) {
    const adminAssignments = assignments.filter(a => a.adminId === member.id);
    const assignedAdvisors = adminAssignments
      .map(a => ({ assignment: a, advisor: allMembers.find(m => m.id === a.advisorId) }))
      .filter((x): x is { assignment: AdvisorAssignment; advisor: StaffMember } => !!x.advisor);
    const allAdvisors = allMembers.filter(m => m.role === "advisor");
    const unassignedAdvisors = allAdvisors.filter(a => !assignedAdvisors.find(aa => aa.advisor.id === a.id));

    return (
      <div className="border-t border-border pt-6" data-testid="section-assigned-advisors">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
          <UsersIcon className="w-4 h-4" /> Assigned Advisors ({assignedAdvisors.length})
        </h3>
        {assignedAdvisors.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-4">
            {assignedAdvisors.map(({ assignment, advisor }) => (
              <div key={advisor.id} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2" data-testid={`assigned-advisor-${advisor.id}`}>
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                  {advisor.firstName[0]}{advisor.lastName[0]}
                </div>
                <span className="text-sm font-medium">{advisor.firstName} {advisor.lastName}</span>
                {canEdit && (
                  <button
                    onClick={() => deleteAssignment.mutate(assignment.id)}
                    disabled={deleteAssignment.isPending}
                    data-testid={`button-unassign-advisor-${advisor.id}`}
                    className="p-0.5 rounded text-slate-500 hover:text-destructive transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 mb-4">No advisors assigned yet.</p>
        )}
        {canEdit && unassignedAdvisors.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              defaultValue=""
              onChange={e => {
                const advisorId = Number(e.target.value);
                if (advisorId) {
                  createAssignment.mutate({ adminId: member.id, advisorId });
                  e.target.value = "";
                }
              }}
              data-testid="select-assign-advisor"
              className="flex-1 max-w-xs px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">Add an advisor to this team...</option>
              {unassignedAdvisors.map(a => (
                <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    );
  }

  const advisorAssignments = assignments.filter(a => a.advisorId === member.id);
  const managers = advisorAssignments
    .map(a => ({ assignment: a, manager: allMembers.find(m => m.id === a.adminId) }))
    .filter((x): x is { assignment: AdvisorAssignment; manager: StaffMember } => !!x.manager);
  const allManagers = allMembers.filter(m => managerRoles.includes(m.role));
  const unassignedManagers = allManagers.filter(mgr => !managers.find(m => m.manager.id === mgr.id));

  return (
    <div className="border-t border-border pt-6" data-testid="section-reports-to">
      <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2 mb-4">
        <Link2 className="w-4 h-4" /> Reports To
      </h3>
      {managers.length > 0 ? (
        <div className="flex flex-wrap gap-2 mb-4">
          {managers.map(({ assignment, manager }) => {
            const _MgrIcon = roleIcons[manager.role] || Shield;
            return (
              <div key={manager.id} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2" data-testid={`reports-to-${manager.id}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${roleColors[manager.role].split(' ').slice(0, 2).join(' ')}`}>
                  {manager.firstName[0]}{manager.lastName[0]}
                </div>
                <div>
                  <span className="text-sm font-medium">{manager.firstName} {manager.lastName}</span>
                  <span className="text-xs text-slate-500 ml-1.5">{getRoleLabels(isFr)[manager.role]}</span>
                </div>
                {canEdit && (
                  <button
                    onClick={() => deleteAssignment.mutate(assignment.id)}
                    disabled={deleteAssignment.isPending}
                    data-testid={`button-unassign-manager-${manager.id}`}
                    className="p-0.5 rounded text-slate-500 hover:text-destructive transition-colors ml-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-4">Not assigned to any manager.</p>
      )}
      {canEdit && unassignedManagers.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={e => {
              const adminId = Number(e.target.value);
              if (adminId) {
                createAssignment.mutate({ adminId, advisorId: member.id });
                e.target.value = "";
              }
            }}
            data-testid="select-assign-manager"
            className="flex-1 max-w-xs px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Assign to a manager...</option>
            {unassignedManagers.map(m => (
              <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {getRoleLabels(isFr)[m.role]}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function _StaffRow({ member, isGM, onEdit }: {
  member: StaffMember;
  isGM: boolean;
  onEdit: () => void;
}) {
  const deleteMember = useDeleteStaffMember();
  const Icon = roleIcons[member.role];
  const { isFr } = useT();

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" data-testid={`row-user-${member.id}`} onClick={onEdit}>
      <td className="px-6 py-4">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
            {member.firstName[0]}{member.lastName[0]}
          </div>
          <div>
            <p className="font-semibold text-foreground" data-testid={`text-user-name-${member.id}`}>{member.firstName} {member.lastName}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${roleColors[member.role]}`}>
                <Icon className="w-3 h-3" />
                <span>{getRoleLabels(isFr)[member.role]}</span>
              </span>
              {member.isAdmin && (
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200" data-testid={`badge-admin-${member.id}`}>
                  <ShieldAlert className="w-3 h-3" />
                  <span>Admin</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4">
        {member.phone ? (
          <p className="text-sm text-foreground flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-slate-500" />
            {member.phone}
          </p>
        ) : (
          <span className="text-sm text-slate-500/50">—</span>
        )}
      </td>
      <td className="px-6 py-4">
        <p className="text-sm text-foreground" data-testid={`text-user-email-${member.id}`}>{member.email}</p>
      </td>
      <td className="px-6 py-4">
        {member.contractDate ? (
          <p className="text-sm text-foreground flex items-center gap-1.5" data-testid={`text-contract-date-${member.id}`}>
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            {format(new Date(member.contractDate), "MMM d, yyyy")}
          </p>
        ) : (
          <span className="text-sm text-slate-500/50">—</span>
        )}
      </td>
      {isGM && (
        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex justify-end space-x-2">
            <button
              onClick={onEdit}
              data-testid={`button-edit-user-${member.id}`}
              className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to remove ${member.firstName} ${member.lastName}?`)) {
                  deleteMember.mutate(member.id);
                }
              }}
              data-testid={`button-delete-user-${member.id}`}
              className="p-2 rounded-lg text-slate-500 hover:text-destructive hover:bg-destructive/5 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function _AssignmentPanel({ adminId, assignedAdvisors, assignments, allAdvisors, isGM, onClose }: {
  adminId: number;
  assignedAdvisors: StaffMember[];
  assignments: AdvisorAssignment[];
  allAdvisors: StaffMember[];
  isGM: boolean;
  onClose: () => void;
}) {
  const createAssignment = useCreateAdvisorAssignment();
  const deleteAssignment = useDeleteAdvisorAssignment();
  const unassignedAdvisors = allAdvisors.filter(a => !assignedAdvisors.find(aa => aa.id === a.id));

  return (
    <div className="absolute left-0 top-full mt-2 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-border p-4 space-y-3" data-testid="panel-assignments">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold text-sm">Team Members</h4>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {assignedAdvisors.length > 0 ? (
        <div className="space-y-2">
          {assignedAdvisors.map(advisor => {
            const assignment = assignments.find(a => a.advisorId === advisor.id);
            return (
              <div key={advisor.id} className="flex items-center justify-between p-2 rounded-xl bg-muted/30">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                    {advisor.firstName[0]}{advisor.lastName[0]}
                  </div>
                  <span className="text-sm font-medium">{advisor.firstName} {advisor.lastName}</span>
                </div>
                {isGM && (
                  <button
                    onClick={() => assignment && deleteAssignment.mutate(assignment.id)}
                    data-testid={`button-unassign-${advisor.id}`}
                    className="p-1 rounded-lg text-slate-500 hover:text-destructive hover:bg-destructive/5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-slate-500 py-2">No team members assigned yet.</p>
      )}

      {isGM && unassignedAdvisors.length > 0 && (
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Add to Team</p>
          {unassignedAdvisors.map(advisor => (
            <button
              key={advisor.id}
              onClick={() => createAssignment.mutate({ adminId, advisorId: advisor.id })}
              data-testid={`button-assign-${advisor.id}`}
              className="w-full flex items-center space-x-2 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {advisor.firstName[0]}{advisor.lastName[0]}
              </div>
              <span className="text-sm">{advisor.firstName} {advisor.lastName}</span>
              <Plus className="w-4 h-4 ml-auto text-primary" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddStaffModal({ onClose, callerRole }: { onClose: () => void; callerRole?: string }) {
  const [formData, setFormData] = useState({
    firstName: "", lastName: "", email: "", role: "advisor",
    isAdmin: false, phone: "", personalEmail: "", address: "",
    emergencyContactName: "", emergencyContactPhone: "", emergencyContactRelation: "",
    tempPassword: "", sellsMutualFunds: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const createMember = useCreateStaffMember();
  const { isFr } = useT();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { firstName, lastName, email, role, isAdmin, phone, personalEmail, address, emergencyContactName, emergencyContactPhone, emergencyContactRelation, tempPassword, sellsMutualFunds } = formData;
    const advisorRoles = ["advisor", "advisor_admin", "sales_manager"];
    createMember.mutate({
      firstName, lastName, email, role, isAdmin,
      phone: phone || undefined,
      personalEmail: personalEmail || undefined,
      address: address || undefined,
      emergencyContactName: emergencyContactName || undefined,
      emergencyContactPhone: emergencyContactPhone || undefined,
      emergencyContactRelation: emergencyContactRelation || undefined,
      tempPassword: tempPassword || undefined,
      sellsMutualFunds: advisorRoles.includes(role) ? sellsMutualFunds : false,
    }, { onSuccess: () => onClose() });
  };

  const availableRoles = allRoles.filter(r => callerRole === "general_manager" || !["general_manager", "office_admin"].includes(r));

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border bg-background/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Add New User</h2>
            <p className="text-sm text-slate-500 mt-1">Create a new team member account.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5" data-testid="form-add-user">
          <div className="grid grid-cols-2 gap-4">
            <InputField label="First Name" value={formData.firstName} onChange={v => setFormData({...formData, firstName: v})} required testId="input-first-name" />
            <InputField label="Last Name" value={formData.lastName} onChange={v => setFormData({...formData, lastName: v})} required testId="input-last-name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Work Email" value={formData.email} onChange={v => setFormData({...formData, email: v})} required type="email" testId="input-email" />
            <InputField label="Personal Email" value={formData.personalEmail} onChange={v => setFormData({...formData, personalEmail: v})} type="email" testId="input-personal-email" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Phone" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} testId="input-phone" />
            <InputField label="Address" value={formData.address} onChange={v => setFormData({...formData, address: v})} testId="input-address" />
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-primary" />
              Temporary Password
            </p>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.tempPassword}
                onChange={e => setFormData({...formData, tempPassword: e.target.value})}
                placeholder="Set a temporary password (min 12 characters)"
                data-testid="input-temp-password"
                className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm pr-10"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground" data-testid="button-toggle-password-visibility">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">The user will be prompted to change this password on their first login.</p>
          </div>

          <div className="border-t border-border pt-4">
            <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Emergency Contact
            </p>
            <div className="grid grid-cols-3 gap-4">
              <InputField label="Name" value={formData.emergencyContactName} onChange={v => setFormData({...formData, emergencyContactName: v})} testId="input-emergency-name" />
              <InputField label="Phone" value={formData.emergencyContactPhone} onChange={v => setFormData({...formData, emergencyContactPhone: v})} testId="input-emergency-phone" />
              <InputField label="Relationship" value={formData.emergencyContactRelation} onChange={v => setFormData({...formData, emergencyContactRelation: v})} testId="input-emergency-relation" />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold text-foreground">Access Level</label>
            <select
              value={formData.role}
              onChange={e => setFormData({...formData, role: e.target.value})}
              data-testid="select-role"
              className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm"
            >
              {availableRoles.map(role => (
                <option key={role} value={role}>{getRoleLabels(isFr)[role]}</option>
              ))}
            </select>
            <div className="p-2 rounded-lg bg-muted/50 text-sm text-slate-500">{roleDescriptions[formData.role]}</div>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-admin-privileges">
              <input
                type="checkbox"
                checked={formData.isAdmin}
                onChange={e => setFormData({...formData, isAdmin: e.target.checked})}
                className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <ShieldAlert className="w-4 h-4 text-slate-500" />
              <span className="text-sm font-medium">Admin privileges</span>
              <span className="text-xs text-slate-500 ml-1">(manage system settings & configurations)</span>
            </label>
            {["advisor", "advisor_admin", "sales_manager"].includes(formData.role) && (
              <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-sells-mutual-funds">
                <input
                  type="checkbox"
                  checked={formData.sellsMutualFunds}
                  onChange={e => setFormData({...formData, sellsMutualFunds: e.target.checked})}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                />
                <Building2 className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium">Sells Mutual Funds</span>
                <span className="text-xs text-slate-500 ml-1">(show mutual fund dealers in carrier selection)</span>
              </label>
            )}
          </div>

          {createMember.isError && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-xl" data-testid="text-create-user-error">
              {createMember.error instanceof Error ? createMember.error.message : "Failed to create user. Please try again."}
            </div>
          )}

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={createMember.isPending} data-testid="button-submit-user"
              className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
              {createMember.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StaffProfileModal({ member, onClose, isGM, callerRole }: { member: StaffMember; onClose: () => void; isGM: boolean; callerRole?: string }) {
  const [activeTab, setActiveTab] = useState<"details" | "documents" | "pending" | "insurance" | "funds" | "leads">("details");
  const [isEditing, setIsEditing] = useState(false);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const canResetInModal = callerRole === "general_manager" || callerRole === "office_admin";
  const { isFr } = useT();
  const [formData, setFormData] = useState({
    firstName: member.firstName,
    lastName: member.lastName,
    email: member.email,
    personalEmail: member.personalEmail || "",
    phone: member.phone || "",
    address: member.address || "",
    emergencyContactName: member.emergencyContactName || "",
    emergencyContactPhone: member.emergencyContactPhone || "",
    emergencyContactRelation: member.emergencyContactRelation || "",
    role: member.role,
    isAdmin: member.isAdmin ?? false,
    linkedClientId: member.linkedClientId,
    linkedSpouseClientId: (member as StaffMember & { linkedSpouseClientId?: number | null }).linkedSpouseClientId ?? null,
    spouseBirthday: member.spouseBirthday || "",
    spouseIsEmergencyContact: (member as StaffMember & { spouseIsEmergencyContact?: boolean }).spouseIsEmergencyContact ?? false,
    anniversary: member.anniversary || "",
    contractDate: member.contractDate || "",
    sellsMutualFunds: member.sellsMutualFunds ?? false,
  });
  const [showCreateClient, setShowCreateClient] = useState(false);
  const [showCreateSpouseClient, setShowCreateSpouseClient] = useState(false);
  const [newClientData, setNewClientData] = useState({ firstName: "", lastName: "", email: "" });
  const [newSpouseClientData, setNewSpouseClientData] = useState({ firstName: "", lastName: "", email: "" });
  const updateMember = useUpdateStaffMember();
  const Icon = roleIcons[member.role];
  const { data: staffKids = [] } = useStaffChildren(member.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: clientsList } = useQuery<Client[]>({ queryKey: ["/api/crm/clients"] });

  const createClientMutation = useMutation({
    mutationFn: async (data: { firstName: string; lastName: string; email: string }) => {
      const res = await apiRequest("POST", "/api/crm/clients", { ...data, type: "individual" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
    },
  });

  const handleSpouseEmergencyToggle = (checked: boolean) => {
    if (checked && member.spouseName) {
      setFormData({
        ...formData,
        spouseIsEmergencyContact: true,
        emergencyContactName: member.spouseName || formData.emergencyContactName,
        emergencyContactPhone: member.spousePhone || formData.emergencyContactPhone,
        emergencyContactRelation: "Spouse",
      });
    } else {
      setFormData({ ...formData, spouseIsEmergencyContact: checked });
    }
  };

  const handleCreateClientForStaff = async () => {
    if (!newClientData.firstName || !newClientData.lastName || !newClientData.email) return;
    const client = await createClientMutation.mutateAsync(newClientData);
    setFormData({ ...formData, linkedClientId: client.id });
    setShowCreateClient(false);
    setNewClientData({ firstName: "", lastName: "", email: "" });
    toast({ title: "Client Created", description: `Client file created for ${client.firstName} ${client.lastName}.` });
  };

  const handleCreateSpouseClient = async () => {
    if (!newSpouseClientData.firstName || !newSpouseClientData.lastName || !newSpouseClientData.email) return;
    const client = await createClientMutation.mutateAsync(newSpouseClientData);
    setFormData({ ...formData, linkedSpouseClientId: client.id });
    setShowCreateSpouseClient(false);
    setNewSpouseClientData({ firstName: "", lastName: "", email: "" });
    toast({ title: "Spouse Client Created", description: `Client file created for ${client.firstName} ${client.lastName}.` });
  };

  const handleSave = () => {
    updateMember.mutate({
      id: member.id,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      personalEmail: formData.personalEmail || null,
      phone: formData.phone || null,
      address: formData.address || null,
      emergencyContactName: formData.emergencyContactName || null,
      emergencyContactPhone: formData.emergencyContactPhone || null,
      emergencyContactRelation: formData.emergencyContactRelation || null,
      role: formData.role,
      isAdmin: formData.isAdmin,
      linkedClientId: formData.linkedClientId,
      linkedSpouseClientId: formData.linkedSpouseClientId,
      spouseBirthday: formData.spouseBirthday || null,
      spouseIsEmergencyContact: formData.spouseIsEmergencyContact,
      anniversary: formData.anniversary || null,
      contractDate: formData.contractDate || null,
      sellsMutualFunds: ["advisor", "advisor_admin", "sales_manager"].includes(formData.role) ? formData.sellsMutualFunds : false,
    }, {
      onSuccess: () => {
        setIsEditing(false);
        onClose();
      }
    });
  };

  const tabs = [
    { id: "details" as const, label: "Details", icon: UsersIcon },
    { id: "documents" as const, label: isFr ? "Documents" : "Documents", icon: FileText },
    { id: "pending" as const, label: "Pending Business", icon: Clock },
    { id: "insurance" as const, label: "Insurance Clients", icon: Shield },
    { id: "funds" as const, label: "Fund Clients", icon: DollarSign },
    { id: "leads" as const, label: "Leads", icon: Target },
  ];

  return (
    <>
    {showSetPassword && <SetPasswordModal staffId={member.id} staffName={`${member.firstName} ${member.lastName}`} onClose={() => setShowSetPassword(false)} />}
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border bg-background/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
                {member.firstName[0]}{member.lastName[0]}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900" data-testid="text-modal-user-name">{member.firstName} {member.lastName}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleColors[member.role]}`}>
                    <Icon className="w-3 h-3" />
                    <span>{getRoleLabels(isFr)[member.role]}</span>
                  </span>
                  {member.isAdmin && (
                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                      <ShieldAlert className="w-3 h-3" />
                      <span>Admin</span>
                    </span>
                  )}
                  {member.linkedClientId && (
                    <span className="inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                      <Link2 className="w-3 h-3" />
                      <span>Linked to Client</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canResetInModal && !isEditing && (
                <button onClick={() => setShowSetPassword(true)} data-testid="button-modal-reset-password" className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                  <KeyRound className="w-4 h-4" />
                  Reset Password
                </button>
              )}
              {isGM && !isEditing && (
                <button onClick={() => setIsEditing(true)} data-testid="button-edit-profile" className="px-4 py-2 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              )}
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-muted transition-colors" data-testid="button-close-modal">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="flex gap-1 mt-4 flex-wrap">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-testid={`tab-${tab.id}`}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${activeTab === tab.id ? "bg-primary text-primary-foreground" : "text-slate-500 hover:bg-muted"}`}>
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === "details" && (
            isEditing ? (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="First Name" value={formData.firstName} onChange={v => setFormData({...formData, firstName: v})} required testId="input-edit-first-name" />
                  <InputField label="Last Name" value={formData.lastName} onChange={v => setFormData({...formData, lastName: v})} required testId="input-edit-last-name" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Work Email" value={formData.email} onChange={v => setFormData({...formData, email: v})} required type="email" testId="input-edit-email" />
                  <InputField label="Personal Email" value={formData.personalEmail} onChange={v => setFormData({...formData, personalEmail: v})} type="email" testId="input-edit-personal-email" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="Phone" value={formData.phone} onChange={v => setFormData({...formData, phone: v})} testId="input-edit-phone" />
                  <InputField label="Address" value={formData.address} onChange={v => setFormData({...formData, address: v})} testId="input-edit-address" />
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Emergency Contact
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <InputField label="Name" value={formData.emergencyContactName} onChange={v => setFormData({...formData, emergencyContactName: v})} testId="input-edit-emergency-name" />
                    <InputField label="Phone" value={formData.emergencyContactPhone} onChange={v => setFormData({...formData, emergencyContactPhone: v})} testId="input-edit-emergency-phone" />
                    <InputField label="Relationship" value={formData.emergencyContactRelation} onChange={v => setFormData({...formData, emergencyContactRelation: v})} testId="input-edit-emergency-relation" />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold text-foreground">Access Level</label>
                  <select
                    value={formData.role}
                    onChange={e => setFormData({...formData, role: e.target.value})}
                    data-testid="select-edit-role"
                    className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm"
                  >
                    {allRoles.filter(r => callerRole === "general_manager" || !["general_manager", "office_admin"].includes(r)).map(role => (
                      <option key={role} value={role}>{getRoleLabels(isFr)[role]}</option>
                    ))}
                  </select>
                  <div className="p-2 rounded-lg bg-muted/50 text-sm text-slate-500">{roleDescriptions[formData.role]}</div>
                  <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-edit-admin-privileges">
                    <input
                      type="checkbox"
                      checked={formData.isAdmin}
                      onChange={e => setFormData({...formData, isAdmin: e.target.checked})}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <ShieldAlert className="w-4 h-4 text-slate-500" />
                    <span className="text-sm font-medium">Admin privileges</span>
                    <span className="text-xs text-slate-500 ml-1">(manage system settings & configurations)</span>
                  </label>
                  {["advisor", "advisor_admin", "sales_manager"].includes(formData.role) && (
                    <label className="flex items-center gap-2 cursor-pointer" data-testid="checkbox-profile-sells-mutual-funds">
                      <input
                        type="checkbox"
                        checked={formData.sellsMutualFunds}
                        onChange={e => setFormData({...formData, sellsMutualFunds: e.target.checked})}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <Building2 className="w-4 h-4 text-slate-500" />
                      <span className="text-sm font-medium">Sells Mutual Funds</span>
                      <span className="text-xs text-slate-500 ml-1">(show mutual fund dealers in carrier selection)</span>
                    </label>
                  )}
                </div>

                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Spouse & Dates
                  </p>
                  {member.spouseName && (
                    <label className="flex items-center gap-2 cursor-pointer mb-4" data-testid="checkbox-spouse-emergency">
                      <input
                        type="checkbox"
                        checked={formData.spouseIsEmergencyContact}
                        onChange={e => handleSpouseEmergencyToggle(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                      />
                      <span className="text-sm font-medium">Spouse is emergency contact</span>
                    </label>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Spouse Birthday</label>
                      <input type="date" value={formData.spouseBirthday} onChange={e => setFormData({...formData, spouseBirthday: e.target.value})} data-testid="input-edit-spouse-birthday"
                        className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Anniversary</label>
                      <input type="date" value={formData.anniversary} onChange={e => setFormData({...formData, anniversary: e.target.value})} data-testid="input-edit-anniversary"
                        className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">Contract Date</label>
                      <input type="date" value={formData.contractDate} onChange={e => setFormData({...formData, contractDate: e.target.value})} data-testid="input-edit-contract-date"
                        className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm" />
                    </div>
                  </div>
                  <ChildrenSection staffId={member.id} staffKids={staffKids} isEditing={isEditing} />
                </div>

                <div className="border-t border-border pt-4">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                    <Link2 className="w-4 h-4 text-violet-500" />
                    Client File
                  </label>
                  {formData.linkedClientId ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-violet-50 border border-violet-200">
                      <Link2 className="w-4 h-4 text-violet-600" />
                      <span className="text-sm font-semibold text-violet-700">
                        {clientsList?.find(c => c.id === formData.linkedClientId)
                          ? `${clientsList.find(c => c.id === formData.linkedClientId)!.firstName} ${clientsList.find(c => c.id === formData.linkedClientId)!.lastName}`
                          : `Client #${formData.linkedClientId}`}
                      </span>
                      <button type="button" onClick={() => setFormData({...formData, linkedClientId: null})} className="ml-auto text-xs text-destructive hover:underline" data-testid="button-unlink-client">Unlink</button>
                    </div>
                  ) : showCreateClient ? (
                    <div className="space-y-3 p-2 rounded-lg border border-border bg-muted/30">
                      <p className="text-xs font-semibold text-foreground">Create New Client File</p>
                      <div className="grid grid-cols-3 gap-2">
                        <input placeholder="First Name" value={newClientData.firstName} onChange={e => setNewClientData({...newClientData, firstName: e.target.value})} data-testid="input-new-client-first"
                          className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                        <input placeholder="Last Name" value={newClientData.lastName} onChange={e => setNewClientData({...newClientData, lastName: e.target.value})} data-testid="input-new-client-last"
                          className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                        <input placeholder="Email" value={newClientData.email} onChange={e => setNewClientData({...newClientData, email: e.target.value})} data-testid="input-new-client-email"
                          className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleCreateClientForStaff} disabled={createClientMutation.isPending} data-testid="button-create-client-confirm"
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                          {createClientMutation.isPending ? "Creating..." : "Create"}
                        </button>
                        <button type="button" onClick={() => setShowCreateClient(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-muted">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setShowCreateClient(true)} data-testid="button-create-client-file"
                        className="px-3 py-2 rounded-xl text-xs font-semibold border border-primary text-primary hover:bg-primary/5 transition-colors flex items-center gap-1">
                        <Plus className="w-3 h-3" /> Create Client File
                      </button>
                      <select
                        value=""
                        onChange={e => setFormData({...formData, linkedClientId: Number(e.target.value) || null})}
                        data-testid="select-link-client"
                        className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background focus:ring-2 focus:ring-primary/20"
                      >
                        <option value="">Choose from existing...</option>
                        {clientsList?.map(c => (
                          <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1">Link this staff member to their own client file for personal financial tracking.</p>

                  {member.maritalStatus === "married" && (
                    <div className="mt-4">
                      <label className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                        <Heart className="w-4 h-4 text-pink-500" />
                        Spouse Client File
                      </label>
                      {formData.linkedSpouseClientId ? (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-pink-50 border border-pink-200">
                          <Heart className="w-4 h-4 text-pink-600" />
                          <span className="text-sm font-semibold text-pink-700">
                            {clientsList?.find(c => c.id === formData.linkedSpouseClientId)
                              ? `${clientsList.find(c => c.id === formData.linkedSpouseClientId)!.firstName} ${clientsList.find(c => c.id === formData.linkedSpouseClientId)!.lastName}`
                              : `Client #${formData.linkedSpouseClientId}`}
                          </span>
                          <button type="button" onClick={() => setFormData({...formData, linkedSpouseClientId: null})} className="ml-auto text-xs text-destructive hover:underline" data-testid="button-unlink-spouse-client">Unlink</button>
                        </div>
                      ) : showCreateSpouseClient ? (
                        <div className="space-y-3 p-2 rounded-lg border border-border bg-muted/30">
                          <p className="text-xs font-semibold text-foreground">Create Spouse Client File</p>
                          <div className="grid grid-cols-3 gap-2">
                            <input placeholder="First Name" value={newSpouseClientData.firstName} onChange={e => setNewSpouseClientData({...newSpouseClientData, firstName: e.target.value})} data-testid="input-new-spouse-client-first"
                              className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                            <input placeholder="Last Name" value={newSpouseClientData.lastName} onChange={e => setNewSpouseClientData({...newSpouseClientData, lastName: e.target.value})} data-testid="input-new-spouse-client-last"
                              className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                            <input placeholder="Email" value={newSpouseClientData.email} onChange={e => setNewSpouseClientData({...newSpouseClientData, email: e.target.value})} data-testid="input-new-spouse-client-email"
                              className="px-2 py-1.5 rounded-lg border border-border text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button type="button" onClick={handleCreateSpouseClient} disabled={createClientMutation.isPending} data-testid="button-create-spouse-client-confirm"
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                              {createClientMutation.isPending ? "Creating..." : "Create"}
                            </button>
                            <button type="button" onClick={() => setShowCreateSpouseClient(false)} className="px-3 py-1.5 rounded-lg text-xs text-slate-500 hover:bg-muted">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button type="button" onClick={() => setShowCreateSpouseClient(true)} data-testid="button-create-spouse-client-file"
                            className="px-3 py-2 rounded-xl text-xs font-semibold border border-pink-400 text-pink-600 hover:bg-pink-50 transition-colors flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Create Spouse Client File
                          </button>
                          <select
                            value=""
                            onChange={e => setFormData({...formData, linkedSpouseClientId: Number(e.target.value) || null})}
                            data-testid="select-link-spouse-client"
                            className="flex-1 px-3 py-2 rounded-xl border border-border text-sm bg-background focus:ring-2 focus:ring-primary/20"
                          >
                            <option value="">Choose from existing...</option>
                            {clientsList?.map(c => (
                              <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
                  <button onClick={handleSave} disabled={updateMember.isPending} data-testid="button-submit-edit-user"
                    className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
                    {updateMember.isPending ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Enregistrer" : "Save Changes")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <InfoFieldModal icon={Mail} label="Work Email" value={member.email} />
                  <InfoFieldModal icon={Mail} label="Personal Email" value={member.personalEmail} />
                  <InfoFieldModal icon={Phone} label="Phone" value={member.phone} />
                  <InfoFieldModal icon={MapPin} label="Address" value={member.address} />
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-pink-500" />
                    Spouse & Family
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <InfoFieldModal label="Spouse Name" value={member.spouseName} />
                    <InfoFieldModal icon={Calendar} label="Spouse Birthday" value={member.spouseBirthday ? format(new Date(member.spouseBirthday), "MMMM d, yyyy") : null} />
                    <InfoFieldModal icon={Heart} label="Anniversary" value={member.anniversary ? format(new Date(member.anniversary), "MMMM d, yyyy") : null} />
                    <InfoFieldModal icon={Calendar} label="Contract Date" value={member.contractDate ? format(new Date(member.contractDate), "MMMM d, yyyy") : null} />
                  </div>
                  {staffKids.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-2">
                        <Baby className="w-3.5 h-3.5" /> Children
                      </p>
                      <div className="space-y-1.5">
                        {staffKids.map(kid => (
                          <div key={kid.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2" data-testid={`modal-staff-child-${kid.id}`}>
                            <span className="font-medium">{kid.name}</span>
                            {kid.dateOfBirth && (
                              <span className="text-slate-500 text-xs">{format(new Date(kid.dateOfBirth), "MMM d, yyyy")}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Emergency Contact
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <InfoFieldModal label="Name" value={member.emergencyContactName} />
                    <InfoFieldModal label="Phone" value={member.emergencyContactPhone} />
                    <InfoFieldModal label="Relationship" value={member.emergencyContactRelation} />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role</p>
                      <p className="text-sm font-medium">{getRoleLabels(isFr)[member.role]}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{roleDescriptions[member.role]}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Member Since</p>
                      <p className="text-sm font-medium">{member.createdAt ? format(new Date(member.createdAt), 'MMMM d, yyyy') : '-'}</p>
                    </div>
                  </div>
                </div>
                <StaffEmailStatus staffId={member.id} />
                {member.linkedClientId && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> Linked Client File
                    </p>
                    <p className="text-sm font-medium text-primary">
                      {clientsList?.find(c => c.id === member.linkedClientId)
                        ? `${clientsList.find(c => c.id === member.linkedClientId)!.firstName} ${clientsList.find(c => c.id === member.linkedClientId)!.lastName}`
                        : `Client #${member.linkedClientId}`}
                    </p>
                  </div>
                )}
              </div>
            )
          )}

          {activeTab === "documents" && (
            <StaffDocumentsTab staffId={member.id} isGM={isGM} />
          )}

          {activeTab === "pending" && (
            <StaffClientsByTypeTab staffId={member.id} filterType="pending" emptyLabel="No pending business" />
          )}

          {activeTab === "insurance" && (
            <StaffClientsByTypeTab staffId={member.id} filterType="insurance" emptyLabel="No insurance clients" />
          )}

          {activeTab === "funds" && (
            <StaffClientsByTypeTab staffId={member.id} filterType="mutual_fund" emptyLabel="No fund clients" secondaryType="segregated_fund" />
          )}

          {activeTab === "leads" && (
            <StaffLeadsTab staffId={member.id} />
          )}
        </div>
      </div>
    </div>
    </>
  );
}

function StaffClientsByTypeTab({ staffId, filterType, emptyLabel, secondaryType }: { staffId: number; filterType: string; emptyLabel: string; secondaryType?: string }) {
  const [, setLocation] = useLocation();
  const { data: primaryClients, isLoading: primaryLoading } = useQuery<Client[]>({
    queryKey: ['/api/crm/staff', staffId, 'clients-by-type', filterType],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${staffId}/clients-by-type?type=${filterType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const { data: secondaryClients, isLoading: secondaryLoading } = useQuery<Client[]>({
    queryKey: ['/api/crm/staff', staffId, 'clients-by-type', secondaryType],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${staffId}/clients-by-type?type=${secondaryType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
    enabled: !!secondaryType,
  });

  const isLoading = primaryLoading || secondaryLoading;
  const allClients = [...(primaryClients ?? []), ...(secondaryClients ?? [])];
  const uniqueClients = allClients.filter((c, i, arr) => arr.findIndex(x => x.id === c.id) === i);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-xl" />)}
      </div>
    );
  }

  if (uniqueClients.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border border-dashed border-border">
        <UsersIcon className="w-10 h-10 mx-auto text-slate-500/30 mb-2" />
        <p className="text-slate-500 text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid={`tab-content-${filterType}`}>
      {uniqueClients.map(client => (
        <button
          key={client.id}
          onClick={() => setLocation(`/clients/${client.id}`)}
          data-testid={`client-row-${client.id}`}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/40 hover:border-primary/20 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm flex-shrink-0">
            {client.firstName[0]}{client.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{client.firstName} {client.lastName}</p>
            <p className="text-xs text-slate-500 truncate">{client.email}</p>
          </div>
          {client.phone && (
            <span className="text-xs text-slate-500 hidden sm:block">{client.phone}</span>
          )}
          <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

function StaffLeadsTab({ staffId }: { staffId: number }) {
  const [, setLocation] = useLocation();
  const { data: staffLeads, isLoading } = useQuery<Lead[]>({
    queryKey: ['/api/crm/staff', staffId, 'clients-by-type', 'leads'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${staffId}/clients-by-type?type=leads`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leads");
      return res.json();
    },
  });

  const stageLabels: Record<string, string> = {
    lead: "Lead",
    contacted: "Contacted",
    opportunity: "Opportunity",
    proposal: "Proposal",
    closed_won: "Closed Won",
    follow_up: "Follow Up",
  };

  const stageColors: Record<string, string> = {
    lead: "bg-violet-100 text-violet-700",
    contacted: "bg-amber-100 text-amber-700",
    opportunity: "bg-purple-100 text-purple-700",
    proposal: "bg-orange-100 text-orange-700",
    closed_won: "bg-emerald-100 text-emerald-700",
    follow_up: "bg-gray-100 text-gray-700",
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted rounded-xl" />)}
      </div>
    );
  }

  if (!staffLeads || staffLeads.length === 0) {
    return (
      <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border border-dashed border-border">
        <Target className="w-10 h-10 mx-auto text-slate-500/30 mb-2" />
        <p className="text-slate-500 text-sm">No leads assigned</p>
      </div>
    );
  }

  return (
    <div className="space-y-2" data-testid="tab-content-leads">
      {staffLeads.map(lead => (
        <button
          key={lead.id}
          onClick={() => setLocation(`/pipeline?leadId=${lead.id}`)}
          data-testid={`lead-row-${lead.id}`}
          className="w-full flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/40 hover:border-primary/20 transition-all text-left group"
        >
          <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {lead.firstName[0]}{lead.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{lead.firstName} {lead.lastName}</p>
            {lead.email && <p className="text-xs text-slate-500 truncate">{lead.email}</p>}
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stageColors[lead.stage] || "bg-gray-100 text-gray-700"}`}>
            {stageLabels[lead.stage] || lead.stage}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}

function StaffDocumentsTab({ staffId, isGM }: { staffId: number; isGM: boolean }) {
  const { data: docs, isLoading } = useStaffDocuments(staffId);
  const createDoc = useCreateStaffDocument(staffId);
  const { isFr } = useT();
  const deleteDoc = useDeleteStaffDocument(staffId);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", documentType: "other", description: "", fileName: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createDoc.mutate({
      title: formData.title,
      documentType: formData.documentType,
      description: formData.description || undefined,
      fileName: formData.fileName || undefined,
    }, {
      onSuccess: () => {
        setFormData({ title: "", documentType: "other", description: "", fileName: "" });
        setShowForm(false);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">Staff Documents</h3>
        {isGM && (
          <button onClick={() => setShowForm(!showForm)} data-testid="button-add-staff-doc"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold text-primary hover:bg-primary/5 transition-colors">
            <Plus className="w-4 h-4" />
            Add Document
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 bg-muted/30 rounded-xl space-y-3 border border-border" data-testid="form-add-staff-doc">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Title" value={formData.title} onChange={v => setFormData({...formData, title: v})} required testId="input-doc-title" />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">Type</label>
              <select value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})} data-testid="select-doc-type"
                className="w-full px-3 py-2.5 rounded-xl border border-border text-sm bg-background">
                {Object.entries(staffDocTypeLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>
          <InputField label="Description" value={formData.description} onChange={v => setFormData({...formData, description: v})} testId="input-doc-description" />
          <InputField label="File Reference" value={formData.fileName} onChange={v => setFormData({...formData, fileName: v})} testId="input-doc-filename" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm text-slate-500 hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createDoc.isPending} data-testid="button-submit-staff-doc"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {createDoc.isPending ? "Adding..." : (isFr ? "Ajouter un document" : "Add Document")}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="animate-pulse space-y-2">
          {[1, 2].map(i => <div key={i} className="h-16 bg-muted rounded-xl" />)}
        </div>
      ) : docs?.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100 border border-dashed border-border">
          <FileText className="w-10 h-10 mx-auto text-slate-500/30 mb-2" />
          <p className="text-slate-500 text-sm">No documents uploaded yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs?.map(doc => (
            <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/20 border border-border hover:bg-muted/40 transition-colors" data-testid={`staff-doc-${doc.id}`}>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{doc.title}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">{staffDocTypeLabels[doc.documentType] || doc.documentType}</span>
                    {doc.description && <span className="text-xs text-slate-500">— {doc.description}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${doc.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-slate-500"}`}>
                  {doc.status}
                </span>
                {isGM && (
                  <button onClick={() => deleteDoc.mutate(doc.id)} data-testid={`button-delete-staff-doc-${doc.id}`}
                    className="p-1 rounded-lg text-slate-500 hover:text-destructive hover:bg-destructive/5 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, required, type, testId, v }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; testId: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <input type={type || "text"} required={required} value={value} onChange={e => onChange(e.target.value)} data-testid={testId}
        className="w-full px-3 py-2.5 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background text-sm" />
    </div>
  );
}

function InfoFieldModal({ icon: IconComp, label, value }: { icon?: typeof Mail; label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        {IconComp && <IconComp className="w-3 h-3" />}
        {label}
      </p>
      <p className="text-sm font-medium">{value || <span className="text-slate-500/50 italic">Not set</span>}</p>
    </div>
  );
}

function SetPasswordModal({ staffId, staffName, onClose }: { staffId: number; staffName: string; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const { toast } = useToast();
  const _queryClient = useQueryClient();

  const setPasswordMutation = useMutation({
    mutationFn: async (pw: string) => {
      await apiRequest("POST", `/api/crm/staff/${staffId}/set-password`, { password: pw });
    },
    onSuccess: () => {
      toast({ title: "Password Set", description: `Password has been set for ${staffName}.` });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to set password");
    }
  });

  const validatePw = (pw: string): string | null => {
    if (pw.length < 12) return "Password must be at least 12 characters";
    if (!/[A-Z]/.test(pw)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(pw)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(pw)) return "Password must contain at least one number";
    if (!/[!@#$%^&*()\-_=+\[\]{}|;':",.<>/?`~\\]/.test(pw)) return "Password must contain at least one special character (e.g. ! @ # $ %)";
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const pwError = validatePw(password);
    if (pwError) { setError(pwError); return; }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setPasswordMutation.mutate(password);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-8 w-full max-w-md mx-4" data-testid="modal-set-password">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-slate-900">Set Password</h2>
          <button onClick={onClose} data-testid="button-close-set-password" className="p-2 rounded-xl hover:bg-muted/50 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Set a login password for <span className="font-semibold text-foreground">{staffName}</span>
        </p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-4 text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-700">Password requirements:</p>
          <p>• Minimum 12 characters</p>
          <p>• At least one uppercase letter, one lowercase letter, one number, and one special character (e.g. ! @ # $ %)</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl" data-testid="text-set-password-error">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold">New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 12 characters"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              data-testid="input-set-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
              data-testid="input-confirm-set-password"
            />
          </div>
          <button
            type="submit"
            disabled={setPasswordMutation.isPending}
            data-testid="button-submit-set-password"
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {setPasswordMutation.isPending ? "Setting..." : "Set Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StaffEmailStatus({ staffId }: { staffId: number }) {
  const { data: emailConfig } = useQuery<{ hasConfig: boolean; isActive: boolean; provider: string | null }>({
    queryKey: ["/api/crm/email/config", staffId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/email/config/${staffId}`, { credentials: "include" });
      if (!res.ok) return { hasConfig: false, isActive: false, provider: null };
      return res.json();
    },
  });

  const providerNames: Record<string, string> = {
    gmail: "Gmail",
    outlook: "Outlook",
    imap_smtp: "IMAP/SMTP",
  };

  if (!emailConfig) return null;

  return (
    <div className="border-t border-border pt-4" data-testid={`staff-email-status-${staffId}`}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
        <Mail className="w-3.5 h-3.5" /> Email Configuration
      </p>
      {emailConfig.isActive ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span className="text-sm font-medium text-emerald-700">Connected</span>
          {emailConfig.provider && (
            <span className="text-xs text-slate-500">({providerNames[emailConfig.provider] ?? emailConfig.provider})</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-sm font-medium text-amber-700">Not configured</span>
          <span className="text-xs text-slate-500">(Advisor will be prompted on login)</span>
        </div>
      )}
    </div>
  );
}
