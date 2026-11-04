import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Globe, Check, Clock, Lock, Eye, EyeOff, Building2, Plus, Upload, FileSpreadsheet, AlertCircle, CheckCircle2, KeyRound, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Carrier, StaffMember } from "@shared/schema";
import { useCarrierCredentials, useCreateCarrierCredential, useDeleteCarrierCredential } from "@/hooks/use-carrier-files";
import { EmailAccountSection } from "@/components/EmailSetupModal";

const COMMON_TIMEZONES = [
  { value: "America/St_Johns", label: "Newfoundland (NST/NDT)" },
  { value: "America/Halifax", label: "Atlantic (AST/ADT)" },
  { value: "America/Toronto", label: "Eastern (EST/EDT)" },
  { value: "America/Winnipeg", label: "Central (CST/CDT)" },
  { value: "America/Edmonton", label: "Mountain (MST/MDT)" },
  { value: "America/Vancouver", label: "Pacific (PST/PDT)" },
  { value: "America/New_York", label: "US Eastern (EST/EDT)" },
  { value: "America/Chicago", label: "US Central (CST/CDT)" },
  { value: "America/Denver", label: "US Mountain (MST/MDT)" },
  { value: "America/Los_Angeles", label: "US Pacific (PST/PDT)" },
  { value: "America/Anchorage", label: "Alaska (AKST/AKDT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (CET/CEST)" },
  { value: "Europe/Berlin", label: "Berlin (CET/CEST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST/NZDT)" },
  { value: "UTC", label: "UTC" },
];

export default function SettingsPage() {
  const { isFrench: isFr } = useLanguage();
  const queryClient = useQueryClient();

  const { data: staff } = useQuery<StaffMember>({
    queryKey: ["/api/crm/staff/me"],
  });

  const [selectedTimezone, setSelectedTimezone] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (staff?.timezone) {
      setSelectedTimezone(staff.timezone);
    }
  }, [staff?.timezone]);

  const updateTimezone = useMutation({
    mutationFn: async (timezone: string) => {
      const res = await fetch("/api/crm/staff/me/timezone", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update timezone");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff/me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const currentTime = new Date().toLocaleString("en-US", {
    timeZone: selectedTimezone || "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <AppLayout>
      <div className="space-y-8 max-w-3xl">
        <div>
          <h1 className="text-4xl font-display font-bold text-foreground" data-testid="text-page-title">Settings</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your account and application preferences.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-border bg-background/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">Timezone</h2>
                <p className="text-sm text-slate-500">Set your timezone for calendar events and scheduling.</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {selectedTimezone && (
              <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3">
                <Clock className="w-5 h-5 text-slate-500" />
                <div>
                  <p className="text-sm font-medium">Current time in your timezone</p>
                  <p className="text-lg font-display font-bold" data-testid="text-current-time">{currentTime}</p>
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-500 block mb-2">Select Timezone</label>
              <select
                value={selectedTimezone}
                onChange={e => setSelectedTimezone(e.target.value)}
                data-testid="select-timezone"
                className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-white transition-all appearance-none cursor-pointer"
              >
                <option value="">-- Select timezone --</option>
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.value})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (selectedTimezone) updateTimezone.mutate(selectedTimezone);
                }}
                disabled={updateTimezone.isPending || !selectedTimezone || selectedTimezone === staff?.timezone}
                data-testid="button-save-timezone"
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateTimezone.isPending ? (isFr ? "Enregistrement..." : "Saving...") : (isFr ? "Enregistrer le fuseau" : "Save Timezone")}
              </button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 animate-in fade-in">
                  <Check className="w-4 h-4" />
                  Saved!
                </span>
              )}
            </div>

            {staff?.timezone && (
              <p className="text-xs text-slate-500">
                Currently set to: <span className="font-medium">{staff.timezone}</span>
              </p>
            )}
          </div>
        </div>

        <EmailAccountSection />

        <ChangePasswordSection />

        <MyCarriersSection />

        <CarrierCredentialsSection />

        <CSVImportSection />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: "👤", title: isFr ? "Profil" : "Profile", desc: "Update your personal information.", color: "bg-violet-50 border-violet-100" },
            { icon: "🔔", title: "Notifications", desc: "Configure notification preferences.", color: "bg-amber-50 border-amber-100" },
            { icon: "🎨", title: "Appearance", desc: "Customize theme and display.", color: "bg-purple-50 border-purple-100" },
          ].map(item => (
            <div
              key={item.title}
              data-testid={`card-settings-${item.title.toLowerCase()}`}
              className={`${item.color} rounded-2xl border p-5 opacity-60`}
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="font-display font-bold">{item.title}</h3>
              <p className="text-sm text-slate-500 mt-0.5">{item.desc}</p>
              <span className="inline-block mt-2 text-xs font-medium text-slate-500 bg-white/60 px-2 py-0.5 rounded">Coming Soon</span>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Lock className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Change Password</h2>
            <p className="text-sm text-slate-500">Update your login password.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && (
          <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded-xl" data-testid="text-change-password-error">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 text-emerald-700 text-sm px-4 py-3 rounded-xl flex items-center gap-2" data-testid="text-change-password-success">
            <Check className="w-4 h-4" />
            Password changed successfully!
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-slate-500 block mb-2">Current Password</label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Enter your current password"
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-white transition-all pr-10"
              required
              data-testid="input-current-password"
            />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground" data-testid="button-toggle-current-password">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-500 block mb-2">New Password</label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Enter your new password (min 6 characters)"
              className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-white transition-all pr-10"
              required
              data-testid="input-new-password"
            />
            <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground" data-testid="button-toggle-new-password">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-500 block mb-2">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm your new password"
            className="w-full px-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400 bg-white transition-all"
            required
            data-testid="input-confirm-new-password"
          />
        </div>

        <button
          type="submit"
          disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword}
          data-testid="button-change-password"
          className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {changePassword.isPending ? "Changing..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}

const carrierTypeLabels: Record<string, string> = {
  insurance: "Insurance",
  mutual_fund: "Mutual Fund",
  segregated_fund: "Segregated Fund",
};

function MyCarriersSection() {
  const queryClient = useQueryClient();
  const { data: staff } = useQuery<{ sellsMutualFunds?: boolean }>({ queryKey: ["/api/crm/staff/me"] });
  const { data: allCarriers = [] } = useQuery<Carrier[]>({ queryKey: ["/api/crm/carriers"] });
  const { data: myCarriers = [] } = useQuery<{ id: number; carrierId: number; carrier: Carrier }[]>({ queryKey: ["/api/crm/my-carriers"] });
  const [filterType, setFilterType] = useState<string>("all");
  const sellsMF = staff?.sellsMutualFunds ?? false;

  const myCarrierIds = new Set(myCarriers.map(mc => mc.carrierId));

  const addCarrier = useMutation({
    mutationFn: async (carrierId: number) => {
      await apiRequest("POST", "/api/crm/my-carriers", { carrierId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/my-carriers"] });
    },
  });

  const removeCarrier = useMutation({
    mutationFn: async (carrierId: number) => {
      await apiRequest("DELETE", `/api/crm/my-carriers/${carrierId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/my-carriers"] });
    },
  });

  const availableCarriers = sellsMF ? allCarriers : allCarriers.filter(c => c.type !== "mutual_fund");

  const filteredCarriers = filterType === "all"
    ? availableCarriers
    : availableCarriers.filter(c => c.type === filterType);

  const groupedCarriers = filteredCarriers.reduce<Record<string, Carrier[]>>((acc, c) => {
    if (!acc[c.type]) acc[c.type] = [];
    acc[c.type].push(c);
    return acc;
  }, {});

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg">My Carriers</h2>
            <p className="text-sm text-slate-500">Select which insurance, mutual fund, and segregated fund companies you work with.</p>
          </div>
          <span className="text-sm font-medium text-slate-500">{myCarrierIds.size} selected</span>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-500">Filter:</span>
          {[{ value: "all", label: "All" }, { value: "insurance", label: "Insurance" }, ...(sellsMF ? [{ value: "mutual_fund", label: "Mutual Fund" }] : []), { value: "segregated_fund", label: "Seg Fund" }].map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilterType(opt.value)}
              data-testid={`button-filter-carrier-${opt.value}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filterType === opt.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-slate-500 hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {Object.entries(groupedCarriers).map(([type, carriers]) => (
          <div key={type}>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">
              {carrierTypeLabels[type] || type}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {carriers.map(carrier => {
                const isSelected = myCarrierIds.has(carrier.id);
                return (
                  <button
                    key={carrier.id}
                    onClick={() => {
                      if (isSelected) {
                        removeCarrier.mutate(carrier.id);
                      } else {
                        addCarrier.mutate(carrier.id);
                      }
                    }}
                    disabled={addCarrier.isPending || removeCarrier.isPending}
                    data-testid={`button-carrier-${carrier.id}`}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-white border-border text-slate-500 hover:border-primary/20 hover:text-foreground"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted/50"
                    }`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span className="truncate">{carrier.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const credentialTypeLabels: Record<string, string> = {
  advisor_code: "Advisor Code",
  api_key: "API Key",
  username_password: "Username / Password",
};

function CarrierCredentialsSection() {
  const { data: credentials = [], isLoading } = useCarrierCredentials();
  const { data: myCarriers = [] } = useQuery<{ id: number; carrierId: number; carrier: Carrier }[]>({ queryKey: ["/api/crm/my-carriers"] });
  const createCred = useCreateCarrierCredential();
  const deleteCred = useDeleteCarrierCredential();

  const [showAdd, setShowAdd] = useState(false);
  const [carrierId, setCarrierId] = useState<number>(0);
  const [credType, setCredType] = useState("advisor_code");
  const [label, setLabel] = useState("");
  const [credValue, setCredValue] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleAdd = () => {
    let encryptedCredentials = credValue;
    if (credType === "username_password") {
      encryptedCredentials = JSON.stringify({ username, password });
    }
    createCred.mutate(
      { carrierId, credentialType: credType, label, encryptedCredentials },
      {
        onSuccess: () => {
          setShowAdd(false);
          setCarrierId(0);
          setCredType("advisor_code");
          setLabel("");
          setCredValue("");
          setUsername("");
          setPassword("");
        },
      }
    );
  };

  const carrierMap = new Map(myCarriers.map(mc => [mc.carrierId, mc.carrier]));

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-display font-bold text-lg">Carrier Credentials</h2>
            <p className="text-sm text-slate-500">Store API credentials for carrier file downloads. Demo mode credentials work with all carriers.</p>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            data-testid="button-add-carrier-credential"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Credentials
          </button>
        </div>
      </div>

      <div className="p-6 space-y-3">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map(i => <div key={i} className="h-14 bg-muted/50 rounded-xl" />)}
          </div>
        ) : credentials.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <KeyRound className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No carrier credentials configured yet.</p>
            <p className="text-xs mt-1">Add credentials to enable file downloads from carriers.</p>
          </div>
        ) : (
          credentials.map(cred => {
            const carrier = carrierMap.get(cred.carrierId);
            return (
              <div
                key={cred.id}
                data-testid={`card-carrier-credential-${cred.id}`}
                className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{cred.label}</p>
                    <p className="text-xs text-slate-500">
                      {carrier?.name ?? "Unknown Carrier"} — {credentialTypeLabels[cred.credentialType] ?? cred.credentialType}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cred.isActive ? "bg-emerald-50 text-emerald-700" : "bg-muted text-slate-500"}`}>
                    {cred.isActive ? "Active" : "Inactive"}
                  </span>
                  <button
                    onClick={() => deleteCred.mutate(cred.id)}
                    data-testid={`button-delete-credential-${cred.id}`}
                    className="p-1.5 rounded-lg text-slate-500 opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}

        {showAdd && (
          <div className="p-5 rounded-xl bg-muted/20 border border-primary/20 space-y-4" data-testid="form-add-carrier-credential">
            <h3 className="font-semibold text-sm">Add Carrier Credentials</h3>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Carrier</label>
              <select
                value={carrierId}
                onChange={e => setCarrierId(Number(e.target.value))}
                data-testid="select-credential-carrier"
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              >
                <option value={0}>-- Select carrier --</option>
                {myCarriers.map(mc => (
                  <option key={mc.carrierId} value={mc.carrierId}>
                    {mc.carrier.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Credential Type</label>
              <select
                value={credType}
                onChange={e => setCredType(e.target.value)}
                data-testid="select-credential-type"
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              >
                <option value="advisor_code">Advisor Code</option>
                <option value="api_key">API Key</option>
                <option value="username_password">Username / Password</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Label</label>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. My Manulife advisor portal"
                data-testid="input-credential-label"
                className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
              />
            </div>

            {credType === "username_password" ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Username</label>
                  <input
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="Username"
                    data-testid="input-credential-username"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Password"
                    data-testid="input-credential-password"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">
                  {credType === "advisor_code" ? "Advisor Code" : "API Key"}
                </label>
                <input
                  value={credValue}
                  onChange={e => setCredValue(e.target.value)}
                  placeholder={credType === "advisor_code" ? "Enter your advisor code" : "Enter your API key"}
                  data-testid="input-credential-value"
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setShowAdd(false)}
                data-testid="button-cancel-credential"
                className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={
                  !carrierId || !label ||
                  (credType === "username_password" ? !username || !password : !credValue) ||
                  createCred.isPending
                }
                data-testid="button-save-credential"
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {createCred.isPending ? (isFr ? "Enregistrement..." : "Saving...") : "Save Credential"}
              </button>
            </div>

            {createCred.isError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" data-testid="text-create-credential-error">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Failed to save credential. Please try again.
              </div>
            )}
          </div>
        )}

        {deleteCred.isError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700" data-testid="text-delete-credential-error">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Failed to delete credential. Please try again.
          </div>
        )}
      </div>
    </div>
  );
}

function CSVImportSection() {
  const queryClient = useQueryClient();
  const { data: _allClients = [] } = useQuery<{ id: number; firstName: string; lastName: string }[]>({ queryKey: ["/api/crm/clients"] });
  const [_csvText, setCsvText] = useState("");
  const [parsedRows, setParsedRows] = useState<{ clientName: string; type: string; provider: string; policyNumber: string; value: string; status: string }[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importResult, setImportResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const importMutation = useMutation({
    mutationFn: async (rows: typeof parsedRows) => {
      const res = await apiRequest("POST", "/api/crm/products/import", {
        rows: rows.map(r => ({
          clientName: r.clientName,
          type: r.type,
          provider: r.provider,
          policyNumber: r.policyNumber,
          value: r.value,
          status: r.status || "active",
        })),
      });
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["/api/crm/clients"] });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parseCSV(text);
    };
    reader.readAsText(file);
  };

  const splitCSVLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = "";
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) {
      setParseErrors(["CSV must have a header row and at least one data row"]);
      setParsedRows([]);
      setStep("upload");
      return;
    }

    const header = splitCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ""));
    const requiredCols = ["client", "type", "provider", "policy_number", "value"];
    const missing = requiredCols.filter(c => !header.includes(c));
    if (missing.length > 0) {
      setParseErrors([`Missing required columns: ${missing.join(", ")}. Required: client, type, provider, policy_number, value, status (optional)`]);
      setParsedRows([]);
      setStep("upload");
      return;
    }

    const errors: string[] = [];
    const rows: typeof parsedRows = [];
    const validTypes = ["insurance", "mutual_fund", "segregated_fund"];
    const validStatuses = ["active", "pending", "closed"];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = splitCSVLine(line);
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      if (!row.client) { errors.push(`Row ${i}: missing client name`); continue; }
      if (!row.type || !validTypes.includes(row.type)) { errors.push(`Row ${i}: invalid type "${row.type}" (must be insurance, mutual_fund, or segregated_fund)`); continue; }
      if (!row.provider) { errors.push(`Row ${i}: missing provider`); continue; }
      if (!row.policy_number) { errors.push(`Row ${i}: missing policy_number`); continue; }
      if (!row.value || isNaN(parseFloat(row.value))) { errors.push(`Row ${i}: invalid value "${row.value}"`); continue; }
      const status = row.status || "active";
      if (!validStatuses.includes(status)) { errors.push(`Row ${i}: invalid status "${status}" (must be active, pending, or closed)`); continue; }

      rows.push({
        clientName: row.client,
        type: row.type,
        provider: row.provider,
        policyNumber: row.policy_number,
        value: row.value,
        status,
      });
    }

    setParseErrors(errors);
    setParsedRows(rows);
    if (rows.length > 0) setStep("preview");
  };

  const reset = () => {
    setCsvText("");
    setParsedRows([]);
    setParseErrors([]);
    setImportResult(null);
    setStep("upload");
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-background/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-display font-bold text-lg">Import Products (CSV)</h2>
            <p className="text-sm text-slate-500">Bulk import insurance, mutual fund, and seg fund products from a CSV file.</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/30 transition-colors">
              <Upload className="w-10 h-10 mx-auto text-slate-500/40 mb-3" />
              <p className="text-sm font-medium mb-1">Drop your CSV file here or click to browse</p>
              <p className="text-xs text-slate-500 mb-4">Required columns: client, type, provider, policy_number, value, status (optional)</p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                data-testid="input-csv-file"
                className="block mx-auto text-sm"
              />
            </div>

            <div className="bg-muted/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-slate-500 mb-2">Example CSV format:</p>
              <pre className="text-xs text-slate-500 font-mono whitespace-pre-wrap">client,type,provider,policy_number,value,status
John Smith,insurance,Manulife,POL-12345,50000.00,active
Jane Doe,mutual_fund,Fidelity Investments Canada,ACC-67890,125000.50,active</pre>
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-destructive/10 rounded-xl p-4 space-y-1">
                {parseErrors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{parsedRows.length} valid row{parsedRows.length !== 1 ? "s" : ""} ready to import</p>
              <div className="flex gap-2">
                <button onClick={reset} data-testid="button-csv-cancel" className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 hover:bg-muted transition-colors">Cancel</button>
                <button
                  onClick={() => importMutation.mutate(parsedRows)}
                  disabled={importMutation.isPending}
                  data-testid="button-csv-confirm"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  {importMutation.isPending ? "Importing..." : "Confirm Import"}
                </button>
              </div>
            </div>

            {parseErrors.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 space-y-1">
                <p className="text-xs font-semibold text-amber-700">{parseErrors.length} row{parseErrors.length !== 1 ? "s" : ""} skipped:</p>
                {parseErrors.slice(0, 5).map((err, i) => (
                  <p key={i} className="text-xs text-amber-600">{err}</p>
                ))}
                {parseErrors.length > 5 && <p className="text-xs text-amber-600">...and {parseErrors.length - 5} more</p>}
              </div>
            )}

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm" data-testid="table-csv-preview">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">#</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Client</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Type</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Provider</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Policy #</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Value</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.slice(0, 20).map((row, i) => (
                    <tr key={i} className="border-b border-border last:border-0" data-testid={`row-csv-preview-${i}`}>
                      <td className="px-3 py-2 text-slate-500">{i + 1}</td>
                      <td className="px-3 py-2 font-medium">{row.clientName}</td>
                      <td className="px-3 py-2 capitalize">{row.type.replace("_", " ")}</td>
                      <td className="px-3 py-2">{row.provider}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.policyNumber}</td>
                      <td className="px-3 py-2">${parseFloat(row.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 capitalize">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {parsedRows.length > 20 && (
                <p className="text-xs text-slate-500 text-center py-2">Showing first 20 of {parsedRows.length} rows</p>
              )}
            </div>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-emerald-50 rounded-xl p-4">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <div>
                <p className="font-semibold text-emerald-800">Import Complete</p>
                <p className="text-sm text-emerald-700">{importResult.imported} product{importResult.imported !== 1 ? "s" : ""} imported successfully.</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-4 space-y-1">
                <p className="text-sm font-semibold text-amber-700">{importResult.errors.length} row{importResult.errors.length !== 1 ? "s" : ""} had errors:</p>
                {importResult.errors.map((err, i) => (
                  <p key={i} className="text-xs text-amber-600">Row {err.row}: {err.message}</p>
                ))}
              </div>
            )}

            <button onClick={reset} data-testid="button-csv-new-import" className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
