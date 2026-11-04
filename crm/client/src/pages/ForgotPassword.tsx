import { Link } from "wouter";
import { Users, Shield, ArrowRight } from "lucide-react";
import { AuthShell, authButtonClass } from "@/components/auth/AuthShell";

/** Compass CRM password help (route: /forgot-password). Resets are done by a company admin. */
export default function ForgotPassword() {
  return (
    <AuthShell title="Forgot your password?" subtitle="No worries — here's how to get back in.">
      <div className="bg-[#7c3aed]/10 border border-[#7c3aed]/25 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c3aed]/20 flex items-center justify-center flex-shrink-0">
            <Users className="w-5 h-5 text-[#a78bfa]" />
          </div>
          <h3 className="font-display font-bold text-white">Contact Your Manager or Admin</h3>
        </div>
        <p className="text-sm text-white/60 leading-relaxed">
          Your company administrator or manager can reset your password from the Team Management page.
          They'll set a temporary password for you, and you'll be asked to choose a new one when you log in.
        </p>
      </div>

      <div className="bg-amber-400/10 border border-amber-400/20 rounded-2xl p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-400/15 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-amber-300" />
          </div>
          <h3 className="font-display font-bold text-white">Who Can Help?</h3>
        </div>
        <ul className="text-sm text-white/60 space-y-1.5">
          <li className="flex items-start gap-2"><span className="text-amber-300 mt-0.5">•</span>Your General Manager</li>
          <li className="flex items-start gap-2"><span className="text-amber-300 mt-0.5">•</span>Your Office Administrator</li>
          <li className="flex items-start gap-2"><span className="text-amber-300 mt-0.5">•</span>Your Sales Manager (for advisors)</li>
        </ul>
      </div>

      <Link
        href="/login"
        data-testid="button-back-to-login"
        className={`${authButtonClass} flex items-center justify-center gap-2`}
      >
        <ArrowRight className="w-4 h-4 rotate-180" />
        Back to Sign In
      </Link>
    </AuthShell>
  );
}
