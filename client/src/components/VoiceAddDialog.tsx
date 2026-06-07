/**
 * VoiceAddDialog — reusable dialog that lets a user record a free-form
 * description of one record (asset, liability, goal, education plan, etc.)
 * and have an AI parse it into form fields.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <button onClick={() => setOpen(true)}>Voice Add Asset</button>
 *   {open && (
 *     <VoiceAddDialog
 *       title="Voice-Add Asset"
 *       moduleId="net-worth-asset"
 *       prompt='Try: "TFSA at TD worth twenty-five thousand, jointly with spouse"'
 *       fieldSchema={[
 *         { key: "category", description: "One of: TFSA, RRSP, ..." , enum: NW_ASSET_CATS },
 *         { key: "name", description: "Description (e.g. TD TFSA)" },
 *         { key: "value", description: "Market value as a number" },
 *         { key: "owner", description: "primary, spouse, or joint" },
 *       ]}
 *       onConfirm={(parsed) => { addDraftWithFields(parsed); setOpen(false); }}
 *       onClose={() => setOpen(false)}
 *     />
 *   )}
 */

import { useEffect, useRef, useState } from "react";
import { Mic, Square, X, Loader2, Check, RotateCcw } from "lucide-react";
import { api } from "../lib/api";
import { cn } from "../lib/utils";

export interface VoiceFieldSpec {
  key: string;
  label?: string;
  description?: string;
  enum?: string[];
}

interface VoiceAddDialogProps {
  title:        string;
  moduleId:     string;
  prompt:       string;
  fieldSchema:  VoiceFieldSpec[];
  onConfirm:    (fields: Record<string, string>) => void;
  onClose:      () => void;
}

type DialogState = "idle" | "listening" | "processing" | "ready" | "error";

export function VoiceAddDialog({
  title, moduleId, prompt, fieldSchema, onConfirm, onClose,
}: VoiceAddDialogProps) {
  const [state, setState]           = useState<DialogState>("idle");
  const [transcript, setTranscript] = useState("");
  const [parsed, setParsed]         = useState<Record<string, string> | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [duration, setDuration]     = useState(0);

  const recognitionRef = useRef<any>(null);
  const finalRef       = useRef("");
  const timerRef       = useRef<number | null>(null);

  const supported = typeof window !== "undefined" &&
    !!((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition);

  function startListening() {
    if (!supported) {
      setError("Speech recognition requires Chrome or Edge.");
      setState("error");
      return;
    }
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-CA";
    recognitionRef.current = r;
    finalRef.current = "";
    setTranscript("");
    setParsed(null);
    setError(null);

    r.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) finalRef.current += ev.results[i][0].transcript + " ";
        else interim += ev.results[i][0].transcript;
      }
      setTranscript(finalRef.current + interim);
    };
    r.onend = () => {
      if (state === "listening") {
        try { recognitionRef.current?.start(); } catch (_) { /* retry suppressed */ }
      }
    };
    r.onerror = () => {
      setError("Speech recognition error. Try again.");
      setState("error");
    };
    r.start();
    setDuration(0);
    timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);
    setState("listening");
  }

  async function stopAndParse() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    const text = finalRef.current.trim();
    if (!text) {
      setError("Didn't catch any speech. Try again.");
      setState("error");
      return;
    }
    setState("processing");
    try {
      const { fields } = await api.post<{ fields: Record<string, any> }>("/api/ai/voice-fill", {
        text, moduleId, fieldSchema,
      });
      // Coerce all values to strings (form inputs expect strings)
      const stringified: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields ?? {})) {
        if (v !== undefined && v !== null) stringified[k] = String(v);
      }
      if (!Object.keys(stringified).length) {
        setError("AI couldn't extract any fields from what you said. Try rephrasing.");
        setState("error");
        return;
      }
      setParsed(stringified);
      setState("ready");
    } catch (err: any) {
      setError(err?.message ?? "Failed to parse. Try again.");
      setState("error");
    }
  }

  function handleConfirm() {
    if (parsed) onConfirm(parsed);
  }

  function handleEditValue(k: string, v: string) {
    setParsed((p) => p ? { ...p, [k]: v } : { [k]: v });
  }

  function handleAddField(k: string) {
    setParsed((p) => p ? { ...p, [k]: "" } : { [k]: "" });
  }

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recognitionRef.current) { recognitionRef.current.onend = null; recognitionRef.current.stop(); }
  }, []);

  function fmtDuration(s: number) {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  }

  const usedKeys  = new Set(Object.keys(parsed ?? {}));
  const unusedKeys = fieldSchema.filter(f => !usedKeys.has(f.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center",
              state === "listening" ? "bg-red-100" : "bg-cyan-50"
            )}>
              <Mic className={cn("w-3.5 h-3.5", state === "listening" ? "text-red-500" : "text-cyan-600")} />
            </div>
            <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 p-1"><X className="w-4 h-4" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Idle */}
          {state === "idle" && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <p className="text-xs text-gray-500 max-w-md mb-4 italic">{prompt}</p>
              <button
                onClick={startListening}
                disabled={!supported}
                className="flex items-center gap-2 bg-[#0c1e3a] hover:bg-[#0e2a4a] text-white text-sm font-semibold px-5 py-2 rounded-xl disabled:opacity-50"
              >
                <Mic className="w-4 h-4" /> Start Speaking
              </button>
              {!supported && <p className="text-xs text-red-500 mt-3">Voice input requires Chrome or Edge.</p>}
            </div>
          )}

          {/* Listening */}
          {state === "listening" && (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-semibold text-red-600">Listening</span>
                  <span className="text-xs text-gray-400 tabular-nums">{fmtDuration(duration)}</span>
                </div>
                <button
                  onClick={stopAndParse}
                  className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                >
                  <Square className="w-3 h-3 fill-white" /> Stop & Parse
                </button>
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 min-h-[120px] max-h-[200px] overflow-y-auto">
                {transcript
                  ? <p className="text-sm text-gray-700 leading-relaxed">{transcript}</p>
                  : <p className="text-xs text-gray-300 italic">Listening — speak now…</p>}
              </div>
            </>
          )}

          {/* Processing */}
          {state === "processing" && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-7 h-7 text-cyan-500 animate-spin mb-2" />
              <p className="text-xs font-semibold text-gray-700">Parsing fields with AI…</p>
            </div>
          )}

          {/* Error */}
          {state === "error" && (
            <div className="flex flex-col items-center py-6 text-center">
              <p className="text-sm font-semibold text-red-600 mb-1">Something went wrong</p>
              <p className="text-xs text-gray-400 mb-3">{error}</p>
              <button onClick={() => { setState("idle"); setError(null); setTranscript(""); }} className="text-xs font-semibold text-cyan-600 hover:underline">
                Try again
              </button>
            </div>
          )}

          {/* Ready — show parsed fields, allow edit, then confirm */}
          {state === "ready" && parsed && (
            <>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1.5">Heard</p>
                <p className="text-xs text-gray-500 italic bg-gray-50 rounded-lg p-2.5 mb-3">{'"'}{transcript}{'"'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">AI extracted</p>
                <div className="space-y-2">
                  {Object.entries(parsed).map(([k, v]) => {
                    const spec = fieldSchema.find(f => f.key === k);
                    return (
                      <div key={k} className="flex items-center gap-3">
                        <label className="text-xs font-semibold text-gray-600 w-32 flex-shrink-0">{spec?.label ?? k}</label>
                        {spec?.enum ? (
                          <select
                            value={v}
                            onChange={(e) => handleEditValue(k, e.target.value)}
                            className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-cyan-400"
                          >
                            <option value="">—</option>
                            {spec.enum.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                          </select>
                        ) : (
                          <input
                            value={v}
                            onChange={(e) => handleEditValue(k, e.target.value)}
                            className="flex-1 border border-gray-200 rounded-md px-2 py-1 text-sm focus:outline-none focus:border-cyan-400"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {unusedKeys.length > 0 && (
                <details className="text-xs text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-600">Add another field…</summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {unusedKeys.map(f => (
                      <button
                        key={f.key}
                        onClick={() => handleAddField(f.key)}
                        className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded"
                      >
                        + {f.label ?? f.key}
                      </button>
                    ))}
                  </div>
                </details>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {state === "ready" && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
            <button
              onClick={() => { setState("idle"); setParsed(null); setTranscript(""); }}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 hover:border-gray-300 px-3 py-1.5 rounded-lg"
            >
              <RotateCcw className="w-3 h-3" /> Re-record
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-700 px-3 py-1.5 rounded-lg"
            >
              <Check className="w-3 h-3" /> Add to form
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
