import { HostLayout } from "@/components/HostLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Receipt, CreditCard, Users, Plus, X, Loader2 } from "lucide-react";
import type {
  HostInvoice,
  HostPayable,
  HostStaffMember,
  Company,
} from "@shared/schema";

export default function Accounting() {
  const [tab, setTab] = useState<"ar" | "ap" | "hr">("ar");

  const tabs = [
    { id: "ar" as const, label: "Accounts Receivable", icon: Receipt },
    { id: "ap" as const, label: "Accounts Payable", icon: CreditCard },
    { id: "hr" as const, label: "HR", icon: Users },
  ];

  return (
    <HostLayout>
      <div className="space-y-6">
        <div>
          <h1
            className="text-3xl font-display font-bold"
            data-testid="text-accounting-title"
          >
            Accounting
          </h1>
          <p className="text-muted-foreground mt-1">
            Financial management and HR
          </p>
        </div>

        <div className="flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              data-testid={`tab-${t.id}`}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {tab === "ar" && <ARTab />}
        {tab === "ap" && <APTab />}
        {tab === "hr" && <HRTab />}
      </div>
    </HostLayout>
  );
}

function ARTab() {
  const { data: invoices } = useQuery<HostInvoice[]>({
    queryKey: ["/api/crm/host/invoices"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/crm/host/companies"],
  });
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const createInvoice = useMutation({
    mutationFn: async (data: {
      companyId: number;
      amount: string;
      description: string;
      dueDate: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/host/invoices", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/invoices"] });
      setShowForm(false);
      toast({ title: "Invoice created" });
    },
  });

  const updateInvoice = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/crm/host/invoices/${id}`, {
        status,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/invoices"] });
    },
  });

  const [form, setForm] = useState({
    companyId: "",
    amount: "",
    description: "",
    dueDate: "",
  });

  return (
    <div className="space-y-4" data-testid="section-ar">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold">Invoices</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          data-testid="button-new-invoice"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New Invoice
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Create Invoice</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <select
              value={form.companyId}
              onChange={(e) =>
                setForm((f) => ({ ...f, companyId: e.target.value }))
              }
              data-testid="select-invoice-company"
              className="px-4 py-3 rounded-xl border text-sm"
            >
              <option value="">Select Company</option>
              {companies?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              placeholder="Amount"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              data-testid="input-invoice-amount"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              data-testid="input-invoice-description"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value }))
              }
              data-testid="input-invoice-due-date"
              className="px-4 py-3 rounded-xl border text-sm"
            />
          </div>
          <button
            onClick={() =>
              createInvoice.mutate({
                companyId: Number(form.companyId),
                amount: form.amount,
                description: form.description,
                dueDate: form.dueDate,
              })
            }
            disabled={
              createInvoice.isPending || !form.companyId || !form.amount
            }
            data-testid="button-submit-invoice"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
          >
            {createInvoice.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Create Invoice"
            )}
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm" data-testid="table-invoices">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Invoice #
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Company
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Amount
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Due Date
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Status
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {invoices?.map((inv) => {
              const comp = companies?.find((c) => c.id === inv.companyId);
              return (
                <tr
                  key={inv.id}
                  className="border-t border-border"
                  data-testid={`row-invoice-${inv.id}`}
                >
                  <td className="py-3 px-4 font-medium">{inv.invoiceNumber}</td>
                  <td className="py-3 px-4">
                    {comp?.name ?? `Company #${inv.companyId}`}
                  </td>
                  <td className="py-3 px-4 font-semibold">
                    ${Number(inv.amount).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-muted-foreground">
                    {inv.dueDate ?? "—"}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        inv.status === "paid"
                          ? "bg-emerald-50 text-emerald-600"
                          : inv.status === "overdue"
                            ? "bg-red-50 text-red-600"
                            : inv.status === "sent"
                              ? "bg-violet-50 text-violet-600"
                              : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <select
                      value={inv.status}
                      onChange={(e) =>
                        updateInvoice.mutate({
                          id: inv.id,
                          status: e.target.value,
                        })
                      }
                      className="text-xs border rounded-lg px-2 py-1"
                    >
                      <option value="draft">Draft</option>
                      <option value="sent">Sent</option>
                      <option value="paid">Paid</option>
                      <option value="overdue">Overdue</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </td>
                </tr>
              );
            })}
            {(!invoices || invoices.length === 0) && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-muted-foreground"
                >
                  No invoices yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function APTab() {
  const { data: payables } = useQuery<HostPayable[]>({
    queryKey: ["/api/crm/host/payables"],
  });
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const createPayable = useMutation({
    mutationFn: async (data: {
      vendorName: string;
      amount: string;
      description: string;
      dueDate: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/host/payables", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/payables"] });
      setShowForm(false);
      toast({ title: "Payable created" });
    },
  });

  const [form, setForm] = useState({
    vendorName: "",
    amount: "",
    description: "",
    dueDate: "",
  });

  return (
    <div className="space-y-4" data-testid="section-ap">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold">Payables</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          data-testid="button-new-payable"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New Payable
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Create Payable</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Vendor Name"
              value={form.vendorName}
              onChange={(e) =>
                setForm((f) => ({ ...f, vendorName: e.target.value }))
              }
              data-testid="input-vendor-name"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Amount"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              data-testid="input-payable-amount"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              data-testid="input-payable-description"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              type="date"
              value={form.dueDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value }))
              }
              data-testid="input-payable-due-date"
              className="px-4 py-3 rounded-xl border text-sm"
            />
          </div>
          <button
            onClick={() => createPayable.mutate(form)}
            disabled={
              createPayable.isPending || !form.vendorName || !form.amount
            }
            data-testid="button-submit-payable"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
          >
            {createPayable.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Create Payable"
            )}
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm" data-testid="table-payables">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Vendor
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Amount
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Description
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Due Date
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {payables?.map((p) => (
              <tr
                key={p.id}
                className="border-t border-border"
                data-testid={`row-payable-${p.id}`}
              >
                <td className="py-3 px-4 font-medium">{p.vendorName}</td>
                <td className="py-3 px-4 font-semibold">
                  ${Number(p.amount).toLocaleString()}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {p.description}
                </td>
                <td className="py-3 px-4 text-muted-foreground">
                  {p.dueDate ?? "—"}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      p.status === "paid"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-yellow-50 text-yellow-600"
                    }`}
                  >
                    {p.status}
                  </span>
                </td>
              </tr>
            ))}
            {(!payables || payables.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No payables yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HRTab() {
  const { data: hrStaff } = useQuery<HostStaffMember[]>({
    queryKey: ["/api/crm/host/hr"],
  });
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();

  const createStaff = useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
      department: string;
      position: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/host/hr", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/hr"] });
      setShowForm(false);
      toast({ title: "Staff member added" });
    },
  });

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    department: "",
    position: "",
  });

  return (
    <div className="space-y-4" data-testid="section-hr">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-bold">
          Host Corporation Staff
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          data-testid="button-new-staff"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add Staff
        </button>
      </div>

      {showForm && (
        <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Add Staff Member</h3>
            <button onClick={() => setShowForm(false)}>
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="First Name"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
              data-testid="input-hr-first-name"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Last Name"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
              data-testid="input-hr-last-name"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              data-testid="input-hr-email"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Phone"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              data-testid="input-hr-phone"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Department"
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
              data-testid="input-hr-department"
              className="px-4 py-3 rounded-xl border text-sm"
            />
            <input
              placeholder="Position"
              value={form.position}
              onChange={(e) =>
                setForm((f) => ({ ...f, position: e.target.value }))
              }
              data-testid="input-hr-position"
              className="px-4 py-3 rounded-xl border text-sm"
            />
          </div>
          <button
            onClick={() => createStaff.mutate(form)}
            disabled={
              createStaff.isPending ||
              !form.firstName ||
              !form.lastName ||
              !form.email
            }
            data-testid="button-submit-staff"
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
          >
            {createStaff.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add Staff Member"
            )}
          </button>
        </div>
      )}

      <div className="glass-card rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm" data-testid="table-hr">
          <thead className="bg-muted/50">
            <tr>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Name
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Email
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Department
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Position
              </th>
              <th className="py-3 px-4 text-left font-semibold text-muted-foreground">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {hrStaff?.map((s) => (
              <tr
                key={s.id}
                className="border-t border-border"
                data-testid={`row-hr-${s.id}`}
              >
                <td className="py-3 px-4 font-medium">
                  {s.firstName} {s.lastName}
                </td>
                <td className="py-3 px-4 text-muted-foreground">{s.email}</td>
                <td className="py-3 px-4">{s.department ?? "—"}</td>
                <td className="py-3 px-4">{s.position ?? "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${s.isActive ? "bg-emerald-50 text-emerald-600" : "bg-gray-50 text-gray-600"}`}
                  >
                    {s.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
            {(!hrStaff || hrStaff.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-muted-foreground"
                >
                  No staff members yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
