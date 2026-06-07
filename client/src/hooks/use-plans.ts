import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import {
  type InsertFinancialPlan, type InsertEducationSaving,
  type InsertDebtEntry, type InsertTaxPlanningNote, type InsertEstatePlanningNote,
} from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// ── Plans ─────────────────────────────────────────────────────────────────────

export function useClientPlans(clientId: number) {
  return useQuery({
    queryKey: [api.plans.list.path, clientId],
    queryFn: async () => {
      const url = buildUrl(api.plans.list.path, { clientId });
      const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch plans");
      return api.plans.list.responses[200].parse(await res.json());
    },
    enabled: !!clientId,
  });
}

export function useCreatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Omit<InsertFinancialPlan, "clientId"> & Record<string, unknown> & Record<string, unknown> }) => {
      const url = buildUrl(api.plans.create.path, { clientId });
      const res = await fetch(url, {
        method: api.plans.create.method,
        headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create plan");
      return api.plans.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.plans.list.path, variables.clientId] });
    },
  });
}

export function useUpdatePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertFinancialPlan> }) => {
      const res = await apiRequest("PUT", `/api/plans/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.includes("/plans") });
    },
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/plans/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => (query.queryKey[0] as string)?.includes("/plans") });
    },
  });
}

// ── Net Worth ─────────────────────────────────────────────────────────────────

export function useNetWorthEntries(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/net-worth", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/net-worth`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch net worth entries");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateNetWorthEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: { type: string; category: string; name: string; value: string } }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/net-worth`, data); return res.json();
    },
    onSuccess: (_: any, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/net-worth", variables.clientId] });
    },
  });
}

export function useUpdateNetWorthEntry(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<{ type: string; category: string; name: string; value: string }> }) => {
      const res = await apiRequest("PUT", `/api/net-worth/${id}`, data); return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/net-worth", clientId] });
    },
  });
}

export function useDeleteNetWorthEntry(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/net-worth/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/net-worth", clientId] });
    },
  });
}

// ── Retirement ────────────────────────────────────────────────────────────────

export function useRetirementProjections(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/retirement-projections", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/retirement-projections`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch retirement projections");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateRetirementProjection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Record<string, number | string> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/retirement-projections`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/retirement-projections", variables.clientId] });
    },
  });
}

export function useDeleteRetirementProjection(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/retirement-projections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/retirement-projections", clientId] });
    },
  });
}

// ── Insurance ─────────────────────────────────────────────────────────────────

export function useInsuranceAnalyses(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/insurance-analyses", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/insurance-analyses`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch insurance analyses");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateInsuranceAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Record<string, number | string> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/insurance-analyses`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/insurance-analyses", variables.clientId] });
    },
  });
}

export function useCreateInsuranceWorksheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/insurance-worksheet`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/insurance-analyses", variables.clientId] });
    },
  });
}

export function useDeleteInsuranceAnalysis(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/insurance-analyses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/insurance-analyses", clientId] });
    },
  });
}

// ── Education (RESP) ──────────────────────────────────────────────────────────

export function useEducationSavings(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/education-savings", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/education-savings`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch education savings");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateEducationSaving() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Omit<InsertEducationSaving, "clientId"> & Record<string, unknown> & Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/education-savings`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/education-savings", variables.clientId] });
    },
  });
}

export function useUpdateEducationSaving(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEducationSaving> }) => {
      const res = await apiRequest("PUT", `/api/education-savings/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/education-savings", clientId] });
    },
  });
}

export function useDeleteEducationSaving(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/education-savings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/education-savings", clientId] });
    },
  });
}

// ── Debt ──────────────────────────────────────────────────────────────────────

export function useDebtEntries(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/debt-entries", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/debt-entries`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch debt entries");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateDebtEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Omit<InsertDebtEntry, "clientId"> & Record<string, unknown> & Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/debt-entries`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/debt-entries", variables.clientId] });
    },
  });
}

export function useUpdateDebtEntry(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertDebtEntry> }) => {
      const res = await apiRequest("PUT", `/api/debt-entries/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/debt-entries", clientId] });
    },
  });
}

export function useDeleteDebtEntry(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/debt-entries/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/debt-entries", clientId] });
    },
  });
}

// ── Tax Planning Notes ────────────────────────────────────────────────────────

export function useTaxPlanningNotes(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/tax-planning-notes", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/tax-planning-notes`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch tax planning notes");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateTaxPlanningNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Omit<InsertTaxPlanningNote, "clientId"> & Record<string, unknown> & Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/tax-planning-notes`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/tax-planning-notes", variables.clientId] });
    },
  });
}

export function useUpdateTaxPlanningNote(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTaxPlanningNote> }) => {
      const res = await apiRequest("PUT", `/api/tax-planning-notes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/tax-planning-notes", clientId] });
    },
  });
}

export function useDeleteTaxPlanningNote(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tax-planning-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/tax-planning-notes", clientId] });
    },
  });
}

// ── Tax Engine (new) ──────────────────────────────────────────────────────────

// ── Tax Projection Results ──────────────────────────────────────────────────

export interface TaxYearProjection {
  year: number;
  age: number;
  phase: string;
  employmentIncome: number;
  pensionIncome: number;
  rrifWithdrawal: number;
  tfsaWithdrawal: number;
  capitalGainsIncome: number;
  cppBenefit: number;
  oasBenefit: number;
  totalIncome: number;
  federalTax: number;
  provincialTax: number;
  totalTax: number;
  afterTaxIncome: number;
  rrspBalance: number;
  tfsaBalance: number;
  nonRegBalance: number;
  totalWealth: number;
  rrspRoom: number;
  tfsaRoom: number;
}

export interface TaxProjectionResult {
  projections: TaxYearProjection[];
  summary: {
    totalLifetimeTax: number;
    averageEffectiveRate: number;
    projectedFinalWealth: number;
    successProbability: number;
  };
}

// ── RRSP Room Results ───────────────────────────────────────────────────────

export interface RrspRoomResult {
  summary: {
    newRoomThisYear: number;
    carryForwardBroughtIn: number;
    totalAvailableRoom: number;
    contributionsMade: number;
    closingRoom: number;
    annualLimitThisYear: number;
  };
  marginalTaxSavings: number;
  effectiveCost: number;
  catchUpStrategy: {
    yearsToMaxOut: number;
    annualContributionNeeded: number;
    projectedRefundPerYear: number;
  };
}

// ── TFSA Room Results ───────────────────────────────────────────────────────

export interface TfsaRoomResult {
  summary: {
    annualLimitThisYear: number;
    totalAvailableRoom: number;
    contributionsMade: number;
    closingRoom: number;
  };
  cumulativeRoomSince2009: number;
  futureLimits: Array<{ year: number; limit: number }>;
  thirtyYearProjection: {
    tfsaBalanceFinal: number;
    taxableBalanceFinal: number;
    tfsaAdvantage: number;
  };
}

// ── Capital Gains Results ───────────────────────────────────────────────────

export interface CapitalGainsPosition {
  symbol: string;
  acb: number;
  fmv: number;
  unrealizedGain: number;
}

export interface CapitalGainsResult {
  positions: CapitalGainsPosition[];
  totalUnrealizedGain: number;
  scenarios: Array<{
    name: string;
    gainRealized: number;
    taxableGain: number;
    estimatedTax: number;
  }>;
  lossHarvestingOpportunity: number;
}

// ── Income Splitting Results ────────────────────────────────────────────────

export interface IncomeSplitResult {
  strategy: string;
  currentCombinedTax: number;
  optimizedCombinedTax: number;
  annualTaxSavings: number;
  lifetimeTaxSavings: number;
  details: string;
}

// ============================================================================
// FIXED HOOKS - These replace the broken versions
// ============================================================================

/**
 * Tax Projection Hook
 * Runs year-by-year income, tax, and wealth projection through retirement
 */
export function useTaxProjection(clientId: number) {
  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<TaxProjectionResult> => {
      const res = await apiRequest("POST", `/api/tax/${clientId}/projection`, input);
      if (!res.ok) throw new Error("Failed to run tax projection");
      return res.json();
    },
  });
}

/**
 * RRSP Room Calculator Hook
 * Calculates available RRSP contribution room with carry-forward
 */
export function useRrspRoom(clientId: number) {
  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<RrspRoomResult> => {
      const res = await apiRequest("POST", `/api/tax/${clientId}/rrsp-room`, input);
      if (!res.ok) throw new Error("Failed to calculate RRSP room");
      return res.json();
    },
  });
}

/**
 * TFSA Room Calculator Hook
 * Calculates available TFSA contribution room since 2009
 */
export function useTfsaRoom(clientId: number) {
  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<TfsaRoomResult> => {
      const res = await apiRequest("POST", `/api/tax/${clientId}/tfsa-room`, input);
      if (!res.ok) throw new Error("Failed to calculate TFSA room");
      return res.json();
    },
  });
}

/**
 * Capital Gains Analysis Hook
 * Analyzes unrealized capital gains with 2024 inclusion rates
 */
export function useCapitalGains(clientId: number) {
  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<CapitalGainsResult> => {
      const res = await apiRequest("POST", `/api/tax/${clientId}/capital-gains`, input);
      if (!res.ok) throw new Error("Failed to analyze capital gains");
      return res.json();
    },
  });
}

/**
 * Income Splitting Optimizer Hook
 * Finds optimal income split strategy (pension split, spousal RRSP, etc.)
 */
export function useIncomeSplit(clientId: number) {
  return useMutation({
    mutationFn: async (input: Record<string, unknown>): Promise<IncomeSplitResult> => {
      const res = await apiRequest("POST", `/api/tax/${clientId}/income-splitting`, input);
      if (!res.ok) throw new Error("Failed to analyze income splitting");
      return res.json();
    },
  });
}

export function useEstatePlanningNotes(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/estate-planning-notes", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/estate-planning-notes`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch estate planning notes");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useCreateEstatePlanningNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ clientId, data }: { clientId: number; data: Omit<InsertEstatePlanningNote, "clientId"> & Record<string, unknown> & Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/estate-planning-notes`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/estate-planning-notes", variables.clientId] });
    },
  });
}

export function useUpdateEstatePlanningNote(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertEstatePlanningNote> }) => {
      const res = await apiRequest("PUT", `/api/estate-planning-notes/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/estate-planning-notes", clientId] });
    },
  });
}

export function useDeleteEstatePlanningNote(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/estate-planning-notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/estate-planning-notes", clientId] });
    },
  });
}

// ── AI Recommendations ────────────────────────────────────────────────────────

export function useAiRecommendations(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/ai-recommendations", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/ai-recommendations`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch AI recommendations");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useGenerateAiRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (clientId: number) => {
      const res = await apiRequest("POST", `/api/clients/${clientId}/ai-recommendations/generate`);
      return res.json();
    },
    onSuccess: (_, clientId) => {
  queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/ai-recommendations", clientId] });
  queryClient.refetchQueries({ queryKey: ["/api/clients/:clientId/ai-recommendations", clientId] });
},
    onError: (err) => {
      console.error("Generate failed:", err);
    },
  });
}

export function useUpdateAiRecommendation(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status: string } }) => {
      const res = await apiRequest("PUT", `/api/ai-recommendations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/ai-recommendations", clientId] });
    },
  });
}

export function useDeleteAiRecommendation(clientId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/ai-recommendations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients/:clientId/ai-recommendations", clientId] });
    },
  });
}

// ── Overview & Reports ────────────────────────────────────────────────────────

export function useFinancialPlanningOverview(clientId: number) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/financial-planning-overview", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/financial-planning-overview`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch overview");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useAvailableReports(clientId: number) {
  return useQuery<{
    comprehensive: boolean;
    retirement:    boolean;
    insurance:     boolean;
    netWorth:      boolean;
    hasMonteCarlo: boolean;
    hasDebt:       boolean;
    hasEducation:  boolean;
    hasAiRecs:     boolean;
  }>({
    queryKey: ["/api/reports/:clientId/available", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/reports/${clientId}/available`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to check available reports");
      return res.json();
    },
    enabled: !!clientId,
  });
}

export function useFinancialPlanningReport(clientId: number | null) {
  return useQuery({
    queryKey: ["/api/clients/:clientId/financial-planning-report", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/financial-planning-report`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: false,
  });
}

// ── Simulation / Plan Engine ──────────────────────────────────────────────────

export function usePlanStaleFlags(planId: number | null) {
  return useQuery<Array<{ id: number; planId: number; module: string; triggeredBy: string; resolvedAt: string | null; createdAt: string }>>({
    queryKey: ["/api/plans/:planId/stale-flags", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/stale-flags`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch stale flags");
      return res.json();
    },
    enabled: !!planId,
    refetchInterval: 30000,
  });
}

export function useSimulationResults(planId: number | null) {
  return useQuery<SimulationResult[]>({
    queryKey: ["/api/plans/:planId/simulation-results", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/simulation-results`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch simulation results");
      return res.json();
    },
    enabled: !!planId,
  });
}

export function useScenarioComparison(planId: number | null) {
  return useQuery<Record<string, ScenarioComparisonEntry>>({
    queryKey: ["/api/plans/:planId/scenario-comparison", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/scenario-comparison`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch scenario comparison");
      return res.json();
    },
    enabled: !!planId,
  });
}

export function usePlanAssumptions(planId: number | null) {
  return useQuery<PlanAssumption[]>({
    queryKey: ["/api/plans/:planId/assumptions", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/assumptions`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch assumptions");
      return res.json();
    },
    enabled: !!planId,
  });
}

export function useUpsertAssumption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, data }: { planId: number; data: Record<string, string | number> }) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/assumptions`, data);
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/assumptions", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/simulation-results", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/scenario-comparison", variables.planId] });
    },
  });
}

export function useSeedDefaults() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (planId: number) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/assumptions/seed-defaults`);
      return res.json();
    },
    onSuccess: (_, planId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/assumptions", planId] });
    },
  });
}

export function useRunSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, modules, scenario }: { planId: number; modules?: string[]; scenario?: string }) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/run-simulation`, { modules, scenario });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/simulation-results", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/scenario-comparison", variables.planId] });
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/stale-flags", variables.planId] });
    },
  });
}

export function usePlanActionItems(planId: number | null) {
  return useQuery<PlanActionItem[]>({
    queryKey: ["/api/plans/:planId/action-items", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/action-items`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch action items");
      return res.json();
    },
    enabled: !!planId,
  });
}

export function useCreateActionItem(planId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { module: string; title: string; description: string; priority: string }) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/action-items`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/action-items", planId] });
    },
  });
}

export function useUpdateActionItem(planId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { status?: string; priority?: string } }) => {
      const res = await apiRequest("PUT", `/api/action-items/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/action-items", planId] });
    },
  });
}

export function useDeleteActionItem(planId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/action-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/action-items", planId] });
    },
  });
}

export function usePlanSnapshots(planId: number | null) {
  return useQuery<PlanSnapshot[]>({
    queryKey: ["/api/plans/:planId/snapshots", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/snapshots`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      return res.json();
    },
    enabled: !!planId,
  });
}

export function useCreateSnapshot() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, trigger, notes }: { planId: number; trigger: string; notes?: string }) => {
      const res = await apiRequest("POST", `/api/plans/${planId}/snapshots`, { trigger, notes });
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/plans/:planId/snapshots", variables.planId] });
    },
  });
}

export function useSnapshotComparison(planId: number | null) {
  return useQuery<{ current: Record<string, number>; previous: Record<string, number>; deltas: Record<string, number> } | null>({
    queryKey: ["/api/plans/:planId/snapshot-comparison", planId],
    queryFn: async () => {
      const res = await fetch(`/api/plans/${planId}/snapshot-comparison`, { headers: { Authorization: `Bearer ${localStorage.getItem("fp_token") ?? ""}`, "Content-Type": "application/json" } });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!planId,
  });
}

// ── Type exports ──────────────────────────────────────────────────────────────

export interface SimulationResult {
  id:               number;
  planId:           number;
  module:           string;
  scenario:         string;
  successRate:      string;
  p10:              string;
  p25:              string;
  p50:              string;
  p75:              string;
  p90:              string;
  sensitivityData:  Record<string, number> | null;
  medianPath:       number[] | null;
  percentileBands:  { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] } | null;
  simulationCount:  number;
  yearsProjected:   number;
  calculatedAt:     string | null;
}

export interface ScenarioComparisonEntry {
  scenarios: Record<string, {
    successRate: number;
    p10: number; p25: number; p50: number; p75: number; p90: number;
  }>;
}

export interface PlanAssumption {
  id:                    number;
  planId:                number;
  scenario:              string;
  equityReturn:          string;
  equityVolatility:      string;
  bondReturn:            string;
  bondVolatility:        string;
  inflationMean:         string;
  inflationVolatility:   string;
  corrEquityBond:        string;
  corrEquityInflation:   string;
  corrBondInflation:     string;
  planToAge:             number;
  simulationCount:       number;
  cppStartAge:           number;
  oasStartAge:           number;
  province:              string;
  createdAt:             string | null;
  updatedAt:             string | null;
}

export interface PlanActionItem {
  id:          number;
  planId:      number;
  module:      string;
  priority:    string;
  title:       string;
  description: string;
  status:      string;
  createdAt:   string | null;
  updatedAt:   string | null;
}

export interface PlanSnapshot {
  id:           number;
  planId:       number;
  snapshotData: Record<string, unknown>;
  trigger:      string;
  notes:        string | null;
  createdBy:    number | null;
  createdAt:    string | null;
}


