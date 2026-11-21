import { useState } from "react";
import { LifeBuoy, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

/** "Report a problem" — sends the issue to the Westoak support queue (shown in the corporate Client Issues page). */
export function ReportProblem({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  const send = async () => {
    setState("sending"); setErr("");
    try {
      const r = await apiRequest("POST", "/api/support/report", { subject, body, page: window.location.pathname });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).message || "Could not send");
      setState("sent"); setSubject(""); setBody("");
    } catch (e: any) { setErr(e?.message || "Could not send"); setState("error"); }
  };
  const close = () => { setOpen(false); setState("idle"); };

  return (
    <>
      <button onClick={() => setOpen(true)} data-testid="button-report-problem" title="Report a problem" className={className || "flex items-center gap-2 text-xs font-medium text-primary-foreground/70 hover:text-white px-3 py-2 rounded-xl hover:bg-white/10 w-full"}>
        <LifeBuoy className="w-3.5 h-3.5" />{!compact && <span>Report a problem</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" data-testid="modal-report-problem">
          <div className="bg-white text-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Report a problem</h2>
              <button onClick={close} aria-label="Close"><X className="w-4 h-4" /></button>
            </div>
            {state === "sent" ? (
              <div className="space-y-4"><p className="text-sm" data-testid="text-report-sent">Thanks — your report was sent to our support team.</p>
                <button onClick={close} className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold">Close</button></div>
            ) : (
              <div className="space-y-3">
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="What went wrong? (short summary)" data-testid="input-report-subject" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Tell us what you were doing and what happened" data-testid="input-report-body" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                {state === "error" && <p className="text-xs text-red-600" data-testid="text-report-error">{err}</p>}
                <div className="flex justify-end gap-2">
                  <button onClick={close} className="px-4 py-2 rounded-lg text-sm border border-slate-300">Cancel</button>
                  <button onClick={send} disabled={subject.trim().length < 3 || body.trim().length < 5 || state === "sending"} data-testid="button-send-report" className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold disabled:opacity-50">{state === "sending" ? "Sending…" : "Send"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
