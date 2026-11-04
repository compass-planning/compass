/**
 * HouseholdContextPanel.tsx
 * Left panel: household topology + operational records tabs.
 * Spouse looked up via spouseId from allClients.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Users, Shield, Calendar, Flag, Briefcase, Phone,
  ChevronDown, ChevronUp, Loader2, ClipboardList, Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { differenceInYears } from "date-fns";

interface HouseholdClient { id: number; firstName: string; lastName: string; dateOfBirth?: string | null; occupation?: string | null; annualIncome?: string | number | null; email?: string | null; phone?: string | null; cell?: string | null; province?: string | null; retirementAge?: number | null; spouseId?: number | null; spouseFirstName?: string | null; }
interface Policy { type?: string; coverageAmount?: string | number; }
interface Goal { id: number; title: string; targetDate?: string | null; status: string; }
interface Child { id: number; name: string; dateOfBirth?: string | null; }

function age(dob?: string | null): string {
  if (!dob) return "";
  try { return `Age ${differenceInYears(new Date(), new Date(dob))}`; }
  catch { return ""; }
}

function ContextRow({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "risk" }) {
  const valClass = tone === "ok" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "risk" ? "text-red-600" : "text-slate-800";
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
      <span className="text-[11px] text-slate-500 truncate mr-2">{label}</span>
      <span className={cn("text-[11px] font-semibold flex-shrink-0", valClass)}>{value}</span>
    </div>
  );
}

function SectionToggle({ label, icon: Icon, children, defaultOpen = true }: {
  label: string; icon: typeof Users; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full mb-2 group">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-violet-500" />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</h2>
        </div>
        {open ? <ChevronUp className="h-3 w-3 text-slate-400" /> : <ChevronDown className="h-3 w-3 text-slate-400" />}
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </section>
  );
}

function MemberCard({ name, role, dob, income }: { name: string; role: string; dob?: string | null; income?: string | null }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-slate-900">{name}</p>
        <span className="text-[10px] text-slate-400">{age(dob)}</span>
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5">{role}</p>
      {income && <p className="text-[11px] text-violet-600 font-medium mt-0.5">${Number(income).toLocaleString()}/yr</p>}
    </div>
  );
}

type OpsTab = "products" | "documents" | "meetings" | "activity";

interface Props {
  client: HouseholdClient;
  clientId: number;
  allClients?: HouseholdClient[];
  ProductsTab:  React.ComponentType<{ clientId: number }>;
  DocumentsTab: React.ComponentType<{ clientId: number }>;
  MeetingsTab:  React.ComponentType<{ clientId: number }>;
  ActivityTab:  React.ComponentType<{ clientId: number }>;
}

export function HouseholdContextPanel({
  client, clientId, allClients = [],
  ProductsTab, DocumentsTab, MeetingsTab, ActivityTab,
}: Props) {
  const { isFrench: isFr } = useLanguage();
  const [opsTab, setOpsTab] = useState<OpsTab>("meetings");
  const [opsOpen, setOpsOpen] = useState(true);

  // Spouse via spouseId lookup
  const spouse = client.spouseId
    ? allClients.find((c: HouseholdClient) => c.id === client.spouseId) ?? null
    : null;

  const { data: policies = [], isLoading: polLoading } = useQuery<Policy[]>({
    queryKey: ["/api/crm/clients/:id/policies", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/policies`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ["/api/crm/clients/:id/goals", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/goals`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const { data: children = [] } = useQuery<Child[]>({
    queryKey: ["/api/crm/clients/:id/children", clientId],
    queryFn: () => fetch(`/api/crm/clients/${clientId}/children`, { credentials: "include" }).then(r => r.ok ? r.json() : []),
  });

  const lifePolicy  = policies.filter((p: Policy) => ["Term Life","Whole Life","Universal Life"].some(t => (p.type ?? "").includes(t)));
  const activeGoals = goals.filter((g: Goal) => g.status !== "completed");

  const opsTabs: { key: OpsTab; label: string; icon: typeof Briefcase }[] = [
    { key: "meetings",  label: isFr ? "Réunions" : "Meetings",  icon: Calendar },
    { key: "products",  label: isFr ? "Produits" : "Products",  icon: Briefcase },
    { key: "documents", label: isFr ? "Documents" : "Documents", icon: ClipboardList },
    { key: "activity",  label: isFr ? "Activité" : "Activity",  icon: Activity },
  ];

  return (
    <aside className="w-full h-full bg-white border border-slate-200 rounded-xl overflow-y-auto flex-shrink-0 shadow-sm">
      <div className="p-3 space-y-4">

        {/* Household members */}
        <SectionToggle label={isFr ? "Ménage" : "Household"} icon={Users}>
          <MemberCard
            name={`${client.firstName} ${client.lastName}`}
            role={`${isFr ? "Principal" : "Primary"}${client.occupation ? ` · ${client.occupation}` : ""}`}
            dob={client.dateOfBirth}
            income={client.annualIncome}
          />
          {spouse ? (
            <MemberCard
              name={`${spouse.firstName} ${spouse.lastName}`}
              role={`${isFr ? "Conjoint" : "Spouse"}${spouse.occupation ? ` · ${spouse.occupation}` : ""}`}
              dob={spouse.dateOfBirth}
              income={spouse.annualIncome}
            />
          ) : client.spouseId ? (
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
              <p className="text-[11px] text-slate-400">{isFr ? "Conjoint lié (chargement...)" : "Spouse linked (loading...)"}</p>
            </div>
          ) : null}
          {children.map((c: Child) => (
            <MemberCard key={c.id} name={c.name} role={isFr ? "Enfant" : "Child"} dob={c.dateOfBirth} />
          ))}
        </SectionToggle>

        {/* Contact */}
        <SectionToggle label={isFr ? "Contact" : "Contact"} icon={Phone} defaultOpen={false}>
          {client.email    && <ContextRow label={isFr ? "Courriel" : "Email"}    value={client.email} />}
          {client.phone    && <ContextRow label={isFr ? "Téléphone" : "Phone"}    value={client.phone} />}
          {client.cell     && <ContextRow label={isFr ? "Cellulaire" : "Cell"}     value={client.cell} />}
          {client.province && <ContextRow label={isFr ? "Province" : "Province"} value={client.province} />}
          {client.annualIncome && <ContextRow label={isFr ? "Revenu" : "Income"} value={`$${Number(client.annualIncome).toLocaleString()}`} />}
          {client.retirementAge && <ContextRow label={isFr ? "Âge ret. cible" : "Target Ret. Age"} value={`Age ${client.retirementAge}`} />}
        </SectionToggle>

        {/* Protection */}
        <SectionToggle label={isFr ? "Protection" : "Protection"} icon={Shield} defaultOpen={false}>
          {polLoading ? (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin mx-auto my-2" />
          ) : policies.length === 0 ? (
            <ContextRow label={isFr ? "Assurance vie" : "Life Insurance"} value={isFr ? "Non vérifié" : "Not verified"} tone="warn" />
          ) : (
            <>
              {lifePolicy.length > 0 ? (
                <ContextRow label={isFr ? "Couverture vie" : "Life Coverage"} value={`$${Math.round(lifePolicy.reduce((s: number, p: Policy) => s + Number(p.coverageAmount || 0), 0) / 1000)}K`} tone="ok" />
              ) : (
                <ContextRow label={isFr ? "Assurance vie" : "Life Insurance"} value={isFr ? "Lacune détectée" : "Gap detected"} tone="risk" />
              )}
              <p className="text-[10px] text-slate-400 px-1">{policies.length} polic{policies.length === 1 ? "y" : "ies"} total</p>
            </>
          )}
        </SectionToggle>

        {/* Goals */}
        <SectionToggle label={isFr ? "Objectifs" : "Goals"} icon={Flag} defaultOpen={false}>
          {activeGoals.length === 0 ? (
            <p className="text-[11px] text-slate-400 px-1">{isFr ? "Aucun objectif actif" : "No active goals"}</p>
          ) : activeGoals.slice(0, 4).map((g: Goal) => (
            <ContextRow key={g.id} label={g.title} value={g.targetDate ? g.targetDate.substring(0, 4) : g.status} />
          ))}
        </SectionToggle>

        {/* ── Operational Records ─────────────────────────────────────── */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button
            onClick={() => setOpsOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Briefcase className="w-3.5 h-3.5 text-violet-500" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{isFr ? "Dossiers" : "Records"}</span>
            </div>
            {opsOpen ? <ChevronUp className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
          </button>

          {opsOpen && (
            <>
              {/* Tab strip */}
              <div className="flex border-b border-slate-100 bg-white">
                {opsTabs.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setOpsTab(t.key)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-0.5 px-1 py-2 text-[10px] font-medium border-b-2 transition-colors",
                      opsTab === t.key
                        ? "border-violet-500 text-violet-700 bg-violet-50/50"
                        : "border-transparent text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                    )}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="p-3 bg-white max-h-[400px] overflow-y-auto">
                {opsTab === "products"  && <ProductsTab  clientId={clientId} />}
                {opsTab === "documents" && <DocumentsTab clientId={clientId} />}
                {opsTab === "meetings"  && <MeetingsTab  clientId={clientId} />}
                {opsTab === "activity"  && <ActivityTab  clientId={clientId} />}
              </div>
            </>
          )}
        </div>

      </div>
    </aside>
  );
}
