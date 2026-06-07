/**
 * src/contexts/VoiceContext.tsx
 *
 * Provides global voice input state so the shared Input and Textarea
 * components can show mic buttons without any per-call-site changes.
 *
 * Usage:
 *   Wrap your App (or root component) in <VoiceProvider>
 *   The Input and Textarea components consume it automatically.
 */

import { createContext, useContext } from "react";
import { useVoiceInput, type VoiceState } from "../hooks/useVoiceInput";
import type { VoiceFieldOptions } from "../hooks/useVoiceInput";

// ─────────────────────────────────────────────────────────────────────────────
// Context shape
// ─────────────────────────────────────────────────────────────────────────────
interface VoiceContextValue {
  voiceState:  VoiceState;
  activeField: string | null;
  supported:   boolean;
  listen: (opts: VoiceFieldOptions, cb: (v: string) => void) => void;
}

const VoiceContext = createContext<VoiceContextValue>({
  voiceState:  "idle",
  activeField: null,
  supported:   false,
  listen:      () => {},
});

// ─────────────────────────────────────────────────────────────────────────────
// Provider — wrap once at root
// ─────────────────────────────────────────────────────────────────────────────
export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const voice = useVoiceInput();
  return <VoiceContext.Provider value={voice}>{children}</VoiceContext.Provider>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook — consumed by Input/Textarea
// ─────────────────────────────────────────────────────────────────────────────
export function useVoice() {
  return useContext(VoiceContext);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — derive a stable camelCase key from a human label
// e.g. "Annual Income ($)" → "annualIncome"
// ─────────────────────────────────────────────────────────────────────────────
export function labelToKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")          // strip non-alphanumeric
    .trim()
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase()); // camelCase
}
