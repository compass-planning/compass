import { useState, useRef } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { Mic, MicOff, Square, X, Download, Copy, Check, Loader2, FileText, Target, ListChecks, LayoutGrid, ShieldCheck, Mail, MessageSquare, PenLine } from "lucide-react";
import { cn } from "../lib/utils";
import { useMeetingRecorder, type MeetingSummary } from "../hooks/useMeetingRecorder";

// ─────────────────────────────────────────────────────────────────────────────
// Consent types
// ─────────────────────────────────────────────────────────────────────────────
type ConsentType = "written" | "oral" | "email";

const CONSENT_OPTIONS: { type: ConsentType; label: string; description: string; icon: ReactNode }[] = [
  {
    type: "written",
    label: "Written Consent",
    description: "Client signed a written consent form prior to this meeting.",
    icon: <PenLine className="w-5 h-5" />,
  },
  {
    type: "oral",
    label: "Oral Consent",
    description: "Client verbally agreed to be recorded at the start of this meeting.",
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    type: "email",
    label: "Email Consent",
    description: "Client provided consent via email prior to this meeting.",
    icon: <Mail className="w-5 h-5" />,
  },
];

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

  const [copied, setCopied]           = useState(false);
  const [consentType, setConsentType] = useState<ConsentType | null>(null);

  function handleClose() {
    if (state === "recording") {
      if (!confirm("Recording in progress. Stop and discard?")) return;
      stopRecording();
    }
    reset();
    setConsentType(null);
    onClose();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadTranscript() {
    const consentLine = consentType
      ? `Consent obtained: ${CONSENT_OPTIONS.find(o => o.type === consentType)?.label ?? consentType}\n\n`
      : "";
    const blob = new Blob([consentLine + transcript], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `meeting-${clientName.replace(/\s+/g, "-")}-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
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

          {/* ── Consent gate ────────────────────────────────────────── */}
          {state === "idle" && !consentType && (
            <div className="py-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="w-4 h-4 text-[#0c1e3a]" />
                <h3 className="font-bold text-gray-900 text-sm">Recording Consent Required</h3>
              </div>
              <p className="text-xs text-gray-400 mb-5 ml-6">
                Canadian privacy law requires consent before recording. How was consent obtained from <span className="font-semibold text-gray-600">{clientName}</span>?
              </p>

              <div className="space-y-2">
                {CONSENT_OPTIONS.map(opt => (
                  <button
                    key={opt.type}
                    onClick={() => setConsentType(opt.type)}
                    className="w-full flex items-start gap-3 p-3.5 rounded-xl border border-gray-200 hover:border-[#0c1e3a] hover:bg-[#0c1e3a]/[0.02] text-left transition-all group"
                  >
                    <div className="w-9 h-9 rounded-lg bg-gray-50 group-hover:bg-[#0c1e3a]/10 flex items-center justify-center text-gray-400 group-hover:text-[#0c1e3a] transition-colors flex-shrink-0">
                      {opt.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800 group-hover:text-[#0c1e3a]">{opt.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                    </div>
                  </button>
                ))}
              </div>

              <p className="text-[10px] text-gray-300 text-center mt-4">
                This selection will be logged with the meeting transcript.
              </p>
            </div>
          )}

          {/* ── Ready to record (consent confirmed) ─────────────────── */}
          {state === "idle" && consentType && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-[#0c1e3a]/5 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-7 h-7 text-[#0c1e3a]" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Ready to record</h3>

              {/* Consent badge */}
              <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full mb-4">
                <ShieldCheck className="w-3 h-3" />
                {CONSENT_OPTIONS.find(o => o.type === consentType)?.label} confirmed
                <button
                  onClick={() => setConsentType(null)}
                  className="ml-1 text-emerald-400 hover:text-emerald-700 transition-colors"
                  title="Change consent type"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                {"The AI will transcribe in real time and generate a financial planning summary when you're done."}
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
                  {consentType && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      {CONSENT_OPTIONS.find(o => o.type === consentType)?.label}
                    </span>
                  )}
                </div>
                <button
                  onClick={stopRecording}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
                >
                  <Square className="w-3.5 h-3.5 fill-white" /> Stop & Summarise
                </button>
              </div>

              {/* Audio capture indicator — Whisper transcribes after recording ends */}
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[160px] gap-3">
                <div className="flex items-end gap-1 h-10">
                  {[3,5,8,6,10,7,4,9,6,5,8,4,7,5,3].map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 bg-red-400 rounded-full animate-pulse"
                      style={{
                        height: `${h * 4}px`,
                        animationDelay: `${i * 80}ms`,
                        animationDuration: `${600 + (i % 3) * 200}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-400 text-center">
                  Audio is being captured — transcript will appear after you stop.<br />
                  <span className="text-gray-300">Powered by OpenAI Whisper</span>
                </p>
              </div>
            </>
          )}

          {/* Transcribing — Whisper processing */}
          {state === "transcribing" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-700">Transcribing audio…</p>
              <p className="text-xs text-gray-400 mt-1">OpenAI Whisper is processing the recording</p>
            </div>
          )}

          {/* Processing — Claude summary */}
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
  , document.body);
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
  icon: ReactNode; title: string; color: string; children: React.ReactNode;
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

// ─────────────────────────────────────────────────────────────────────────────
// Intake Recorder — records an intake conversation and extracts client profile
// ─────────────────────────────────────────────────────────────────────────────
export interface IntakeProfile {
  firstName: string; lastName: string; email: string; phone: string;
  dateOfBirth: string; province: string; occupation: string;
  employmentStatus: string; annualIncome: string; retirementAge: number | null;
  desiredRetirementIncome: string; pensionType: string;
  spouseFirstName: string; spouseLastName: string; spouseDateOfBirth: string;
  spouseOccupation: string; spouseAnnualIncome: string; notes: string;
}

interface IntakeRecorderProps {
  onComplete: (profile: IntakeProfile) => void;
  onClose: () => void;
}

function IntakeRecorderModal({ onComplete, onClose }: IntakeRecorderProps) {
  const [recState, setRecState] = useState<"idle"|"recording"|"transcribing"|"extracting"|"done"|"error">("idle");
  const [error, setError]       = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [preview, setPreview]   = useState<IntakeProfile | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<number | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);
      setRecState("recording");
      setError(null);
    } catch {
      setError("Microphone access denied.");
      setRecState("error");
    }
  }

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);

    const audioBlob = await new Promise<Blob>((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve(new Blob([]));
      mr.onstop = () => resolve(new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" }));
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });
    mediaRecorderRef.current = null;

    if (audioBlob.size === 0) { setError("No audio captured."); setRecState("error"); return; }

    setRecState("transcribing");
    try {
      const fd = new FormData();
      fd.append("audio", audioBlob, "intake.webm");
      const tr = await fetch("/api/ai/transcribe", { method: "POST", body: fd, credentials: "include" });
      if (!tr.ok) throw new Error("Transcription failed");
      const { transcript } = await tr.json() as { transcript: string };
      if (!transcript?.trim()) throw new Error("No speech detected.");

      setRecState("extracting");
      const er = await fetch("/api/ai/intake-transcript", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!er.ok) throw new Error("Extraction failed");
      const profile = await er.json() as IntakeProfile;
      setPreview(profile);
      setRecState("done");
    } catch (e: any) {
      setError(e.message ?? "Processing failed");
      setRecState("error");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
              recState === "recording" ? "bg-red-100" : "bg-[#0c1e3a]/10")}>
              <Mic className={cn("w-4 h-4", recState === "recording" ? "text-red-500" : "text-[#0c1e3a]")} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Intake Recorder</h2>
              <p className="text-xs text-gray-400">Record the conversation — we'll build the client file</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {recState === "idle" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-16 h-16 bg-[#0c1e3a]/5 rounded-full flex items-center justify-center mb-4">
                <Mic className="w-7 h-7 text-[#0c1e3a]" />
              </div>
              <h3 className="font-bold text-gray-800 mb-1">Record Intake Conversation</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                Ask the client for their details naturally. Whisper will transcribe and Claude will extract the client profile automatically.
              </p>
              <button onClick={startRecording}
                className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            </div>
          )}

          {recState === "recording" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-red-600">Recording</span>
                  <span className="text-sm text-gray-400 tabular-nums">{fmtDuration(duration)}</span>
                </div>
                <button onClick={stopRecording}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors">
                  <Square className="w-3.5 h-3.5 fill-white" /> Stop & Extract
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[120px] gap-3">
                <div className="flex items-end gap-1 h-8">
                  {[3,5,8,6,10,7,4,9,6,5,8,4,7,5,3].map((h, i) => (
                    <div key={i} className="w-1.5 bg-red-400 rounded-full animate-pulse"
                      style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms`, animationDuration: `${600 + (i % 3) * 200}ms` }} />
                  ))}
                </div>
                <p className="text-xs text-gray-400">Ask the client their name, contact info, income, goals…</p>
              </div>
            </>
          )}

          {recState === "transcribing" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-700">Transcribing audio…</p>
              <p className="text-xs text-gray-400 mt-1">OpenAI Whisper is processing the recording</p>
            </div>
          )}

          {recState === "extracting" && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Loader2 className="w-8 h-8 text-[#0c1e3a] animate-spin mb-3" />
              <p className="text-sm font-semibold text-gray-700">Building client profile…</p>
              <p className="text-xs text-gray-400 mt-1">Claude is extracting client details from the conversation</p>
            </div>
          )}

          {recState === "error" && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-3">
                <MicOff className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-600 mb-1">Something went wrong</p>
              <p className="text-xs text-gray-400 mb-4">{error}</p>
              <button onClick={() => setRecState("idle")} className="text-sm font-semibold text-[#0c1e3a] hover:underline">Try again</button>
            </div>
          )}

          {recState === "done" && preview && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <p className="text-sm font-bold text-gray-800">Profile extracted — review before saving</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  ["First Name", preview.firstName], ["Last Name", preview.lastName],
                  ["Email", preview.email], ["Phone", preview.phone],
                  ["Province", preview.province], ["Date of Birth", preview.dateOfBirth],
                  ["Occupation", preview.occupation], ["Employment", preview.employmentStatus],
                  ["Annual Income", preview.annualIncome ? `$${parseInt(preview.annualIncome).toLocaleString()}` : ""],
                  ["Retirement Age", preview.retirementAge?.toString() ?? ""],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide font-semibold">{label}</p>
                    <p className="font-semibold text-slate-800 truncate">{value}</p>
                  </div>
                ))}
              </div>
              {preview.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">Notes: </span>{preview.notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {recState === "done" && preview && (
          <div className="flex gap-2 px-6 py-4 border-t border-gray-100">
            <button onClick={() => setRecState("idle")}
              className="text-sm text-gray-500 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg transition-colors">
              Record Again
            </button>
            <button onClick={() => { onComplete(preview); onClose(); }}
              className="ml-auto flex items-center gap-1.5 text-sm font-semibold text-white bg-[#0c1e3a] hover:bg-[#0e2a4a] px-4 py-1.5 rounded-lg transition-colors">
              <Check className="w-3.5 h-3.5" /> Use This Profile
            </button>
          </div>
        )}
      </div>
    </div>
  , document.body);
}

export function IntakeRecorderTrigger({ onComplete }: { onComplete: (p: IntakeProfile) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#0c1e3a] border border-[#0c1e3a]/30 hover:border-[#0c1e3a] bg-[#0c1e3a]/5 hover:bg-[#0c1e3a]/10 px-2.5 py-1.5 rounded-lg transition-colors">
        <Mic className="w-3.5 h-3.5" /> Record Intake
      </button>
      {open && <IntakeRecorderModal onComplete={onComplete} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TranscriptRecorderTrigger — generic recorder that posts transcript to any
// endpoint and returns the extracted data via onComplete. No preview UI —
// the caller handles applying the data to its own form.
// ─────────────────────────────────────────────────────────────────────────────
interface TranscriptRecorderProps {
  endpoint: string;           // e.g. "/api/ai/needs-analysis-transcript"
  label?: string;             // button label, default "Record"
  processingLabel?: string;   // shown during Claude extraction
  onComplete: (data: any) => void;
}

export function TranscriptRecorderTrigger({ endpoint, label = "Record", processingLabel = "Extracting data…", onComplete }: TranscriptRecorderProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs font-semibold text-[#0c1e3a] border border-[#0c1e3a]/30 hover:border-[#0c1e3a] bg-[#0c1e3a]/5 hover:bg-[#0c1e3a]/10 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <Mic className="w-3.5 h-3.5" /> {label}
      </button>
      {open && (
        <TranscriptRecorderModal
          endpoint={endpoint}
          processingLabel={processingLabel}
          onComplete={(data) => { onComplete(data); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function TranscriptRecorderModal({ endpoint, processingLabel, onComplete, onClose }: {
  endpoint: string; processingLabel: string;
  onComplete: (data: any) => void; onClose: () => void;
}) {
  const [recState, setRecState] = useState<"idle" | "recording" | "transcribing" | "extracting" | "error">("idle");
  const [error, setError]       = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<number | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm" : "";
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);
      setRecState("recording");
      setError(null);
    } catch {
      setError("Microphone access denied.");
      setRecState("error");
    }
  }

  async function stopAndProcess() {
    if (timerRef.current) clearInterval(timerRef.current);

    const audioBlob = await new Promise<Blob>((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve(new Blob([]));
      mr.onstop = () => resolve(new Blob(audioChunksRef.current, { type: mr.mimeType || "audio/webm" }));
      mr.stop();
      mr.stream.getTracks().forEach(t => t.stop());
    });
    mediaRecorderRef.current = null;

    if (audioBlob.size === 0) { setError("No audio captured."); setRecState("error"); return; }

    setRecState("transcribing");
    try {
      const fd = new FormData();
      fd.append("audio", audioBlob, "recording.webm");
      const tr = await fetch("/api/ai/transcribe", { method: "POST", body: fd, credentials: "include" });
      if (!tr.ok) throw new Error("Transcription failed");
      const { transcript } = await tr.json() as { transcript: string };
      if (!transcript?.trim()) throw new Error("No speech detected.");

      setRecState("extracting");
      const er = await fetch(endpoint, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!er.ok) throw new Error("Extraction failed");
      const data = await er.json();
      onComplete(data);
    } catch (e: any) {
      setError(e.message ?? "Processing failed");
      setRecState("error");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100">

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={cn("w-8 h-8 rounded-full flex items-center justify-center",
              recState === "recording" ? "bg-red-100" : "bg-[#0c1e3a]/10")}>
              <Mic className={cn("w-4 h-4", recState === "recording" ? "text-red-500" : "text-[#0c1e3a]")} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Record Conversation</h2>
              <p className="text-xs text-gray-400">Fields will be pre-filled from the recording</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-8">
          {recState === "idle" && (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 bg-[#0c1e3a]/5 rounded-full flex items-center justify-center">
                <Mic className="w-7 h-7 text-[#0c1e3a]" />
              </div>
              <p className="text-sm text-gray-500 max-w-xs">Discuss the details with your client. Whisper transcribes, Claude fills the form.</p>
              <button onClick={startRecording}
                className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                <Mic className="w-4 h-4" /> Start Recording
              </button>
            </div>
          )}

          {recState === "recording" && (
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-sm font-semibold text-red-600">Recording</span>
                <span className="text-sm text-gray-400 tabular-nums">{fmtDuration(duration)}</span>
              </div>
              <div className="flex items-end gap-1 h-8">
                {[3,5,8,6,10,7,4,9,6,5,8,4,7,5,3].map((h, i) => (
                  <div key={i} className="w-1.5 bg-red-400 rounded-full animate-pulse"
                    style={{ height: `${h * 3}px`, animationDelay: `${i * 80}ms`, animationDuration: `${600 + (i % 3) * 200}ms` }} />
                ))}
              </div>
              <button onClick={stopAndProcess}
                className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-colors">
                <Square className="w-3.5 h-3.5 fill-white" /> Stop & Fill Fields
              </button>
            </div>
          )}

          {(recState === "transcribing" || recState === "extracting") && (
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 className={cn("w-8 h-8 animate-spin", recState === "transcribing" ? "text-blue-500" : "text-[#0c1e3a]")} />
              <p className="text-sm font-semibold text-gray-700">
                {recState === "transcribing" ? "Transcribing audio…" : processingLabel}
              </p>
              <p className="text-xs text-gray-400">
                {recState === "transcribing" ? "OpenAI Whisper is processing the recording" : "Claude is reading the conversation"}
              </p>
            </div>
          )}

          {recState === "error" && (
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center">
                <MicOff className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-red-600">{error}</p>
              <button onClick={() => setRecState("idle")} className="text-sm font-semibold text-[#0c1e3a] hover:underline">Try again</button>
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body);
}
