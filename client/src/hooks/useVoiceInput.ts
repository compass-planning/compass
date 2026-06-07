import { useState, useRef, useCallback } from "react";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type VoiceState = "idle" | "listening" | "processing" | "error";

export interface VoiceFieldOptions {
  /** The state key for this field, e.g. "annualIncome" */
  fieldKey: string;
  /** Human-readable label shown to the user */
  fieldLabel: string;
  /** "number" | "text" | "date" — controls AI parsing hints */
  fieldType?: string;
  /** Short phrase describing the section, e.g. "Retirement Planning" */
  sectionContext?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — one instance shared across a whole form section
// ─────────────────────────────────────────────────────────────────────────────
export function useVoiceInput() {
  const [voiceState, setVoiceState]   = useState<VoiceState>("idle");
  const [activeField, setActiveField] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    !!(  (window as any).SpeechRecognition
      ?? (window as any).webkitSpeechRecognition);

  // ── Start listening for a specific field ───────────────────────────────────
  const listen = useCallback((
    opts: VoiceFieldOptions,
    onValue: (value: string) => void
  ) => {
    if (!supported) {
      alert("Speech recognition requires Chrome or Edge. Please switch browsers.");
      return;
    }

    // If already listening for this field, stop it
    if (activeField === opts.fieldKey) {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      setVoiceState("idle");
      setActiveField(null);
      return;
    }

    // If listening for a different field, stop it first
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.continuous = false;
    r.interimResults = false;
    r.lang = "en-CA";
    recognitionRef.current = r;

    setActiveField(opts.fieldKey);
    setVoiceState("listening");

    r.onresult = async (ev: any) => {
      const speech: string = ev.results[0][0].transcript;
      setVoiceState("processing");

      try {
        const { value } = await api.post<{ value: string }>("/api/ai/voice-field", {
          speech,
          fieldKey: opts.fieldKey,
          fieldLabel: opts.fieldLabel,
          fieldType: opts.fieldType ?? "text",
          sectionContext: opts.sectionContext ?? "",
        });
        onValue(value);
      } catch {
        // Graceful fallback: just use the raw speech
        onValue(speech);
      } finally {
        setVoiceState("idle");
        setActiveField(null);
      }
    };

    r.onerror = () => {
      setVoiceState("error");
      setTimeout(() => {
        setVoiceState("idle");
        setActiveField(null);
      }, 1500);
    };

    r.onend = () => {
      // Only reset if we didn't already move to "processing"
      setVoiceState((prev) => {
        if (prev === "listening") {
          setActiveField(null);
          return "idle";
        }
        return prev;
      });
    };

    r.start();
  }, [activeField, supported]);

  return { voiceState, activeField, listen, supported };
}
