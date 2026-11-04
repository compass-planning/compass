import { useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { useCompanySettings, useAvailablePlans, useUpdateCompanySettings, useUpdateCompanyModules } from "@/hooks/use-company";
import type { Company, PlanDefinition } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import {
  Building2, CreditCard, Package, Settings2, Check, Crown, Users, Zap,
  Mail, CalendarDays, Shield, TrendingUp, Mic, PieChart, ToggleLeft, ToggleRight,
  Loader2, DollarSign, Lock, Award, FileText
} from "lucide-react";

type TabId = "subscription" | "modules" | "profile" | "billing";

function getCompanyTabs(isFr: boolean): { id: TabId; label: string; icon: typeof Building2 }[] {
  return [
    { id: "subscription", label: isFr ? "Abonnement" : "Subscription", icon: CreditCard },
    { id: "modules", label: isFr ? "Modules" : "Modules", icon: Package },
    { id: "profile", label: isFr ? "Profil de l'entreprise" : "Company Profile", icon: Building2 },
    { id: "billing", label: isFr ? "Facturation" : "Billing", icon: Settings2 },
  ];
}

export default function CompanySettings() {
  const { isFrench: isFr } = useLanguage();
  const tabs = getCompanyTabs(isFr);
  const [activeTab, setActiveTab] = useState<TabId>("subscription");
  const { data: company, isLoading } = useCompanySettings();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="animate-pulse space-y-6">
          <div className="h-10 bg-white rounded-2xl w-64" />
          <div className="h-96 bg-white rounded-xl" />
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-slate-500">Company not found.</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground" data-testid="text-company-settings-title">Company Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your subscription, modules, and company profile</p>
        </div>

        <div className="flex gap-8">
          <div className="w-64 shrink-0">
            <nav className="space-y-1" data-testid="nav-settings-tabs">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  data-testid={`tab-${tab.id}`}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-slate-500 hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex-1 min-w-0">
            {activeTab === "subscription" && <SubscriptionTab company={company} />}
            {activeTab === "modules" && <ModulesTab company={company} />}
            {activeTab === "profile" && <ProfileTab company={company} />}
            {activeTab === "billing" && <BillingTab />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

const planIcons: Record<string, typeof Crown> = { solo: Zap, standard: Users, professional: Award, platinum: Crown };
const planColors: Record<string, string> = {
  solo: "from-violet-500 to-violet-600",
  standard: "from-emerald-500 to-emerald-600",
  professional: "from-purple-500 to-purple-600",
  platinum: "from-amber-500 to-amber-600",
};

function SubscriptionTab({ company }: { company: Company }) {
  const { data: plans } = useAvailablePlans();
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();
  const { isFrench: isFr } = useLanguage();
  const { data: staffList } = useQuery<{ id: number }[]>({ queryKey: ["/api/crm/staff"] });
  const userCount = staffList?.length ?? 0;

  const currentPlan = plans?.find((p: PlanDefinition) => p.id === company.plan);

  const handleChangePlan = (planId: string) => {
    const selectedPlan = plans?.find((p: PlanDefinition) => p.id === planId);
    if (!selectedPlan) return;
    updateSettings.mutate(
      { plan: planId },
      {
        onSuccess: () => {
          toast({ title: "Plan updated", description: `Switched to ${selectedPlan.name} plan. Module availability updated.` });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-8" data-testid="section-subscription">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Current Plan</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              You are on the <span className="font-semibold text-foreground">{currentPlan?.name ?? company.plan}</span> plan
            </p>
            {currentPlan && (
              <p className="text-sm text-slate-500 mt-2">
                <Users className="w-4 h-4 inline mr-1" />
                {userCount} of {currentPlan.maxMembers === -1 ? "unlimited" : currentPlan.maxMembers} users
              </p>
            )}
          </div>
          {currentPlan && (
            <div className="text-right">
              <p className="text-4xl font-display font-bold text-foreground">${currentPlan.price}<span className="text-lg text-slate-500 font-normal">/{currentPlan.interval}</span></p>
            </div>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-display font-bold mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6" data-testid="grid-plans">
          {(plans ?? []).map((plan: PlanDefinition) => {
            const isActive = company.plan === plan.id;
            const PlanIcon = planIcons[plan.id] || Zap;
            const gradientClass = planColors[plan.id] || planColors.solo;
            return (
              <div
                key={plan.id}
                data-testid={`card-plan-${plan.id}`}
                className={`rounded-xl border-2 p-6 transition-all flex flex-col ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-lg"
                    : "border-border bg-white hover:border-primary/30 hover:shadow-md"
                }`}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradientClass} text-white`}>
                    <PlanIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-display font-bold">{plan.name}</h4>
                    {isActive && <span className="text-xs font-semibold text-primary">Current Plan</span>}
                  </div>
                </div>
                <p className="text-sm text-slate-500 mb-4">{plan.description}</p>
                <p className="text-xl font-bold text-slate-900 mb-1">${plan.price}<span className="text-sm text-slate-500 font-normal">/{plan.interval}</span></p>
                <p className="text-xs text-slate-500 mb-4">
                  {plan.maxMembers === -1 ? "Unlimited" : `Up to ${plan.maxMembers}`} user{plan.maxMembers !== 1 ? "s" : ""}
                </p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-secondary shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {Object.keys(plan.addonModules).length > 0 && (
                    <li className="flex items-start gap-2 text-sm text-slate-500">
                      <DollarSign className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{Object.keys(plan.addonModules).length} add-on modules available</span>
                    </li>
                  )}
                </ul>
                <button
                  onClick={() => handleChangePlan(plan.id)}
                  disabled={isActive || updateSettings.isPending}
                  data-testid={`button-select-plan-${plan.id}`}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                    isActive
                      ? "bg-primary/10 text-primary cursor-default"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                  }`}
                >
                  {isActive ? (isFr ? "Plan actuel" : "Current Plan") : updateSettings.isPending ? "Updating..." : "Select Plan"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface ModuleConfig {
  key: keyof Company;
  label: string;
  description: string;
  icon: typeof Mail;
  color: string;
}

const moduleConfigs: ModuleConfig[] = [
  { key: "moduleEmail", label: "Email Integration", description: "Outlook email client for sending and receiving emails", icon: Mail, color: "text-violet-500 bg-violet-50" },
  { key: "moduleCalendar", label: "Calendar Integration", description: "Outlook calendar for scheduling meetings and events", icon: CalendarDays, color: "text-indigo-500 bg-indigo-50" },
  { key: "moduleInsurance", label: "Insurance Products", description: "Track and manage insurance policies for clients", icon: Shield, color: "text-emerald-500 bg-emerald-50" },
  { key: "moduleMutualFund", label: "Mutual Fund Products", description: "Track and manage mutual fund investments", icon: TrendingUp, color: "text-purple-500 bg-purple-50" },
  { key: "moduleSegFund", label: "Segregated Fund Products", description: "Track and manage segregated fund investments", icon: TrendingUp, color: "text-amber-500 bg-amber-50" },
  { key: "moduleMeetingRecorder", label: "Meeting Recorder", description: "AI-powered meeting transcription and summarization", icon: Mic, color: "text-rose-500 bg-rose-50" },
  { key: "moduleAnalytics", label: "Analytics Dashboard", description: "Business analytics and reporting tools", icon: PieChart, color: "text-violet-500 bg-violet-50" },
  { key: "modulePipeline", label: "Sales Pipeline", description: "Lead tracking and sales pipeline management", icon: TrendingUp, color: "text-orange-500 bg-orange-50" },
  { key: "moduleFinancialPlanning", label: "Financial Planning", description: "Comprehensive financial planning with AI recommendations", icon: FileText, color: "text-teal-500 bg-teal-50" },
];

function ModulesTab({ company }: { company: Company }) {
  const { data: plans } = useAvailablePlans();
  const updateModules = useUpdateCompanyModules();
  const { toast } = useToast();

  const currentPlan = plans?.find((p: PlanDefinition) => p.id === company.plan);

  const handleToggle = (moduleKey: keyof Company, currentValue: boolean) => {
    updateModules.mutate(
      { [moduleKey]: !currentValue } as Partial<Pick<Company, "moduleEmail" | "moduleCalendar" | "moduleInsurance" | "moduleMutualFund" | "moduleSegFund" | "moduleMeetingRecorder" | "moduleAnalytics" | "modulePipeline">>,
      {
        onSuccess: () => {
          const mod = moduleConfigs.find(m => m.key === moduleKey);
          toast({
            title: !currentValue ? "Module enabled" : "Module disabled",
            description: `${mod?.label ?? String(moduleKey)} has been ${!currentValue ? "enabled" : "disabled"}`,
          });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const getModuleStatus = (moduleKey: string): "included" | "addon" | "unavailable" => {
    if (!currentPlan) return "unavailable";
    const key = moduleKey as keyof typeof currentPlan.includedModules;
    if (currentPlan.includedModules[key]) return "included";
    if (currentPlan.addonModules[key]) return "addon";
    return "unavailable";
  };

  const enabledCount = moduleConfigs.filter(m => company[m.key] === true).length;

  return (
    <div className="space-y-6" data-testid="section-modules">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 border border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Feature Modules</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Enable or disable features for your team.
              {currentPlan && <span className="ml-1 font-medium text-foreground">{currentPlan.name}</span>} plan.
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-slate-900">{enabledCount}<span className="text-sm text-slate-500 font-normal">/{moduleConfigs.length}</span></p>
            <p className="text-xs text-slate-500">modules active</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4" data-testid="grid-modules">
        {moduleConfigs.map(mod => {
          const isEnabled = company[mod.key] === true;
          const status = getModuleStatus(String(mod.key));
          const addonInfo = currentPlan?.addonModules[mod.key as keyof typeof currentPlan.addonModules];

          return (
            <div
              key={mod.key}
              data-testid={`card-module-${mod.key}`}
              className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${
                isEnabled ? "bg-white border-border shadow-sm" : "bg-muted/30 border-border/50"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${mod.color}`}>
                  <mod.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold ${isEnabled ? "text-foreground" : "text-slate-500"}`}>{mod.label}</h4>
                    {status === "included" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full" data-testid={`badge-included-${mod.key}`}>
                        <Check className="w-3 h-3" />
                        Included
                      </span>
                    )}
                    {status === "addon" && addonInfo && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-full" data-testid={`badge-addon-${mod.key}`}>
                        <DollarSign className="w-3 h-3" />
                        +${addonInfo.price}/{addonInfo.interval}{addonInfo.perUser ? "/user" : ""}
                      </span>
                    )}
                    {status === "unavailable" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full" data-testid={`badge-unavailable-${mod.key}`}>
                        <Lock className="w-3 h-3" />
                        Upgrade required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500">{mod.description}</p>
                </div>
              </div>
              {status === "included" ? (
                <div className="shrink-0" data-testid={`toggle-${mod.key}`}>
                  <ToggleRight className="w-10 h-10 text-secondary opacity-50 cursor-not-allowed" />
                </div>
              ) : status === "addon" ? (
                <button
                  onClick={() => handleToggle(mod.key, isEnabled)}
                  disabled={updateModules.isPending}
                  data-testid={`toggle-${mod.key}`}
                  className="shrink-0"
                >
                  {isEnabled ? (
                    <ToggleRight className="w-10 h-10 text-secondary" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-slate-500/40" />
                  )}
                </button>
              ) : (
                <div className="shrink-0" data-testid={`toggle-${mod.key}`}>
                  <ToggleLeft className="w-10 h-10 text-slate-500/20 cursor-not-allowed" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileTab({ company }: { company: Company }) {
  const [name, setName] = useState(company.name);
  const updateSettings = useUpdateCompanySettings();
  const { toast } = useToast();
  const hasChanges = name !== company.name;

  const handleSave = () => {
    updateSettings.mutate(
      { name },
      {
        onSuccess: () => {
          toast({ title: "Company profile updated" });
        },
        onError: (err: Error) => {
          toast({ title: "Error", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6" data-testid="section-profile">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 border border-border">
        <h2 className="text-lg font-bold text-slate-900 mb-6">Company Profile</h2>
        <div className="space-y-6 max-w-lg">
          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Company Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              data-testid="input-company-name"
              className="w-full px-4 py-3 rounded-xl border border-border focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 transition-colors bg-background"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground block mb-2">Company Logo</label>
            <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-slate-500 hover:border-primary/30 hover:text-primary transition-colors cursor-pointer" data-testid="placeholder-logo">
              <Building2 className="w-8 h-8" />
            </div>
            <p className="text-xs text-slate-500 mt-2">Logo upload coming soon</p>
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={updateSettings.isPending || !name.trim()}
              data-testid="button-save-profile"
              className="px-6 py-3 rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {updateSettings.isPending ? (
                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Saving...</span>
              ) : "Save Changes"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function BillingTab() {
  return (
    <div className="space-y-6" data-testid="section-billing">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-8 border border-border">
        <h2 className="text-lg font-bold text-slate-900 mb-2">Billing History</h2>
        <p className="text-slate-500 mb-6">View and manage your billing information</p>

        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full text-left" data-testid="table-billing">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Date</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Description</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Amount</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500">Status</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-500"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-6 py-16 text-center text-slate-500">
                  <CreditCard className="w-10 h-10 mx-auto mb-3 text-slate-500/30" />
                  <p className="font-medium">No billing history yet</p>
                  <p className="text-sm mt-1">Payment processing integration coming soon</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
