import type { ReactNode} from "react";
import { useState, useRef, useEffect, createContext, useContext } from "react";
import {
  Mic, MicOff, Circle, X, Copy, Check, ChevronDown, ChevronUp,
  Loader2, FileText, Lightbulb, ListChecks,
  Wallet, Target, GraduationCap, Receipt, Sparkles,
  TrendingUp, TrendingDown, CreditCard,
  type LucideIcon,
} from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";
import { translations, type T } from "../../i18n/translations";
import { cn } from "../../lib/utils";
import { api } from "../../lib/api";
import { HubShell } from "../insightled";

interface ClientOverview {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
}

interface ClientInfo {
  id: number;
  firstName: string;
  lastName: string;
  spouseFirstName?: string | null;
  province?: string | null;
  annualIncome?: string | null;
}

// ── Net Worth sub-tab context (consumed by NetWorthTab in MultiEntryTabs) ─────
export const NWSubtabCtx = createContext<{ sub: string; setSub: (s: string) => void }>(
  { sub: "assets", setSub: () => {} }
);

// ─────────────────────────────────────────────────────────────────────────────
// Module config — maps sidebar Tab values to display labels + icons
// ─────────────────────────────────────────────────────────────────────────────

// Tabs that still render through PlanningDocFlow (the simple themed ones).
// Merged hubs (protection, retirementhub, taxestate, documents, fp) provide
// their own dark Insight-Led shell and route outside this wrapper.
export const PLANNING_TABS = [
  "networth", "goals", "expenses", "debt", "ai",
] as const;

export type PlanningTab = typeof PLANNING_TABS[number];

function makeTabMeta(t: T): Record<PlanningTab, { icon: LucideIcon; title: string; tagline: string }> {
  return {
    networth: { icon: Wallet,    title: t.netWorth.title,  tagline: t.netWorth.totalNetWorth },
    goals:    { icon: Target,    title: t.goals.title,     tagline: t.goals.planAndPrioritize },
    expenses: { icon: Receipt,   title: t.cashFlow.title,  tagline: t.cashFlow.monthlyVsExpenses },
    debt:     { icon: CreditCard, title: t.debt.title,     tagline: t.debt.debtCashFlow },
    ai:       { icon: Sparkles,  title: t.ai.title,        tagline: t.ai.subtitle },
  };
}

const VOICE_HINTS: Record<PlanningTab, string> = {
  networth: "Say assets and liabilities, e.g. RRSP $220k, mortgage $410k",
  goals:    "Describe goals, e.g. buy cottage in 5 years, budget $400k",
  expenses: "Say monthly expenses, e.g. rent $2,200, groceries $600, car $850",
  debt:     "Describe debts, e.g. mortgage $480k at 5.2%, car loan $22k at 6.9%",
  ai:       "Ask for an analysis, e.g. what are the top planning gaps for this client?",
};

// ─────────────────────────────────────────────────────────────────────────────
// Summary types
// ─────────────────────────────────────────────────────────────────────────────

interface MeetingSummary {
  transcript: string;
  summary: string;
  actionItems: string[];
  recordedAt: Date;
  durationSeconds: number;
}

type RecordingStatus = "idle" | "recording" | "processing" | "done";

function fmtDuration(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

const fmt$ = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(v);

// ─────────────────────────────────────────────────────────────────────────────
// PlanningDocFlow
// ─────────────────────────────────────────────────────────────────────────────

interface PlanningDocFlowProps {
  tab: PlanningTab;
  /** Kept for API compatibility — sidebar drives navigation now. */
  onTabChange?: (t: PlanningTab) => void;
  clientId: number;
  clientName: string;
  client?: ClientInfo;
  /** Optional initial sub-tab for Net Worth (e.g. deep-link to "education"). */
  initialNwSubtab?: string;
  /** Optional Primary | Spouse | Combined toggle (used by Goals). */
  personToggle?: {
    person: "primary" | "spouse" | "combined";
    onPersonChange: (p: "primary" | "spouse" | "combined") => void;
    primaryLabel: string;
    spouseLabel?: string | null;
    showCombined?: boolean;
  };
  tr?: T;
  children: ReactNode;
}

export function PlanningDocFlow({
  tab,
  clientId,
  client,
  personToggle,
  initialNwSubtab,
  tr = translations.en,
  children,
}: PlanningDocFlowProps) {
  const voice = useVoice();
  const meta  = makeTabMeta(tr)[tab];

  // ── Client overview (used in subtitle + NW sub-tab badges) ──────────────────
  const [overview, setOverview] = useState<ClientOverview | null>(null);
  useEffect(() => {
    api.get<ClientOverview>(`/api/clients/${clientId}/overview`)
      .then(setOverview)
      .catch(() => {});
  }, [clientId]);

  // ── Net Worth sub-tab state (hoisted here so HubShell owns the strip) ───────
  const [nwSubtab, setNwSubtab] = useState(initialNwSubtab ?? "assets");
  useEffect(() => { setNwSubtab(initialNwSubtab ?? "assets"); }, [clientId, tab, initialNwSubtab]);

  // ── Recording ───────────────────────────────────────────────────────────────
  const [recStatus, setRecStatus]     = useState<RecordingStatus>("idle");
  const [recDuration, setRecDuration] = useState(0);
  const [summary, setSummary]         = useState<MeetingSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<any>(null);
  const transcriptRef  = useRef("");

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRecRef.current = rec;
      chunksRef.current = [];
      transcriptRef.current = "";

      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };

      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        recognitionRef.current = r;
        r.continuous = true;
        r.interimResults = false;
        r.lang = "en-CA";
        r.onresult = (ev: Event) => {
          const e = ev as any;
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) transcriptRef.current += e.results[i][0].transcript + " ";
        }
        };
        r.start();
      }

      rec.start(1000);
      setRecStatus("recording");
      setRecDuration(0);
      timerRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    } catch (err) {
      console.error("[PlanningDocFlow] startRec:", err);
    }
  }

  function stopRec() {
    if (!mediaRecRef.current) return;
    mediaRecRef.current.onstop = async () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
      setRecStatus("processing");
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const b64  = await new Promise<string>((res, rej) => {
        const fr = new FileReader();
        fr.onloadend = () => res((fr.result as string).split(",")[1]);
        fr.onerror   = rej;
        fr.readAsDataURL(blob);
      });
      try {
        const resp = await fetch("/api/ai/meeting-summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: b64, transcript: transcriptRef.current, clientId, clientName: client ? `${client.firstName} ${client.lastName}` : "" }),
        });
        const data = await resp.json();
        setSummary({
          transcript:      transcriptRef.current || data.transcript || "",
          summary:         data.summary ?? "",
          actionItems:     data.actionItems ?? [],
          recordedAt:      new Date(),
          durationSeconds: recDuration,
        });
        setRecStatus("done");
        setSummaryOpen(true);
      } catch (err) {
        console.error("[PlanningDocFlow] summary:", err);
        setRecStatus("idle");
      }
    };
    mediaRecRef.current.stop();
    mediaRecRef.current.stream.getTracks().forEach(t => t.stop());
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  // ── Voice FAB ───────────────────────────────────────────────────────────────
  const [fabHintVisible, setFabHintVisible] = useState(false);
  const isVoiceListening  = voice.voiceState === "listening";
  const isVoiceProcessing = voice.voiceState === "processing";

  // ── Subtitle ────────────────────────────────────────────────────────────────
  const subtitle: ReactNode = tab === "networth" && overview ? (
    <>
      <span>
        Net worth&nbsp;
        <span className={overview.netWorth >= 0 ? "text-emerald-400 font-semibold" : "text-red-400 font-semibold"}>
          {fmt$(overview.netWorth)}
        </span>
      </span>
      <span>•</span>
      <span>Assets&nbsp;<span className="text-[var(--accent-cyan)] font-semibold">{fmt$(overview.totalAssets)}</span></span>
      <span>•</span>
      <span>Liabilities&nbsp;<span className="text-red-400 font-semibold">{fmt$(overview.totalLiabilities)}</span></span>
    </>
  ) : (
    <span>{meta.tagline}</span>
  );

  // ── Header actions: recording chip + Record button ─────────────────────────
  const actions = (
    <div className="flex items-center gap-2">
      {recStatus === "recording" && (
        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-mono font-medium rounded-full px-2.5 py-1">
          <Circle className="w-2 h-2 fill-rose-500 text-rose-500 animate-pulse" />
          {fmtDuration(recDuration)}
        </div>
      )}
      {recStatus === "processing" && (
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-medium rounded-full px-2.5 py-1">
          <Loader2 className="w-3 h-3 animate-spin" /> Processing…
        </div>
      )}
      {recStatus === "done" && (
        <button
          onClick={() => setSummaryOpen(true)}
          className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-medium rounded-full px-2.5 py-1 hover:bg-emerald-100 transition-colors"
        >
          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
          View summary
        </button>
      )}
      <button
        onClick={recStatus === "recording" ? stopRec : recStatus === "idle" || recStatus === "done" ? startRec : undefined}
        disabled={recStatus === "processing"}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium border transition-all",
          recStatus === "recording"
            ? "bg-rose-500 border-rose-500 text-white hover:bg-rose-600"
            : recStatus === "processing"
            ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
            : "bg-white border-slate-200 text-slate-700 hover:border-cyan-400 hover:text-cyan-700"
        )}
      >
        <Circle className={cn("w-2.5 h-2.5", recStatus === "recording" ? "fill-white text-white" : "fill-rose-500 text-rose-500")} />
        {recStatus === "recording" ? "Stop" : "Record"}
      </button>
    </div>
  );

  return (
    <>
      <NWSubtabCtx.Provider value={{ sub: nwSubtab, setSub: setNwSubtab }}>
      <HubShell
        icon={meta.icon}
        title={meta.title}
        subtitle={subtitle}
        actions={actions}
        personToggle={personToggle}
        contentClassName={tab === "networth" ? "overflow-hidden flex flex-col" : undefined}
        subtabs={tab === "networth" ? [
          { key: "assets",      label: tr.netWorth.assetsTab,      icon: TrendingUp,      badge: overview ? fmt$(overview.totalAssets)      : undefined, badgeTone: "green" },
          { key: "liabilities", label: tr.netWorth.liabilitiesTab, icon: TrendingDown,    badge: overview ? fmt$(overview.totalLiabilities) : undefined, badgeTone: "rose"  },
          { key: "education",   label: tr.netWorth.educationTab,   icon: GraduationCap,   badgeTone: "cyan" },
        ] : undefined}
        activeSubtab={tab === "networth" ? nwSubtab : undefined}
        onSubtabChange={tab === "networth" ? setNwSubtab : undefined}
      >
      {tab === "networth" ? children : (
  <div className="p-6">
    {children}
  </div>
)}
      </HubShell>
      </NWSubtabCtx.Provider>

      {/* ── Voice FAB ────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {fabHintVisible && !isVoiceListening && !isVoiceProcessing && (
          <div className="bg-white border border-slate-200/80 text-slate-700 text-xs rounded-xl px-3.5 py-2.5 max-w-[220px] text-right leading-snug shadow-lg">
            {VOICE_HINTS[tab]}
            <div className="text-[10px] text-slate-400 mt-1">Click a field's mic button to dictate</div>
          </div>
        )}
        {isVoiceListening && (
          <div className="bg-cyan-50 border border-cyan-300 text-cyan-700 text-xs font-semibold rounded-xl px-3 py-2 max-w-[200px] text-right leading-snug">
            Listening…
          </div>
        )}
        {isVoiceListening && (
          <div className="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-cyan-500/30 animate-ping pointer-events-none" />
        )}
        <button
          onMouseEnter={() => setFabHintVisible(true)}
          onMouseLeave={() => setFabHintVisible(false)}
          className={cn(
            "relative w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 focus:outline-none border",
            isVoiceListening
              ? "bg-gradient-to-br from-blue-600 to-cyan-500 border-cyan-500 scale-110"
              : isVoiceProcessing
              ? "bg-slate-100 border-slate-200 cursor-not-allowed"
              : "bg-white border-slate-200 hover:border-cyan-400 hover:scale-105 active:scale-95"
          )}
          title="Voice fill — hover for tip"
          aria-label="Voice fill"
        >
          {isVoiceProcessing
            ? <Loader2 className="w-5 h-5 text-slate-500 animate-spin" />
            : isVoiceListening
            ? <MicOff className="w-5 h-5 text-white" />
            : <Mic className="w-5 h-5 text-cyan-600" />
          }
        </button>
      </div>

      {/* ── Meeting summary drawer ───────────────────────────────────────────── */}
      {summaryOpen && summary && (
        <MeetingSummaryDrawer
          summary={summary}
          onClose={() => setSummaryOpen(false)}
          onReset={() => { setSummaryOpen(false); setSummary(null); setRecStatus("idle"); }}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MeetingSummaryDrawer
// ─────────────────────────────────────────────────────────────────────────────

function MeetingSummaryDrawer({
  summary,
  onClose,
  onReset,
}: {
  summary: MeetingSummary;
  onClose: () => void;
  onReset: () => void;
}) {
  const [copied, setCopied]                 = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  function copy() {
    navigator.clipboard.writeText(summary.summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const dateStr = summary.recordedAt.toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
  const dur = summary.durationSeconds;
  const durStr = dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />

      <div className="fp-insightled fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col border-l border-slate-200/80 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/80">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Meeting Summary</h3>
            <p className="text-xs text-slate-400 mt-0.5">{dateStr} · {durStr}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onReset} className="text-xs text-slate-500 hover:text-cyan-700 px-2 py-1 border border-slate-200 rounded-md transition-colors">
              New recording
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-24 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">
                <Lightbulb className="w-3 h-3" /> Summary
              </div>
              <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-700 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 whitespace-pre-wrap">
              {summary.summary || "No summary generated."}
            </div>
          </div>

          {summary.actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2">
                <ListChecks className="w-3 h-3" /> Action Items
              </div>
              <ul className="space-y-2">
                {summary.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-cyan-500 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="flex items-center justify-between w-full text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-2 hover:text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> Full Transcript</span>
              {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showTranscript && (
              <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-3 max-h-56 overflow-y-auto font-mono whitespace-pre-wrap">
                {summary.transcript || "No transcript available."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
