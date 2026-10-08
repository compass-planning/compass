/**
 * Privacy & PIPEDA page
 *
 * Lets authenticated users:
 *  - View and update their consent preferences (data processing / marketing / CRM sharing)
 *  - Export a full JSON copy of their data (PIPEDA right of access)
 *  - Request account erasure (PIPEDA right to erasure — 30-day purge)
 *  - View their current data-retention policy
 */

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Download, Trash2, Clock, FileJson } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

// ── types ─────────────────────────────────────────────────────────────────────

interface ConsentData {
  consentDataProcessing: boolean;
  consentMarketing: boolean;
  consentCrmSharing: boolean;
  consentUpdatedAt: string | null;
}

interface RetentionData {
  policy: string;
  controller: string;
  status: string;
  purgeRequestedAt: string | null;
  purgeAt: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function prettyPolicy(p: string): string {
  return (
    {
      "30_day_purge_on_request": "30-day purge on request",
      controller_retention: "Controller retention",
    }[p] ?? p
  );
}

// ── consent toggles config ────────────────────────────────────────────────────

const CONSENTS = [
  {
    key: "consentDataProcessing" as const,
    label: "Data processing",
    desc: "Required to provide planning and advisory services. Cannot be disabled while your account is active.",
    required: true,
  },
  {
    key: "consentMarketing" as const,
    label: "Marketing communications",
    desc: "Occasional product updates, tips, and insights via email.",
    required: false,
  },
  {
    key: "consentCrmSharing" as const,
    label: "CRM data sharing",
    desc: "Allow syncing your data with connected CRM systems (Enterprise only).",
    required: false,
  },
];

// ── component ─────────────────────────────────────────────────────────────────

export default function Privacy() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [eraseOpen, setEraseOpen] = useState(false);
  const [reason, setReason] = useState("");

  // ── queries ──────────────────────────────────────────────────────────────────

  const consentQ = useQuery<ConsentData>({
    queryKey: ["/api/privacy/consent"],
  });

  const retentionQ = useQuery<RetentionData>({
    queryKey: ["/api/privacy/retention"],
  });

  // ── mutations ─────────────────────────────────────────────────────────────────

  const updateConsent = useMutation({
    mutationFn: (patch: Partial<ConsentData>) =>
      apiRequest("PUT", "/api/privacy/consent", patch),
    onSuccess: () => {
      toast({ title: "Consent updated" });
      qc.invalidateQueries({ queryKey: ["/api/privacy/consent"] });
    },
    onError: () => toast({ title: "Could not update consent", variant: "destructive" }),
  });

  const requestErasure = useMutation({
    mutationFn: (body: { reason?: string }) =>
      apiRequest("POST", "/api/privacy/erasure", body),
    onSuccess: async (res: any) => {
      const data = await res.json();
      setEraseOpen(false);
      setReason("");
      qc.invalidateQueries({ queryKey: ["/api/privacy/retention"] });
      toast({
        title: "Erasure request recorded",
        description: `Your account will be permanently deleted after ${fmtDate(data.purgeAt)}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Request failed",
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  // ── data export ───────────────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const res = await apiRequest("GET", "/api/privacy/export");
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `compass-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Your data export was downloaded" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  // ── render ────────────────────────────────────────────────────────────────────

  const c = consentQ.data;
  const retention = retentionQ.data;
  const pendingPurge = retention?.status === "pending_purge";

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-green-500" />
          Privacy &amp; PIPEDA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your consent preferences and exercise your rights under Canada's
          Personal Information Protection and Electronic Documents Act (PIPEDA).
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Consent card (2/3 width) ───────────────────────────────────── */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Consent preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {CONSENTS.map((item) => {
              const checked = !!c?.[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 rounded-lg border px-4 py-3"
                >
                  <div className="min-w-0">
                    <Label className="font-semibold text-sm">{item.label}</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.desc}
                    </p>
                  </div>
                  <Switch
                    checked={checked}
                    disabled={item.required || updateConsent.isPending}
                    onCheckedChange={(v) =>
                      updateConsent.mutate({ [item.key]: v })
                    }
                    data-testid={`consent-${item.key}`}
                  />
                </div>
              );
            })}
            {c?.consentUpdatedAt && (
              <p className="text-xs text-muted-foreground pt-1">
                Last updated {fmtDate(c.consentUpdatedAt)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* ── Right column ──────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Retention card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                Data retention
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {retention ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Controller</span>
                    <span className="font-semibold capitalize">
                      {retention.controller}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Policy</span>
                    <span className="font-semibold text-right">
                      {prettyPolicy(retention.policy)}
                    </span>
                  </div>
                  {retention.purgeAt && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Purge date</span>
                      <span className="font-semibold text-red-500">
                        {fmtDate(retention.purgeAt)}
                      </span>
                    </div>
                  )}
                  <div className="pt-1">
                    <Badge
                      variant={pendingPurge ? "destructive" : "secondary"}
                    >
                      {retention.status?.replace(/_/g, " ")}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-muted-foreground text-xs">Loading…</p>
              )}
            </CardContent>
          </Card>

          {/* Data rights card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileJson className="h-4 w-4 text-blue-500" />
                Your data rights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={handleExport}
                data-testid="pipeda-export-btn"
              >
                <Download className="h-4 w-4" />
                Export my data (JSON)
              </Button>
              <Separator />
              <Button
                variant="ghost"
                className="w-full justify-start gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                onClick={() => setEraseOpen(true)}
                disabled={pendingPurge}
                data-testid="pipeda-erasure-btn"
              >
                <Trash2 className="h-4 w-4" />
                {pendingPurge ? "Erasure already requested" : "Request erasure"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Erasure confirmation dialog ────────────────────────────────────── */}
      <Dialog open={eraseOpen} onOpenChange={setEraseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Request data erasure
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are the controller of your data. Submitting this request will
              schedule a <strong>permanent, irreversible deletion</strong> of
              your account and all associated data after a 30-day retention
              window required by law.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="erasure-reason">Reason (optional)</Label>
              <Textarea
                id="erasure-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why are you requesting erasure?"
                rows={3}
                data-testid="erasure-reason"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setEraseOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => requestErasure.mutate({ reason })}
                disabled={requestErasure.isPending}
                data-testid="erasure-confirm"
              >
                Confirm request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
