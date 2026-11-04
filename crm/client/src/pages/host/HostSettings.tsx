import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useHostUser } from "@/hooks/use-host";
import { HostLayout } from "@/components/HostLayout";
import {
  Lock,
  Eye,
  EyeOff,
  Check,
  User,
  Shield,
  Pencil,
  X,
  Save,
} from "lucide-react";

export default function HostSettings() {
  const { isFrench: isFr } = useLanguage();
  return (
    <HostLayout>
      <div className="space-y-8">
        <div>
          <h1
            className="text-3xl font-display font-bold"
            data-testid="text-host-settings-title"
          >
            Settings
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage your account and preferences.
          </p>
        </div>

        <div className="grid gap-6 max-w-2xl">
          <ProfileSection />
          <ChangePasswordSection />
        </div>
      </div>
    </HostLayout>
  );
}

function ProfileSection() {
  const { user } = useAuth();
  const { data: hostUser } = useHostUser();
  const roles = (hostUser?.roles as string[]) ?? [];
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const startEditing = () => {
    setFirstName(hostUser?.firstName ?? user?.firstName ?? "");
    setLastName(hostUser?.lastName ?? user?.lastName ?? "");
    setPhone((hostUser as Record<string, string | null>)?.phone ?? "");
    setError("");
    setSuccess(false);
    setEditing(true);
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/crm/host/me", {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/crm/host/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/auth/user"] });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update profile");
    },
  });

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-background/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <User className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">Edit Profile</h2>
                <p className="text-sm text-muted-foreground">
                  Update your account information.
                </p>
              </div>
            </div>
            <button
              onClick={() => setEditing(false)}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
              data-testid="button-cancel-edit-profile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {error && (
            <div
              className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl"
              data-testid="text-profile-edit-error"
            >
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                First Name
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all"
                data-testid="input-host-profile-firstname"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground block mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all"
                data-testid="input-host-profile-lastname"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground block mb-2">
              Phone
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all"
              data-testid="input-host-profile-phone"
            />
          </div>
          <button
            onClick={() => updateProfile.mutate()}
            disabled={
              updateProfile.isPending || !firstName.trim() || !lastName.trim()
            }
            data-testid="button-save-profile"
            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {updateProfile.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <User className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Profile</h2>
              <p className="text-sm text-muted-foreground">
                Your account information.
              </p>
            </div>
          </div>
          <button
            onClick={startEditing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition-colors"
            data-testid="button-edit-profile"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {success && (
          <div
            className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2"
            data-testid="text-profile-save-success"
          >
            <Check className="w-4 h-4" />
            Profile updated successfully!
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Name
            </p>
            <p
              className="text-sm font-semibold"
              data-testid="text-host-profile-name"
            >
              {hostUser?.firstName ?? user?.firstName}{" "}
              {hostUser?.lastName ?? user?.lastName}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Email
            </p>
            <p className="text-sm" data-testid="text-host-profile-email">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Phone
            </p>
            <p className="text-sm" data-testid="text-host-profile-phone">
              {(hostUser as Record<string, string | null>)?.phone || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
              Roles
            </p>
            <div className="flex gap-2" data-testid="text-host-profile-roles">
              {roles.map((r) => (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full"
                >
                  <Shield className="w-3 h-3" />
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const changePassword = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to change password");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    changePassword.mutate();
  };

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Change Password</h2>
            <p className="text-sm text-muted-foreground">
              Update your login password.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div
            className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl"
            data-testid="text-host-change-password-error"
          >
            {error}
          </div>
        )}
        {success && (
          <div
            className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2"
            data-testid="text-host-change-password-success"
          >
            <Check className="w-4 h-4" />
            Password changed successfully!
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">
            Current Password
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all pr-10"
              required
              data-testid="input-host-current-password"
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-host-current-password"
            >
              {showCurrent ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter your new password (min 6 characters)"
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all pr-10"
              required
              data-testid="input-host-new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-host-new-password"
            >
              {showNew ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-muted-foreground block mb-2">
            Confirm New Password
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white transition-all"
            required
            data-testid="input-host-confirm-new-password"
          />
        </div>

        <button
          type="submit"
          disabled={
            changePassword.isPending ||
            !currentPassword ||
            !newPassword ||
            !confirmPassword
          }
          data-testid="button-host-change-password"
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {changePassword.isPending ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}

