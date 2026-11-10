import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Video, CheckCircle2, AlertCircle } from "lucide-react";

interface ZoomStatus {
  configured: boolean;
  connected: boolean;
  needsReauth: boolean;
  email: string | null;
  scopes: string[];
}

const REASONS: Record<string, string> = {
  denied: "Zoom authorization was cancelled.",
  invalid_state: "The Zoom sign-in expired or was invalid. Please try again.",
  already_connected: "That Zoom account is already connected to another Compass user.",
  not_authenticated: "Please sign in and try again.",
  no_code: "Zoom did not return an authorization code. Please try again.",
  failed: "Zoom could not be connected. Please try again.",
};

export function ZoomAccountSection() {
  const queryClient = useQueryClient();
  const { data: status } = useQuery<ZoomStatus>({ queryKey: ["/api/crm/zoom/status"] });

  const params = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const result = params.get("zoom");
  const reason = params.get("reason") || "failed";
  useEffect(() => {
    if (result) {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/zoom/status"] });
      // Drop the one-time query string so a refresh doesn't replay the banner.
      const t = setTimeout(() => window.history.replaceState({}, "", window.location.pathname), 8000);
      return () => clearTimeout(t);
    }
  }, [result, queryClient]);

  const disconnect = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/crm/zoom/disconnect", { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/crm/zoom/status"] }),
  });

  if (!status) return null;

  return (
    <div className="bg-white rounded-xl border border-border p-6 space-y-4" data-testid="section-zoom">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Video className="w-5 h-5 text-blue-600" /></div>
        <div>
          <h3 className="font-bold text-slate-900">Zoom</h3>
          <p className="text-sm text-slate-500">Connect your own Zoom account to schedule and run client meetings from Compass.</p>
        </div>
      </div>

      {result === "connected" && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2" data-testid="text-zoom-connected-banner"><CheckCircle2 className="w-4 h-4" />Zoom connected.</div>
      )}
      {result === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 rounded-lg px-3 py-2" data-testid="text-zoom-error-banner"><AlertCircle className="w-4 h-4" />{REASONS[reason] || REASONS.failed}</div>
      )}

      {!status.configured ? (
        <p className="text-sm text-slate-500" data-testid="text-zoom-not-configured">Zoom is not enabled for this Compass installation yet.</p>
      ) : status.connected || status.needsReauth ? (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm">
            <p className="font-medium text-slate-900" data-testid="text-zoom-email">{status.email || "Connected"}</p>
            {status.needsReauth
              ? <p className="text-amber-600">Authorization expired. Reconnect to keep using Zoom.</p>
              : <p className="text-green-600">Connected</p>}
          </div>
          <div className="flex gap-2">
            {status.needsReauth && (
              <a href="/api/crm/zoom/connect" className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold" data-testid="button-zoom-reconnect">Reconnect</a>
            )}
            <button
              onClick={() => { if (confirm("Disconnect Zoom? Compass will stop managing your Zoom meetings.")) disconnect.mutate(); }}
              disabled={disconnect.isPending}
              className="px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted/40 disabled:opacity-50"
              data-testid="button-zoom-disconnect"
            >{disconnect.isPending ? "Disconnecting..." : "Disconnect"}</button>
          </div>
        </div>
      ) : (
        <a href="/api/crm/zoom/connect" className="inline-block px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold" data-testid="button-zoom-connect">Connect Zoom</a>
      )}
    </div>
  );
}
