/**
 * Login.tsx
 * Firebase auth with mandatory SMS MFA enrollment on registration.
 */

import { useState, useRef, useEffect } from "react";
import { Eye, EyeOff, Loader2, ArrowLeft, Check, X, Smartphone } from "lucide-react";
import {
  auth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "../lib/firebase";
import {
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
} from "firebase/auth";
import { api } from "../lib/api";
import { setSuppressSync } from "../lib/auth";

type Stage =
  | "login"
  | "register-details"
  | "register-verify-email"
  | "register-mfa-phone"
  | "register-mfa-code"
  | "forgot"
  | "forgot-sent";

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

// 6-digit code input component
function CodeInput({ onComplete }: { onComplete: (code: string) => void }) {
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
          type="text" inputMode="numeric" maxLength={1} value={d}
          onChange={e => handleInput(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          className="w-11 h-12 text-center text-xl font-bold bg-white border-2 border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-violet-500 transition-colors"
        />
      ))}
    </div>
  );
}

export default function Login() {
  const [stage, setStage]         = useState<Stage>("login");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName]   = useState("");
  const [firmName, setFirmName]   = useState("");
  const [province, setProvince]   = useState("ON");
  const [jurisdiction, setJurisdiction] = useState<"CA"|"US">("CA");
  const [phone, setPhone]         = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState("");

  // MFA enrollment state
  const [verificationId, setVerificationId]   = useState("");
  const [mfaSession, setMfaSession]           = useState<any>(null);
  const recaptchaContainerId = "recaptcha-container-compass";

  function reset() { setError(""); }

  // ── Login ────────────────────────────────────────────────────────────────────
  async function handleLogin() {
    setBusy(true); reset();
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (e: any) {
      // Firebase MFA challenge — handled by onAuthStateChanged in AuthProvider
      if (e.code === "auth/multi-factor-auth-required") {
        // Firebase automatically handles the MFA challenge UI
        setError("MFA verification required — please check your phone.");
      } else {
        const msg = e.code === "auth/invalid-credential" ? "Invalid email or password"
          : e.code === "auth/too-many-requests" ? "Too many attempts. Try again later."
          : e.message;
        setError(msg);
      }
    } finally { setBusy(false); }
  }

  // ── Register step 1: collect details ─────────────────────────────────────────
  async function handleRegisterDetails() {
    if (!firstName || !lastName || !email || !password)
      return setError("Please fill in all required fields.");
    setBusy(true); reset();
    try {
      setSuppressSync(true); // Prevent auth loop during registration
      // Create Firebase account
      const cred = await createUserWithEmailAndPassword(auth, email, password);

      // Send verification email (required before MFA enrollment)
      const { sendEmailVerification } = await import("firebase/auth");
      await sendEmailVerification(cred.user);

      // Start MFA session (will be used after email verification)
      const mfaUser = multiFactor(cred.user);
      const session = await mfaUser.getSession();
      setMfaSession({ session, user: cred.user });
      setStage("register-verify-email");
    } catch (e: any) {
      const msg = e.code === "auth/email-already-in-use" ? "An account with this email already exists."
        : e.code === "auth/weak-password" ? "Password must be at least 6 characters."
        : e.message;
      setError(msg);
    } finally { setBusy(false); }
  }

  // ── Register step 2: send SMS to phone ───────────────────────────────────────
  async function handleSendSms() {
    if (!phone) return setError("Please enter your mobile number.");
    // Normalize to E.164 format
    let normalized = phone.replace(/[\s\-\(\)\.]/g, "");
    if (!normalized.startsWith("+")) {
      normalized = "+" + (normalized.startsWith("1") ? normalized : "1" + normalized);
    }
    setBusy(true); reset();
    try {
      // Use normalized phone for Firebase
      const phoneForFirebase = normalized;
      // Init reCAPTCHA — clear any existing instance first
      let container = document.getElementById(recaptchaContainerId);
      if (!container) {
        container = document.createElement("div");
        container.id = recaptchaContainerId;
        document.body.appendChild(container);
      }
      // Clear previous reCAPTCHA if any
      container.innerHTML = "";
      const verifier = new RecaptchaVerifier(auth, container, { size: "invisible" });
      await verifier.render();

      const provider = new PhoneAuthProvider(auth);
      const vid = await provider.verifyPhoneNumber(
        { phoneNumber: phoneForFirebase, session: mfaSession.session },
        verifier
      );
      setVerificationId(vid);
      setStage("register-mfa-code");
    } catch (e: any) {
      const msg = e.code === "auth/invalid-phone-number"
        ? "Invalid phone number. Include country code e.g. +1 416 555 0100"
        : e.message;
      setError(msg);
      recaptchaVerifier.current = null;
    } finally { setBusy(false); }
  }

  // ── Register step 3: verify SMS code + complete enrollment ───────────────────
  async function handleVerifyCode(code: string) {
    setBusy(true); reset();
    try {
      const cred = PhoneAuthProvider.credential(verificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(cred);
      const mfaUser = multiFactor(mfaSession.user);
      await mfaUser.enroll(assertion, "Mobile phone");

      // Create Postgres record
      const idToken = await mfaSession.user.getIdToken(true);
      await api.post("/api/auth/register", {
        idToken, firstName, lastName,
        firmName: firmName || undefined,
        jurisdiction, province,
      });
      setSuppressSync(false); // Allow sync now that Postgres record exists
      // AuthProvider onAuthStateChanged will pick up the signed-in user
    } catch (e: any) {
      setSuppressSync(false); // Reset on error
      const msg = e.code === "auth/invalid-verification-code" ? "Invalid code. Please try again."
        : e.message;
      setError(msg);
    } finally { setBusy(false); }
  }

  // ── Forgot password ───────────────────────────────────────────────────────────
  async function handleForgot() {
    if (!email) return setError("Enter your email address.");
    setBusy(true); reset();
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {}
    finally { setBusy(false); setStage("forgot-sent"); }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
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

            {/* Tab switcher — only for login/register */}
            {(stage === "login" || stage === "register-details") && (
              <div className="flex bg-slate-50 border-b border-slate-100">
                {(["login", "register-details"] as const).map(s => (
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
                  {error && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"><X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-red-600 text-sm">{error}</p></div>}
                  <button onClick={handleLogin} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Signing in…" : "Sign In"}
                  </button>
                  <button onClick={() => { setStage("forgot"); reset(); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              {/* ── Register: account details ── */}
              {stage === "register-details" && (
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
                  {error && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"><X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-red-600 text-sm">{error}</p></div>}
                  <button onClick={handleRegisterDetails} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Creating account…" : "Continue →"}
                  </button>
                  <p className="text-center text-xs text-slate-400">Next: set up two-factor authentication</p>
                </div>
              )}

              {/* ── Register: verify email ── */}
              {stage === "register-verify-email" && (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 bg-violet-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-7 h-7 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Verify your email</h2>
                  <p className="text-sm text-slate-500">We sent a verification link to <strong>{email}</strong>. Click it, then come back here.</p>
                  {error && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-left"><X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-red-600 text-sm">{error}</p></div>}
                  <button onClick={async () => {
                    setBusy(true); reset();
                    try {
                      await mfaSession.user.reload();
                      if (!mfaSession.user.emailVerified) {
                        setError("Email not verified yet. Check your inbox and click the link.");
                        return;
                      }
                      // Refresh MFA session after email verification
                      const mfaUser = multiFactor(mfaSession.user);
                      const session = await mfaUser.getSession();
                      setMfaSession({ ...mfaSession, session });
                      setStage("register-mfa-phone");
                    } catch (e: any) { setError(e.message); }
                    finally { setBusy(false); }
                  }} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 text-white font-semibold py-3 rounded-xl text-sm disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    I verified my email →
                  </button>
                  <button onClick={async () => {
                    const { sendEmailVerification } = await import("firebase/auth");
                    await sendEmailVerification(mfaSession.user);
                    setError("Verification email resent.");
                  }} className="text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Resend verification email
                  </button>
                </div>
              )}

              {/* ── Register: enter phone ── */}
              {stage === "register-mfa-phone" && (
                <div className="space-y-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">Set up two-factor authentication</h2>
                      <p className="text-sm text-slate-500">Required for account security.</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Mobile number</label>
                    <input type="tel" placeholder="+1 416 555 0100 (include +1)" value={phone} onChange={e => setPhone(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && handleSendSms()}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition-all" />
                    <p className="text-xs text-slate-400 mt-1.5">Must include country code in E.164 format e.g. <strong>+16137958837</strong></p>
                  </div>
                  {error && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"><X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-red-600 text-sm">{error}</p></div>}
                  <button onClick={handleSendSms} disabled={busy}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-500 hover:to-purple-400 text-white font-semibold py-3 rounded-xl text-sm shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50">
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {busy ? "Sending code…" : "Send verification code"}
                  </button>
                </div>
              )}

              {/* ── Register: enter SMS code ── */}
              {stage === "register-mfa-code" && (
                <div className="space-y-5">
                  <div>
                    <button onClick={() => { setStage("register-mfa-phone"); reset(); }}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-4">
                      <ArrowLeft className="w-3.5 h-3.5" /> Back
                    </button>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-violet-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Smartphone className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">Enter the code</h2>
                        <p className="text-sm text-slate-500">Sent to <strong>{phone}</strong></p>
                      </div>
                    </div>
                  </div>
                  <CodeInput onComplete={handleVerifyCode} />
                  {error && <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5"><X className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /><p className="text-red-600 text-sm">{error}</p></div>}
                  {busy && (
                    <div className="flex items-center justify-center gap-2 text-violet-600 text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
                    </div>
                  )}
                  <button onClick={() => { setStage("register-mfa-phone"); reset(); }}
                    className="w-full text-center text-xs text-slate-400 hover:text-violet-600 transition-colors">
                    Didn't receive a code? Try again
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

              {/* ── Forgot sent ── */}
              {stage === "forgot-sent" && (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 bg-violet-100 rounded-full flex items-center justify-center mx-auto">
                    <Check className="w-6 h-6 text-violet-600" />
                  </div>
                  <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                  <p className="text-slate-500 text-sm">If <strong>{email}</strong> has an account, a password reset link has been sent.</p>
                  <button onClick={() => { setStage("login"); reset(); }}
                    className="text-sm text-violet-600 hover:text-violet-700 font-medium">
                    Back to sign in
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
