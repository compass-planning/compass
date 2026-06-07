import { useState } from "react";
import { Mic, MicOff, Square, X, Download, Copy, Check, Loader2, FileText, Target, ListChecks, LayoutGrid } from "lucide-react";
import { cn } from "../lib/utils";
import { useMeetingRecorder, type MeetingSummary } from "../hooks/useMeetingRecorder";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function fmtDuration(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pill trigger button — placed in the App header bar
// ─────────────────────────────────────────────────────────────────────────────
interface MeetingRecorderTriggerProps {
  clientId: number;
  clientName: string;
}

export function MeetingRecorderTrigger({ clientId, clientName }: MeetingRecorderTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Record meeting"
        className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-[#0c1e3a] border border-gray-200 hover:border-gray-300 px-2.5 py-1 rounded-lg transition-colors"
      >
        <Mic className="w-3.5 h-3.5" />
        Record
      </button>

      {open && (
        <MeetingRecorderModal
          clientId={clientId}
          clientName={clientName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────────────────────
interface ModalProps {
  clientId: number;
  clientName: string;
  onClose: () => void;
}

function MeetingRecorderModal({ clientId, clientName, onClose }: ModalProps) {
  const { state, transcript, summary, error, duration, startRecording, stopRecording, reset } =
  useMeetingRecorder(clientId);

  const [copied, setCopied] = useState(false);

  function handleClose() {
    if (state === "recording") {
      if (!confirm("Recording in progress. Stop and discard?")) return;
      stopRecording();       // will process, but we close anyway
    }
    reset();
    onClose();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTranscript() {
    const blob = new Blob([transcript], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `meeting-${clientName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-2xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center",
              state === "recording" ? "bg-red-100" : "bg-[#0c1e3a]/10"
            )}>
              <Mic className={cn("w-4 h-4", state === "recording" ? "text-red-500" : "text-[#0c1e3a]")} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Meeting Recorder</h2>
              <p className="text-xs text-gray-400">{clientName}</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-gray-300 hover:text-gray-600 transition-colors p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Idle state */}
          {state === "idle" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-16 h-16 bg-[#0c1e3a]/5 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-7 h-7 text-[#0c1e3a]" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Ready to record</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                {"Hit record to start capturing the meeting. The AI will transcribe in real time and generate a financial planning summary when you're done."}
              </p>
              <button
                onClick={startRecording}
                className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            </div>
          )}

          {/* Recording state */}
          {state === "recording" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-red-600">Recording</span>
                  <span className="text-sm text-gray-400 tabular-nums">{fmtDuration(duration)}</span>
                </div>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-white" /> Stop & Summarise
                </button>
              </div>

              {/* Live transcript */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 min-h-[180px] max-h-[280px] overflow-y-auto">
                {transcript ? (
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                ) : (
                  <p className="text-sm text-gray-300 italic">Listening — speak to see transcript appear here…</p>
                )}
              </div>
            </>
          )}

          {/* Processing */}
          {state === "processing" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-[#0c1e3a] animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-700">Generating AI summary…</p>
              <p className="text-xs text-gray-400 mt-1">Extracting figures, goals and action items</p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <MicOff className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-600 mb-1">Something went wrong</p>
              <p className="text-xs text-gray-400 mb-5">{error}</p>
              <button onClick={reset} className="text-sm font-semibold text-[#0c1e3a] hover:underline">Try again</button>
            </div>
          )}

          {/* Done — show summary */}
          {state === "done" && summary && (
            <SummaryView
              summary={summary}
              transcript={transcript}
              copied={copied}
              onCopy={copyText}
              onDownload={downloadTranscript}
              onReset={reset}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary View
// ─────────────────────────────────────────────────────────────────────────────
interface SummaryViewProps {
  summary: MeetingSummary;
  transcript: string;
  copied: boolean;
  onCopy: (t: string) => void;
  onDownload: () => void;
  onReset: () => void;
}

function SummaryView({ summary, transcript, copied, onCopy, onDownload, onReset }: SummaryViewProps) {
  const [showTranscript, setShowTranscript] = useState(false);

  const fullText = [
    "MEETING SUMMARY",
    "═══════════════",
    "",
    "KEY FIGURES",
    summary.keyFigures.map(f => `• ${f.label}: ${f.value}`).join("\n"),
    "",
    "CLIENT GOALS",
    summary.goals.map(g => `• ${g}`).join("\n"),
    "",
    "ACTION ITEMS",
    summary.actionItems.map(a => `• ${a}`).join("\n"),
    "",
    "RECOMMENDED PLANNING AREAS",
    summary.recommendedAreas.map(r => `• ${r}`).join("\n"),
    "",
    "─────────────",
    "FULL TRANSCRIPT",
    transcript,
  ].join("\n");

  return (
    <div className="space-y-4">
      {/* Key Figures */}
      {summary.keyFigures.length > 0 && (
        <Section icon={<LayoutGrid className="w-3.5 h-3.5" />} title="Key Figures" color="blue">
          <div className="grid grid-cols-2 gap-2 mt-2">
            {summary.keyFigures.map((f, i) => (
              <div key={i} className="bg-blue-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-blue-400 uppercase tracking-wide font-semibold">{f.label}</p>
                <p className="text-sm font-bold text-blue-900">{f.value}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Goals */}
      {summary.goals.length > 0 && (
        <Section icon={<Target className="w-3.5 h-3.5" />} title="Client Goals" color="emerald">
          <ul className="mt-2 space-y-1">
            {summary.goals.map((g, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-emerald-500 mt-0.5 flex-shrink-0">•</span>{g}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Action Items */}
      {summary.actionItems.length > 0 && (
        <Section icon={<ListChecks className="w-3.5 h-3.5" />} title="Action Items" color="amber">
          <ul className="mt-2 space-y-1">
            {summary.actionItems.map((a, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">□</span>{a}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Recommended Areas */}
      {summary.recommendedAreas.length > 0 && (
        <Section icon={<FileText className="w-3.5 h-3.5" />} title="Recommended Planning Areas" color="purple">
          <div className="flex flex-wrap gap-1.5 mt-2">
            {summary.recommendedAreas.map((r, i) => (
              <span key={i} className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                {r}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Transcript toggle */}
      <button
        onClick={() => setShowTranscript(!showTranscript)}
        className="text-xs text-gray-400 hover:text-gray-600 font-medium underline underline-offset-2"
      >
        {showTranscript ? "Hide" : "Show"} full transcript
      </button>

      {showTranscript && (
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 max-h-52 overflow-y-auto">
          <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{transcript}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1 border-t border-gray-100">
        <button
          onClick={() => onCopy(fullText)}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={onDownload}
          className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </button>
        <button
          onClick={onReset}
          className="ml-auto flex items-center gap-1.5 text-sm text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-3 py-1.5 rounded-lg transition-colors"
        >
          <Mic className="w-3.5 h-3.5" /> New Recording
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny section wrapper
// ─────────────────────────────────────────────────────────────────────────────
const colorMap: Record<string, string> = {
  blue:    "text-blue-600 bg-blue-50 border-blue-100",
  emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
  amber:   "text-amber-600 bg-amber-50 border-amber-100",
  purple:  "text-purple-600 bg-purple-50 border-purple-100",
};

function Section({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-4", colorMap[color])}>
      <div className="flex items-center gap-1.5">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}
