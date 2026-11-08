import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Mail, ArrowRight, X, Loader2, CheckCircle2, AlertCircle, Server, Shield } from "lucide-react";
import { SiGoogle } from "react-icons/si";

interface EmailConfig {
  hasConfig: boolean;
  isActive: boolean;
  provider: string | null;
  emailSetupSkipped: boolean;
  staffEmail: string;
}

interface KnownServerConfig {
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

const providerLabels: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Microsoft Outlook",
  imap_smtp: "Email (IMAP/SMTP)",
};

export function EmailSetupModal({ onClose, onComplete }: { onClose: () => void; onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const { data: emailConfig } = useQuery<EmailConfig>({ queryKey: ["/api/crm/email/config"] });

  const [choice, setChoice] = useState<string | null>(null);
  const detected = emailConfig?.provider ?? "imap_smtp";
  const provider = choice ?? detected;
  const staffEmail = emailConfig?.staffEmail ?? "";
  const domain = staffEmail.split("@")[1] ?? "";

  const handleDismiss = async () => {
    try {
      await fetch("/api/crm/email/skip-setup", { method: "POST", credentials: "include" });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff/me"] });
    } catch {
      // best-effort skip
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" data-testid="modal-email-setup">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold" data-testid="text-email-setup-title">Connect Your Email</h2>
                <p className="text-sm text-muted-foreground">Set up email to manage your communications.</p>
              </div>
            </div>
            <button onClick={handleDismiss} className="p-2 rounded-xl hover:bg-muted text-muted-foreground" data-testid="button-close-email-setup">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {emailConfig ? (
            <>
              <div className="mb-4 p-3 rounded-xl bg-muted/50 text-sm">
                <span className="text-muted-foreground">Your email: </span>
                <span className="font-medium" data-testid="text-setup-email">{staffEmail}</span>
                {provider !== "imap_smtp" && provider === detected && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    {providerLabels[provider]} detected
                  </span>
                )}
              </div>

              <div className="mb-4" data-testid="email-provider-chooser">
                <p className="text-xs font-medium text-muted-foreground mb-2">Choose your email provider</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ["outlook", "Microsoft 365 / Outlook"],
                    ["gmail", "Google / Gmail"],
                    ["imap_smtp", "Other (IMAP)"],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setChoice(key)}
                      data-testid={`button-provider-${key}`}
                      aria-pressed={provider === key}
                      className={`px-2 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                        provider === key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted/50"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {provider === "outlook" && <OutlookSetup onComplete={onComplete} />}
              {provider === "gmail" && <GmailSetup onComplete={onComplete} />}
              {provider === "imap_smtp" && <ImapSetup domain={domain} staffEmail={staffEmail} onComplete={onComplete} />}

              <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                <p className="text-xs text-muted-foreground">You can always configure this later in Settings.</p>
                <SkipButton onSkip={onClose} />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SkipButton({ onSkip }: { onSkip: () => void }) {
  const queryClient = useQueryClient();
  const skipMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/crm/email/skip-setup");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/staff/me"] });
      onSkip();
    },
  });

  return (
    <button
      onClick={() => skipMutation.mutate()}
      disabled={skipMutation.isPending}
      data-testid="button-skip-email-setup"
      className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-4 py-2 rounded-xl hover:bg-muted"
    >
      {skipMutation.isPending ? "Skipping..." : "Set up later"}
    </button>
  );
}

function OutlookSetup({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/crm/email/status"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (status?.connected) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
      onComplete?.();
    }
  }, [status?.connected, queryClient, onComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-violet-50 border border-violet-100">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-violet-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-violet-900">Microsoft 365 / Outlook</p>
            <p className="text-xs text-violet-700 mt-1">
              Connect your Microsoft account to access email and calendar. This uses secure OAuth — your password is never shared.
            </p>
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium p-3 bg-emerald-50 rounded-xl" data-testid="text-outlook-connected">
          <CheckCircle2 className="w-4 h-4" />
          Outlook connected successfully!
        </div>
      ) : (
        <a
          href="/api/crm/email/auth/microsoft"
          data-testid="button-connect-outlook"
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#0078D4] text-white font-semibold rounded-xl hover:bg-[#006CBF] transition-colors shadow-lg"
        >
          <Shield className="w-5 h-5" />
          Connect with Microsoft
          <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function GmailSetup({ onComplete }: { onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const { data: status } = useQuery<{ connected: boolean }>({
    queryKey: ["/api/crm/email/status"],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (status?.connected) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
      onComplete?.();
    }
  }, [status?.connected, queryClient, onComplete]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-red-50 border border-red-100">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Google Workspace / Gmail</p>
            <p className="text-xs text-red-700 mt-1">
              Connect your Google account to access email and calendar. This uses secure OAuth — your password is never shared.
            </p>
          </div>
        </div>
      </div>

      {status?.connected ? (
        <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium p-3 bg-emerald-50 rounded-xl">
          <CheckCircle2 className="w-4 h-4" />
          Gmail connected successfully!
        </div>
      ) : (
        <a
          href="/api/crm/email/auth/gmail"
          data-testid="button-connect-gmail"
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
        >
          <SiGoogle className="w-5 h-5 text-[#4285F4]" />
          Connect with Google
          <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}

function ImapSetup({ domain, staffEmail, onComplete }: { domain: string; staffEmail: string; onComplete?: () => void }) {
  const queryClient = useQueryClient();
  const { data: knownServer } = useQuery<KnownServerConfig>({
    queryKey: ["/api/crm/email/known-servers", domain],
    enabled: !!domain,
  });

  const [form, setForm] = useState({
    imapHost: "",
    imapPort: 993,
    imapSecure: true,
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: true,
    email: staffEmail,
    password: "",
  });

  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (knownServer) {
      setForm(prev => ({
        ...prev,
        imapHost: knownServer.imapHost,
        imapPort: knownServer.imapPort,
        imapSecure: knownServer.imapSecure,
        smtpHost: knownServer.smtpHost,
        smtpPort: knownServer.smtpPort,
        smtpSecure: knownServer.smtpSecure,
      }));
    }
  }, [knownServer]);

  useEffect(() => {
    setForm(prev => ({ ...prev, email: staffEmail }));
  }, [staffEmail]);

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/email/test-imap", form);
      return res.json();
    },
    onSuccess: (data) => setTestResult(data),
    onError: (err: Error) => setTestResult({ success: false, error: err.message }),
  });

  const setupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/crm/email/setup-imap", form);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/status"] });
      onComplete?.();
    },
  });

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-100">
        <div className="flex items-start gap-3">
          <Server className="w-5 h-5 text-amber-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">IMAP/SMTP Email</p>
            <p className="text-xs text-amber-700 mt-1">
              {knownServer
                ? `Server settings auto-detected for ${domain}. Enter your email password or app password below.`
                : `Enter your email server settings and credentials to connect.`}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">IMAP Server</label>
            <input
              value={form.imapHost}
              onChange={e => setForm({ ...form, imapHost: e.target.value })}
              placeholder="imap.example.com"
              data-testid="input-imap-host"
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">IMAP Port</label>
            <input
              type="number"
              value={form.imapPort}
              onChange={e => setForm({ ...form, imapPort: Number(e.target.value) })}
              data-testid="input-imap-port"
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">SMTP Server</label>
            <input
              value={form.smtpHost}
              onChange={e => setForm({ ...form, smtpHost: e.target.value })}
              placeholder="smtp.example.com"
              data-testid="input-smtp-host"
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">SMTP Port</label>
            <input
              type="number"
              value={form.smtpPort}
              onChange={e => setForm({ ...form, smtpPort: Number(e.target.value) })}
              data-testid="input-smtp-port"
              className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Email Address</label>
          <input
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
            data-testid="input-imap-email"
            className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Password / App Password</label>
          <input
            type="password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            placeholder="Enter your email password"
            data-testid="input-imap-password"
            className="w-full px-3 py-2 rounded-xl border border-border text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {testResult && (
          <div className={`flex items-center gap-2 text-sm p-3 rounded-xl ${testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`} data-testid="text-imap-test-result">
            {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.success ? "Connection test successful!" : (testResult.error || "Connection failed")}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !form.imapHost || !form.password}
            data-testid="button-test-imap"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all disabled:opacity-50"
          >
            {testMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Test Connection
          </button>
          <button
            onClick={() => setupMutation.mutate()}
            disabled={setupMutation.isPending || !form.imapHost || !form.password}
            data-testid="button-connect-imap"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {setupMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Connect
          </button>
        </div>
      </div>
    </div>
  );
}

export function EmailAccountSection() {
  const queryClient = useQueryClient();
  const { data: emailConfig, isLoading } = useQuery<EmailConfig>({ queryKey: ["/api/crm/email/config"] });
  const { data: emailStatus } = useQuery<{ connected: boolean; staffEmail?: string }>({
    queryKey: ["/api/crm/email/status"],
    enabled: emailConfig?.isActive === true,
  });
  const [showSetup, setShowSetup] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/crm/email/disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/email/status"] });
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const isConnected = emailConfig?.isActive && emailStatus?.connected;

  return (
    <>
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-border bg-background/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Mail className="w-5 h-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h2 className="font-display font-bold text-lg">Email Account</h2>
              <p className="text-sm text-muted-foreground">Manage your email connection for the CRM.</p>
            </div>
            {isConnected && (
              <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full" data-testid="badge-email-connected">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                <div>
                  <p className="text-sm font-medium" data-testid="text-email-provider">
                    Provider: {providerLabels[emailConfig?.provider ?? ""] ?? emailConfig?.provider}
                  </p>
                  <p className="text-xs text-muted-foreground" data-testid="text-email-address">
                    {emailConfig?.staffEmail}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowSetup(true)}
                  data-testid="button-reconfigure-email"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-border text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                >
                  Reconfigure
                </button>
                <button
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                  data-testid="button-disconnect-email"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-red-200 text-red-600 hover:bg-red-50 transition-all disabled:opacity-50"
                >
                  {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4">
              <Mail className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">No email account connected. Set up your email to manage communications from the CRM.</p>
              <button
                onClick={() => setShowSetup(true)}
                data-testid="button-setup-email"
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-semibold rounded-xl shadow-lg shadow-primary/25 hover:shadow-xl transition-all"
              >
                <Mail className="w-4 h-4" />
                Set Up Email
              </button>
            </div>
          )}
        </div>
      </div>

      {showSetup && (
        <EmailSetupModal
          onClose={() => setShowSetup(false)}
          onComplete={() => setShowSetup(false)}
        />
      )}
    </>
  );
}


/**
 * Empty-state call to action used by the Email and Calendar pages when no account is connected.
 * Lets any user (re)open the connection flow at any time, even if they skipped it at first login.
 */
export function ConnectEmailPrompt({ testId = "button-connect-email" }: { testId?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const refresh = () => {
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["/api/crm/email/status"] });
    queryClient.invalidateQueries({ queryKey: ["/api/crm/email/config"] });
  };
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid={testId}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl shadow-lg hover:opacity-90 transition-opacity"
      >
        <Mail className="w-4 h-4" />
        Connect your email
      </button>
      {open && <EmailSetupModal onClose={() => setOpen(false)} onComplete={refresh} />}
    </>
  );
}
