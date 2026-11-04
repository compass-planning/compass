import { HostLayout } from "@/components/HostLayout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Headphones,
  Plus,
  X,
  Loader2,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import type { ServiceCase, ServiceCaseNote, Company } from "@shared/schema";

export default function ServiceCases() {
  const { data: cases } = useQuery<ServiceCase[]>({
    queryKey: ["/api/crm/host/cases"],
  });
  const { data: companies } = useQuery<Company[]>({
    queryKey: ["/api/crm/host/companies"],
  });
  const [showForm, setShowForm] = useState(false);
  const [selectedCase, setSelectedCase] = useState<ServiceCase | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const { toast } = useToast();

  const createCase = useMutation({
    mutationFn: async (data: {
      companyId: number;
      title: string;
      description: string;
      priority: string;
    }) => {
      const res = await apiRequest("POST", "/api/crm/host/cases", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/cases"] });
      setShowForm(false);
      toast({ title: "Case created" });
    },
  });

  const updateCase = useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: number;
      status?: string;
      priority?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/crm/host/cases/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/cases"] });
    },
  });

  const [form, setForm] = useState({
    companyId: "",
    title: "",
    description: "",
    priority: "medium",
  });

  const filtered =
    cases?.filter((c) => filter === "all" || c.status === filter) ?? [];

  const statusCounts = {
    all: cases?.length ?? 0,
    open: cases?.filter((c) => c.status === "open").length ?? 0,
    in_progress: cases?.filter((c) => c.status === "in_progress").length ?? 0,
    resolved: cases?.filter((c) => c.status === "resolved").length ?? 0,
    closed: cases?.filter((c) => c.status === "closed").length ?? 0,
  };

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-service-title"
            >
              Service Cases
            </h1>
            <p className="text-muted-foreground mt-1">
              {cases?.length ?? 0} total cases
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            data-testid="button-new-case"
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
          >
            <Plus className="w-4 h-4" /> New Case
          </button>
        </div>

        <div className="flex gap-2 flex-wrap" data-testid="filter-status">
          {Object.entries(statusCounts).map(([key, count]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              data-testid={`filter-${key}`}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                filter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-white border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {key === "all" ? "All" : key.replace("_", " ")} ({count})
            </button>
          ))}
        </div>

        {showForm && (
          <div className="glass-card rounded-2xl p-6 border border-border space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold">Create Service Case</h3>
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
                data-testid="select-case-company"
                className="px-4 py-3 rounded-xl border text-sm"
              >
                <option value="">Select Brokerage</option>
                {companies?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value }))
                }
                data-testid="select-case-priority"
                className="px-4 py-3 rounded-xl border text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
                data-testid="input-case-title"
                className="px-4 py-3 rounded-xl border text-sm col-span-2"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                data-testid="input-case-description"
                className="px-4 py-3 rounded-xl border text-sm col-span-2 h-24 resize-none"
              />
            </div>
            <button
              onClick={() =>
                createCase.mutate({
                  companyId: Number(form.companyId),
                  title: form.title,
                  description: form.description,
                  priority: form.priority,
                })
              }
              disabled={createCase.isPending || !form.companyId || !form.title}
              data-testid="button-submit-case"
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
            >
              {createCase.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Create Case"
              )}
            </button>
          </div>
        )}

        {selectedCase ? (
          <CaseDetail
            serviceCase={selectedCase}
            companies={companies ?? []}
            onBack={() => setSelectedCase(null)}
          />
        ) : (
          <div className="space-y-3" data-testid="list-cases">
            {filtered.map((c) => {
              const comp = companies?.find((co) => co.id === c.companyId);
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCase(c)}
                  data-testid={`card-case-${c.id}`}
                  className="glass-card rounded-2xl p-5 border border-border hover:border-primary/30 hover:shadow-md transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          c.priority === "critical"
                            ? "bg-red-50"
                            : c.priority === "high"
                              ? "bg-orange-50"
                              : c.priority === "medium"
                                ? "bg-yellow-50"
                                : "bg-gray-50"
                        }`}
                      >
                        <Headphones
                          className={`w-5 h-5 ${
                            c.priority === "critical"
                              ? "text-red-600"
                              : c.priority === "high"
                                ? "text-orange-600"
                                : c.priority === "medium"
                                  ? "text-yellow-600"
                                  : "text-gray-600"
                          }`}
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-muted-foreground">
                            {c.caseNumber}
                          </span>
                          <h3 className="font-semibold">{c.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comp?.name ?? `Company #${c.companyId}`} ·{" "}
                          {c.description?.slice(0, 60)}
                          {(c.description?.length ?? 0) > 60 ? "..." : ""}
                        </p>
                      </div>
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
                      <select
                        value={c.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateCase.mutate({
                            id: c.id,
                            status: e.target.value,
                          });
                        }}
                        className="text-xs border rounded-lg px-2 py-1"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Headphones className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No cases found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </HostLayout>
  );
}

function CaseDetail({
  serviceCase,
  companies,
  onBack,
}: {
  serviceCase: ServiceCase;
  companies: Company[];
  onBack: () => void;
}) {
  const { data: notes } = useQuery<ServiceCaseNote[]>({
    queryKey: ["/api/crm/host/cases", serviceCase.id, "notes"],
  });
  const [noteText, setNoteText] = useState("");
  const { toast } = useToast();

  const addNote = useMutation({
    mutationFn: async (note: string) => {
      const res = await apiRequest(
        "POST",
        `/api/crm/host/cases/${serviceCase.id}/notes`,
        { note },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/crm/host/cases", serviceCase.id, "notes"],
      });
      setNoteText("");
      toast({ title: "Note added" });
    },
  });

  const comp = companies.find((c) => c.id === serviceCase.companyId);

  return (
    <div className="space-y-6" data-testid="case-detail">
      <button
        onClick={onBack}
        className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
        data-testid="button-back-cases"
      >
        ← Back to cases
      </button>

      <div className="glass-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-sm font-mono text-muted-foreground">
              {serviceCase.caseNumber}
            </span>
            <h2 className="text-xl font-display font-bold">
              {serviceCase.title}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {comp?.name ?? `Company #${serviceCase.companyId}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                serviceCase.priority === "critical"
                  ? "bg-red-50 text-red-600"
                  : serviceCase.priority === "high"
                    ? "bg-orange-50 text-orange-600"
                    : serviceCase.priority === "medium"
                      ? "bg-yellow-50 text-yellow-600"
                      : "bg-gray-50 text-gray-600"
              }`}
            >
              {serviceCase.priority}
            </span>
            <span
              className={`text-xs px-3 py-1 rounded-full font-medium ${
                serviceCase.status === "open"
                  ? "bg-red-50 text-red-600"
                  : serviceCase.status === "in_progress"
                    ? "bg-yellow-50 text-yellow-600"
                    : serviceCase.status === "resolved"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-gray-50 text-gray-600"
              }`}
            >
              {serviceCase.status.replace("_", " ")}
            </span>
          </div>
        </div>
        {serviceCase.description && (
          <p className="text-sm text-foreground bg-muted/50 rounded-xl p-4">
            {serviceCase.description}
          </p>
        )}
      </div>

      <div className="glass-card rounded-2xl p-6 border border-border">
        <h3 className="font-display font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> Case Notes
        </h3>

        <div className="space-y-3 mb-6">
          {notes?.map((n) => (
            <div
              key={n.id}
              className="bg-muted/30 rounded-xl p-4"
              data-testid={`note-${n.id}`}
            >
              <p className="text-sm">{n.note}</p>
              <p className="text-xs text-muted-foreground mt-2">
                {n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}
              </p>
            </div>
          ))}
          {(!notes || notes.length === 0) && (
            <p className="text-sm text-muted-foreground">No notes yet</p>
          )}
        </div>

        <div className="flex gap-3">
          <input
            placeholder="Add a note..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && noteText.trim())
                addNote.mutate(noteText.trim());
            }}
            data-testid="input-case-note"
            className="flex-1 px-4 py-3 rounded-xl border text-sm"
          />
          <button
            onClick={() => {
              if (noteText.trim()) addNote.mutate(noteText.trim());
            }}
            disabled={addNote.isPending || !noteText.trim()}
            data-testid="button-add-note"
            className="px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-50"
          >
            {addNote.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Add Note"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
