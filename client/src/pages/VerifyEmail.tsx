/**
 * VerifyEmail.tsx
 * Shown after registration — user enters the 6-digit code sent to their email.
 * Also shown as a banner inside the app if email isn't verified yet.
 */

import { useState, useRef, useEffect } from "react";
import { Loader2, Mail, RefreshCw, CheckCircle } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  email: string;
  onVerified: () => void;
}

export function VerifyEmail({ email, onVerified }: Props) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function handleInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...code];
    next[i] = val.slice(-1);
    setCode(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
    if (next.every(d => d) && next.join("").length === 6) {
      submitCode(next.join(""));
    }
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (paste.length === 6) {
      setCode(paste.split(""));
      submitCode(paste);
    }
  }

  async function submitCode(c: string) {
    setLoading(true);
    setError(null);
    try {
      await api.post("/api/auth/mfa/verify-email", { code: c });
      setVerified(true);
      setTimeout(() => onVerified(), 1200);
    } catch (e: any) {
      setError(e?.message ?? "Invalid code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setResending(true);
    setError(null);
    try {
      await api.post("/api/auth/mfa/resend-verification");
      setResent(true);
      setTimeout(() => setResent(false), 4000);
    } catch (e: any) {
      setError(e?.message ?? "Failed to resend. Please try again.");
    } finally {
      setResending(false);
    }
  }

  if (verified) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#2d1b69] to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-violet-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Email verified!</h2>
          <p className="text-slate-400">Taking you to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#2d1b69] to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">

          <div className="w-14 h-14 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <Mail className="w-7 h-7 text-violet-400" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Check your email</h2>
          <p className="text-slate-400 text-sm mb-1">We sent a 6-digit code to</p>
          <p className="text-violet-300 font-medium text-sm mb-8">{email}</p>

          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {resent && (
            <div className="mb-5 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300 text-sm">
              New code sent!
            </div>
          )}

          {/* 6-digit code input */}
          <div className="flex gap-2 justify-center mb-8" onPaste={handlePaste}>
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
                className="w-12 h-14 text-center text-2xl font-bold bg-white/5 border border-white/20 rounded-xl text-white focus:outline-none focus:border-violet-400 focus:bg-white/10 transition-colors"
              />
            ))}
          </div>

          <button
            onClick={() => submitCode(code.join(""))}
            disabled={loading || code.some(d => !d)}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all mb-4"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? "Verifying…" : "Verify Email"}
          </button>

          <button
            onClick={resendCode}
            disabled={resending}
            className="flex items-center justify-center gap-1.5 mx-auto text-slate-400 hover:text-violet-300 text-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${resending ? "animate-spin" : ""}`} />
            {resending ? "Sending…" : "Resend code"}
          </button>

          <p className="text-slate-500 text-xs mt-6">
            Code expires in 15 minutes. Check your spam folder if you don't see it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default VerifyEmail;
