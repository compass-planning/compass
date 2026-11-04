/**
 * AdvisorIntelligenceRail.tsx — Ambient light theme
 * Subtle, low-contrast, non-dominant right panel.
 */
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles, Calendar, AlertTriangle, TrendingUp, Shield,
  ChevronRight, Loader2, Brain, CheckCircle,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
interface AiRec { id?: number; title?: string; category?: string; content?: string; priority?: string; clientName?: string; }
interface Meeting { id?: number; title?: string; date?: string; platform?: string; clientName?: string; }

function useUpcomingMeetings() {
  return useQuery<Meeting[]>({
    queryKey: ["/api/crm/meetings/upcoming"],
    queryFn: async () => {
      const res = await fetch("/api/crm/meetings/upcoming?limit=3", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

function useRecentAiRecs() {
  return useQuery<AiRec[]>({
    queryKey: ["/api/crm/ai-recommendations/recent"],
    queryFn: async () => {
      const res = await fetch("/api/crm/ai-recommendations/recent?limit=4&status=pending", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.round((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7) return `In ${diffDays} days`;
  return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

const STATIC_INSIGHTS = [
  { title: "RRSP Contribution Window", body: "Review contribution room before March 1st deadline.", type: "tax", priority: "medium" },
  { title: "CPP Deferral Opportunity", body: "Clients approaching 65 — model CPP delay to age 70.", type: "opportunity", priority: "medium" },
  { title: "Coverage Gap Review", body: "Annual coverage review season. Flag clients with FNA gaps.", type: "insurance", priority: "low" },
];

const ICON_MAP: Record<string, typeof Brain> = {
  risk: AlertTriangle, opportunity: TrendingUp, insurance: Shield,
  tax: CheckCircle, default: Brain,
};

export function AdvisorIntelligenceRail() {
  const { data: meetings = [], isLoading: meetingsLoading } = useUpcomingMeetings();
  const { data: aiRecs = [], isLoading: recsLoading } = useRecentAiRecs();

  const insights = aiRecs.length > 0 ? aiRecs : STATIC_INSIGHTS;

  return (
    <aside className="w-[280px] flex-shrink-0 border-l border-slate-200/80 bg-white overflow-y-auto hidden xl:flex flex-col">
      <div className="p-4 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 font-semibold">Intelligence</p>
            <p className="text-sm font-semibold text-slate-900 mt-0.5 tracking-[-0.01em]">Active Context</p>
          </div>
          <Sparkles className="h-4 w-4 text-violet-500" />
        </div>

        {/* Planning insights */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2.5">Insights</p>
          <div className="space-y-1">
            {recsLoading ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 text-slate-300 animate-spin" /></div>
            ) : insights.slice(0, 4).map((rec: AiRec, i: number) => {
              const Icon = ICON_MAP[rec.type ?? rec.category ?? 'default'] ?? ICON_MAP.default;
              return (
                <div key={rec.id ?? i} className="rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors group cursor-default">
                  <div className="flex items-start gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-slate-800 leading-snug">{rec.title}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                        {rec.content ?? rec.body ?? rec.description ?? ""}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="border-t border-slate-100" />

        {/* Upcoming meetings */}
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold">Upcoming</p>
            <Calendar className="h-3.5 w-3.5 text-slate-300" />
          </div>
          <div className="space-y-1">
            {meetingsLoading ? (
              <div className="py-4 flex justify-center"><Loader2 className="w-4 h-4 text-slate-300 animate-spin" /></div>
            ) : meetings.length === 0 ? (
              <div className="rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors">
                <p className="text-[11px] text-slate-400">No upcoming meetings</p>
                <Link href="/calendar">
                  <span className="text-[10px] text-violet-500 hover:text-violet-700 flex items-center gap-1 mt-1 cursor-pointer">
                    Open calendar <ChevronRight className="w-3 h-3" />
                  </span>
                </Link>
              </div>
            ) : meetings.slice(0, 3).map((m: Meeting, i: number) => {
              const clientName = m.clientName ?? (m.client ? `${m.client.firstName} ${m.client.lastName}` : "Unknown");
              const date = m.date ? relativeDate(m.date) : "—";
              const isToday = date === "Today";
              return (
                <div key={m.id ?? i} className="rounded-xl px-3 py-2.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-slate-800 truncate">{clientName}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 truncate">{m.title ?? "Meeting"}</p>
                    </div>
                    <span className={cn("text-[10px] font-semibold flex-shrink-0 ml-2", isToday ? "text-red-500" : "text-slate-400")}>
                      {date}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <div className="border-t border-slate-100" />

        {/* Quick actions */}
        <section>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400 font-semibold mb-2.5">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "New Household", href: "/clients" },
              { label: "New Meeting",   href: "/calendar" },
              { label: "Tasks",         href: "/tasks" },
              { label: "Pipeline",      href: "/pipeline" },
            ].map(a => (
              <Link key={a.href} href={a.href}>
                <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200/60 px-2.5 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer transition-colors text-center">
                  {a.label}
                </div>
              </Link>
            ))}
          </div>
        </section>

      </div>
    </aside>
  );
}
