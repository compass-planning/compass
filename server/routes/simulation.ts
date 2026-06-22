import type { Response } from "express";
import { safeMsg, AppError } from "../lib/errorUtils.js";
import { Router } from "express";
import { z } from "zod";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { db } from "../db/index.js";
import { clients, simulations } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import {
  runMonteCarloSimulation,
  PRESET_ALLOCATIONS,
  type PortfolioAllocation,
  type SimulationParams,
} from "../engine/simulation/monteCarlo.js";
import {
  runGuardrailCheck,
  type GuardrailInput,
} from "../engine/simulation/guardrails.js";

const r = Router();

const simulationSchema = z.object({
  initialBalance: z.number().min(0),
  allocation: z.object({
    canEquity: z.number().min(0).max(1),
    usEquity: z.number().min(0).max(1),
    intlEquity: z.number().min(0).max(1),
    fixedIncome: z.number().min(0).max(1),
    cash: z.number().min(0).max(1),
  }).or(z.enum(["AGGRESSIVE", "MODERATE", "CONSERVATIVE", "BALANCED"])),
  annualContribution: z.number(),
  yearsToSimulate: z.number().int().min(1).max(100),
  numberOfPaths: z.number().int().min(100).max(10000).default(5000),
  inflationRate: z.number().min(0).max(0.1).optional(),
});

r.post(
  "/simulation/:clientId/montecarlo",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const input = simulationSchema.parse(req.body);
      
      let allocation: PortfolioAllocation;
      if (typeof input.allocation === "string") {
        allocation = PRESET_ALLOCATIONS[input.allocation];
      } else {
        allocation = input.allocation as PortfolioAllocation;
      }
      
      const params: SimulationParams = {
        initialBalance: input.initialBalance,
        allocation,
        annualContribution: input.annualContribution,
        yearsToSimulate: input.yearsToSimulate,
        numberOfPaths: input.numberOfPaths,
        inflationRate: input.inflationRate,
      };
      
      const result = runMonteCarloSimulation(params);
      
      const [saved] = await (db.insert(simulations) as any).values({
        clientId,
        successRate:   String((result.probabilityOfSuccess * 100).toFixed(2)),
        medianOutcome: String(result.percentiles?.p50 ?? 0),
        worstCase:     String(result.percentiles?.p10 ?? 0),
        bestCase:      String(result.percentiles?.p90 ?? 0),
        parameters:    params,
        results:       result,
        createdAt:     new Date(),
      }).returning();
      
      res.json({
        simulationId: saved.id,
        ...result,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      }
      console.error("[montecarlo]", err);
      res.status(500).json({ message: safeMsg(err, "Simulation failed") });
    }
  }
);

const guardrailSchema = z.object({
  currentAge: z.number().int().min(18).max(100),
  retirementAge: z.number().int().min(55).max(100),
  lifeExpectancy: z.number().int().min(60).max(120).default(90),
  
  rrspBalance: z.number().min(0),
  tfsaBalance: z.number().min(0),
  nonRegBalance: z.number().min(0),
  
  annualIncome: z.number().min(0),
  rrspContribution: z.number().min(0),
  tfsaContribution: z.number().min(0),
  nonRegContribution: z.number().min(0),
  
  desiredRetirementIncome: z.number().min(0),
  pensionIncome: z.number().min(0).default(0),
  cppAmount: z.number().min(0).default(0),
  oasAmount: z.number().min(0).default(0),
  
  allocation: z.object({
    canEquity: z.number().min(0).max(1),
    usEquity: z.number().min(0).max(1),
    intlEquity: z.number().min(0).max(1),
    fixedIncome: z.number().min(0).max(1),
    cash: z.number().min(0).max(1),
  }).optional(),
});

r.post(
  "/simulation/:clientId/guardrail",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const input = guardrailSchema.parse(req.body);
      
      const guardrailInput = {
        clientId,
        currentAge: input.currentAge,
        retirementAge: input.retirementAge,
        lifeExpectancy: input.lifeExpectancy,
        rrspBalance: input.rrspBalance,
        tfsaBalance: input.tfsaBalance,
        nonRegBalance: input.nonRegBalance,
        annualIncome: input.annualIncome,
        rrspContribution: input.rrspContribution,
        tfsaContribution: input.tfsaContribution,
        nonRegContribution: input.nonRegContribution,
        desiredRetirementIncome: input.desiredRetirementIncome,
        pensionIncome: input.pensionIncome,
        cppAmount: input.cppAmount,
        oasAmount: input.oasAmount,
        allocation: input.allocation,
      } as GuardrailInput;
      
      const result = await runGuardrailCheck(guardrailInput);
      
      await (db.insert(simulations) as any).values({
        clientId,
        successRate:   String((result.probabilityOfSuccess * 100).toFixed(2)),
        parameters:    input,
        results:       result,
        createdAt:     new Date(),
      });
      
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0]?.message ?? "Validation error" });
      }
      console.error("[guardrail]", err);
      res.status(500).json({ message: safeMsg(err, "Guardrail check failed") });
    }
  }
);

r.get(
  "/simulation/:clientId/history",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const history = await db
        .select()
        .from(simulations)
        .where(eq(simulations.clientId, clientId));
      
      res.json(history);
    } catch (err: any) {
      console.error("[simulation history]", err);
      res.status(500).json({ message: safeMsg(err, "Failed to fetch history") });
    }
  }
);

r.get(
  "/simulation/:clientId/status",
  isAuthenticated,
  async (req: AuthRequest, res: Response) => {
    try {
      const clientId = parseInt(req.params.clientId);
      const userId = req.userId!;
      
      const [client] = await db
        .select()
        .from(clients)
        .where(eq(clients.id, clientId))
        .limit(1);
      
      if (!client || client.userId !== userId) {
        return res.status(404).json({ message: "Client not found" });
      }
      
      const [latest] = await db
        .select()
        .from(simulations)
        .where(eq(simulations.clientId, clientId))
        .limit(1);
      
      if (!latest) {
        return res.json({ status: "no_data", message: "No simulations run yet" });
      }
      
      const result = (latest.results ?? {}) as any;

      res.json({
        health:               result.health ?? "unknown",
        probabilityOfSuccess: latest.successRate ? Number(latest.successRate) / 100 : null,
        lastChecked:          latest.createdAt,
        issues:               result.issues ?? [],
        recommendations:      result.recommendations ?? [],
      });
    } catch (err: any) {
      console.error("[guardrail status]", err);
      res.status(500).json({ message: safeMsg(err, "Failed to fetch status") });
    }
  }
);

export { r as simulationRouter };