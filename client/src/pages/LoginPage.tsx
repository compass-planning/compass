import { useState } from "react";
import { useAuth } from "../lib/auth";

type Mode = "login" | "register";

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
  const { login } = useAuth();
  const [mode, setMode] = useState<Mode>(initialTier ? "register" : initialMode);
  const [tier] = useState<"solo" | "advisor" | undefined>(initialTier);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
        // Auth context handles the redirect — Root() will render FPApp once user is set
      } else {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name, tier }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "Registration failed. Please try again.");
        }
        // Auto-login after registration
        await login(email, password);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0a1e] flex">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-gradient-to-br from-[#2d1b69] to-[#0f0a1e] relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "linear-gradient(rgba(167,139,250,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.3) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
        <div className="flex items-center gap-3 relative">
          <CompassIcon size={32} />
          <span className="text-white font-semibold text-xl tracking-tight">
            Compass Planning
          </span>
        </div>
        <div className="relative">
          <blockquote className="text-white/80 text-2xl font-light leading-relaxed mb-8">
            "The clearest path to your clients' goals starts with knowing
            exactly where they stand today."
          </blockquote>
          {tier === "advisor" ? (
            <TierBadge label="Advisor Edition" sub="Multi-client platform" initial="A" />
          ) : tier === "solo" ? (
            <TierBadge label="Solo Edition" sub="Personal financial planning" initial="S" />
          ) : null}
        </div>
        <p className="text-white/25 text-sm relative">
          © {new Date().getFullYear()} Westoak Innovations
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="flex items-center gap-2 mb-10 lg:hidden">
          <CompassIcon size={24} />
          <span className="text-white font-semibold text-base">Compass Planning</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Mode toggle */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-8">
            {(["login", "register"] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(""); }}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
                  mode === m
                    ? "bg-[#7c3aed] text-white shadow-sm"
                    : "text-white/40 hover:text-white/70"
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

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <Field
                label="Full name"
                type="text"
                value={name}
                onChange={setName}
                placeholder="Jane Smith"
                autoComplete="name"
              />
            )}
            <Field
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === "register" ? "Choose a strong password" : "Your password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />

            {error && (
              <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3">
                {error}
              </p>
            )}

            {mode === "login" && (
              <div className="flex justify-end">
                <button type="button" className="text-xs text-[#a78bfa] hover:text-white transition-colors">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#2d1b69] to-[#7c3aed] hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading
                ? "Please wait…"
                : mode === "login"
                ? "Sign in"
                : "Create account"}
            </button>
          </form>

          <p className="text-center text-white/30 text-xs mt-8">
            By continuing, you agree to our{" "}
            <a href="/terms" className="text-white/50 hover:text-white underline underline-offset-2">Terms</a>
            {" "}and{" "}
            <a href="/privacy" className="text-white/50 hover:text-white underline underline-offset-2">Privacy Policy</a>.
          </p>

          <button
            onClick={onNavigateToLanding}
            className="flex items-center gap-1.5 text-xs text-white/25 hover:text-white/50 transition-colors mx-auto mt-6"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M8 2L4 6l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ─────────────────────────────────────────────────────── */
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
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required
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
