/**
 * client/src/components/ChangePasswordModal.tsx
 *
 * Password change / force-reset modal extracted from App.tsx.
 */

import { useState } from "react";
import { Check, X, Eye, EyeOff } from "lucide-react";
import { api, token } from "../lib/api";

interface Props {
  onClose: () => void;
  forceReset?: boolean;
}

export function ChangePasswordModal({ onClose, forceReset = false }: Props) {
  const [form, setForm]     = useState({ current: "", next: "", confirm: "", securityQuestion: "", securityAnswer: "" });
  const [showCur, setShowCur] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState(false);

  const rules = [
    { label: "At least 8 characters",          ok: form.next.length >= 8 },
    { label: "At least one uppercase letter",  ok: /[A-Z]/.test(form.next) },
    { label: "At least one lowercase letter",  ok: /[a-z]/.test(form.next) },
    { label: "At least one number",            ok: /\d/.test(form.next) },
    { label: "At least one special character", ok: /[^A-Za-z0-9]/.test(form.next) },
  ];
  const pwOk  = rules.every(r => r.ok);
  const match = form.next === form.confirm && form.confirm.length > 0;

  async function save() {
    if (!pwOk)  return setError("Password does not meet requirements.");
    if (!match) return setError("Passwords do not match.");
    setError(""); setBusy(true);
    try {
      const res = forceReset
        ? await api.post<any>("/api/auth/force-reset-password", {
            newPassword:      form.next,
            securityQuestion: form.securityQuestion || undefined,
            securityAnswer:   form.securityAnswer   || undefined,
          })
        : await api.post<any>("/api/auth/change-password", {
            currentPassword:  form.current,
            newPassword:      form.next,
            securityQuestion: form.securityQuestion || undefined,
            securityAnswer:   form.securityAnswer   || undefined,
          });
      if (res?.token) token.set(res.token);
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  }

  const INPUT = "fp-input pr-11";

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-7 overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">Change Password</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        {success ? (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6 text-emerald-600" />
            </div>
            <p className="font-semibold text-emerald-700">Password changed successfully!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Current password — hidden on force reset */}
            {!forceReset && (
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCur ? "text" : "password"}
                    value={form.current}
                    onChange={e => setForm(f => ({ ...f, current: e.target.value }))}
                    placeholder="Enter current password"
                    className={INPUT}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCur(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCur ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={form.next}
                  onChange={e => setForm(f => ({ ...f, next: e.target.value }))}
                  placeholder="Enter new password"
                  className={INPUT}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.next && (
                <div className="mt-2 grid grid-cols-1 gap-1">
                  {rules.map(r => (
                    <div key={r.label} className="flex items-center gap-1.5">
                      {r.ok
                        ? <Check className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                        : <X className="w-3 h-3 text-gray-300 flex-shrink-0" />}
                      <span className={`text-xs ${r.ok ? "text-emerald-600" : "text-gray-400"}`}>{r.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirm */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Confirm new password"
                className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30 focus:border-cyan-500 ${
                  form.confirm && !match ? "border-red-300" : "border-gray-200"
                }`}
              />
              {form.confirm && !match && <p className="text-xs text-red-500 mt-1">Passwords do not match</p>}
              {form.confirm &&  match && <p className="text-xs text-emerald-600 mt-1">✓ Passwords match</p>}
            </div>

            {/* Security Question */}
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-500 mb-2">
                {forceReset
                  ? "Set your security question (required for password recovery)"
                  : "Update security question (optional)"}
              </p>
              <div className="space-y-2">
                <select
                  value={form.securityQuestion}
                  onChange={e => setForm(f => ({ ...f, securityQuestion: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                >
                  <option value="">Select a security question...</option>
                  <option value="What was the name of your first pet?">What was the name of your first pet?</option>
                  <option value="What was the name of your elementary school?">What was the name of your elementary school?</option>
                  <option value="What is your mother's maiden name?">{"What is your mother's maiden name?"}</option>
                  <option value="What city were you born in?">What city were you born in?</option>
                  <option value="What was the make of your first car?">What was the make of your first car?</option>
                  <option value="What is the name of your childhood best friend?">What is the name of your childhood best friend?</option>
                </select>
                {form.securityQuestion && (
                  <input
                    type="text"
                    value={form.securityAnswer}
                    onChange={e => setForm(f => ({ ...f, securityAnswer: e.target.value }))}
                    placeholder="Your answer"
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  />
                )}
              </div>
            </div>

            {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 text-sm text-gray-500 border border-gray-200 py-2.5 rounded-xl hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={busy || !pwOk || !match || (!forceReset && !form.current)}
                className="flex-1 bg-[#0c1e3a] hover:bg-[#0e2a4a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl"
              >
                {busy ? "Saving…" : "Change Password"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
