/**
 * OnboardingWizard
 *
 * 3-step modal shown to new users on first login (when they have no clients yet).
 * Ported from Testing Compass's SoloOnboarding component.
 *
 * Steps:
 *   1. Profile — province, income, retirement age, desired monthly income
 *   2. First client — collects basic client data so the app has something to work with
 *   3. First goal — retirement goal to seed the dashboard
 *
 * Usage:
 *   const [show, setShow] = useState(isNewUser);
 *   <OnboardingWizard open={show} onComplete={() => setShow(false)} />
 */

import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ArrowRight, ArrowLeft, Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── constants ─────────────────────────────────────────────────────────────────

const PROVINCES = [
  "AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT",
] as const;

const STEPS = ["Profile", "Client", "Goal"] as const;

// ── component ─────────────────────────────────────────────────────────────────

interface OnboardingWizardProps {
  open: boolean;
  onComplete: () => void;
  onSkip?: () => void;
}

export function OnboardingWizard({ open, onComplete, onSkip }: OnboardingWizardProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // ── form state ────────────────────────────────────────────────────────────
  const [profile, setProfile] = useState({
    province: "ON",
    annualIncome: "",
    retirementAge: "65",
    desiredRetirementIncome: "",
  });

  const [client, setClient] = useState({
    firstName: "",
    lastName: "",
    province: "ON",
    annualIncome: "",
    retirementAge: "65",
  });

  const [goal, setGoal] = useState({
    title: "Retirement",
    targetAmount: "1000000",
    currentAmount: "0",
    targetYear: String(new Date().getFullYear() + 25),
  });

  // ── mutations ─────────────────────────────────────────────────────────────

  const createClient = useMutation({
    mutationFn: (body: object) => apiRequest("POST", "/api/clients", body),
    onError: () => toast({ title: "Could not create client profile", variant: "destructive" }),
  });

  const createGoal = useMutation({
    mutationFn: async ({ clientId, body }: { clientId: number; body: object }) =>
      apiRequest("POST", `/api/clients/${clientId}/goals`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({ title: "You're all set — your dashboard is ready 🎉" });
      onComplete();
    },
    onError: () => toast({ title: "Could not add goal", variant: "destructive" }),
  });

  // ── step handlers ─────────────────────────────────────────────────────────

  const handleProfileNext = () => setStep(1);

  const handleClientNext = async () => {
    const res = await createClient.mutateAsync({
      firstName: client.firstName || "My",
      lastName: client.lastName || "Client",
      province: client.province,
      annualIncome: Number(client.annualIncome) || undefined,
      retirementAge: Number(client.retirementAge) || 65,
    });
    if (res.ok) {
      const data = await res.json();
      // store clientId for step 3
      setClient((c) => ({ ...c, _id: data.id } as any));
      setStep(2);
    }
  };

  const handleFinish = async () => {
    const clientId = (client as any)._id;
    if (!clientId) return;
    await createGoal.mutateAsync({
      clientId,
      body: {
        title: goal.title,
        category: "retirement",
        targetAmount: Number(goal.targetAmount) || 1_000_000,
        currentAmount: Number(goal.currentAmount) || 0,
        targetYear: Number(goal.targetYear) || new Date().getFullYear() + 25,
        status: "on_track",
      },
    });
  };

  const busy = createClient.isPending || createGoal.isPending;

  // ── helpers ───────────────────────────────────────────────────────────────

  const StepIndicator = () => (
    <div className="flex items-center gap-2 mb-6" data-testid="onboarding-steps">
      {STEPS.map((s, i) => (
        <React.Fragment key={s}>
          <div className="flex items-center gap-2">
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step
                  ? "bg-green-500 text-white"
                  : i === step
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`text-sm font-semibold ${
                i === step ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <span className="flex-1 h-px bg-border max-w-[24px]" />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onSkip?.()}>
      <DialogContent className="max-w-md" data-testid="onboarding-wizard">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shrink-0">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              Let's set up your workspace
              <p className="text-sm font-normal text-muted-foreground mt-0.5">
                Three quick steps to populate your dashboard.
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <StepIndicator />

        {/* ── Step 0: Profile ────────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-4" data-testid="onboarding-profile">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Province</Label>
                <Select
                  value={profile.province}
                  onValueChange={(v) => setProfile({ ...profile, province: v })}
                >
                  <SelectTrigger data-testid="ob-province">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Annual income (CAD)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 120000"
                  value={profile.annualIncome}
                  onChange={(e) => setProfile({ ...profile, annualIncome: e.target.value })}
                  data-testid="ob-income"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Target retirement age</Label>
                <Input
                  type="number"
                  value={profile.retirementAge}
                  onChange={(e) => setProfile({ ...profile, retirementAge: e.target.value })}
                  data-testid="ob-retire-age"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Desired monthly income</Label>
                <Input
                  type="number"
                  placeholder="e.g. 6000"
                  value={profile.desiredRetirementIncome}
                  onChange={(e) => setProfile({ ...profile, desiredRetirementIncome: e.target.value })}
                  data-testid="ob-desired"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={onSkip} data-testid="ob-skip">
                Skip for now
              </Button>
              <Button onClick={handleProfileNext} data-testid="ob-next-1">
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 1: First client ───────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4" data-testid="onboarding-client">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First name</Label>
                <Input
                  value={client.firstName}
                  onChange={(e) => setClient({ ...client, firstName: e.target.value })}
                  placeholder="e.g. Jane"
                  data-testid="ob-first-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last name</Label>
                <Input
                  value={client.lastName}
                  onChange={(e) => setClient({ ...client, lastName: e.target.value })}
                  placeholder="e.g. Smith"
                  data-testid="ob-last-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Province</Label>
                <Select
                  value={client.province}
                  onValueChange={(v) => setClient({ ...client, province: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Annual income (CAD)</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100000"
                  value={client.annualIncome}
                  onChange={(e) => setClient({ ...client, annualIncome: e.target.value })}
                  data-testid="ob-client-income"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleClientNext} disabled={busy} data-testid="ob-next-2">
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: First goal ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4" data-testid="onboarding-goal">
            <div className="space-y-1.5">
              <Label>Goal name</Label>
              <Input
                value={goal.title}
                onChange={(e) => setGoal({ ...goal, title: e.target.value })}
                data-testid="ob-goal-title"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Target (CAD)</Label>
                <Input
                  type="number"
                  value={goal.targetAmount}
                  onChange={(e) => setGoal({ ...goal, targetAmount: e.target.value })}
                  data-testid="ob-goal-target"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Saved so far</Label>
                <Input
                  type="number"
                  value={goal.currentAmount}
                  onChange={(e) => setGoal({ ...goal, currentAmount: e.target.value })}
                  data-testid="ob-goal-current"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Target year</Label>
                <Input
                  type="number"
                  value={goal.targetYear}
                  onChange={(e) => setGoal({ ...goal, targetYear: e.target.value })}
                  data-testid="ob-goal-year"
                />
              </div>
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button onClick={handleFinish} disabled={busy} data-testid="ob-finish">
                <Check className="h-4 w-4 mr-1" /> Finish setup
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
