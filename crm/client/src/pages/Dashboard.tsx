import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { AppLayout } from "@/components/AppLayout";
import { useCurrentStaff, useAdvisorsByAdmin } from "@/hooks/use-users";
import { useClients } from "@/hooks/use-clients";
import {
  Users, TrendingUp, ShieldCheck, Activity, ChevronRight, ArrowLeft, Shield, Mail, Phone, Briefcase, Eye, DollarSign, Target, BarChart3, LineChart, RefreshCw, AlertCircle, Mic
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { useQuery } from "@tanstack/react-query";
import type { StaffMember, Client } from "@shared/schema";
import { useLanguage } from "@/contexts/LanguageContext";

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

const aumData = [
  { name: 'Jan', value: 4000000 },
  { name: 'Feb', value: 4500000 },
  { name: 'Mar', value: 4200000 },
  { name: 'Apr', value: 5100000 },
  { name: 'May', value: 4800000 },
  { name: 'Jun', value: 5800000 },
  { name: 'Jul', value: 6200000 },
];

const distributionData = [
  { name: 'Mutual Funds', value: 45 },
  { name: 'Segregated', value: 30 },
  { name: 'Insurance', value: 25 },
];

const distributionDataFr = [
  { name: 'Fonds communs', value: 45 },
  { name: 'Fonds distincts', value: 30 },
  { name: 'Assurance', value: 25 },
];

export default function Dashboard() {
  const { data: currentStaff } = useCurrentStaff();
  const role = currentStaff?.role;

  if (role === "sales_manager") {
    return <SalesManagerDashboard currentStaff={currentStaff!} />;
  }

  return <OverviewDashboard />;
}

function OverviewDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { isFrench } = useLanguage();

  const formatAUM = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const today = new Date().toLocaleDateString(isFrench ? "fr-CA" : "en-CA", {
    weekday: "long", month: "long", day: "numeric",
  });

  const kpiCards = isFrench
    ? [
        { label: "Actif total géré",      value: statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0),     icon: DollarSign, color: "text-violet-600",   bg: "bg-violet-50",   href: "/clients" },
        { label: "Clients actifs",         value: statsLoading ? "—" : String(stats?.activeClients ?? 0),  icon: Users,      color: "text-violet-600",   bg: "bg-violet-50",   href: "/clients" },
        { label: "Prospects en pipeline",  value: statsLoading ? "—" : String(stats?.leadsCount ?? 0),     icon: Target,     color: "text-amber-600",  bg: "bg-amber-50",  href: "/pipeline" },
        { label: "Propositions en cours",  value: statsLoading ? "—" : String(stats?.pendingSales ?? 0),   icon: Activity,   color: "text-violet-600", bg: "bg-violet-50", href: "/pipeline?stage=proposal" },
      ]
    : [
        { label: "Total AUM",         value: statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0),     icon: DollarSign, color: "text-violet-600",   bg: "bg-violet-50",   href: "/clients" },
        { label: "Active Clients",    value: statsLoading ? "—" : String(stats?.activeClients ?? 0),  icon: Users,      color: "text-violet-600",   bg: "bg-violet-50",   href: "/clients" },
        { label: "Leads in Pipeline", value: statsLoading ? "—" : String(stats?.leadsCount ?? 0),     icon: Target,     color: "text-amber-600",  bg: "bg-amber-50",  href: "/pipeline" },
        { label: "Pending Proposals", value: statsLoading ? "—" : String(stats?.pendingSales ?? 0),   icon: Activity,   color: "text-violet-600", bg: "bg-violet-50", href: "/pipeline?stage=proposal" },
      ];

  return (
    <AppLayout>
      <div className="fp-insightled" style={{ minHeight: "100%", padding: "2rem" }}>

        {/* ── Page header ───────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--text-tertiary)" }}>{today}</p>
            <h1 className="text-2xl font-bold tracking-tight mt-0.5" style={{ color: "var(--text-primary)" }} data-testid="text-page-title">
              {isFrench ? "Vue d'ensemble" : "Practice Overview"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/meeting-recorder")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-secondary/90 text-secondary-foreground text-xs font-semibold rounded-lg transition-colors">
              <Mic className="w-3.5 h-3.5" />
              {isFrench ? "Enregistrer réunion" : "Record Meeting"}
            </button>
            <button onClick={() => setLocation("/clients")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors">
              <Users className="w-3.5 h-3.5" />
              {isFrench ? "Voir les clients" : "View Clients"}
            </button>
          </div>
        </div>

        {/* ── KPI stat bar ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(s => (
            <button key={s.label} onClick={() => setLocation(s.href)}
              className="fp-insightled-card p-5 text-left hover:shadow-md transition-shadow group cursor-pointer">
              <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--text-tertiary)" }}>{s.label}</p>
              <p className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>{s.value}</p>
            </button>
          ))}
        </div>

        {/* ── Charts row ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 fp-insightled-card p-5" data-testid="stat-total-aum">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                  {isFrench ? "Croissance de l'actif géré" : "AUM Growth"}
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {statsLoading ? "—" : formatAUM(stats?.totalAUM ?? 0)}
                  <span className="ml-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">↑ 12.4%</span>
                </p>
              </div>
            </div>
            <div className="h-[180px]"><AUMChart /></div>
          </div>

          <div className="fp-insightled-card p-5" data-testid="card-product-distribution">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
              {isFrench ? "Répartition des produits" : "Product Mix"}
            </p>
            <ProductDistributionChart isFrench={isFrench} />
          </div>
        </div>

        {/* ── Market watchlist ──────────────────────────────────────────── */}
        <div className="fp-insightled-card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4">
            {isFrench ? "Surveillance des marchés" : "Market Watch"}
          </p>
          <MarketWatchlistWidget />
        </div>

      </div>
    </AppLayout>
  );
}

function SalesManagerDashboard({ currentStaff }: { currentStaff: StaffMember }) {
  const { isFrench } = useLanguage();
  const [selectedAdvisor, setSelectedAdvisor] = useState<StaffMember | null>(null);
  const { data: teamAdvisors, isLoading: teamLoading } = useAdvisorsByAdmin(currentStaff.id);

  if (selectedAdvisor) {
    return (
      <AppLayout>
        <AdvisorDrillDown advisor={selectedAdvisor} onBack={() => setSelectedAdvisor(null)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-lg font-bold text-slate-900" data-testid="text-page-title">
            {isFrench ? "Tableau de bord de l'équipe" : "Team Dashboard"}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isFrench
              ? `Bonjour, ${currentStaff.firstName}. Voici un aperçu de votre équipe.`
              : `Welcome back, ${currentStaff.firstName}. Here's your team at a glance.`}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title={isFrench ? "Membres de l'équipe" : "Team Members"}
            value={String(teamAdvisors?.length ?? 0)}
            trend="" isPositive={true} icon={Users}
            color="bg-purple-500/10 text-purple-600"
          />
          <TeamStatsCards advisorIds={teamAdvisors?.map(a => a.id) ?? []} />
        </div>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3" data-testid="text-team-heading">
            {isFrench ? "Votre équipe" : "Your Team"}
          </p>
          {teamLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1, 2, 3].map(i => <div key={i} className="h-56 bg-white border border-slate-200 rounded-xl" />)}
            </div>
          ) : !teamAdvisors || teamAdvisors.length === 0 ? (
            <div className="text-center py-16 bg-white border border-slate-200 rounded-xl border-dashed">
              <Users className="w-14 h-14 mx-auto text-slate-500/20 mb-3" />
              <h3 className="text-lg font-bold">{isFrench ? "Aucun membre" : "No Team Members"}</h3>
              <p className="text-sm text-slate-500 mt-0.5">
                {isFrench ? "Aucun conseiller n'est actuellement assigné à votre équipe." : "No advisors are currently assigned to your team."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teamAdvisors.map(advisor => (
                <TeamMemberCard key={advisor.id} advisor={advisor} onClick={() => setSelectedAdvisor(advisor)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function TeamStatsCards({ advisorIds }: { advisorIds: number[] }) {
  const { data: allClients } = useClients();
  const { isFrench } = useLanguage();
  const teamClients = allClients?.filter(c => c.advisorId && advisorIds.includes(c.advisorId)) ?? [];

  return (
    <>
      <StatCard title={isFrench ? "Total clients" : "Total Clients"}       value={String(teamClients.length)} trend="" isPositive={true} icon={Briefcase}   color="bg-secondary/10 text-secondary" />
      <StatCard title={isFrench ? "Polices actives" : "Active Policies"}   value="--"                         trend="" isPositive={true} icon={ShieldCheck}  color="bg-violet-500/10 text-violet-500" />
      <StatCard title={isFrench ? "Actions en attente" : "Pending Actions"} value="--"                        trend="" isPositive={true} icon={Activity}     color="bg-orange-500/10 text-orange-500" />
    </>
  );
}

function TeamMemberCard({ advisor, onClick }: { advisor: StaffMember; onClick: () => void }) {
  const { isFrench } = useLanguage();
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
    <div onClick={onClick}
      className="bg-white border border-slate-200 rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow duration-150 border-2 border-transparent hover:border-primary/10 group relative overflow-hidden"
      data-testid={`card-team-member-${advisor.id}`}
    >
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-400 to-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-lg">
          {advisor.firstName[0]}{advisor.lastName[0]}
        </div>
        <div className="w-8 h-8 rounded-full bg-background border border-border flex items-center justify-center text-slate-500 group-hover:text-primary group-hover:bg-primary/5 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>

      <h3 className="text-base font-bold text-slate-900 group-hover:text-primary transition-colors" data-testid={`text-advisor-name-${advisor.id}`}>
        {advisor.firstName} {advisor.lastName}
      </h3>

      <div className="flex items-center gap-2 mt-2">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
          <Shield className="w-3 h-3" />
          {isFrench ? "Conseiller" : "Advisor"}
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
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

      <div className="mt-5 pt-3 border-t border-border">
        {isLoading ? (
          <div className="h-4 bg-muted rounded animate-pulse w-24" />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground" data-testid={`text-client-count-${advisor.id}`}>
              {clientCount} {isFrench ? `client${clientCount !== 1 ? "s" : ""}` : `client${clientCount !== 1 ? "s" : ""}`}
            </span>
            <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">
              {isFrench ? "Voir détails →" : "View Details →"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function AdvisorDrillDown({ advisor, onBack }: { advisor: StaffMember; onBack: () => void }) {
  const { isFrench } = useLanguage();
  const { data: advisorClients, isLoading: clientsLoading } = useQuery<Client[]>({
    queryKey: ["/api/crm/staff", advisor.id, "clients"],
    queryFn: async () => {
      const res = await fetch(`/api/crm/staff/${advisor.id}/clients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });

  const clientCount = advisorClients?.length ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button onClick={onBack} data-testid="button-back-to-team"
          className="p-2.5 rounded-xl bg-white border border-border text-slate-500 hover:text-primary hover:border-primary/30 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900" data-testid="text-advisor-overview-name">
            {advisor.firstName} {advisor.lastName}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isFrench ? "Aperçu de la performance et portefeuille clients." : "Advisor performance overview and client portfolio."}
          </p>
        </div>
        <Link href={`/clients?advisorId=${advisor.id}`} data-testid="button-view-all-clients"
          className="flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-lg transition-colors">
          <Eye className="w-5 h-5" />
          <span>{isFrench ? "Voir tous les clients" : "View All Clients"}</span>
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xl">
            {advisor.firstName[0]}{advisor.lastName[0]}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">{advisor.firstName} {advisor.lastName}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
              <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {advisor.email}</span>
              {advisor.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {advisor.phone}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title={isFrench ? "Clients actifs" : "Active Clients"}      value={String(clientCount)} trend="" isPositive={true} icon={Users}       color="bg-secondary/10 text-secondary" />
        <StatCard title={isFrench ? "Actif total géré" : "Total AUM"}         value="--"                  trend="" isPositive={true} icon={TrendingUp}   color="bg-primary/10 text-primary" />
        <StatCard title={isFrench ? "Polices actives" : "Active Policies"}    value="--"                  trend="" isPositive={true} icon={ShieldCheck}  color="bg-violet-500/10 text-violet-500" />
        <StatCard title={isFrench ? "Actions en attente" : "Pending Actions"} value="--"                  trend="" isPositive={true} icon={Activity}     color="bg-orange-500/10 text-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {isFrench ? "Croissance de l'actif (cumulatif annuel)" : "AUM Growth (YTD)"}
          </h3>
          <AUMChart />
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            {isFrench ? "Répartition des produits" : "Product Distribution"}
          </h3>
          <ProductDistributionChart isFrench={isFrench} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900" data-testid="text-recent-clients">
            {isFrench ? "Clients récents" : "Recent Clients"}
          </h2>
          <Link href={`/clients?advisorId=${advisor.id}`}
            className="text-sm font-semibold text-primary hover:underline flex items-center gap-1"
            data-testid="link-view-all-clients">
            {isFrench ? "Voir tous" : "View All"} <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {clientsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white border border-slate-200 rounded-xl" />)}
          </div>
        ) : !advisorClients || advisorClients.length === 0 ? (
          <div className="text-center py-12 bg-white border border-slate-200 rounded-xl border-dashed">
            <Users className="w-12 h-12 mx-auto text-slate-500/20 mb-3" />
            <h3 className="text-lg font-bold">{isFrench ? "Aucun client" : "No Clients"}</h3>
            <p className="text-slate-500 mt-1 text-sm">
              {isFrench ? "Aucun client n'est assigné à ce conseiller." : "This advisor has no clients assigned yet."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {advisorClients.slice(0, 6).map(client => (
              <Link key={client.id} href={`/clients/${client.id}`} className="block group" data-testid={`card-advisor-client-${client.id}`}>
                <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group-hover:border-primary/20">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                      {client.firstName[0]}{client.lastName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate group-hover:text-primary transition-colors">
                        {client.firstName} {client.lastName}
                      </p>
                      <p className="text-sm text-slate-500 truncate">{client.email}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-primary" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AUMChart() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={aumData}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} dy={10} />
          <YAxis axisLine={false} tickLine={false} tick={{fill: 'hsl(var(--muted-foreground))'}} tickFormatter={(v) => `$${(v/1000000).toFixed(1)}M`} dx={-10} />
          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} formatter={(v: number) => [`$${v.toLocaleString()}`, 'AUM']} />
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ProductDistributionChart({ isFrench }: { isFrench: boolean }) {
  const data = isFrench ? distributionDataFr : distributionData;
  return (
    <div className="flex-1 w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{top: 0, right: 20, left: 10, bottom: 0}}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
          <XAxis type="number" hide />
          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={130} tick={{fill: 'hsl(var(--foreground))', fontWeight: 500, fontSize: 13}} />
          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }} formatter={(v: number) => [`${v}%`, isFrench ? 'Part' : 'Share']} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {data.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : index === 1 ? 'hsl(var(--secondary))' : '#3b82f6'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface MarketQuote {
  symbol: string; name: string; price: number;
  change: number; changePercent: number; live?: boolean;
}

function MarketWatchlistWidget() {
  const { isFrench } = useLanguage();
  const [viewType, setViewType] = useState<"funds" | "stocks">(() => {
    const stored = localStorage.getItem("compasscrm_watchlist_view");
    return stored === "stocks" ? "stocks" : "funds";
  });

  useEffect(() => {
    localStorage.setItem("compasscrm_watchlist_view", viewType);
  }, [viewType]);

  const { data: quotes, isLoading, isError, refetch } = useQuery<MarketQuote[]>({
    queryKey: ["/api/crm/market/quotes", viewType],
    queryFn: async () => {
      const res = await fetch(`/api/crm/market/quotes?type=${viewType}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch market data");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col" data-testid="card-market-watchlist">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            {isFrench ? "Surveillance des marchés" : "Market Watch"}
          </p>
          <p className="text-[10px] text-slate-400 mt-0.5">
            TSX · {quotes?.[0] && (quotes[0] as any).live === false ? (isFrench ? "instantané" : "snapshot") : (isFrench ? "cours en direct" : "live quotes")}
          </p>
        </div>
        <button onClick={() => refetch()} data-testid="button-refresh-watchlist"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
          title={isFrench ? "Actualiser" : "Refresh"}>
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex bg-slate-50 rounded-lg p-0.5 mb-3 border border-slate-100">
        <button onClick={() => setViewType("funds")} data-testid="button-watchlist-funds"
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${viewType === "funds" ? "bg-white shadow-sm text-violet-700 border border-slate-200" : "text-slate-400 hover:text-slate-700"}`}>
          <BarChart3 className="w-3 h-3" /> {isFrench ? "FNB" : "ETFs"}
        </button>
        <button onClick={() => setViewType("stocks")} data-testid="button-watchlist-stocks"
          className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-semibold transition-all ${viewType === "stocks" ? "bg-white shadow-sm text-violet-700 border border-slate-200" : "text-slate-400 hover:text-slate-700"}`}>
          <LineChart className="w-3 h-3" /> {isFrench ? "Actions" : "Stocks"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <div key={i} className="h-10 bg-muted/50 rounded-lg animate-pulse" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-8 text-center" data-testid="watchlist-error">
            <AlertCircle className="w-8 h-8 text-slate-500/30 mb-2" />
            <p className="text-sm text-slate-500">{isFrench ? "Données indisponibles" : "Market data unavailable"}</p>
            <button onClick={() => refetch()} className="text-xs text-primary hover:underline mt-1" data-testid="button-retry-watchlist">
              {isFrench ? "Réessayer" : "Retry"}
            </button>
          </div>
        ) : quotes && quotes.length > 0 ? (
          quotes.map((q) => (
            <div key={q.symbol} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0" data-testid={`watchlist-row-${q.symbol}`}>
              <div className="min-w-0 flex-1 mr-2">
                <p className="text-xs font-semibold text-slate-900 truncate" data-testid={`text-watchlist-name-${q.symbol}`}>{q.name}</p>
                <p className="text-[10px] text-slate-400 font-mono">{q.symbol.replace(".TO", "")}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold tabular-nums text-slate-900 font-mono" data-testid={`text-watchlist-price-${q.symbol}`}>
                  {q.price > 0 ? `$${q.price.toFixed(2)}` : "—"}
                </p>
                <p className={`text-[10px] font-semibold tabular-nums ${q.change > 0 ? "text-emerald-600" : q.change < 0 ? "text-red-500" : "text-slate-400"}`} data-testid={`text-watchlist-change-${q.symbol}`}>
                  {q.change > 0 ? "▲ +" : q.change < 0 ? "▼ " : ""}{q.changePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-slate-500">{isFrench ? "Aucune donnée disponible" : "No data available"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, isPositive, icon: Icon, color }: {
  title: string; value: string; trend: string; isPositive: boolean;
  icon: typeof TrendingUp; color: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={`px-2.5 py-1 rounded-full text-sm font-semibold ${isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-slate-500 font-medium">{title}</p>
      <h3 className="text-xl font-bold text-slate-900 mt-1">{value}</h3>
    </div>
  );
}
