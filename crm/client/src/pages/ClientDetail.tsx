import { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { useClient, useClients, useUpdateClient, useCreateClient } from "@/hooks/use-clients";
import { useClientProducts, useCreateProduct } from "@/hooks/use-products";
import { useClientMeetings, useCreateMeeting, useUploadMeetingAudio, useSummarizeMeeting, useTeamsMeetings, useImportTeamsMeeting, useSendNotetaker, useMeetingOutputs, useMeetingTasks, useUpdateMeetingTask, useReviewCompliance, useMeetingConsent, useRecordConsent } from "@/hooks/use-meetings";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import type { TeamsMeeting } from "@/hooks/use-meetings";
import { api } from "@shared/routes";
import { useClientPlans, useCreatePlan, useUpdatePlan, useDeletePlan, useNetWorthEntries, useCreateNetWorthEntry, useUpdateNetWorthEntry, useDeleteNetWorthEntry, useRetirementProjections, useCreateRetirementProjection, useDeleteRetirementProjection, useInsuranceAnalyses, useCreateInsuranceAnalysis, useDeleteInsuranceAnalysis, useEstatePlanningNotes } from "@/hooks/use-plans";
import { useClientChildren, useCreateChild, useDeleteChild } from "@/hooks/use-children";
import { useClientDocuments, useCreateDocument, useDeleteDocument } from "@/hooks/use-documents";
import { useClientActivities, useCreateActivity, useDeleteActivity } from "@/hooks/use-activities";
import { useClientLead } from "@/hooks/use-leads";
import { useTasks } from "@/hooks/use-tasks";
import { useClientCarrierFiles, useRequestCarrierFiles, downloadCarrierFile } from "@/hooks/use-carrier-files";
import { Briefcase, Calendar, Target, Brain, Plus, Mic, Square, Loader2, FileText, CheckCircle2, Mail, Phone, Receipt, ScrollText, Smartphone, Building2, MapPin, Cake, Heart, Edit, X, Users, Baby, Trash2, ClipboardList, Activity, UserPlus, ExternalLink, Shield, Video, Download, AlertCircle, Table2, FolderDown, Bot, Eye, ShieldCheck, Send, ChevronDown, ChevronUp, Circle, Pause, Play, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWindowManager } from "@/contexts/WindowManagerContext";
import { format, differenceInYears } from "date-fns";
import type { Client, Child, CarrierFileType, StaffMember } from "@shared/schema";
import { maritalStatuses, preferredContactMethods, pensionTypes, documentTypes, activityTypes } from "@shared/schema";
import { useStaffMembers, useCurrentStaff } from "@/hooks/use-users";
import { useCompanySettings } from "@/hooks/use-company";
import { RetirementTab } from "@/components/planning/RetirementProjectionForm";
import { ClientProfileSection } from "@/components/ClientProfileSection";
import { HouseholdWorkspaceSidebar, type WorkspaceSection } from "@/components/HouseholdWorkspaceSidebar";
import { GoalsTab } from "@/pages/GoalsTab";
import { PensionTab } from "@/pages/PensionTab";
import { ExpensesTab } from "@/pages/ExpensesTab";
import { InsightLedDashboard } from "@/components/InsightLedDashboard";
import { NetWorthTab as MultiEntryNetWorthTab } from "@/pages/MultiEntryTabs";

const maritalLabels: Record<string, string> = {
  single: "Single",
  married: "Married",
  divorced: "Divorced",
  widowed: "Widowed",
  common_law: "Common Law",
  separated: "Separated",
};

const contactLabels: Record<string, string> = {
  email: "Personal Email",
  phone: "Home Phone",
  cell: "Cell Phone",
  work_email: "Work Email",
  work_phone: "Work Phone",
};

const pensionLabels: Record<string, string> = {
  defined_benefit: "Defined Benefit",
  defined_contribution: "Defined Contribution",
  non_contributory: "Non-Contributory",
  rrsp_matching: "RRSP Matching",
  none: "No Pension",
};

const documentTypeLabels: Record<string, string> = {
  beneficiary_change: "Beneficiary Change",
  initial_intake: "Initial Intake Assessment",
  kyc_form: "KYC Form",
  policy_application: "Policy Application",
  disclosure: "Disclosure",
  consent_form: "Consent Form",
  carrier_download: "Carrier Download",
  other: "Other",
};

const activityTypeLabels: Record<string, string> = {
  phone_call: "Phone Call",
  appointment: "Appointment",
  email: "Email",
  follow_up: "Follow Up",
  note: "Note",
};

const activityTypeIcons: Record<string, string> = {
  phone_call: "phone",
  appointment: "calendar",
  email: "mail",
  follow_up: "clock",
  note: "file-text",
};

export function ClientDetailContent({ clientId }: { clientId: number }) {
  const { data: client, isLoading: isClientLoading } = useClient(clientId);
  const { data: allClients } = useClients();
  const { data: originatingLead } = useClientLead(clientId);
  const [activeTab, setActiveTab] = useState<'products' | 'meetings' | 'plans' | 'documents' | 'activity' | 'carrier-files'>('products');
  const [isEditOpen, setIsEditOpen] = useState(false);

  if (isClientLoading) return <div className="animate-pulse h-96 bg-white rounded-xl" />;
  if (!client) return <div className="text-center py-8 text-slate-500">Client not found</div>;
  const spouse = client.spouseId ? allClients?.find(c => c.id === client.spouseId) : null;
  const age = client.dateOfBirth ? Math.floor((Date.now() - new Date(client.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold text-slate-900 text-foreground">{client.firstName} {client.lastName}</h2>
        <button onClick={() => setIsEditOpen(true)} className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors">
          <Edit className="w-4 h-4" />
        </button>
      </div>
      {client.maritalStatus && (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-slate-500">
            <Heart className="w-3 h-3" /> {maritalLabels[client.maritalStatus] || client.maritalStatus}
          </span>
          {age !== null && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-muted text-slate-500">
              <Cake className="w-3 h-3" /> Age {age}
            </span>
          )}
        </div>
      )}
      <div className="space-y-4">
  <div className="grid grid-cols-2 gap-3 text-sm">
    {client.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-slate-500" /> {client.email}</div>}
    {client.phone && <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-slate-500" /> {client.phone}</div>}
    {client.cell && <div className="flex items-center gap-2"><Smartphone className="w-3.5 h-3.5 text-slate-500" /> {client.cell}</div>}
    {client.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-slate-500" /> {client.address}</div>}
  </div>
  <div className="flex flex-wrap gap-1.5">
    <TabButton active={activeTab === 'products'} onClick={() => setActiveTab('products')} icon={Briefcase} label="Products" />
    <TabButton active={activeTab === 'documents'} onClick={() => setActiveTab('documents')} icon={ClipboardList} label="Documents" />
    <TabButton active={activeTab === 'meetings'} onClick={() => setActiveTab('meetings')} icon={Calendar} label="Meetings" />
    <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={Activity} label="Activity" />
    <TabButton active={activeTab === 'plans'} onClick={() => setActiveTab('plans')} icon={Target} label="Plans" />
    <TabButton active={activeTab === 'carrier-files'} onClick={() => setActiveTab('carrier-files')} icon={FolderDown} label="Carrier Files" />
  </div>
</div>

{activeTab === 'plans' ? (
  <PlansTab clientId={clientId} />
) : (
  <div className="bg-white border border-slate-200 rounded-xl p-4 min-h-[200px]">
    {activeTab === 'products' && <ProductsTab clientId={clientId} />}
    {activeTab === 'documents' && <DocumentsTab clientId={clientId} />}
    {activeTab === 'meetings' && <MeetingsTab clientId={clientId} />}
    {activeTab === 'activity' && <ActivityTab clientId={clientId} />}
    {activeTab === 'carrier-files' && <CarrierFilesSection clientId={clientId} />}
  </div>
)}
      {isEditOpen && <EditClientModal client={client} allClients={allClients ?? []} onClose={() => setIsEditOpen(false)} />}
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const clientId = parseInt(id || "0");
  const { data: client, isLoading: isClientLoading } = useClient(clientId);
  const { data: allClients } = useClients();
  const [activeSection, setActiveSection] = useState<WorkspaceSection>("profile");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const { openWindow } = useWindowManager();
  const [, navigate] = useLocation();

  if (isClientLoading) return <AppLayout><div className="animate-pulse h-96 bg-white rounded-xl" /></AppLayout>;
  if (!client) return <AppLayout><div className="p-8 text-slate-500">Client not found</div></AppLayout>;

  const spouse = client.spouseId ? allClients?.find(c => c.id === client.spouseId) : null;

  const workspaceSidebar = (
    <HouseholdWorkspaceSidebar
      client={client as any}
      activeSection={activeSection}
      onSectionChange={setActiveSection}
    />
  );

  return (
    <AppLayout workspaceMode sidebarOverride={workspaceSidebar} noPadding>
      <div className="h-full overflow-auto">
        <WorkspaceContent
          client={client}
          spouse={spouse ?? null}
          clientId={clientId}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
          onEdit={() => setIsEditOpen(true)}
        />
      </div>
      {isEditOpen && (
        <EditClientModal
          client={client}
          allClients={allClients ?? []}
          onClose={() => setIsEditOpen(false)}
        />
      )}
    </AppLayout>
  );
}

// ── WorkspaceContent — renders the right pane based on active section ──────────

function WorkspaceContent({ client, activeSection, onSectionChange, spouse, clientId, s, onEdit }: {
  client: any;
  spouse: any | null;
  clientId: number;
  activeSection: WorkspaceSection;
  onSectionChange: (s: WorkspaceSection) => void;
  onEdit: () => void;
}) {
  return (
    <div className="p-6 space-y-0 min-h-full">

      {/* Section: Profile */}
      {activeSection === "profile" && (
        <ClientProfileSection client={client} />
      )}

      {/* Section: FP Overview */}
      {activeSection === "fp.overview" && (
        <InsightLedDashboard
          clientId={clientId}
          client={client}
          onNavigate={(tab) => {
            const map: Record<string, WorkspaceSection> = {
              retirement: "fp.retirement", insurance: "protection.insurance",
              goals: "fp.goals", networth: "fp.networth", documents: "documents.files",
            };
            onSectionChange(map[tab] ?? "fp.overview");
          }}
        />
      )}

      {/* Section: Net Worth */}
      {activeSection === "fp.networth" && (
        <div className="space-y-4">
          <SectionHeader title="Net Worth" subtitle="Assets, liabilities, and education accounts" />
          <MultiEntryNetWorthTab clientId={clientId} client={client} />
        </div>
      )}

      {/* Section: Goals */}
      {activeSection === "fp.goals" && (
        <div className="space-y-4">
          <SectionHeader title="Goals" subtitle="Financial milestones and planning targets" />
          <GoalsTab clientId={clientId} client={client} />
        </div>
      )}

      {/* Section: Retirement */}
      {activeSection === "fp.retirement" && (
        <div className="space-y-4">
          <SectionHeader title="Retirement Planning" subtitle="Projections, scenarios, and income planning" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <RetirementTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Cash Flow */}
      {activeSection === "fp.cashflow" && (
        <div className="space-y-4">
          <SectionHeader title="Cash Flow & Expenses" subtitle="Monthly and annual spending analysis" />
          <ExpensesTab clientId={clientId} client={client} />
        </div>
      )}

      {/* Section: Pension */}
      {activeSection === "fp.pension" && (
        <div className="space-y-4">
          <SectionHeader title="Pension & Benefits" subtitle="Employer plans, CPP/OAS, defined benefits" />
          <PensionTab clientId={clientId} client={client} />
        </div>
      )}

      {/* Section: Insurance */}
      {activeSection === "protection.insurance" && (
        <div className="space-y-4">
          <SectionHeader title="Insurance & Protection" subtitle="Life, disability, critical illness coverage" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <ProductsTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Gap Analysis */}
      {activeSection === "protection.gaps" && (
        <div className="space-y-4">
          <SectionHeader title="Coverage Gap Analysis" subtitle="Identify protection shortfalls" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[300px]">
            <InsuranceAnalysisSection clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Estate */}
      {activeSection === "estate.estate" && (
        <div className="space-y-4">
          <SectionHeader title="Estate Planning" subtitle="Wills, beneficiaries, and estate notes" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <EstateNotesSection clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Tax */}
      {activeSection === "estate.tax" && (
        <div className="space-y-4">
          <SectionHeader title="Tax Planning" subtitle="Strategies, analyses, and planning notes" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <TaxNotesSection clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Meetings */}
      {activeSection === "activity.meetings" && (
        <div className="space-y-4">
          <SectionHeader title="Meetings" subtitle="Recordings, transcripts, and notes" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <MeetingsTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Activity Log */}
      {activeSection === "activity.notes" && (
        <div className="space-y-4">
          <SectionHeader title="Activity Log" subtitle="Compliance audit trail" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <ActivityTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Tasks */}
      {activeSection === "activity.tasks" && (
        <div className="space-y-4">
          <SectionHeader title="Tasks" subtitle="Actions and follow-ups for this client" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <ClientTasksSection clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Products */}
      {activeSection === "documents.policies" && (
        <div className="space-y-4">
          <SectionHeader title="Products & Policies" subtitle="All financial products on file" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <ProductsTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Documents */}
      {activeSection === "documents.files" && (
        <div className="space-y-4">
          <SectionHeader title="Documents & Files" subtitle="Statements, IPS, and uploads" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <DocumentsTab clientId={clientId} />
          </div>
        </div>
      )}

      {/* Section: Opportunities */}
      {activeSection === "opportunities" && (
        <div className="space-y-4">
          <SectionHeader title="AI Insights & Opportunities" subtitle="Recommendations and cross-sell opportunities" />
          <div className="bg-white border border-slate-200 rounded-xl p-6 min-h-[400px]">
            <AIInsightsSection clientId={clientId} />
          </div>
        </div>
      )}

    </div>
  );
}

// ── Section header ─────────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle, onEdit }: { title: string; subtitle?: string; onEdit?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {onEdit && (
        <button onClick={onEdit}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
          <Edit className="w-3 h-3" /> Edit Profile
        </button>
      )}
    </div>
  );
}

// ── Stub section components — wired to existing tabs ──────────────────────────

function InsuranceAnalysisSection({ clientId }: { clientId: number }) {
  const { data: analyses = [] } = useInsuranceAnalyses(clientId);
  if (analyses.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Shield className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No insurance analysis on file</p>
      <p className="text-xs text-slate-400 mt-1">Add a needs analysis to identify coverage gaps</p>
    </div>
  );
  return <div className="space-y-3">{analyses.map((a: any) => (
    <div key={a.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-sm font-semibold text-slate-900">{a.type || "Insurance Analysis"}</p>
      <p className="text-xs text-slate-500 mt-1">{a.notes || "No notes"}</p>
    </div>
  ))}</div>;
}

function EstateNotesSection({ clientId }: { clientId: number }) {
  const { data: notes = [] } = useEstatePlanningNotes(clientId);
  if (notes.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <ScrollText className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No estate planning notes</p>
      <p className="text-xs text-slate-400 mt-1">Add wills, POA, and beneficiary notes here</p>
    </div>
  );
  return <div className="space-y-3">{notes.map((n: any) => (
    <div key={n.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-sm font-semibold text-slate-900">{n.type || "Estate Note"}</p>
      <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{n.content || "No content"}</p>
    </div>
  ))}</div>;
}

function TaxNotesSection({ clientId }: { clientId: number }) {
  const analyses: any[] = []; // Tax analyses not yet in schema
  if (!analyses || (analyses as any[]).length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Receipt className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No tax planning notes</p>
      <p className="text-xs text-slate-400 mt-1">Add tax analyses and planning strategies</p>
    </div>
  );
  return <div className="space-y-3">{(analyses as any[]).map((a: any) => (
    <div key={a.id} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
      <p className="text-sm font-semibold text-slate-900">{a.year || "Tax Analysis"}</p>
      <p className="text-xs text-slate-500 mt-1">{a.notes || "No notes"}</p>
    </div>
  ))}</div>;
}

export function ClientTasksSection({ clientId }: { clientId: number }) {
  const { data: allTasks = [] } = useTasks();
  const tasks = (allTasks as any[]).filter((t: any) => t.clientId === clientId);
  if (tasks.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CheckSquare className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No tasks for this client</p>
      <p className="text-xs text-slate-400 mt-1">Tasks linked to this household will appear here</p>
    </div>
  );
  return <div className="space-y-2">{tasks.map((t: any) => (
    <div key={t.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === "completed" ? "bg-emerald-400" : t.priority === "high" || t.priority === "urgent" ? "bg-red-400" : "bg-amber-400"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${t.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>{t.title}</p>
        {t.dueDate && <p className="text-xs text-slate-400">{new Date(t.dueDate).toLocaleDateString("en-CA")}</p>}
      </div>
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${t.status === "completed" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"}`}>
        {t.status}
      </span>
    </div>
  ))}</div>;
}

function AIInsightsSection({ clientId }: { clientId: number }) {
  const { data: aiRecs = [] } = useQuery({
    queryKey: ["ai-recommendations"],
    queryFn: async () => {
      const r = await fetch(`/api/crm/clients/${clientId}/ai-recommendations`);
      if (!r.ok) return [];
      return r.json();
    },
  });
  if ((aiRecs as any[]).length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Brain className="w-10 h-10 text-slate-200 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No AI insights yet</p>
      <p className="text-xs text-slate-400 mt-1">Record a meeting to generate AI-powered recommendations</p>
    </div>
  );
  return <div className="space-y-3">{(aiRecs as any[]).map((r: any, i: number) => (
    <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-4">
      <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest mb-1">{r.category || "Insight"}</p>
      <p className="text-sm text-slate-800">{r.recommendation || r.content}</p>
    </div>
  ))}</div>;
}

function PersonalInfoCard({ client }: { client: Client }) {
  const c = client as any;
  const fields = [
    { label: "EMAIL", value: client.email },
    { label: "PHONE", value: client.phone || client.cell },
    { label: "DOB", value: client.dateOfBirth },
    { label: "PROVINCE", value: c.province },
    { label: "OCCUPATION", value: c.occupation },
    { label: "ANNUAL INCOME", value: c.annualIncome ? `$${Number(c.annualIncome).toLocaleString()}` : null },
    { label: "PENSION TYPE", value: client.pensionPlan ? (pensionLabels[client.pensionPlan] || client.pensionPlan) : null },
    { label: "RETIREMENT AGE", value: c.retirementAge ? String(c.retirementAge) : null },
    { label: "DESIRED INCOME", value: c.desiredRetirementIncome ? `$${Number(c.desiredRetirementIncome).toLocaleString()}` : null },
  ].filter(f => f.value);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-500" /> Personal Information
      </p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        {fields.map(f => (
          <div key={f.label} className="bg-slate-50 rounded-xl px-3 py-2">
            <p className="text-[10px] text-slate-400 mb-0.5">{f.label}</p>
            <p className="text-sm font-semibold text-slate-900">{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SpouseFamilyCard({ client, spouse }: { client: Client; spouse: Client | null | undefined }) {
  const { data: children } = useClientChildren(client.id);
  const createChild = useCreateChild();
  const deleteChild = useDeleteChild();
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChild, setNewChild] = useState({ name: "", dateOfBirth: "", sex: "", relationship: "child", otherParentName: "" });

  const handleAddChild = () => {
    createChild.mutate({ clientId: client.id, data: {
      name: newChild.name,
      dateOfBirth: newChild.dateOfBirth || null,
      sex: newChild.sex || null,
      relationship: newChild.relationship,
      otherParentName: newChild.relationship === "step-child" ? (newChild.otherParentName || null) : null,
    }}, {
      onSuccess: () => { setNewChild({ name: "", dateOfBirth: "", sex: "", relationship: "child", otherParentName: "" }); setShowAddChild(false); },
    });
  };
  const s = spouse as any;
  const spouseFields = spouse ? [
    { label: "NAME", value: `${s.firstName} ${s.lastName}` },
    { label: "DOB", value: s.dateOfBirth },
    { label: "OCCUPATION", value: s.occupation },
    { label: "INCOME", value: s.annualIncome ? `$${Number(s.annualIncome).toLocaleString()}` : null },
    { label: "RETIREMENT AGE", value: s.retirementAge ? String(s.retirementAge) : null },
    { label: "PENSION TYPE", value: s.pensionPlan ? (pensionLabels[s.pensionPlan] || s.pensionPlan) : null },
    { label: "DESIRED INCOME", value: s.desiredRetirementIncome ? `$${Number(s.desiredRetirementIncome).toLocaleString()}` : null },
  ].filter(f => f.value) : [];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
        <Users className="w-4 h-4 text-slate-500" /> Spouse / Family
      </p>
      {spouse ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
          {spouseFields.map(f => (
            <div key={f.label}>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{f.label}</p>
              <p className="text-sm font-medium text-foreground">{f.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500 mb-4">No spouse linked.</p>
      )}
      <div className="border-t border-border pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dependants</p>
          <button onClick={() => setShowAddChild(!showAddChild)} className="p-1 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {showAddChild && (
          <div className="mb-3 p-3 rounded-xl bg-muted/30 border border-border space-y-2">
            <input placeholder="Child's name" value={newChild.name} onChange={e => setNewChild({ ...newChild, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <input type="date" value={newChild.dateOfBirth} onChange={e => setNewChild({ ...newChild, dateOfBirth: e.target.value })} className="px-3 py-2 rounded-lg border border-border text-sm bg-background" />
              <select value={newChild.sex} onChange={e => setNewChild({ ...newChild, sex: e.target.value })} className="px-3 py-2 rounded-lg border border-border text-sm bg-background">
                <option value="">Sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <select value={newChild.relationship} onChange={e => setNewChild({ ...newChild, relationship: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background">
              <option value="child">Child</option>
              <option value="step-child">Step-Child</option>
              <option value="foster-child">Foster Child</option>
            </select>
            {newChild.relationship === "step-child" && (
              <input
                placeholder={`Other biological parent name (${spouse ? `not ${(spouse as any).firstName} ${(spouse as any).lastName}` : "other parent"})`}
                value={newChild.otherParentName}
                onChange={e => setNewChild({ ...newChild, otherParentName: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background"
              />
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddChild(false)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-muted">Cancel</button>
              <button type="button" onClick={handleAddChild} disabled={!newChild.name || createChild.isPending} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {createChild.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}
        {children && children.length > 0 ? (
          <div className="space-y-2">
            {children.map((child: Child) => {
              const childAge = child.dateOfBirth ? differenceInYears(new Date(), new Date(child.dateOfBirth + "T00:00:00")) : null;
              const rel = (child as any).relationship ?? "child";
              const otherParent = (child as any).otherParentName;
              return (
                <div key={child.id} className="flex items-center justify-between group">
                  <div>
                    <span className="text-sm font-medium text-foreground">{child.name}</span>
                    <span className={`text-xs ml-2 px-1.5 py-0.5 rounded font-medium ${rel === "step-child" ? "bg-amber-50 text-amber-700" : rel === "foster-child" ? "bg-purple-50 text-purple-700" : "bg-slate-100 text-slate-600"}`}>
                      {rel === "step-child" ? "Step-Child" : rel === "foster-child" ? "Foster" : "Child"}
                    </span>
                    {childAge !== null && <span className="text-xs text-slate-500 ml-2">age {childAge}</span>}
                    {rel === "step-child" && otherParent && <span className="text-xs text-slate-400 ml-2">· other parent: {otherParent}</span>}
                  </div>
                  <button onClick={() => deleteChild.mutate({ id: child.id, clientId: client.id })} className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No dependants recorded.</p>
        )}
      </div>
    </div>
  );
}

function ContactInfoCard({ client, spouse }: { client: Client; spouse: Client | null | undefined }) {
  const { data: children } = useClientChildren(client.id);
  const createChild = useCreateChild();
  const deleteChild = useDeleteChild();
  const [showAddChild, setShowAddChild] = useState(false);
  const [newChild, setNewChild] = useState({ name: "", dateOfBirth: "", sex: "" });

  const contactItems = [
    { icon: Mail, label: "Email", value: client.email, testId: "text-client-email" },
    { icon: Phone, label: "Home Phone", value: client.phone, testId: "text-client-phone" },
    { icon: Smartphone, label: "Cell", value: client.cell, testId: "text-client-cell" },
    { icon: Building2, label: "Work Phone", value: client.workPhone, testId: "text-client-work-phone" },
    { icon: Mail, label: "Work Email", value: client.workEmail, testId: "text-client-work-email" },
    { icon: MapPin, label: "Address", value: client.address, testId: "text-client-address" },
    { icon: Cake, label: "Date of Birth", value: client.dateOfBirth ? format(new Date(client.dateOfBirth + "T00:00:00"), 'MMMM d, yyyy') : null, testId: "text-client-dob" },
  ];

  const handleAddChild = () => {
    createChild.mutate({
      clientId: client.id,
      data: {
        name: newChild.name,
        dateOfBirth: newChild.dateOfBirth || null,
        sex: newChild.sex || null,
      },
    }, {
      onSuccess: () => {
        setNewChild({ name: "", dateOfBirth: "", sex: "" });
        setShowAddChild(false);
      },
    });
  };

  const hasEmploymentInfo = client.employerName || client.pensionPlan || (client.yearsAtJob !== null && client.yearsAtJob !== undefined);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-border p-6 space-y-5 h-fit" data-testid="card-contact-info">
      <h3 className="text-lg font-display font-bold text-foreground">Contact Information</h3>
      <div className="space-y-4">
        {contactItems.map(item => item.value && (
          <div key={item.label} className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-muted/50 text-slate-500 mt-0.5">
              <item.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{item.label}</p>
              <p className="text-sm font-medium text-foreground" data-testid={item.testId}>{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {hasEmploymentInfo && (
        <div className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Briefcase className="w-4 h-4" />
            Employment
          </h4>
          <div className="space-y-2">
            {client.employerName && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Employer</span>
                <span className="font-medium text-foreground" data-testid="text-employer">{client.employerName}</span>
              </div>
            )}
            {client.pensionPlan && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Pension</span>
                <span className="font-medium text-foreground" data-testid="text-pension">{pensionLabels[client.pensionPlan] || client.pensionPlan}</span>
              </div>
            )}
            {client.yearsAtJob !== null && client.yearsAtJob !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Tenure</span>
                <span className="font-medium text-foreground" data-testid="text-years-job">{client.yearsAtJob} year{client.yearsAtJob !== 1 ? 's' : ''}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {spouse && (
        <div className="border-t border-border pt-5">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Spouse
          </h4>
          <Link
            href={`/clients/${spouse.id}`}
            data-testid="link-spouse"
            className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
              {spouse.firstName[0]}{spouse.lastName[0]}
            </div>
            <div>
              <p className="font-semibold text-foreground group-hover:text-primary transition-colors" data-testid="text-spouse-name">
                {spouse.firstName} {spouse.lastName}
              </p>
              <p className="text-xs text-slate-500">{spouse.email}</p>
            </div>
          </Link>
        </div>
      )}

      <div className="border-t border-border pt-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Baby className="w-4 h-4" />
            Children
          </h4>
          <button
            onClick={() => setShowAddChild(!showAddChild)}
            data-testid="button-add-child"
            className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-primary/5 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {showAddChild && (
          <div className="mb-3 p-3 rounded-xl bg-muted/30 border border-border space-y-2" data-testid="form-add-child">
            <input
              placeholder="Child's name"
              value={newChild.name}
              onChange={e => setNewChild({ ...newChild, name: e.target.value })}
              data-testid="input-child-name"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={newChild.dateOfBirth}
                onChange={e => setNewChild({ ...newChild, dateOfBirth: e.target.value })}
                data-testid="input-child-dob"
                className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              />
              <select
                value={newChild.sex}
                onChange={e => setNewChild({ ...newChild, sex: e.target.value })}
                data-testid="select-child-sex"
                className="px-3 py-2 rounded-lg border border-border text-sm bg-background focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              >
                <option value="">Sex</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddChild(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddChild}
                disabled={!newChild.name || createChild.isPending}
                data-testid="button-submit-child"
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {createChild.isPending ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        )}

        {children && children.length > 0 ? (
          <div className="space-y-2">
            {children.map((child: Child) => {
              const childAge = child.dateOfBirth ? differenceInYears(new Date(), new Date(child.dateOfBirth + "T00:00:00")) : null;
              return (
                <div key={child.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 group" data-testid={`card-child-${child.id}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-violet-50 text-violet-500 flex items-center justify-center text-xs font-bold">
                      {child.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground" data-testid={`text-child-name-${child.id}`}>{child.name}</p>
                      <p className="text-xs text-slate-500">
                        {childAge !== null ? `Age ${childAge}` : ""}
                        {child.sex ? `${childAge !== null ? " \u2022 " : ""}${child.sex === "male" ? "M" : "F"}` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => deleteChild.mutate({ id: child.id, clientId: client.id })}
                    data-testid={`button-delete-child-${child.id}`}
                    className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No children recorded.</p>
        )}
      </div>

      {client.notes && (
        <div className="border-t border-border pt-5">
          <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Notes</h4>
          <p className="text-sm text-foreground/80">{client.notes}</p>
        </div>
      )}
    </div>
  );
}

function EditClientModal({ client, allClients, onClose }: { client: Client; allClients: Client[]; onClose: () => void }) {
  const { data: allStaff } = useStaffMembers();
  const { data: currentStaff } = useCurrentStaff();
  // Everyone gets the same server-driven list of who they may assign this client to
  // (GM / office admin: anyone; sales manager: GM + self + own team; advisor admin: their team; advisor: self).
  const { data: assignable } = useQuery<StaffMember[]>({ queryKey: ["/api/crm/staff/assignable-advisors"] });
  const advisors = assignable ?? [];
  const currentAssignee = client.advisorId ? allStaff?.find(u => u.id === client.advisorId) : undefined;
  const potentialSpouses = allClients.filter(c => c.id !== client.id);
  const updateClient = useUpdateClient();
  const [showCreateSpouse, setShowCreateSpouse] = useState(false);

  const [formData, setFormData] = useState({
    firstName: client.firstName,
    lastName: client.lastName,
    greeting: client.greeting || "",
    email: client.email,
    phone: client.phone || "",
    cell: client.cell || "",
    workPhone: client.workPhone || "",
    workEmail: client.workEmail || "",
    address: client.address || "",
    dateOfBirth: client.dateOfBirth || "",
    maritalStatus: client.maritalStatus || "",
    preferredContact: client.preferredContact || "",
    spouseId: client.spouseId ?? null,
    advisorId: client.advisorId ?? null,
    employerName: client.employerName || "",
    pensionPlan: client.pensionPlan || "",
    yearsAtJob: client.yearsAtJob?.toString() || "",
    notes: client.notes || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = { ...formData };
    if (!payload.phone) payload.phone = null;
    if (!payload.cell) payload.cell = null;
    if (!payload.workPhone) payload.workPhone = null;
    if (!payload.workEmail) payload.workEmail = null;
    if (!payload.address) payload.address = null;
    if (!payload.dateOfBirth) payload.dateOfBirth = null;
    if (!payload.maritalStatus) payload.maritalStatus = null;
    if (!payload.preferredContact) payload.preferredContact = null;
    if (!payload.employerName) payload.employerName = null;
    if (!payload.pensionPlan) payload.pensionPlan = null;
    if (!payload.greeting) payload.greeting = null;
    if (!payload.notes) payload.notes = null;
    payload.yearsAtJob = payload.yearsAtJob ? Number(payload.yearsAtJob) : null;
    updateClient.mutate({ id: client.id, ...payload }, { onSuccess: () => onClose() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-border bg-background/50 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Edit Client Profile</h2>
            <p className="text-sm text-slate-500 mt-1">Update {client.firstName}'s contact and personal details.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto" data-testid="form-edit-client">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">First Name</label>
              <input required value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} data-testid="input-edit-client-first-name" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Last Name</label>
              <input required value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} data-testid="input-edit-client-last-name" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="edit-greeting" className="text-sm font-semibold text-foreground">Greeting / Preferred Name</label>
            <input id="edit-greeting" value={formData.greeting} onChange={e => setFormData({...formData, greeting: e.target.value})} placeholder="e.g. Dr. Smith, Bobby, etc." data-testid="input-edit-client-greeting" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            <p className="text-xs text-slate-500">How the client prefers to be addressed</p>
          </div>

          <fieldset className="border border-border rounded-2xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-foreground px-2">Contact Details</legend>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Personal Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} data-testid="input-edit-client-email" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Work Email</label>
                <input type="email" value={formData.workEmail} onChange={e => setFormData({...formData, workEmail: e.target.value})} data-testid="input-edit-client-work-email" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Home Phone</label>
                <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} data-testid="input-edit-client-phone" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Cell</label>
                <input type="tel" value={formData.cell} onChange={e => setFormData({...formData, cell: e.target.value})} data-testid="input-edit-client-cell" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Work Phone</label>
                <input type="tel" value={formData.workPhone} onChange={e => setFormData({...formData, workPhone: e.target.value})} data-testid="input-edit-client-work-phone" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-500">Preferred Contact Method</label>
              <select value={formData.preferredContact} onChange={e => setFormData({...formData, preferredContact: e.target.value})} data-testid="select-edit-preferred-contact" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                <option value="">Not specified</option>
                {preferredContactMethods.map(m => (
                  <option key={m} value={m}>{contactLabels[m]}</option>
                ))}
              </select>
            </div>
          </fieldset>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Address</label>
            <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} data-testid="input-edit-client-address" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date of Birth</label>
              <input type="date" value={formData.dateOfBirth} onChange={e => setFormData({...formData, dateOfBirth: e.target.value})} data-testid="input-edit-client-dob" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Marital Status</label>
              <select value={formData.maritalStatus} onChange={e => setFormData({...formData, maritalStatus: e.target.value})} data-testid="select-edit-marital-status" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                <option value="">Not specified</option>
                {maritalStatuses.map(s => (
                  <option key={s} value={s}>{maritalLabels[s]}</option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="border border-border rounded-2xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-foreground px-2">Employment</legend>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Employer Name</label>
                <input value={formData.employerName} onChange={e => setFormData({...formData, employerName: e.target.value})} data-testid="input-edit-employer" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Pension Plan</label>
                <select value={formData.pensionPlan} onChange={e => setFormData({...formData, pensionPlan: e.target.value})} data-testid="select-edit-pension" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  <option value="">Not specified</option>
                  {pensionTypes.map(p => (
                    <option key={p} value={p}>{pensionLabels[p]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Years at Job</label>
                <input type="number" min="0" value={formData.yearsAtJob} onChange={e => setFormData({...formData, yearsAtJob: e.target.value})} data-testid="input-edit-years-job" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Spouse</label>
              <select value={formData.spouseId ?? ""} onChange={e => setFormData({...formData, spouseId: e.target.value ? Number(e.target.value) : null})} data-testid="select-edit-spouse" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                <option value="">No spouse linked</option>
                {potentialSpouses.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
                ))}
              </select>
              {(formData.maritalStatus === "married" || formData.maritalStatus === "common_law") && !formData.spouseId && (
                <button
                  type="button"
                  onClick={() => setShowCreateSpouse(true)}
                  data-testid="button-create-spouse-account"
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 hover:border-primary/50 transition-all text-sm font-semibold"
                >
                  <UserPlus className="w-4 h-4" />
                  Create Spouse Account
                </button>
              )}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Assigned To</label>
              <select value={formData.advisorId ?? ""} onChange={e => setFormData({...formData, advisorId: e.target.value ? Number(e.target.value) : null})} data-testid="select-edit-advisor" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                {currentStaff?.role !== "advisor" && <option value="">No advisor assigned</option>}
                {currentAssignee && !advisors.some(a => a.id === currentAssignee.id) && (
                  <option value={currentAssignee.id}>{currentAssignee.firstName} {currentAssignee.lastName}</option>
                )}
                {advisors.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.firstName} {a.lastName}{a.role === "general_manager" ? " (General Manager)" : a.id === currentStaff?.id ? " (me)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Notes</label>
            <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} data-testid="input-edit-client-notes" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background min-h-[80px]" />
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={updateClient.isPending} data-testid="button-submit-edit-client" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50">
              {updateClient.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
      {showCreateSpouse && (
        <CreateSpouseFromClientModal
          client={client}
          onClose={() => setShowCreateSpouse(false)}
          onCreated={(newSpouseId) => {
            setFormData({ ...formData, spouseId: newSpouseId });
            setShowCreateSpouse(false);
          }}
        />
      )}
    </div>
  );
}

function CreateSpouseFromClientModal({ client, onClose, onCreated, spouseId }: { client: Client; onClose: () => void; onCreated: (spouseId: number) => void }) {
  const [spouseData, setSpouseData] = useState({
    firstName: "",
    lastName: client.lastName,
    email: "",
    phone: "",
    cell: "",
    address: client.address || "",
    dateOfBirth: "",
    maritalStatus: client.maritalStatus || "married",
    preferredContact: "",
    advisorId: client.advisorId,
    employerName: "",
    pensionPlan: "",
    yearsAtJob: "",
    notes: "",
  });
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, string | number | null> = {
      ...spouseData,
      spouseId: client.id,
    };
    if (!payload.phone) payload.phone = null;
    if (!payload.cell) payload.cell = null;
    if (!payload.address) payload.address = null;
    if (!payload.dateOfBirth) payload.dateOfBirth = null;
    if (!payload.maritalStatus) payload.maritalStatus = null;
    if (!payload.preferredContact) payload.preferredContact = null;
    if (!payload.employerName) payload.employerName = null;
    if (!payload.pensionPlan) payload.pensionPlan = null;
    if (!payload.notes) payload.notes = null;
    payload.yearsAtJob = payload.yearsAtJob ? Number(payload.yearsAtJob) : null;
    createClient.mutate(payload as Parameters<typeof createClient.mutate>[0], {
      onSuccess: (newSpouse: Client) => {
        updateClient.mutate({ id: client.id, spouseId: newSpouse.id });
        onCreated(newSpouse.id);
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border bg-rose-50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-rose-100">
              <UserPlus className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 text-foreground" data-testid="heading-create-spouse">Create Spouse Account</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Create a new client profile for {client.firstName}'s spouse. They will be automatically linked.
              </p>
            </div>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto" data-testid="form-create-spouse">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">First Name</label>
              <input required value={spouseData.firstName} onChange={e => setSpouseData({...spouseData, firstName: e.target.value})} data-testid="input-new-spouse-first-name" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" placeholder="First name" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Last Name</label>
              <input required value={spouseData.lastName} onChange={e => setSpouseData({...spouseData, lastName: e.target.value})} data-testid="input-new-spouse-last-name" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Email</label>
              <input type="email" required value={spouseData.email} onChange={e => setSpouseData({...spouseData, email: e.target.value})} data-testid="input-new-spouse-email" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Cell Phone</label>
              <input type="tel" value={spouseData.cell} onChange={e => setSpouseData({...spouseData, cell: e.target.value})} data-testid="input-new-spouse-cell" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Address</label>
            <input value={spouseData.address} onChange={e => setSpouseData({...spouseData, address: e.target.value})} data-testid="input-new-spouse-address" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Date of Birth</label>
              <input type="date" value={spouseData.dateOfBirth} onChange={e => setSpouseData({...spouseData, dateOfBirth: e.target.value})} data-testid="input-new-spouse-dob" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Preferred Contact</label>
              <select value={spouseData.preferredContact} onChange={e => setSpouseData({...spouseData, preferredContact: e.target.value})} data-testid="select-new-spouse-preferred-contact" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                <option value="">Not specified</option>
                {preferredContactMethods.map(m => (
                  <option key={m} value={m}>{contactLabels[m]}</option>
                ))}
              </select>
            </div>
          </div>
          <fieldset className="border border-border rounded-2xl p-4 space-y-4">
            <legend className="text-sm font-semibold text-foreground px-2">Employment</legend>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Employer Name</label>
                <input value={spouseData.employerName} onChange={e => setSpouseData({...spouseData, employerName: e.target.value})} data-testid="input-new-spouse-employer" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Pension Plan</label>
                <select value={spouseData.pensionPlan} onChange={e => setSpouseData({...spouseData, pensionPlan: e.target.value})} data-testid="select-new-spouse-pension" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  <option value="">Not specified</option>
                  {pensionTypes.map(p => (
                    <option key={p} value={p}>{pensionLabels[p]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-500">Years at Job</label>
                <input type="number" min="0" value={spouseData.yearsAtJob} onChange={e => setSpouseData({...spouseData, yearsAtJob: e.target.value})} data-testid="input-new-spouse-years-job" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
          </fieldset>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors" data-testid="button-cancel-create-spouse">
              Cancel
            </button>
            <button type="submit" disabled={createClient.isPending} data-testid="button-submit-create-spouse" className="px-6 py-3 rounded-xl font-semibold bg-rose-600 text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50">
              {createClient.isPending ? "Creating..." : "Create Spouse Profile"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const fileTypeLabels: Record<string, string> = {
  policy_statement: "Policy Statement",
  tax_slip: "Tax Slip",
  account_summary: "Account Summary",
  transaction_history: "Transaction History",
  confirmation_of_coverage: "Confirmation of Coverage",
  beneficiary_summary: "Beneficiary Summary",
};

function CarrierFilesSection({ clientId }: { clientId: number }) {
  const { data, isLoading } = useClientCarrierFiles(clientId);
  const { data: credentials = [] } = useQuery<{ id: number; carrierId: number; credentialType: string; label: string; isActive: boolean }[]>({
    queryKey: ["/api/crm/carrier-credentials"],
  });
  const { data: myCarriers = [] } = useQuery<{ id: number; carrierId: number; carrier: { id: number; name: string } }[]>({
    queryKey: ["/api/crm/my-carriers"],
  });
  const requestFiles = useRequestCarrierFiles();
  const queryClient = useQueryClient();

  const [showRequest, setShowRequest] = useState(false);
  const [selectedCarrier, setSelectedCarrier] = useState<number>(0);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [pollingRequestId, setPollingRequestId] = useState<number | null>(null);

  const { data: pollingData } = useQuery({
    queryKey: ["/api/crm/carrier-file-requests", pollingRequestId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/carrier-file-requests/${pollingRequestId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch request status");
      return res.json();
    },
    enabled: pollingRequestId !== null,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (d && (d.status === "completed" || d.status === "failed")) {
        return false;
      }
      return 2000;
    },
  });

  useEffect(() => {
    if (pollingData && (pollingData.status === "completed" || pollingData.status === "failed")) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", "carrier-files"] });
      if (pollingData.status === "completed") {
        queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", "documents"] });
        queryClient.invalidateQueries({ queryKey: ["/api/crm/clients/:clientId/products"] });
        setPollingRequestId(null);
        setShowRequest(false);
      }
    }
  }, [pollingData, queryClient]);

  const carriersWithCreds = myCarriers.filter(mc =>
    credentials.some(c => c.carrierId === mc.carrierId && c.isActive)
  );

  const toggleFileType = (ft: string) => {
    setSelectedTypes(prev =>
      prev.includes(ft) ? prev.filter(t => t !== ft) : [...prev, ft]
    );
  };

  const handleRequest = () => {
    requestFiles.mutate(
      { carrierId: selectedCarrier, fileTypes: selectedTypes as CarrierFileType[] },
      {
        onSuccess: (result: { request: { id: number } }) => {
          setPollingRequestId(result.request.id);
          setSelectedCarrier(0);
          setSelectedTypes([]);
        },
      }
    );
  };

  const requests = data?.requests ?? [];
  const files = data?.files ?? [];

  const hasLoadError = !isLoading && !data && clientId > 0;

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-amber-50 text-amber-700",
      processing: "bg-violet-50 text-violet-700",
      completed: "bg-emerald-50 text-emerald-700",
      failed: "bg-red-50 text-red-700",
      expired: "bg-gray-100 text-gray-500",
    };
    return (
      <span data-testid={`badge-status-${status}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-muted text-slate-500"}`}>
        {status === "processing" && <Loader2 className="w-3 h-3 animate-spin" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const fileIcon = (mimeType: string) => {
    if (mimeType?.includes("csv") || mimeType?.includes("spreadsheet")) {
      return <Table2 className="w-4 h-4 text-emerald-600" />;
    }
    return <FileText className="w-4 h-4 text-violet-600" />;
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted/50 rounded-xl" />)}
      </div>
    );
  }

  if (hasLoadError) {
    return (
      <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700" data-testid="text-carrier-files-load-error">
        <AlertCircle className="w-4 h-4 inline mr-1.5" />
        Failed to load carrier files. Please try refreshing the page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg">Carrier Files</h3>
          <p className="text-sm text-slate-500">Download policy statements, tax slips, and other documents from carriers.</p>
        </div>
        <button
          onClick={() => setShowRequest(true)}
          disabled={carriersWithCreds.length === 0}
          data-testid="button-request-carrier-files"
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <FolderDown className="w-4 h-4" /> Request Files
        </button>
      </div>

      {carriersWithCreds.length === 0 && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800" data-testid="text-no-carrier-creds-warning">
          <AlertCircle className="w-4 h-4 inline mr-1.5" />
          No carrier credentials configured. Go to Settings to add credentials before requesting files.
        </div>
      )}

      {showRequest && (
        <div className="p-5 rounded-xl bg-muted/20 border border-primary/20 space-y-4" data-testid="form-request-carrier-files">
          <h4 className="font-semibold text-sm">Request Files from Carrier</h4>

          {pollingRequestId && pollingData ? (
            <div className="text-center py-6 space-y-3">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
              <p className="text-sm font-medium">Processing request...</p>
              <p className="text-xs text-slate-500">Status: {pollingData.status}</p>
              {pollingData.status === "failed" && (
                <div className="text-sm text-red-600 mt-2">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  {pollingData.errorMessage ?? "Request failed"}
                  <button
                    onClick={() => { setPollingRequestId(null); }}
                    data-testid="button-dismiss-error"
                    className="block mx-auto mt-2 text-xs text-slate-500 hover:text-foreground underline"
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Carrier</label>
                <select
                  value={selectedCarrier}
                  onChange={e => setSelectedCarrier(Number(e.target.value))}
                  data-testid="select-request-carrier"
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                >
                  <option value={0}>-- Select carrier --</option>
                  {carriersWithCreds.map(mc => (
                    <option key={mc.carrierId} value={mc.carrierId}>
                      {mc.carrier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-2">File Types</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(fileTypeLabels).map(([key, lbl]) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer transition-colors text-sm ${
                        selectedTypes.includes(key) ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(key)}
                        onChange={() => toggleFileType(key)}
                        data-testid={`checkbox-file-type-${key}`}
                        className="rounded border-border"
                      />
                      {lbl}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => { setShowRequest(false); setSelectedCarrier(0); setSelectedTypes([]); }}
                  data-testid="button-cancel-request"
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRequest}
                  disabled={!selectedCarrier || selectedTypes.length === 0 || requestFiles.isPending}
                  data-testid="button-submit-request"
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {requestFiles.isPending ? "Requesting..." : "Submit Request"}
                </button>
              </div>

              {requestFiles.isError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" data-testid="text-request-error">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Failed to submit file request. Please try again.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Recent Requests</h4>
          {requests.map(req => (
            <div
              key={req.id}
              data-testid={`card-carrier-request-${req.id}`}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
                  <FolderDown className="w-4 h-4 text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{req.carrierName}</p>
                  <p className="text-xs text-slate-500">
                    {req.fileTypes.map(ft => fileTypeLabels[ft] ?? ft).join(", ")}
                    {req.requestedAt && ` — ${format(new Date(req.requestedAt), "MMM d, yyyy h:mm a")}`}
                  </p>
                </div>
              </div>
              {statusBadge(req.status)}
            </div>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Downloaded Files</h4>
          {files.map(file => (
            <div
              key={file.id}
              data-testid={`card-carrier-file-${file.id}`}
              className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center">
                  {fileIcon(file.mimeType)}
                </div>
                <div>
                  <p className="text-sm font-semibold">{file.fileName}</p>
                  <p className="text-xs text-slate-500">
                    {file.carrierName} — {fileTypeLabels[file.fileType] ?? file.fileType}
                    {file.fileSizeBytes > 0 && ` — ${(file.fileSizeBytes / 1024).toFixed(1)} KB`}
                    {file.expiresAt && ` — Expires ${format(new Date(file.expiresAt), "MMM d, yyyy")}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(file.status)}
                {file.status === "available" && (
                  <button
                    onClick={() => downloadCarrierFile(file.id, file.fileName)}
                    data-testid={`button-download-file-${file.id}`}
                    className="p-2 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {requests.length === 0 && files.length === 0 && carriersWithCreds.length > 0 && (
        <div className="text-center py-12 text-slate-500">
          <FolderDown className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No carrier files yet</p>
          <p className="text-xs mt-1">Request files from your linked carriers to get started.</p>
        </div>
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: any) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200
        ${active
          ? "bg-primary text-primary-foreground shadow-md"
          : "text-slate-500 hover:text-foreground hover:bg-white"
        }
      `}
    >
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}

function ProductsTab({ clientId }: { clientId: number }) {
  const { data: products } = useClientProducts(clientId);
  const [isAddOpen, setIsAddOpen] = useState(false);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">Portfolio Products</h2>
        <button onClick={() => setIsAddOpen(true)} data-testid="button-add-product" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Product</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="table-products">
          <thead>
            <tr className="border-b border-border text-sm text-slate-500">
              <th className="pb-4 font-semibold">Type</th>
              <th className="pb-4 font-semibold">Provider</th>
              <th className="pb-4 font-semibold">Policy #</th>
              <th className="pb-4 font-semibold">Value</th>
              <th className="pb-4 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {products?.map(p => (
              <tr key={p.id} className="hover:bg-muted/50 transition-colors" data-testid={`row-product-${p.id}`}>
                <td className="py-4 font-medium capitalize">{p.type.replace('_', ' ')}</td>
                <td className="py-4">{p.provider}</td>
                <td className="py-4 font-mono text-xs">{p.policyNumber}</td>
                <td className="py-4 font-semibold">${parseFloat(p.value.toString()).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                <td className="py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                    p.status === 'active' ? 'bg-green-100 text-green-700' :
                    p.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                  }`}>{p.status}</span>
                </td>
              </tr>
            ))}
            {products?.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-slate-500">No products found. Add one to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isAddOpen && <AddProductModal clientId={clientId} onClose={() => setIsAddOpen(false)} />}
    </div>
  );
}

function AddProductModal({ onClose, clientId }: { clientId: number; onClose: () => void }) {
  const { data: companyConfig } = useCompanySettings();
  const { data: myCarriers = [] } = useQuery<{ id: number; carrierId: number; carrier: { id: number; name: string; type: string } }[]>({ queryKey: ["/api/crm/my-carriers"] });
  const allProductTypes = [
    { value: "insurance", label: "Insurance", moduleKey: "moduleInsurance" as const },
    { value: "mutual_fund", label: "Mutual Fund", moduleKey: "moduleMutualFund" as const },
    { value: "segregated_fund", label: "Segregated Fund", moduleKey: "moduleSegFund" as const },
  ];
  const availableTypes = allProductTypes.filter(pt => !companyConfig || companyConfig[pt.moduleKey] !== false);
  const [formData, setFormData] = useState({ type: availableTypes[0]?.value ?? "", provider: "", policyNumber: "", value: "", status: "active" });
  const createProduct = useCreateProduct();
  const noTypesAvailable = availableTypes.length === 0;

  const carriersForType = myCarriers
    .filter(mc => mc.carrier.type === formData.type)
    .map(mc => mc.carrier);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noTypesAvailable || !formData.type || !formData.provider) return;
    createProduct.mutate({ data: formData }, { onSuccess: () => onClose() });
  };

  if (noTypesAvailable) {
    return (
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900 mb-4">No Product Types Available</h2>
          <p className="text-slate-500 mb-6">All product modules are currently disabled. Ask your General Manager to enable Insurance, Mutual Fund, or Segregated Fund modules in Company Settings.</p>
          <button onClick={onClose} data-testid="button-close-no-products" className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Add Product</h2>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-add-product">
          <div>
            <label className="text-sm font-semibold">Type</label>
            <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value, provider: ""})} data-testid="select-product-type" className="w-full px-4 py-3 rounded-xl border mt-1">
              {availableTypes.map(pt => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold">Provider</label>
            {carriersForType.length > 0 ? (
              <select
                required
                value={formData.provider}
                onChange={e => setFormData({...formData, provider: e.target.value})}
                data-testid="select-product-provider"
                className="w-full px-4 py-3 rounded-xl border mt-1"
              >
                <option value="">-- Select Provider --</option>
                {carriersForType.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            ) : (
              <div className="mt-1">
                <p className="text-sm text-amber-600 dark:text-amber-400 py-3" data-testid="text-no-carriers-warning">No carriers selected for this product type. Go to Settings &gt; My Carriers to add carriers first.</p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold">Policy Number</label>
              <input required value={formData.policyNumber} onChange={e => setFormData({...formData, policyNumber: e.target.value})} data-testid="input-product-policy" className="w-full px-4 py-3 rounded-xl border mt-1" />
            </div>
            <div>
              <label className="text-sm font-semibold">Value ($)</label>
              <input type="number" step="0.01" required value={formData.value} onChange={e => setFormData({...formData, value: e.target.value})} data-testid="input-product-value" className="w-full px-4 py-3 rounded-xl border mt-1" />
            </div>
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createProduct.isPending || carriersForType.length === 0} data-testid="button-submit-product" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground disabled:opacity-50">{createProduct.isPending ? "Adding..." : "Add Product"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DocumentsTab({ clientId }: { clientId: number }) {
  const { data: docs } = useClientDocuments(clientId);
  const createDocument = useCreateDocument();
  const deleteDocument = useDeleteDocument();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    documentType: "other",
    description: "",
    signedDate: "",
    fileName: "",
    status: "pending",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = { ...formData };
    if (!payload.description) payload.description = null;
    if (!payload.signedDate) payload.signedDate = null;
    if (!payload.fileName) payload.fileName = null;
    createDocument.mutate({ data: payload }, {
      onSuccess: () => {
        setIsAddOpen(false);
        setFormData({ title: "", documentType: "other", description: "", signedDate: "", fileName: "", status: "pending" });
      }
    });
  };

  const statusColors: Record<string, string> = {
    signed: "bg-green-100 text-green-700",
    pending: "bg-orange-100 text-orange-700",
    expired: "bg-red-100 text-red-700",
    draft: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900" data-testid="text-documents-title">Documents & Forms</h2>
        <button onClick={() => setIsAddOpen(true)} data-testid="button-add-document" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Document</span>
        </button>
      </div>

      {isAddOpen && (
        <div className="bg-muted/30 rounded-2xl border border-border p-5 space-y-4 animate-in slide-in-from-top-2 duration-200" data-testid="form-add-document">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Document Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-doc-title" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" placeholder="e.g. Beneficiary Change - 2026" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Document Type</label>
                <select value={formData.documentType} onChange={e => setFormData({...formData, documentType: e.target.value})} data-testid="select-doc-type" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  {documentTypes.map(t => (
                    <option key={t} value={t}>{documentTypeLabels[t]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Date Signed</label>
                <input type="date" value={formData.signedDate} onChange={e => setFormData({...formData, signedDate: e.target.value})} data-testid="input-doc-signed-date" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Status</label>
                <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} data-testid="select-doc-status" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  <option value="pending">Pending</option>
                  <option value="signed">Signed</option>
                  <option value="expired">Expired</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">File Reference</label>
                <input value={formData.fileName} onChange={e => setFormData({...formData, fileName: e.target.value})} data-testid="input-doc-filename" placeholder="Optional file name" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Description</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} data-testid="input-doc-description" placeholder="Additional notes about this document" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background min-h-[60px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createDocument.isPending} data-testid="button-submit-document" className="px-4 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50">
                {createDocument.isPending ? "Saving..." : "Save Document"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse" data-testid="table-documents">
          <thead>
            <tr className="border-b border-border text-sm text-slate-500">
              <th className="pb-4 font-semibold">Document</th>
              <th className="pb-4 font-semibold">Type</th>
              <th className="pb-4 font-semibold">Date Signed</th>
              <th className="pb-4 font-semibold">Status</th>
              <th className="pb-4 font-semibold w-12"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {docs?.map(doc => (
              <tr key={doc.id} className="hover:bg-muted/50 transition-colors group" data-testid={`row-document-${doc.id}`}>
                <td className="py-4">
                  <div className="flex items-center gap-2">
                    {doc.documentType === "carrier_download" && (
                      <FolderDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    )}
                    <div>
                      <p className="font-medium text-foreground" data-testid={`text-doc-title-${doc.id}`}>{doc.title}</p>
                      {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
                      {doc.fileName && !doc.fileName.startsWith("carrier-file:") && <p className="text-xs text-slate-500 mt-0.5 font-mono">{doc.fileName}</p>}
                    </div>
                  </div>
                </td>
                <td className="py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${doc.documentType === "carrier_download" ? "bg-amber-50 text-amber-700" : "bg-violet-50 text-violet-700"}`}>{documentTypeLabels[doc.documentType] || doc.documentType}</span>
                </td>
                <td className="py-4 text-slate-500">
                  {doc.signedDate ? format(new Date(doc.signedDate + "T00:00:00"), 'MMM d, yyyy') : "—"}
                </td>
                <td className="py-4">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[doc.status] || "bg-gray-100 text-gray-600"}`}>{doc.status}</span>
                </td>
                <td className="py-4">
                  <div className="flex items-center gap-1">
                    {doc.fileName?.startsWith("carrier-file:") && (
                      <button
                        onClick={() => {
                          const fileId = doc.fileName!.replace("carrier-file:", "");
                          downloadCarrierFile(Number(fileId), doc.title);
                        }}
                        data-testid={`button-download-doc-${doc.id}`}
                        className="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-all"
                        title="Download carrier file"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteDocument.mutate({ id: doc.id })}
                      data-testid={`button-delete-doc-${doc.id}`}
                      className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {docs?.length === 0 && (
              <tr><td colSpan={5} className="py-12 text-center text-slate-500">
                <ClipboardList className="w-10 h-10 mx-auto mb-3 text-slate-500/30" />
                No documents recorded. Add one to track signed forms and paperwork.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ActivityTab({ clientId }: { clientId: number }) {
  const { data: activities } = useClientActivities(clientId);
  const { data: allStaff } = useStaffMembers();
  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [formData, setFormData] = useState({
    activityType: "phone_call",
    title: "",
    description: "",
    date: new Date().toISOString().slice(0, 16),
    duration: "",
    staffId: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, any> = {
      activityType: formData.activityType,
      title: formData.title,
      description: formData.description || null,
      date: new Date(formData.date).toISOString(),
      duration: formData.duration ? Number(formData.duration) : null,
      staffId: formData.staffId ? Number(formData.staffId) : null,
    };
    createActivity.mutate({ data: payload }, {
      onSuccess: () => {
        setIsAddOpen(false);
        setFormData({ activityType: "phone_call", title: "", description: "", date: new Date().toISOString().slice(0, 16), duration: "", staffId: "" });
      }
    });
  };

  const activityColorMap: Record<string, string> = {
    phone_call: "bg-violet-50 text-violet-600 border-violet-200",
    appointment: "bg-purple-50 text-purple-600 border-purple-200",
    email: "bg-green-50 text-green-600 border-green-200",
    follow_up: "bg-orange-50 text-orange-600 border-orange-200",
    note: "bg-gray-50 text-gray-600 border-gray-200",
  };

  const sortedActivities = activities?.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900" data-testid="text-activity-title">Activity Log</h2>
        <button onClick={() => setIsAddOpen(true)} data-testid="button-add-activity" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Log Activity</span>
        </button>
      </div>

      {isAddOpen && (
        <div className="bg-muted/30 rounded-2xl border border-border p-5 space-y-4 animate-in slide-in-from-top-2 duration-200" data-testid="form-add-activity">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Activity Type</label>
                <select value={formData.activityType} onChange={e => setFormData({...formData, activityType: e.target.value})} data-testid="select-activity-type" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  {activityTypes.map(t => (
                    <option key={t} value={t}>{activityTypeLabels[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Title</label>
                <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-activity-title" placeholder="e.g. Discussed portfolio rebalancing" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Date & Time</label>
                <input type="datetime-local" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} data-testid="input-activity-date" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Duration (min)</label>
                <input type="number" min="0" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} data-testid="input-activity-duration" placeholder="Optional" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Staff Member</label>
                <select value={formData.staffId} onChange={e => setFormData({...formData, staffId: e.target.value})} data-testid="select-activity-staff" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background">
                  <option value="">Not assigned</option>
                  {allStaff?.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">Notes</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} data-testid="input-activity-description" placeholder="Details about this interaction" className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background min-h-[60px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsAddOpen(false)} className="px-4 py-2 rounded-xl font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
              <button type="submit" disabled={createActivity.isPending} data-testid="button-submit-activity" className="px-4 py-2 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm disabled:opacity-50">
                {createActivity.isPending ? "Saving..." : "Log Activity"}
              </button>
            </div>
          </form>
        </div>
      )}

      {sortedActivities && sortedActivities.length > 0 ? (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {sortedActivities.map(act => {
              const staffMember = act.staffId ? allStaff?.find(s => s.id === act.staffId) : null;
              return (
                <div key={act.id} className="relative pl-14 group" data-testid={`card-activity-${act.id}`}>
                  <div className={`absolute left-3.5 top-3 w-5 h-5 rounded-full border-2 ${activityColorMap[act.activityType] || "bg-gray-50 text-gray-600 border-gray-200"} flex items-center justify-center`}>
                    <div className="w-2 h-2 rounded-full bg-current" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${activityColorMap[act.activityType] || "bg-gray-100 text-gray-600"}`}>
                            {activityTypeLabels[act.activityType] || act.activityType}
                          </span>
                          {act.duration && (
                            <span className="text-xs text-slate-500">{act.duration} min</span>
                          )}
                        </div>
                        <p className="font-semibold text-foreground" data-testid={`text-activity-title-${act.id}`}>{act.title}</p>
                        {act.description && <p className="text-sm text-slate-500 mt-1">{act.description}</p>}
                        <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                          <span>{format(new Date(act.date), 'MMM d, yyyy h:mm a')}</span>
                          {staffMember && <span>by {staffMember.firstName} {staffMember.lastName}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => deleteActivity.mutate({ id: act.id })}
                        data-testid={`button-delete-activity-${act.id}`}
                        className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-slate-500">
          <Activity className="w-10 h-10 mx-auto mb-3 text-slate-500/30" />
          No activities logged. Start tracking calls, appointments, and emails.
        </div>
      )}
    </div>
  );
}

function MeetingsTab({ clientId }: { clientId: number }) {
  const { data: meetings } = useClientMeetings(clientId);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isTeamsImportOpen, setIsTeamsImportOpen] = useState(false);
  const [isScheduleTeamsOpen, setIsScheduleTeamsOpen] = useState(false);
  const uploadAudio = useUploadMeetingAudio();
  const summarize = useSummarizeMeeting();
  const [activeRecordingId, setActiveRecordingId] = useState<number | null>(null);
  const { data: companyConfig } = useCompanySettings();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-slate-900">Meeting History</h2>
        <div className="flex space-x-2">
          {companyConfig?.moduleMeetingRecorder && (
            <>
              <button
                onClick={() => setIsScheduleTeamsOpen(true)}
                data-testid="button-schedule-teams-meeting"
                className="flex items-center space-x-2 px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm"
              >
                <Video className="w-4 h-4" /><span>Schedule Teams Meeting</span>
              </button>
              <button
                onClick={() => setIsTeamsImportOpen(true)}
                data-testid="button-import-teams"
                className="flex items-center space-x-2 px-4 py-2 border border-violet-300 text-violet-700 dark:text-violet-400 font-semibold rounded-xl hover:bg-violet-50 dark:hover:bg-violet-950/20 transition-colors"
              >
                <Download className="w-4 h-4" /><span>Import from Teams</span>
              </button>
            </>
          )}
          <button onClick={() => setIsAddOpen(true)} data-testid="button-add-meeting" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
            <Plus className="w-4 h-4" /><span>Log Meeting</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {meetings?.map(m => (
          <MeetingCard key={m.id} meeting={m} clientId={clientId} activeRecordingId={activeRecordingId} setActiveRecordingId={setActiveRecordingId} uploadAudio={uploadAudio} summarize={summarize} companyConfig={companyConfig} />
        ))}
        {meetings?.length === 0 && (
          <div className="text-center py-12 text-slate-500">No meetings logged yet.</div>
        )}
      </div>

      {isAddOpen && <AddMeetingModal clientId={clientId} onClose={() => setIsAddOpen(false)} />}
      {isTeamsImportOpen && <TeamsImportModal clientId={clientId} onClose={() => setIsTeamsImportOpen(false)} />}
      {isScheduleTeamsOpen && <ScheduleTeamsMeetingModal clientId={clientId} onClose={() => setIsScheduleTeamsOpen(false)} />}
    </div>
  );
}

const recordingStatusConfig: Record<string, { label: string; color: string; icon: typeof Circle }> = {
  none: { label: "No Recording", color: "text-slate-500 bg-muted", icon: Circle },
  pending: { label: "Pending", color: "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-950/30", icon: Loader2 },
  joining: { label: "Bot Joining", color: "text-violet-700 bg-violet-100 dark:text-violet-400 dark:bg-violet-950/30", icon: Bot },
  recording: { label: "Recording", color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/30", icon: Mic },
  processing: { label: "Processing", color: "text-purple-700 bg-purple-100 dark:text-purple-400 dark:bg-purple-950/30", icon: Loader2 },
  done: { label: "Complete", color: "text-emerald-700 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950/30", icon: CheckCircle2 },
  error: { label: "Error", color: "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-950/30", icon: AlertCircle },
};

function MeetingCard({ meeting: m, clientId, activeRecordingId, setActiveRecordingId, uploadAudio, summarize, companyConfig, id, title, date, transcript, summary, recordingStatus, recallBotId, meetingJoinUrl, recordingUrl, platform }: {
  meeting: { id: number; title: string; date: Date | string; transcript: string | null; summary: string | null; recordingStatus: string | null; recallBotId: string | null; meetingJoinUrl: string | null; recordingUrl: string | null; platform: string | null };
  clientId: number;
  activeRecordingId: number | null;
  setActiveRecordingId: (id: number | null) => void;
  uploadAudio: { isPending: boolean; variables?: { id: number } };
  summarize: { mutate: (args: { id: number; clientId: number }) => void; isPending: boolean };
  companyConfig: { moduleMeetingRecorder?: boolean } | undefined;
}) {
  const [expanded, setExpanded] = useState(false);
  const [meetingUrlInput, setMeetingUrlInput] = useState("");
  const [showConsentModal, setShowConsentModal] = useState(false);
  const sendNotetaker = useSendNotetaker();
  const { data: consent } = useMeetingConsent(m.id);
  const recordConsent = useRecordConsent();
  const queryClient = useQueryClient();
  const hasRecording = m.recordingStatus && m.recordingStatus !== "none";
  const statusCfg = recordingStatusConfig[m.recordingStatus || "none"] || recordingStatusConfig.none;
  const StatusIcon = statusCfg.icon;
  const isActive = m.recordingStatus === "joining" || m.recordingStatus === "recording" || m.recordingStatus === "pending" || m.recordingStatus === "processing";
  const isThisRecording = activeRecordingId === m.id;

  const recorder = useAudioRecorder({
    meetingId: m.id,
    onComplete: () => {
      setActiveRecordingId(null);
      queryClient.invalidateQueries({ queryKey: [api.meetings.list.path] });
    },
    onError: () => {
      setActiveRecordingId(null);
    },
  });

  const handleSendNotetaker = () => {
    const url = meetingUrlInput || m.meetingJoinUrl;
    if (!url) return;
    sendNotetaker.mutate({ meetingId: m.id, meetingUrl: url });
    setMeetingUrlInput("");
  };

  const handleStartRecording = () => {
    if (!consent) {
      setShowConsentModal(true);
    } else {
      recorder.startRecording();
      setActiveRecordingId(m.id);
    }
  };

  const handleConsentAndRecord = async (method: string) => {
    await recordConsent.mutateAsync({ meetingId: m.id, consentMethod: method });
    setShowConsentModal(false);
    recorder.startRecording();
    setActiveRecordingId(m.id);
  };

  const handleStopRecording = () => {
    recorder.stopRecording();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="border border-border rounded-2xl p-6 bg-background" data-testid={`card-meeting-${m.id}`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold font-display">{m.title}</h3>
            {hasRecording && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.color}`} data-testid={`badge-recording-status-${m.id}`}>
                <StatusIcon className={`w-3 h-3 ${isActive ? 'animate-spin' : ''}`} />
                {statusCfg.label}
              </span>
            )}
            {consent && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" data-testid={`badge-consent-${m.id}`}>
                <Shield className="w-3 h-3" />
                Consent: {consent.consentMethod}
              </span>
            )}
            {m.platform && m.platform !== "other" && (
              <span className="text-xs text-slate-500 capitalize">{m.platform.replace("_", " ")}</span>
            )}
          </div>
          <p className="text-sm text-slate-500">{format(new Date(m.date), 'MMMM d, yyyy - h:mm a')}</p>
        </div>
        <div className="flex space-x-2">
          {companyConfig?.moduleMeetingRecorder && !hasRecording && !isThisRecording && (
            <div className="flex items-center gap-2">
              {!m.meetingJoinUrl && (
                <input
                  type="text"
                  value={meetingUrlInput}
                  onChange={e => setMeetingUrlInput(e.target.value)}
                  placeholder="Paste meeting URL..."
                  data-testid={`input-meeting-url-${m.id}`}
                  className="px-3 py-2 border border-border rounded-xl text-xs w-48 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              )}
              <button
                onClick={handleSendNotetaker}
                disabled={sendNotetaker.isPending || (!m.meetingJoinUrl && !meetingUrlInput)}
                data-testid={`button-send-notetaker-${m.id}`}
                className="flex items-center space-x-2 px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 text-sm"
              >
                {sendNotetaker.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                <span>Send Notetaker</span>
              </button>
            </div>
          )}
          {!isThisRecording && !hasRecording && (
            <button
              onClick={handleStartRecording}
              disabled={activeRecordingId !== null && activeRecordingId !== m.id}
              data-testid={`button-record-${m.id}`}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>Record Audio</span>
            </button>
          )}
          {m.transcript && !m.summary && (
            <button
              onClick={() => summarize.mutate({ id: m.id })}
              disabled={summarize.isPending}
              data-testid={`button-summarize-${m.id}`}
              className="flex items-center space-x-2 px-4 py-2 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-xl text-sm font-semibold transition-all"
            >
              {summarize.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              <span>Generate Summary</span>
            </button>
          )}
        </div>
      </div>

      {isThisRecording && (recorder.state === "recording" || recorder.state === "paused" || recorder.state === "uploading") && (
        <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl" data-testid={`panel-recording-active-${m.id}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full bg-red-500 ${recorder.state === "recording" ? "animate-pulse" : ""}`} />
              <span className="text-sm font-semibold text-red-700 dark:text-red-400">
                {recorder.state === "recording" ? "Recording" : recorder.state === "paused" ? "Paused" : "Uploading..."}
              </span>
              <span className="text-lg font-mono font-bold text-red-700 dark:text-red-400" data-testid={`text-duration-${m.id}`}>
                {formatDuration(recorder.duration)}
              </span>
              {recorder.isMicSilent && recorder.state === "recording" && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Mic silent
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{recorder.chunksUploaded} chunks</span>
              {recorder.state === "recording" && (
                <button onClick={recorder.pauseRecording} data-testid={`button-pause-${m.id}`} className="p-2 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 transition-colors">
                  <Pause className="w-4 h-4" />
                </button>
              )}
              {recorder.state === "paused" && (
                <button onClick={recorder.resumeRecording} data-testid={`button-resume-${m.id}`} className="p-2 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 transition-colors">
                  <Play className="w-4 h-4" />
                </button>
              )}
              {(recorder.state === "recording" || recorder.state === "paused") && (
                <button onClick={handleStopRecording} data-testid={`button-stop-${m.id}`} className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-xl font-semibold text-sm hover:bg-red-600 transition-colors">
                  <Square className="w-4 h-4" fill="currentColor" />
                  <span>Stop & Process</span>
                </button>
              )}
              {recorder.state === "uploading" && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {recorder.state === "error" && recorder.errorMessage && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl" data-testid={`error-recorder-${m.id}`}>
          <p className="text-sm text-red-700 dark:text-red-400">{recorder.errorMessage}</p>
        </div>
      )}

      {sendNotetaker.isError && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl" data-testid={`error-notetaker-${m.id}`}>
          <p className="text-sm text-red-700 dark:text-red-400">{(sendNotetaker.error as Error).message}</p>
        </div>
      )}

      {uploadAudio.isPending && uploadAudio.variables?.id === m.id && (
        <div className="mt-4 p-4 bg-muted rounded-xl flex items-center space-x-3 text-sm">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Processing audio transcript...</span>
        </div>
      )}

      {m.recordingUrl && (
        <div className="mt-3 flex items-center gap-2">
          <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" data-testid={`link-recording-${m.id}`} className="text-xs text-primary hover:underline flex items-center gap-1">
            <ExternalLink className="w-3 h-3" /> View Recording
          </a>
        </div>
      )}

      {m.summary && (
        <div className="mt-4 p-4 bg-primary/5 border border-primary/10 rounded-xl">
          <div className="flex items-center space-x-2 mb-2 text-primary font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <h4>AI Summary</h4>
          </div>
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-line">{m.summary}</p>
        </div>
      )}

      {m.transcript && !m.summary && (
        <div className="mt-4 p-4 bg-muted rounded-xl">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Raw Transcript</h4>
          <p className="text-sm text-foreground/70 italic line-clamp-3">"{m.transcript}"</p>
        </div>
      )}

      {m.recordingStatus === "done" && (
        <div className="mt-4">
          <button
            onClick={() => setExpanded(!expanded)}
            data-testid={`button-expand-outputs-${m.id}`}
            className="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>Meeting Intelligence</span>
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {expanded && <MeetingIntelligencePanel meetingId={m.id} clientId={clientId} />}
        </div>
      )}

      {showConsentModal && (
        <RecordingConsentModal
          meetingTitle={m.title}
          onConfirm={handleConsentAndRecord}
          onClose={() => setShowConsentModal(false)}
          isPending={recordConsent.isPending}
        />
      )}
    </div>
  );
}

function RecordingConsentModal({ meetingTitle, onConfirm, onClose, isPending }: {
  meetingTitle: string;
  onConfirm: (method: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [method, setMethod] = useState("verbal");
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-recording-consent">
      <div className="bg-background border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-xl">
            <Shield className="w-5 h-5 text-amber-700 dark:text-amber-400" />
          </div>
          <h3 className="text-lg font-bold font-display">Recording Consent Required</h3>
        </div>
        <div className="space-y-3 mb-6">
          <p className="text-sm text-foreground/80">
            Before recording <strong>"{meetingTitle}"</strong>, you must confirm that the client has been informed and consented to:
          </p>
          <ul className="text-sm text-foreground/70 space-y-1 list-disc list-inside">
            <li>The meeting will be audio-recorded</li>
            <li>The transcript will be processed by AI to generate summaries, action items, and compliance notes</li>
            <li>The advisor and firm will have access to the recording and AI outputs</li>
          </ul>
          <div className="pt-3">
            <label className="text-sm font-semibold block mb-2">How was consent obtained?</label>
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer" data-testid="radio-consent-verbal">
                <input type="radio" name="consent" value="verbal" checked={method === "verbal"} onChange={() => setMethod("verbal")} className="accent-primary" />
                <span className="text-sm">Verbal confirmation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="radio-consent-email">
                <input type="radio" name="consent" value="email" checked={method === "email"} onChange={() => setMethod("email")} className="accent-primary" />
                <span className="text-sm">Email confirmation</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer" data-testid="radio-consent-in-app">
                <input type="radio" name="consent" value="in_app" checked={method === "in_app"} onChange={() => setMethod("in_app")} className="accent-primary" />
                <span className="text-sm">In-app consent</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} data-testid="button-cancel-consent" className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(method)}
            disabled={isPending}
            data-testid="button-confirm-consent"
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
            <span>Confirm & Start Recording</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingIntelligencePanel({ meetingId, clientId }: { meetingId: number; clientId: number }) {
  const { data: outputs, isLoading: outputsLoading } = useMeetingOutputs(meetingId);
  const { data: tasks } = useMeetingTasks(meetingId);
  const updateTask = useUpdateMeetingTask();
  const reviewCompliance = useReviewCompliance();
  const [activeTab, setActiveTab] = useState<"summary" | "actions" | "email" | "compliance" | "coaching">("summary");

  if (outputsLoading) {
    return (
      <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading meeting intelligence...
      </div>
    );
  }

  if (!outputs) {
    return (
      <div className="mt-4 text-sm text-slate-500">
        No AI analysis available for this meeting yet.
      </div>
    );
  }

  const complianceNotes = outputs.complianceNotes as { kycUpdates?: string[]; suitabilityNotes?: string[]; adviceGiven?: string[]; clientInstructions?: string[] } | null;
  const planTriggers = outputs.planTriggers as Array<{ module: string; triggerType: string; description: string; suggestedAction: string }> | null;
  const keyDecisions = outputs.keyDecisions as Array<{ decision: string; context: string }> | null;
  const clientGoals = outputs.clientGoals as Array<{ goal: string; urgency: string }> | null;
  const coachingScore = outputs.coachingScore as { needsDiscovery?: number; clientLed?: number; gapsSurfaced?: number } | null;

  const tabs = [
    { key: "summary" as const, label: "Summary", icon: FileText },
    { key: "actions" as const, label: `Actions${tasks?.length ? ` (${tasks.length})` : ''}`, icon: ClipboardList },
    { key: "email" as const, label: "Follow-up Email", icon: Send },
    { key: "compliance" as const, label: "Compliance", icon: ShieldCheck },
    { key: "coaching" as const, label: "Coaching", icon: Target },
  ];

  return (
    <div className="mt-4 border border-border rounded-xl overflow-hidden" data-testid={`panel-intelligence-${meetingId}`}>
      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              data-testid={`tab-${tab.key}-${meetingId}`}
              className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'bg-primary/10 text-primary border-b-2 border-primary' : 'text-slate-500 hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-5">
        {activeTab === "summary" && (
          <div className="space-y-4" data-testid={`content-summary-${meetingId}`}>
            {outputs.summary && <p className="text-sm leading-relaxed text-foreground/80">{outputs.summary}</p>}
            {keyDecisions && keyDecisions.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Key Decisions</h5>
                <ul className="space-y-2">
                  {keyDecisions.map((d, i) => (
                    <li key={i} className="text-sm text-foreground/80">
                      <span className="font-semibold">{d.decision}</span>
                      {d.context && <span className="text-slate-500"> — {d.context}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {clientGoals && clientGoals.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Client Goals</h5>
                <ul className="space-y-1">
                  {clientGoals.map((g, i) => (
                    <li key={i} className="text-sm flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${g.urgency === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : g.urgency === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                        {g.urgency}
                      </span>
                      {g.goal}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {planTriggers && planTriggers.length > 0 && (
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Plan Triggers Detected</h5>
                <ul className="space-y-2">
                  {planTriggers.map((t, i) => (
                    <li key={i} className="text-sm p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                      <span className="font-semibold capitalize">{t.module}</span>: {t.description}
                      <p className="text-xs text-slate-500 mt-1">Suggested: {t.suggestedAction}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === "actions" && (
          <div className="space-y-3" data-testid={`content-actions-${meetingId}`}>
            {tasks && tasks.length > 0 ? tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 border border-border rounded-lg" data-testid={`meeting-task-${task.id}`}>
                <button
                  onClick={() => updateTask.mutate({ meetingId, taskId: task.id, status: task.status === "complete" ? "open" : "complete" })}
                  data-testid={`button-toggle-task-${task.id}`}
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${task.status === "complete" ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground hover:border-primary'}`}
                >
                  {task.status === "complete" && <CheckCircle2 className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${task.status === "complete" ? 'line-through text-slate-500' : ''}`}>{task.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${task.owner === "client" ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400'}`}>
                      {task.owner}
                    </span>
                    {task.dueDate && <span className="text-xs text-slate-500">Due: {task.dueDate}</span>}
                    <span className={`text-xs px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : task.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-400' : 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'}`}>
                      {task.priority}
                    </span>
                  </div>
                </div>
              </div>
            )) : (
              <p className="text-sm text-slate-500">No action items extracted from this meeting.</p>
            )}
          </div>
        )}

        {activeTab === "email" && (
          <div className="space-y-3" data-testid={`content-email-${meetingId}`}>
            {outputs.followUpEmailDraft ? (
              <>
                <div className="bg-muted rounded-xl p-4">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{outputs.followUpEmailDraft}</pre>
                </div>
                {outputs.emailSent && (
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" /> Email sent
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">No follow-up email draft generated.</p>
            )}
          </div>
        )}

        {activeTab === "compliance" && (
          <div className="space-y-4" data-testid={`content-compliance-${meetingId}`}>
            {complianceNotes && (
              <>
                {complianceNotes.kycUpdates && complianceNotes.kycUpdates.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">KYC Updates</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {complianceNotes.kycUpdates.map((note, i) => <li key={i} className="text-sm">{note}</li>)}
                    </ul>
                  </div>
                )}
                {complianceNotes.suitabilityNotes && complianceNotes.suitabilityNotes.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Suitability Notes</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {complianceNotes.suitabilityNotes.map((note, i) => <li key={i} className="text-sm">{note}</li>)}
                    </ul>
                  </div>
                )}
                {complianceNotes.adviceGiven && complianceNotes.adviceGiven.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Advice Given</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {complianceNotes.adviceGiven.map((note, i) => <li key={i} className="text-sm">{note}</li>)}
                    </ul>
                  </div>
                )}
                {complianceNotes.clientInstructions && complianceNotes.clientInstructions.length > 0 && (
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Client Instructions</h5>
                    <ul className="list-disc list-inside space-y-1">
                      {complianceNotes.clientInstructions.map((note, i) => <li key={i} className="text-sm">{note}</li>)}
                    </ul>
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              {outputs.complianceReviewed ? (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <ShieldCheck className="w-4 h-4" /> Compliance reviewed
                  {outputs.complianceReviewedAt && <span className="text-xs text-slate-500">({format(new Date(outputs.complianceReviewedAt), 'MMM d, yyyy')})</span>}
                </div>
              ) : (
                <button
                  onClick={() => reviewCompliance.mutate({ meetingId })}
                  disabled={reviewCompliance.isPending}
                  data-testid={`button-review-compliance-${meetingId}`}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
                >
                  {reviewCompliance.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Sign Off Compliance
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === "coaching" && (
          <div className="space-y-4" data-testid={`content-coaching-${meetingId}`}>
            <p className="text-xs text-slate-500 italic">Private to advisor only — not shared with clients.</p>
            {coachingScore && (
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Needs Discovery", value: coachingScore.needsDiscovery },
                  { label: "Client-Led", value: coachingScore.clientLed },
                  { label: "Gaps Surfaced", value: coachingScore.gapsSurfaced },
                ].map((item, i) => (
                  <div key={i} className="text-center p-3 bg-muted rounded-xl">
                    <p className="text-2xl font-bold text-foreground">{item.value ?? 0}<span className="text-xs text-slate-500">/10</span></p>
                    <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
            {outputs.coachingNotes && (
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm leading-relaxed">{outputs.coachingNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamsImportModal({ onClose, clientId }: { clientId: number; onClose: () => void }) {
  const { data: teamsMeetings, isLoading, error } = useTeamsMeetings(true);
  const importMeeting = useImportTeamsMeeting();
  const [importingId, setImportingId] = useState<string | null>(null);

  const handleImport = (meeting: TeamsMeeting) => {
    setImportingId(meeting.id);
    importMeeting.mutate(
      {
        teamsMeetingId: meeting.id,
        subject: meeting.subject,
        startDateTime: meeting.startDateTime,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: () => {
          setImportingId(null);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-teams-import">
      <div className="bg-background rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-xl border border-border">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Import from Teams</h3>
            <p className="text-sm text-slate-500 mt-1">Select a recent Teams meeting to import its transcript</p>
          </div>
          <button onClick={onClose} data-testid="button-close-teams-import" className="text-slate-500 hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12" data-testid="teams-loading">
              <Loader2 className="w-6 h-6 animate-spin text-primary mr-2" />
              <span className="text-slate-500">Loading Teams meetings...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center space-x-3 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl" data-testid="teams-error">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  {(error as Error).message.includes('permission')
                    ? 'Additional Microsoft permissions are required for Teams meetings. Please reconnect your Outlook account with Teams permissions.'
                    : (error as Error).message.includes('not configured')
                    ? 'Your Outlook account is not connected. Please connect it in the Email module first.'
                    : (error as Error).message || 'Failed to load Teams meetings'}
                </p>
              </div>
            </div>
          )}

          {teamsMeetings && teamsMeetings.length === 0 && (
            <div className="text-center py-12 text-slate-500" data-testid="teams-empty">
              <Video className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No recent Teams meetings found</p>
              <p className="text-sm mt-1">Meetings from the last 90 days will appear here</p>
            </div>
          )}

          {teamsMeetings?.map((meeting) => (
            <div
              key={meeting.id}
              className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-colors"
              data-testid={`teams-meeting-${meeting.id}`}
            >
              <div className="flex items-start space-x-3 min-w-0 flex-1">
                <Video className="w-5 h-5 text-violet-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{meeting.subject}</p>
                  <p className="text-xs text-slate-500">
                    {format(new Date(meeting.startDateTime), 'MMM d, yyyy - h:mm a')}
                    {meeting.participantCount > 0 && ` · ${meeting.participantCount} participant${meeting.participantCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleImport(meeting)}
                disabled={importMeeting.isPending}
                data-testid={`button-import-meeting-${meeting.id}`}
                className="flex items-center space-x-2 px-3 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-50 transition-colors shrink-0 ml-3"
              >
                {importingId === meeting.id && importMeeting.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Import</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>

        {importMeeting.isError && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl" data-testid="teams-import-error">
            <p className="text-sm text-red-700 dark:text-red-400">
              {(importMeeting.error as Error).message.includes('No transcript')
                ? 'No transcript available for this meeting. Ensure transcription was enabled during the Teams meeting.'
                : 'Failed to import meeting. Please try again.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScheduleTeamsMeetingModal({ onClose, clientId }: { clientId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: client } = useClient(clientId);
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState("");
  const [autoRecord, setAutoRecord] = useState(true);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const createMeetingRecord = useCreateMeeting();
  const sendNotetaker = useSendNotetaker();

  useEffect(() => {
    if (client) {
      setSubject(`Meeting with ${client.firstName} ${client.lastName}`);
      if (client.email) setAttendees(client.email);
    }
  }, [client]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const start = `${date}T${startTime}:00`;
      const end = `${date}T${endTime}:00`;
      const attendeeList = attendees ? attendees.split(/[,;]/).map((s: string) => s.trim()).filter(Boolean) : [];

      const res = await fetch("/api/crm/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          start,
          end,
          timeZone: timezone,
          isOnlineMeeting: true,
          attendees: attendeeList.length > 0 ? attendeeList : undefined,
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed to create meeting" }));
        throw new Error(err.message || "Failed to create meeting");
      }
      const calEvent = await res.json();

      if (autoRecord && calEvent.onlineMeetingUrl) {
        const meetingRecord = await createMeetingRecord.mutateAsync({
          data: {
            title: subject,
            date: new Date(start),
            meetingJoinUrl: calEvent.onlineMeetingUrl,
            platform: "teams",
            recordingStatus: "pending",
          },
        });
        try {
          await sendNotetaker.mutateAsync({
            meetingId: meetingRecord.id,
            meetingUrl: calEvent.onlineMeetingUrl,
          });
        } catch (notetakerErr) {
          console.error("Auto-record failed:", notetakerErr);
        }
      }

      return calEvent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/calendar/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients", "activities"] });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" data-testid="modal-schedule-teams">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
              <Video className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900" data-testid="text-schedule-teams-title">Schedule Teams Meeting</h3>
              <p className="text-xs text-slate-500">Creates a calendar event with a Teams video link</p>
            </div>
          </div>
          <button onClick={onClose} data-testid="button-close-schedule-teams" className="text-slate-500 hover:text-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-500">Meeting Title</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} data-testid="input-schedule-teams-subject" className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-500">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} data-testid="input-schedule-teams-date" className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-500">Start Time</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} data-testid="input-schedule-teams-start" className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-500">End Time</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} data-testid="input-schedule-teams-end" className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-500">Attendees (comma-separated emails)</label>
            <input type="text" value={attendees} onChange={e => setAttendees(e.target.value)} placeholder="email@example.com" data-testid="input-schedule-teams-attendees" className="w-full mt-1.5 px-4 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all" />
          </div>

          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl px-4 py-3 flex items-center gap-3">
            <Video className="w-4 h-4 text-violet-600 flex-shrink-0" />
            <p className="text-xs text-violet-700 dark:text-violet-300">A Microsoft Teams meeting link will be automatically generated and included in the calendar invitation.</p>
          </div>

          <div className="flex items-center justify-between p-4 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-violet-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">Auto-Record with AI Notetaker</p>
                <p className="text-xs text-violet-600/70 dark:text-violet-400/70">A bot will join the meeting to record and generate an AI summary</p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRecord}
              onClick={() => setAutoRecord(!autoRecord)}
              data-testid="toggle-auto-record"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoRecord ? 'bg-violet-600' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoRecord ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {createMutation.isError && (
            <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl" data-testid="schedule-teams-error">
              <p className="text-sm text-red-700 dark:text-red-400">{(createMutation.error as Error).message}</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border">
          <button onClick={onClose} data-testid="button-cancel-schedule-teams" className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !subject}
            data-testid="button-save-schedule-teams"
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Scheduling...</> : <><Video className="w-4 h-4" />Schedule Meeting</>}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddMeetingModal({ onClose, clientId }: { clientId: number; onClose: () => void }) {
  const [formData, setFormData] = useState({ title: "", date: new Date().toISOString().slice(0, 16) });
  const createMeeting = useCreateMeeting();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMeeting.mutate({ data: { title: formData.title, date: new Date(formData.date) } }, { onSuccess: () => onClose() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Log Meeting</h2>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-add-meeting">
          <div>
            <label className="text-sm font-semibold">Meeting Title</label>
            <input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-meeting-title" className="w-full px-4 py-3 rounded-xl border mt-1" placeholder="e.g. Q3 Portfolio Review" />
          </div>
          <div>
            <label className="text-sm font-semibold">Date & Time</label>
            <input type="datetime-local" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} data-testid="input-meeting-date" className="w-full px-4 py-3 rounded-xl border mt-1" />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createMeeting.isPending} data-testid="button-submit-meeting" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createMeeting.isPending ? "Adding..." : "Add Meeting"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlansTab({ clientId }: { clientId: number }) {
  const [, navigate] = useLocation();
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <Target className="w-12 h-12 text-slate-500/50" />
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Financial Planning Suite</h3>
        <p className="text-sm text-slate-500 mb-4">Open the full planning workspace for this client</p>
        <button
          onClick={() => navigate(`/financial-planning?client=${clientId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Target className="w-4 h-4" />
          Open Financial Plan
        </button>
      </div>
    </div>
  );
}

function GoalsSection({ clientId }: { clientId: number }) {
  const { data: plans } = useClientPlans(clientId);
  const deletePlan = useDeletePlan();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-slate-900">Financial Goals</h2>
        <button onClick={() => setIsAddOpen(true)} data-testid="button-add-plan" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Create Goal</span>
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans?.map(p => (
          <div key={p.id} className="border border-border rounded-2xl p-6 bg-gradient-to-br from-white to-muted/30 relative" data-testid={`card-plan-${p.id}`}>
            <div className="absolute top-4 right-4 flex space-x-1">
              <button onClick={() => setEditingPlan(p.id)} data-testid={`button-edit-plan-${p.id}`} className="p-1.5 rounded-lg hover:bg-muted"><Edit className="w-4 h-4 text-slate-500" /></button>
              <button onClick={() => { if (confirm("Delete this plan?")) deletePlan.mutate(p.id); }} data-testid={`button-delete-plan-${p.id}`} className="p-1.5 rounded-lg hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            <h3 className="text-sm font-semibold text-slate-700 pr-16">{p.title}</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Goal</p>
                <p className="text-2xl font-bold text-primary mt-1">${parseFloat(p.goalAmount?.toString() || '0').toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Target Date</p>
                <p className="text-lg font-medium text-foreground mt-1">{p.targetDate ? format(new Date(p.targetDate), 'MMM yyyy') : 'N/A'}</p>
              </div>
            </div>
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="font-semibold">Risk Tolerance</span>
                <span className={`capitalize font-bold ${p.riskTolerance === 'high' ? 'text-red-500' : p.riskTolerance === 'medium' ? 'text-orange-500' : 'text-green-500'}`}>{p.riskTolerance}</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${p.riskTolerance === 'high' ? 'bg-red-500 w-5/6' : p.riskTolerance === 'medium' ? 'bg-orange-500 w-1/2' : 'bg-green-500 w-1/4'}`} />
              </div>
            </div>
            {p.notes && <p className="mt-6 text-sm text-slate-500 bg-white p-3 rounded-xl border border-border">{p.notes}</p>}
          </div>
        ))}
        {plans?.length === 0 && <div className="col-span-2 text-center py-12 text-slate-500">No financial goals created yet.</div>}
      </div>
      {isAddOpen && <AddPlanModal clientId={clientId} onClose={() => setIsAddOpen(false)} />}
      {editingPlan && <EditPlanModal planId={editingPlan} plans={plans || []} onClose={() => setEditingPlan(null)} />}
    </div>
  );
}

function AddPlanModal({ onClose, clientId }: { clientId: number; onClose: () => void }) {
  const [formData, setFormData] = useState({ title: "", goalAmount: "", targetDate: "", riskTolerance: "medium", notes: "" });
  const createPlan = useCreatePlan();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createPlan.mutate({ data: { ...formData, targetDate: formData.targetDate ? new Date(formData.targetDate).toISOString().split("T")[0] : undefined } }, { onSuccess: () => onClose() });
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Create Financial Goal</h2>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-add-plan">
          <div><label className="text-sm font-semibold">Goal Title</label><input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-plan-title" className="w-full px-4 py-3 rounded-xl border mt-1" placeholder="e.g. Retirement 2045" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-semibold">Goal Amount ($)</label><input type="number" required value={formData.goalAmount} onChange={e => setFormData({...formData, goalAmount: e.target.value})} data-testid="input-plan-goal" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
            <div><label className="text-sm font-semibold">Target Date</label><input type="date" required value={formData.targetDate} onChange={e => setFormData({...formData, targetDate: e.target.value})} data-testid="input-plan-date" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
          </div>
          <div><label className="text-sm font-semibold">Risk Tolerance</label><select value={formData.riskTolerance} onChange={e => setFormData({...formData, riskTolerance: e.target.value})} data-testid="select-plan-risk" className="w-full px-4 py-3 rounded-xl border mt-1"><option value="low">Low Risk</option><option value="medium">Medium Risk</option><option value="high">High Risk</option></select></div>
          <div><label className="text-sm font-semibold">Notes / Strategy</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} data-testid="input-plan-notes" className="w-full px-4 py-3 rounded-xl border mt-1 min-h-[100px]" /></div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
            <button type="submit" disabled={createPlan.isPending} data-testid="button-submit-plan" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createPlan.isPending ? "Creating..." : "Create Goal"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditPlanModal({ planId, plans, onClose, id, title, goalAmount, targetDate, riskTolerance, notes }: { planId: number; plans: { id: number; title: string; goalAmount: string | null; targetDate: string | null; riskTolerance: string | null; notes: string | null }[]; onClose: () => void }) {
  const plan = plans.find(p => p.id === planId);
  const [formData, setFormData] = useState({ title: plan?.title || "", goalAmount: plan?.goalAmount?.toString() || "", targetDate: plan?.targetDate ? plan.targetDate.split("T")[0] : "", riskTolerance: plan?.riskTolerance || "medium", notes: plan?.notes || "" });
  const updatePlan = useUpdatePlan();
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updatePlan.mutate({ id: planId, data: { ...formData, targetDate: formData.targetDate ? new Date(formData.targetDate).toISOString().split("T")[0] : undefined } }, { onSuccess: () => onClose() });
  };
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Edit Financial Goal</h2>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-edit-plan">
          <div><label className="text-sm font-semibold">Goal Title</label><input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} data-testid="input-edit-plan-title" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-semibold">Goal Amount ($)</label><input type="number" required value={formData.goalAmount} onChange={e => setFormData({...formData, goalAmount: e.target.value})} data-testid="input-edit-plan-goal" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
            <div><label className="text-sm font-semibold">Target Date</label><input type="date" required value={formData.targetDate} onChange={e => setFormData({...formData, targetDate: e.target.value})} data-testid="input-edit-plan-date" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
          </div>
          <div><label className="text-sm font-semibold">Risk Tolerance</label><select value={formData.riskTolerance} onChange={e => setFormData({...formData, riskTolerance: e.target.value})} data-testid="select-edit-plan-risk" className="w-full px-4 py-3 rounded-xl border mt-1"><option value="low">Low Risk</option><option value="medium">Medium Risk</option><option value="high">High Risk</option></select></div>
          <div><label className="text-sm font-semibold">Notes / Strategy</label><textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} data-testid="input-edit-plan-notes" className="w-full px-4 py-3 rounded-xl border mt-1 min-h-[100px]" /></div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
            <button type="submit" disabled={updatePlan.isPending} data-testid="button-save-plan" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{updatePlan.isPending ? "Saving..." : "Save Changes"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NetWorthSection({ clientId }: { clientId: number }) {
  const { data: entries = [] } = useNetWorthEntries(clientId);
  const createEntry = useCreateNetWorthEntry();
  const updateEntry = useUpdateNetWorthEntry(clientId);
  const deleteEntry = useDeleteNetWorthEntry(clientId);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<"asset" | "liability">("asset");
  const [form, setForm] = useState({ category: "", name: "", value: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", value: "" });

  const assetCategories = ["Liquid Assets", "Investments", "Real Estate", "Personal Property"];
  const liabilityCategories = ["Mortgages", "Loans", "Credit Cards", "Other Liabilities"];

  const assets = entries.filter((e: { type: string }) => e.type === "asset");
  const liabilities = entries.filter((e: { type: string }) => e.type === "liability");
  const totalAssets = assets.reduce((sum: number, e: { value: string }) => sum + parseFloat(e.value || "0"), 0);
  const totalLiabilities = liabilities.reduce((sum: number, e: { value: string }) => sum + parseFloat(e.value || "0"), 0);
  const netWorth = totalAssets - totalLiabilities;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    createEntry.mutate({ data: { type: addType, category: form.category, name: form.name, value: form.value } }, {
      onSuccess: () => { setShowAdd(false); setForm({ category: "", name: "", value: "" }); }
    });
  };

  const handleEdit = (id: number) => {
    updateEntry.mutate({ id, data: { name: editForm.name, value: editForm.value } }, { onSuccess: () => setEditingId(null) });
  };

  const renderCategory = (categoryName: string, items: { id: number; name: string; value: string }[], type: string) => {
    const catItems = items.filter((i: { category?: string }) => (i as { category: string }).category === categoryName);
    if (catItems.length === 0) return null;
    return (
      <div key={categoryName} className="mb-4">
        <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">{categoryName}</h4>
        {catItems.map(item => (
          <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group" data-testid={`nw-entry-${item.id}`}>
            {editingId === item.id ? (
              <div className="flex items-center space-x-2 w-full">
                <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} data-testid="input-edit-nw-name" className="flex-1 px-2 py-1 border rounded-lg text-sm" />
                <input type="number" value={editForm.value} onChange={e => setEditForm({...editForm, value: e.target.value})} data-testid="input-edit-nw-value" className="w-32 px-2 py-1 border rounded-lg text-sm" />
                <button onClick={() => handleEdit(item.id)} data-testid="button-save-nw" className="text-primary text-sm font-semibold">Save</button>
                <button onClick={() => setEditingId(null)} className="text-slate-500 text-sm">Cancel</button>
              </div>
            ) : (
              <>
                <span className="text-sm">{item.name}</span>
                <div className="flex items-center space-x-2">
                  <span className={`text-sm font-semibold ${type === "asset" ? "text-green-600" : "text-red-500"}`}>${parseFloat(item.value).toLocaleString()}</span>
                  <button onClick={() => { setEditingId(item.id); setEditForm({ name: item.name, value: item.value }); }} data-testid={`button-edit-nw-${item.id}`} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded"><Edit className="w-3 h-3" /></button>
                  <button onClick={() => deleteEntry.mutate(item.id)} data-testid={`button-delete-nw-${item.id}`} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3 text-red-400" /></button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-slate-900">Net Worth Tracker</h2>
        <button onClick={() => setShowAdd(true)} data-testid="button-add-nw-entry" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>Add Entry</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-green-200 rounded-2xl p-5 bg-green-50/50" data-testid="total-assets">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Total Assets</p>
          <p className="text-2xl font-bold text-green-700 mt-1">${totalAssets.toLocaleString()}</p>
        </div>
        <div className="border border-red-200 rounded-2xl p-5 bg-red-50/50" data-testid="total-liabilities">
          <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">Total Liabilities</p>
          <p className="text-2xl font-bold text-red-600 mt-1">${totalLiabilities.toLocaleString()}</p>
        </div>
        <div className={`border rounded-2xl p-5 ${netWorth >= 0 ? "border-primary/30 bg-primary/5" : "border-red-300 bg-red-50"}`} data-testid="net-worth-total">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Worth</p>
          <p className={`text-2xl font-bold mt-1 ${netWorth >= 0 ? "text-primary" : "text-red-600"}`}>${netWorth.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold font-display text-green-700 mb-4">Assets</h3>
          {assetCategories.map(cat => renderCategory(cat, assets, "asset"))}
          {assets.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No assets added yet.</p>}
        </div>
        <div className="border border-border rounded-2xl p-6">
          <h3 className="text-lg font-bold font-display text-red-600 mb-4">Liabilities</h3>
          {liabilityCategories.map(cat => renderCategory(cat, liabilities, "liability"))}
          {liabilities.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No liabilities added yet.</p>}
        </div>
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Add Net Worth Entry</h2>
            <form onSubmit={handleAdd} className="space-y-4" data-testid="form-add-nw">
              <div className="flex space-x-2">
                <button type="button" onClick={() => setAddType("asset")} data-testid="button-type-asset" className={`flex-1 py-2 rounded-xl font-semibold text-sm ${addType === "asset" ? "bg-green-100 text-green-700 border-2 border-green-300" : "bg-muted text-slate-500"}`}>Asset</button>
                <button type="button" onClick={() => setAddType("liability")} data-testid="button-type-liability" className={`flex-1 py-2 rounded-xl font-semibold text-sm ${addType === "liability" ? "bg-red-100 text-red-600 border-2 border-red-300" : "bg-muted text-slate-500"}`}>Liability</button>
              </div>
              <div>
                <label className="text-sm font-semibold">Category</label>
                <select required value={form.category} onChange={e => setForm({...form, category: e.target.value})} data-testid="select-nw-category" className="w-full px-4 py-3 rounded-xl border mt-1">
                  <option value="">-- Select Category --</option>
                  {(addType === "asset" ? assetCategories : liabilityCategories).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className="text-sm font-semibold">Description</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} data-testid="input-nw-name" className="w-full px-4 py-3 rounded-xl border mt-1" placeholder="e.g. Primary Residence" /></div>
              <div><label className="text-sm font-semibold">Value ($)</label><input type="number" step="0.01" required value={form.value} onChange={e => setForm({...form, value: e.target.value})} data-testid="input-nw-value" className="w-full px-4 py-3 rounded-xl border mt-1" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowAdd(false)} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createEntry.isPending} data-testid="button-submit-nw" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createEntry.isPending ? "Adding..." : "Add Entry"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function YearlyBreakdownTable({ breakdown, retirementAge, age, balance }: { breakdown: Array<{ age: number; balance: number }>; retirementAge: number }) {
  const [expanded, setExpanded] = useState(false);
  if (!breakdown.length) return null;
  return (
    <div className="mt-4">
      <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)} data-testid="toggle-yearly-breakdown">
        {expanded ? "Hide" : "Show"} Year-by-Year Breakdown
      </Button>
      {expanded && (
        <div className="mt-3 max-h-64 overflow-auto border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left px-3 py-2">Age</th>
                <th className="text-left px-3 py-2">Phase</th>
                <th className="text-right px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.map((row, i) => (
                <tr key={i} className={`border-t ${row.age === retirementAge ? "bg-yellow-50 dark:bg-yellow-900/20 font-medium" : ""}`} data-testid={`breakdown-row-${row.age}`}>
                  <td className="px-3 py-1.5">{row.age}</td>
                  <td className="px-3 py-1.5">{row.age < retirementAge ? "Accumulation" : "Decumulation"}</td>
                  <td className={`px-3 py-1.5 text-right ${row.balance < 0 ? "text-red-600" : ""}`}>${row.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RetirementSection({ clientId }: { clientId: number }) {
  const { data: projections = [] } = useRetirementProjections(clientId);
  const createProjection = useCreateRetirementProjection();
  const deleteProjection = useDeleteRetirementProjection(clientId);
  const [showCalc, setShowCalc] = useState(false);
  const [form, setForm] = useState({
    currentAge: "35", retirementAge: "65", lifeExpectancy: "90",
    currentSavings: "100000", annualContribution: "12000",
    expectedReturn: "7", inflationRate: "2", desiredRetirementIncome: "60000"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createProjection.mutate({
      data: {
        currentAge: parseInt(form.currentAge),
        retirementAge: parseInt(form.retirementAge),
        lifeExpectancy: parseInt(form.lifeExpectancy),
        currentSavings: form.currentSavings,
        annualContribution: form.annualContribution,
        expectedReturn: form.expectedReturn,
        inflationRate: form.inflationRate,
        desiredRetirementIncome: form.desiredRetirementIncome,
      }
    }, { onSuccess: () => setShowCalc(false) });
  };

  const renderChart = (breakdown: { year: number; age: number; balance: string }[], retirementAge: number) => {
    if (!breakdown || breakdown.length === 0) return null;
    const maxBalance = Math.max(...breakdown.map(b => parseFloat(b.balance)));
    const chartHeight = 200;
    const step = Math.max(1, Math.floor(breakdown.length / 40));
    const displayPoints = breakdown.filter((_, i) => i % step === 0 || i === breakdown.length - 1);
    return (
      <div className="mt-4">
        <div className="relative" style={{ height: chartHeight + 40 }}>
          <div className="absolute left-0 top-0 bottom-8 w-16 flex flex-col justify-between text-xs text-slate-500">
            <span>${(maxBalance / 1000000).toFixed(1)}M</span>
            <span>${(maxBalance / 2000000).toFixed(1)}M</span>
            <span>$0</span>
          </div>
          <div className="absolute left-16 right-0 top-0 flex items-end" style={{ height: chartHeight }} data-testid="retirement-chart">
            {displayPoints.map((point, i) => {
              const height = maxBalance > 0 ? (parseFloat(point.balance) / maxBalance) * chartHeight : 0;
              const isRetired = point.age >= retirementAge;
              return (
                <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`Age ${point.age}: $${parseFloat(point.balance).toLocaleString()}`}>
                  <div className={`w-full min-w-[3px] max-w-[12px] mx-px rounded-t ${isRetired ? "bg-orange-400" : "bg-primary"}`} style={{ height: Math.max(1, height) }} />
                </div>
              );
            })}
          </div>
          <div className="absolute left-16 right-0 bottom-0 flex justify-between text-xs text-slate-500">
            <span>Age {displayPoints[0]?.age}</span>
            <span>Age {retirementAge} (Retire)</span>
            <span>Age {displayPoints[displayPoints.length - 1]?.age}</span>
          </div>
        </div>
        <div className="flex items-center space-x-4 mt-2 text-xs">
          <div className="flex items-center space-x-1"><div className="w-3 h-3 rounded bg-primary" /><span>Accumulation</span></div>
          <div className="flex items-center space-x-1"><div className="w-3 h-3 rounded bg-orange-400" /><span>Decumulation</span></div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-slate-900">Retirement Projections</h2>
        <button onClick={() => setShowCalc(true)} data-testid="button-new-retirement" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>New Projection</span>
        </button>
      </div>

      {projections.map((p: { id: number; currentAge: number; retirementAge: number; lifeExpectancy: number; currentSavings: string; annualContribution: string; expectedReturn: string; inflationRate: string; desiredRetirementIncome: string; projectedBalance: string | null; shortfallSurplus: string | null; yearlyBreakdown: string | null; createdAt: string | null }) => {
        const breakdown: Array<{ age: number; balance: number }> = p.yearlyBreakdown
          ? JSON.parse(p.yearlyBreakdown).map((row: { age: number | string; balance: number | string }) => ({ age: Number(row.age), balance: Number(row.balance) }))
          : [];
        const surplus = parseFloat(p.shortfallSurplus || "0");
        return (
          <div key={p.id} className="border border-border rounded-2xl p-6" data-testid={`retirement-projection-${p.id}`}>
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold">Retirement at Age {p.retirementAge}</h3>
                <p className="text-sm text-slate-500">Created {p.createdAt ? format(new Date(p.createdAt), 'MMM d, yyyy') : ''}</p>
              </div>
              <button onClick={() => { if (confirm("Delete this projection?")) deleteProjection.mutate(p.id); }} data-testid={`button-delete-retirement-${p.id}`} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div><p className="text-xs text-slate-500 uppercase">Current Savings</p><p className="text-lg font-bold">${parseFloat(p.currentSavings).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Annual Contribution</p><p className="text-lg font-bold">${parseFloat(p.annualContribution).toLocaleString()}</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Expected Return</p><p className="text-lg font-bold">{p.expectedReturn}%</p></div>
              <div><p className="text-xs text-slate-500 uppercase">Inflation</p><p className="text-lg font-bold">{p.inflationRate}%</p></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="border rounded-xl p-4 bg-primary/5">
                <p className="text-xs text-slate-500 uppercase">Projected Balance at Retirement</p>
                <p className="text-2xl font-bold text-primary">${parseFloat(p.projectedBalance || "0").toLocaleString()}</p>
              </div>
              <div className={`border rounded-xl p-4 ${surplus >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                <p className="text-xs text-slate-500 uppercase">{surplus >= 0 ? "Surplus" : "Shortfall"}</p>
                <p className={`text-2xl font-bold ${surplus >= 0 ? "text-green-600" : "text-red-600"}`}>${Math.abs(surplus).toLocaleString()}</p>
              </div>
            </div>
            {renderChart(breakdown, p.retirementAge)}
            <YearlyBreakdownTable breakdown={breakdown} retirementAge={p.retirementAge} />
          </div>
        );
      })}

      {projections.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-2xl">No retirement projections yet. Create one to see your client's retirement outlook.</div>}

      {showCalc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Retirement Projection Calculator</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-retirement">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs font-semibold">Current Age</label><input type="number" required value={form.currentAge} onChange={e => setForm({...form, currentAge: e.target.value})} data-testid="input-ret-current-age" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                <div><label className="text-xs font-semibold">Retirement Age</label><input type="number" required value={form.retirementAge} onChange={e => setForm({...form, retirementAge: e.target.value})} data-testid="input-ret-retirement-age" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                <div><label className="text-xs font-semibold">Life Expectancy</label><input type="number" required value={form.lifeExpectancy} onChange={e => setForm({...form, lifeExpectancy: e.target.value})} data-testid="input-ret-life-expectancy" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold">Current Savings ($)</label><input type="number" required value={form.currentSavings} onChange={e => setForm({...form, currentSavings: e.target.value})} data-testid="input-ret-savings" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                <div><label className="text-xs font-semibold">Annual Contribution ($)</label><input type="number" required value={form.annualContribution} onChange={e => setForm({...form, annualContribution: e.target.value})} data-testid="input-ret-contribution" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold">Expected Return (%)</label><input type="number" step="0.1" required value={form.expectedReturn} onChange={e => setForm({...form, expectedReturn: e.target.value})} data-testid="input-ret-return" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                <div><label className="text-xs font-semibold">Inflation Rate (%)</label><input type="number" step="0.1" required value={form.inflationRate} onChange={e => setForm({...form, inflationRate: e.target.value})} data-testid="input-ret-inflation" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
              </div>
              <div><label className="text-xs font-semibold">Desired Annual Retirement Income ($)</label><input type="number" required value={form.desiredRetirementIncome} onChange={e => setForm({...form, desiredRetirementIncome: e.target.value})} data-testid="input-ret-income" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCalc(false)} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createProjection.isPending} data-testid="button-submit-retirement" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createProjection.isPending ? "Calculating..." : "Calculate & Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function InsuranceSection({ clientId }: { clientId: number }) {
  const { data: analyses = [] } = useInsuranceAnalyses(clientId);
  const createAnalysis = useCreateInsuranceAnalysis();
  const deleteAnalysis = useDeleteInsuranceAnalysis(clientId);
  const [showCalc, setShowCalc] = useState(false);
  const [form, setForm] = useState({
    annualIncome: "80000", yearsOfIncomeNeeded: "20",
    existingLifeCoverage: "0", existingAssets: "0",
    monthlyExpenses: "5000", existingDisabilityCoverage: "0",
    criticalIllnessLumpSum: "100000", existingCriticalIllnessCoverage: "0"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createAnalysis.mutate({
      data: {
        annualIncome: form.annualIncome,
        yearsOfIncomeNeeded: parseInt(form.yearsOfIncomeNeeded),
        existingLifeCoverage: form.existingLifeCoverage,
        existingAssets: form.existingAssets,
        monthlyExpenses: form.monthlyExpenses,
        existingDisabilityCoverage: form.existingDisabilityCoverage,
        criticalIllnessLumpSum: form.criticalIllnessLumpSum,
        existingCriticalIllnessCoverage: form.existingCriticalIllnessCoverage,
      }
    }, { onSuccess: () => setShowCalc(false) });
  };

  const GapIndicator = ({ gap, label }: { gap: number; label: string }) => (
    <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${gap > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`} data-testid={`gap-${label}`}>
      {gap > 0 ? <Shield className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
      <span className="text-sm font-semibold">{gap > 0 ? `$${gap.toLocaleString()} gap` : "Fully covered"}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-base font-bold text-slate-900">Insurance Needs Analysis</h2>
        <button onClick={() => setShowCalc(true)} data-testid="button-new-insurance" className="flex items-center space-x-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-xl hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="w-4 h-4" /><span>New Analysis</span>
        </button>
      </div>

      {analyses.map((a: { id: number; annualIncome: string; yearsOfIncomeNeeded: number; existingLifeCoverage: string; existingAssets: string; monthlyExpenses: string; existingDisabilityCoverage: string; criticalIllnessLumpSum: string; existingCriticalIllnessCoverage: string; recommendedLifeCoverage: string | null; lifeCoverageGap: string | null; recommendedDisabilityCoverage: string | null; disabilityCoverageGap: string | null; recommendedCriticalIllnessCoverage: string | null; criticalIllnessCoverageGap: string | null; createdAt: string | null }) => (
        <div key={a.id} className="border border-border rounded-2xl p-6" data-testid={`insurance-analysis-${a.id}`}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-bold">Insurance Needs Analysis</h3>
              <p className="text-sm text-slate-500">{a.createdAt ? format(new Date(a.createdAt), 'MMM d, yyyy') : ''}</p>
            </div>
            <button onClick={() => { if (confirm("Delete this analysis?")) deleteAnalysis.mutate(a.id); }} data-testid={`button-delete-insurance-${a.id}`} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
          </div>

          <div className="space-y-6">
            <div className="border rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2"><Shield className="w-4 h-4 text-violet-500" /><span>Life Insurance (Income Replacement)</span></h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><p className="text-xs text-slate-500">Recommended</p><p className="text-lg font-bold">${parseFloat(a.recommendedLifeCoverage || "0").toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-500">Existing Coverage</p><p className="text-lg font-bold">${parseFloat(a.existingLifeCoverage).toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-500">Method</p><p className="text-sm">${parseFloat(a.annualIncome).toLocaleString()} × {a.yearsOfIncomeNeeded} years</p></div>
              </div>
              <GapIndicator gap={parseFloat(a.lifeCoverageGap || "0")} label="life" />
            </div>

            <div className="border rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2"><Shield className="w-4 h-4 text-purple-500" /><span>Disability Insurance (Monthly Gap)</span></h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><p className="text-xs text-slate-500">Recommended (60% of monthly)</p><p className="text-lg font-bold">${parseFloat(a.recommendedDisabilityCoverage || "0").toLocaleString()}/mo</p></div>
                <div><p className="text-xs text-slate-500">Existing Coverage</p><p className="text-lg font-bold">${parseFloat(a.existingDisabilityCoverage).toLocaleString()}/mo</p></div>
                <div><p className="text-xs text-slate-500">Monthly Income</p><p className="text-sm">${(parseFloat(a.annualIncome) / 12).toLocaleString()}/mo</p></div>
              </div>
              <GapIndicator gap={parseFloat(a.disabilityCoverageGap || "0")} label="disability" />
            </div>

            <div className="border rounded-xl p-4">
              <h4 className="font-semibold text-sm mb-3 flex items-center space-x-2"><Shield className="w-4 h-4 text-orange-500" /><span>Critical Illness (Lump Sum)</span></h4>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div><p className="text-xs text-slate-500">Recommended</p><p className="text-lg font-bold">${parseFloat(a.recommendedCriticalIllnessCoverage || "0").toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-500">Existing Coverage</p><p className="text-lg font-bold">${parseFloat(a.existingCriticalIllnessCoverage).toLocaleString()}</p></div>
                <div><p className="text-xs text-slate-500">Desired Lump Sum</p><p className="text-sm">${parseFloat(a.criticalIllnessLumpSum).toLocaleString()}</p></div>
              </div>
              <GapIndicator gap={parseFloat(a.criticalIllnessCoverageGap || "0")} label="critical-illness" />
            </div>
          </div>
        </div>
      ))}

      {analyses.length === 0 && <div className="text-center py-12 text-slate-500 border border-dashed rounded-2xl">No insurance analyses yet. Create one to identify coverage gaps.</div>}

      {showCalc && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-6">Insurance Needs Calculator</h2>
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="form-insurance">
              <div className="border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm">Life Insurance</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold">Annual Income ($)</label><input type="number" required value={form.annualIncome} onChange={e => setForm({...form, annualIncome: e.target.value})} data-testid="input-ins-income" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                  <div><label className="text-xs font-semibold">Years of Income Needed</label><input type="number" required value={form.yearsOfIncomeNeeded} onChange={e => setForm({...form, yearsOfIncomeNeeded: e.target.value})} data-testid="input-ins-years" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold">Existing Life Coverage ($)</label><input type="number" required value={form.existingLifeCoverage} onChange={e => setForm({...form, existingLifeCoverage: e.target.value})} data-testid="input-ins-existing-life" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                  <div><label className="text-xs font-semibold">Existing Assets ($)</label><input type="number" required value={form.existingAssets} onChange={e => setForm({...form, existingAssets: e.target.value})} data-testid="input-ins-assets" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                </div>
              </div>
              <div className="border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm">Disability Insurance</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold">Monthly Expenses ($)</label><input type="number" required value={form.monthlyExpenses} onChange={e => setForm({...form, monthlyExpenses: e.target.value})} data-testid="input-ins-expenses" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                  <div><label className="text-xs font-semibold">Existing Disability Coverage ($/mo)</label><input type="number" required value={form.existingDisabilityCoverage} onChange={e => setForm({...form, existingDisabilityCoverage: e.target.value})} data-testid="input-ins-existing-disability" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                </div>
              </div>
              <div className="border rounded-xl p-4 space-y-3">
                <h4 className="font-semibold text-sm">Critical Illness</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-semibold">Lump Sum Needed ($)</label><input type="number" required value={form.criticalIllnessLumpSum} onChange={e => setForm({...form, criticalIllnessLumpSum: e.target.value})} data-testid="input-ins-ci-lump" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                  <div><label className="text-xs font-semibold">Existing CI Coverage ($)</label><input type="number" required value={form.existingCriticalIllnessCoverage} onChange={e => setForm({...form, existingCriticalIllnessCoverage: e.target.value})} data-testid="input-ins-existing-ci" className="w-full px-3 py-2 rounded-xl border mt-1 text-sm" /></div>
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-3">
                <button type="button" onClick={() => setShowCalc(false)} className="px-6 py-3 rounded-xl font-semibold text-slate-500 hover:bg-muted">Cancel</button>
                <button type="submit" disabled={createAnalysis.isPending} data-testid="button-submit-insurance" className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground">{createAnalysis.isPending ? "Calculating..." : "Calculate & Save"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
