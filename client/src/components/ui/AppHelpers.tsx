/**
 * client/src/components/ui/AppHelpers.tsx
 *
 * Shared UI primitives extracted from App.tsx.
 * Used by ClientDetail, ChangePasswordModal, and other form-heavy components.
 */

import { useState } from "react";
import { Plus, Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { useVoice, labelToKey } from "../../contexts/VoiceContext";

// ── Loading spinner shown during Suspense ─────────────────────────────────────
export function TabLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-[#0c1e3a] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-medium">Loading…</span>
      </div>
    </div>
  );
}

// ── Read-only field display ───────────────────────────────────────────────────
export function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-[0.1em] font-semibold mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-800">{value ?? "—"}</p>
    </div>
  );
}

// ── Section header with optional add button ───────────────────────────────────
export function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-brand-gradient hover:bg-brand-gradient-hover px-3 py-1.5 rounded-lg shadow-sm transition-all"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      )}
    </div>
  );
}

// ── Card container ────────────────────────────────────────────────────────────
export function Card({ children, className, accent = false }: { children: React.ReactNode; className?: string; accent?: boolean }) {
  return <div className={cn("fp-card p-5", accent && "fp-card-accent", className)}>{children}</div>;
}

// ── Text / number input with voice support ────────────────────────────────────
export function Input({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  const { voiceState, activeField, supported, listen } = useVoice();
  const fieldKey    = labelToKey(label);
  const isListening  = activeField === fieldKey && voiceState === "listening";
  const isProcessing = activeField === fieldKey && voiceState === "processing";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em]">{label}</label>
        {supported && (
          <button
            type="button"
            title={isListening ? "Stop listening" : `Speak to fill "${label}"`}
            onClick={() => listen({ fieldKey, fieldLabel: label, fieldType: type }, onChange)}
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
              isListening  ? "bg-rose-500 text-white animate-pulse" :
              isProcessing ? "bg-amber-400 text-white" :
              "text-slate-300 hover:text-cyan-600"
            }`}
          >
            {isProcessing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : isListening
              ? <MicOff className="w-3 h-3" />
              : <Mic className="w-3 h-3" />}
          </button>
        )}
      </div>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`fp-input ${
          isListening  ? "!border-rose-300 ring-2 ring-rose-100" :
          isProcessing ? "!border-amber-300 ring-2 ring-amber-100" : ""
        }`}
      />
    </div>
  );
}

// ── Select / dropdown ─────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-[0.1em] mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className="fp-input">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Date of birth input with auto-formatting ──────────────────────────────────
export function DobInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  function handleChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 4) formatted = digits.slice(0, 4) + "-" + digits.slice(4);
    if (digits.length > 6) formatted = digits.slice(0, 4) + "-" + digits.slice(4, 6) + "-" + digits.slice(6);
    onChange(formatted);
  }
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => handleChange(e.target.value)}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
      />
    </div>
  );
}

// ── Textarea with voice support ───────────────────────────────────────────────
export function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { voiceState, activeField, supported, listen } = useVoice();
  const fieldKey    = labelToKey(label);
  const isListening  = activeField === fieldKey && voiceState === "listening";
  const isProcessing = activeField === fieldKey && voiceState === "processing";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-gray-500">{label}</label>
        {supported && (
          <button
            type="button"
            title={isListening ? "Stop listening" : `Speak to fill "${label}"`}
            onClick={() => listen({ fieldKey, fieldLabel: label, fieldType: "text" }, onChange)}
            className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
              isListening  ? "bg-red-500 text-white animate-pulse" :
              isProcessing ? "bg-yellow-400 text-white" :
              "text-gray-300 hover:text-[#0c1e3a]"
            }`}
          >
            {isProcessing
              ? <Loader2 className="w-3 h-3 animate-spin" />
              : isListening
              ? <MicOff className="w-3 h-3" />
              : <Mic className="w-3 h-3" />}
          </button>
        )}
      </div>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 resize-none transition-colors ${
          isListening  ? "border-red-300 ring-2 ring-red-100" :
          isProcessing ? "border-yellow-300 ring-2 ring-yellow-100" :
          "border-gray-200"
        }`}
      />
    </div>
  );
}
