import { useState, useRef, useEffect, ReactNode } from "react";
import { Mic, MicOff, Circle, X, Copy, Check, ChevronDown, ChevronUp, Loader2, FileText, Lightbulb, ListChecks } from "lucide-react";
import { useVoice } from "../../contexts/VoiceContext";
import { cn } from "../../lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Module config — maps sidebar Tab values to display labels
// ─────────────────────────────────────────────────────────────────────────────

export const PLANNING_TABS = [
  "networth", "retirement", "pension", "insurance",
  "resp", "expenses", "goals", "tax", "estate", "ai",
] as const;

export type PlanningTab = typeof PLANNING_TABS[number];

const MODULE_LABELS: Record<PlanningTab, string> = {
  networth:   "Net Worth",
  retirement: "Retirement",
  pension:    "Pension",
  insurance:  "Insurance",
  resp:       "Education / RESP",
  expenses:   "Expenses",
  goals:      "Goals",
  tax:        "Tax Planning",
  estate:     "Estate",
  ai:         "AI Insights",
};

const VOICE_HINTS: Record<PlanningTab, string> = {
  networth:   "Say assets and liabilities e.g. "RRSP $220k, mortgage $410k"",
  retirement: "Say retirement goals e.g. "retire at 62, need $8,000 a month"",
  pension:    "Say pension details e.g. "DBPP, accrued 22 years at $2,800/month"",
  insurance:  "Say coverage e.g. "life insurance $500k, no disability coverage"",
  resp:       "Say RESP details e.g. "two kids, RESP balance $45k"",
  expenses:   "Say monthly expenses e.g. "rent $2,200, groceries $600, car $850"",
  goals:      "Describe goals e.g. "buy cottage in 5 years, budget $400k"",
  tax:        "Say province and income e.g. "Ontario, $185k salary, married"",
  estate:     "Say estate details e.g. "will in place, no POA, two beneficiaries"",
  ai:         "Ask for an analysis e.g. "what are the top planning gaps for this client?"",
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

// ─────────────────────────────────────────────────────────────────────────────
// PlanningDocFlow
// ─────────────────────────────────────────────────────────────────────────────

interface PlanningDocFlowProps {
  tab: PlanningTab;
  onTabChange: (t: PlanningTab) => void;
  clientId: number;
  clientName: string;
  children: ReactNode;
}

export function PlanningDocFlow({
  tab,
  onTabChange,
  clientId,
  clientName,
  children,
}: PlanningDocFlowProps) {
  const voice = useVoice();

  // ── Pill nav scroll ─────────────────────────────────────────────────────────
  const pillNavRef   = useRef<HTMLDivElement>(null);
  const activePillRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (activePillRef.current && pillNavRef.current) {
      const pill = activePillRef.current;
      const container = pillNavRef.current;
      const left = pill.offsetLeft;
      const right = left + pill.offsetWidth;
      const vLeft = container.scrollLeft;
      const vRight = vLeft + container.offsetWidth;
      if (left < vLeft + 12) container.scrollTo({ left: left - 12, behavior: "smooth" });
      else if (right > vRight - 12) container.scrollTo({ left: right - container.offsetWidth + 12, behavior: "smooth" });
    }
  }, [tab]);

  // ── Recording ───────────────────────────────────────────────────────────────
  const [recStatus, setRecStatus]     = useState<RecordingStatus>("idle");
  const [recDuration, setRecDuration] = useState(0);
  const [summary, setSummary]         = useState<MeetingSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const mediaRecRef   = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const transcriptRef = useRef("");

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
        r.onresult = (ev: SpeechRecognitionEvent) => {
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            if (ev.results[i].isFinal) transcriptRef.current += ev.results[i][0].transcript + " ";
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
          body: JSON.stringify({ audio: b64, transcript: transcriptRef.current, clientId, clientName }),
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
  // The FAB triggers the per-field voice mode in the currently active/focused field.
  // We don't have a "global active field" so the FAB shows a hint prompt instead.
  const [fabHintVisible, setFabHintVisible] = useState(false);
  const isVoiceListening  = voice.voiceState === "listening";
  const isVoiceProcessing = voice.voiceState === "processing";

  return (
    <div className="flex flex-col h-full bg-white relative">

      {/* ── Pill nav ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white">
        <div
          ref={pillNavRef}
          className="flex items-center gap-1 px-4 py-2 overflow-x-auto"
          style={{ scrollbarWidth: "none" }}
        >
          {PLANNING_TABS.map(t => (
            <button
              key={t}
              ref={t === tab ? activePillRef : undefined}
              onClick={() => onTabChange(t)}
              className={cn(
                "flex-shrink-0 rounded-full px-3.5 py-1 text-[12px] font-medium border transition-all duration-150 whitespace-nowrap",
                t === tab
                  ? "bg-[#0c1e3a] text-white border-[#0c1e3a]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700"
              )}
            >
              {MODULE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Module toolbar ───────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 sticky top-0 z-10 flex items-center justify-between px-5 py-2 bg-white border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-900">{MODULE_LABELS[tab]}</span>

        <div className="flex items-center gap-2">
          {/* Recording status chip */}
          {recStatus === "recording" && (
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 text-[11px] font-medium rounded-full px-2.5 py-1">
              <Circle className="w-2 h-2 fill-red-500 text-red-500 animate-pulse" />
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

          {/* Record button */}
          <button
            onClick={recStatus === "recording" ? stopRec : recStatus === "idle" || recStatus === "done" ? startRec : undefined}
            disabled={recStatus === "processing"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-medium border transition-all",
              recStatus === "recording"
                ? "bg-red-600 border-red-600 text-white hover:bg-red-700"
                : recStatus === "processing"
                ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}
          >
            <Circle className={cn("w-2.5 h-2.5", recStatus === "recording" ? "fill-white text-white" : "fill-red-500 text-red-500")} />
            {recStatus === "recording" ? "Stop" : "Record"}
          </button>
        </div>
      </div>

      {/* ── Module content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>

      {/* ── Voice FAB ────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
        {/* Hint bubble */}
        {fabHintVisible && !isVoiceListening && !isVoiceProcessing && (
          <div className="bg-[#0c1e3a] text-white text-xs rounded-xl px-3.5 py-2.5 max-w-[220px] text-right leading-snug shadow-md">
            {VOICE_HINTS[tab]}
            <div className="text-[10px] opacity-60 mt-1">Click a field's mic button to dictate</div>
          </div>
        )}
        {isVoiceListening && (
          <div className="bg-blue-600 text-white text-xs rounded-xl px-3 py-2 max-w-[200px] text-right leading-snug">
            Listening…
          </div>
        )}
        {/* Ripple */}
        {isVoiceListening && (
          <div className="absolute bottom-0 right-0 w-14 h-14 rounded-full bg-blue-500/20 animate-ping pointer-events-none" />
        )}
        <button
          onMouseEnter={() => setFabHintVisible(true)}
          onMouseLeave={() => setFabHintVisible(false)}
          className={cn(
            "relative w-14 h-14 rounded-full flex items-center justify-center shadow-md transition-all duration-200 focus:outline-none",
            isVoiceListening
              ? "bg-blue-600 scale-110"
              : isVoiceProcessing
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-[#0c1e3a] hover:bg-[#1a3160] hover:scale-105 active:scale-95"
          )}
          title="Voice fill — hover for tip"
          aria-label="Voice fill"
        >
          {isVoiceProcessing
            ? <Loader2 className="w-5 h-5 text-white animate-spin" />
            : isVoiceListening
            ? <MicOff className="w-5 h-5 text-white" />
            : <Mic className="w-5 h-5 text-white" />
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
    </div>
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
  const [copied, setCopied]           = useState(false);
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
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/20" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 flex flex-col border-l border-gray-200 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Meeting Summary</h3>
            <p className="text-xs text-gray-400 mt-0.5">{dateStr} · {durStr}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onReset} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 border border-gray-200 rounded-md transition-colors">
              New recording
            </button>
            <button onClick={onClose} className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* AI Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                <Lightbulb className="w-3 h-3" /> Summary
              </div>
              <button onClick={copy} className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="text-sm text-gray-700 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-3 whitespace-pre-wrap">
              {summary.summary || "No summary generated."}
            </div>
          </div>

          {/* Action items */}
          {summary.actionItems.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                <ListChecks className="w-3 h-3" /> Action Items
              </div>
              <ul className="space-y-2">
                {summary.actionItems.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#0c1e3a] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Transcript */}
          <div>
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="flex items-center justify-between w-full text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2"
            >
              <span className="flex items-center gap-1.5"><FileText className="w-3 h-3" /> Full Transcript</span>
              {showTranscript ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {showTranscript && (
              <div className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-3 max-h-56 overflow-y-auto font-mono whitespace-pre-wrap">
                {summary.transcript || "No transcript available."}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
