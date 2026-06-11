/**
 * Login.tsx
 * Firebase-powered auth UI — sign in, register, forgot password.
 * Firebase handles email verification automatically.
 */

import { useState } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft, Check, X } from "lucide-react";
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "../lib/firebase";
import { api } from "../lib/api";

type Mode = "login" | "register" | "forgot" | "forgot-sent";

// ── Password strength ──────────────────────────────────────────────────────────
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

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"];

export default function Login() {
  const [mode, setMode]         = useState<Mode>("login");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [firmName, setFirmName]   = useState("");
  const [province, setProvince]   = useState("ON");
  const [jurisdiction, setJurisdiction] = useState<"CA"|"US">("CA");
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  function reset() { setError(""); setSuccess(""); }

  async function handleLogin() {
    setBusy(true); reset();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged in AuthProvider handles the rest
    } catch (e: any) {
      const msg = e.code === "auth/invalid-credential" ? "Invalid email or password"
        : e.code === "auth/too-many-requests" ? "Too many attempts. Try again later."
        : e.message;
      setError(msg);
    } finally { setBusy(false); }
  }

  async function handleRegister() {
    if (!firstName || !lastName || !email || !password)
      return setError("Please fill in all required fields.");
    setBusy(true); reset();
    try {
      // 1. Create Firebase user
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // 2. Send verification email
      await sendEmailVerification(cred.user);

      // 3. Get ID token and create our Postgres record
      const idToken = await cred.user.getIdToken();
      await api.post("/api/auth/register", {
        idToken, firstName, lastName, firmName: firmName || undefined,
        jurisdiction, province,
      });

      // AuthProvider picks up the Firebase auth state automatically
    } catch (e: any) {
      const msg = e.code === "auth/email-already-in-use" ? "An account with this email already exists."
        : e.code === "auth/weak-password" ? "Password must be at least 6 characters."
        : e.message;
      setError(msg);
    } finally { setBusy(false); }
  }

  async function handleForgot() {
    if (!email) return setError("Enter your email address.");
    setBusy(true); reset();
    try {
      await sendPasswordResetEmail(auth, email);
      setMode("forgot-sent");
    } catch (e: any) {
      // Don't reveal if email exists
      setMode("forgot-sent");
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-violet-50/30 to-purple-50/20 relative overflow-hidden">

      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-[420px] xl:w-[480px] flex-col justify-between p-10 relative overflow-hidden bg-gradient-to-br from-[#2d1b69] via-[#3b2080] to-[#4c1d95]">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="mb-10">
            <img src="/compass-logo.svg" alt="Compass Planning" className="w-64 object-contain" />
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

        <div className="relative z-10 space-y-3">
          {[
            { label: "Retirement projections", sub: "Monte Carlo + guardrails engine" },
            { label: "Tax optimization",       sub: "Canada & United States" },
            { label: "Net worth & goals",      sub: "Full balance sheet tracking" },
            { label: "AI financial reports",   sub: "Plain-language plan summaries" },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500/30 to-purple-400/30 border border-violet-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-violet-300" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium leading-none">{f.label}</p>
                <p className="text-white/35 text-xs mt-0.5">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div className="bg-[#2d1b69] rounded-2xl px-6 py-4">
              <img src="/compass-logo.svg" alt="Compass Planning" className="w-48 object-contain" />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">

            {/* Tab switcher */}
            <div className="flex bg-slate-50 border-b border-slate-100">
              {(["login", "register"] as const).map(m => (
                <button key={m} onClick={() => { setMode(m); reset(); }}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
                    mode === m ? "bg-white text-violet-600 border-b-2 border-violet-500" : "text-slate-500 hover:text-slate-700"
                  }`}>
                  {m === "login" ? "Sign In" : "Register"}
                </button>
              ))}
            </div>

            <div className="p-8">

              {/* Forgot sent */}
              {mode === "forgot-sent" && (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-violet-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                  <p className="text-slate-500 text-sm">If <strong>{email}</strong> has an account, a password reset link has been sent.</p>
                  <button onClick={() => { setMode("login"); reset(); }}
                    className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                    Back to sign in
                  </button>
                </div>
              )}

              {/* Forgot form */}
              {mode === "forgot" && (
                <div className="space-y-4">
                  <button onClick={() => { setMode("login"); reset(); }}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2">
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Reset password</h2>
                    <p className="text-sm text-slate-500">We'll send a reset link to your email.</p>
                  </div>
                  <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                  {error && <p className="text-red-500 text-sm">{error}</p>}
                  <button onClick={handleForgot} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Send reset link
                  </button>
                </div>
              )}

              {/* Login form */}
              {mode === "login" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Welcome back</h2>
                    <p className="text-sm text-slate-500">Sign in to your Compass Planning account.</p>
                  </div>
                  <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password"
                      onKeyDown={e => e.key === "Enter" && handleLogin()}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}
                  <button onClick={handleLogin} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Signing in…" : "Sign In"}
                  </button>
                  <button onClick={() => { setMode("forgot"); reset(); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              {/* Register form */}
              {mode === "register" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Create account</h2>
                    <p className="text-sm text-slate-500">Start your 14-day free trial — no credit card required.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                    <input placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                  </div>
                  <input placeholder="Firm name (optional)" value={firmName} onChange={e => setFirmName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                  <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                  <div className="grid grid-cols-2 gap-3">
                    <select value={province} onChange={e => setProvince(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all">
                      {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select value={jurisdiction} onChange={e => setJurisdiction(e.target.value as "CA"|"US")}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all">
                      <option value="CA">🇨🇦 Canada</option>
                      <option value="US">🇺🇸 United States</option>
                    </select>
                  </div>
                  <div className="relative">
                    <input type={showPw ? "text" : "password"} placeholder="Password (min 8 characters)"
                      value={password} onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                  {error && (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                      <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      <p className="text-red-600 text-sm">{error}</p>
                    </div>
                  )}
                  <button onClick={handleRegister} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Creating account…" : "Create Account"}
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    By registering you agree to our Terms of Service and Privacy Policy.
                  </p>
                </div>
              )}

            </div>
          </div>

          <p className="text-center text-slate-400 text-xs mt-6">
            © {new Date().getFullYear()} Compass Planning. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
