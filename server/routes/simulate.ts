import type { Response } from "express";
import { Router } from "express";
import { db } from "../db/index.js";
import { clients, retirementProjections } from "../../shared/schema.js";
import { isAuthenticated, type AuthRequest } from "../auth/index.js";
import { eq, and } from "drizzle-orm";
import { ownsClient } from "../fpUtils.js";

const r = Router();
r.use(isAuthenticated);

// POST /api/clients/:id/simulate
r.post("/clients/:id/simulate", async (req: AuthRequest, res: Response) => {
  const cid = +req.params.id;
  if (!await ownsClient(cid, req.userId!)) return res.status(404).json({ message: "Not found" });

  const [client] = await db.select().from(clients).where(eq(clients.id, cid));
  const [proj]   = await db.select().from(retirementProjections)
    .where(eq(retirementProjections.clientId, cid))
    .limit(1);

  const {
    simulations       = 1000,
    equityAllocation  = 60,
    equityReturn      = 7.0,
    equityStdDev      = 12.0,
    bondReturn        = 4.0,
    bondStdDev        = 5.0,
    inflationRate     = 2.5,
    lifeExpectancy    = 90,
    // Guardrail params
    guardrailFloor    = 0.80,   // trigger spending cut if portfolio < 80% of glide path
    guardrailCeiling  = 1.20,   // trigger spending raise if portfolio > 120% of glide path
    spendingFlexDown  = 0.10,   // cut spending by up to 10%
    spendingFlexUp    = 0.10,   // raise spending by up to 10%
  } = req.body;

  // Build profile from client + projection data
  const currentAge    = proj?.currentAge    ?? (new Date().getFullYear() - new Date(client.dateOfBirth ?? "1970-01-01").getFullYear());
  const retirementAge = proj?.retirementAge ?? client.retirementAge ?? 65;
  const rrsp          = Number(proj?.rrspBalance    ?? 0);
  const tfsa          = Number(proj?.tfsaBalance    ?? 0);
  const nonReg        = Number(proj?.nonRegBalance  ?? 0);
  const annualContrib = Number(proj?.annualContribution ?? 0);
  const desiredIncome = Number(proj?.desiredRetirementIncome  ?? client.desiredRetirementIncome ?? 50000);
  const { pensionPlans } = await import("../../shared/schema.js");
  const plans = await db.select().from(pensionPlans).where(eq(pensionPlans.clientId, cid));
  const pensionIncome = plans.reduce((sum: number, p: any) => {
    if (p.pensionType === "dbpp" && p.accrualRate && p.projectedYearsAtRetirement && p.bestAverageEarnings) {
      return sum + (Number(p.accrualRate) * Number(p.projectedYearsAtRetirement) * Number(p.bestAverageEarnings));
    }
    if (p.pensionType === "dcpp" && p.currentBalance) {
      return sum + (Number(p.currentBalance) * 0.04);
    }
    return sum;
  }, 0);
  
  const cppMonthly    = Number(proj?.cppMonthly     ?? 900);
  const oasMonthly    = Number(proj?.oasMonthly     ?? 700);
  const cppAge        = proj?.cppStartAge  ?? 65;
  const oasAge        = proj?.oasStartAge  ?? 65;

  const yearsToRetirement = Math.max(0, retirementAge - currentAge);
  const yearsInRetirement = Math.max(1, lifeExpectancy - retirementAge);
  const totalYears        = yearsToRetirement + yearsInRetirement;

  // ── Weighted portfolio assumptions ────────────────────────────────────────
  const eq_  = equityAllocation / 100;
  const bd_  = 1 - eq_;
  const portReturn  = eq_ * equityReturn  + bd_ * bondReturn;
  const portStdDev  = Math.sqrt((eq_ * equityStdDev) ** 2 + (bd_ * bondStdDev) ** 2);

  // ── Run simulations ────────────────────────────────────────────────────────
  const outcomes: number[]   = [];
  const yearlyMedian: number[] = new Array(totalYears).fill(0);
  const yearlyP10:    number[] = new Array(totalYears).fill(0);
  const yearlyP25:    number[] = new Array(totalYears).fill(0);
  const yearlyP75:    number[] = new Array(totalYears).fill(0);
  const yearlyP90:    number[] = new Array(totalYears).fill(0);
  const allYearBalances: number[][] = Array.from({ length: totalYears }, () => []);
  const guardrailEvents: { sim: number; year: number; type: string; adjustment: number }[] = [];

  let successCount = 0;

  for (let sim = 0; sim < simulations; sim++) {
    let balance = rrsp + tfsa + nonReg;
    let spending = desiredIncome;
    let glidePathBalance = rrsp + tfsa + nonReg; // deterministic glide path for guardrail comparison

    for (let yr = 0; yr < totalYears; yr++) {
      const age = currentAge + yr;

      // Random return this year (log-normal)
      const z       = gaussianRandom();
      const annualR = (portReturn / 100) + (portStdDev / 100) * z;
      const infl    = inflationRate / 100;

      // Accumulation phase
      if (age < retirementAge) {
        balance = balance * (1 + annualR) + annualContrib;
        glidePathBalance = glidePathBalance * (1 + portReturn / 100) + annualContrib;
      } else {
        // Retirement phase — apply guardrails
        const cpp = age >= cppAge ? cppMonthly * 12 : 0;
        const oas = age >= oasAge ? oasMonthly * 12 : 0;
        const govBenefits = cpp + oas + pensionIncome;
        const netWithdrawal = Math.max(0, spending - govBenefits);

        // Guardrail check vs glide path
        if (glidePathBalance > 0) {
          const ratio = balance / glidePathBalance;
          if (ratio < guardrailFloor) {
            spending = Math.max(spending * (1 - spendingFlexDown), desiredIncome * 0.75);
            guardrailEvents.push({ sim, year: yr, type: "reduce", adjustment: -(spending * spendingFlexDown) });
          } else if (ratio > guardrailCeiling) {
            spending = Math.min(spending * (1 + spendingFlexUp), desiredIncome * 1.25);
          }
        }

        balance = (balance - netWithdrawal) * (1 + annualR);
        glidePathBalance = (glidePathBalance - netWithdrawal) * (1 + portReturn / 100);
        spending *= (1 + infl); // inflation-adjust spending
      }

      balance = Math.max(0, balance);
      allYearBalances[yr].push(balance);
    }

    outcomes.push(balance);
    if (balance > 0) successCount++;
  }

  // ── Compute percentile bands per year ─────────────────────────────────────
  for (let yr = 0; yr < totalYears; yr++) {
    const sorted = allYearBalances[yr].slice().sort((a, b) => a - b);
    yearlyP10[yr]    = percentile(sorted, 10);
    yearlyP25[yr]    = percentile(sorted, 25);
    yearlyMedian[yr] = percentile(sorted, 50);
    yearlyP75[yr]    = percentile(sorted, 75);
    yearlyP90[yr]    = percentile(sorted, 90);
  }

  // ── Final balance percentiles ──────────────────────────────────────────────
  const sortedFinal = outcomes.slice().sort((a, b) => a - b);

  const result = {
    successRate:        successCount / simulations,
    successCount,
    simulations,
    yearsProjected:     totalYears,
    retirementAge,
    lifeExpectancy,
    // Percentile bands year by year
    percentileBands: {
      p10:    yearlyP10,
      p25:    yearlyP25,
      p50:    yearlyMedian,
      p75:    yearlyP75,
      p90:    yearlyP90,
      labels: Array.from({ length: totalYears }, (_, i) => currentAge + i),
    },
    // Final balance distribution
    finalBalancePercentiles: {
      p10: percentile(sortedFinal, 10),
      p25: percentile(sortedFinal, 25),
      p50: percentile(sortedFinal, 50),
      p75: percentile(sortedFinal, 75),
      p90: percentile(sortedFinal, 90),
    },
    // Guardrail summary
    guardrails: {
      floor:         guardrailFloor,
      ceiling:       guardrailCeiling,
      spendingFlexDown,
      spendingFlexUp,
      triggerRate:   guardrailEvents.length / simulations,
    },
    // Inputs echo
    inputs: {
      currentAge, retirementAge, lifeExpectancy,
      startingPortfolio: rrsp + tfsa + nonReg,
      annualContrib, desiredIncome,
      equityAllocation, equityReturn, equityStdDev,
      bondReturn, bondStdDev, inflationRate,
      cppMonthly, oasMonthly, cppAge, oasAge,
    },
  };

  // Save to projection record
  if (proj) {
    await (db.update(retirementProjections) as any).set({ successRate: String((result.successRate * 100).toFixed(1)), projectedBalance: String(result.finalBalancePercentiles.p50) }).where(eq(retirementProjections.id, proj.id));
  }

  res.json(result);
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function gaussianRandom(): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export { r as simulateRouter };
