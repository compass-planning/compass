/**
 * SmsMfaChallenge.tsx
 * Shown during login when MFA is enabled. Code arrives by email.
 * Sends the code and prompts for entry.
 */

import { useState, useRef, useEffect } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  mfaToken: string;
  onSuccess: (token: string, user: any) => void;
  onBack: () => void;
}

export function SmsMfaChallenge({ mfaToken, onSuccess, onBack }: Props) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maskedEmail, setMaskedPhone] = useState<string | null>(null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { sendChallenge(); }, []);

  async function sendChallenge() {
    setSending(true);
    setError(null);
    try {
      const res = await api.post<any>("/api/auth/mfa/challenge", { mfaToken });
      setMaskedPhone(res.message?.replace("Code sent to ", "") ?? null);
      inputs.current[0]?.focus();
    } catch (e: any) {
      setError(e?.message ?? "Failed to send code.");
    } finally {
      setSending(false);
    }
  }

  function handleInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(d => d)) submitCode(next.join(""));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) inputs.current[i - 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) { setCode(paste.split("")); submitCode(paste); }
  }

  async function submitCode(c: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<any>("/api/auth/mfa/complete", { mfaToken, code: c });
      onSuccess(res.token, res.user);
    } catch (e: any) {
      setError(e?.message ?? "Invalid code.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-center">
      <div className="w-14 h-14 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
        <Mail className="w-7 h-7 text-violet-400" />
      </div>

      <h2 className="text-xl font-bold text-slate-800 mb-2">Check your email</h2>
      {sending ? (
        <p className="text-slate-500 text-sm mb-6">Sending code…</p>
      ) : maskedEmail ? (
        <p className="text-slate-500 text-sm mb-6">Code sent to <span className="text-violet-600 font-medium">{maskedEmail}</span></p>
      ) : (
        <p className="text-slate-500 text-sm mb-6">Enter the 6-digit code from your email</p>
      )}

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-2 justify-center mb-6" onPaste={handlePaste}>
        {code.map((d, i) => (
          <input
            key={i}
            ref={el => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleInput(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className="w-11 h-13 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-violet-500 focus:bg-white transition-colors"
          />
        ))}
      </div>

      <button
        onClick={() => submitCode(code.join(""))}
        disabled={loading || code.some(d => !d)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all mb-3"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Verifying…" : "Verify"}
      </button>

      <div className="flex items-center justify-between text-sm">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors">
          ← Back
        </button>
        <button
          onClick={sendChallenge}
          disabled={sending}
          className="flex items-center gap-1 text-violet-500 hover:text-violet-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${sending ? "animate-spin" : ""}`} />
          Resend code
        </button>
      </div>
    </div>
  );
}
