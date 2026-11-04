import { HostLayout } from "@/components/HostLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams } from "wouter";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Users,
  CreditCard,
  ArrowLeft,
  Save,
  Loader2,
  Headphones,
  Check,
  DollarSign,
  Zap,
  Crown,
  Award,
} from "lucide-react";
import { Link } from "wouter";
import { PLAN_DEFINITIONS } from "@shared/schema";
import type { Company, PlanDefinition, ServiceCase } from "@shared/schema";

interface CompanyWithCount extends Company {
  userCount: number;
}

interface SafeStaff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isAdmin: boolean;
  createdAt: string;
}

const planIcons: Record<string, typeof Crown> = {
  solo: Zap,
  standard: Users,
  professional: Award,
  platinum: Crown,
};
const planColors: Record<string, string> = {
  solo: "from-violet-500 to-violet-600",
  standard: "from-emerald-500 to-emerald-600",
  professional: "from-purple-500 to-purple-600",
  platinum: "from-amber-500 to-amber-600",
};

export default function BusinessDetail() {
  const params = useParams<{ id: string }>();
  const companyId = Number(params.id);
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "users" | "tier" | "cases">(
    "overview",
  );

  const { data: company, isLoading } = useQuery<CompanyWithCount>({
    queryKey: ["/api/crm/host/companies", companyId],
  });
  const { data: staffList } = useQuery<SafeStaff[]>({
    queryKey: ["/api/crm/host/companies", companyId, "staff"],
  });
  const { data: cases } = useQuery<ServiceCase[]>({
    queryKey: [`/api/crm/host/cases?companyId=${companyId}`],
  });

  const [editData, setEditData] = useState<Partial<Company>>({});
  const updateCompany = useMutation({
    mutationFn: async (data: Partial<Company>) => {
      const res = await apiRequest(
        "PATCH",
        `/api/crm/host/companies/${companyId}`,
        data,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/host/companies", companyId],
      });
      toast({ title: "Company updated" });
    },
    onError: (err: Error) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || !company) {
    return (
      <HostLayout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </HostLayout>
    );
  }

  const tabList = [
    { id: "overview" as const, label: "Overview", icon: Building2 },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "tier" as const, label: "Tier", icon: CreditCard },
    { id: "cases" as const, label: "Cases", icon: Headphones },
  ];

  const currentPlan = PLAN_DEFINITIONS.find((p) => p.id === company.plan);
  const monthlyBillable = currentPlan ? currentPlan.price : 0;

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/host/clients">
            <button
              className="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-colors"
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-company-name"
            >
              {company.name}
            </h1>
            <p className="text-muted-foreground">
              {company.userCount} users · {currentPlan?.name ?? company.plan}{" "}
              plan
            </p>
          </div>
        </div>

        <div className="flex gap-2 border-b border-border pb-1">
          {tabList.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div
            className="glass-card rounded-2xl p-6 border border-border space-y-4"
            data-testid="section-overview"
          >
            <h2 className="text-lg font-display font-bold">
              Company Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-muted-foreground">
                  Company Name
                </label>
                <input
                  defaultValue={company.name}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, name: e.target.value }))
                  }
                  data-testid="input-company-name"
                  className="w-full px-4 py-3 rounded-xl border mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">
                  Billing Contact
                </label>
                <input
                  defaultValue={company.contactName ?? ""}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, contactName: e.target.value }))
                  }
                  data-testid="input-contact-name"
                  className="w-full px-4 py-3 rounded-xl border mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">
                  Billing Email
                </label>
                <input
                  type="email"
                  defaultValue={company.billingEmail ?? ""}
                  onChange={(e) =>
                    setEditData((d) => ({ ...d, billingEmail: e.target.value }))
                  }
                  data-testid="input-billing-email"
                  className="w-full px-4 py-3 rounded-xl border mt-1 text-sm"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-muted-foreground">
                  Phone
                </label>
                <input
                  defaultValue={company.corporatePhone ?? ""}
                  onChange={(e) =>
                    setEditData((d) => ({
                      ...d,
                      corporatePhone: e.target.value,
                    }))
                  }
                  data-testid="input-corporate-phone"
                  className="w-full px-4 py-3 rounded-xl border mt-1 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-semibold text-muted-foreground">
                  Address
                </label>
                <input
                  defaultValue={company.corporateAddress ?? ""}
                  onChange={(e) =>
                    setEditData((d) => ({
                      ...d,
                      corporateAddress: e.target.value,
                    }))
                  }
                  data-testid="input-corporate-address"
                  className="w-full px-4 py-3 rounded-xl border mt-1 text-sm"
                />
              </div>
            </div>
            <button
              onClick={() => updateCompany.mutate(editData)}
              disabled={
                updateCompany.isPending || Object.keys(editData).length === 0
              }
              data-testid="button-save-company"
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {updateCompany.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </div>
        )}

        {tab === "users" && (
          <div
            className="glass-card rounded-2xl p-6 border border-border"
            data-testid="section-users"
          >
            <h2 className="text-lg font-display font-bold mb-4">
              Users & Roles
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Read-only view of {company.name}'s team members.
              {currentPlan && (
                <span className="ml-1">
                  {company.userCount} of{" "}
                  {currentPlan.maxMembers === -1
                    ? "unlimited"
                    : currentPlan.maxMembers}{" "}
                  seats used.
                </span>
              )}
            </p>
            {!staffList || staffList.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No users found for this company
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-users">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="py-3 px-4 font-semibold text-muted-foreground">
                        Name
                      </th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground">
                        Email
                      </th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground">
                        Role
                      </th>
                      <th className="py-3 px-4 font-semibold text-muted-foreground">
                        Admin
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-border last:border-0"
                        data-testid={`row-user-${m.id}`}
                      >
                        <td className="py-3 px-4 font-medium">
                          {m.firstName} {m.lastName}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {m.email}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium capitalize">
                            {m.role.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {m.isAdmin ? "Yes" : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "tier" && (
          <div className="space-y-6" data-testid="section-tier">
            <div className="glass-card rounded-2xl p-6 border border-border">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-display font-bold">
                    Current Subscription
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {company.userCount} active users
                    {currentPlan && currentPlan.maxMembers !== -1 && (
                      <span> of {currentPlan.maxMembers} allowed</span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-display font-bold">
                    ${monthlyBillable}
                    <span className="text-sm text-muted-foreground font-normal">
                      /mo
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {PLAN_DEFINITIONS.map((plan: PlanDefinition) => {
                const isActive = company.plan === plan.id;
                const PlanIcon = planIcons[plan.id] || Zap;
                const gradientClass = planColors[plan.id] || planColors.solo;
                const addonCount = Object.keys(plan.addonModules).length;
                return (
                  <div
                    key={plan.id}
                    data-testid={`tier-card-${plan.id}`}
                    className={`rounded-2xl border-2 p-5 transition-all flex flex-col ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-lg"
                        : "border-border bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradientClass} text-white`}
                      >
                        <PlanIcon className="w-4 h-4" />
                      </div>
                      <h3 className="font-display font-bold text-lg">
                        {plan.name}
                      </h3>
                    </div>
                    <p className="text-2xl font-bold mt-1">
                      ${plan.price}
                      <span className="text-sm text-muted-foreground font-normal">
                        /mo
                      </span>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.maxMembers === -1
                        ? "Unlimited"
                        : `Up to ${plan.maxMembers}`}{" "}
                      users
                    </p>
                    <ul className="space-y-1.5 mt-3 mb-4 flex-1">
                      {plan.features.slice(0, 4).map((f) => (
                        <li
                          key={f}
                          className="flex items-start gap-2 text-xs text-muted-foreground"
                        >
                          <Check className="w-3.5 h-3.5 text-secondary shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                      {addonCount > 0 && (
                        <li className="flex items-start gap-2 text-xs text-muted-foreground">
                          <DollarSign className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span>{addonCount} add-on modules</span>
                        </li>
                      )}
                    </ul>
                    {isActive && (
                      <span className="inline-block mt-auto text-xs px-3 py-1 rounded-full bg-primary text-primary-foreground font-semibold">
                        Current Plan
                      </span>
                    )}
                    {!isActive && (
                      <button
                        onClick={() =>
                          updateCompany.mutate({
                            plan: plan.id,
                          } as Partial<Company>)
                        }
                        disabled={updateCompany.isPending}
                        data-testid={`button-change-tier-${plan.id}`}
                        className="mt-auto w-full py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all"
                      >
                        Switch to {plan.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === "cases" && (
          <div
            className="glass-card rounded-2xl p-6 border border-border"
            data-testid="section-cases"
          >
            <h2 className="text-lg font-display font-bold mb-4">
              Service Cases
            </h2>
            {!cases || cases.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                No service cases for this company
              </p>
            ) : (
              <div className="space-y-3">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between py-3 border-b border-border last:border-0"
                    data-testid={`case-${c.id}`}
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {c.caseNumber} — {c.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {c.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          c.priority === "critical"
                            ? "bg-red-50 text-red-600"
                            : c.priority === "high"
                              ? "bg-orange-50 text-orange-600"
                              : c.priority === "medium"
                                ? "bg-yellow-50 text-yellow-600"
                                : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {c.priority}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          c.status === "open"
                            ? "bg-red-50 text-red-600"
                            : c.status === "in_progress"
                              ? "bg-yellow-50 text-yellow-600"
                              : c.status === "resolved"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-gray-50 text-gray-600"
                        }`}
                      >
                        {c.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </HostLayout>
  );
}
