/**
 * SubscriptionModal.tsx
 * In-app upgrade / billing management modal.
 * Shown when user clicks "Upgrade" in the banner or from account settings.
 */

import { useState } from "react";
import { Check, X, Loader2, Zap, ExternalLink } from "lucide-react";
import { api } from "../lib/api";

interface Props {
  onClose: () => void;
  currentStatus?: string;
}

const PLANS = [
  {
    id: "monthly" as const,
    name: "Monthly",
    price: "$14.99",
    period: "/ month",
    features: ["Unlimited clients", "All planning modules", "AI reports", "Priority support", "Cancel anytime"],
  },
  {
    id: "annual" as const,
    name: "Annual",
    price: "$149.99",
    period: "/ year",
    badge: "Save 17%",
    features: ["Everything in Monthly", "2 months free", "Early feature access", "Onboarding call"],
    highlight: true,
  },
];

export function SubscriptionModal({ onClose, currentStatus }: Props) {
  const [loading, setLoading] = useState<"monthly" | "annual" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isActive = currentStatus === "active";

  async function handleSubscribe(_tier: "monthly" | "annual") {
    // Stripe not yet active — show coming soon
    setError("Online payments are coming soon. Please contact support@compassplanning.app to subscribe.");
  }

  async function handlePortal() {
    setError("Billing portal coming soon.");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-violet-500/10 rounded-full mb-3">
              <Zap className="w-6 h-6 text-violet-400" />
            </div>
            <h2 className="text-2xl font-bold text-white">
              {isActive ? "Manage Subscription" : "Unlock Full Access"}
            </h2>
            <p className="text-slate-400 mt-1">
              {isActive ? "Update your plan or billing details." : "Choose a plan to keep your practice running."}
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
              {error}
            </div>
          )}

          {/* If already subscribed, show portal link */}
          {isActive ? (
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-4">
                Manage your subscription, update billing, or cancel via the Stripe customer portal.
              </p>
              <button
                onClick={handlePortal}
                disabled={loading === "portal"}
                className="flex items-center justify-center gap-2 mx-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-400 hover:from-violet-500 hover:to-purple-400 disabled:opacity-50 text-white font-semibold rounded-xl transition-all"
              >
                {loading === "portal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Open Billing Portal
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PLANS.map(plan => (
                <div
                  key={plan.id}
                  className={`relative rounded-xl border p-5 ${
                    plan.highlight
                      ? "border-violet-400/40 bg-violet-500/5"
                      : "border-white/10 bg-white/3"
                  }`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-3 py-1 bg-violet-500 text-white text-xs font-bold rounded-full">Best Value</span>
                    </div>
                  )}
                  {plan.badge && !plan.highlight && (
                    <div className="absolute -top-3 right-3">
                      <span className="px-2 py-0.5 bg-emerald-500 text-white text-xs font-bold rounded-full">{plan.badge}</span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-white font-bold">{plan.name}</h3>
                    <div className="mt-1">
                      <span className="text-2xl font-extrabold text-white">{plan.price}</span>
                      <span className="text-slate-400 text-sm ml-1">{plan.period}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                        <Check className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={!!loading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 ${
                      plan.highlight
                        ? "bg-gradient-to-r from-violet-600 to-purple-400 hover:from-violet-500 hover:to-purple-400 text-white shadow-lg shadow-violet-500/20"
                        : "bg-white/10 hover:bg-white/15 text-white"
                    }`}
                  >
                    {loading === plan.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    {loading === plan.id ? "Redirecting..." : `Subscribe ${plan.name}`}
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-center text-slate-500 text-xs mt-6">
            Payments are processed securely by Stripe. You can cancel any time.
          </p>
        </div>
      </div>
    </div>
  );
}
