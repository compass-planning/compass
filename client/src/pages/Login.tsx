import { useState, useCallback } from "react";
import { useAuth } from "../lib/auth";
import { Eye, EyeOff, Check, X, ArrowLeft, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { token, api } from "../lib/api";

// ── Constants ─────────────────────────────────────────────────────────────────

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your elementary school?",
  "What was the make of your first car?",
  "What is your oldest sibling's middle name?",
  "What street did you grow up on?",
  "What was your childhood nickname?",
];

type Mode = "login" | "register" | "forgot-email" | "forgot-question" | "forgot-reset" | "forgot-done" | "mfa-challenge";

const EMPTY_FORM = {
  firstName: "", lastName: "", firmName: "", province: "",
  email: "", password: "",
  securityQuestion: SECURITY_QUESTIONS[0],
  securityAnswer: "",
};

// ── Password strength ─────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "8+ characters",          ok: password.length >= 8 },
    { label: "Uppercase letter",        ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",        ok: /[a-z]/.test(password) },
    { label: "Number",                  ok: /\d/.test(password) },
    { label: "Special character",       ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter(r => r.ok).length;
  if (!password) return null;

  const bar = score <= 1
    ? { w: "20%", color: "#ef4444", label: "Weak" }
    : score <= 2
    ? { w: "40%", color: "#f59e0b", label: "Fair" }
    : score <= 3
    ? { w: "60%", color: "#3b82f6", label: "Good" }
    : score <= 4
    ? { w: "80%", color: "#06b6d4", label: "Great" }
    : { w: "100%", color: "#10b981", label: "Strong" };

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: bar.w, backgroundColor: bar.color }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: bar.color }}>{bar.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-0.5">
        {rules.map(r => (
          <div key={r.label} className="flex items-center gap-1">
            {r.ok
              ? <Check className="w-2.5 h-2.5 text-emerald-500 flex-shrink-0" />
              : <X    className="w-2.5 h-2.5 text-slate-300 flex-shrink-0" />}
            <span className={`text-[10px] ${r.ok ? "text-emerald-600" : "text-slate-400"}`}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Input component ───────────────────────────────────────────────────────────

function Field({
  type = "text", placeholder, value, onChange, onKeyDown,
  autoComplete = "off", suffix,
}: {
  type?: string; placeholder: string; value: string;
  onChange: (v: string) => void; onKeyDown?: (e: React.KeyboardEvent) => void;
  autoComplete?: string; suffix?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <input
        type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)} onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        className="w-full bg-white/60 backdrop-blur border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
      />
      {suffix && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</div>
      )}
    </div>
  );
}

// ── Main Login Component ──────────────────────────────────────────────────────

export default function Login({ isGaPortal = false }: { isGaPortal?: boolean }) {
  const { login, register } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode]         = useState<Mode>("login");
  const [mfaToken, setMfaToken]  = useState<string | null>(null);
  const [mfaCode, setMfaCode]    = useState("");
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [showPw, setShowPw]     = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");
  const [forgotEmail, setForgotEmail]   = useState("");
  const [forgotQuestion, setForgotQuestion] = useState("");
  const [forgotAnswer, setForgotAnswer] = useState("");
  const [newPassword, setNewPassword]   = useState("");
  const [showNewPw, setShowNewPw]       = useState(false);

  const u = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const reset = useCallback(() => { setError(""); setBusy(false); }, []);

  const pwOk = [
    form.password.length >= 8,
    /[A-Z]/.test(form.password),
    /[a-z]/.test(form.password),
    /\d/.test(form.password),
    /[^A-Za-z0-9]/.test(form.password),
  ].filter(Boolean).length >= 4;

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function submitMfaChallenge() {
    if (mfaCode.length !== 6) return setError("Please enter your 6-digit code.");
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/auth/mfa/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mfaToken, code: mfaCode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message ?? "Invalid code");
      token.set(data.token);
      window.location.reload();
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitLogin() {
    setBusy(true); setError("");
    try { await login(form.email, form.password); }
    catch (e: any) { setError(e.message ?? "Invalid email or password"); }
    finally { setBusy(false); }
  }

  async function submitRegister() {
    setBusy(true); setError("");
    try {
      await register({
        email: form.email, password: form.password,
        firstName: form.firstName, lastName: form.lastName,
        firmName: form.firmName || undefined,
        province: form.province || undefined,
        securityQuestion: form.securityQuestion,
        securityAnswer: form.securityAnswer,
      });
    } catch (e: any) { setError(e.message ?? "Registration failed"); }
    finally { setBusy(false); }
  }

  async function submitForgotEmail() {
    setBusy(true); setError("");
    try {
      const data = await api.post<{ question: string | null }>("/api/auth/forgot/question", { email: forgotEmail });
      if (!data.question) return setError("No account found with that email.");
      setForgotQuestion(data.question);
      setMode("forgot-question");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function submitForgotAnswer() {
    if (!newPassword || newPassword.length < 8) return setError("New password must be at least 12 characters.");
    setBusy(true); setError("");
    try {
      await api.post("/api/auth/forgot/reset", { email: forgotEmail, securityAnswer: forgotAnswer, newPassword });
      setMode("forgot-done");
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 relative overflow-hidden">

      {/* Background mesh */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-blue-400/5 rounded-full blur-2xl" />
        {/* Subtle grid */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.015]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="#1e293b" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Left panel — branding (desktop only) */}
      <div className="hidden lg:flex flex-col justify-between w-[440px] flex-shrink-0 bg-gradient-to-b from-slate-900 to-slate-800 p-12 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/15 rounded-full blur-2xl translate-y-1/3 -translate-x-1/3" />
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.07]">
            <defs>
              <pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="white"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>

        {/* Top — logo & wordmark */}
        <div className="relative z-10">
          <div className="mb-10">
            <img
              src="/compass-logo.svg"
              alt="Compass Planning"
              className="w-64 object-contain brightness-0 invert"
            />
          </div>

          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Your financial future,<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              clearly mapped.
            </span>
          </h1>
          <p className="text-white/50 text-sm leading-relaxed">
            Retirement projections, tax planning, net worth tracking, and AI-powered insights — built for Canadians and Americans planning their own financial future.
          </p>
        </div>

        {/* Features list */}
        <div className="relative z-10 space-y-3">
          {[
            { label: "Retirement projections", sub: "Monte Carlo + guardrails engine" },
            { label: "Tax optimization", sub: "Canada & United States" },
            { label: "Net worth & goals", sub: "Full balance sheet tracking" },
            { label: "AI financial reports", sub: "Plain-language plan summaries" },
          ].map(f => (
            <div key={f.label} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500/30 to-emerald-400/30 border border-blue-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-3 h-3 text-emerald-400" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium leading-none">{f.label}</p>
                <p className="text-white/35 text-xs mt-0.5">{f.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-white/20 text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            All systems operational
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <img
              src="/compass-logo.svg"
              alt="Compass Planning"
              className="w-48 object-contain"
            />
          </div>

          {/* ── Login / Register ── */}
          {(mode === "login" || mode === "register") && (
            <div className="animate-in fade-in duration-200">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-900 mb-1">
                  {mode === "login" ? "Welcome back" : "Create account"}
                </h2>
                <p className="text-sm text-slate-500">
                  {mode === "login"
                    ? "Sign in to your advisor dashboard"
                    : "Register as a General Agent"}
                </p>
              </div>

              {/* Tab switcher */}
              {isGaPortal && (
                <div className="flex bg-slate-100 rounded-xl p-1 mb-6">
                  {(["login", "register"] as const).map(m => (
                  <button key={m} onClick={() => { setMode(m); reset(); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                      mode === m
                        ? "bg-white shadow-sm text-slate-900"
                        : "text-slate-400 hover:text-slate-600"
                    }`}>
                    {m === "login" ? "Sign In" : "Register"}
                  </button>
                ))}
              </div>
             )}

              <div className="space-y-3">
                {mode === "register" && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Field placeholder="First name" value={form.firstName} onChange={u("firstName")} />
                      <Field placeholder="Last name"  value={form.lastName}  onChange={u("lastName")} />
                    </div>
                    <Field placeholder="Firm name (optional)" value={form.firmName} onChange={u("firmName")} />
                    <select
                      value={form.province}
                      onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                      className="w-full bg-white/60 backdrop-blur border border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    >
                      <option value="">{t("auth.province")}</option>
                      <optgroup label="Canada">
                        {[["AB","Alberta"],["BC","Colombie-Britannique / British Columbia"],["MB","Manitoba"],
                          ["NB","Nouveau-Brunswick / New Brunswick"],["NL","Terre-Neuve / Newfoundland"],
                          ["NS","Nouvelle-Écosse / Nova Scotia"],["NT","Territoires du Nord-Ouest"],
                          ["NU","Nunavut"],["ON","Ontario"],["PE","Île-du-Prince-Édouard / PEI"],
                          ["QC","Québec"],["SK","Saskatchewan"],["YT","Yukon"]
                        ].map(([code, name]) => <option key={code} value={code}>{code} — {name}</option>)}
                      </optgroup>
                      <optgroup label="United States">
                        {["AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
                          "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
                          "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
                          "VA","WA","WV","WI","WY"].map(s => <option key={s} value={s}>{s}</option>)}
                      </optgroup>
                    </select>
                  </>
                )}

                <Field
                  type="email" placeholder="Email address"
                  value={form.email} onChange={u("email")}
                />

                <Field
                  type={showPw ? "text" : "password"}
                  placeholder="Password"
                  value={form.password}
                  onChange={u("password")}
                  onKeyDown={e => e.key === "Enter" && mode === "login" && submitLogin()}
                  autoComplete="new-password"
                  suffix={
                    <button type="button" onClick={() => setShowPw(s => !s)}
                      className="text-slate-400 hover:text-slate-600 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />

                {mode === "register" && <PasswordStrength password={form.password} />}

                {mode === "register" && (
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Security Question</p>
                    <select
                      value={form.securityQuestion}
                      onChange={e => u("securityQuestion")(e.target.value)}
                      className="w-full bg-white/60 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
                    >
                      {SECURITY_QUESTIONS.map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                    <Field
                      placeholder="Your answer"
                      value={form.securityAnswer}
                      onChange={u("securityAnswer")}
                    />
                    <p className="text-[10px] text-slate-400">Answer is case-insensitive and stored securely.</p>
                  </div>
                )}

                {mode === "login" && (
                  <div className="text-right">
                    <button onClick={() => { setMode("forgot-email"); reset(); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                    <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}

                <button
                  onClick={mode === "login" ? submitLogin : submitRegister}
                  disabled={busy || (mode === "register" && (!pwOk || !form.securityAnswer || !form.firstName || !form.email))}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {busy
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Please wait…</>
                    : mode === "login" ? "Sign In" : "Create Account"}
                </button>
              </div>
            </div>
          )}

          {/* ── Forgot — Email step ── */}
          {mode === "forgot-email" && (
            <div className="animate-in fade-in duration-200 space-y-4">
              <button onClick={() => { setMode("login"); reset(); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-2">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Reset Password</h2>
                <p className="text-sm text-slate-500">Enter your email to retrieve your security question.</p>
              </div>
              <Field type="email" placeholder="Email address" value={forgotEmail} onChange={setForgotEmail} />
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <button onClick={submitForgotEmail} disabled={busy || !forgotEmail}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Please wait…</> : "Continue"}
              </button>
            </div>
          )}

          {/* ── Forgot — Security question ── */}
          {mode === "forgot-question" && (
            <div className="animate-in fade-in duration-200 space-y-4">
              <button onClick={() => { setMode("forgot-email"); reset(); }}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back
              </button>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Security Question</h2>
                <p className="text-sm text-slate-500">Answer your security question to reset your password.</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                <p className="text-xs text-slate-500 mb-0.5">Your question</p>
                <p className="text-sm font-medium text-slate-900">{forgotQuestion}</p>
              </div>
              <Field placeholder="Your answer" value={forgotAnswer} onChange={setForgotAnswer} />
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500">New Password</p>
                <Field
                  type={showNewPw ? "text" : "password"}
                  placeholder="New password (min 8 characters)"
                  value={newPassword} onChange={setNewPassword}
                  suffix={
                    <button type="button" onClick={() => setShowNewPw(s => !s)}
                      className="text-slate-400 hover:text-slate-600 transition-colors">
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                />
              </div>
              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                  <p className="text-red-600 text-sm">{error}</p>
                </div>
              )}
              <button onClick={submitForgotAnswer} disabled={busy || !forgotAnswer || newPassword.length < 8}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all disabled:opacity-50">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</> : "Reset Password"}
              </button>
            </div>
          )}

          {/* ── Forgot — Done ── */}
          {mode === "forgot-done" && (
            <div className="animate-in fade-in duration-200 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Password Reset</h2>
                <p className="text-sm text-slate-500">Your password has been updated. You can now sign in.</p>
              </div>
              <button onClick={() => { setMode("login"); reset(); setForgotEmail(""); setForgotAnswer(""); setNewPassword(""); }}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-blue-500/25 transition-all">
                Sign In
              </button>
            </div>
          )}

          {/* Footer */}
          <p className="text-center text-[10px] text-slate-300 mt-8">
            © 2025 Compass Planning · Secure · Encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
