import type { ReactNode } from "react";
import { CompassLogo } from "@/components/CompassLogo";

/**
 * Shared chrome for the Compass CRM login / create-account / forgot-password pages.
 * Matches the Compass Planning auth look: dark #0f0a1e canvas, translucent card,
 * #2d1b69 → #7c3aed gradient action button.
 */

export const authInputClass =
  "h-11 bg-white/5 border-white/10 text-white placeholder:text-white/30 " +
  "focus-visible:ring-[#7c3aed] focus-visible:ring-offset-0 focus-visible:border-[#7c3aed]";

export const authLabelClass = "text-white/70 text-sm";

export const authButtonClass =
  "w-full h-12 rounded-xl text-base font-semibold text-white border-0 " +
  "bg-gradient-to-r from-[#2d1b69] to-[#7c3aed] hover:from-[#2d1b69] hover:to-[#7c3aed] " +
  "hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50";

export function AuthShell({
  title,
  subtitle,
  icon,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#0f0a1e] flex flex-col font-body">
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            {/* Plain anchor (not wouter Link): "/" is the Compass landing page, outside the /crm router base */}
            <a
              href="/"
              className="inline-flex mb-8"
              data-testid="link-back-home"
              aria-label="Back to Compass home"
            >
              <CompassLogo variant="full" product="crm" light />
            </a>
            {icon && (
              <div className="w-16 h-16 rounded-2xl bg-[#7c3aed]/15 border border-[#7c3aed]/30 flex items-center justify-center mx-auto mb-4 text-[#a78bfa]">
                {icon}
              </div>
            )}
            <h1 className="text-3xl font-display font-bold text-white" data-testid="text-auth-title">
              {title}
            </h1>
            {subtitle && <p className="text-white/50 mt-2">{subtitle}</p>}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-8 space-y-5">
            {children}
          </div>

          {footer && <div className="text-center text-sm text-white/40 mt-6">{footer}</div>}
        </div>
      </div>
      <footer className="py-6 text-center">
        <p className="text-white/25 text-sm">
          © {new Date().getFullYear()} Compass CRM · Westoak Innovations
        </p>
      </footer>
    </div>
  );
}

export function AuthError({ message, testId }: { message: string; testId?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="text-red-300 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3"
      data-testid={testId}
    >
      {message}
    </div>
  );
}
