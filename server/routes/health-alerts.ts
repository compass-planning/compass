/**
 * server/routes/health-alerts.ts
 *
 * GET /api/health-alerts/:clientId
 *
 * Automatically derives severity-rated plan health alerts from the client's
 * data — no manual entry required.  Used by the PlanHealthAlerts dashboard panel.
 *
 * Severity levels:  danger | warn | info
 */

import { Router, type Response } from "express";
import { db } from "../db/index.js";
import {
  clients,
  financialGoals,
  retirementProjections,
  insuranceAnalyses,
  debtEntries,
  netWorthEntries,
} from "../../shared/schema.js";
import { eq, and } from "drizzle-orm";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";

const r = Router();
r.use(isAuthenticated);

interface Alert {
  id: string;
  severity: "danger" | "warn" | "info";
  title: string;
  detail: string;
  action: string;
  type: string;
}

r.get("/:clientId", async (req: AuthRequest, res: Response) => {
  const clientId = parseInt(req.params.clientId, 10);
  if (isNaN(clientId))
    return res.status(400).json({ message: "Invalid clientId" });

  // Verify ownership
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.userId, req.userId!)))
    .limit(1);
  if (!client) return res.status(404).json({ message: "Client not found" });

  const [goals, retirementRows, insuranceRows, debtRows, nwRows] =
    await Promise.all([
      db.select().from(financialGoals).where(eq(financialGoals.clientId as any, clientId)),
      db.select().from(retirementProjections).where(eq(retirementProjections.clientId, clientId)),
      db.select().from(insuranceAnalyses).where(eq(insuranceAnalyses.clientId, clientId)),
      db.select().from(debtEntries).where(eq(debtEntries.clientId, clientId)),
      db.select().from(netWorthEntries).where(eq(netWorthEntries.clientId, clientId)),
    ]);

  const alerts: Alert[] = [];
  let seq = 0;
  const id = (type: string) => `${type}-${++seq}`;

  // ── Retirement ────────────────────────────────────────────────────────────
  if (retirementRows.length === 0) {
    alerts.push({
      id: id("retirement"),
      severity: "warn",
      type: "retirement",
      title: "No retirement projection on file",
      detail: "Run a Monte Carlo simulation to assess retirement readiness.",
      action: "Open Retirement hub",
    });
  } else {
    const latest = retirementRows.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
    const successRate = parseFloat((latest as any).successRate ?? "0");
    if (successRate < 70) {
      alerts.push({
        id: id("retirement-risk"),
        severity: "danger",
        type: "retirement_risk",
        title: `Retirement success rate is ${successRate.toFixed(0)}%`,
        detail:
          "Monte Carlo simulation shows high risk of depleting savings before end of plan.",
        action: "Review retirement strategy",
      });
    } else if (successRate < 85) {
      alerts.push({
        id: id("retirement-warn"),
        severity: "warn",
        type: "retirement_risk",
        title: `Retirement success rate is ${successRate.toFixed(0)}%`,
        detail:
          "Consider increasing contributions or adjusting spending targets.",
        action: "Review retirement strategy",
      });
    }
  }

  // ── Insurance ─────────────────────────────────────────────────────────────
  if (insuranceRows.length === 0) {
    alerts.push({
      id: id("insurance"),
      severity: "warn",
      type: "insurance",
      title: "Insurance needs analysis missing",
      detail:
        "Life, disability, and critical illness coverage have not been reviewed.",
      action: "Open Protection hub",
    });
  }

  // ── Goals ─────────────────────────────────────────────────────────────────
  if (goals.length === 0) {
    alerts.push({
      id: id("goals"),
      severity: "info",
      type: "goals",
      title: "No goals defined",
      detail: "Adding goals helps measure plan progress and prioritise savings.",
      action: "Add a goal",
    });
  } else {
    const behindGoals = goals.filter((g: any) => {
      if (!g.targetAmount || !g.currentAmount) return false;
      const progress =
        parseFloat(g.currentAmount) / parseFloat(g.targetAmount);
      return progress < 0.25 && g.status !== "completed";
    });
    if (behindGoals.length > 0) {
      alerts.push({
        id: id("goals-behind"),
        severity: "warn",
        type: "goals_behind",
        title: `${behindGoals.length} goal${behindGoals.length > 1 ? "s" : ""} significantly behind`,
        detail: `${behindGoals.map((g: any) => g.title).join(", ")} ${behindGoals.length > 1 ? "are" : "is"} less than 25% funded.`,
        action: "Review goals",
      });
    }
  }

  // ── Debt ──────────────────────────────────────────────────────────────────
  const highRateDebt = debtRows.filter(
    (d: any) => parseFloat(d.interestRate ?? "0") > 15,
  );
  if (highRateDebt.length > 0) {
    const total = highRateDebt.reduce(
      (s: number, d: any) => s + parseFloat(d.balance ?? "0"),
      0,
    );
    alerts.push({
      id: id("debt"),
      severity: "danger",
      type: "high_rate_debt",
      title: "High-interest debt detected",
      detail: `$${total.toLocaleString("en-CA", { maximumFractionDigits: 0 })} at >15% APR. This is costing more than most investments can earn.`,
      action: "Open Debt strategy",
    });
  }

  // ── Net worth ─────────────────────────────────────────────────────────────
  if (nwRows.length === 0) {
    alerts.push({
      id: id("networth"),
      severity: "info",
      type: "net_worth",
      title: "Net worth not entered",
      detail: "Assets and liabilities are needed for an accurate financial picture.",
      action: "Enter net worth",
    });
  }

  // Sort: danger first, then warn, then info
  const sevOrder = { danger: 0, warn: 1, info: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  res.json(alerts);
});

export { r as healthAlertsRouter };
