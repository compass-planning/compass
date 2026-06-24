/**
 * Login.tsx
 * Self-hosted auth — email + password + TOTP MFA.
 * No Firebase dependency.
 *
 * Stages:
 *  login           → email + password
 *  register        → collect details
 *  verify-email    → enter 6-digit code from email
 *  totp-setup      → scan QR code in authenticator app
 *  totp-enable     → enter first TOTP code to confirm setup
 *  recovery-codes  → display one-time recovery codes
 *  totp-verify     → enter TOTP code on subsequent logins
 *  totp-recover    → enter recovery code instead
 *  forgot          → enter email for reset code
 *  forgot-sent     → message sent
 *  reset-password  → enter reset code + new password
 */

import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft, Check, X, ShieldCheck, Copy, CheckCheck } from "lucide-react";
import { publicApi } from "../lib/api";
import { useLoginCallback } from "../lib/auth";
import { setMemToken } from "../lib/auth";

type Stage =
  | "login"
  | "register"
  | "verify-email"
  | "totp-setup"
  | "totp-enable"
  | "recovery-codes"
  | "totp-verify"
  | "totp-recover"
  | "forgot"
  | "forgot-sent"
  | "reset-password";

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

// ── Password strength indicator ───────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "8+ characters",    ok: password.length >= 8 },
    { label: "Uppercase letter", ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter", ok: /[a-z]/.test(password) },
    { label: "Number",           ok: /\d/.test(password) },
    { label: "Special char",     ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter(r => r.ok).length;
  if (!password) return null;
  const bar = score <= 1 ? { w: "20%", c: "#ef4444", l: "Weak" }
    : score <= 3 ? { w: `${score * 20}%`, c: "#f59e0b", l: "Fair" }
    : score <= 4 ? { w: "80%", c: "#8b5cf6", l: "Good" }
    : { w: "100%", c: "#10b981", l: "Strong" };
  return (
    <div className="space-y-1.5 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: bar.w, backgroundColor: bar.c }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: bar.c }}>{bar.l}</span>
      </div>
      <div className="grid grid-cols-2 gap-0.5">
        {rules.map(r => (
          <div key={r.label} className="flex items-center gap-1">
            {r.ok ? <Check className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" /> : <X className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />}
            <span className={`text-[10px] ${r.ok ? "text-emerald-600" : "text-slate-400"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 6-digit code input ────────────────────────────────────────────────────────
function CodeInput({ onComplete, disabled }: { onComplete: (code: string) => void; disabled?: boolean }) {
  const [digits, setDigits] = useState(["","","","","",""]);
  const inputs = useRef<(HTMLInputElement|null)[]>([]);
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  function handleInput(i: number, val: string) {
    if (!/^\d*$/.test(val)) return;
    const next = [...digits];
    next[i] = val.slice(-1);
    setDigits(next);
    if (val && i < 5) inputs.current[i+1]?.focus();
    if (next.every(d => d)) onComplete(next.join(""));
  }
  function handleKey(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) inputs.current[i-1]?.focus();
  }
  function handlePaste(e: React.ClipboardEvent) {
    const paste = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (paste.length === 6) { setDigits(paste.split("")); onComplete(paste); }
  }
  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {digits.map((d, i) => (
        <input key={i} ref={el => { inputs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1} value={d} disabled={disabled}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className="w-11 h-12 text-center text-xl font-bold bg-white border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-violet-500 transition-colors disabled:opacity-50"
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Login() {
  const onLogin = useLoginCallback();

  const [stage, setStage]         = useState<Stage>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [firmName, setFirmName]   = useState("");
  const [province, setProvince]   = useState("ON");
  const [jurisdiction, setJurisdiction] = useState<"CA"|"US">("CA");
  const [showPw, setShowPw]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");

  // State threaded between stages
  const [partialToken, setPartialToken]   = useState("");  // mfaVerified: false
  const [qrCodeUrl, setQrCodeUrl]         = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes]     = useState(false);
  const [resetEmail, setResetEmail]       = useState("");
  const [newPassword, setNewPassword]     = useState("");
  const [resetCode, setResetCode]         = useState("");

  function reset() { setError(""); }

  // ── Login ─────────────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!email || !password) return setError("Please enter your email and password.");
    setBusy(true); reset();
    try {
      const data = await publicApi.post<{ accessToken: string; nextStep: string }>(
        "/api/auth/login", { email, password }
      );
      setPartialToken(data.accessToken);
      setMemToken(data.accessToken);
      if (data.nextStep === "totp-setup") {
        await startTotpSetup(data.accessToken);
      } else {
        setStage("totp-verify");
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Register ──────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!firstName || !lastName || !email || !password)
      return setError("Please fill in all required fields.");
    setBusy(true); reset();
    try {
      await publicApi.post("/api/auth/register", {
        email, password, firstName, lastName,
        firmName: firmName || undefined, jurisdiction, province,
      });
      setStage("verify-email");
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Verify email ──────────────────────────────────────────────────────────
  async function handleVerifyEmail(code: string) {
    setBusy(true); reset();
    try {
      const data = await publicApi.post<{ accessToken: string; nextStep: string }>(
        "/api/auth/verify-email", { email, code }
      );
      setPartialToken(data.accessToken);
      setMemToken(data.accessToken);
      await startTotpSetup(data.accessToken);
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Begin TOTP setup ──────────────────────────────────────────────────────
  async function startTotpSetup(token: string) {
    const res = await fetch("/api/auth/totp/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message);
    setQrCodeUrl(data.qrCodeDataUrl);
    setStage("totp-setup");
  }

  // ── Confirm TOTP setup with first code ────────────────────────────────────
  async function handleTotpEnable(code: string) {
    setBusy(true); reset();
    try {
      const res = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setRecoveryCodes(data.recoveryCodes);
      onLogin(data.accessToken, data.refreshToken);
      setStage("recovery-codes");
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Verify TOTP on login ──────────────────────────────────────────────────
  async function handleTotpVerify(code: string) {
    setBusy(true); reset();
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onLogin(data.accessToken, data.refreshToken);
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Use recovery code ─────────────────────────────────────────────────────
  async function handleTotpRecover() {
    if (!resetCode) return setError("Enter your recovery code.");
    setBusy(true); reset();
    try {
      const res = await fetch("/api/auth/totp/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ code: resetCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onLogin(data.accessToken, data.refreshToken);
      if (data.codesRemaining <= 2) {
        setError(`Warning: only ${data.codesRemaining} recovery code(s) remaining.`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  // ── Forgot password ───────────────────────────────────────────────────────
  async function handleForgot() {
    if (!resetEmail) return setError("Enter your email address.");
    setBusy(true); reset();
    try {
      await publicApi.post("/api/auth/forgot", { email: resetEmail });
      setStage("forgot-sent");
    } catch {} finally { setBusy(false); }
  }

  // ── Reset password ────────────────────────────────────────────────────────
  async function handleResetPassword() {
    if (!resetCode || !newPassword) return setError("Please fill in all fields.");
    setBusy(true); reset();
    try {
      await publicApi.post("/api/auth/reset-password", {
        email: resetEmail, code: resetCode, password: newPassword,
      });
      setStage("login");
      setError("Password reset successfully. You can now sign in.");
    } catch (e: any) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  function copyRecoveryCodes() {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setCopiedCodes(true);
    setTimeout(() => setCopiedCodes(false), 2000);
  }

  // ── Shared input class ────────────────────────────────────────────────────
  const inp = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all";
  const btn = "w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50";

  function ErrorBox() {
    if (!error) return null;
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
        <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20">

      {/* Left panel */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 bg-gradient-to-br from-[#2d1b69] via-[#3b2080] to-[#4c1d95]">
        <div>
          <div className="mb-10">
            <img src="/compass-logo.svg" alt="Compass Planning" className="w-96 object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Your financial future,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-300 to-purple-200">
              clearly mapped.
            </span>
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Retirement projections, tax planning, net worth tracking, and AI-powered insights — built for Canadians and Americans planning their own financial future.
          </p>
        </div>
        <div className="space-y-3">
          {[
            { label: "Retirement projections", sub: "Monte Carlo + guardrails engine" },
            { label: "Tax optimization",       sub: "Canada & United States" },
            { label: "Net worth & goals",      sub: "Full balance sheet tracking" },
            { label: "AI financial reports",   sub: "Plain-language plan summaries" },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-violet-500/30 border border-violet-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-violet-300" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">{f.label}</p>
                <p className="text-white/35 text-xs mt-0.5">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="bg-[#2d1b69] rounded-2xl px-6 py-4">
              <img src="/compass-logo.svg" alt="Compass Planning" className="w-72 object-contain" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">

            {/* Tab switcher */}
            {(stage === "login" || stage === "register") && (
              <div className="flex bg-slate-50 border-b border-slate-100">
                {(["login", "register"] as const).map(s => (
                  <button key={s} onClick={() => { setStage(s); reset(); }}
                    className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                      stage === s ? "bg-white text-violet-600 border-b-2 border-violet-500" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {s === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>
            )}

            <div className="p-8">

              {/* ── Sign In ── */}
              {stage === "login" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
                    <p className="text-sm text-slate-500">Sign in to your Compass Planning account.</p>
                  </div>
                  <input type="email" placeholder="Email address" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="email" className={inp} />
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder="Password"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      onKeyDown={e => e.key === "Enter" && handleLogin()} className={`${inp} pr-10`} />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <ErrorBox />
                  <button onClick={handleLogin} disabled={busy} className={btn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Signing in…" : "Sign In"}
                  </button>
                  <button onClick={() => { setStage("forgot"); setResetEmail(email); reset(); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ── Register ── */}
              {stage === "register" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Create account</h2>
                    <p className="text-sm text-slate-500">Start your 14-day free trial — no credit card required.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} className={inp} />
                    <input placeholder="Last name"  value={lastName}  onChange={e => setLastName(e.target.value)}  className={inp} />
                  </div>
                  <input placeholder="Firm name (optional)" value={firmName} onChange={e => setFirmName(e.target.value)} className={inp} />
                  <input type="email" placeholder="Email address" value={email}
                    onChange={e => setEmail(e.target.value)} autoComplete="email" className={inp} />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={province} onChange={e => setProvince(e.target.value)} className={inp}>
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value as "CA"|"US")} className={inp}>
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="US">🇺🇸 United States</option>
                    </select>
                  </div>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder="Password (min 8 characters)"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password" className={`${inp} pr-10`} />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                  <ErrorBox />
                  <button onClick={handleRegister} disabled={busy} className={btn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Creating account…" : "Continue →"}
                  </button>
                  <p className="text-center text-xs text-slate-400">Next: verify email, then set up authenticator app</p>
                </div>
              )}

              {/* ── Verify email ── */}
              {stage === "verify-email" && (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Verify your email</h2>
                    <p className="text-sm text-slate-500 mt-1">Enter the 6-digit code sent to <strong>{email}</strong></p>
                  </div>
                  <CodeInput onComplete={handleVerifyEmail} disabled={busy} />
                  {busy && <div className="flex items-center justify-center gap-2 text-violet-600 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</div>}
                  <ErrorBox />
                  <p className="text-center text-xs text-slate-400">Code expires in 15 minutes. Check your spam folder if needed.</p>
                </div>
              )}

              {/* ── TOTP setup — scan QR ── */}
              {stage === "totp-setup" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Set up authenticator app</h2>
                      <p className="text-sm text-slate-500">Scan this QR code with Google Authenticator, Authy, or 1Password.</p>
                    </div>
                  </div>
                  {qrCodeUrl && (
                    <div className="flex justify-center">
                      <div className="p-3 bg-white border-2 border-violet-200 rounded-2xl">
                        <img src={qrCodeUrl} alt="TOTP QR Code" className="w-48 h-48" />
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStage("totp-enable")} className={btn}>
                    I've scanned the code →
                  </button>
                </div>
              )}

              {/* ── TOTP enable — confirm with first code ── */}
              {stage === "totp-enable" && (
                <div className="space-y-5">
                  <button onClick={() => setStage("totp-setup")}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Enter the 6-digit code</h2>
                    <p className="text-sm text-slate-500 mt-1">Enter the code from your authenticator app to confirm setup.</p>
                  </div>
                  <CodeInput onComplete={handleTotpEnable} disabled={busy} />
                  {busy && <div className="flex items-center justify-center gap-2 text-violet-600 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</div>}
                  <ErrorBox />
                </div>
              )}

              {/* ── Recovery codes ── */}
              {stage === "recovery-codes" && (
                <div className="space-y-5">
                  <div className="text-center">
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-7 h-7 text-emerald-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Save your recovery codes</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Store these somewhere safe. Each code can only be used once if you lose access to your authenticator app.
                    </p>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-2">
                      {recoveryCodes.map((c, i) => (
                        <div key={i} className="font-mono text-sm text-slate-700 bg-white border border-slate-100 rounded-lg px-3 py-1.5 text-center">
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={copyRecoveryCodes}
                    className="w-full flex items-center justify-center gap-2 border-2 border-violet-200 text-violet-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-violet-50 transition-colors">
                    {copiedCodes ? <CheckCheck className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedCodes ? "Copied!" : "Copy all codes"}
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    You're all set. You'll be taken to the app automatically.
                  </p>
                </div>
              )}

              {/* ── TOTP verify on login ── */}
              {stage === "totp-verify" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Two-factor authentication</h2>
                      <p className="text-sm text-slate-500">Enter the 6-digit code from your authenticator app.</p>
                    </div>
                  </div>
                  <CodeInput onComplete={handleTotpVerify} disabled={busy} />
                  {busy && <div className="flex items-center justify-center gap-2 text-violet-600 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</div>}
                  <ErrorBox />
                  <button onClick={() => { setStage("totp-recover"); reset(); setResetCode(""); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Use a recovery code instead
                  </button>
                </div>
              )}

              {/* ── Recovery code ── */}
              {stage === "totp-recover" && (
                <div className="space-y-5">
                  <button onClick={() => { setStage("totp-verify"); reset(); }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Recovery code</h2>
                    <p className="text-sm text-slate-500 mt-1">Enter one of your saved recovery codes.</p>
                  </div>
                  <input placeholder="XXXX-XXXX-XXXX" value={resetCode}
                    onChange={e => setResetCode(e.target.value)} className={inp} />
                  <ErrorBox />
                  <button onClick={handleTotpRecover} disabled={busy} className={btn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Verifying…" : "Use recovery code"}
                  </button>
                </div>
              )}

              {/* ── Forgot password ── */}
              {stage === "forgot" && (
                <div className="space-y-4">
                  <button onClick={() => { setStage("login"); reset(); }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Reset password</h2>
                    <p className="text-sm text-slate-500">We'll email you a 6-digit reset code.</p>
                  </div>
                  <input type="email" placeholder="Email address" value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)} className={inp} />
                  <ErrorBox />
                  <button onClick={handleForgot} disabled={busy} className={btn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Send reset code
                  </button>
                </div>
              )}

              {/* ── Forgot sent ── */}
              {stage === "forgot-sent" && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-6 h-6 text-violet-600" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                    <p className="text-slate-500 text-sm mt-2">
                      If <strong>{resetEmail}</strong> has an account, a reset code has been sent.
                    </p>
                  </div>
                  <button onClick={() => setStage("reset-password")} className={btn}>
                    Enter reset code →
                  </button>
                  <button onClick={() => { setStage("login"); reset(); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Back to sign in
                  </button>
                </div>
              )}

              {/* ── Reset password ── */}
              {stage === "reset-password" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h2>
                    <p className="text-sm text-slate-500">Enter the code from your email and choose a new password.</p>
                  </div>
                  <input placeholder="6-digit code from email" value={resetCode}
                    onChange={e => setResetCode(e.target.value)} className={inp} maxLength={6} />
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder="New password"
                      value={newPassword} onChange={e => setNewPassword(e.target.value)}
                      className={`${inp} pr-10`} />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={newPassword} />
                  <ErrorBox />
                  <button onClick={handleResetPassword} disabled={busy} className={btn}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Reset password
                  </button>
                </div>
              )}

            </div>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">© {new Date().getFullYear()} Compass Planning. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
