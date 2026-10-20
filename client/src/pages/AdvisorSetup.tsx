/**
 * AdvisorSetup — Account, billing & subscription management for advisor accounts.
 *
 * Three sections:
 *   1. Account Info   — edit name, email, firm name, jurisdiction
 *   2. Payment Info   — link to Stripe customer portal to update card
 *   3. Subscription   — current tier, pause / cancel with confirmation
 */
import React, { useState, useEffect } from "react";
import {
  User, Mail, Building2, MapPin, CreditCard,
  CheckCircle, AlertCircle, Loader2, ExternalLink,
  PauseCircle, XCircle, RefreshCw, ChevronDown,
} from "lucide-react";
import { useAuth } from "../lib/auth";

// ── Types ─────────────────────────────────────────────────────────────────────
interface AccountForm {
  firstName: string;
  lastName: string;
  email: string;
  firmName: string;
  jurisdiction: "CA" | "US";
  province: string;
}

type SaveState = "idle" | "saving" | "saved" | "error";
type ConfirmAction = "pause" | "cancel" | null;

// ── Canadian provinces ────────────────────────────────────────────────────────
const CA_PROVINCES = [
  { value: "AB", label: "Alberta" },
  { value: "BC", label: "British Columbia" },
  { value: "MB", label: "Manitoba" },
  { value: "NB", label: "New Brunswick" },
  { value: "NL", label: "Newfoundland & Labrador" },
  { value: "NS", label: "Nova Scotia" },
  { value: "NT", label: "Northwest Territories" },
  { value: "NU", label: "Nunavut" },
  { value: "ON", label: "Ontario" },
  { value: "PE", label: "Prince Edward Island" },
  { value: "QC", label: "Québec" },
  { value: "SK", label: "Saskatchewan" },
  { value: "YT", label: "Yukon" },
];

const US_STATES = [
  { value: "AL", label: "Alabama" }, { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" }, { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" }, { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" }, { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" }, { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" }, { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" }, { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" }, { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" }, { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" }, { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" }, { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" }, { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" }, { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" }, { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" }, { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" }, { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" }, { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" }, { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" }, { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" }, { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" }, { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" }, { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" }, { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" }, { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" }, { value: "WY", label: "Wyoming" },
];

// ── AdvisorSetup ──────────────────────────────────────────────────────────────
export function AdvisorSetup() {
  const { user, accessToken, refresh } = useAuth();

  // ── Account form state ──
  const [form, setForm] = useState<AccountForm>({
    firstName:    (user as any)?.firstName  ?? "",
    lastName:     (user as any)?.lastName   ?? "",
    email:        (user as any)?.email      ?? "",
    firmName:     (user as any)?.firmName   ?? "",
    jurisdiction: (user as any)?.jurisdiction ?? "CA",
    province:     (user as any)?.province   ?? "",
  });
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState("");

  // ── Subscription state ──
  const [subStatus, setSubStatus] = useState<string>(
    (user as any)?.subscriptionStatus ?? "trialing"
  );
  const [subTier, setSubTier] = useState<string>(
    (user as any)?.subscriptionTier ?? "trial"
  );
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [subLoading, setSubLoading] = useState(false);
  const [subMessage, setSubMessage] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);

  // Sync user → form when user object changes after refresh
  useEffect(() => {
    if (!user) return;
    const u = user as any;
    setForm({
      firstName:    u.firstName    ?? "",
      lastName:     u.lastName     ?? "",
      email:        u.email        ?? "",
      firmName:     u.firmName     ?? "",
      jurisdiction: u.jurisdiction ?? "CA",
      province:     u.province     ?? "",
    });
    setSubStatus(u.subscriptionStatus ?? "trialing");
    setSubTier(u.subscriptionTier ?? "trial");
  }, [user]);

  const regionOptions = form.jurisdiction === "CA" ? CA_PROVINCES : US_STATES;
  const regionLabel   = form.jurisdiction === "CA" ? "Province" : "State";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleField = (field: keyof AccountForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (saveState !== "idle") setSaveState("idle");
  };

  const handleJurisdictionChange = (jur: "CA" | "US") => {
    setForm(prev => ({ ...prev, jurisdiction: jur, province: "" }));
    if (saveState !== "idle") setSaveState("idle");
  };

  const handleSaveAccount = async () => {
    if (!accessToken) return;
    setSaveState("saving");
    setSaveError("");
    try {
      const res = await fetch("/api/auth/me", {
        method:  "PATCH",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          firstName:    form.firstName,
          lastName:     form.lastName,
          firmName:     form.firmName || null,
          jurisdiction: form.jurisdiction,
          province:     form.province || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? `HTTP ${res.status}`);
      }
      await refresh?.();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 3000);
    } catch (e: any) {
      setSaveError(e.message ?? "Failed to save");
      setSaveState("error");
    }
  };

  const handleOpenPortal = async () => {
    if (!accessToken) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/subscriptions/portal", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Could not open billing portal");
      const { url } = await res.json();
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      setSubMessage("Could not open billing portal. Please contact support.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubAction = async (action: "pause" | "cancel") => {
    if (!accessToken) return;
    setSubLoading(true);
    setSubMessage("");
    try {
      const endpoint =
        action === "pause"
          ? "/api/subscriptions/pause"
          : "/api/subscriptions/cancel";
      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setSubStatus(action === "pause" ? "paused" : "canceled");
      setSubMessage(
        action === "pause"
          ? "Your subscription has been paused. You can resume it any time."
          : "Your subscription has been cancelled. Access continues until the end of your billing period."
      );
      setConfirmAction(null);
      await refresh?.();
    } catch (e: any) {
      setSubMessage(e.message ?? "An error occurred. Please try again.");
      setConfirmAction(null);
    } finally {
      setSubLoading(false);
    }
  };

  const handleResume = async () => {
    if (!accessToken) return;
    setSubLoading(true);
    setSubMessage("");
    try {
      const res = await fetch("/api/subscriptions/resume", {
        method:  "POST",
        headers: { "Authorization": `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error("Could not resume subscription");
      setSubStatus("active");
      setSubMessage("Your subscription has been resumed.");
      await refresh?.();
    } catch (e: any) {
      setSubMessage(e.message ?? "An error occurred.");
    } finally {
      setSubLoading(false);
    }
  };

  // ── Tier display ─────────────────────────────────────────────────────────
  const tierLabel = (() => {
    if (subTier === "advisor") return "Compass Advisor";
    if (subTier === "advisor_pro") return "Compass Advisor Pro";
    if (subTier === "trial") return "Trial";
    return subTier ?? "Unknown";
  })();

  const statusColor = (() => {
    if (subStatus === "active")   return "text-emerald-400";
    if (subStatus === "trialing") return "text-violet-400";
    if (subStatus === "paused")   return "text-amber-400";
    if (subStatus === "canceled") return "text-red-400";
    return "text-white/40";
  })();

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="flex-1 min-h-screen overflow-y-auto"
      style={{ background: "#0f0a1e" }}
    >
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Setup</h1>
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            Manage your account, billing, and subscription.
          </p>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 1 — Account Info
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<User className="w-4 h-4" />} title="Account Info" />
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="First Name"
                value={form.firstName}
                onChange={v => handleField("firstName", v)}
              />
              <Field
                label="Last Name"
                value={form.lastName}
                onChange={v => handleField("lastName", v)}
              />
            </div>

            {/* Email — read-only (changing email requires verification) */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Email
              </label>
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.35)",
                }}
              >
                <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{form.email}</span>
                <span
                  className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  Contact support to change
                </span>
              </div>
            </div>

            <Field
              label="Firm / Organization"
              value={form.firmName}
              placeholder="e.g. Apex Wealth Management"
              onChange={v => handleField("firmName", v)}
              icon={<Building2 className="w-3.5 h-3.5" />}
            />

            {/* Jurisdiction */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                Jurisdiction
              </label>
              <div className="flex gap-2">
                {(["CA", "US"] as const).map(jur => (
                  <button
                    key={jur}
                    onClick={() => handleJurisdictionChange(jur)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-all"
                    style={
                      form.jurisdiction === jur
                        ? {
                            background: "rgba(124,58,237,0.2)",
                            border: "1px solid rgba(124,58,237,0.4)",
                            color: "#a78bfa",
                          }
                        : {
                            background: "rgba(255,255,255,0.04)",
                            border: "1px solid rgba(255,255,255,0.08)",
                            color: "rgba(255,255,255,0.4)",
                          }
                    }
                  >
                    {jur === "CA" ? "🇨🇦 Canada" : "🇺🇸 United States"}
                  </button>
                ))}
              </div>
            </div>

            {/* Province / State */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
                {regionLabel}
              </label>
              <div className="relative">
                <select
                  value={form.province}
                  onChange={e => handleField("province", e.target.value)}
                  className="w-full appearance-none px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: form.province ? "#fff" : "rgba(255,255,255,0.3)",
                  }}
                >
                  <option value="">Select {regionLabel}…</option>
                  {regionOptions.map(o => (
                    <option key={o.value} value={o.value} style={{ background: "#1e1040" }}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                />
              </div>
            </div>

            {/* Save button */}
            <div className="flex items-center justify-between pt-1">
              {saveState === "saved" && (
                <div className="flex items-center gap-1.5 text-emerald-400 text-xs">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Saved successfully
                </div>
              )}
              {saveState === "error" && (
                <div className="flex items-center gap-1.5 text-red-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" />
                  {saveError || "Failed to save"}
                </div>
              )}
              {(saveState === "idle" || saveState === "saving") && <div />}

              <button
                onClick={handleSaveAccount}
                disabled={saveState === "saving"}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                style={{
                  background: saveState === "saving"
                    ? "rgba(124,58,237,0.3)"
                    : "linear-gradient(135deg, #2d1b69 0%, #7c3aed 100%)",
                  color: "#fff",
                  opacity: saveState === "saving" ? 0.7 : 1,
                }}
              >
                {saveState === "saving" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {saveState === "saving" ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 2 — Payment Info
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<CreditCard className="w-4 h-4" />} title="Payment Info" />
          <Card>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>
              Payment details are managed securely through Stripe. Click below to
              open the billing portal where you can update your payment method,
              view invoices, and manage billing details.
            </p>
            <button
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="mt-2 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border:     "1px solid rgba(255,255,255,0.12)",
                color:      portalLoading ? "rgba(255,255,255,0.35)" : "#fff",
              }}
              onMouseEnter={e => {
                if (!portalLoading)
                  (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.1)";
              }}
              onMouseLeave={e =>
                ((e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)")
              }
            >
              {portalLoading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <ExternalLink className="w-4 h-4" />}
              {portalLoading ? "Opening…" : "Open Billing Portal"}
            </button>
          </Card>
        </section>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 3 — Subscription
        ══════════════════════════════════════════════════════════════ */}
        <section>
          <SectionHeader icon={<RefreshCw className="w-4 h-4" />} title="Subscription" />
          <Card>
            {/* Current plan */}
            <div
              className="flex items-center justify-between p-4 rounded-lg"
              style={{
                background: "rgba(124,58,237,0.08)",
                border: "1px solid rgba(124,58,237,0.2)",
              }}
            >
              <div>
                <div className="text-white font-semibold text-sm">{tierLabel}</div>
                <div className={`text-xs mt-0.5 capitalize ${statusColor}`}>
                  {subStatus === "trialing" ? "Trial period active" : subStatus}
                </div>
              </div>
              <div
                className="text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{
                  background: subStatus === "active" || subStatus === "trialing"
                    ? "rgba(52,211,153,0.15)"
                    : "rgba(255,255,255,0.06)",
                  color: subStatus === "active" || subStatus === "trialing"
                    ? "#34d399"
                    : "rgba(255,255,255,0.4)",
                }}
              >
                {subStatus === "active" ? "Active" :
                 subStatus === "trialing" ? "Trial" :
                 subStatus === "paused"   ? "Paused" :
                 subStatus === "canceled" ? "Cancelled" : subStatus}
              </div>
            </div>

            {/* Status message */}
            {subMessage && (
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-sm"
                style={{
                  background: subMessage.includes("error") || subMessage.includes("Could not")
                    ? "rgba(239,68,68,0.08)"
                    : "rgba(52,211,153,0.08)",
                  border: subMessage.includes("error") || subMessage.includes("Could not")
                    ? "1px solid rgba(239,68,68,0.2)"
                    : "1px solid rgba(52,211,153,0.2)",
                  color: subMessage.includes("error") || subMessage.includes("Could not")
                    ? "#f87171"
                    : "#34d399",
                }}
              >
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{subMessage}</span>
              </div>
            )}

            {/* Confirm dialog */}
            {confirmAction && (
              <ConfirmBox
                action={confirmAction}
                loading={subLoading}
                onConfirm={() => handleSubAction(confirmAction)}
                onCancel={() => setConfirmAction(null)}
              />
            )}

            {/* Action buttons */}
            {!confirmAction && (
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                {subStatus === "paused" ? (
                  <ActionButton
                    icon={<RefreshCw className="w-3.5 h-3.5" />}
                    label="Resume Subscription"
                    loading={subLoading}
                    color="emerald"
                    onClick={handleResume}
                  />
                ) : subStatus !== "canceled" ? (
                  <>
                    <ActionButton
                      icon={<PauseCircle className="w-3.5 h-3.5" />}
                      label="Pause Subscription"
                      loading={subLoading}
                      color="amber"
                      onClick={() => setConfirmAction("pause")}
                    />
                    <ActionButton
                      icon={<XCircle className="w-3.5 h-3.5" />}
                      label="Cancel Subscription"
                      loading={subLoading}
                      color="red"
                      onClick={() => setConfirmAction("cancel")}
                    />
                  </>
                ) : (
                  <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Your subscription has been cancelled. Contact support to reactivate.
                  </p>
                )}
              </div>
            )}
          </Card>
        </section>

        {/* Bottom padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span style={{ color: "#a78bfa" }}>{icon}</span>
      <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: "#a78bfa" }}>
        {title}
      </h2>
      <div className="flex-1 h-px ml-1" style={{ background: "rgba(167,139,250,0.15)" }} />
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{
        background: "rgba(255,255,255,0.035)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: "rgba(255,255,255,0.5)" }}>
        {label}
      </label>
      <div className="relative">
        {icon && (
          <div
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: "rgba(255,255,255,0.25)" }}
          >
            {icon}
          </div>
        )}
        <input
          type="text"
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-white/25 focus:outline-none transition-colors"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            paddingLeft: icon ? "2rem" : undefined,
          }}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
          onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)")}
        />
      </div>
    </div>
  );
}

function ConfirmBox({
  action,
  loading,
  onConfirm,
  onCancel,
}: {
  action: "pause" | "cancel";
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isPause = action === "pause";
  return (
    <div
      className="rounded-lg p-4 space-y-3"
      style={{
        background: isPause ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)",
        border: `1px solid ${isPause ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)"}`,
      }}
    >
      <p className="text-sm font-semibold text-white">
        {isPause ? "Pause your subscription?" : "Cancel your subscription?"}
      </p>
      <p className="text-xs" style={{ color: "rgba(255,255,255,0.45)" }}>
        {isPause
          ? "Your plan will be paused. You can resume it at any time and your data will be preserved."
          : "Your subscription will be cancelled at the end of the current billing period. All data will be retained for 90 days."}
      </p>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all"
          style={{
            background: isPause ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
            color:      isPause ? "#fbbf24" : "#f87171",
            border:     `1px solid ${isPause ? "rgba(245,158,11,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}
        >
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {loading ? "Processing…" : `Confirm ${isPause ? "Pause" : "Cancel"}`}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.5)",
          }}
        >
          Keep Subscription
        </button>
      </div>
    </div>
  );
}

function ActionButton({
  icon,
  label,
  loading,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  loading: boolean;
  color: "amber" | "red" | "emerald";
  onClick: () => void;
}) {
  const colorMap = {
    amber:   { bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.2)",  text: "#fbbf24" },
    red:     { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.2)",   text: "#f87171" },
    emerald: { bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)",  text: "#34d399" },
  }[color];

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: colorMap.bg,
        border: `1px solid ${colorMap.border}`,
        color: loading ? "rgba(255,255,255,0.3)" : colorMap.text,
      }}
    >
      {icon}
      {label}
    </button>
  );
}
