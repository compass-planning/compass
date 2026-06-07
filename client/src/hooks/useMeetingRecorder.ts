import { useState, useRef, useCallback } from "react";
import { api } from "../lib/api";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type RecordingState =
  | "idle"
  | "recording"
  | "transcribing"   // audio uploaded to Whisper, awaiting transcript
  | "processing"     // transcript sent to Claude, awaiting summary
  | "done"
  | "error";

export interface MeetingSummary {
  keyFigures: Array<{ label: string; value: string }>;
  goals: string[];
  actionItems: string[];
  recommendedAreas: string[];
  rawSummary: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
export function useMeetingRecorder(clientId: number) {
  const [state, setState]           = useState<RecordingState>("idle");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary]       = useState<MeetingSummary | null>(null);
  const [error, setError]           = useState<string | null>(null);
  const [duration, setDuration]     = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<number | null>(null);

  // ── Start ──────────────────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunksRef.current = [];

      // Pick the best supported container for Whisper (webm → mp4 → ogg)
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" :
        MediaRecorder.isTypeSupported("audio/webm")             ? "audio/webm" :
        MediaRecorder.isTypeSupported("audio/mp4")              ? "audio/mp4" :
        "";                                                        // browser default

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      // Collect chunks every second so we have them if the tab is backgrounded
      mr.start(1000);
      mediaRecorderRef.current = mr;

      // Duration counter
      setDuration(0);
      timerRef.current = window.setInterval(() => setDuration((d) => d + 1), 1000);

      setState("recording");
      setError(null);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
      setState("error");
    }
  }, []);

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    // Wrap MediaRecorder.stop() in a Promise so we can await all chunks
    const audioBlob = await new Promise<Blob>((resolve) => {
      const mr = mediaRecorderRef.current;
      if (!mr) return resolve(new Blob([]));

      mr.onstop = () => {
        const mimeType = mr.mimeType || "audio/webm";
        resolve(new Blob(audioChunksRef.current, { type: mimeType }));
      };

      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    });

    mediaRecorderRef.current = null;

    if (audioBlob.size === 0) {
      setError("No audio was captured. Please check your microphone and try again.");
      setState("error");
      return;
    }

    // ── Phase 1: Whisper transcription ───────────────────────────────────────
    setState("transcribing");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const transcribeRes = await fetch("/api/ai/transcribe", {
        method:      "POST",
        body:        formData,
        credentials: "include",    // cookie-based auth
      });

      if (!transcribeRes.ok) {
        const body = await transcribeRes.json().catch(() => ({}));
        throw new Error((body as any).message ?? "Transcription failed");
      }

      const { transcript: text } = await transcribeRes.json() as { transcript: string };

      if (!text?.trim()) {
        throw new Error("No speech was detected in the recording. Please try again.");
      }

      setTranscript(text);

      // ── Phase 2: Claude meeting summary ───────────────────────────────────
      setState("processing");

      const result = await api.post<MeetingSummary>("/api/ai/meeting-summary", {
        transcript: text,
        clientId,
      });

      setSummary(result);
      setState("done");
    } catch (err: any) {
      setError(err.message ?? "Processing failed. Please try again.");
      setState("error");
    }
  }, [clientId]);

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setState("idle");
    setTranscript("");
    setSummary(null);
    setError(null);
    setDuration(0);
    audioChunksRef.current = [];
  }, []);

  return { state, transcript, summary, error, duration, startRecording, stopRecording, reset };
}
