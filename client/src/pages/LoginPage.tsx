import { useState } from "react";
import { useLoginCallback } from "../lib/auth";
import { CompassLogo } from "../components/CompassLogo";

type Mode    = "login" | "register";
type Step    = "credentials" | "verify-email" | "totp-setup" | "totp-verify";

interface LoginPageProps {
  onNavigateToLanding: () => void;
  initialTier?: "solo" | "advisor";
  initialMode?: Mode;
}

export default function LoginPage({
  onNavigateToLanding,
  initialTier,
  initialMode = "login",
}: LoginPageProps) {
  const onLogin = useLoginCallback();

  const [mode, setMode]           = useState<Mode>(initialTier ? "register" : initialMode);
  const [step, setStep]           = useState<Step>("credentials");
  const [tier]                    = useState(initialTier);

  // Credentials step
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");

  // Post-login steps
  const [partialToken, setPartialToken] = useState("");
  const [otpCode,      setOtpCode]      = useState("");
  const [qrCodeUrl,    setQrCodeUrl]    = useState("");
  const [userId,       setUserId]       = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  // ── Step 1: credentials ───────────────────────────────────────────────────
  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "register") {
        const res  = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, firstName, lastName }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Registration failed.");
        setUserId(data.userId ?? null);
        setStep("verify-email");
      } else {
        const res  = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || "Invalid email or password.");
        setPartialToken(data.accessToken);
        if (data.nextStep === "totp-setup")   { await startTotpSetup(data.accessToken); }
        else if (data.nextStep === "totp-verify") { setStep("totp-verify"); }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2a: verify email (register flow) ─────────────────────────────────
  async function handleVerifyEmail(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid code.");
      setPartialToken(data.accessToken);
      setOtpCode("");
      await startTotpSetup(data.accessToken);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Start TOTP setup (get QR code) ────────────────────────────────────────
  async function startTotpSetup(token: string) {
    const res  = await fetch("/api/auth/totp/setup", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || "Could not start authenticator setup.");
    setQrCodeUrl(data.qrCodeDataUrl);
    setStep("totp-setup");
  }

  // ── Step 2b: enable TOTP (register flow) ──────────────────────────────────
  async function handleTotpEnable(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid code.");
      onLogin(data.accessToken, data.refreshToken ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2c: verify TOTP (login flow) ─────────────────────────────────────
  async function handleTotpVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/totp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${partialToken}` },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid code.");
      onLogin(data.accessToken, data.refreshToken ?? null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0f0a1e] flex">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#2d1b69] to-[#0f0a1e] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167,139,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative">
          <CompassLogo variant="full" light />
        </div>
        <div className="relative">
          <blockquote className="text-white/80 text-2xl font-light leading-relaxed mb-8">
            "The clearest path to your clients' goals starts with knowing exactly where they stand today."
          </blockquote>
          {tier === "advisor"
            ? <TierBadge label="Advisor Edition" sub="Multi-client platform" initial="A" />
            : tier === "solo"
            ? <TierBadge label="Solo Edition" sub="Personal financial planning" initial="S" />
            : null}
        </div>
        <p className="text-white/25 text-sm relative">© {new Date().getFullYear()} Westoak Innovations</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <CompassLogo variant="sidebar" light />
        </div>

        <div className="w-full max-w-sm">

          {/* ── Credentials step ── */}
          {step === "credentials" && (
            <>
              <div className="flex rounded-xl bg-white/5 p-1 mb-8">
                {(["login", "register"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                      mode === m ? "bg-[#7c3aed] text-white shadow-sm" : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {m === "login" ? "Sign in" : "Create account"}
                  </button>
                ))}
              </div>

              <h1 className="text-white text-2xl font-bold mb-1">
                {mode === "login" ? "Welcome back" : "Get started"}
              </h1>
              <p className="text-white/40 text-sm mb-8">
                {mode === "login"
                  ? "Sign in to your Compass Planning account."
                  : "Your account type is determined by your email address."}
              </p>

              <form onSubmit={handleCredentials} className="space-y-4">
                {mode === "register" && (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="First name" type="text" value={firstName} onChange={setFirstName} placeholder="Jane" autoComplete="given-name" />
                    <Field label="Last name"  type="text" value={lastName}  onChange={setLastName}  placeholder="Smith" autoComplete="family-name" />
                  </div>
                )}
                <Field label="Email address" type="email"    value={email}    onChange={setEmail}    placeholder="you@example.com"        autoComplete="email" />
                <Field label="Password"      type="password" value={password} onChange={setPassword} placeholder={mode === "register" ? "Min 8 chars, uppercase & number" : "Your password"} autoComplete={mode === "login" ? "current-password" : "new-password"} />

                {error && <ErrorBox message={error} />}

                {mode === "login" && (
                  <div className="flex justify-end">
                    <button type="button" className="text-xs text-[#a78bfa] hover:text-white transition-colors">
                      Forgot password?
                    </button>
                  </div>
                )}

                <SubmitButton loading={loading} label={mode === "login" ? "Sign in" : "Create account"} />
              </form>

              <Legal />
              <BackButton onClick={onNavigateToLanding} />
            </>
          )}

          {/* ── Verify email step ── */}
          {step === "verify-email" && (
            <>
              <StepHeader
                icon="✉️"
                title="Check your email"
                sub={`We sent a 6-digit code to ${email}. Enter it below to verify your account.`}
              />
              <form onSubmit={handleVerifyEmail} className="space-y-4">
                <Field label="Verification code" type="text" value={otpCode} onChange={setOtpCode} placeholder="123456" autoComplete="one-time-code" />
                {error && <ErrorBox message={error} />}
                <SubmitButton loading={loading} label="Verify email" />
              </form>
              <BackButton onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }} label="Back" />
            </>
          )}

          {/* ── TOTP setup step ── */}
          {step === "totp-setup" && (
            <>
              <StepHeader
                icon="🔐"
                title="Set up two-factor auth"
                sub="Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.), then enter the 6-digit code."
              />
              {qrCodeUrl && (
                <div className="flex justify-center mb-6">
                  <img src={qrCodeUrl} alt="TOTP QR code" className="w-44 h-44 rounded-xl bg-white p-2" />
                </div>
              )}
              <form onSubmit={handleTotpEnable} className="space-y-4">
                <Field label="Code from your app" type="text" value={otpCode} onChange={setOtpCode} placeholder="123456" autoComplete="one-time-code" />
                {error && <ErrorBox message={error} />}
                <SubmitButton loading={loading} label="Enable two-factor auth" />
              </form>
            </>
          )}

          {/* ── TOTP verify step (existing users) ── */}
          {step === "totp-verify" && (
            <>
              <StepHeader
                icon="🔐"
                title="Two-factor verification"
                sub="Open your authenticator app and enter the 6-digit code for Compass Planning."
              />
              <form onSubmit={handleTotpVerify} className="space-y-4">
                <Field label="Authenticator code" type="text" value={otpCode} onChange={setOtpCode} placeholder="123456" autoComplete="one-time-code" />
                {error && <ErrorBox message={error} />}
                <SubmitButton loading={loading} label="Verify" />
              </form>
              <BackButton onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }} label="Use a different account" />
            </>
          )}

        </div>
      </div>
    </div>
  );
}

/* ── Shared sub-components ──────────────────────────────────────────────── */
function StepHeader({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="mb-8">
      <div className="text-3xl mb-4">{icon}</div>
      <h1 className="text-white text-2xl font-bold mb-2">{title}</h1>
      <p className="text-white/40 text-sm leading-relaxed">{sub}</p>
    </div>
  );
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#2d1b69] to-[#7c3aed] hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
    >
      {loading ? "Please wait…" : label}
    </button>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
      {message}
    </p>
  );
}

function Legal() {
  return (
    <p className="text-center text-white/30 text-xs mt-8">
      By continuing, you agree to our{" "}
      <a href="/terms"   className="text-white/50 hover:text-white underline underline-offset-2">Terms</a>
      {" "}and{" "}
      <a href="/privacy" className="text-white/50 hover:text-white underline underline-offset-2">Privacy Policy</a>.
    </p>
  );
}

function BackButton({ onClick, label = "Back to home" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors mx-auto mt-6"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}

function TierBadge({ label, sub, initial }: { label: string; sub: string; initial: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-full bg-[#7c3aed]/40 flex items-center justify-center">
        <span className="text-[#a78bfa] text-xs font-bold">{initial}</span>
      </div>
      <div>
        <p className="text-white text-sm font-medium">{label}</p>
        <p className="text-white/40 text-xs">{sub}</p>
      </div>
    </div>
  );
}

function Field({
  label, type, value, onChange, placeholder, autoComplete,
}: {
  label: string; type: string; value: string;
  onChange: (v: string) => void; placeholder: string; autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs font-medium mb-1.5">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} autoComplete={autoComplete} required
        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#7c3aed] focus:ring-1 focus:ring-[#7c3aed]/50 transition-colors"
      />
    </div>
  );
}

function CompassIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="#7c3aed" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2" fill="#a78bfa" />
      <path d="M14 6 L16.5 13 L14 12 L11.5 13 Z" fill="#a78bfa" />
      <path d="M14 22 L11.5 15 L14 16 L16.5 15 Z" fill="#7c3aed" opacity="0.6" />
    </svg>
  );
}
