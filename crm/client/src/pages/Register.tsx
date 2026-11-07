import { useState } from "react";
import { Link } from "wouter";
import { Mail, Lock, User, Building2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AuthShell, AuthError, authInputClass, authLabelClass, authButtonClass,
} from "@/components/auth/AuthShell";

/** Client-side mirror of server/auth/passwordPolicy.ts */
function validatePwd(pwd: string): string | null {
  if (pwd.length < 12)           return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(pwd))        return "Password must contain an uppercase letter.";
  if (!/[a-z]/.test(pwd))        return "Password must contain a lowercase letter.";
  if (!/[0-9]/.test(pwd))        return "Password must contain a number.";
  if (!/[^A-Za-z0-9]/.test(pwd)) return "Password must contain a special character.";
  return null;
}

/** Compass CRM account creation (route: /register). Creates the company and its first admin. */
export default function Register() {
  const { register, isRegistering, registerError } = useAuth();
  const [companyName, setCompanyName]         = useState("");
  const [firstName, setFirstName]             = useState("");
  const [lastName, setLastName]               = useState("");
  const [email, setEmail]                     = useState("");
  const [password, setPassword]               = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword]       = useState(false);
  const [error, setError]                     = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    const pwdError = validatePwd(password);
    if (pwdError) { setError(pwdError); return; }
    try {
      await register({ companyName, firstName, lastName, email, password });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const displayError = error || (registerError instanceof Error ? registerError.message : "");

  // Password strength indicator
  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 12)         s++;
    if (/[A-Z]/.test(password))        s++;
    if (/[0-9]/.test(password))        s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();
  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthBar   = ["", "bg-red-400", "bg-amber-400", "bg-violet-400", "bg-emerald-400"][strength];
  const strengthText  = ["", "text-red-300", "text-amber-300", "text-violet-300", "text-emerald-300"][strength];

  return (
    <AuthShell
      title="Create your account"
      subtitle="Register your company to get started with Compass CRM"
      footer={
        <>
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-[#a78bfa] font-semibold hover:text-white"
            data-testid="link-switch-login"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthError message={displayError} testId="text-register-error" />

        <div className="space-y-2">
          <Label htmlFor="reg-company" className={authLabelClass}>Company Name</Label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input id="reg-company" type="text" autoComplete="organization" value={companyName}
              onChange={(e) => setCompanyName(e.target.value)} placeholder="Your Brokerage Inc."
              className={`${authInputClass} pl-10`} required data-testid="input-register-company" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="reg-first" className={authLabelClass}>First Name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
              <Input id="reg-first" type="text" autoComplete="given-name" value={firstName}
                onChange={(e) => setFirstName(e.target.value)} placeholder="John"
                className={`${authInputClass} pl-10`} required data-testid="input-register-first-name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-last" className={authLabelClass}>Last Name</Label>
            <Input id="reg-last" type="text" autoComplete="family-name" value={lastName}
              onChange={(e) => setLastName(e.target.value)} placeholder="Doe"
              className={authInputClass} required data-testid="input-register-last-name" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-email" className={authLabelClass}>Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input id="reg-email" type="email" autoComplete="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com"
              className={`${authInputClass} pl-10`} required data-testid="input-register-email" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-password" className={authLabelClass}>Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input id="reg-password" type={showPassword ? "text" : "password"} autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 12 characters"
              className={`${authInputClass} pl-10 pr-10`} required data-testid="input-register-password" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              aria-label={showPassword ? "Hide password" : "Show password"}
              data-testid="button-toggle-register-password">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {password && (
            <div className="space-y-1.5">
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthBar : "bg-white/10"}`} />
                ))}
              </div>
              <p className={`text-xs font-medium ${strengthText}`}>{strengthLabel}</p>
              <p className="text-xs text-white/40">
                12+ characters · uppercase · lowercase · number · special character (!@#$...)
              </p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reg-confirm" className={authLabelClass}>Confirm Password</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input id="reg-confirm" type={showPassword ? "text" : "password"} autoComplete="new-password"
              value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password" className={`${authInputClass} pl-10`} required
              data-testid="input-register-confirm-password" />
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-300">Passwords do not match</p>
          )}
        </div>

        <Button type="submit" className={authButtonClass} disabled={isRegistering} data-testid="button-submit-register">
          {isRegistering ? "Creating account..." : "Create Account"}
        </Button>
        <p className="text-xs text-white/50 text-center" data-testid="text-legal-consent">
          By creating an account you agree to our <a href="/legal/terms" className="underline hover:text-white">Terms of Service</a> and <a href="/legal/privacy" className="underline hover:text-white">Privacy Policy</a>.
        </p>
      </form>
    </AuthShell>
  );
}
