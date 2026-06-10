/**
 * Register.tsx
 * Standalone registration page with plan selection.
 * Route: /register  (guests only — redirect to /app if already logged in)
 *
 * Flow:
 *   Step 1 — Choose plan (monthly / annual / start trial)
 *   Step 2 — Account details form
 *   Step 3 — After submit: if trial selected → go to app;
 *             if paid plan selected → redirect to Stripe checkout
 */

import { useState } from "react";
import { Check, Eye, EyeOff, Loader2, ArrowLeft, X, ChevronRight } from "lucide-react";
import { api, token } from "../lib/api";
import { useAuth } from "../lib/auth";

// ── Plan definitions ──────────────────────────────────────────────────────────

interface Plan {
  id: "trial" | "monthly" | "annual";
  name: string;
  price: string;
  period: string;
  savingsBadge?: string;
  description: string;
  features: string[];
  cta: string;
  highlight?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "trial",
    name: "Free Trial",
    price: "$0",
    period: "14 days",
    description: "Full access, no credit card required.",
    features: [
      "Full financial planning suite",
      "Retirement & tax projections",
      "AI-powered plan reports",
      "Monte Carlo simulation",
      "Bilingual (EN/FR)",
    ],
    cta: "Start Free Trial",
  },
  {
    id: "monthly",
    name: "Monthly",
    price: "$14.99",
    period: "/ month",
    description: "Flexible month-to-month subscription.",
    features: [
      "Full planning suite",
      "Retirement + tax projections",
      "AI plan generation",
      "Secure data storage",
      "Cancel anytime",
    ],
    cta: "Subscribe Monthly",
    highlight: true,
  },
  {
    id: "annual",
    name: "Annual",
    price: "$149.99",
    period: "/ year",
    savingsBadge: "Save 17%",
    description: "Best value for committed practitioners.",
    features: [
      "Everything in Monthly",
      "2 months free",
      "Priority support",
      "Early feature access",
    ],
    cta: "Subscribe Annually",
  },
];

// ── Password strength ─────────────────────────────────────────────────────────

function PasswordStrength({ password }: { password: string }) {
  const rules = [
    { label: "12+ characters",     ok: password.length >= 12 },
    { label: "Uppercase letter",   ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",   ok: /[a-z]/.test(password) },
    { label: "Number",             ok: /\d/.test(password) },
    { label: "Special character",  ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = rules.filter(r => r.ok).length;
  if (!password) return null;
  const bar = score <= 1 ? { w: "20%", c: "#ef4444", l: "Weak" }
    : score <= 3 ? { w: `${score * 20}%`, c: "#f59e0b", l: "Fair" }
    : score <= 4 ? { w: "80%", c: "#A78BFA", l: "Good" }
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

// ── Register component ────────────────────────────────────────────────────────

interface Props {
  onSuccess?: () => void;   // called after successful registration (nav to app)
  onLogin?: () => void;     // nav to login page
}

export function Register({ onSuccess, onLogin }: Props) {
  const { login } = useAuth();
  const [step, setStep] = useState<"plan" | "form">("plan");
  const [selectedPlan, setSelectedPlan] = useState<Plan["id"]>("trial");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  const [form, setForm] = useState({
    firstName: "", lastName: "",
    email: "", password: "",
    province: "ON", jurisdiction: "CA",
    phone: "",
  });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit() {
    setError(null);
    if (!form.firstName || !form.lastName || !form.email || !form.password) {
      return setError("Please fill in all required fields.");
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        ...form,
        firmName: undefined,
        plan: selectedPlan,
      });

      // Store token + user
      token.set(res.data.token);
      login(res.data.user, res.data.token);

      // Paid plans: subscription activation handled manually until Stripe is live
      // For now, all new accounts start on trial regardless of plan selection
      // TODO: wire Stripe checkout here when payment is active

      onSuccess?.();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1: Plan picker ────────────────────────────────────────────────────
  if (step === "plan") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#2d1b69] to-slate-900 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-5xl">

          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-xs font-semibold mb-4">
              Personal Financial Planning · Canada &amp; USA
            </div>
            <h1 className="text-4xl font-bold text-white mb-3">Build your financial plan</h1>
            <p className="text-slate-400 text-lg">Start free. Your complete retirement and financial planning toolkit.</p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative text-left rounded-2xl border p-6 transition-all duration-200 focus:outline-none ${
                  selectedPlan === plan.id
                    ? plan.highlight
                      ? "border-violet-400 bg-violet-500/5 ring-2 ring-violet-400/30"
                      : "border-violet-400 bg-violet-500/5 ring-2 ring-violet-400/30"
                    : "border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5"
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full">Most Popular</span>
                  </div>
                )}
                {plan.savingsBadge && (
                  <div className="absolute -top-3 right-4">
                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">{plan.savingsBadge}</span>
                  </div>
                )}

                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold text-lg">{plan.name}</h3>
                    <p className="text-slate-400 text-sm mt-0.5">{plan.description}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                    selectedPlan === plan.id ? "border-violet-400 bg-violet-400" : "border-white/20"
                  }`}>
                    {selectedPlan === plan.id && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                  </div>
                </div>

                <div className="mb-5">
                  <span className="text-3xl font-extrabold text-white">{plan.price}</span>
                  <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                      <Check className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            ))}
          </div>

          {/* Continue button */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => setStep("form")}
              className="w-full max-w-sm flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-400 hover:from-violet-500 hover:to-purple-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
            >
              {PLANS.find(p => p.id === selectedPlan)?.cta}
              <ChevronRight className="w-4 h-4" />
            </button>
            <p className="text-slate-500 text-sm">
              Already have an account?{" "}
              <button onClick={onLogin} className="text-violet-400 hover:text-violet-300 font-medium">Sign in</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 2: Account form ───────────────────────────────────────────────────
  const chosen = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#2d1b69] to-slate-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">

        {/* Back */}
        <button onClick={() => setStep("plan")} className="flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back to plans
        </button>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">

          {/* Plan badge */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white">Create your account</h2>
              <p className="text-slate-400 text-sm mt-0.5">
                {selectedPlan === "trial" ? "14-day free trial · no card required" : `${chosen.name} · ${chosen.price}${chosen.period}`}
              </p>
            </div>
            <div className="px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 rounded-full text-violet-400 text-xs font-semibold">
              {chosen.name}
            </div>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            {/* Name row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">First name *</label>
                <input
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-400/50 focus:bg-white/8 transition-colors"
                  placeholder="Jane"
                  value={form.firstName}
                  onChange={e => set("firstName", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Last name *</label>
                <input
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-400/50 focus:bg-white/8 transition-colors"
                  placeholder="Smith"
                  value={form.lastName}
                  onChange={e => set("lastName", e.target.value)}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Email address *</label>
              <input
                type="email"
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-400/50 transition-colors"
                placeholder="jane@smithfinancial.ca"
                value={form.email}
                onChange={e => set("email", e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Province + Jurisdiction */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Province</label>
                <select
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-400/50 transition-colors"
                  value={form.province}
                  onChange={e => set("province", e.target.value)}
                >
                  {PROVINCES.map(p => <option key={p} value={p} className="bg-slate-900">{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">Jurisdiction</label>
                <select
                  className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-400/50 transition-colors"
                  value={form.jurisdiction}
                  onChange={e => set("jurisdiction", e.target.value)}
                >
                  <option value="CA" className="bg-slate-900">🇨🇦 Canada</option>
                  <option value="US" className="bg-slate-900">🇺🇸 United States</option>
                </select>
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className="w-full px-3 py-2.5 pr-10 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-400/50 transition-colors"
                  placeholder="Min 12 characters"
                  value={form.password}
                  onChange={e => set("password", e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordStrength password={form.password} />
            </div>

            {/* Security question */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Security question</label>
              <select
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-violet-400/50 transition-colors mb-2"
                value={form.securityQuestion}
                onChange={e => set("securityQuestion", e.target.value)}
              >
                {SECURITY_QUESTIONS.map(q => <option key={q} value={q} className="bg-slate-900">{q}</option>)}
              </select>
              <input
                className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-violet-400/50 transition-colors"
                placeholder="Your answer"
                value={form.securityAnswer}
                onChange={e => set("securityAnswer", e.target.value)}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-gradient-to-r from-violet-600 to-purple-400 hover:from-violet-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading
                ? "Creating account..."
                : selectedPlan === "trial"
                  ? "Start Free Trial"
                  : `Continue to Payment →`}
            </button>

            <p className="text-center text-slate-500 text-xs">
              By registering you agree to our Terms of Service and Privacy Policy.
              {selectedPlan !== "trial" && " You'll be redirected to Stripe to complete payment."}
            </p>
          </div>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4">
          Already have an account?{" "}
          <button onClick={onLogin} className="text-violet-400 hover:text-violet-300 font-medium">Sign in</button>
        </p>
      </div>
    </div>
  );
}

export default Register;
