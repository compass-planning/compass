import { useState, useRef, useCallback, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export type RecorderState =
  | "idle"
  | "requesting_permission"
  | "recording"
  | "paused"
  | "stopped"
  | "uploading"
  | "error";

interface UseAudioRecorderOptions {
  meetingId: number;
  clientId: number;
  timesliceMs?: number;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseAudioRecorderResult {
  state: RecorderState;
  duration: number;
  isMicSilent: boolean;
  chunksUploaded: number;
  errorMessage: string | null;
  startRecording: () => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => Promise<void>;
}

export function useAudioRecorder({
  meetingId,
  clientId,
  timesliceMs = 5000,
  onComplete,
  onError,
}: UseAudioRecorderOptions): UseAudioRecorderResult {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [isMicSilent, setIsMicSilent] = useState(false);
  const [chunksUploaded, setChunksUploaded] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const chunkIndexRef = useRef(0);
  const startTimeRef = useRef(0);
  const pendingUploadsRef = useRef<Promise<void>[]>([]);

  const cleanup = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (silenceIntervalRef.current) {
      clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const uploadChunk = useCallback(
    async (data: Blob, index: number) => {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result?.toString().split(",")[1] || "";
          resolve(result);
        };
        reader.onerror = () => reject(new Error("Failed to read audio chunk"));
      });
      reader.readAsDataURL(data);
      const audioData = await base64Promise;

      await apiRequest("POST", `/api/crm/meetings/${meetingId}/chunks`, {
        chunkIndex: index,
        audioData,
        sizeBytes: data.size,
      });
      setChunksUploaded((prev) => prev + 1);
    },
    [meetingId],
  );

  const checkSilence = useCallback(() => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.fftSize);
    analyserRef.current.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = (dataArray[i] - 128) / 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    setIsMicSilent(rms < 0.01);
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState("requesting_permission");
      setErrorMessage(null);
      setChunksUploaded(0);
      chunkIndexRef.current = 0;
      setDuration(0);
      setIsMicSilent(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 32000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          const idx = chunkIndexRef.current++;
          const uploadPromise = uploadChunk(e.data, idx).catch((uploadErr) => {
            console.error("Chunk upload failed:", uploadErr);
            throw uploadErr;
          });
          pendingUploadsRef.current.push(uploadPromise);
        }
      };

      recorder.onerror = () => {
        const msg = "Recording error occurred";
        setErrorMessage(msg);
        setState("error");
        cleanup();
        onError?.(msg);
      };

      recorder.start(timesliceMs);
      startTimeRef.current = Date.now();
      setState("recording");

      durationIntervalRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);

      silenceIntervalRef.current = setInterval(checkSilence, 2000);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to access microphone";
      setErrorMessage(msg);
      setState("error");
      cleanup();
      onError?.(msg);
    }
  }, [timesliceMs, uploadChunk, checkSilence, cleanup, onError]);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.pause();
      setState("paused");
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
    }
  }, [state]);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "paused") {
      mediaRecorderRef.current.resume();
      setState("recording");
      const pausedDuration = duration;
      const resumeTime = Date.now();
      durationIntervalRef.current = setInterval(() => {
        setDuration(
          pausedDuration + Math.floor((Date.now() - resumeTime) / 1000),
        );
      }, 1000);
    }
  }, [state, duration]);

  const stopRecording = useCallback(async () => {
    if (
      !mediaRecorderRef.current ||
      (state !== "recording" && state !== "paused")
    )
      return;

    setState("uploading");

    await new Promise<void>((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve();
        return;
      }
      mediaRecorderRef.current.onstop = () => resolve();
      mediaRecorderRef.current.stop();
    });

    try {
      await Promise.allSettled(pendingUploadsRef.current);
    } catch {
      // individual chunk errors already logged
    }

    cleanup();

    try {
      await apiRequest(
        "POST",
        `/api/crm/meetings/${meetingId}/recording/complete`,
        {
          clientId,
        },
      );
      setState("stopped");
      onComplete?.();
    } catch (completeErr) {
      const msg =
        completeErr instanceof Error
          ? completeErr.message
          : "Failed to finalize recording";
      setErrorMessage(msg);
      setState("error");
      onError?.(msg);
    }
    pendingUploadsRef.current = [];
  }, [state, meetingId, clientId, cleanup, onComplete, onError]);

  return {
    state,
    duration,
    isMicSilent,
    chunksUploaded,
    errorMessage,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
  };
}
