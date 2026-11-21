import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HostLayout } from "@/components/HostLayout";
import { AppBadge, AppToggle, ago, type AppName } from "@/components/host/hostBits";

interface Issue { app: AppName; id: number; ref: string; title: string; description: string | null; status: string; priority: string; from: string; createdAt: string; resolvedAt: string | null; notes: string | null }
const PRI: Record<string, string> = { low: "bg-slate-100 text-slate-600", normal: "bg-blue-50 text-blue-700", high: "bg-orange-50 text-orange-700", urgent: "bg-red-50 text-red-700" };
const inp = "border border-border rounded-lg px-2 py-1.5 bg-background text-sm";

export default function Issues() {
  const [app, setApp] = useState<"all" | AppName>("all");
  const [status, setStatus] = useState("active");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const key = `/api/crm/host/issues?app=${app}${status === "all" || status === "active" ? "" : `&status=${status}`}`;
  const { data } = useQuery<{ open: number; issues: Issue[] }>({ queryKey: [key], refetchInterval: 30000 });
  const patch = useMutation({
    mutationFn: async (v: { app: AppName; id: number; status?: string; priority?: string; note?: string }) => {
      const { app: a, id, ...rest } = v; return (await apiRequest("PATCH", `/api/crm/host/issues/${a}/${id}`, rest)).json();
    },
    onSuccess: () => { setNote(""); queryClient.invalidateQueries({ queryKey: [key] }); },
  });
  const rows = (data?.issues ?? []).filter((i) => status !== "active" || i.status === "open" || i.status === "in_progress");

  return (
    <HostLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display font-bold" data-testid="text-issues-title">Client Issues</h1>
            <p className="text-muted-foreground mt-1">Problems reported by users inside Compass Planning and Compass CRM · <span data-testid="text-open-count">{data?.open ?? 0} open</span></p>
          </div>
          <div className="flex gap-2">
            <AppToggle value={app} onChange={setApp} />
            <select value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-issue-status" className={inp}>
              <option value="active">Open &amp; in progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option><option value="all">Everything</option>
            </select>
          </div>
        </div>
        <div className="glass-card rounded-2xl border border-border divide-y divide-border" data-testid="list-issues">
          {rows.length === 0 && <p className="p-6 text-sm text-muted-foreground" data-testid="text-no-issues">No issues here.</p>}
          {rows.map((i) => {
            const k = `${i.app}-${i.id}`;
            return (
              <div key={k} className="p-4" data-testid={`row-issue-${k}`}>
                <div className="flex items-center gap-3 flex-wrap">
                  <AppBadge app={i.app} /><span className="font-mono text-xs text-muted-foreground">{i.ref}</span>
                  <button onClick={() => setOpen(open === k ? null : k)} className="font-medium text-left flex-1 min-w-[200px]" data-testid={`button-toggle-${k}`}>{i.title}</button>
                  <span className="text-xs text-muted-foreground">{i.from} · {ago(i.createdAt)}</span>
                  <select value={i.priority} onChange={(e) => patch.mutate({ app: i.app, id: i.id, priority: e.target.value })} data-testid={`select-priority-${k}`} className={`text-xs rounded-lg px-2 py-1 ${PRI[i.priority]}`}>
                    <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                  </select>
                  <select value={i.status} onChange={(e) => patch.mutate({ app: i.app, id: i.id, status: e.target.value })} data-testid={`select-status-${k}`} className={inp}>
                    <option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option><option value="closed">Closed</option>
                  </select>
                </div>
                {open === k && (
                  <div className="mt-3 space-y-3 text-sm">
                    <pre className="whitespace-pre-wrap font-sans bg-muted/40 rounded-xl p-3" data-testid={`text-desc-${k}`}>{i.description}</pre>
                    {i.notes && <pre className="whitespace-pre-wrap font-sans text-xs text-muted-foreground border-l-2 border-border pl-3" data-testid={`text-notes-${k}`}>{i.notes}</pre>}
                    <div className="flex gap-2">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note" data-testid={`input-note-${k}`} className={`${inp} flex-1`} />
                      <button onClick={() => patch.mutate({ app: i.app, id: i.id, note })} disabled={!note} data-testid={`button-note-${k}`} className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">Add note</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </HostLayout>
  );
}
