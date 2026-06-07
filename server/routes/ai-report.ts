/**
 * ai-report.ts
 *
 * Route: POST /api/clients/:id/ai-report
 *
 * Accepts the SimulationResult from the client (already computed server-side
 * by /api/clients/:id/simulate) and returns a PIPEDA-compliant AI narrative
 * merged with real metrics.
 *
 * Registration in server/index.ts:
 *   import { aiReportRouter } from "./routes/ai-report.js";
 *   app.use("/api", aiReportRouter);
 */

import { Router, type Response } from "express";
import { db } from "../db/index.js";
import { clients, retirementProjections, netWorthEntries, clientPolicies } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { ownsClient } from "../fpUtils.js";
import { eq } from "drizzle-orm";
import {
  generatePipedaCompliantNarrative,
  type SimulationResult,
} from "../services/pipedaReportingService.js";

const r = Router();
r.use(isAuthenticated);

/**
 * POST /api/clients/:id/ai-report
 *
 * Body: { simulationResult: SimulationResult }
 *
 * Returns: { reportContext: ReportContext, narrativeMeta: NarrativeMeta }
 */
r.post("/clients/:id/ai-report", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;

  // ── Auth check ─────────────────────────────────────────────────────────────
  if (!req.userId || !(await ownsClient(cid, req.userId))) {
    return res.status(404).json({ message: "Not found" });
  }

  const { simulationResult } = req.body as { simulationResult: SimulationResult };
  if (!simulationResult || typeof simulationResult.successRate !== "number") {
    return res.status(400).json({ message: "simulationResult is required" });
  }

  // ── Check Anthropic API key ────────────────────────────────────────────────
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({
      message: "AI report generation is not configured. " +
        "Add ANTHROPIC_API_KEY to Fly.io secrets: flyctl secrets set ANTHROPIC_API_KEY=...",
    });
  }

  // ── Build plan context (boolean flags + province only — no dollar amounts) ─
  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  if (!client) return res.status(404).json({ message: "Client not found" });

  const [proj] = await db
    .select()
    .from(retirementProjections)
    .where(eq(retirementProjections.clientId, cid))
    .limit(1);

  // Determine plan flags from DB — boolean only, no amounts
  const hasRrsp = proj
    ? Number(proj.rrspBalance ?? 0) > 0
    : false;
  const hasTfsa = proj
    ? Number(proj.tfsaBalance ?? 0) > 0
    : false;

  // Check for employer pension plans
  const { pensionPlans } = await import("../../shared/schema.js");
  const plans = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
  const hasPension = plans.length > 0;

  const hasSpouse =
    !!(client.spouseFirstName && client.spouseFirstName.trim().length > 0);

  const planContext = {
    province: client.province ?? "ON",
    hasRrsp,
    hasTfsa,
    hasPension,
    hasSpouse,
  };

  // ── Generate PIPEDA-compliant AI narrative ─────────────────────────────────
  try {
    const reportContext = await generatePipedaCompliantNarrative(
      simulationResult,
      planContext,
    );

    // ── TODO: persist narrativeMeta to activity_logs table ────────────────
    // await db.insert(activityLogs).values({
    //   clientId:     cid,
    //   userId:       req.userId,
    //   action:       "ai_report_generated",
    //   model:        reportContext.narrativeMeta.model,
    //   inputTokens:  reportContext.narrativeMeta.inputTokens,
    //   outputTokens: reportContext.narrativeMeta.outputTokens,
    //   payloadHash:  reportContext.narrativeMeta.payloadHash,
    //   createdAt:    new Date(reportContext.narrativeMeta.generatedAt),
    // });

    return res.json({
      reportContext,
      narrativeMeta: reportContext.narrativeMeta,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-report] Anthropic call failed:", message);
    return res.status(502).json({
      message: "AI narrative generation failed",
      detail: message,
    });
  }
});

export { r as aiReportRouter };
