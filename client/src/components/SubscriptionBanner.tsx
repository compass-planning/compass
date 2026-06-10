/**
 * SubscriptionBanner.tsx
 * Displays an inline banner when the user is on a trial or has a billing issue.
 * Render near the top of the main app shell.
 */

import { useState, useEffect } from "react";
import { AlertTriangle, X, Zap, Clock } from "lucide-react";
import { api } from "../lib/api";

interface SubStatus {
  subscriptionTier: string;
  subscriptionStatus: string;
  trialActive: boolean;
  trialDaysLeft: number;
  currentPeriodEnd: string | null;
}

interface Props {
  onUpgrade: () => void;
}

export function SubscriptionBanner({ onUpgrade }: Props) {
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get<SubStatus>("/api/subscription")
      .then(setSub)
      .catch(() => {});
  }, []);

  if (!sub || dismissed) return null;

  // Active paid subscription — no banner
  if (sub.subscriptionStatus === "active") return null;

  // Trial
  if (sub.subscriptionStatus === "trialing") {
    const urgent = sub.trialDaysLeft <= 3;
    return (
      <div className={`relative flex items-center gap-3 px-4 py-2.5 text-sm ${
        urgent ? "bg-amber-500/10 border-b border-amber-500/20 text-amber-300" : "bg-violet-500/10 border-b border-violet-500/20 text-blue-300"
      }`}>
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          {urgent
            ? `Your free trial expires in ${sub.trialDaysLeft} day${sub.trialDaysLeft !== 1 ? "s" : ""}. Subscribe now to keep access.`
            : `Free trial · ${sub.trialDaysLeft} day${sub.trialDaysLeft !== 1 ? "s" : ""} remaining.`}
        </span>
        <button
          onClick={onUpgrade}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
            urgent
              ? "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300"
              : "bg-violet-500/20 hover:bg-violet-500/30 text-blue-300"
          }`}
        >
          <Zap className="w-3 h-3" />
          Upgrade
        </button>
        <button onClick={() => setDismissed(true)} className="text-current opacity-40 hover:opacity-70">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Past due
  if (sub.subscriptionStatus === "past_due") {
    return (
      <div className="relative flex items-center gap-3 px-4 py-2.5 text-sm bg-red-500/10 border-b border-red-500/20 text-red-300">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          Your last payment failed. Please update your billing to avoid losing access.
        </span>
        <button
          onClick={onUpgrade}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 hover:bg-red-500/30 text-red-300 transition-colors"
        >
          Update billing
        </button>
      </div>
    );
  }

  return null;
}
