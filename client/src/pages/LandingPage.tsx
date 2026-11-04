/**
 * Compass landing page — one page for the whole Compass family.
 * Planning Solo / Advisor sign in through the in-page login (onNavigateToLogin).
 * Compass CRM is served by this same server under /crm, with its own separate
 * sign-in (/crm/login) and account-creation (/crm/register) pages.
 */
import type { ReactNode } from "react";

interface LandingPageProps {
  onNavigateToLogin: (tier?: "solo" | "advisor") => void;
}

const CRM_URL = "/crm"; // same origin, same Fly app

export default function LandingPage({ onNavigateToLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <CompassIcon />
          <span className="text-white font-semibold text-lg tracking-tight">Compass</span>
        </div>
        <div className="flex items-center gap-5">
          <button
            onClick={() => onNavigateToLogin()}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Planning sign in
          </button>
          {CRM_URL && (
            <a
              href={`${CRM_URL}/login`}
              className="text-sm font-semibold text-white px-5 py-2 rounded-xl bg-gradient-to-r from-[#2d1b69] to-[#7c3aed] hover:opacity-90 transition-opacity"
            >
              CRM sign in
            </a>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center px-6 py-12 sm:py-16">
        <div className="max-w-2xl w-full text-center mb-14">
          <p className="text-[#a78bfa] text-sm font-medium mb-5 tracking-wide">
            Financial planning and practice management, built around you
          </p>
          <h1 className="text-white text-4xl sm:text-6xl font-bold leading-tight mb-6">
            Know where you stand.{" "}
            <span className="text-[#a78bfa]">Plan where you're going.</span>
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-xl mx-auto">
            Whether you're managing your own finances, guiding clients through theirs, or
            running an advisory practice, Compass gives you the clarity to move forward with
            confidence.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 w-full max-w-6xl">
          <ProductCard
            badge="Planning · Solo"
            title="Plan your own future"
            description="A complete personal financial planning tool. Track income, expenses, investments, and goals — all in one place."
            features={["Retirement & savings projections", "Net worth tracking", "Tax planning tools", "AI-powered insights"]}
            accent="#7c3aed"
            accentLight="#a78bfa"
          >
            <ActionButton accent="#7c3aed" accentLight="#a78bfa" onClick={() => onNavigateToLogin("solo")}>
              Get started free
            </ActionButton>
          </ProductCard>

          <ProductCard
            badge="Planning · Advisor"
            title="Serve your clients better"
            description="A multi-client advisory platform for financial planners, insurance advisors, and wealth managers."
            features={["Unlimited client portfolios", "Branded client reports", "Team collaboration", "Compliance-ready exports"]}
            accent="#2d1b69"
            accentLight="#7c3aed"
            dark
          >
            <ActionButton accent="#2d1b69" accentLight="#7c3aed" onClick={() => onNavigateToLogin("advisor")}>
              Request advisor access
            </ActionButton>
          </ProductCard>

          <ProductCard
            badge="Compass CRM"
            title="Run your practice"
            description="A CRM built for independent advisors and brokers. Manage clients and households, track products, record meetings with AI summaries, and plan finances in one place."
            features={[
              "Client & household management",
              "Insurance, segregated fund & mutual fund tracking",
              "AI meeting notes and summaries",
              "Pipeline, tasks, email & calendar",
            ]}
            accent="#7c3aed"
            accentLight="#a78bfa"
            highlight
            className="md:col-span-2 lg:col-span-1"
          >
            {CRM_URL ? (
              <>
                <a
                  href={`${CRM_URL}/register`}
                  className="block w-full text-center py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] bg-gradient-to-br from-[#7c3aed] to-[#a78bfa]"
                >
                  Create your account
                </a>
                <a
                  href={`${CRM_URL}/login`}
                  className="block w-full text-center py-2.5 mt-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white border border-white/10 hover:border-white/25 transition-colors"
                >
                  Sign in
                </a>
              </>
            ) : (
              <button
                disabled
                className="w-full py-3 rounded-xl text-sm font-semibold text-white/50 bg-white/10 cursor-not-allowed"
              >
                Coming soon
              </button>
            )}
          </ProductCard>
        </div>
      </main>

      <footer className="py-8 text-center">
        <p className="text-white/25 text-sm">© {new Date().getFullYear()} Compass · Westoak Innovations</p>
      </footer>
    </div>
  );
}

/* ── Product card ──────────────────────────────────────────────────────── */
interface ProductCardProps {
  badge: string;
  title: string;
  description: string;
  features: string[];
  accent: string;
  accentLight: string;
  dark?: boolean;
  highlight?: boolean;
  className?: string;
  children: ReactNode;
}

function ProductCard({ badge, title, description, features, accent, accentLight, dark, highlight, className = "", children }: ProductCardProps) {
  const surface = highlight
    ? "bg-[#7c3aed]/10 border-[#7c3aed]/40"
    : dark
      ? "bg-[#2d1b69]/30 border-[#7c3aed]/30"
      : "bg-white/5 border-white/10";
  return (
    <div className={`relative rounded-2xl p-8 flex flex-col border transition-transform duration-200 hover:-translate-y-1 ${surface} ${className}`}>
      <div
        className="absolute top-0 left-8 right-8 h-px rounded-full"
        style={{ background: `linear-gradient(90deg, transparent, ${accentLight}, transparent)` }}
      />
      <span
        className="text-xs font-semibold px-3 py-1 rounded-full w-fit mb-5"
        style={{ backgroundColor: `${accent}40`, color: highlight ? "#c4b5fd" : accentLight }}
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
      <div>{children}</div>
    </div>
  );
}

function ActionButton({ accent, accentLight, onClick, children }: { accent: string; accentLight: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
      style={{ background: `linear-gradient(135deg, ${accent}, ${accentLight})` }}
    >
      {children}
    </button>
  );
}

/* ── Icons ─────────────────────────────────────────────────────────────── */
function CompassIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="12" stroke="#7c3aed" strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2" fill="#a78bfa" />
      <path d="M14 6 L16.5 13 L14 12 L11.5 13 Z" fill="#a78bfa" />
      <path d="M14 22 L11.5 15 L14 16 L16.5 15 Z" fill="#7c3aed" opacity="0.6" />
    </svg>
  );
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0 mt-0.5" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill={color} opacity="0.15" />
      <path d="M5 8l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
