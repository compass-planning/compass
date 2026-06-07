import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "../lib/utils";
import type { VoiceState } from "../hooks/useVoiceInput";
import type { VoiceFieldOptions } from "../hooks/useVoiceInput";

// ─────────────────────────────────────────────────────────────────────────────
// Mic Button — small inline button that appears to the right of a field label
// ─────────────────────────────────────────────────────────────────────────────
interface MicButtonProps {
  fieldKey: string;
  voiceState: VoiceState;
  activeField: string | null;
  supported: boolean;
  onListen: () => void;
}

export function MicButton({ fieldKey, voiceState, activeField, supported, onListen }: MicButtonProps) {
  if (!supported) return null;

  const isActive    = activeField === fieldKey;
  const isListening = isActive && voiceState === "listening";
  const isProcessing = isActive && voiceState === "processing";

  return (
    <button
      type="button"
      onClick={onListen}
      title={isListening ? "Stop listening" : "Speak to fill this field"}
      className={cn(
        "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all",
        isListening  && "bg-red-500 text-white animate-pulse",
        isProcessing && "bg-yellow-400 text-white",
        !isActive    && "text-gray-300 hover:text-[#0c1e3a]",
      )}
    >
      {isProcessing
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : isListening
        ? <MicOff className="w-3 h-3" />
        : <Mic className="w-3 h-3" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceInput — drop-in replacement for the shared Input component that adds mic
// ─────────────────────────────────────────────────────────────────────────────
interface VoiceInputProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  // Voice props
  voiceOpts: VoiceFieldOptions;
  voiceState: VoiceState;
  activeField: string | null;
  supported: boolean;
  onListen: (opts: VoiceFieldOptions, cb: (v: string) => void) => void;
}

export function VoiceInput({
  label, value, onChange, type = "text", placeholder,
  voiceOpts, voiceState, activeField, supported, onListen,
}: VoiceInputProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-500">{label}</label>
        <MicButton
          fieldKey={voiceOpts.fieldKey}
          voiceState={voiceState}
          activeField={activeField}
          supported={supported}
          onListen={() => onListen(voiceOpts, onChange)}
        />
      </div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-colors",
          activeField === voiceOpts.fieldKey && voiceState === "listening"
            ? "border-red-300 ring-2 ring-red-200"
            : activeField === voiceOpts.fieldKey && voiceState === "processing"
            ? "border-yellow-300 ring-2 ring-yellow-100"
            : "border-gray-200"
        )}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VoiceTextarea — same but for textareas
// ─────────────────────────────────────────────────────────────────────────────
interface VoiceTextareaProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  voiceOpts: VoiceFieldOptions;
  voiceState: VoiceState;
  activeField: string | null;
  supported: boolean;
  onListen: (opts: VoiceFieldOptions, cb: (v: string) => void) => void;
}

export function VoiceTextarea({
  label, value, onChange, rows = 3,
  voiceOpts, voiceState, activeField, supported, onListen,
}: VoiceTextareaProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-500">{label}</label>
        <MicButton
          fieldKey={voiceOpts.fieldKey}
          voiceState={voiceState}
          activeField={activeField}
          supported={supported}
          onListen={() => onListen(voiceOpts, onChange)}
        />
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={cn(
          "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none transition-colors",
          activeField === voiceOpts.fieldKey && voiceState === "listening"
            ? "border-red-300 ring-2 ring-red-200"
            : activeField === voiceOpts.fieldKey && voiceState === "processing"
            ? "border-yellow-300 ring-2 ring-yellow-100"
            : "border-gray-200"
        )}
      />
    </div>
  );
}
