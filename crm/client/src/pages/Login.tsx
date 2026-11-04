import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import {
  Mail, Lock, Eye, EyeOff, Smartphone, KeyRound, RotateCcw, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthShell, AuthError, authInputClass, authLabelClass, authButtonClass,
} from "@/components/auth/AuthShell";

type LoginStep = "credentials" | "mfa" | "recover";

/** Compass CRM sign-in (route: /login). Handles email/password, then TOTP or a recovery code. */
export default function Login() {
  const {
    login, isLoggingIn, loginError,
    verifyMfa, isVerifyingMfa, verifyMfaError,
    recoverMfa, isRecoveringMfa, recoverMfaError,
  } = useAuth();

  const [step, setStep]         = useState<LoginStep>("credentials");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp]         = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError]       = useState("");
  const [recoveryWarning, setRecoveryWarning] = useState("");

  const totpRef = useRef<HTMLInputElement>(null);

  // Auto-focus the TOTP input when the MFA step opens
  useEffect(() => {
    if (step === "mfa") totpRef.current?.focus();
  }, [step]);

  // ── Step 1: credentials ───────────────────────────────────────────────────
  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await login({ email, password });
      if ("mfaRequired" in result && result.mfaRequired) setStep("mfa");
      // Otherwise useAuth's onSuccess stores the user and redirects to "/".
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  };

  // ── Step 2a: TOTP verify ──────────────────────────────────────────────────
  // Takes the code explicitly: the auto-submit below runs from a timeout, where the
  // `totp` state captured by this closure would still be the previous (incomplete) value.
  const submitTotp = async (code: string) => {
    if (code.replace(/\s/g, "").length < 6) return;
    setError("");
    try {
      await verifyMfa(code);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setTotp("");
      totpRef.current?.focus();
    }
  };

  // Auto-submit once 6 digits are entered
  const handleTotpChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setTotp(digits);
    if (digits.length === 6) {
      // Small delay so the user sees the filled input before submit
      setTimeout(() => submitTotp(digits), 120);
    }
  };

  // ── Step 2b: recovery code ────────────────────────────────────────────────
  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const result = await recoverMfa(recovery);
      if (result.warning) setRecoveryWarning(result.warning);
      else window.location.href = "/crm/";
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid recovery code");
    }
  };

  const displayError = error
    || (step === "credentials" && loginError instanceof Error ? loginError.message : "")
    || (step === "mfa" && verifyMfaError instanceof Error ? verifyMfaError.message : "")
    || (step === "recover" && recoverMfaError instanceof Error ? recoverMfaError.message : "");

  // ── Render: TOTP step ─────────────────────────────────────────────────────
  if (step === "mfa") {
    return (
      <AuthShell
        title="Two-factor authentication"
        subtitle="Enter the 6-digit code from your authenticator app."
        icon={<Smartphone className="w-8 h-8" />}
      >
        <form onSubmit={(e) => { e.preventDefault(); submitTotp(totp); }} className="space-y-5">
          <AuthError message={displayError} />

          <div className="space-y-2">
            <Label htmlFor="totp-input" className={authLabelClass}>Authentication code</Label>
            <Input
              id="totp-input"
              ref={totpRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={totp}
              onChange={(e) => handleTotpChange(e.target.value)}
              placeholder="000000"
              maxLength={6}
              className={`${authInputClass} text-center text-2xl font-mono tracking-[0.5em] h-14`}
              data-testid="input-totp"
            />
            <p className="text-xs text-white/40 text-center">Code refreshes every 30 seconds</p>
          </div>

          <Button
            type="submit"
            className={authButtonClass}
            disabled={isVerifyingMfa || totp.length < 6}
            data-testid="button-verify-mfa"
          >
            {isVerifyingMfa ? "Verifying..." : "Verify"}
          </Button>

          <div className="flex items-center justify-between pt-2 text-sm">
            <button
              type="button"
              onClick={() => { setStep("credentials"); setTotp(""); setError(""); }}
              className="text-white/50 hover:text-white flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Back
            </button>
            <button
              type="button"
              onClick={() => { setStep("recover"); setError(""); }}
              className="text-[#a78bfa] font-medium hover:text-white flex items-center gap-1"
              data-testid="link-use-recovery-code"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Use a recovery code
            </button>
          </div>
        </form>
      </AuthShell>
    );
  }

  // ── Render: recovery code step ────────────────────────────────────────────
  if (step === "recover") {
    return (
      <AuthShell
        title="Recovery code"
        subtitle="Enter one of your single-use recovery codes."
        icon={<KeyRound className="w-8 h-8" />}
      >
        <form onSubmit={handleRecover} className="space-y-5">
          <AuthError message={displayError} />
          {recoveryWarning && (
            <div className="bg-amber-400/10 border border-amber-400/20 text-amber-200 text-sm px-4 py-3 rounded-xl flex gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {recoveryWarning}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="recovery-input" className={authLabelClass}>Recovery code</Label>
            <Input
              id="recovery-input"
              type="text"
              autoComplete="off"
              value={recovery}
              onChange={(e) => setRecovery(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              className={`${authInputClass} font-mono tracking-wider text-center`}
              data-testid="input-recovery-code"
            />
          </div>

          {recoveryWarning ? (
            <Button
              type="button"
              className={authButtonClass}
              onClick={() => { window.location.href = "/crm/"; }}
              data-testid="button-continue-after-recovery"
            >
              Continue to Compass CRM
            </Button>
          ) : (
            <Button
              type="submit"
              className={authButtonClass}
              disabled={isRecoveringMfa || !recovery.trim()}
              data-testid="button-submit-recovery"
            >
              {isRecoveringMfa ? "Verifying..." : "Use recovery code"}
            </Button>
          )}

          <button
            type="button"
            onClick={() => { setStep("mfa"); setError(""); }}
            className="w-full text-sm text-white/50 hover:text-white flex items-center justify-center gap-1 pt-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Back to authenticator code
          </button>
        </form>
      </AuthShell>
    );
  }

  // ── Render: credentials step (default) ────────────────────────────────────
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to Compass CRM"
      footer={
        <>
          Don't have an account?{" "}
          <Link
            href="/register"
            className="text-[#a78bfa] font-semibold hover:text-white"
            data-testid="link-switch-register"
          >
            Create your account
          </Link>
        </>
      }
    >
      <form onSubmit={handleCredentials} className="space-y-5">
        <AuthError message={displayError} testId="text-login-error" />

        <div className="space-y-2">
          <Label htmlFor="login-email" className={authLabelClass}>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className={`${authInputClass} pl-10`}
              required
              data-testid="input-login-email"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="login-password" className={authLabelClass}>Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className={`${authInputClass} pl-10 pr-10`}
              required
              data-testid="input-login-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
              data-testid="button-toggle-password"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-sm text-[#a78bfa] font-medium hover:text-white"
            data-testid="link-forgot-password"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" className={authButtonClass} disabled={isLoggingIn} data-testid="button-submit-login">
          {isLoggingIn ? "Signing in..." : "Sign In"}
        </Button>
      </form>
    </AuthShell>
  );
}
