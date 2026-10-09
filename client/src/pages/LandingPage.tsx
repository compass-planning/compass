interface LandingPageProps {
  onNavigateToLogin: (tier?: "solo" | "advisor") => void;
}

export default function LandingPage({ onNavigateToLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-3">
          <CompassIcon />
          <span className="text-white font-semibold text-lg tracking-tight">
            Compass Planning
          </span>
        </div>
        <button
          onClick={() => onNavigateToLogin()}
          className="text-sm text-white/60 hover:text-white transition-colors"
        >
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl w-full text-center mb-16">
          <p className="text-[#a78bfa] text-sm font-medium mb-5 tracking-wide">
            Financial planning, built for everyone
          </p>
          <h1 className="text-white text-5xl sm:text-6xl font-bold leading-tight mb-6">
            Know where you stand.{" "}
            <span className="text-[#a78bfa]">Plan where you're going.</span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-xl mx-auto">
            Whether you're managing your own finances or guiding clients through
            theirs, Compass gives you the clarity to move forward with
            confidence.
          </p>
        </div>

        {/* Tier cards */}
        <div className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl">
          <TierCard
            badge="Solo"
            title="Plan your own future"
            description="A complete personal financial planning tool. Track income, expenses, investments, and goals — all in one place."
            features={[
              "Retirement & savings projections",
              "Net worth tracking",
              "Tax planning tools",
              "AI-powered insights",
            ]}
            cta="Get started free"
            accent="#7c3aed"
            accentLight="#a78bfa"
            onClick={() => onNavigateToLogin("solo")}
          />

          <TierCard
            badge="Advisor"
            title="Serve your clients better"
            description="A multi-client advisory platform for financial planners, insurance advisors, and wealth managers."
            features={[
              "Unlimited client portfolios",
              "Branded client reports",
              "Team collaboration",
              "Compliance-ready exports",
            ]}
            cta="Request advisor access"
            accent="#2d1b69"
            accentLight="#7c3aed"
            dark
            onClick={() => onNavigateToLogin("advisor")}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-white/25 text-sm">
          © {new Date().getFullYear()} Compass Planning · Westoak Innovations
        </p>
      </footer>
    </div>
  );
}

/* ── Tier Card ─────────────────────────────────────────────────────────── */
interface TierCardProps {
  badge: string;
  title: string;
  description: string;
  features: string[];
  cta: string;
  accent: string;
  accentLight: string;
  dark?: boolean;
  onClick: () => void;
}

function TierCard({
  badge, title, description, features, cta, accent, accentLight, dark, onClick,
}: TierCardProps) {
  return (
    <div
      className={`relative rounded-2xl p-8 flex flex-col border transition-transform duration-200 hover:-translate-y-1 ${
        dark ? "bg-[#2d1b69]/30 border-[#7c3aed]/30" : "bg-white/5 border-white/10"
      }`}
    >
      <div
        className="absolute top-0 left-8 right-8 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accentLight}, transparent)` }}
      />
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full w-fit mb-5"
        style={{ backgroundColor: `${accent}40`, color: accentLight }}
      >
        {badge}
      </span>
      <h2 className="text-white text-xl font-semibold mb-3">{title}</h2>
      <p className="text-white/50 text-sm leading-relaxed mb-6">{description}</p>
      <ul className="space-y-2.5 mb-8 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-white/70">
            <CheckIcon color={accentLight} />
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onClick}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
        style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }}
      >
        {cta}
      </button>
    </div>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function CompassIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <circle cx="14" cy="14" r="12" stroke="#7c3aed" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2" fill="#a78bfa" />
      <path d="M14 6 L16.5 13 L14 12 L11.5 13 Z" fill="#a78bfa" />
      <path d="M14 22 L11.5 15 L14 16 L16.5 15 Z" fill="#7c3aed" opacity="0.6" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5">
      <circle cx="8" cy="8" r="7" fill={color} opacity="0.15" />
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
