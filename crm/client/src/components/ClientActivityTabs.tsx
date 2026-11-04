/**
 * client/src/components/ClientActivityTabs.tsx
 *
 * Activity workspace for a client, with three sub-tabs:
 *   - Record Meeting  (live recorder + AI summary)
 *   - Log Activity    (manual activity log + tasks)
 *   - Past Meetings    (previously recorded/summarised meetings)
 *
 * Leaf component — imports only other components/hooks, never a page.
 */
import { useState } from "react";
import { Mic, ClipboardList, CalendarClock } from "lucide-react";
import { MeetingRecorderTrigger } from "@/components/MeetingRecorder";
import { ActivityTab as ClientActivityLog, ClientTasksSection } from "@/components/ClientActivityPanel";
import { useClientMeetings } from "@/hooks/use-meetings";

type SubTab = "record" | "log" | "meetings";

const subTabs: { key: SubTab; label: string; icon: typeof Mic }[] = [
  { key: "record",   label: "Record Meeting", icon: Mic },
  { key: "log",      label: "Log Activity",   icon: ClipboardList },
  { key: "meetings", label: "Past Meetings",  icon: CalendarClock },
];

export function ClientActivityTabs({ clientId, clientName }: { clientId: number; clientName: string }) {
  const [sub, setSub] = useState<SubTab>("record");

  return (
    <div className="space-y-6">
      {/* Sub-tab bar */}
      <div className="flex items-center gap-1 border-b border-border">
        {subTabs.map(t => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              sub === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {sub === "record" && (
        <RecordMeetingPanel clientId={clientId} clientName={clientName} />
      )}

      {sub === "log" && (
        <div className="space-y-8">
          <div>
            <h3 className="text-base font-semibold mb-3">Tasks &amp; Pipeline</h3>
            <ClientTasksSection clientId={clientId} />
          </div>
          <ClientActivityLog clientId={clientId} />
        </div>
      )}

      {sub === "meetings" && (
        <PastMeetingsPanel clientId={clientId} />
      )}
    </div>
  );
}

export function RecordMeetingPanel({ clientId, clientName }: { clientId: number; clientName: string }) {
  return (
    <div className="border border-dashed border-border rounded-2xl p-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center mx-auto mb-4">
        <Mic className="w-7 h-7 text-secondary" />
      </div>
      <h3 className="text-lg font-semibold mb-1">Record a meeting</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
        Capture the conversation and get an AI summary with key figures, goals, and action items
        automatically extracted{clientName ? ` for ${clientName}` : ""}.
      </p>
      <div className="inline-flex">
        <MeetingRecorderTrigger clientId={clientId} clientName={clientName || "Client"} />
      </div>
    </div>
  );
}

export function LogActivityPanel({ clientId }: { clientId: number }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-base font-semibold mb-3">Tasks &amp; Pipeline</h3>
        <ClientTasksSection clientId={clientId} />
      </div>
      <ClientActivityLog clientId={clientId} />
    </div>
  );
}

export function PastMeetingsPanel({ clientId }: { clientId: number }) {
  const { data: meetings, isLoading } = useClientMeetings(clientId);
  const list = (meetings as any[] | undefined) ?? [];

  if (isLoading) return <div className="animate-pulse h-32 bg-muted/40 rounded-2xl" />;

  if (list.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <CalendarClock className="w-10 h-10 text-slate-300 mb-3" />
      <p className="text-sm font-semibold text-slate-700">No past meetings</p>
      <p className="text-xs text-slate-400 mt-1">Recorded meetings and their summaries will appear here</p>
    </div>
  );

  const sorted = [...list].sort((a, b) =>
    new Date(b.date ?? b.createdAt ?? 0).getTime() - new Date(a.date ?? a.createdAt ?? 0).getTime()
  );

  return (
    <div className="space-y-3">
      {sorted.map((m: any) => (
        <div key={m.id} className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-slate-900">{m.title || "Meeting"}</p>
            {(m.date || m.createdAt) && (
              <span className="text-xs text-slate-400">
                {new Date(m.date ?? m.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          {(m.summary || m.rawSummary) && (
            <p className="text-sm text-slate-600 whitespace-pre-line">{m.summary ?? m.rawSummary}</p>
          )}
          {!m.summary && !m.rawSummary && m.transcript && (
            <p className="text-sm text-slate-500 line-clamp-3">{m.transcript}</p>
          )}
        </div>
      ))}
    </div>
  );
}
